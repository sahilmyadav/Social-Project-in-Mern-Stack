'use client';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { reelService } from '@/lib/api-services';
import { showToast } from '@/lib/toast';
import { useState } from 'react';
import { toast } from 'sonner';

interface ReportReelModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reelId: string;
  reelAuthor: string;
  onReported?: () => void; // Callback when report is submitted
}

const reportReasons = [
  { id: 'spam', label: 'Spam', description: 'Unwanted commercial content or repetitive reels' },
  {
    id: 'inappropriate',
    label: 'Inappropriate Content',
    description: 'Offensive or explicit content',
  },
  { id: 'harassment', label: 'Harassment', description: 'Bullying or targeting individuals' },
  { id: 'violence', label: 'Violence', description: 'Graphic violence or dangerous organizations' },
  {
    id: 'copyright',
    label: 'Copyright Violation',
    description: "Using someone else's work without permission",
  },
  { id: 'false_info', label: 'False Information', description: 'Misleading or fake content' },
  { id: 'other', label: 'Other', description: 'Something else that violates community guidelines' },
];

export default function ReportReelModal({
  open,
  onOpenChange,
  reelId,
  reelAuthor,
  onReported,
}: ReportReelModalProps) {
  const [selectedReason, setSelectedReason] = useState('');
  const [additionalInfo, setAdditionalInfo] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!selectedReason) return;

    setIsSubmitting(true);

    try {
      const response = await reelService.reportReel(reelId, {
        reason: selectedReason,
        additionalInfo: additionalInfo || undefined,
      });

      if (response.success) {
        // Reset form and close modal
        setSelectedReason('');
        setAdditionalInfo('');
        onOpenChange(false);

        // Call the onReported callback to hide the reel
        onReported?.();

        // Show success toast with undo option
        toast.success('Reel reported. This reel will be hidden from your feed.', {
          duration: 5000,
          action: {
            label: 'Undo',
            onClick: () => {
              // In a real implementation, you would call an API to undo the report
              showToast.info('Report undone. The reel will appear in your feed again.');
            },
          },
        });
      } else {
        throw new Error(response.message || 'Failed to submit report');
      }
    } catch (error: any) {
      console.error('Error submitting reel report:', error);
      showToast.error(error.message || 'Failed to submit report');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setSelectedReason('');
    setAdditionalInfo('');
    onOpenChange(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(open) => {
        if (!open) {
          handleClose();
        }
      }}
    >
      <DialogContent className="sm:max-w-md" onClick={(e) => e.stopPropagation()}>
        <DialogHeader>
          <DialogTitle>Report Reel</DialogTitle>
          <DialogDescription>
            Help us keep the community safe by reporting this reel from {reelAuthor}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-3">
            <label className="text-sm font-medium">Why are you reporting this reel?</label>
            <div className="space-y-2">
              {reportReasons.map((reason) => (
                <div key={reason.id} className="flex items-start space-x-3">
                  <input
                    type="radio"
                    id={reason.id}
                    name="report-reason"
                    value={reason.id}
                    checked={selectedReason === reason.id}
                    onChange={(e) => setSelectedReason(e.target.value)}
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <label htmlFor={reason.id} className="text-sm font-medium cursor-pointer">
                      {reason.label}
                    </label>
                    <p className="text-xs text-muted-foreground mt-1">{reason.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {selectedReason && (
            <div className="space-y-2">
              <label htmlFor="additional-info" className="text-sm font-medium">
                Additional Information (Optional)
              </label>
              <textarea
                id="additional-info"
                placeholder="Provide any additional context that might help us review this reel..."
                value={additionalInfo}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                  setAdditionalInfo(e.target.value)
                }
                rows={3}
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none"
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={(e) => {
              e.stopPropagation();
              handleClose();
            }}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            onClick={(e) => {
              e.stopPropagation();
              handleSubmit();
            }}
            disabled={!selectedReason || isSubmitting}
          >
            {isSubmitting ? 'Submitting...' : 'Submit Report'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
