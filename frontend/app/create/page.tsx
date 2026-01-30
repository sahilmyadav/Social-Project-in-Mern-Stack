'use client';

import Navigation from '@/components/navigation';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ApiError } from '@/lib/api-client';
import { postService, reelService } from '@/lib/api-services';
import { CheckCircle2, Upload } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

type ContentType = 'post' | 'reel';

export default function CreatePage() {
  const [user, setUser] = useState<any>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [caption, setCaption] = useState('');
  const [tags, setTags] = useState('');
  const [contentType, setContentType] = useState<ContentType>('post');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (!userData) {
      router.push('/');
    } else {
      setUser(JSON.parse(userData));
    }
  }, [router]);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const handleLogout = () => {
    localStorage.removeItem('user');
    router.push('/');
  };

  const handleFileSelect = (file: File | null) => {
    if (!file) return;

    const isImage = file.type.startsWith('image/');
    const isVideo = file.type.startsWith('video/');

    if (contentType === 'post' && !isImage && !isVideo) {
      setError('Please select an image or video file for posts');
      return;
    }

    if (contentType === 'reel' && !isVideo) {
      setError('Please select a video file for reels');
      return;
    }

    const maxSize = isVideo ? 100 * 1024 * 1024 : 10 * 1024 * 1024;
    if (file.size > maxSize) {
      setError(`File size must be less than ${isVideo ? '100MB' : '10MB'}`);
      return;
    }

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    setUploadedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setError('');
  };

  const handleRemoveFile = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setUploadedFile(null);
    setPreviewUrl('');
  };

  const handlePublish = async () => {
    if (!uploadedFile) {
      setError('Please upload a file');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('files', uploadedFile);
      formData.append('caption', caption.trim());

      if (tags.trim()) {
        const tagArray = tags
          .split(',')
          .map((tag) => tag.trim())
          .filter(Boolean);
        formData.append('tags', JSON.stringify(tagArray));
      }

      let response;
      if (contentType === 'post') {
        response = await postService.createPost(formData);
      } else {
        response = await reelService.uploadReel(formData);
      }

      if (response.success) {
        setCaption('');
        setTags('');
        handleRemoveFile();
        setShowSuccessDialog(true);
      } else {
        setError(response.message || `Failed to publish ${contentType}`);
      }
    } catch (err) {
      const apiError = err as ApiError;
      console.error(`Failed to publish ${contentType}:`, apiError);

      if (apiError.statusCode === 401) {
        setError('Please login to create content');
        router.push('/login');
      } else if (apiError.statusCode === 413) {
        setError('File size too large. Please choose a smaller file.');
      } else {
        setError(apiError.message || `Failed to publish ${contentType}. Please try again.`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleContentTypeChange = (type: ContentType) => {
    setContentType(type);
    handleRemoveFile();
    setError('');
  };

  if (!user) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>;
  }

  const isVideo = uploadedFile?.type.startsWith('video/');

  return (
    <main className="min-h-screen bg-background pb-20 lg:pb-0">
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <aside className="hidden lg:block lg:col-span-1 border-r border-border sticky top-0 h-screen p-4 overflow-y-auto">
          <Navigation user={user} onLogout={handleLogout} />
        </aside>

        <section className="lg:col-span-2 max-w-2xl mx-auto">
          <div className="bg-card rounded-2xl border border-border p-8">
            <h1 className="text-3xl font-bold text-foreground mb-6">Create New Content</h1>

            {error && (
              <div className="mb-6 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 text-sm">
                {error}
              </div>
            )}

            <div className="mb-8">
              <p className="text-foreground font-semibold mb-4">What would you like to create?</p>
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => handleContentTypeChange('post')}
                  className={`p-4 rounded-xl border-2 transition ${
                    contentType === 'post'
                      ? 'border-primary bg-primary/10'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <p className="text-2xl mb-2">📸</p>
                  <p className="font-semibold text-foreground">Post</p>
                  <p className="text-xs text-muted-foreground mt-1">Photos & Videos</p>
                </button>
                <button
                  onClick={() => handleContentTypeChange('reel')}
                  className={`p-4 rounded-xl border-2 transition ${
                    contentType === 'reel'
                      ? 'border-primary bg-primary/10'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <p className="text-2xl mb-2">🎬</p>
                  <p className="font-semibold text-foreground">Reel</p>
                  <p className="text-xs text-muted-foreground mt-1">Short Videos</p>
                </button>
              </div>
            </div>

            <div className="mb-8">
              <label className="block">
                <div className="border-2 border-dashed border-primary/50 rounded-xl p-8 text-center cursor-pointer hover:border-primary transition">
                  {uploadedFile ? (
                    <div className="relative">
                      {isVideo ? (
                        <video
                          src={previewUrl}
                          className="w-full max-h-64 object-contain rounded-lg mx-auto"
                          controls
                          muted
                        />
                      ) : (
                        <img
                          src={previewUrl}
                          alt="Preview"
                          className="w-full max-h-64 object-contain rounded-lg mx-auto"
                        />
                      )}
                      <p className="text-sm text-muted-foreground mt-3">{uploadedFile.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {(uploadedFile.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          handleRemoveFile();
                        }}
                        className="mt-4 px-4 py-2 bg-red-500/10 text-red-500 rounded-lg hover:bg-red-500/20 transition text-sm"
                        type="button"
                      >
                        Remove File
                      </button>
                    </div>
                  ) : (
                    <div>
                      <Upload size={40} className="mx-auto mb-2 text-primary" />
                      <p className="text-foreground font-semibold">Click to upload</p>
                      <p className="text-sm text-muted-foreground">
                        {contentType === 'post'
                          ? 'Images (up to 10MB) or Videos (up to 100MB)'
                          : 'Videos only (up to 100MB)'}
                      </p>
                    </div>
                  )}
                </div>
                <input
                  type="file"
                  className="hidden"
                  onChange={(e) => handleFileSelect(e.target.files?.[0] || null)}
                  accept={contentType === 'post' ? 'image/*,video/*' : 'video/*'}
                  disabled={loading}
                />
              </label>
            </div>

            <div className="mb-6">
              <label className="text-foreground font-semibold block mb-2">Caption</label>
              <textarea
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="Write a caption..."
                className="w-full p-4 border border-border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-primary bg-background text-foreground"
                rows={3}
                disabled={loading}
                maxLength={500}
              />
              <p className="text-xs text-muted-foreground mt-1 text-right">{caption.length}/500</p>
            </div>

            <div className="mb-8">
              <label className="text-foreground font-semibold block mb-2">Tags (optional)</label>
              <input
                type="text"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="travel, photography, nature"
                className="w-full p-4 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-background text-foreground"
                disabled={loading}
              />
              <p className="text-xs text-muted-foreground mt-1">Separate tags with commas</p>
            </div>

            <div className="flex gap-4">
              <Button
                onClick={() => router.push('/home')}
                variant="outline"
                className="flex-1 bg-transparent"
                disabled={loading}
              >
                Cancel
              </Button>
              <Button
                onClick={handlePublish}
                className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
                disabled={!uploadedFile || loading}
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Publishing...
                  </span>
                ) : (
                  `Publish ${contentType === 'post' ? 'Post' : 'Reel'}`
                )}
              </Button>
            </div>
          </div>
        </section>
      </div>

      <Navigation user={user} onLogout={handleLogout} isMobile={true} />

      <Dialog open={showSuccessDialog} onOpenChange={setShowSuccessDialog}>
        <DialogContent className="sm:max-w-md" showCloseButton={false}>
          <DialogHeader className="text-center sm:text-center">
            <div className="mx-auto w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mb-4">
              <CheckCircle2 className="w-10 h-10 text-green-600 dark:text-green-400" />
            </div>
            <DialogTitle className="text-xl">
              {contentType === 'post' ? 'Post' : 'Reel'} Published! 🎉
            </DialogTitle>
            <DialogDescription className="text-center">
              Your {contentType} has been uploaded successfully.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="sm:justify-center gap-2 mt-4">
            <Button
              variant="outline"
              onClick={() => setShowSuccessDialog(false)}
              className="flex-1 sm:flex-none"
            >
              Create Another
            </Button>
            <Button
              onClick={() => {
                setShowSuccessDialog(false);
                router.push('/home');
              }}
              className="flex-1 sm:flex-none bg-primary hover:bg-primary/90"
            >
              View Feed
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
