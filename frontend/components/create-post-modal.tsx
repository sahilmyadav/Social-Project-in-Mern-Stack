'use client';

import { Button } from '@/components/ui/button';
import { ApiError } from '@/lib/api-client';
import { postService } from '@/lib/api-services';
import '@/styles/filters.css';
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Aperture,
  Bold,
  Camera,
  CloudRain,
  Coffee,
  Contrast,
  Droplet,
  Flame,
  Heart,
  Image as ImageIcon,
  Italic,
  Moon,
  Palette,
  Snowflake,
  Sparkles,
  Star,
  Sun,
  Sunrise,
  Sunset,
  Type,
  Video,
  Wind,
  X,
  Zap,
} from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import TagPeopleInput from './tag-people-input';

interface CreatePostModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit?: (post: any) => void;
}

type FileType = 'image' | 'video' | null;

// Type for tagged users
interface TaggedUser {
  _id: string;
  firstName: string;
  lastName: string;
  username?: string;
  profileImage?: string;
  avatar?: string;
}

// Text overlay type
interface TextOverlay {
  id: string;
  text: string;
  x: number;
  y: number;
  fontSize: number;
  color: string;
  fontWeight: 'normal' | 'bold';
  fontStyle: 'normal' | 'italic';
  textAlign: 'left' | 'center' | 'right';
  backgroundColor: string;
}

// Instagram-style filters
const FILTERS = [
  { name: 'Normal', value: 'normal', icon: Camera },
  { name: 'Clarendon', value: 'clarendon', icon: Sun },
  { name: 'Gingham', value: 'gingham', icon: Sparkles },
  { name: 'Juno', value: 'juno', icon: Sunset },
  { name: 'Lark', value: 'lark', icon: Sunrise },
  { name: 'Ludwig', value: 'ludwig', icon: Palette },
  { name: 'Valencia', value: 'valencia', icon: Heart },
  { name: 'X-Pro II', value: 'xpro2', icon: Zap },
  { name: 'Aden', value: 'aden', icon: CloudRain },
  { name: 'Brooklyn', value: 'brooklyn', icon: Coffee },
  { name: 'Earlybird', value: 'earlybird', icon: Sunrise },
  { name: 'Inkwell', value: 'inkwell', icon: Moon },
  { name: 'Nashville', value: 'nashville', icon: Star },
  { name: 'Perpetua', value: 'perpetua', icon: Contrast },
  { name: 'Reyes', value: 'reyes', icon: Droplet },
  { name: 'Rise', value: 'rise', icon: Sunrise },
  { name: 'Slumber', value: 'slumber', icon: Moon },
  { name: 'Toaster', value: 'toaster', icon: Flame },
  { name: 'Walden', value: 'walden', icon: Wind },
  { name: 'Willow', value: 'willow', icon: Snowflake },
  { name: 'Vintage', value: 'vintage', icon: Camera },
  { name: 'Cool', value: 'cool', icon: Snowflake },
  { name: 'Warm', value: 'warm', icon: Flame },
  { name: 'Dramatic', value: 'dramatic', icon: Zap },
  { name: 'Vivid', value: 'vivid', icon: Aperture },
];

// Text colors
const TEXT_COLORS = [
  '#FFFFFF',
  '#000000',
  '#FF0000',
  '#00FF00',
  '#0000FF',
  '#FFFF00',
  '#FF00FF',
  '#00FFFF',
  '#FF6B6B',
  '#4ECDC4',
  '#45B7D1',
  '#96CEB4',
  '#FFEAA7',
  '#DDA0DD',
  '#98D8C8',
  '#F7DC6F',
];

// Background colors for text
const BG_COLORS = [
  'transparent',
  'rgba(0,0,0,0.7)',
  'rgba(255,255,255,0.7)',
  'rgba(255,0,0,0.5)',
  'rgba(0,255,0,0.5)',
  'rgba(0,0,255,0.5)',
  'rgba(255,255,0,0.5)',
  'rgba(255,0,255,0.5)',
];

