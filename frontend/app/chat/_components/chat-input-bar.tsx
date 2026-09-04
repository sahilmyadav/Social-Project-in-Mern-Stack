'use client';

import EmojiPicker from '@/components/emoji-picker';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Camera,
  CornerUpLeft,
  FileText,
  Image as ImageIcon,
  MapPin,
  Mic,
  Navigation2,
  Plus,
  Send,
  X,
} from 'lucide-react';
import React, { useEffect, useRef } from 'react';

interface ReplyingTo {
  id: number | string;
  _id?: string;
  sender: string;
  content: string;
  isSent: boolean;
  media?: any[];
}

interface ChatInputBarProps {
  messageInput: string;
  onMessageInputChange: (value: string) => void;
  onSendMessage: () => void;
  isSendingMessage: boolean;
  selectedFile: File | null;
  previewUrl: string | null;
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveFile: () => void;
  showAttachmentMenu: boolean;
  onToggleAttachmentMenu: () => void;
  onEmojiSelect: (emoji: string) => void;
  // Voice recording
  isRecording: boolean;
  recordingDuration: number;
  formatRecordingDuration: (duration: number) => string;
  onStartRecording: () => void;
  onStopRecording: () => void;
  onCancelRecording: () => void;
  // Reply
  replyingTo: ReplyingTo | null;
  onCancelReply: () => void;
  // Location
  isSendingLocation: boolean;
  showLocationMenu: boolean;
  onToggleLocationMenu: () => void;
  onSendCurrentLocation: () => void;
  onSendLiveLocation: (minutes: number) => void;
}

