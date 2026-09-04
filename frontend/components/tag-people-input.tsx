'use client';

import { searchService } from '@/lib/api-services';
import { X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

interface TaggedUser {
  _id: string;
  firstName: string;
  lastName: string;
  username?: string;
  profileImage?: string;
  avatar?: string;
}

interface TagPeopleInputProps {
  selectedUsers: TaggedUser[];
  onUsersChange: (users: TaggedUser[]) => void;
  disabled?: boolean;
  maxTags?: number;
}

export default function TagPeopleInput({
  selectedUsers,
  onUsersChange,
  disabled = false,
  maxTags = 10,
}: TagPeopleInputProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<TaggedUser[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const searchUsers = async () => {
      if (searchQuery.trim().length < 2) {
        setSearchResults([]);
        return;
      }

      setIsSearching(true);
      try {
        const response = await searchService.searchUsers({
          query: searchQuery.trim(),
          limit: 10,
        });

        if (response.success && response.data?.users) {
          const filtered = response.data.users.filter(
            (user: TaggedUser) => !selectedUsers.some((selected) => selected._id === user._id)
          );
          setSearchResults(filtered);
        }
      } catch (error) {
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    };

    const timer = setTimeout(searchUsers, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, selectedUsers]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectUser = (user: TaggedUser) => {
    if (selectedUsers.length >= maxTags) {
      return; // Don't add more than max
    }
    onUsersChange([...selectedUsers, user]);
    setSearchQuery('');
    setSearchResults([]);
    setShowDropdown(false);
  };

  const handleRemoveUser = (userId: string) => {
    onUsersChange(selectedUsers.filter((user) => user._id !== userId));
  };

  const getDisplayName = (user: TaggedUser) => {
    if (user.username) return `@${user.username}`;
    return `${user.firstName} ${user.lastName}`;
  };

  const getProfileImage = (user: TaggedUser) => {
    return user.profileImage || user.avatar;
  };

  return (
    <div className="space-y-2">
      <label className="text-foreground font-semibold block text-sm md:text-base">
        Tag People <span className="text-muted-foreground font-normal">(optional)</span>
      </label>

      {selectedUsers.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selectedUsers.map((user) => (
            <div
              key={user._id}
              className="flex items-center gap-1 bg-primary/10 text-primary rounded-full pl-1 pr-1.5 py-0.5"
            >
              <div className="w-5 h-5 rounded-full bg-muted overflow-hidden flex items-center justify-center">
                {getProfileImage(user) ? (
                  <img
                    src={getProfileImage(user)}
                    alt={user.firstName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-[10px]">👤</span>
                )}
              </div>
              <span className="text-xs font-medium">{getDisplayName(user)}</span>
              <button
                type="button"
                onClick={() => handleRemoveUser(user._id)}
                className="hover:bg-primary/20 rounded-full p-0.5 transition"
                disabled={disabled}
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      {selectedUsers.length < maxTags && (
        <div className="relative">
          <input
            ref={inputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setShowDropdown(true);
            }}
            onFocus={() => setShowDropdown(true)}
            placeholder="Search people to tag..."
            className="w-full p-2 md:p-3 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-background text-foreground text-sm"
            disabled={disabled}
          />

          {showDropdown && (searchResults.length > 0 || isSearching) && (
            <div
              ref={dropdownRef}
              className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-lg z-50 max-h-48 overflow-y-auto"
            >
              {isSearching ? (
                <div className="p-2 text-center text-muted-foreground text-sm">
                  <span className="animate-pulse">Searching...</span>
                </div>
              ) : (
                searchResults.map((user) => (
                  <button
                    key={user._id}
                    type="button"
                    onClick={() => handleSelectUser(user)}
                    className="w-full flex items-center gap-2 p-2 hover:bg-muted transition text-left"
                  >
                    <div className="w-8 h-8 rounded-full bg-muted overflow-hidden flex items-center justify-center flex-shrink-0">
                      {getProfileImage(user) ? (
                        <img
                          src={getProfileImage(user)}
                          alt={user.firstName}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-sm">👤</span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-foreground truncate text-sm">
                        {user.firstName} {user.lastName}
                      </p>
                      {user.username && (
                        <p className="text-xs text-muted-foreground truncate">@{user.username}</p>
                      )}
                    </div>
                  </button>
                ))
              )}
            </div>
          )}

          {showDropdown &&
            searchQuery.trim().length >= 2 &&
            !isSearching &&
            searchResults.length === 0 && (
              <div
                ref={dropdownRef}
                className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-lg z-50"
              >
                <div className="p-2 text-center text-muted-foreground text-sm">No users found</div>
              </div>
            )}
        </div>
      )}

      <p className="text-[10px] md:text-xs text-muted-foreground">
        Tagged people get notified
        {selectedUsers.length > 0 && ` (${selectedUsers.length}/${maxTags})`}
      </p>
    </div>
  );
}
