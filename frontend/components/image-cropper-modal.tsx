'use client';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';
import {
  Check,
  FlipHorizontal2,
  FlipVertical2,
  RectangleHorizontal,
  RotateCcw,
  RotateCw,
  Square,
  Undo2,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { useCallback, useState } from 'react';
import type { Area, Point } from 'react-easy-crop';
import Cropper from 'react-easy-crop';

interface ImageCropperModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageSrc: string;
  onCropComplete: (croppedImage: Blob, croppedImageUrl: string) => void;
  aspectRatio?: number; // 1 for profile (1:1), 16/9 for cover, etc.
  cropShape?: 'rect' | 'round';
  title?: string;
  minZoom?: number;
  maxZoom?: number;
}

const createImage = (url: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener('load', () => resolve(image));
    image.addEventListener('error', (error) => reject(error));
    image.setAttribute('crossOrigin', 'anonymous');
    image.src = url;
  });

const getRadianAngle = (degreeValue: number) => {
  return (degreeValue * Math.PI) / 180;
};

const rotateSize = (width: number, height: number, rotation: number) => {
  const rotRad = getRadianAngle(rotation);
  return {
    width: Math.abs(Math.cos(rotRad) * width) + Math.abs(Math.sin(rotRad) * height),
    height: Math.abs(Math.sin(rotRad) * width) + Math.abs(Math.cos(rotRad) * height),
  };
};

async function getCroppedImg(
  imageSrc: string,
  pixelCrop: Area,
  rotation = 0,
  flipHorizontal = false,
  flipVertical = false
): Promise<Blob> {
  const image = await createImage(imageSrc);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('Could not get canvas context');
  }

  const rotRad = getRadianAngle(rotation);

  const { width: bBoxWidth, height: bBoxHeight } = rotateSize(image.width, image.height, rotation);

  canvas.width = bBoxWidth;
  canvas.height = bBoxHeight;

  ctx.translate(bBoxWidth / 2, bBoxHeight / 2);
  ctx.rotate(rotRad);
  ctx.scale(flipHorizontal ? -1 : 1, flipVertical ? -1 : 1);
  ctx.translate(-image.width / 2, -image.height / 2);

  ctx.drawImage(image, 0, 0);

  const croppedCanvas = document.createElement('canvas');
  const croppedCtx = croppedCanvas.getContext('2d');

  if (!croppedCtx) {
    throw new Error('Could not get cropped canvas context');
  }

  croppedCanvas.width = pixelCrop.width;
  croppedCanvas.height = pixelCrop.height;

  croppedCtx.drawImage(
    canvas,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    pixelCrop.width,
    pixelCrop.height
  );

  return new Promise((resolve, reject) => {
    croppedCanvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Canvas is empty'));
        }
      },
      'image/jpeg',
      0.95
    );
  });
}

