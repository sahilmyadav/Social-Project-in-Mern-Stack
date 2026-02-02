'use client';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Smile } from 'lucide-react';
import { useState } from 'react';

// Common emojis organized by category
const EMOJI_CATEGORIES = {
  smileys: [
    '😀',
    '😃',
    '😄',
    '😁',
    '😆',
    '😅',
    '🤣',
    '😂',
    '🙂',
    '😊',
    '😇',
    '🥰',
    '😍',
    '🤩',
    '😘',
    '😗',
    '😚',
    '😙',
    '🥲',
    '😋',
    '😛',
    '😜',
    '🤪',
    '😝',
    '🤑',
    '🤗',
    '🤭',
    '🤫',
    '🤔',
    '🤐',
    '🤨',
    '😐',
    '😑',
    '😶',
    '😏',
    '😒',
    '🙄',
    '😬',
    '🤥',
    '😌',
    '😔',
    '😪',
    '🤤',
    '😴',
    '😷',
    '🤒',
    '🤕',
    '🤢',
    '🤮',
    '🤧',
    '🥵',
    '🥶',
    '🥴',
    '😵',
    '🤯',
    '🤠',
    '🥳',
    '🥸',
    '😎',
    '🤓',
    '🧐',
  ],
  hearts: [
    '❤️',
    '🧡',
    '💛',
    '💚',
    '💙',
    '💜',
    '🖤',
    '🤍',
    '🤎',
    '💔',
    '❤️‍🔥',
    '❤️‍🩹',
    '💕',
    '💞',
    '💓',
    '💗',
    '💖',
    '💘',
    '💝',
    '💟',
  ],
  gestures: [
    '👍',
    '👎',
    '👌',
    '🤌',
    '🤏',
    '✌️',
    '🤞',
    '🤟',
    '🤘',
    '🤙',
    '👈',
    '👉',
    '👆',
    '👇',
    '☝️',
    '👋',
    '🤚',
    '🖐️',
    '✋',
    '🖖',
    '👏',
    '🙌',
    '🤝',
    '🙏',
    '💪',
    '🦾',
    '🦿',
  ],
  faces: [
    '😈',
    '👿',
    '💀',
    '☠️',
    '💩',
    '🤡',
    '👹',
    '👺',
    '👻',
    '👽',
    '👾',
    '🤖',
    '🎃',
    '😺',
    '😸',
    '😹',
    '😻',
    '😼',
    '😽',
    '🙀',
    '😿',
    '😾',
  ],
  animals: [
    '🐶',
    '🐱',
    '🐭',
    '🐹',
    '🐰',
    '🦊',
    '🐻',
    '🐼',
    '🐨',
    '🐯',
    '🦁',
    '🐮',
    '🐷',
    '🐸',
    '🐵',
    '🐔',
    '🐧',
    '🐦',
    '🦆',
    '🦅',
    '🦉',
    '🦇',
    '🐺',
    '🐗',
    '🐴',
    '🦄',
    '🐝',
    '🐛',
    '🦋',
    '🐌',
    '🐞',
  ],
  objects: [
    '🔥',
    '✨',
    '🌟',
    '💫',
    '⭐',
    '🌈',
    '☀️',
    '🌙',
    '💯',
    '💢',
    '💥',
    '💦',
    '💨',
    '🎉',
    '🎊',
    '🎈',
    '🎁',
    '🏆',
    '🥇',
    '🎵',
    '🎶',
    '📱',
    '💻',
    '📸',
    '🎬',
    '📚',
    '✏️',
    '💡',
    '🔔',
    '📌',
  ],
};

// Quick reaction emojis (shown in a row for fast access)
const QUICK_REACTIONS = ['❤️', '😂', '😮', '😢', '😡', '👍', '👎', '🔥', '💯', '🙏'];

interface EmojiPickerProps {
  onEmojiSelect: (emoji: string) => void;
  showQuickReactions?: boolean;
  triggerClassName?: string;
}

