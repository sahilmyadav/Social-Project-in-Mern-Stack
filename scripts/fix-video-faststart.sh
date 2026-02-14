#!/bin/bash
# ============================================================================
# Fix existing reel/story videos with ffmpeg faststart
# ============================================================================
# This script processes all existing MP4 videos in the uploads directory
# to move the moov atom to the front of the file. This allows browsers
# to start playing videos immediately without downloading the entire file.
#
# Usage: bash scripts/fix-video-faststart.sh
#
# Requirements: ffmpeg must be installed (apt install ffmpeg)
# ============================================================================

set -e

UPLOADS_DIR="$(dirname "$0")/../backend/uploads"
REELS_DIR="$UPLOADS_DIR/reels"
STORIES_DIR="$UPLOADS_DIR/stories"

PROCESSED=0
SKIPPED=0
FAILED=0

process_video() {
    local file="$1"
    local basename=$(basename "$file")
    local tmpfile="/tmp/faststart_${basename}"

    echo -n "  Processing: $basename ... "

    if ffmpeg -i "$file" -c copy -movflags +faststart -y "$tmpfile" 2>/dev/null; then
        # Check if the new file is valid (non-zero size)
        local newsize=$(stat --printf="%s" "$tmpfile" 2>/dev/null)
        if [ -n "$newsize" ] && [ "$newsize" -gt 0 ]; then
            sudo cp "$tmpfile" "$file"
            sudo chmod 644 "$file"
            rm -f "$tmpfile"
            echo "OK"
            PROCESSED=$((PROCESSED + 1))
        else
            rm -f "$tmpfile"
            echo "SKIP (output empty)"
            SKIPPED=$((SKIPPED + 1))
        fi
    else
        rm -f "$tmpfile"
        echo "FAIL"
        FAILED=$((FAILED + 1))
    fi
}

echo "============================================"
echo "  Video Faststart Processor"
echo "============================================"
echo ""

# Check ffmpeg
if ! command -v ffmpeg &> /dev/null; then
    echo "ERROR: ffmpeg is not installed."
    echo "Install it with: sudo apt install ffmpeg"
    exit 1
fi

echo "Processing reels directory: $REELS_DIR"
if [ -d "$REELS_DIR" ]; then
    count=$(find "$REELS_DIR" -name "*.mp4" -type f | wc -l)
    echo "  Found $count MP4 files"
    while IFS= read -r file; do
        process_video "$file"
    done < <(find "$REELS_DIR" -name "*.mp4" -type f)
else
    echo "  Directory not found, skipping"
fi

echo ""
echo "Processing stories directory: $STORIES_DIR"
if [ -d "$STORIES_DIR" ]; then
    count=$(find "$STORIES_DIR" -name "*.mp4" -type f | wc -l)
    echo "  Found $count MP4 files"
    while IFS= read -r file; do
        process_video "$file"
    done < <(find "$STORIES_DIR" -name "*.mp4" -type f)
else
    echo "  Directory not found, skipping"
fi

echo ""
echo "============================================"
echo "  Results:"
echo "  Processed: $PROCESSED"
echo "  Skipped:   $SKIPPED"
echo "  Failed:    $FAILED"
echo "============================================"
echo ""
echo "Done! Existing videos now have faststart enabled."
echo "New uploads will be automatically processed."
