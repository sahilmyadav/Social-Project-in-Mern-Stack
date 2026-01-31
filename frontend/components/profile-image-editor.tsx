'use client';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import {
  Check,
  ChevronLeft,
  ChevronRight,
  FlipHorizontal2,
  FlipVertical2,
  Focus,
  Loader2,
  Maximize2,
  Minus,
  Move,
  Plus,
  RotateCcw,
  RotateCw,
  Undo2,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

// ============================================================================
// TYPES
// ============================================================================
interface ProfileImageEditorProps {
  isOpen: boolean;
  onClose: () => void;
  imageFile: File | null;
  imageSrc?: string;
  type: 'profile' | 'cover';
  onSave: (croppedImageBlob: Blob, previewUrl: string) => void;
  /** Custom aspect ratio for cover photos (default: 2.5 for cover, 1 for profile) */
  coverAspectRatio?: number;
  /** Enable face auto-detection for profile photos */
  enableFaceDetection?: boolean;
  /** Quality of output image (0-1, default: 0.92) */
  outputQuality?: number;
  /** Output format (default: 'image/jpeg') */
  outputFormat?: 'image/jpeg' | 'image/png' | 'image/webp';
  /** Maximum output dimension in pixels (default: 1080 for profile, 1920 for cover) */
  maxOutputDimension?: number;
}

interface FaceRect {
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
}

type ActiveTab = 'position' | 'rotate';

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Detect face region in an image using skin tone analysis
 * This is a lightweight heuristic-based approach that works for most cases
 */
async function detectFaceRegion(img: HTMLImageElement): Promise<FaceRect | null> {
  return new Promise((resolve) => {
    try {
      const tempCanvas = document.createElement('canvas');
      const ctx = tempCanvas.getContext('2d');
      if (!ctx) {
        resolve(null);
        return;
      }

      // Resize for faster processing
      const maxSize = 200;
      const scale = Math.min(maxSize / img.width, maxSize / img.height);
      tempCanvas.width = img.width * scale;
      tempCanvas.height = img.height * scale;
      ctx.drawImage(img, 0, 0, tempCanvas.width, tempCanvas.height);

      // Get image data
      const imageData = ctx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
      const data = imageData.data;

      // Simple skin tone detection to find potential face region
      let minX = tempCanvas.width,
        maxX = 0;
      let minY = tempCanvas.height,
        maxY = 0;
      let skinPixels = 0;
      let totalConfidence = 0;

      for (let y = 0; y < tempCanvas.height; y++) {
        for (let x = 0; x < tempCanvas.width; x++) {
          const i = (y * tempCanvas.width + x) * 4;
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];

          // Enhanced skin tone detection (works for various skin tones)
          // Uses YCbCr color space approximation for better accuracy
          const y_comp = 0.299 * r + 0.587 * g + 0.114 * b;
          const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
          const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;

          // Skin tone ranges in YCbCr
          const isSkinTone =
            y_comp > 80 &&
            cb > 77 &&
            cb < 127 &&
            cr > 133 &&
            cr < 173 &&
            r > 60 &&
            g > 40 &&
            b > 20 &&
            r > g &&
            r > b &&
            Math.abs(r - g) < 100;

          if (isSkinTone) {
            skinPixels++;
            totalConfidence += y_comp / 255;
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }
        }
      }

      // If we found a reasonable face region (at least 3% of image)
      const totalPixels = tempCanvas.width * tempCanvas.height;
      if (skinPixels > totalPixels * 0.03 && maxX > minX && maxY > minY) {
        const avgConfidence = totalConfidence / skinPixels;

        // Scale back to original image coordinates
        resolve({
          x: minX / scale,
          y: minY / scale,
          width: (maxX - minX) / scale,
          height: (maxY - minY) / scale,
          confidence: avgConfidence,
        });
      } else {
        resolve(null);
      }
    } catch (error) {
      console.error('Face detection error:', error);
      resolve(null);
    }
  });
}

/**
 * Calculate optimal zoom and position to center a face in the crop area
 */