export default function EmojiPicker({
  onEmojiSelect,
  showQuickReactions = true,
  triggerClassName = '',
}: EmojiPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState<keyof typeof EMOJI_CATEGORIES>('smileys');

  const handleEmojiClick = (emoji: string) => {
    onEmojiSelect(emoji);
    setIsOpen(false);
  };

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={`p-2 rounded-full hover:bg-muted transition text-muted-foreground hover:text-foreground ${triggerClassName}`}
          title="Add emoji"
        >
          <Smile size={20} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-80 p-0" align="end" side="top" sideOffset={8}>
        <div className="flex flex-col max-h-80" onClick={(e) => e.stopPropagation()}>
          {/* Quick Reactions */}
          {showQuickReactions && (
            <div className="p-2 border-b border-border">
              <p className="text-xs text-muted-foreground mb-2 px-1">Quick Reactions</p>
              <div className="flex gap-1 justify-between">
                {QUICK_REACTIONS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => handleEmojiClick(emoji)}
                    className="text-xl p-1 hover:bg-muted rounded transition hover:scale-125"
                    title={emoji}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Category Tabs */}
          <div className="flex gap-1 p-2 border-b border-border overflow-x-auto">
            {Object.keys(EMOJI_CATEGORIES).map((category) => (
              <button
                key={category}
                type="button"
                onClick={() => setActiveCategory(category as keyof typeof EMOJI_CATEGORIES)}
                className={`px-2 py-1 text-xs rounded capitalize whitespace-nowrap transition ${
                  activeCategory === category
                    ? 'bg-primary text-primary-foreground'
                    : 'hover:bg-muted text-muted-foreground'
                }`}
              >
                {category}
              </button>
            ))}
          </div>

          {/* Emoji Grid */}
          <div className="p-2 overflow-y-auto max-h-48">
            <div className="grid grid-cols-8 gap-1">
              {EMOJI_CATEGORIES[activeCategory].map((emoji, index) => (
                <button
                  key={`${emoji}-${index}`}
                  type="button"
                  onClick={() => handleEmojiClick(emoji)}
                  className="text-xl p-1.5 hover:bg-muted rounded transition hover:scale-110"
                  title={emoji}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// Compact emoji reactions for comments (inline reactions)
interface CommentReactionsProps {
  commentId: string;
  onReact: (commentId: string, emoji: string) => void;
  existingReactions?: { emoji: string; count: number; userReacted: boolean }[];
}

export function CommentReactions({
  commentId,
  onReact,
  existingReactions = [],
}: CommentReactionsProps) {
  const [showPicker, setShowPicker] = useState(false);

  const handleReaction = (emoji: string) => {
    onReact(commentId, emoji);
    setShowPicker(false);
  };

  return (
    <div className="flex items-center gap-1">
      {/* Existing reactions */}
      {existingReactions.map((reaction) => (
        <button
          key={reaction.emoji}
          onClick={() => handleReaction(reaction.emoji)}
          className={`flex items-center gap-0.5 text-xs px-1.5 py-0.5 rounded-full border transition ${
            reaction.userReacted
              ? 'border-primary bg-primary/10 text-primary'
              : 'border-border hover:bg-muted'
          }`}
        >
          <span>{reaction.emoji}</span>
          {reaction.count > 0 && <span>{reaction.count}</span>}
        </button>
      ))}

      {/* Add reaction button */}
      <DropdownMenu open={showPicker} onOpenChange={setShowPicker}>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="text-xs text-muted-foreground hover:text-primary transition px-1.5 py-0.5 rounded-full hover:bg-muted"
            title="Add reaction"
          >
            <Smile size={14} />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-auto p-2" align="start" side="top" sideOffset={4}>
          <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
            {QUICK_REACTIONS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => handleReaction(emoji)}
                className="text-lg p-1 hover:bg-muted rounded transition hover:scale-125"
              >
                {emoji}
              </button>
            ))}
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
