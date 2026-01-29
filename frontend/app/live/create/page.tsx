'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { liveStreamService } from '@/lib/api-services';
import { ArrowLeft, Camera, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';

export default function CreateLivePage() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [thumbnail, setThumbnail] = useState<File | null>(null);
  const [thumbnailPreview, setThumbnailPreview] = useState<string>('');
  const [creating, setCreating] = useState(false);

  const handleThumbnailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setThumbnail(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setThumbnailPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCreateLiveStream = async () => {
    if (!title.trim()) {
      toast.error('Please enter a title for your live stream');
      return;
    }

    setCreating(true);
    try {
      const response = await liveStreamService.createLiveStream({
        title: title.trim(),
        description: description.trim() || undefined,
        thumbnail: thumbnail || undefined,
      });

      if (response.success && response.data) {
        toast.success('Live stream created! Starting broadcast...');
        // Navigate to the broadcast page
        router.push(`/live/broadcast/${response.data._id}`);
      } else {
        toast.error(response.message || 'Failed to create live stream');
      }
    } catch (error: any) {
      console.error('Error creating live stream:', error);
      toast.error(error.message || 'Failed to create live stream');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-3 py-4 sm:px-4 sm:py-6 max-w-lg">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()} className="h-8 w-8">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold">Create Live Stream</h1>
            <p className="text-muted-foreground text-xs sm:text-sm">
              Set up your live stream details
            </p>
          </div>
        </div>

        {/* Form */}
        <Card>
          <CardHeader className="pb-3 pt-4 px-4">
            <CardTitle className="text-base">Stream Details</CardTitle>
            <CardDescription className="text-xs">
              Add information about your live stream
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 px-4 pb-4">
            {/* Title */}
            <div className="space-y-1.5">
              <Label htmlFor="title" className="text-sm">
                Title <span className="text-red-500">*</span>
              </Label>
              <Input
                id="title"
                placeholder="What's your live stream about?"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={100}
                className="h-9"
              />
              <p className="text-[10px] text-muted-foreground">{title.length}/100 characters</p>
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <Label htmlFor="description" className="text-sm">
                Description (Optional)
              </Label>
              <Textarea
                id="description"
                placeholder="Tell viewers what to expect..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={500}
                rows={2}
                className="min-h-[60px] resize-none"
              />
              <p className="text-[10px] text-muted-foreground">
                {description.length}/500 characters
              </p>
            </div>

            {/* Thumbnail */}
            <div className="space-y-1.5">
              <Label htmlFor="thumbnail" className="text-sm">
                Thumbnail (Optional)
              </Label>
              <div>
                {thumbnailPreview ? (
                  <div className="relative aspect-[16/9] max-h-28 rounded-lg overflow-hidden border">
                    <img
                      src={thumbnailPreview}
                      alt="Thumbnail preview"
                      className="w-full h-full object-cover"
                    />
                    <Button
                      variant="secondary"
                      size="sm"
                      className="absolute top-1 right-1 h-6 text-xs px-2"
                      onClick={() => {
                        setThumbnail(null);
                        setThumbnailPreview('');
                      }}
                    >
                      Remove
                    </Button>
                  </div>
                ) : (
                  <label
                    htmlFor="thumbnail"
                    className="flex flex-col items-center justify-center h-24 rounded-lg border-2 border-dashed border-muted-foreground/25 hover:border-muted-foreground/50 cursor-pointer transition-colors"
                  >
                    <Camera className="h-8 w-8 text-muted-foreground mb-1" />
                    <span className="text-xs text-muted-foreground">Click to upload thumbnail</span>
                    <input
                      id="thumbnail"
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleThumbnailChange}
                    />
                  </label>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => router.back()}
                className="flex-1 h-9"
                disabled={creating}
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreateLiveStream}
                className="flex-1 gap-2 h-9"
                disabled={creating || !title.trim()}
              >
                {creating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  'Create & Go Live'
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Tips - Hidden on mobile, shown on larger screens */}
        <Card className="mt-4 bg-muted/50 hidden sm:block">
          <CardHeader className="pb-2 pt-3">
            <CardTitle className="text-sm">Tips for a great live stream</CardTitle>
          </CardHeader>
          <CardContent className="pb-3">
            <ul className="space-y-1 text-xs text-muted-foreground">
              <li className="flex items-start gap-2">
                <span className="text-primary">•</span>
                <span>Use a clear, descriptive title</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary">•</span>
                <span>Ensure stable internet connection</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary">•</span>
                <span>Test camera and microphone before going live</span>
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
