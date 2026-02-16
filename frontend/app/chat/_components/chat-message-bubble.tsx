'use client';

import SharedContentPreview from '@/components/shared-content-preview';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { getMediaUrl } from '@/lib/media-utils';
import {
  Edit2,
  FileText,
  Forward,
  MapPin,
  Mic,
  MoreHorizontal,
  Reply,
  Trash2,
  X,
} from 'lucide-react';
import React from 'react';

interface MessageMedia {
  url: string;
  type: 'image' | 'video' | 'file' | 'document' | 'audio';
  publicId?: string;
  fileName?: string;
  filename?: string;
  size?: number;
  duration?: number;
}

interface MessageReplyTo {
  _id: string;
  content: string;
  senderName: string;
}

interface MessageLocation {
  latitude: number;
  longitude: number;
  address?: string;
  name?: string;
  isLiveLocation?: boolean;
  expiresAt?: string;
}

export interface ChatMessage {
  id: number | string;
  _id?: string;
  sender: string;
  content: string;
  timestamp: string;
  isSent: boolean;
  status?: 'sent' | 'delivered' | 'seen';
  isEdited?: boolean;
  isDeleted?: boolean;
  type?: string;
  messageType?: string;
  senderId?: string;
  senderName?: string;
  isSystemMessage?: boolean;
  systemMessageType?: string;
  media?: MessageMedia[];
  location?: MessageLocation;
  replyTo?: MessageReplyTo;
  isForwarded?: boolean;
  sharedContent?: {
    contentType: string;
    contentId: string;
    contentData: any;
  };
}

interface ChatMessageBubbleProps {
  message: ChatMessage;
  msgIndex: number;
  isGroup: boolean;
  editingMessageId: string | null;
  editingMessageText: string;
  onEditTextChange: (text: string) => void;
  onEditSave: (messageId: string) => void;
  onEditCancel: () => void;
  onReply: (message: ChatMessage) => void;
  onForward: (message: ChatMessage) => void;
  onEditStart: (messageId: string, content: string) => void;
  onDeleteForMe: (messageId: string) => void;
  onDeleteForEveryone: (messageId: string) => void;
}

