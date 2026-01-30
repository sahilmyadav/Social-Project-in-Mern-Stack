'use client';

import { Button } from '@/components/ui/button';
import { ApiError } from '@/lib/api-client';
import { postService } from '@/lib/api-services';
import { Image as ImageIcon, Video, X } from 'lucide-react';
import React, { useEffect, useState } from 'react';

interface CreatePostModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit?: (post: any) => void;
}

type FileType = 'image' | 'video' | null;

export default function CreatePostModal({ isOpen, onClose, onSubmit }: CreatePostModalProps) {
  const [caption, setCaption] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [fileType, setFileType] = useState<FileType>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    if (isOpen) {
      const userData = localStorage.getItem('user');
      if (userData) {
        setUser(JSON.parse(userData));
      }
    }
  }, [isOpen]);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    const isImage = selectedFile.type.startsWith('image/');
    const isVideo = selectedFile.type.startsWith('video/');

    if (!isImage && !isVideo) {
      setError('Please select an image or video file');
      return;
    }

    const maxSize = isVideo ? 100 * 1024 * 1024 : 10 * 1024 * 1024;
    if (selectedFile.size > maxSize) {
      setError(`File size must be less than ${isVideo ? '100MB' : '10MB'}`);
      return;
    }

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    setFile(selectedFile);
    setFileType(isImage ? 'image' : 'video');
    setPreviewUrl(URL.createObjectURL(selectedFile));
    setError('');
  };

  const handleRemoveFile = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setFile(null);
    setFileType(null);
    setPreviewUrl('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!file) {
      setError('Please select an image or video to upload');
      return;
    }

    setLoading(true);

    try {
      const formData = new FormData();
      formData.append('files', file);
      formData.append('caption', caption.trim());

      const response = await postService.createPost(formData);

      if (response.success) {
        setCaption('');
        handleRemoveFile();

        if (onSubmit) {
          onSubmit(response.data);
        }

        onClose();
        window.location.reload();
      } else {
        setError(response.message || 'Failed to create post');
      }
    } catch (err) {
      const apiError = err as ApiError;
      console.error('Failed to create post:', apiError);

      if (apiError.statusCode === 401) {
        setError('Please login to create a post');
      } else if (apiError.statusCode === 413) {
        setError('File size too large. Please choose a smaller file.');
      } else {
        setError(apiError.message || 'Failed to create post. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setCaption('');
    handleRemoveFile();
    setError('');
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-2xl border border-border w-full max-w-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-border sticky top-0 bg-card z-10">
          <h2 className="text-xl font-bold">Create Post</h2>
          <button
            onClick={handleClose}
            className="p-1 hover:bg-muted rounded-full transition"
            disabled={loading}
          >
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center overflow-hidden">
              {user?.profileImage || user?.avatar ? (
                <img
                  src={user.profileImage || user.avatar}
                  alt={user?.firstName || 'User'}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-xl">😊</span>
              )}
            </div>
            <div>
              <p className="font-semibold">
                {user?.firstName || user?.name || 'User'} {user?.lastName || ''}
              </p>
              <p className="text-sm text-muted-foreground">Public</p>
            </div>
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 text-sm">
              {error}
            </div>
          )}

          <textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="What's on your mind?"
            className="w-full p-4 border border-border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-primary bg-background text-foreground"
            rows={4}
            disabled={loading}
            maxLength={500}
          />
          <p className="text-xs text-muted-foreground text-right">{caption.length}/500</p>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground block">
              Add Photo or Video <span className="text-red-500">*</span>
            </label>

            {!previewUrl ? (
              <div className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-primary transition cursor-pointer">
                <input
                  type="file"
                  accept="image/*,video/*"
                  onChange={handleFileChange}
                  className="hidden"
                  id="file-upload"
                  disabled={loading}
                />
                <label htmlFor="file-upload" className="cursor-pointer">
                  <div className="flex flex-col items-center gap-2">
                    <div className="flex gap-2">
                      <ImageIcon size={32} className="text-muted-foreground" />
                      <Video size={32} className="text-muted-foreground" />
                    </div>
                    <p className="text-muted-foreground">Click to upload</p>
                    <p className="text-xs text-muted-foreground">
                      Images up to 10MB, Videos up to 100MB
                    </p>
                  </div>
                </label>
              </div>
            ) : (
              <div className="relative">
                {fileType === 'image' ? (
                  <img
                    src={previewUrl}
                    alt="Preview"
                    className="w-full h-64 object-cover rounded-lg"
                  />
                ) : (
                  <video
                    src={previewUrl}
                    className="w-full h-64 object-cover rounded-lg"
                    controls
                    muted
                  />
                )}
                <button
                  type="button"
                  onClick={handleRemoveFile}
                  className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-full hover:bg-red-600 transition"
                  disabled={loading}
                >
                  <X size={20} />
                </button>
                <p className="text-xs text-muted-foreground mt-2">
                  {file?.name} ({(file!.size / 1024 / 1024).toFixed(2)} MB)
                </p>
              </div>
            )}
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              onClick={handleClose}
              variant="outline"
              className="flex-1 bg-transparent"
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
              disabled={loading || !file}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Posting...
                </span>
              ) : (
                'Post'
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
