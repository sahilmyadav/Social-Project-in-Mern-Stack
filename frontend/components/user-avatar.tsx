'use client';

import { getMediaUrl } from '@/lib/media-utils';
import { useRouter } from 'next/navigation';

interface UserAvatarProps {
  user: {
    _id: string;
    firstName?: string;
    lastName?: string;
    fullName?: string;
    name?: string;
    username?: string;
    profilePicture?: string;
    profileImage?: string;
    avatar?: string;
  };
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  showName?: boolean;
  clickable?: boolean;
}

export default function UserAvatar({
  user,
  size = 'md',
  className = '',
  showName = false,
  clickable = true,
}: UserAvatarProps) {
  const router = useRouter();

  const getUserName = () => {
    const name =
      user.fullName ||
      user.name ||
      `${user.firstName || ''} ${user.lastName || ''}`.trim() ||
      user.username ||
      'Unknown User';
    return name || 'Unknown User';
  };

  const getUserAvatar = () => {
    const name = getUserName();
    const rawAvatar = user.profileImage || user.profilePicture || user.avatar;
    if (rawAvatar) {
      return getMediaUrl(rawAvatar);
    }
    return name ? name.charAt(0).toUpperCase() : 'U';
  };

  const sizeClasses = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-12 h-12 text-base',
  };

  const handleUserClick = () => {
    if (clickable && (user.username || user._id)) {
      router.push(`/profile/${user.username || user._id}`);
    }
  };

  const avatarContent = (
    <div
      className={`
        ${sizeClasses[size]}
        rounded-full
        bg-gradient-to-br
        from-primary
        to-secondary
        flex
        items-center
        justify-center
        text-white
        font-bold
        flex-shrink-0
        ${clickable ? 'cursor-pointer hover:ring-2 hover:ring-primary/50 transition' : ''}
        ${className}
      `}
      onClick={handleUserClick}
    >
      {(() => {
        const avatarValue = getUserAvatar();
        const isUrl =
          typeof avatarValue === 'string' &&
          (avatarValue.startsWith('http') || avatarValue.startsWith('/uploads'));

        return isUrl ? (
          <img
            src={avatarValue}
            alt={getUserName()}
            className="w-full h-full rounded-full object-cover"
          />
        ) : (
          <span>{avatarValue}</span>
        );
      })()}
    </div>
  );

  if (showName) {
    return (
      <div className="flex items-center gap-2">
        {avatarContent}
        <span
          className={`font-medium ${clickable ? 'cursor-pointer hover:text-primary transition' : ''}`}
          onClick={handleUserClick}
        >
          {getUserName()}
        </span>
      </div>
    );
  }

  return avatarContent;
}