export function ImageCropperModal({
  isOpen,
  onClose,
  imageSrc,
  onCropComplete,
  aspectRatio = 1,
  cropShape = 'rect',
  title = 'Edit Photo',
  minZoom = 1,
  maxZoom = 3,
}: ImageCropperModalProps) {
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [flipHorizontal, setFlipHorizontal] = useState(false);
  const [flipVertical, setFlipVertical] = useState(false);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentAspectRatio, setCurrentAspectRatio] = useState(aspectRatio);

  const resetState = useCallback(() => {
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setRotation(0);
    setFlipHorizontal(false);
    setFlipVertical(false);
    setCurrentAspectRatio(aspectRatio);
  }, [aspectRatio]);

  const onCropChange = useCallback((location: Point) => {
    setCrop(location);
  }, []);

  const onZoomChange = useCallback((zoomValue: number) => {
    setZoom(zoomValue);
  }, []);

  const onCropAreaComplete = useCallback((_: Area, croppedAreaPixels: Area) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleRotateLeft = useCallback(() => {
    setRotation((prev) => prev - 90);
  }, []);

  const handleRotateRight = useCallback(() => {
    setRotation((prev) => prev + 90);
  }, []);

  const handleFlipHorizontal = useCallback(() => {
    setFlipHorizontal((prev) => !prev);
  }, []);

  const handleFlipVertical = useCallback(() => {
    setFlipVertical((prev) => !prev);
  }, []);

  const handleZoomIn = useCallback(() => {
    setZoom((prev) => Math.min(prev + 0.1, maxZoom));
  }, [maxZoom]);

  const handleZoomOut = useCallback(() => {
    setZoom((prev) => Math.max(prev - 0.1, minZoom));
  }, [minZoom]);

  const handleReset = useCallback(() => {
    resetState();
  }, [resetState]);

  const handleSave = useCallback(async () => {
    if (!croppedAreaPixels) return;

    setIsProcessing(true);
    try {
      const croppedBlob = await getCroppedImg(
        imageSrc,
        croppedAreaPixels,
        rotation,
        flipHorizontal,
        flipVertical
      );
      const croppedImageUrl = URL.createObjectURL(croppedBlob);
      onCropComplete(croppedBlob, croppedImageUrl);
      onClose();
    } catch (error) {
    } finally {
      setIsProcessing(false);
    }
  }, [
    croppedAreaPixels,
    imageSrc,
    rotation,
    flipHorizontal,
    flipVertical,
    onCropComplete,
    onClose,
  ]);

  const aspectRatios = [
    { value: 1, label: '1:1', icon: Square },
    { value: 16 / 9, label: '16:9', icon: RectangleHorizontal },
    { value: 4 / 3, label: '4:3', icon: RectangleHorizontal },
  ];

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-[95vw] md:max-w-3xl p-0 gap-0 overflow-hidden bg-black/95 border-zinc-800">
        <DialogHeader className="px-4 py-3 border-b border-zinc-800 flex flex-row items-center justify-between">
          <DialogTitle className="text-lg font-semibold text-white">{title}</DialogTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleReset}
              className="text-zinc-400 hover:text-white hover:bg-zinc-800"
            >
              <Undo2 className="w-4 h-4 mr-1" />
              Reset
            </Button>
          </div>
        </DialogHeader>

        <div className="relative w-full h-[50vh] md:h-[60vh] bg-zinc-950">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            rotation={rotation}
            aspect={currentAspectRatio}
            cropShape={cropShape}
            showGrid={true}
            onCropChange={onCropChange}
            onZoomChange={onZoomChange}
            onCropComplete={onCropAreaComplete}
            transform={[
              `translate(${crop.x}px, ${crop.y}px)`,
              `rotateZ(${rotation}deg)`,
              `scale(${flipHorizontal ? -1 : 1}, ${flipVertical ? -1 : 1})`,
            ].join(' ')}
            style={{
              containerStyle: {
                backgroundColor: '#09090b',
              },
              cropAreaStyle: {
                border: '2px solid #3b82f6',
                borderRadius: cropShape === 'round' ? '50%' : '0',
              },
            }}
          />
        </div>

        <div className="p-4 bg-zinc-900/95 border-t border-zinc-800 space-y-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleZoomOut}
              disabled={zoom <= minZoom}
              className="text-zinc-400 hover:text-white hover:bg-zinc-800 shrink-0"
            >
              <ZoomOut className="w-5 h-5" />
            </Button>
            <Slider
              value={[zoom]}
              min={minZoom}
              max={maxZoom}
              step={0.01}
              onValueChange={([value]: number[]) => setZoom(value)}
              className="flex-1"
            />
            <Button
              variant="ghost"
              size="icon"
              onClick={handleZoomIn}
              disabled={zoom >= maxZoom}
              className="text-zinc-400 hover:text-white hover:bg-zinc-800 shrink-0"
            >
              <ZoomIn className="w-5 h-5" />
            </Button>
            <span className="text-sm text-zinc-400 min-w-[48px] text-right">
              {Math.round(zoom * 100)}%
            </span>
          </div>

          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleRotateLeft}
              className="text-zinc-400 hover:text-white hover:bg-zinc-800 shrink-0"
            >
              <RotateCcw className="w-5 h-5" />
            </Button>
            <Slider
              value={[rotation]}
              min={-180}
              max={180}
              step={1}
              onValueChange={([value]: number[]) => setRotation(value)}
              className="flex-1"
            />
            <Button
              variant="ghost"
              size="icon"
              onClick={handleRotateRight}
              className="text-zinc-400 hover:text-white hover:bg-zinc-800 shrink-0"
            >
              <RotateCw className="w-5 h-5" />
            </Button>
            <span className="text-sm text-zinc-400 min-w-[48px] text-right">{rotation}°</span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button
                variant={flipHorizontal ? 'secondary' : 'ghost'}
                size="icon"
                onClick={handleFlipHorizontal}
                className={cn(
                  'text-zinc-400 hover:text-white hover:bg-zinc-800',
                  flipHorizontal && 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                )}
              >
                <FlipHorizontal2 className="w-5 h-5" />
              </Button>
              <Button
                variant={flipVertical ? 'secondary' : 'ghost'}
                size="icon"
                onClick={handleFlipVertical}
                className={cn(
                  'text-zinc-400 hover:text-white hover:bg-zinc-800',
                  flipVertical && 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                )}
              >
                <FlipVertical2 className="w-5 h-5" />
              </Button>

              <div className="flex items-center gap-1 ml-4 border-l border-zinc-700 pl-4">
                {aspectRatios.map((ratio) => {
                  const Icon = ratio.icon;
                  return (
                    <Button
                      key={ratio.value}
                      variant={currentAspectRatio === ratio.value ? 'secondary' : 'ghost'}
                      size="sm"
                      onClick={() => setCurrentAspectRatio(ratio.value)}
                      className={cn(
                        'text-xs gap-1 text-zinc-400 hover:text-white hover:bg-zinc-800',
                        currentAspectRatio === ratio.value &&
                          'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                      )}
                    >
                      <Icon className="w-4 h-4" />
                      {ratio.label}
                    </Button>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                onClick={onClose}
                className="text-zinc-400 hover:text-white hover:bg-zinc-800"
              >
                <X className="w-4 h-4 mr-1" />
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={isProcessing}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {isProcessing ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4 mr-1" />
                    Apply
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
