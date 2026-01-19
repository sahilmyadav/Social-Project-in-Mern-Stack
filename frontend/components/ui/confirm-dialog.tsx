'use client';

import { Button } from '@/components/ui/button';
import { AlertTriangle, CheckCircle, Info, XCircle } from 'lucide-react';
import { useState } from 'react';

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm?: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string | null;
  variant?: 'danger' | 'warning' | 'info' | 'success';
}

export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'danger',
}: ConfirmDialogProps) {
  if (!isOpen) return null;

  const icons = {
    danger: <XCircle className="w-12 h-12 text-red-500" />,
    warning: <AlertTriangle className="w-12 h-12 text-yellow-500" />,
    info: <Info className="w-12 h-12 text-blue-500" />,
    success: <CheckCircle className="w-12 h-12 text-green-500" />,
  };

  const buttonColors = {
    danger: 'bg-red-500 hover:bg-red-600',
    warning: 'bg-yellow-500 hover:bg-yellow-600',
    info: 'bg-blue-500 hover:bg-blue-600',
    success: 'bg-green-500 hover:bg-green-600',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-background rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in duration-200">
        {/* Icon */}
        <div className="flex justify-center pt-8 pb-4">{icons[variant]}</div>

        {/* Content */}
        <div className="px-6 pb-6 text-center">
          <h3 className="text-xl font-bold mb-2">{title}</h3>
          <p className="text-muted-foreground">{message}</p>
        </div>

        {/* Actions */}
        <div className="flex gap-3 p-6 border-t border-border">
          {cancelText !== null && (
            <Button variant="outline" onClick={onClose} className="flex-1">
              {cancelText}
            </Button>
          )}
          <Button
            onClick={() => {
              onConfirm?.();
              onClose();
            }}
            className={`flex-1 ${buttonColors[variant]} text-white`}
          >
            {confirmText}
          </Button>
        </div>
      </div>
    </div>
  );
}

// Hook for easy usage
export function useConfirmDialog() {
  const [isOpen, setIsOpen] = useState(false);
  const [config, setConfig] = useState<Omit<ConfirmDialogProps, 'isOpen' | 'onClose'>>({
    onConfirm: () => {},
    title: '',
    message: '',
  });

  const confirm = (newConfig: Omit<ConfirmDialogProps, 'isOpen' | 'onClose'>) => {
    setConfig(newConfig);
    setIsOpen(true);
  };

  return {
    confirm,
    dialogProps: {
      isOpen,
      onClose: () => setIsOpen(false),
      ...config,
    },
  };
}
