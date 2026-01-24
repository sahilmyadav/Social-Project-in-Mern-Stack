"use client";

import { useState, useRef } from "react";
import {
  X,
  Upload,
  Image as ImageIcon,
  Video,
  Music,
  Sparkles,
  Sun,
  Moon,
  Sunset,
  Sunrise,
  CloudRain,
  Flame,
  Snowflake,
  Zap,
  Heart,
  Star,
  Camera,
  Palette,
  Contrast,
  Droplet,
  Wind,
  Coffee,
  Aperture
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { storyService } from "@/lib/api-services";
import MusicPickerModal from "@/components/music-picker-modal";
import "@/styles/filters.css";

interface AddStoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

// Instagram-style filters with icons
const FILTERS = [
  { name: "Normal", value: "normal", icon: Camera },
  { name: "Clarendon", value: "clarendon", icon: Sun },
  { name: "Gingham", value: "gingham", icon: Sparkles },
  { name: "Juno", value: "juno", icon: Sunset },
  { name: "Lark", value: "lark", icon: Sunrise },
  { name: "Ludwig", value: "ludwig", icon: Palette },
  { name: "Valencia", value: "valencia", icon: Heart },
  { name: "X-Pro II", value: "xpro2", icon: Zap },
  { name: "Aden", value: "aden", icon: CloudRain },
  { name: "Brooklyn", value: "brooklyn", icon: Coffee },
  { name: "Earlybird", value: "earlybird", icon: Sunrise },
  { name: "Inkwell", value: "inkwell", icon: Moon },
  { name: "Nashville", value: "nashville", icon: Star },
  { name: "Perpetua", value: "perpetua", icon: Contrast },
  { name: "Reyes", value: "reyes", icon: Droplet },
  { name: "Rise", value: "rise", icon: Sunrise },
  { name: "Slumber", value: "slumber", icon: Moon },
  { name: "Toaster", value: "toaster", icon: Flame },
  { name: "Walden", value: "walden", icon: Wind },
  { name: "Willow", value: "willow", icon: Snowflake },
  { name: "Vintage", value: "vintage", icon: Camera },
  { name: "Cool", value: "cool", icon: Snowflake },
  { name: "Warm", value: "warm", icon: Flame },
  { name: "Dramatic", value: "dramatic", icon: Zap },
  { name: "Vivid", value: "vivid", icon: Aperture },
];

export default function AddStoryModal({
  isOpen,
  onClose,
  onSuccess,
}: AddStoryModalProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [fileType, setFileType] = useState<"image" | "video" | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState("");
  const [selectedFilter, setSelectedFilter] = useState("normal");
  const [showMusicPicker, setShowMusicPicker] = useState(false);
  const [selectedMusic, setSelectedMusic] = useState<{
    trackId: string;
    trackName: string;
    artistName: string;
    albumArt: string;
    previewUrl: string;
    startTime: number;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) {
      setError("Please select an image or video file");
      return;
    }

    // Validate file size (max 50MB)
    if (file.size > 50 * 1024 * 1024) {
      setError("File size must be less than 50MB");
      return;
    }

    setError("");
    setSelectedFile(file);
    const type = file.type.startsWith("image/") ? "image" : "video";
    setFileType(type);

    // Create preview URL
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    setError("");

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("filter", selectedFilter);



      // Add music data if selected
      if (selectedMusic) {
        const musicData = {
          trackId: selectedMusic.trackId,
          trackName: selectedMusic.trackName,
          artistName: selectedMusic.artistName,
          albumArt: selectedMusic.albumArt,
          previewUrl: selectedMusic.previewUrl,
          startTime: selectedMusic.startTime, // ← CRITICAL: Include start time
        };
        formData.append("music", JSON.stringify(musicData));
      }

      const response = await storyService.uploadStory(formData);

      if (response.success) {
        onSuccess?.();
        handleClose();
      } else {
        setError(response.message || "Failed to upload story");
      }
    } catch (err: any) {
      console.error("❌ Error uploading story:", err);
      setError(err.message || "Failed to upload story. Please try again.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleClose = () => {
    setSelectedFile(null);
    setPreviewUrl("");
    setFileType(null);
    setError("");
    setSelectedFilter("normal");
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-background rounded-3xl shadow-2xl max-w-xl w-full max-h-[95vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border flex-shrink-0">
          <h2 className="text-xl font-bold">Add to Story</h2>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-muted rounded-full transition"
            disabled={isUploading}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content - Scrollable */}
        <div className="flex-1 overflow-y-auto p-4">
          {!selectedFile ? (
            // Upload area
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-border rounded-2xl p-12 text-center cursor-pointer hover:border-primary transition"
            >
              <div className="flex flex-col items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <Upload className="w-8 h-8 text-primary" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold mb-2">
                    Upload a Photo or Video
                  </h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Share a moment with your followers
                  </p>
                  <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <ImageIcon className="w-4 h-4" />
                      <span>Images</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Video className="w-4 h-4" />
                      <span>Videos</span>
                    </div>
                  </div>
                </div>
                <Button variant="default" size="lg">
                  Select File
                </Button>
              </div>
            </div>
          ) : (
            // Preview area
            <div className="space-y-3">
              <div className="relative rounded-2xl overflow-hidden bg-black aspect-[9/16] max-h-[400px] flex items-center justify-center">
                {fileType === "image" ? (
                  <img
                    src={previewUrl}
                    alt="Story preview"
                    className={`max-w-full max-h-full object-contain filter-${selectedFilter}`}
                  />
                ) : (
                  <video
                    src={previewUrl}
                    controls
                    className={`max-w-full max-h-full object-contain filter-${selectedFilter}`}
                  />
                )}

                {/* Music indicator overlay */}
                {selectedMusic && (
                  <div className="absolute bottom-4 left-4 right-4 bg-black/60 backdrop-blur-sm rounded-xl p-3 flex items-center gap-3">
                    <div className="w-10 h-10 rounded bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center flex-shrink-0">
                      <Music className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-semibold text-sm truncate">
                        {selectedMusic.trackName}
                      </p>
                      <p className="text-white/70 text-xs truncate">
                        {selectedMusic.artistName}
                      </p>
                    </div>
                    <button
                      onClick={() => setSelectedMusic(null)}
                      className="p-1 hover:bg-white/20 rounded-full transition"
                    >
                      <X className="w-4 h-4 text-white" />
                    </button>
                  </div>
                )}
              </div>

              {/* Filter Gallery */}
              <div className="space-y-2">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-1">
                  Filters
                </h3>
                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                  {FILTERS.map((filter) => {
                    const IconComponent = filter.icon;
                    return (
                      <button
                        key={filter.value}
                        onClick={() => setSelectedFilter(filter.value)}
                        className={`flex-shrink-0 flex flex-col items-center gap-1.5 transition ${selectedFilter === filter.value ? "opacity-100" : "opacity-60 hover:opacity-80"
                          }`}
                      >
                        <div
                          className={`w-14 h-14 rounded-xl overflow-hidden border-2 transition relative ${selectedFilter === filter.value
                            ? "border-primary shadow-lg shadow-primary/20 scale-105"
                            : "border-border"
                            }`}
                        >
                          {/* Gradient background with filter applied */}
                          <div
                            className={`absolute inset-0 bg-gradient-to-br from-purple-400 via-pink-400 to-orange-400 filter-${filter.value}`}
                          />
                          {/* Icon overlay */}
                          <div className="absolute inset-0 flex items-center justify-center bg-black/10">
                            <IconComponent className="w-6 h-6 text-white drop-shadow-md" />
                          </div>
                        </div>
                        <span className="text-[10px] font-medium text-center leading-tight max-w-[56px] truncate">
                          {filter.name}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Add Music Button */}
              {!selectedMusic && (
                <Button
                  variant="outline"
                  onClick={() => setShowMusicPicker(true)}
                  disabled={isUploading}
                  className="w-full gap-2"
                >
                  <Music className="w-4 h-4" />
                  Add Music
                </Button>
              )}

              {error && (
                <div className="p-3 bg-destructive/10 border border-destructive rounded-lg text-destructive text-sm">
                  {error}
                </div>
              )}
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*"
            onChange={handleFileSelect}
            className="hidden"
          />
        </div>

        {/* Footer with Action Buttons - Always Visible */}
        {selectedFile && (
          <div className="border-t border-border p-4 flex gap-3 flex-shrink-0 bg-background">
            <Button
              variant="outline"
              onClick={() => {
                setSelectedFile(null);
                setPreviewUrl("");
                setFileType(null);
                setError("");
                setSelectedMusic(null);
                setSelectedFilter("normal");
              }}
              disabled={isUploading}
              className="flex-1"
            >
              Change File
            </Button>
            <Button
              onClick={handleUpload}
              disabled={isUploading}
              className="flex-1"
            >
              {isUploading ? "Uploading..." : "Share to Story"}
            </Button>
          </div>
        )}
      </div>

      {/* Music Picker Modal */}
      <MusicPickerModal
        isOpen={showMusicPicker}
        onClose={() => setShowMusicPicker(false)}
        onSelectMusic={(music) => {
          setSelectedMusic(music);
          setShowMusicPicker(false);
        }}
      />
    </div>
  );
}
