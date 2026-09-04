'use client';

import { Button } from '@/components/ui/button';
import { ApiError } from '@/lib/api-client';
import { postService } from '@/lib/api-services';
import { BG_COLORS, FILTERS, FILTER_STYLES, TEXT_COLORS } from '@/lib/media-filters';
import '@/styles/filters.css';
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Image as ImageIcon,
  Italic,
  Type,
  Video,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import TagPeopleInput from './tag-people-input';

interface CreatePostModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit?: (post: any) => void;
}

type FileType = 'image' | 'video' | null;

interface TaggedUser {
  _id: string;
  firstName: string;
  lastName: string;
  username?: string;
  profileImage?: string;
  avatar?: string;
}

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

interface SelectedFile {
  id: string;
  file: File;
  type: 'image' | 'video';
  previewUrl: string;
}

export default function CreatePostModal({ isOpen, onClose, onSubmit }: CreatePostModalProps) {
  const [caption, setCaption] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<SelectedFile[]>([]);
  const [currentPreviewIndex, setCurrentPreviewIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [user, setUser] = useState<any>(null);
  const [taggedPeople, setTaggedPeople] = useState<TaggedUser[]>([]);
  const [hashtags, setHashtags] = useState('');

  const [selectedFilter, setSelectedFilter] = useState('normal');

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
      selectedFiles.forEach((sf) => {
        if (sf.previewUrl) {
          URL.revokeObjectURL(sf.previewUrl);
        }
      });
    };
  }, [selectedFiles]);

  const addTextOverlay = () => {
    if (!newText.trim()) return;

    const newOverlay: TextOverlay = {
      id: Date.now().toString(),
      text: newText,
      x: 50,
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

  const processImageWithEditsForFile = async (sf: SelectedFile): Promise<File | null> => {
    if (sf.type !== 'image') return sf.file;

    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(sf.file);
          return;
        }

        canvas.width = img.width;
        canvas.height = img.height;

        const filterStyles = FILTER_STYLES;

        ctx.filter = filterStyles[selectedFilter] || 'none';
        ctx.drawImage(img, 0, 0);
        ctx.filter = 'none';

        textOverlays.forEach((overlay) => {
          const x = (overlay.x / 100) * canvas.width;
          const y = (overlay.y / 100) * canvas.height;
          const scaledFontSize = (overlay.fontSize / 300) * canvas.width;

          ctx.font = `${overlay.fontStyle} ${overlay.fontWeight} ${scaledFontSize}px sans-serif`;
          ctx.textAlign = overlay.textAlign;
          ctx.textBaseline = 'middle';

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
              const processedFile = new File([blob], sf.file.name, { type: 'image/jpeg' });
              resolve(processedFile);
            } else {
              resolve(sf.file);
            }
          },
          'image/jpeg',
          0.9
        );
      };
      img.src = sf.previewUrl;
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newFiles: SelectedFile[] = [];
    let hasError = false;

    Array.from(files).forEach((file) => {
      const isImage = file.type.startsWith('image/');
      const isVideo = file.type.startsWith('video/');

      if (!isImage && !isVideo) {
        hasError = true;
        return;
      }

      newFiles.push({
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        file,
        type: isImage ? 'image' : 'video',
        previewUrl: URL.createObjectURL(file),
      });
    });

    if (hasError && newFiles.length === 0) {
      setError('Please select image or video files only');
      return;
    }

    setSelectedFiles((prev) => [...prev, ...newFiles]);
    setError('');
    e.target.value = '';
  };

  const handleRemoveFile = (fileId?: string) => {
    if (fileId) {
      setSelectedFiles((prev) => {
        const fileToRemove = prev.find((f) => f.id === fileId);
        if (fileToRemove?.previewUrl) {
          URL.revokeObjectURL(fileToRemove.previewUrl);
        }
        const newFiles = prev.filter((f) => f.id !== fileId);
        if (currentPreviewIndex >= newFiles.length) {
          setCurrentPreviewIndex(Math.max(0, newFiles.length - 1));
        }
        return newFiles;
      });
    } else {
      selectedFiles.forEach((sf) => {
        if (sf.previewUrl) URL.revokeObjectURL(sf.previewUrl);
      });
      setSelectedFiles([]);
      setCurrentPreviewIndex(0);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (selectedFiles.length === 0) {
      setError('Please select at least one image or video to upload');
      return;
    }

    setLoading(true);

    try {
      const formData = new FormData();

      for (const sf of selectedFiles) {
        if (
          sf.type === 'image' &&
          selectedFiles[currentPreviewIndex]?.id === sf.id &&
          (selectedFilter !== 'normal' || textOverlays.length > 0)
        ) {
          const processedFile = await processImageWithEditsForFile(sf);
          formData.append('files', processedFile || sf.file);
        } else {
          formData.append('files', sf.file);
        }
      }

      formData.append('caption', caption.trim());

      const hasVideo = selectedFiles.some((sf) => sf.type === 'video');
      if (hasVideo && selectedFilter !== 'normal') {
        formData.append('filter', selectedFilter);
      }

      if (taggedPeople.length > 0) {
        const taggedUserIds = taggedPeople.map((user) => user._id);
        formData.append('tags', JSON.stringify(taggedUserIds));
      }

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
    setCurrentPreviewIndex(0);
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
              Add Photos or Videos <span className="text-red-500">*</span>
              <span className="text-muted-foreground font-normal ml-1">(Unlimited)</span>
            </label>

            {selectedFiles.length === 0 ? (
              <div className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-primary transition cursor-pointer">
                <input
                  type="file"
                  accept="image/*,video/*"
                  onChange={handleFileChange}
                  className="hidden"
                  id="file-upload"
                  disabled={loading}
                  multiple
                />
                <label htmlFor="file-upload" className="cursor-pointer">
                  <div className="flex flex-col items-center gap-2">
                    <div className="flex gap-2">
                      <ImageIcon size={32} className="text-muted-foreground" />
                      <Video size={32} className="text-muted-foreground" />
                    </div>
                    <p className="text-muted-foreground">Click to upload multiple files</p>
                    <p className="text-xs text-muted-foreground">Images and Videos (no limit)</p>
                  </div>
                </label>
              </div>
            ) : (
              <div className="space-y-3">
                {selectedFiles[currentPreviewIndex] && (
                  <div
                    ref={imageContainerRef}
                    className="relative rounded-lg overflow-hidden bg-black"
                    style={{ minHeight: '256px' }}
                  >
                    {selectedFiles[currentPreviewIndex].type === 'image' ? (
                      <img
                        src={selectedFiles[currentPreviewIndex].previewUrl}
                        alt="Preview"
                        className={`w-full h-64 object-cover filter-${selectedFilter}`}
                      />
                    ) : (
                      <video
                        src={selectedFiles[currentPreviewIndex].previewUrl}
                        className={`w-full h-64 object-cover filter-${selectedFilter}`}
                        controls
                        muted
                      />
                    )}

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

                    <button
                      type="button"
                      onClick={() => handleRemoveFile(selectedFiles[currentPreviewIndex]?.id)}
                      className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-full hover:bg-red-600 transition"
                      disabled={loading}
                    >
                      <X size={20} />
                    </button>

                    {selectedFiles[currentPreviewIndex]?.type === 'image' && (
                      <button
                        type="button"
                        onClick={() => setShowTextEditor(true)}
                        className="absolute top-2 left-2 p-2 bg-black/50 text-white rounded-full hover:bg-black/70 transition"
                        disabled={loading}
                      >
                        <Type size={20} />
                      </button>
                    )}

                    {selectedFiles.length > 1 && (
                      <>
                        <button
                          type="button"
                          onClick={() => setCurrentPreviewIndex((prev) => Math.max(0, prev - 1))}
                          disabled={currentPreviewIndex === 0}
                          className="absolute left-2 top-1/2 -translate-y-1/2 p-2 bg-black/50 text-white rounded-full hover:bg-black/70 transition disabled:opacity-30"
                        >
                          ←
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setCurrentPreviewIndex((prev) =>
                              Math.min(selectedFiles.length - 1, prev + 1)
                            )
                          }
                          disabled={currentPreviewIndex === selectedFiles.length - 1}
                          className="absolute right-12 top-1/2 -translate-y-1/2 p-2 bg-black/50 text-white rounded-full hover:bg-black/70 transition disabled:opacity-30"
                        >
                          →
                        </button>
                        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-black/60 px-2 py-1 rounded-full text-white text-xs">
                          {currentPreviewIndex + 1} / {selectedFiles.length}
                        </div>
                      </>
                    )}
                  </div>
                )}

                {selectedFiles.length > 0 && (
                  <div className="flex gap-2 overflow-x-auto pb-2">
                    {selectedFiles.map((sf, index) => (
                      <div
                        key={sf.id}
                        className={`relative flex-shrink-0 cursor-pointer border-2 rounded-lg overflow-hidden ${
                          currentPreviewIndex === index ? 'border-primary' : 'border-transparent'
                        }`}
                        onClick={() => setCurrentPreviewIndex(index)}
                      >
                        {sf.type === 'image' ? (
                          <img src={sf.previewUrl} alt="" className="w-16 h-16 object-cover" />
                        ) : (
                          <div className="w-16 h-16 bg-muted flex items-center justify-center">
                            <Video size={24} className="text-muted-foreground" />
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveFile(sf.id);
                          }}
                          className="absolute -top-1 -right-1 p-0.5 bg-red-500 text-white rounded-full hover:bg-red-600 text-xs"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                    <label
                      htmlFor="file-upload-more"
                      className="flex-shrink-0 w-16 h-16 border-2 border-dashed border-border rounded-lg flex items-center justify-center cursor-pointer hover:border-primary transition"
                    >
                      <span className="text-2xl text-muted-foreground">+</span>
                    </label>
                    <input
                      type="file"
                      accept="image/*,video/*"
                      onChange={handleFileChange}
                      className="hidden"
                      id="file-upload-more"
                      disabled={loading}
                      multiple
                    />
                  </div>
                )}

                <p className="text-xs text-muted-foreground">
                  {selectedFiles.length} file(s) selected • Total:{' '}
                  {(selectedFiles.reduce((acc, sf) => acc + sf.file.size, 0) / 1024 / 1024).toFixed(
                    2
                  )}{' '}
                  MB
                </p>

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

          <TagPeopleInput
            selectedUsers={taggedPeople}
            onUsersChange={setTaggedPeople}
            disabled={loading}
            maxTags={10}
          />

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
              disabled={loading || selectedFiles.length === 0}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Posting {selectedFiles.length} file(s)...
                </span>
              ) : (
                `Post ${selectedFiles.length > 0 ? `(${selectedFiles.length})` : ''}`
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
