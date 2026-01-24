'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Camera, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { liveStreamService } from '@/lib/api-services';
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
            <div className="container mx-auto px-4 py-8 max-w-2xl">
                {/* Header */}
                <div className="flex items-center gap-4 mb-8">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => router.back()}
                    >
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <div>
                        <h1 className="text-3xl font-bold">Create Live Stream</h1>
                        <p className="text-muted-foreground mt-1">
                            Set up your live stream details
                        </p>
                    </div>
                </div>

                {/* Form */}
                <Card>
                    <CardHeader>
                        <CardTitle>Stream Details</CardTitle>
                        <CardDescription>
                            Add information about your live stream to help viewers find it
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {/* Title */}
                        <div className="space-y-2">
                            <Label htmlFor="title">
                                Title <span className="text-red-500">*</span>
                            </Label>
                            <Input
                                id="title"
                                placeholder="What's your live stream about?"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                maxLength={100}
                            />
                            <p className="text-xs text-muted-foreground">
                                {title.length}/100 characters
                            </p>
                        </div>

                        {/* Description */}
                        <div className="space-y-2">
                            <Label htmlFor="description">Description (Optional)</Label>
                            <Textarea
                                id="description"
                                placeholder="Tell viewers what to expect..."
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                maxLength={500}
                                rows={4}
                            />
                            <p className="text-xs text-muted-foreground">
                                {description.length}/500 characters
                            </p>
                        </div>

                        {/* Thumbnail */}
                        <div className="space-y-2">
                            <Label htmlFor="thumbnail">Thumbnail (Optional)</Label>
                            <div className="space-y-4">
                                {thumbnailPreview ? (
                                    <div className="relative aspect-video rounded-lg overflow-hidden border">
                                        <img
                                            src={thumbnailPreview}
                                            alt="Thumbnail preview"
                                            className="w-full h-full object-cover"
                                        />
                                        <Button
                                            variant="secondary"
                                            size="sm"
                                            className="absolute top-2 right-2"
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
                                        className="flex flex-col items-center justify-center aspect-video rounded-lg border-2 border-dashed border-muted-foreground/25 hover:border-muted-foreground/50 cursor-pointer transition-colors"
                                    >
                                        <Camera className="h-12 w-12 text-muted-foreground mb-2" />
                                        <span className="text-sm text-muted-foreground">
                                            Click to upload thumbnail
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
                        </div>

                        {/* Actions */}
                        <div className="flex gap-3 pt-4">
                            <Button
                                variant="outline"
                                onClick={() => router.back()}
                                className="flex-1"
                                disabled={creating}
                            >
                                Cancel
                            </Button>
                            <Button
                                onClick={handleCreateLiveStream}
                                className="flex-1 gap-2"
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

                {/* Tips */}
                <Card className="mt-6 bg-muted/50">
                    <CardHeader>
                        <CardTitle className="text-lg">Tips for a great live stream</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ul className="space-y-2 text-sm text-muted-foreground">
                            <li className="flex items-start gap-2">
                                <span className="text-primary">•</span>
                                <span>Use a clear, descriptive title that tells viewers what to expect</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-primary">•</span>
                                <span>Make sure you have a stable internet connection</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-primary">•</span>
                                <span>Test your camera and microphone before going live</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-primary">•</span>
                                <span>Engage with your viewers through comments</span>
                            </li>
                        </ul>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