const ChatMessageBubble = React.memo(function ChatMessageBubble({
  message,
  msgIndex,
  isGroup,
  editingMessageId,
  editingMessageText,
  onEditTextChange,
  onEditSave,
  onEditCancel,
  onReply,
  onForward,
  onEditStart,
  onDeleteForMe,
  onDeleteForEveryone,
}: ChatMessageBubbleProps) {
  if ((message as any).isSystemMessage) {
    return (
      <div className="flex justify-center my-2">
        <div className="px-3 py-1 rounded-full bg-muted/50 text-muted-foreground text-xs">
          {message.content}
        </div>
      </div>
    );
  }

  const messageIdStr = message.id.toString();

  return (
    <div className={`flex ${message.isSent ? 'justify-end' : 'justify-start'}`}>
      <div className="flex items-start gap-2 group max-w-xs">
        {message.isSent && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="opacity-50 lg:opacity-0 lg:group-hover:opacity-100 p-1 rounded-full hover:bg-muted transition mt-1 cursor-pointer">
                <MoreHorizontal size={16} className="text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onReply(message)}>
                <Reply size={14} className="mr-2" />
                Reply
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onForward(message)}>
                <Forward size={14} className="mr-2" />
                Forward
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onEditStart(messageIdStr, message.content)}>
                <Edit2 size={14} className="mr-2" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onDeleteForMe(messageIdStr)}>
                <Trash2 size={14} className="mr-2" />
                Delete for me
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onDeleteForEveryone(messageIdStr)}
                className="text-destructive"
              >
                <Trash2 size={14} className="mr-2" />
                Delete for everyone
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {editingMessageId === messageIdStr ? (
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <Input
                value={editingMessageText}
                onChange={(e) => onEditTextChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    onEditSave(messageIdStr);
                  }
                }}
                className="flex-1"
                autoFocus
              />
              <Button size="sm" onClick={() => onEditSave(messageIdStr)}>
                Save
              </Button>
              <Button size="sm" variant="ghost" onClick={onEditCancel}>
                <X size={16} />
              </Button>
            </div>
          </div>
        ) : (
          <div
            id={`message-${message.id}`}
            className={`px-4 py-2 rounded-2xl transition-colors duration-500 ${
              message.isSent
                ? 'bg-primary text-primary-foreground rounded-br-none'
                : 'bg-muted rounded-bl-none'
            }`}
          >
            {isGroup && !message.isSent && (
              <p className="text-xs font-semibold text-primary mb-1">{message.sender}</p>
            )}

            {message.replyTo && (
              <div
                onClick={() => {
                  const replyId = message.replyTo?._id;
                  if (replyId) {
                    const originalMessage = document.getElementById(`message-${replyId}`);
                    if (originalMessage) {
                      originalMessage.scrollIntoView({ behavior: 'smooth', block: 'center' });
                      originalMessage.classList.add('bg-primary/20');
                      setTimeout(() => originalMessage.classList.remove('bg-primary/20'), 2000);
                    }
                  }
                }}
                className={`mb-2 pl-2 border-l-2 cursor-pointer hover:opacity-80 transition ${
                  message.isSent ? 'border-primary-foreground/50' : 'border-primary/50'
                }`}
              >
                <p
                  className={`text-xs font-medium ${
                    message.isSent ? 'text-primary-foreground/70' : 'text-muted-foreground'
                  }`}
                >
                  {message.replyTo.senderName || 'Unknown'}
                </p>
                <p
                  className={`text-xs truncate max-w-[180px] ${
                    message.isSent ? 'text-primary-foreground/60' : 'text-muted-foreground'
                  }`}
                >
                  {message.replyTo.content || '[Message]'}
                </p>
              </div>
            )}

            {message.isForwarded && (
              <div
                className={`flex items-center gap-1 text-xs mb-1 ${
                  message.isSent ? 'text-primary-foreground/60' : 'text-muted-foreground'
                }`}
              >
                <Forward size={10} />
                <span>Forwarded</span>
              </div>
            )}

            {message.media &&
              message.media.map((item, idx) => (
                <div key={idx} className="mb-2 rounded-lg overflow-hidden max-w-[240px]">
                  {item.type === 'audio' ? (
                    <div className="flex items-center gap-3 p-3 bg-muted rounded-lg min-w-[200px]">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Mic size={18} className="text-primary" />
                      </div>
                      <audio
                        src={getMediaUrl(item.url)}
                        controls
                        className="flex-1 h-8"
                        style={{ minWidth: '120px' }}
                      />
                    </div>
                  ) : item.type === 'video' ? (
                    <video
                      src={getMediaUrl(item.url)}
                      controls
                      className="w-full max-h-[300px] object-cover"
                    />
                  ) : item.type === 'document' ||
                    item.type === 'file' ||
                    (item.url &&
                      /\.(pdf|doc|docx|xls|xlsx|ppt|pptx|txt|csv|zip|rar|7z)$/i.test(item.url)) ||
                    (!item.type?.startsWith('image') &&
                      !item.type?.startsWith('video') &&
                      !item.type?.startsWith('audio') &&
                      (item.fileName || item.filename)) ? (
                    <a
                      href={getMediaUrl(item.url)}
                      download={item.fileName || item.filename || 'document'}
                      className="flex items-center gap-3 p-3 bg-muted rounded-lg hover:bg-muted/80 transition"
                    >
                      <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                        {/\.pdf$/i.test(item.url || '') ? (
                          <FileText size={20} className="text-red-500" />
                        ) : /\.(doc|docx)$/i.test(item.url || '') ? (
                          <FileText size={20} className="text-blue-600" />
                        ) : /\.(xls|xlsx)$/i.test(item.url || '') ? (
                          <FileText size={20} className="text-green-600" />
                        ) : /\.(zip|rar|7z)$/i.test(item.url || '') ? (
                          <FileText size={20} className="text-yellow-600" />
                        ) : (
                          <FileText size={20} className="text-blue-500" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {item.fileName || item.filename || 'Document'}
                        </p>
                        <p className="text-xs text-muted-foreground">Click to download</p>
                      </div>
                    </a>
                  ) : (
                    <img
                      src={getMediaUrl(item.url)}
                      alt="Shared content"
                      className="w-full max-h-[300px] object-cover"
                    />
                  )}
                </div>
              ))}

            {message.content && (
              <p className={message.isDeleted ? 'italic opacity-60' : ''}>{message.content}</p>
            )}

            {((message as any).messageType === 'shared_post' ||
              (message as any).messageType === 'shared_reel') &&
              (message as any).sharedContent?.contentData && (
                <SharedContentPreview
                  messageType={(message as any).messageType}
                  contentData={(message as any).sharedContent.contentData}
                />
              )}

            {(message.location || (message as any).messageType === 'location') &&
              message.location &&
              message.location.latitude !== undefined &&
              message.location.longitude !== undefined && (
                <a
                  href={`https://www.google.com/maps?q=${message.location.latitude},${message.location.longitude}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block mt-2 rounded-lg overflow-hidden border border-border hover:border-primary/50 transition"
                >
                  <div className="relative w-[250px] h-[150px] bg-muted">
                    <img
                      src={`https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/pin-s+ef4444(${message.location.longitude},${message.location.latitude})/${message.location.longitude},${message.location.latitude},14,0/250x150@2x?access_token=pk.eyJ1IjoibWFwYm94IiwiYSI6ImNpejY4NXVycTA2emYycXBndHRqcmZ3N3gifQ.rJcFIG214AriISLbB6B5aw`}
                      alt="Location"
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        const lat = message.location?.latitude;
                        const lng = message.location?.longitude;
                        if (lat !== undefined && lng !== undefined) {
                          (e.target as HTMLImageElement).src =
                            `https://staticmap.openstreetmap.de/staticmap.php?center=${lat},${lng}&zoom=14&size=250x150&markers=${lat},${lng},red-pushpin`;
                        }
                      }}
                    />
                    {message.location.isLiveLocation && (
                      <div className="absolute top-2 left-2 bg-green-500 text-white text-xs px-2 py-0.5 rounded-full flex items-center gap-1">
                        <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></span>
                        Live
                      </div>
                    )}
                  </div>
                  <div className="p-2 bg-card">
                    <div className="flex items-center gap-2">
                      <MapPin
                        size={14}
                        className={
                          message.location.isLiveLocation ? 'text-green-500' : 'text-red-500'
                        }
                      />
                      <span className="text-sm font-medium">
                        {message.location.isLiveLocation ? 'Live Location' : 'Location'}
                      </span>
                    </div>
                    {message.location.address && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {message.location.address}
                      </p>
                    )}
                    <p className="text-xs text-primary mt-1">Tap to open in Maps</p>
                  </div>
                </a>
              )}

            <p className={`text-xs mt-1 ${message.isSent ? 'opacity-70' : 'opacity-60'}`}>
              {message.timestamp}
              {message.isEdited && !message.isDeleted && (
                <span className="ml-1">(edited)</span>
              )}
            </p>
          </div>
        )}

        {!message.isSent && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="opacity-50 lg:opacity-0 lg:group-hover:opacity-100 p-1 rounded-full hover:bg-muted transition mt-1 cursor-pointer">
                <MoreHorizontal size={16} className="text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem onClick={() => onReply(message)}>
                <Reply size={14} className="mr-2" />
                Reply
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onForward(message)}>
                <Forward size={14} className="mr-2" />
                Forward
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onDeleteForMe(messageIdStr)}>
                <Trash2 size={14} className="mr-2" />
                Delete for me
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </div>
  );
});

export default ChatMessageBubble;
