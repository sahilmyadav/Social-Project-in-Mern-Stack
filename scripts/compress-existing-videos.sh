#!/bin/bash
# ============================================================================
# Compress existing reel/story videos for fast streaming
# ============================================================================
# Re-encodes to H.264 at ~2.5 Mbps (Instagram-level quality) with faststart.
# A 42MB raw phone video → ~5-8MB compressed. Loads in 1-2 seconds.
#
# Usage: sudo bash scripts/compress-existing-videos.sh
# ============================================================================

set -euo pipefail

UPLOADS_DIR="$(cd "$(dirname "$0")/../backend/uploads" && pwd)"
REELS_DIR="$UPLOADS_DIR/reels"
STORIES_DIR="$UPLOADS_DIR/stories"

PROCESSED=0
SKIPPED=0
FAILED=0
SAVED_TOTAL=0

# Only compress videos larger than this (in bytes) — 8MB
SIZE_THRESHOLD=$((8 * 1024 * 1024))

compress_video() {
    local file="$1"
    local bn=$(basename "$file")
    local filesize=$(stat --printf="%s" "$file" 2>/dev/null || echo 0)
    local filesizeMB=$((filesize / 1024 / 1024))

    # Skip small files — already compressed or short
    if [ "$filesize" -lt "$SIZE_THRESHOLD" ]; then
        echo "  SKIP (${filesizeMB}MB < threshold): $bn"
        SKIPPED=$((SKIPPED + 1))
        return
    fi

    local tmpfile="/tmp/compress_${bn}"

    echo -n "  Compressing ${filesizeMB}MB: $bn ... "

    if ffmpeg -i "$file" \
        -c:v libx264 \
        -preset fast \
        -crf 28 \
        -maxrate 2500k \
        -bufsize 5000k \
        -vf "scale=720:-2" \
        -c:a aac \
        -b:a 128k \
        -ac 2 \
        -movflags +faststart \
        -pix_fmt yuv420p \
        -y "$tmpfile" 2>/dev/null; then

        local newsize=$(stat --printf="%s" "$tmpfile" 2>/dev/null || echo 0)
        local newsizeMB=$((newsize / 1024 / 1024))

        if [ "$newsize" -gt 0 ]; then
            local saved=$(( (filesize - newsize) / 1024 / 1024 ))
            cp "$tmpfile" "$file"
            chmod 644 "$file"
            # Preserve Docker ownership (1001:65533)
            chown 1001:65533 "$file" 2>/dev/null || true
            rm -f "$tmpfile"
            echo "OK (${filesizeMB}MB → ${newsizeMB}MB, saved ${saved}MB)"
            PROCESSED=$((PROCESSED + 1))
            SAVED_TOTAL=$((SAVED_TOTAL + saved))
        else
            rm -f "$tmpfile"
            echo "EMPTY OUTPUT"
            FAILED=$((FAILED + 1))
        fi
    else
        rm -f "$tmpfile"
        echo "FAIL"
        FAILED=$((FAILED + 1))
    fi
}

echo "============================================"
echo "  Video Compression for Fast Streaming"
echo "  Target: H.264 ~2.5Mbps, 720p, faststart"
echo "============================================"
echo ""

if ! command -v ffmpeg &> /dev/null; then
    echo "ERROR: ffmpeg is not installed. Run: sudo apt install ffmpeg"
    exit 1
fi

# Process reels
echo "Processing reels: $REELS_DIR"
if [ -d "$REELS_DIR" ]; then
    count=$(find "$REELS_DIR" -name "*.mp4" -type f | wc -l)
    echo "  Found $count MP4 files"
    for file in "$REELS_DIR"/*.mp4; do
        [ -f "$file" ] || continue
        compress_video "$file"
    done
else
    echo "  Directory not found"
fi

echo ""

# Process stories
echo "Processing stories: $STORIES_DIR"
if [ -d "$STORIES_DIR" ]; then
    count=$(find "$STORIES_DIR" -name "*.mp4" -type f | wc -l)
    echo "  Found $count MP4 files"
    for file in "$STORIES_DIR"/*.mp4; do
        [ -f "$file" ] || continue
        compress_video "$file"
    done
else
    echo "  Directory not found"
fi

echo ""
echo "============================================"
echo "  Results:"
echo "  Compressed: $PROCESSED"
echo "  Skipped:    $SKIPPED (< ${SIZE_THRESHOLD}B)"
echo "  Failed:     $FAILED"
echo "  Total saved: ~${SAVED_TOTAL}MB"
echo "============================================"
