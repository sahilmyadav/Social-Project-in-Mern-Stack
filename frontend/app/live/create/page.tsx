'use client';

/**
 * ============================================================================
 * GO LIVE SETUP PAGE - Pre-Stream Configuration
 * ============================================================================
 *
 * This page allows users to configure their live stream before going live.
 * It's the first step in the broadcasting flow, similar to Instagram's
 * pre-live screen where you add a title before starting.
 *
 * FLOW OVERVIEW:
 * --------------
 * 1. User arrives at /live/create
 * 2. User fills in stream details (title, description)
 * 3. Optionally uploads a thumbnail
 * 4. Clicks "Create & Go Live"
 * 5. REST API creates LiveStream document with status: 'waiting'
 * 6. User redirected to /live/broadcast/[streamId] for camera preview
 *
 * API CALL:
 * ---------
 * POST /api/v1/live/create
 * Body (FormData if thumbnail included):
 *   - title: string (required)
 *   - description: string (optional)
 *   - thumbnail: File (optional)
 *
 * Response:
 *   - success: boolean
 *   - data: LiveStream object with _id
 *   - message: string
 *
 * DATABASE:
 * ---------
 * Creates a new document in 'livestreams' collection:
 * {
 *   _id: ObjectId,
 *   streamerId: ObjectId (current user),
 *   title: string,
 *   description: string,
 *   thumbnail: string (Cloudinary URL),
 *   status: 'waiting',
 *   viewerCount: 0,
 *   createdAt: Date,
 *   updatedAt: Date
 * }
 *
 * ============================================================================
 */

