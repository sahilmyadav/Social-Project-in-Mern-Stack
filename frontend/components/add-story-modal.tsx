"use client";

import { useState, useRef } from "react";
import { X, Upload, Image as ImageIcon, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { storyService } from "@/lib/api-services";

interface AddStoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

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

      const response = await storyService.uploadStory(formData);

      if (response.success) {
        console.log("✅ Story uploaded successfully", response.data);
        console.log("📸 Calling onSuccess callback to reload stories");
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
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="bg-background rounded-3xl shadow-2xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h2 className="text-2xl font-bold">Add to Story</h2>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-muted rounded-full transition"
            disabled={isUploading}
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
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
            <div className="space-y-4">
              <div className="relative rounded-2xl overflow-hidden bg-black aspect-[9/16] max-h-[500px] flex items-center justify-center">
                {fileType === "image" ? (
                  <img
                    src={previewUrl}
                    alt="Story preview"
                    className="max-w-full max-h-full object-contain"
                  />
                ) : (
                  <video
                    src={previewUrl}
                    controls
                    className="max-w-full max-h-full object-contain"
                  />
                )}
              </div>

              {error && (
                <div className="p-3 bg-destructive/10 border border-destructive rounded-lg text-destructive text-sm">
                  {error}
                </div>
              )}

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => {
                    setSelectedFile(null);
                    setPreviewUrl("");
                    setFileType(null);
                    setError("");
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
      </div>
    </div>
  );
}