const ChatInputBar = React.memo(function ChatInputBar({
  messageInput,
  onMessageInputChange,
  onSendMessage,
  isSendingMessage,
  selectedFile,
  previewUrl,
  onFileSelect,
  onRemoveFile,
  showAttachmentMenu,
  onToggleAttachmentMenu,
  onEmojiSelect,
  isRecording,
  recordingDuration,
  formatRecordingDuration,
  onStartRecording,
  onStopRecording,
  onCancelRecording,
  replyingTo,
  onCancelReply,
  isSendingLocation,
  showLocationMenu,
  onToggleLocationMenu,
  onSendCurrentLocation,
  onSendLiveLocation,
}: ChatInputBarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const documentInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Clear file input value when file is removed so same file can be re-selected
  useEffect(() => {
    if (!selectedFile && fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [selectedFile]);

  return (
    <div className="relative">
      {selectedFile && (
        <div className="absolute bottom-full left-0 right-0 p-4 bg-background border-t border-border flex items-center gap-4 z-20 shadow-md">
          <div className="relative w-20 h-20 rounded-lg overflow-hidden border border-border bg-muted">
            {selectedFile.type.startsWith('video') ? (
              <video src={previewUrl || ''} className="w-full h-full object-cover" />
            ) : selectedFile.type.startsWith('image') ? (
              <img src={previewUrl || ''} className="w-full h-full object-cover" alt="Preview" />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-muted">
                <FileText size={32} className="text-blue-500" />
              </div>
            )}
            <button
              onClick={onRemoveFile}
              className="absolute top-1 right-1 p-1 bg-black/60 rounded-full text-white hover:bg-black/80 transition"
            >
              <X size={12} />
            </button>
          </div>
          <div>
            <p className="text-sm font-medium truncate max-w-[200px]">{selectedFile.name}</p>
            <p className="text-xs text-muted-foreground">
              {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
            </p>
          </div>
        </div>
      )}

      {replyingTo && (
        <div className="px-4 py-2 border-t border-border bg-muted/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CornerUpLeft size={16} className="text-primary" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-primary">
                  Replying to {replyingTo.isSent ? 'yourself' : replyingTo.sender}
                </p>
                <p className="text-xs text-muted-foreground truncate max-w-[250px]">
                  {replyingTo.content || (replyingTo.media ? '📷 Media' : 'Message')}
                </p>
              </div>
            </div>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onCancelReply}>
              <X size={14} />
            </Button>
          </div>
        </div>
      )}

      <div className="p-2 lg:p-4 border-t border-border flex items-end gap-2 mb-0 bg-background relative z-10 w-full">
        <input
          type="file"
          ref={fileInputRef}
          onChange={onFileSelect}
          className="hidden"
          accept="image/*,video/*"
        />
        <input
          type="file"
          ref={documentInputRef}
          onChange={onFileSelect}
          className="hidden"
          accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,.rar"
        />
        <input
          type="file"
          ref={cameraInputRef}
          onChange={onFileSelect}
          className="hidden"
          accept="image/*"
          capture="environment"
        />

        <div className="relative">
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleAttachmentMenu}
            className="text-muted-foreground hover:text-primary mb-0.5"
            title="Attach file"
          >
            <Plus
              size={20}
              className={`transition-transform ${showAttachmentMenu ? 'rotate-45' : ''}`}
            />
          </Button>

          {showAttachmentMenu && (
            <div className="absolute bottom-12 left-0 bg-card rounded-xl shadow-lg border border-border p-2 min-w-[180px] z-50">
              <button
                onClick={() => {
                  cameraInputRef.current?.click();
                  onToggleAttachmentMenu();
                }}
                className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-muted rounded-lg transition text-sm"
              >
                <div className="w-8 h-8 rounded-full bg-red-500/10 flex items-center justify-center">
                  <Camera size={16} className="text-red-500" />
                </div>
                <span>Camera</span>
              </button>
              <button
                onClick={() => {
                  fileInputRef.current?.click();
                  onToggleAttachmentMenu();
                }}
                className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-muted rounded-lg transition text-sm"
              >
                <div className="w-8 h-8 rounded-full bg-purple-500/10 flex items-center justify-center">
                  <ImageIcon size={16} className="text-purple-500" />
                </div>
                <span>Photo & Video</span>
              </button>
              <button
                onClick={() => {
                  documentInputRef.current?.click();
                  onToggleAttachmentMenu();
                }}
                className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-muted rounded-lg transition text-sm"
              >
                <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center">
                  <FileText size={16} className="text-blue-500" />
                </div>
                <span>Document</span>
              </button>

              <div className="border-t border-border my-1"></div>
              <button
                onClick={onSendCurrentLocation}
                disabled={isSendingLocation}
                className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-muted rounded-lg transition text-sm disabled:opacity-50"
              >
                <div className="w-8 h-8 rounded-full bg-green-500/10 flex items-center justify-center">
                  <MapPin size={16} className="text-green-500" />
                </div>
                <span>{isSendingLocation ? 'Getting location...' : 'Current Location'}</span>
              </button>
              <button
                onClick={onToggleLocationMenu}
                disabled={isSendingLocation}
                className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-muted rounded-lg transition text-sm disabled:opacity-50"
              >
                <div className="w-8 h-8 rounded-full bg-orange-500/10 flex items-center justify-center">
                  <Navigation2 size={16} className="text-orange-500" />
                </div>
                <span>Live Location</span>
              </button>

              {showLocationMenu && (
                <div className="ml-11 space-y-1 mt-1">
                  <button
                    onClick={() => onSendLiveLocation(15)}
                    className="w-full text-left px-3 py-1.5 hover:bg-muted rounded text-xs text-muted-foreground hover:text-foreground transition"
                  >
                    Share for 15 minutes
                  </button>
                  <button
                    onClick={() => onSendLiveLocation(60)}
                    className="w-full text-left px-3 py-1.5 hover:bg-muted rounded text-xs text-muted-foreground hover:text-foreground transition"
                  >
                    Share for 1 hour
                  </button>
                  <button
                    onClick={() => onSendLiveLocation(480)}
                    className="w-full text-left px-3 py-1.5 hover:bg-muted rounded text-xs text-muted-foreground hover:text-foreground transition"
                  >
                    Share for 8 hours
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        <EmojiPicker onEmojiSelect={onEmojiSelect} showQuickReactions={true} />

        {isRecording ? (
          <div className="flex-1 flex items-center gap-3 px-4 py-2 bg-red-500/10 rounded-lg border border-red-500/30">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
              <span className="text-red-500 font-medium">
                {formatRecordingDuration(recordingDuration)}
              </span>
            </div>
            <span className="text-sm text-muted-foreground flex-1">Recording...</span>
            <button
              onClick={onCancelRecording}
              className="p-2 rounded-full hover:bg-red-500/20 transition text-red-500"
              title="Cancel"
            >
              <X size={20} />
            </button>
            <button
              onClick={onStopRecording}
              className="p-2 rounded-full bg-red-500 hover:bg-red-600 transition text-white"
              title="Send"
            >
              <Send size={20} />
            </button>
          </div>
        ) : (
          <>
            <div className="flex-1">
              <Input
                type="text"
                placeholder={selectedFile ? 'Add a caption...' : 'Type a message...'}
                value={messageInput}
                onChange={(e) => onMessageInputChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    onSendMessage();
                  }
                }}
                disabled={isSendingMessage}
                className="w-full"
              />
            </div>

            {messageInput.trim() || selectedFile ? (
              <Button
                onClick={onSendMessage}
                className="bg-primary hover:bg-primary/90 text-primary-foreground cursor-pointer mb-0.5"
                disabled={isSendingMessage}
              >
                <Send size={20} />
              </Button>
            ) : (
              <Button
                onClick={onStartRecording}
                className="bg-primary hover:bg-primary/90 text-primary-foreground cursor-pointer mb-0.5"
                disabled={isSendingMessage}
                title="Hold to record voice message"
              >
                <Mic size={20} />
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  );
});

export default ChatInputBar;