import Navigation from '@/components/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { authService, liveStreamService } from '@/lib/api-services';
import {
  ArrowLeft,
  Camera,
  Clock,
  Lightbulb,
  Loader2,
  Shield,
  Sparkles,
  Users,
  Video,
  Zap,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

/**
 * Tips data for the sidebar
 * These help users create better live streams
 */
const STREAMING_TIPS = [
  {
    icon: Lightbulb,
    title: 'Good Lighting',
    description: 'Face a window or use soft lighting for best video quality',
  },
  {
    icon: Shield,
    title: 'Stable Connection',
    description: 'Use WiFi or strong cellular for uninterrupted streaming',
  },
  {
    icon: Users,
    title: 'Engage Viewers',
    description: 'Respond to comments and questions to build community',
  },
  {
    icon: Clock,
    title: 'Ideal Duration',
    description: '15-30 minutes is great for maintaining viewer attention',
  },
];

export default function CreateLivePage() {
  const router = useRouter();

  /**
   * Form State
   * ----------
   * - title: Stream title (required, max 100 chars)
   * - description: Stream description (optional, max 500 chars)
   * - thumbnail: File object for thumbnail image
   * - thumbnailPreview: Base64 data URL for preview display
   * - creating: Loading state during API call
   */
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [thumbnail, setThumbnail] = useState<File | null>(null);
  const [thumbnailPreview, setThumbnailPreview] = useState<string>('');
  const [creating, setCreating] = useState(false);
  const [user, setUser] = useState<any>(null);

  // Check authentication on mount
  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (!userData) {
      router.push('/login');
    } else {
      setUser(JSON.parse(userData));
    }
  }, [router]);

  /**
   * Handle Thumbnail Upload
   * -----------------------
   * When user selects an image:
   * 1. Store the File object in state
   * 2. Read file as Data URL for preview
   *
   * The actual file will be uploaded to Cloudinary via the API
   * when creating the stream.
   */
  const handleThumbnailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        toast.error('Please select an image file');
        return;
      }

      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Image must be less than 5MB');
        return;
      }

      setThumbnail(file);

      // Create preview using FileReader
      const reader = new FileReader();
      reader.onloadend = () => {
        setThumbnailPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  /**
   * Create Live Stream
   * ------------------
   *
   * API Flow:
   * 1. Validate title is not empty
   * 2. Build request body (FormData if thumbnail, JSON otherwise)
   * 3. POST to /api/v1/live/create
   * 4. On success: navigate to broadcast page
   *
   * What happens in the backend:
   * 1. If thumbnail provided, upload to Cloudinary
   * 2. Create LiveStream document in MongoDB
   * 3. Return created stream with _id
   *
   * The stream is created with status: 'waiting'
   * It becomes 'live' only when the user clicks "Go Live" on broadcast page
   */
  const handleCreateLiveStream = async () => {
    // Check authentication first
    const token = localStorage.getItem('accessToken');
    if (!token) {
      toast.error('Please log in to start a live stream');
      router.push('/login');
      return;
    }

    // Validation
    if (!title.trim()) {
      toast.error('Please enter a title for your live stream');
      return;
    }

    setCreating(true);
    try {
      console.log('📡 Creating live stream with:', {
        title: title.trim(),
        description: description.trim(),
      });
      console.log('📡 Auth token present:', !!token);

      // Call the API to create the stream
      const response = await liveStreamService.createLiveStream({
        title: title.trim(),
        description: description.trim() || undefined,
        thumbnail: thumbnail || undefined,
      });

      console.log('📡 Create stream response:', response);

      if (response.success && response.data) {
        toast.success('Live stream created! Setting up camera...');

        // Navigate to the broadcast page where camera will be initialized
        // The streamId is used to track this specific stream
        router.push(`/live/broadcast/${response.data._id}`);
      } else {
        console.error('Create stream failed:', response);
        toast.error(response.message || 'Failed to create live stream');
      }
    } catch (error: any) {
      // Log all properties of the error for debugging
      console.error('Error creating live stream - full error:', {
        message: error?.message,
        error: error?.error,
        statusCode: error?.statusCode,
        success: error?.success,
        errors: error?.errors,
        name: error?.name,
        stack: error?.stack,
      });

      // Display appropriate error message
      const errorMessage = error?.message || error?.error || 'Failed to create live stream';
      toast.error(errorMessage);

      // If it's an auth error, redirect to login
      if (error?.statusCode === 401) {
        router.push('/login');
      }
    } finally {
      setCreating(false);
    }
  };

  /**
   * Handle user logout
   */
  const handleLogout = async () => {
    try {
      await authService.logout();
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      localStorage.removeItem('user');
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      router.push('/login');
    }
  };

  if (!user) return null;

  return (
    <main className="min-h-screen bg-background">
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Desktop Sidebar Navigation */}
        <aside className="hidden lg:block lg:col-span-1 border-r border-border sticky top-0 h-screen p-4 overflow-y-auto">
          <Navigation user={user} onLogout={handleLogout} />
        </aside>

        {/* Main Content */}
        <section className="lg:col-span-3 pb-20 lg:pb-0">
          <div className="container mx-auto px-4 py-6 max-w-4xl">
            {/* Header with Back Button */}
            <div className="flex items-center gap-4 mb-8">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => router.back()}
                className="hover:bg-muted"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-2xl font-bold flex items-center gap-2 text-foreground">
                  <Video className="h-6 w-6 text-red-500" />
                  Go Live
                </h1>
                <p className="text-muted-foreground text-sm">
                  Set up your live stream before going live
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Main Form */}
              <div className="lg:col-span-2">
                <Card className="bg-card border-border">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Sparkles className="h-5 w-5 text-purple-500" />
                      Stream Details
                    </CardTitle>
                    <CardDescription>
                      Add information about your live stream to help viewers find you
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Title Input */}
                    <div className="space-y-2">
                      <Label htmlFor="title" className="text-sm font-medium">
                        Title <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="title"
                        placeholder="What's your live stream about?"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        maxLength={100}
                        className="bg-muted border-border focus:border-primary h-12"
                      />
                      <p className="text-xs text-muted-foreground flex justify-between">
                        <span>Give your stream a catchy title</span>
                        <span>{title.length}/100</span>
                      </p>
                    </div>

                    {/* Description Input */}
                    <div className="space-y-2">
                      <Label htmlFor="description" className="text-sm font-medium">
                        Description
                        <Badge variant="secondary" className="ml-2 text-xs bg-muted">
                          Optional
                        </Badge>
                      </Label>
                      <Textarea
                        id="description"
                        placeholder="Tell viewers what to expect from your stream..."
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        maxLength={500}
                        rows={4}
                        className="bg-muted border-border focus:border-primary resize-none"
                      />
                      <p className="text-xs text-muted-foreground flex justify-between">
                        <span>Help viewers understand what you'll be streaming</span>
                        <span>{description.length}/500</span>
                      </p>
                    </div>

                    {/* Thumbnail Upload */}
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">
                        Cover Photo
                        <Badge variant="secondary" className="ml-2 text-xs bg-muted">
                          Optional
                        </Badge>
                      </Label>

                      {thumbnailPreview ? (
                        /* Thumbnail Preview */
                        <div className="relative aspect-video rounded-lg overflow-hidden border border-border">
                          <img
                            src={thumbnailPreview}
                            alt="Thumbnail preview"
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => {
                                setThumbnail(null);
                                setThumbnailPreview('');
                              }}
                            >
                              Remove
                            </Button>
                            <label htmlFor="thumbnail-change">
                              <Button variant="secondary" size="sm" asChild>
                                <span>Change</span>
                              </Button>
                              <input
                                id="thumbnail-change"
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={handleThumbnailChange}
                              />
                            </label>
                          </div>
                        </div>
                      ) : (
                        /* Upload Area */
                        <label
                          htmlFor="thumbnail"
                          className="flex flex-col items-center justify-center aspect-video rounded-lg border-2 border-dashed border-border hover:border-primary/50 cursor-pointer transition-colors bg-muted/50"
                        >
                          <Camera className="h-10 w-10 text-muted-foreground mb-3" />
                          <span className="text-sm text-muted-foreground">
                            Click to upload a cover photo
                          </span>
                          <span className="text-xs text-muted-foreground/70 mt-1">
                            Recommended: 16:9 aspect ratio
                          </span>
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

                    {/* Action Buttons */}
                    <div className="flex gap-3 pt-4">
                      <Button
                        variant="outline"
                        onClick={() => router.back()}
                        className="flex-1 border-border hover:bg-muted"
                        disabled={creating}
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={handleCreateLiveStream}
                        className="flex-1 gap-2 bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-700 hover:to-pink-700"
                        disabled={creating || !title.trim()}
                      >
                        {creating ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Creating...
                          </>
                        ) : (
                          <>
                            <Zap className="h-4 w-4" />
                            Create & Go Live
                          </>
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Tips Sidebar */}
              <div className="lg:col-span-1">
                <Card className="bg-card/50 border-border sticky top-6">
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Lightbulb className="h-4 w-4 text-yellow-500" />
                      Pro Tips
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {STREAMING_TIPS.map((tip, index) => {
                      const Icon = tip.icon;
                      return (
                        <div key={index} className="flex gap-3">
                          <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                            <Icon className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <div>
                            <h4 className="text-sm font-medium text-foreground">{tip.title}</h4>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {tip.description}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>

                {/* User Preview Card */}
                <Card className="bg-card/50 border-border mt-4">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm text-muted-foreground">Streaming as</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-3">
                      {user.profilePicture ? (
                        <img
                          src={user.profilePicture}
                          alt={user.username}
                          className="w-10 h-10 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold">
                          {user.firstName?.[0] || 'U'}
                        </div>
                      )}
                      <div>
                        <p className="font-medium text-sm text-foreground">
                          {user.firstName} {user.lastName}
                        </p>
                        <p className="text-xs text-muted-foreground">@{user.username}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* Mobile Bottom Navigation */}
      <Navigation user={user} onLogout={handleLogout} isMobile={true} />
    </main>
  );
}