export default function CreatePostModal({ isOpen, onClose, onSubmit }: CreatePostModalProps) {
  const [caption, setCaption] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [fileType, setFileType] = useState<FileType>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [user, setUser] = useState<any>(null);
  const [taggedPeople, setTaggedPeople] = useState<TaggedUser[]>([]);
  const [hashtags, setHashtags] = useState('');

  // Filter state
  const [selectedFilter, setSelectedFilter] = useState('normal');

  // Text overlay state
  const [textOverlays, setTextOverlays] = useState<TextOverlay[]>([]);
  const [showTextEditor, setShowTextEditor] = useState(false);
  const [activeTextId, setActiveTextId] = useState<string | null>(null);
  const [newText, setNewText] = useState('');
  const [textColor, setTextColor] = useState('#FFFFFF');
  const [textBgColor, setTextBgColor] = useState('transparent');
  const [fontSize, setFontSize] = useState(24);
  const [fontWeight, setFontWeight] = useState<'normal' | 'bold'>('normal');
  const [fontStyle, setFontStyle] = useState<'normal' | 'italic'>('normal');
  const [textAlign, setTextAlign] = useState<'left' | 'center' | 'right'>('center');

  // Dragging state
  const [draggingTextId, setDraggingTextId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const imageContainerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

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

  // Text overlay functions
  const addTextOverlay = () => {
    if (!newText.trim()) return;

    const newOverlay: TextOverlay = {
      id: Date.now().toString(),
      text: newText,
      x: 50, // Center position (percentage)
      y: 50,
      fontSize,
      color: textColor,
      fontWeight,
      fontStyle,
      textAlign,
      backgroundColor: textBgColor,
    };

    setTextOverlays([...textOverlays, newOverlay]);
    setNewText('');
    setShowTextEditor(false);
  };

  const updateTextOverlay = (id: string, updates: Partial<TextOverlay>) => {
    setTextOverlays(
      textOverlays.map((overlay) => (overlay.id === id ? { ...overlay, ...updates } : overlay))
    );
  };

  const deleteTextOverlay = (id: string) => {
    setTextOverlays(textOverlays.filter((overlay) => overlay.id !== id));
    if (activeTextId === id) setActiveTextId(null);
  };

  // Drag handlers for text overlays
  const handleTextDragStart = (e: React.MouseEvent | React.TouchEvent, id: string) => {
    e.preventDefault();
    const overlay = textOverlays.find((t) => t.id === id);
    if (!overlay || !imageContainerRef.current) return;

    const rect = imageContainerRef.current.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    setDraggingTextId(id);
    setDragOffset({
      x: clientX - (rect.left + (overlay.x / 100) * rect.width),
      y: clientY - (rect.top + (overlay.y / 100) * rect.height),
    });
    setActiveTextId(id);
  };

  const handleTextDrag = useCallback(
    (e: MouseEvent | TouchEvent) => {
      if (!draggingTextId || !imageContainerRef.current) return;

      const rect = imageContainerRef.current.getBoundingClientRect();
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

      const x = ((clientX - dragOffset.x - rect.left) / rect.width) * 100;
      const y = ((clientY - dragOffset.y - rect.top) / rect.height) * 100;

      updateTextOverlay(draggingTextId, {
        x: Math.max(5, Math.min(95, x)),
        y: Math.max(5, Math.min(95, y)),
      });
    },
    [draggingTextId, dragOffset]
  );

  const handleTextDragEnd = useCallback(() => {
    setDraggingTextId(null);
  }, []);

  useEffect(() => {
    if (draggingTextId) {
      window.addEventListener('mousemove', handleTextDrag);
      window.addEventListener('mouseup', handleTextDragEnd);
      window.addEventListener('touchmove', handleTextDrag);
      window.addEventListener('touchend', handleTextDragEnd);
      return () => {
        window.removeEventListener('mousemove', handleTextDrag);
        window.removeEventListener('mouseup', handleTextDragEnd);
        window.removeEventListener('touchmove', handleTextDrag);
        window.removeEventListener('touchend', handleTextDragEnd);
      };
    }
  }, [draggingTextId, handleTextDrag, handleTextDragEnd]);

  // Apply filter and text to canvas for final image
  const processImageWithEdits = async (): Promise<File | null> => {
    if (!file || fileType !== 'image') return file;

    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(file);
          return;
        }

        canvas.width = img.width;
        canvas.height = img.height;

        // Apply filter
        const filterStyles: Record<string, string> = {
          normal: 'none',
          clarendon: 'contrast(1.2) saturate(1.35) brightness(1.1)',
          gingham: 'brightness(1.05) hue-rotate(-10deg)',
          juno: 'contrast(1.2) saturate(1.4) brightness(1.1) sepia(0.2)',
          lark: 'contrast(0.9) saturate(0.85) brightness(1.08)',
          ludwig: 'contrast(1.05) brightness(1.05) saturate(2)',
          valencia: 'contrast(1.08) brightness(1.08) sepia(0.08)',
          xpro2: 'sepia(0.3) contrast(1.3) brightness(0.95) saturate(1.2)',
          aden: 'contrast(0.9) brightness(1.2) saturate(0.85) hue-rotate(-20deg)',
          brooklyn: 'contrast(0.9) brightness(1.1) sepia(0.1)',
          earlybird: 'contrast(0.9) sepia(0.2) brightness(1.1)',
          inkwell: 'grayscale(100%) contrast(1.1) brightness(1.1)',
          nashville: 'sepia(0.2) contrast(1.2) brightness(1.05) saturate(1.2)',
          perpetua: 'contrast(1.1) saturate(1.2)',
          reyes: 'sepia(0.22) brightness(1.1) contrast(0.85) saturate(0.75)',
          rise: 'brightness(1.05) sepia(0.2) contrast(0.9) saturate(0.9)',
          slumber: 'saturate(0.66) brightness(1.05)',
          toaster: 'contrast(1.5) brightness(0.9) sepia(0.1)',
          walden: 'brightness(1.1) hue-rotate(-10deg) sepia(0.3) saturate(1.6)',
          willow: 'grayscale(50%) contrast(0.95) brightness(0.9)',
          vintage: 'sepia(0.5) contrast(1.2) brightness(0.9)',
          cool: 'saturate(1.4) brightness(1.05) hue-rotate(-15deg)',
          warm: 'saturate(1.2) brightness(1.1) hue-rotate(10deg) sepia(0.15)',
          dramatic: 'contrast(1.5) saturate(0.8) brightness(0.95)',
          vivid: 'saturate(2) contrast(1.2) brightness(1.05)',
        };

        ctx.filter = filterStyles[selectedFilter] || 'none';
        ctx.drawImage(img, 0, 0);
        ctx.filter = 'none';

        // Draw text overlays
        textOverlays.forEach((overlay) => {
          const x = (overlay.x / 100) * canvas.width;
          const y = (overlay.y / 100) * canvas.height;
          const scaledFontSize = (overlay.fontSize / 300) * canvas.width; // Scale font size

          ctx.font = `${overlay.fontStyle} ${overlay.fontWeight} ${scaledFontSize}px sans-serif`;
          ctx.textAlign = overlay.textAlign;
          ctx.textBaseline = 'middle';

          // Draw background if set
          if (overlay.backgroundColor !== 'transparent') {
            const metrics = ctx.measureText(overlay.text);
            const padding = scaledFontSize * 0.3;
            const bgWidth = metrics.width + padding * 2;
            const bgHeight = scaledFontSize + padding;

            ctx.fillStyle = overlay.backgroundColor;
            let bgX = x - padding;
            if (overlay.textAlign === 'center') bgX = x - bgWidth / 2;
            else if (overlay.textAlign === 'right') bgX = x - bgWidth + padding;

            ctx.fillRect(bgX, y - bgHeight / 2, bgWidth, bgHeight);
          }

          // Draw text with shadow for visibility
          ctx.shadowColor = 'rgba(0,0,0,0.5)';
          ctx.shadowBlur = scaledFontSize * 0.1;
          ctx.shadowOffsetX = 2;
          ctx.shadowOffsetY = 2;
          ctx.fillStyle = overlay.color;
          ctx.fillText(overlay.text, x, y);
          ctx.shadowColor = 'transparent';
        });

        canvas.toBlob(
          (blob) => {
            if (blob) {
              const processedFile = new File([blob], file.name, { type: 'image/jpeg' });
              resolve(processedFile);
            } else {
              resolve(file);
            }
          },
          'image/jpeg',
          0.9
        );
      };
      img.src = previewUrl;
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    const isImage = selectedFile.type.startsWith('image/');
    const isVideo = selectedFile.type.startsWith('video/');

    if (!isImage && !isVideo) {
      setError('Please select an image or video file');
      return;
    }

    // Only check image size limit (10MB), videos have no limit
    if (!isVideo && selectedFile.size > 10 * 1024 * 1024) {
      setError('Image size must be less than 10MB');
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
      // Process image with filters and text overlays
      const processedFile = await processImageWithEdits();

      const formData = new FormData();
      formData.append('files', processedFile || file);
      formData.append('caption', caption.trim());

      // Add filter info for videos (processed server-side)
      if (fileType === 'video' && selectedFilter !== 'normal') {
        formData.append('filter', selectedFilter);
      }

      // Add tagged people (user IDs)
      if (taggedPeople.length > 0) {
        const taggedUserIds = taggedPeople.map((user) => user._id);
        formData.append('tags', JSON.stringify(taggedUserIds));
      }

      // Add hashtags
      if (hashtags.trim()) {
        const tagArray = hashtags
          .split(',')
          .map((tag) => tag.trim())
          .filter(Boolean);
        formData.append('hashtags', JSON.stringify(tagArray));
      }

      const response = await postService.createPost(formData);

      if (response.success) {
        setCaption('');
        setTaggedPeople([]);
        setHashtags('');
        setSelectedFilter('normal');
        setTextOverlays([]);
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
    setTaggedPeople([]);
    setHashtags('');
    setSelectedFilter('normal');
    setTextOverlays([]);
    setShowTextEditor(false);
    setActiveTextId(null);
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
                      Images up to 10MB, Videos (no size limit)
                    </p>
                  </div>
                </label>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Preview with filter and text overlays */}
                <div
                  ref={imageContainerRef}
                  className="relative rounded-lg overflow-hidden bg-black"
                  style={{ minHeight: '256px' }}
                >
                  {fileType === 'image' ? (
                    <img
                      src={previewUrl}
                      alt="Preview"
                      className={`w-full h-64 object-cover filter-${selectedFilter}`}
                    />
                  ) : (
                    <video
                      src={previewUrl}
                      className={`w-full h-64 object-cover filter-${selectedFilter}`}
                      controls
                      muted
                    />
                  )}

                  {/* Text Overlays */}
                  {textOverlays.map((overlay) => (
                    <div
                      key={overlay.id}
                      className={`absolute cursor-move select-none ${activeTextId === overlay.id ? 'ring-2 ring-primary ring-offset-2' : ''}`}
                      style={{
                        left: `${overlay.x}%`,
                        top: `${overlay.y}%`,
                        transform: 'translate(-50%, -50%)',
                        fontSize: `${overlay.fontSize}px`,
                        color: overlay.color,
                        fontWeight: overlay.fontWeight,
                        fontStyle: overlay.fontStyle,
                        textAlign: overlay.textAlign,
                        backgroundColor: overlay.backgroundColor,
                        padding: overlay.backgroundColor !== 'transparent' ? '4px 8px' : '0',
                        borderRadius: '4px',
                        textShadow: '1px 1px 2px rgba(0,0,0,0.5)',
                        whiteSpace: 'nowrap',
                      }}
                      onMouseDown={(e) => handleTextDragStart(e, overlay.id)}
                      onTouchStart={(e) => handleTextDragStart(e, overlay.id)}
                      onClick={() => setActiveTextId(overlay.id)}
                    >
                      {overlay.text}
                      {activeTextId === overlay.id && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteTextOverlay(overlay.id);
                          }}
                          className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 text-xs"
                        >
                          <X size={12} />
                        </button>
                      )}
                    </div>
                  ))}

                  {/* Remove file button */}
                  <button
                    type="button"
                    onClick={handleRemoveFile}
                    className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-full hover:bg-red-600 transition"
                    disabled={loading}
                  >
                    <X size={20} />
                  </button>

                  {/* Add text button */}
                  <button
                    type="button"
                    onClick={() => setShowTextEditor(true)}
                    className="absolute top-2 left-2 p-2 bg-black/50 text-white rounded-full hover:bg-black/70 transition"
                    disabled={loading}
                  >
                    <Type size={20} />
                  </button>
                </div>

                <p className="text-xs text-muted-foreground">
                  {file?.name} ({(file!.size / 1024 / 1024).toFixed(2)} MB)
                </p>

                {/* Filter Gallery */}
                <div className="space-y-2">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Filters
                  </h3>
                  <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                    {FILTERS.map((filter) => {
                      const IconComponent = filter.icon;
                      return (
                        <button
                          key={filter.value}
                          type="button"
                          onClick={() => setSelectedFilter(filter.value)}
                          className={`flex-shrink-0 flex flex-col items-center gap-1 transition ${
                            selectedFilter === filter.value
                              ? 'opacity-100'
                              : 'opacity-60 hover:opacity-80'
                          }`}
                        >
                          <div
                            className={`w-12 h-12 rounded-lg overflow-hidden border-2 transition relative ${
                              selectedFilter === filter.value
                                ? 'border-primary shadow-lg shadow-primary/20 scale-105'
                                : 'border-border'
                            }`}
                          >
                            <div
                              className={`absolute inset-0 bg-gradient-to-br from-purple-400 via-pink-400 to-orange-400 filter-${filter.value}`}
                            />
                            <div className="absolute inset-0 flex items-center justify-center bg-black/10">
                              <IconComponent className="w-5 h-5 text-white drop-shadow-md" />
                            </div>
                          </div>
                          <span className="text-[9px] font-medium text-center leading-tight max-w-[48px] truncate">
                            {filter.name}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Text Editor Panel */}
                {showTextEditor && (
                  <div className="p-3 bg-muted rounded-lg space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-semibold">Add Text</h4>
                      <button
                        type="button"
                        onClick={() => setShowTextEditor(false)}
                        className="p-1 hover:bg-background rounded"
                      >
                        <X size={16} />
                      </button>
                    </div>

                    <input
                      type="text"
                      value={newText}
                      onChange={(e) => setNewText(e.target.value)}
                      placeholder="Enter your text..."
                      className="w-full p-2 border border-border rounded-lg bg-background text-sm"
                      maxLength={100}
                    />

                    {/* Font Size */}
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground w-16">Size:</span>
                      <input
                        type="range"
                        min="12"
                        max="48"
                        value={fontSize}
                        onChange={(e) => setFontSize(Number(e.target.value))}
                        className="flex-1"
                      />
                      <span className="text-xs w-8">{fontSize}px</span>
                    </div>

                    {/* Text Style Buttons */}
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setFontWeight(fontWeight === 'bold' ? 'normal' : 'bold')}
                        className={`p-2 rounded ${fontWeight === 'bold' ? 'bg-primary text-primary-foreground' : 'bg-background border border-border'}`}
                      >
                        <Bold size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setFontStyle(fontStyle === 'italic' ? 'normal' : 'italic')}
                        className={`p-2 rounded ${fontStyle === 'italic' ? 'bg-primary text-primary-foreground' : 'bg-background border border-border'}`}
                      >
                        <Italic size={16} />
                      </button>
                      <div className="h-6 w-px bg-border mx-1" />
                      <button
                        type="button"
                        onClick={() => setTextAlign('left')}
                        className={`p-2 rounded ${textAlign === 'left' ? 'bg-primary text-primary-foreground' : 'bg-background border border-border'}`}
                      >
                        <AlignLeft size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setTextAlign('center')}
                        className={`p-2 rounded ${textAlign === 'center' ? 'bg-primary text-primary-foreground' : 'bg-background border border-border'}`}
                      >
                        <AlignCenter size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setTextAlign('right')}
                        className={`p-2 rounded ${textAlign === 'right' ? 'bg-primary text-primary-foreground' : 'bg-background border border-border'}`}
                      >
                        <AlignRight size={16} />
                      </button>
                    </div>

                    {/* Text Colors */}
                    <div className="space-y-1">
                      <span className="text-xs text-muted-foreground">Text Color:</span>
                      <div className="flex gap-1 flex-wrap">
                        {TEXT_COLORS.map((color) => (
                          <button
                            key={color}
                            type="button"
                            onClick={() => setTextColor(color)}
                            className={`w-6 h-6 rounded-full border-2 ${textColor === color ? 'border-primary scale-110' : 'border-border'}`}
                            style={{ backgroundColor: color }}
                          />
                        ))}
                      </div>
                    </div>

                    {/* Background Colors */}
                    <div className="space-y-1">
                      <span className="text-xs text-muted-foreground">Background:</span>
                      <div className="flex gap-1 flex-wrap">
                        {BG_COLORS.map((color, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => setTextBgColor(color)}
                            className={`w-6 h-6 rounded border-2 ${textBgColor === color ? 'border-primary scale-110' : 'border-border'} ${color === 'transparent' ? 'bg-[url("data:image/svg+xml,%3csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 8 8%27%3e%3cpath fill=%27%23ccc%27 d=%27M0 0h4v4H0V0zm4 4h4v4H4V4z%27/%3e%3c/svg%3e")] bg-[length:8px_8px]' : ''}`}
                            style={{ backgroundColor: color !== 'transparent' ? color : undefined }}
                          />
                        ))}
                      </div>
                    </div>

                    <Button
                      type="button"
                      onClick={addTextOverlay}
                      disabled={!newText.trim()}
                      size="sm"
                      className="w-full"
                    >
                      Add Text to Image
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Tag People Section */}
          <TagPeopleInput
            selectedUsers={taggedPeople}
            onUsersChange={setTaggedPeople}
            disabled={loading}
            maxTags={10}
          />

          {/* Hashtags Section */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground block">
              Add Tags <span className="text-muted-foreground font-normal">(optional)</span>
            </label>
            <input
              type="text"
              value={hashtags}
              onChange={(e) => setHashtags(e.target.value)}
              placeholder="e.g., #design #photography #creative"
              className="w-full p-3 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-background text-foreground"
              disabled={loading}
            />
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