function calculateFaceCenter(
  faceRect: FaceRect,
  imgWidth: number,
  imgHeight: number,
  canvasWidth: number,
  canvasHeight: number
): { zoom: number; position: { x: number; y: number } } {
  const faceCenterX = faceRect.x + faceRect.width / 2;
  const faceCenterY = faceRect.y + faceRect.height / 2;

  // Calculate offset from image center
  const imgCenterX = imgWidth / 2;
  const imgCenterY = imgHeight / 2;

  // Calculate optimal zoom to fit face with padding (face should be ~60% of visible area)
  const faceSize = Math.max(faceRect.width, faceRect.height);
  const targetSize = Math.min(canvasWidth, canvasHeight) * 0.6;
  const optimalZoom = Math.min(Math.max(targetSize / faceSize, 1), 2.5);

  // Calculate position offset to center face
  const offsetX = (imgCenterX - faceCenterX) * 0.8;
  const offsetY = (imgCenterY - faceCenterY) * 0.8;

  return {
    zoom: optimalZoom,
    position: { x: offsetX, y: offsetY },
  };
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================
export function ProfileImageEditor({
  isOpen,
  onClose,
  imageFile,
  imageSrc: propImageSrc,
  type,
  onSave,
  coverAspectRatio = 2.5,
  enableFaceDetection = true,
  outputQuality = 0.92,
  outputFormat = 'image/jpeg',
  maxOutputDimension,
}: ProfileImageEditorProps) {
  // Refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Image state
  const [imageSrc, setImageSrc] = useState<string>('');
  const [originalImage, setOriginalImage] = useState<HTMLImageElement | null>(null);
  const [imageLoaded, setImageLoaded] = useState(false);

  // Transform state
  const [rotation, setRotation] = useState(0); // 90° increments
  const [fineRotation, setFineRotation] = useState(0); // -45° to +45°
  const [flipH, setFlipH] = useState(false);
  const [flipV, setFlipV] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });

  // Interaction state
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [lastPinchDistance, setLastPinchDistance] = useState(0);

  // Feature state
  const [isProcessing, setIsProcessing] = useState(false);
  const [isFaceDetecting, setIsFaceDetecting] = useState(false);
  const [faceDetected, setFaceDetected] = useState<FaceRect | null>(null);
  const [showGrid, setShowGrid] = useState(true);
  const [activeTab, setActiveTab] = useState<ActiveTab>('position');

  // ============================================================================
  // COMPUTED VALUES
  // ============================================================================

  const getCanvasDimensions = useCallback(() => {
    if (type === 'profile') {
      // Square for profile photos
      return { width: 320, height: 320 };
    } else {
      // Cover photo with custom aspect ratio
      const width = 400;
      return { width, height: Math.round(width / coverAspectRatio) };
    }
  }, [type, coverAspectRatio]);

  const getOutputDimensions = useCallback(() => {
    const defaultMax = type === 'profile' ? 1080 : 1920;
    const max = maxOutputDimension || defaultMax;

    if (type === 'profile') {
      return { width: max, height: max };
    } else {
      return { width: max, height: Math.round(max / coverAspectRatio) };
    }
  }, [type, coverAspectRatio, maxOutputDimension]);

  // ============================================================================
  // IMAGE LOADING
  // ============================================================================

  useEffect(() => {
    if (!isOpen) return;

    const loadImage = async () => {
      let src = propImageSrc || '';

      if (imageFile) {
        const reader = new FileReader();
        reader.onload = (e) => {
          src = e.target?.result as string;
          loadImageFromSrc(src);
        };
        reader.readAsDataURL(imageFile);
      } else if (src) {
        loadImageFromSrc(src);
      }
    };

    const loadImageFromSrc = (src: string) => {
      setImageSrc(src);
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        setOriginalImage(img);
        setImageLoaded(true);
        resetTransforms();

        // Auto-detect face for profile photos
        if (type === 'profile' && enableFaceDetection) {
          autoDetectAndCenterFace(img);
        }
      };
      img.src = src;
    };

    loadImage();
  }, [imageFile, propImageSrc, isOpen, type, enableFaceDetection]);

  // ============================================================================
  // TRANSFORM FUNCTIONS
  // ============================================================================

  const resetTransforms = useCallback(() => {
    setRotation(0);
    setFineRotation(0);
    setFlipH(false);
    setFlipV(false);
    setZoom(1);
    setPosition({ x: 0, y: 0 });
    setFaceDetected(null);
  }, []);

  const autoDetectAndCenterFace = async (img: HTMLImageElement) => {
    if (type !== 'profile') return;

    setIsFaceDetecting(true);

    try {
      const faceRect = await detectFaceRegion(img);

      if (faceRect && faceRect.confidence > 0.3) {
        setFaceDetected(faceRect);

        const dims = getCanvasDimensions();
        const { zoom: optimalZoom, position: optimalPosition } = calculateFaceCenter(
          faceRect,
          img.width,
          img.height,
          dims.width,
          dims.height
        );

        setZoom(optimalZoom);
        setPosition(optimalPosition);
      }
    } catch (error) {
      console.error('Face detection error:', error);
    } finally {
      setIsFaceDetecting(false);
    }
  };

  const handleAutoFocus = async () => {
    if (originalImage && type === 'profile') {
      await autoDetectAndCenterFace(originalImage);
    }
  };

  const handleFitToFrame = () => {
    setZoom(1);
    setPosition({ x: 0, y: 0 });
    setFaceDetected(null);
  };

  // Rotation functions
  const rotateLeft90 = () => setRotation((r) => (r - 90) % 360);
  const rotateRight90 = () => setRotation((r) => (r + 90) % 360);

  // Flip functions
  const toggleFlipH = () => setFlipH((f) => !f);
  const toggleFlipV = () => setFlipV((f) => !f);

  // Zoom functions
  const zoomIn = () => setZoom((z) => Math.min(z + 0.2, 4));
  const zoomOut = () => setZoom((z) => Math.max(z - 0.2, 0.5));

  // ============================================================================
  // CANVAS DRAWING
  // ============================================================================

  const drawCanvas = useCallback(() => {
    if (!canvasRef.current || !originalImage || !imageLoaded) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dims = getCanvasDimensions();
    canvas.width = dims.width;
    canvas.height = dims.height;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Save context
    ctx.save();

    // Move to center
    ctx.translate(canvas.width / 2, canvas.height / 2);

    // Apply total rotation (90° increments + fine rotation)
    const totalRotation = rotation + fineRotation;
    ctx.rotate((totalRotation * Math.PI) / 180);

    // Apply flip
    ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1);

    // Calculate scaled dimensions to cover the canvas
    const imgAspect = originalImage.width / originalImage.height;
    const canvasAspect = canvas.width / canvas.height;

    let drawWidth, drawHeight;
    if (imgAspect > canvasAspect) {
      drawHeight = canvas.height * zoom * 1.2;
      drawWidth = drawHeight * imgAspect;
    } else {
      drawWidth = canvas.width * zoom * 1.2;
      drawHeight = drawWidth / imgAspect;
    }

    // Draw image with position offset
    ctx.drawImage(
      originalImage,
      -drawWidth / 2 + position.x,
      -drawHeight / 2 + position.y,
      drawWidth,
      drawHeight
    );

    // Restore context
    ctx.restore();

    // Apply circular mask for profile photos
    if (type === 'profile') {
      ctx.save();
      ctx.globalCompositeOperation = 'destination-in';
      ctx.beginPath();
      ctx.arc(canvas.width / 2, canvas.height / 2, canvas.width / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Draw grid overlay for cover photos
    if (showGrid && type === 'cover') {
      drawGrid(ctx, canvas.width, canvas.height);
    }
  }, [
    originalImage,
    imageLoaded,
    rotation,
    fineRotation,
    flipH,
    flipV,
    zoom,
    position,
    type,
    showGrid,
    getCanvasDimensions,
  ]);

  // Draw rule of thirds grid
  const drawGrid = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.lineWidth = 1;

    // Vertical lines
    ctx.beginPath();
    ctx.moveTo(width / 3, 0);
    ctx.lineTo(width / 3, height);
    ctx.moveTo((width * 2) / 3, 0);
    ctx.lineTo((width * 2) / 3, height);

    // Horizontal lines
    ctx.moveTo(0, height / 3);
    ctx.lineTo(width, height / 3);
    ctx.moveTo(0, (height * 2) / 3);
    ctx.lineTo(width, (height * 2) / 3);

    ctx.stroke();
    ctx.restore();
  };

  // Update canvas when transforms change
  useEffect(() => {
    drawCanvas();
  }, [drawCanvas]);

  // ============================================================================
  // INTERACTION HANDLERS
  // ============================================================================

  // Mouse handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
  };

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isDragging) return;
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    },
    [isDragging, dragStart]
  );

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Touch handlers with pinch-to-zoom
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      // Pinch gesture
      const distance = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      setLastPinchDistance(distance);
    } else if (e.touches.length === 1) {
      // Single finger drag
      const touch = e.touches[0];
      setIsDragging(true);
      setDragStart({ x: touch.clientX - position.x, y: touch.clientY - position.y });
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      e.preventDefault();
      const distance = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );

      if (lastPinchDistance > 0) {
        const delta = (distance - lastPinchDistance) * 0.01;
        setZoom((z) => Math.min(Math.max(z + delta, 0.5), 4));
      }
      setLastPinchDistance(distance);
    } else if (e.touches.length === 1 && isDragging) {
      const touch = e.touches[0];
      setPosition({
        x: touch.clientX - dragStart.x,
        y: touch.clientY - dragStart.y,
      });
    }
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    setLastPinchDistance(0);
  };

  // Mouse wheel for zoom
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const isPinch = e.ctrlKey;
    const delta = isPinch ? -e.deltaY * 0.01 : -e.deltaY * 0.002;
    setZoom((z) => Math.min(Math.max(z + delta, 0.5), 4));
  }, []);

  // ============================================================================
  // SAVE FUNCTION
  // ============================================================================

  const handleSave = async () => {
    if (!originalImage) return;

    setIsProcessing(true);

    try {
      // Create high-quality output canvas
      const saveCanvas = document.createElement('canvas');
      const saveCtx = saveCanvas.getContext('2d');
      if (!saveCtx) return;

      const outputDims = getOutputDimensions();
      saveCanvas.width = outputDims.width;
      saveCanvas.height = outputDims.height;

      // Calculate scale factor from preview canvas to output
      const previewDims = getCanvasDimensions();
      const scaleX = outputDims.width / previewDims.width;
      const scaleY = outputDims.height / previewDims.height;

      // Draw with all transforms
      saveCtx.save();
      saveCtx.translate(saveCanvas.width / 2, saveCanvas.height / 2);

      const totalRotation = rotation + fineRotation;
      saveCtx.rotate((totalRotation * Math.PI) / 180);
      saveCtx.scale(flipH ? -1 : 1, flipV ? -1 : 1);

      const imgAspect = originalImage.width / originalImage.height;
      const canvasAspect = saveCanvas.width / saveCanvas.height;

      let drawWidth, drawHeight;
      if (imgAspect > canvasAspect) {
        drawHeight = saveCanvas.height * zoom * 1.2;
        drawWidth = drawHeight * imgAspect;
      } else {
        drawWidth = saveCanvas.width * zoom * 1.2;
        drawHeight = drawWidth / imgAspect;
      }

      // Scale position for output resolution
      const scaledPosX = position.x * scaleX;
      const scaledPosY = position.y * scaleY;

      saveCtx.drawImage(
        originalImage,
        -drawWidth / 2 + scaledPosX,
        -drawHeight / 2 + scaledPosY,
        drawWidth,
        drawHeight
      );
      saveCtx.restore();

      // Apply circular mask for profile photos
      if (type === 'profile') {
        saveCtx.save();
        saveCtx.globalCompositeOperation = 'destination-in';
        saveCtx.beginPath();
        saveCtx.arc(
          saveCanvas.width / 2,
          saveCanvas.height / 2,
          saveCanvas.width / 2,
          0,
          Math.PI * 2
        );
        saveCtx.fill();
        saveCtx.restore();
      }

      // Convert to blob
      saveCanvas.toBlob(
        (blob) => {
          if (blob) {
            const previewUrl = saveCanvas.toDataURL(outputFormat, outputQuality);
            onSave(blob, previewUrl);
            onClose();
          }
        },
        outputFormat,
        outputQuality
      );
    } catch (error) {
      console.error('Error saving image:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-[95vw] md:max-w-2xl p-0 gap-0 overflow-hidden bg-zinc-950 border-zinc-800">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="p-1.5 rounded-full hover:bg-zinc-800 transition-colors"
              aria-label="Close"
            >
              <X className="w-5 h-5 text-zinc-400" />
            </button>
            <DialogTitle className="text-lg font-semibold text-white">
              {type === 'profile' ? 'Edit Profile Photo' : 'Edit Cover Photo'}
            </DialogTitle>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={resetTransforms}
              className="text-zinc-400 hover:text-white hover:bg-zinc-800"
            >
              <Undo2 className="w-4 h-4 mr-1" />
              Reset
            </Button>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex flex-col">
          {/* Image Preview Area */}
          <div
            ref={containerRef}
            className="relative flex items-center justify-center p-6 bg-zinc-900"
            style={{ minHeight: type === 'profile' ? '380px' : '220px' }}
          >
            {/* Frame */}
            <div
              className={cn(
                'relative overflow-hidden shadow-2xl',
                type === 'profile'
                  ? 'rounded-full ring-4 ring-zinc-700'
                  : 'rounded-xl ring-2 ring-zinc-700'
              )}
              style={{
                width: type === 'profile' ? '320px' : '100%',
                maxWidth: type === 'profile' ? '320px' : '400px',
              }}
            >
              <canvas
                ref={canvasRef}
                className={cn(
                  'w-full h-auto touch-none transition-opacity',
                  isDragging ? 'cursor-grabbing' : 'cursor-grab'
                )}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onWheel={handleWheel}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
              />

              {/* Face detection indicator */}
              {isFaceDetecting && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                  <div className="flex items-center gap-2 text-white">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span className="text-sm">Detecting face...</span>
                  </div>
                </div>
              )}
            </div>

            {/* Hint text */}
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2">
              <div className="flex items-center gap-2 px-3 py-1.5 bg-black/60 rounded-full text-xs text-zinc-400">
                <Move className="w-3 h-3" />
                <span>Drag to reposition • Scroll to zoom</span>
              </div>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="flex border-b border-zinc-800">
            <button
              onClick={() => setActiveTab('position')}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors',
                activeTab === 'position'
                  ? 'text-white border-b-2 border-blue-500 bg-zinc-800/50'
                  : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/30'
              )}
            >
              <Move className="w-4 h-4" />
              Position & Zoom
            </button>
            <button
              onClick={() => setActiveTab('rotate')}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors',
                activeTab === 'rotate'
                  ? 'text-white border-b-2 border-blue-500 bg-zinc-800/50'
                  : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/30'
              )}
            >
              <RotateCw className="w-4 h-4" />
              Rotate & Flip
            </button>
          </div>

          {/* Controls */}
          <div className="p-4 bg-zinc-900/95 space-y-4">
            {activeTab === 'position' && (
              <>
                {/* Zoom Controls */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm text-zinc-400">
                    <span>Zoom</span>
                    <span className="text-zinc-500">{Math.round(zoom * 100)}%</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={zoomOut}
                      disabled={zoom <= 0.5}
                      className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <Minus className="w-4 h-4 text-white" />
                    </button>
                    <input
                      type="range"
                      min="0.5"
                      max="4"
                      step="0.05"
                      value={zoom}
                      onChange={(e) => setZoom(parseFloat(e.target.value))}
                      className="flex-1 h-2 bg-zinc-700 rounded-full appearance-none cursor-pointer
                        [&::-webkit-slider-thumb]:appearance-none
                        [&::-webkit-slider-thumb]:w-5
                        [&::-webkit-slider-thumb]:h-5
                        [&::-webkit-slider-thumb]:rounded-full
                        [&::-webkit-slider-thumb]:bg-blue-500
                        [&::-webkit-slider-thumb]:cursor-pointer
                        [&::-webkit-slider-thumb]:shadow-lg
                        [&::-moz-range-thumb]:w-5
                        [&::-moz-range-thumb]:h-5
                        [&::-moz-range-thumb]:rounded-full
                        [&::-moz-range-thumb]:bg-blue-500
                        [&::-moz-range-thumb]:cursor-pointer
                        [&::-moz-range-thumb]:border-0"
                    />
                    <button
                      onClick={zoomIn}
                      disabled={zoom >= 4}
                      className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <Plus className="w-4 h-4 text-white" />
                    </button>
                  </div>
                </div>

                {/* Quick Actions */}
                <div className="flex items-center gap-2 flex-wrap">
                  {type === 'profile' && enableFaceDetection && (
                    <button
                      onClick={handleAutoFocus}
                      disabled={isFaceDetecting}
                      className={cn(
                        'flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all',
                        faceDetected
                          ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                          : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                      )}
                    >
                      {isFaceDetecting ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Focus className="w-4 h-4" />
                      )}
                      {faceDetected ? 'Face Centered' : 'Auto Focus'}
                    </button>
                  )}
                  <button
                    onClick={handleFitToFrame}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-zinc-800 text-zinc-300 hover:bg-zinc-700 text-sm font-medium transition-colors"
                  >
                    <Maximize2 className="w-4 h-4" />
                    Fit to Frame
                  </button>
                </div>
              </>
            )}

            {activeTab === 'rotate' && (
              <>
                {/* 90° Rotation */}
                <div className="space-y-2">
                  <span className="text-sm text-zinc-400">Quick Rotate</span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={rotateLeft90}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-zinc-800 text-white hover:bg-zinc-700 text-sm font-medium transition-colors"
                    >
                      <RotateCcw className="w-4 h-4" />
                      Left 90°
                    </button>
                    <button
                      onClick={rotateRight90}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-zinc-800 text-white hover:bg-zinc-700 text-sm font-medium transition-colors"
                    >
                      <RotateCw className="w-4 h-4" />
                      Right 90°
                    </button>
                  </div>
                </div>

                {/* Fine Rotation Slider */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm text-zinc-400">
                    <span>Fine Rotation</span>
                    <span className="text-zinc-500">{fineRotation}°</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setFineRotation((r) => Math.max(r - 5, -45))}
                      className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 transition-colors"
                    >
                      <ChevronLeft className="w-4 h-4 text-white" />
                    </button>
                    <input
                      type="range"
                      min="-45"
                      max="45"
                      step="1"
                      value={fineRotation}
                      onChange={(e) => setFineRotation(parseInt(e.target.value))}
                      className="flex-1 h-2 bg-zinc-700 rounded-full appearance-none cursor-pointer
                        [&::-webkit-slider-thumb]:appearance-none
                        [&::-webkit-slider-thumb]:w-5
                        [&::-webkit-slider-thumb]:h-5
                        [&::-webkit-slider-thumb]:rounded-full
                        [&::-webkit-slider-thumb]:bg-blue-500
                        [&::-webkit-slider-thumb]:cursor-pointer
                        [&::-webkit-slider-thumb]:shadow-lg
                        [&::-moz-range-thumb]:w-5
                        [&::-moz-range-thumb]:h-5
                        [&::-moz-range-thumb]:rounded-full
                        [&::-moz-range-thumb]:bg-blue-500
                        [&::-moz-range-thumb]:cursor-pointer
                        [&::-moz-range-thumb]:border-0"
                    />
                    <button
                      onClick={() => setFineRotation((r) => Math.min(r + 5, 45))}
                      className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 transition-colors"
                    >
                      <ChevronRight className="w-4 h-4 text-white" />
                    </button>
                  </div>
                </div>

                {/* Flip Controls */}
                <div className="space-y-2">
                  <span className="text-sm text-zinc-400">Flip</span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={toggleFlipH}
                      className={cn(
                        'flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all',
                        flipH
                          ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                          : 'bg-zinc-800 text-white hover:bg-zinc-700'
                      )}
                    >
                      <FlipHorizontal2 className="w-4 h-4" />
                      Horizontal
                    </button>
                    <button
                      onClick={toggleFlipV}
                      className={cn(
                        'flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all',
                        flipV
                          ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                          : 'bg-zinc-800 text-white hover:bg-zinc-700'
                      )}
                    >
                      <FlipVertical2 className="w-4 h-4" />
                      Vertical
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-between p-4 border-t border-zinc-800 bg-zinc-900">
            <Button
              variant="ghost"
              onClick={onClose}
              className="text-zinc-400 hover:text-white hover:bg-zinc-800"
            >
              <X className="w-4 h-4 mr-2" />
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={isProcessing || !imageLoaded}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  Apply
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Export default for dynamic imports
export default ProfileImageEditor;
