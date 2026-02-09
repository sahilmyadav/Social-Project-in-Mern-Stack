'use client';

import MusicPickerModal from '@/components/music-picker-modal';
import { Button } from '@/components/ui/button';
import { storyService } from '@/lib/api-services';
import { BG_COLORS, FILTERS, FILTER_STYLES, TEXT_COLORS } from '@/lib/media-filters';
import '@/styles/filters.css';
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Image as ImageIcon,
  Italic,
  Music,
  Type,
  Upload,
  Video,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

interface AddStoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
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

export default function AddStoryModal({ isOpen, onClose, onSuccess }: AddStoryModalProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [fileType, setFileType] = useState<'image' | 'video' | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('normal');
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
  const imageContainerRef = useRef<HTMLDivElement>(null);

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

  const processImageWithEdits = async (): Promise<File | null> => {
    if (!selectedFile || fileType !== 'image') return selectedFile;

    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';

      const timeout = setTimeout(() => {
        reject(new Error('Image loading timed out'));
      }, 10000);

      img.onerror = () => {
        clearTimeout(timeout);
        reject(new Error('Failed to load image'));
      };

      img.onload = () => {
        clearTimeout(timeout);
        try {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(selectedFile);
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
                const processedFile = new File([blob], selectedFile.name, { type: 'image/jpeg' });
                resolve(processedFile);
              } else {
                resolve(selectedFile);
              }
            },
            'image/jpeg',
            0.9
          );
        } catch (error) {
          resolve(selectedFile);
        }
      };
      img.src = previewUrl;
    });
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
      setError('Please select an image or video file');
      return;
    }

    if (file.size > 50 * 1024 * 1024) {
      setError('File size must be less than 50MB');
      return;
    }

    setError('');
    setSelectedFile(file);
    const type = file.type.startsWith('image/') ? 'image' : 'video';
    setFileType(type);

    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    setError('');

    try {
      let fileToUpload = selectedFile;

      if (fileType === 'image' && (selectedFilter !== 'normal' || textOverlays.length > 0)) {
        try {
          const processedFile = await processImageWithEdits();
          if (processedFile) {
            fileToUpload = processedFile;
          }
        } catch (processError) {
          fileToUpload = selectedFile;
        }
      }
      const formData = new FormData();
      formData.append('file', fileToUpload);
      formData.append('filter', selectedFilter);

      if (selectedMusic) {
        const musicData = {
          trackId: selectedMusic.trackId,
          trackName: selectedMusic.trackName,
          artistName: selectedMusic.artistName,
          albumArt: selectedMusic.albumArt,
          previewUrl: selectedMusic.previewUrl,
          startTime: selectedMusic.startTime,
        };
        formData.append('music', JSON.stringify(musicData));
      }

      const response = await storyService.uploadStory(formData);

      if (response.success) {
        onSuccess?.();
        handleClose();
      } else {
        setError(response.message || 'Failed to upload story');
      }
    } catch (err: any) {
      let errorMessage = 'Failed to upload story. Please try again.';

      if (err?.statusCode === 408) {
        errorMessage = 'Upload timed out. Please try with a smaller file or check your connection.';
      } else if (err?.statusCode === 413) {
        errorMessage = 'File is too large. Please try a smaller file.';
      } else if (err?.statusCode === 401) {
        errorMessage = 'Session expired. Please log in again.';
      } else if (err?.statusCode === 0 || err?.error === 'Network error') {
        errorMessage = err?.message || 'Unable to connect to server. Please try again.';
      } else if (err?.message) {
        errorMessage = err.message;
      } else if (err?.response?.data?.message) {
        errorMessage = err.response.data.message;
      }

      setError(errorMessage);
    } finally {
      setIsUploading(false);
    }
  };

  const handleClose = () => {
    setSelectedFile(null);
    setPreviewUrl('');
    setFileType(null);
    setError('');
    setSelectedFilter('normal');
    setTextOverlays([]);
    setShowTextEditor(false);
    setActiveTextId(null);
    setSelectedMusic(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-background rounded-3xl shadow-2xl max-w-xl w-full max-h-[90vh] overflow-hidden flex flex-col">
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

        <div className="flex-1 overflow-y-auto p-4 min-h-0">
          {!selectedFile ? (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-border rounded-2xl p-12 text-center cursor-pointer hover:border-primary transition"
            >
              <div className="flex flex-col items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <Upload className="w-8 h-8 text-primary" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold mb-2">Upload a Photo or Video</h3>
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
            <div className="space-y-3">
              <div
                ref={imageContainerRef}
                className="relative rounded-2xl overflow-hidden bg-black aspect-[9/16] max-h-[300px] flex items-center justify-center"
              >
                {fileType === 'image' ? (
                  <img
                    src={previewUrl}
                    alt="Story preview"
                    className="max-w-full max-h-full object-contain"
                    style={{
                      filter: FILTER_STYLES[selectedFilter] || 'none',
                    }}
                  />
                ) : (
                  <video
                    src={previewUrl}
                    controls
                    className="max-w-full max-h-full object-contain"
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
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteTextOverlay(overlay.id);
                        }}
                        className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 text-xs"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                ))}

                <button
                  onClick={() => setShowTextEditor(true)}
                  className="absolute top-3 left-3 p-2 bg-black/50 text-white rounded-full hover:bg-black/70 transition"
                  disabled={isUploading}
                >
                  <Type className="w-5 h-5" />
                </button>

                {selectedMusic && (
                  <div className="absolute bottom-4 left-4 right-4 bg-black/60 backdrop-blur-sm rounded-xl p-3 flex items-center gap-3">
                    <div className="w-10 h-10 rounded bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center flex-shrink-0">
                      <Music className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-semibold text-sm truncate">
                        {selectedMusic.trackName}
                      </p>
                      <p className="text-white/70 text-xs truncate">{selectedMusic.artistName}</p>
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
                        className={`flex-shrink-0 flex flex-col items-center gap-1.5 transition ${
                          selectedFilter === filter.value
                            ? 'opacity-100'
                            : 'opacity-60 hover:opacity-80'
                        }`}
                      >
                        <div
                          className={`w-14 h-14 rounded-xl overflow-hidden border-2 transition relative ${
                            selectedFilter === filter.value
                              ? 'border-primary shadow-lg shadow-primary/20 scale-105'
                              : 'border-border'
                          }`}
                        >
                          <div
                            className="absolute inset-0 bg-gradient-to-br from-purple-400 via-pink-400 to-orange-400"
                            style={{ filter: FILTER_STYLES[filter.value] || 'none' }}
                          />
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

              {showTextEditor && (
                <div className="p-3 bg-muted rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold">Add Text</h4>
                    <button
                      onClick={() => setShowTextEditor(false)}
                      className="p-1 hover:bg-background rounded"
                    >
                      <X className="w-4 h-4" />
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
                    <span className="text-xs text-muted-foreground w-12">Size:</span>
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
                      onClick={() => setFontWeight(fontWeight === 'bold' ? 'normal' : 'bold')}
                      className={`p-2 rounded ${fontWeight === 'bold' ? 'bg-primary text-primary-foreground' : 'bg-background border border-border'}`}
                    >
                      <Bold className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setFontStyle(fontStyle === 'italic' ? 'normal' : 'italic')}
                      className={`p-2 rounded ${fontStyle === 'italic' ? 'bg-primary text-primary-foreground' : 'bg-background border border-border'}`}
                    >
                      <Italic className="w-4 h-4" />
                    </button>
                    <div className="h-6 w-px bg-border mx-1" />
                    <button
                      onClick={() => setTextAlign('left')}
                      className={`p-2 rounded ${textAlign === 'left' ? 'bg-primary text-primary-foreground' : 'bg-background border border-border'}`}
                    >
                      <AlignLeft className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setTextAlign('center')}
                      className={`p-2 rounded ${textAlign === 'center' ? 'bg-primary text-primary-foreground' : 'bg-background border border-border'}`}
                    >
                      <AlignCenter className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setTextAlign('right')}
                      className={`p-2 rounded ${textAlign === 'right' ? 'bg-primary text-primary-foreground' : 'bg-background border border-border'}`}
                    >
                      <AlignRight className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground">Text Color:</span>
                    <div className="flex gap-1 flex-wrap">
                      {TEXT_COLORS.map((color) => (
                        <button
                          key={color}
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
                          onClick={() => setTextBgColor(color)}
                          className={`w-6 h-6 rounded border-2 ${textBgColor === color ? 'border-primary scale-110' : 'border-border'} ${color === 'transparent' ? 'bg-[url("data:image/svg+xml,%3csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 8 8%27%3e%3cpath fill=%27%23ccc%27 d=%27M0 0h4v4H0V0zm4 4h4v4H4V4z%27/%3e%3c/svg%3e")] bg-[length:8px_8px]' : ''}`}
                          style={{ backgroundColor: color !== 'transparent' ? color : undefined }}
                        />
                      ))}
                    </div>
                  </div>

                  <Button
                    onClick={addTextOverlay}
                    disabled={!newText.trim()}
                    size="sm"
                    className="w-full"
                  >
                    Add Text to Story
                  </Button>
                </div>
              )}

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

        {selectedFile && (
          <div className="border-t border-border p-4 flex gap-3 flex-shrink-0 bg-background">
            <Button
              variant="outline"
              onClick={() => {
                setSelectedFile(null);
                setPreviewUrl('');
                setFileType(null);
                setError('');
                setSelectedMusic(null);
                setSelectedFilter('normal');
                setTextOverlays([]);
                setShowTextEditor(false);
                setActiveTextId(null);
              }}
              disabled={isUploading}
              className="flex-1"
            >
              Change File
            </Button>
            <Button onClick={handleUpload} disabled={isUploading} className="flex-1">
              {isUploading ? 'Uploading...' : 'Share to Story'}
            </Button>
          </div>
        )}
      </div>

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
