'use client';

import { ProfileImageEditor } from '@/components/profile-image-editor';
import { Button } from '@/components/ui/button';
import { ApiError } from '@/lib/api-client';
import { authService } from '@/lib/api-services';
import {
  Bookmark,
  Camera,
  Check,
  Heart,
  Image as ImageIcon,
  Loader2,
  MessageCircle,
  Play,
  RotateCcw,
  Send,
  Sparkles,
  User,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

// Debounce hook
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

export default function SetupProfilePage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [profilePicture, setProfilePicture] = useState<File | null>(null);
  const [profilePreview, setProfilePreview] = useState<string>('');
  const [coverPhoto, setCoverPhoto] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string>('');

  const [usernameStatus, setUsernameStatus] = useState<
    'idle' | 'checking' | 'available' | 'taken' | 'invalid'
  >('idle');
  const [usernameMessage, setUsernameMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentImage, setCurrentImage] = useState(0);
  const [userFullName, setUserFullName] = useState({ firstName: '', lastName: '' });
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  // Image editor states
  const [showImageEditor, setShowImageEditor] = useState(false);
  const [editorImageFile, setEditorImageFile] = useState<File | null>(null);
  const [editorType, setEditorType] = useState<'profile' | 'cover'>('profile');

  // Interests state
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [showAllInterests, setShowAllInterests] = useState(false);

  // All interests mixed together
  const allInterests = [
    'Photography',
    'Travel',
    'Music',
    'Fitness',
    'Gaming',
    'Movies',
    'Food',
    'Art',
    'Technology',
    'Fashion',
    'Dance',
    'Pets',
    'Books',
    'Coding',
    'Sports',
    'Nature',
    'Beauty',
    'Comedy',
    'Science',
    'DIY',
    'Yoga',
    'Cooking',
    'Writing',
    'Design',
    'Anime',
    'Crypto',
    'Startups',
    'Running',
    'Theatre',
    'Space',
  ];

  const toggleInterest = (interest: string) => {
    setSelectedInterests((prev) =>
      prev.includes(interest)
        ? prev.filter((i) => i !== interest)
        : prev.length < 10
          ? [...prev, interest]
          : prev
    );
  };

  // File input refs for direct access
  const profileInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  const images = [
    '/Landing/cat.jpeg',
    '/Landing/panda.jpeg',
    '/Landing/capads.jpeg',
    '/Landing/Republic%20day.jpeg',
  ];

  // Generate username patterns based on input text or full name
  const generateUsernamePatterns = (
    input: string,
    firstName?: string,
    lastName?: string
  ): string[] => {
    const cleanInput = input.toLowerCase().replace(/[^a-z0-9]/g, '');
    const first = (firstName || '').toLowerCase().replace(/[^a-z]/g, '');
    const last = (lastName || '').toLowerCase().replace(/[^a-z]/g, '');
    const randomNum = () => Math.floor(Math.random() * 999);
    const randomNum2 = () => Math.floor(Math.random() * 99);
    const year = new Date().getFullYear().toString().slice(-2);
    const birthYears = ['00', '01', '02', '03', '04', '05', '99', '98', '97', '96', '95'];
    const randomYear = birthYears[Math.floor(Math.random() * birthYears.length)];

    const patterns: string[] = [];

    // If user is typing something, generate based on their input
    if (cleanInput.length >= 2) {
      patterns.push(
        `${cleanInput}`,
        `${cleanInput}${randomNum2()}`,
        `${cleanInput}_`,
        `_${cleanInput}`,
        `${cleanInput}${randomNum()}`,
        `${cleanInput}${year}`,
        `${cleanInput}${randomYear}`,
        `${cleanInput}_official`,
        `the_${cleanInput}`,
        `its_${cleanInput}`,
        `${cleanInput}x`,
        `${cleanInput}y`,
        `real_${cleanInput}`,
        `${cleanInput}_real`,
        `i_am_${cleanInput}`,
        `${cleanInput}ly`,
        `${cleanInput}ish`,
        `${cleanInput}vibes`,
        `${cleanInput}world`
      );
    }

    // If we have first and last name, add those patterns too
    if (first && last) {
      patterns.push(
        `${first}${last}`,
        `${first}_${last}`,
        `${first}.${last}`,
        `${first}${last}${randomNum2()}`,
        `${first}_${last}${randomNum2()}`,
        `${last}${first}`,
        `${first}${year}`,
        `${first}${randomYear}`,
        `${first[0]}${last}`,
        `${first}${last[0]}`,
        `${first[0]}${last}${randomNum2()}`,
        `${first}${last[0]}${randomNum2()}`,
        `the${first}${last}`,
        `its${first}`,
        `${first}_official`,
        `real${first}`,
        `${first}x${last}`,
        `${first}vibes`
      );
    } else if (first) {
      patterns.push(
        `${first}${randomNum2()}`,
        `${first}${randomNum()}`,
        `${first}${year}`,
        `${first}${randomYear}`,
        `the_${first}`,
        `its_${first}`,
        `${first}_official`,
        `real_${first}`,
        `${first}vibes`,
        `${first}world`
      );
    }

    // Filter valid usernames and remove duplicates
    return [
      ...new Set(
        patterns
          .map((s) => s.replace(/[^a-z0-9_]/g, ''))
          .filter((s) => s.length >= 3 && s.length <= 30 && /^[a-z0-9_]+$/.test(s))
      ),
    ];
  };

  // Check if a username is available
  const checkUsernameAvailability = async (usernameToCheck: string): Promise<boolean> => {
    try {
      const response = await authService.checkUsername(usernameToCheck);
      return response.success && response.data?.available === true;
    } catch {
      return false;
    }
  };

  // Generate and check available suggestions - can be based on input or name
  const generateAvailableSuggestions = async (
    input?: string,
    firstName?: string,
    lastName?: string
  ) => {
    setLoadingSuggestions(true);
    const patterns = generateUsernamePatterns(input || '', firstName, lastName);
    const availableSuggestions: string[] = [];

    // Shuffle patterns for variety
    const shuffled = patterns.sort(() => Math.random() - 0.5);

    // Check patterns until we have 5 available ones
    for (const pattern of shuffled) {
      if (availableSuggestions.length >= 5) break;

      const isAvailable = await checkUsernameAvailability(pattern);
      if (isAvailable) {
        availableSuggestions.push(pattern);
      }
    }

    setSuggestions(availableSuggestions);
    setLoadingSuggestions(false);
    setShowSuggestions(true);

    // Auto-fill the first suggestion if username is empty
    if (!input && availableSuggestions.length > 0 && !username) {
      setUsername(availableSuggestions[0]);
    }
  };

  // Load user data and generate suggestions on mount
  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (userData) {
      try {
        const user = JSON.parse(userData);
        if (user.firstName || user.lastName) {
          setUserFullName({ firstName: user.firstName || '', lastName: user.lastName || '' });
          generateAvailableSuggestions('', user.firstName || '', user.lastName || '');
        }
      } catch (e) {
        // Ignore parse errors
      }
    }
  }, []);

  // Generate suggestions based on what user types (after they stop typing)
  const debouncedUsernameForSuggestions = useDebounce(username, 800);

  useEffect(() => {
    if (debouncedUsernameForSuggestions && debouncedUsernameForSuggestions.length >= 2) {
      generateAvailableSuggestions(
        debouncedUsernameForSuggestions,
        userFullName.firstName,
        userFullName.lastName
      );
    }
  }, [debouncedUsernameForSuggestions]);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentImage((prev) => (prev + 1) % images.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const debouncedUsername = useDebounce(username, 500);

  // Check username availability
  useEffect(() => {
    const checkUsername = async () => {
      if (!debouncedUsername) {
        setUsernameStatus('idle');
        setUsernameMessage('');
        return;
      }

      // Validate format
      const usernameRegex = /^[a-zA-Z0-9_]{3,30}$/;
      if (!usernameRegex.test(debouncedUsername)) {
        setUsernameStatus('invalid');
        setUsernameMessage('Username must be 3-30 characters (letters, numbers, underscores only)');
        return;
      }

      setUsernameStatus('checking');
      try {
        const response = await authService.checkUsername(debouncedUsername);
        if (response.success && response.data) {
          if (response.data.available) {
            setUsernameStatus('available');
            setUsernameMessage('Username is available!');
          } else {
            setUsernameStatus('taken');
            setUsernameMessage('Username is already taken');
          }
        }
      } catch (err) {
        setUsernameStatus('invalid');
        setUsernameMessage('Error checking username');
      }
    };

    checkUsername();
  }, [debouncedUsername]);

  const handleProfilePictureChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Profile picture must be less than 5MB');
        return;
      }
      // Open image editor instead of directly setting
      setEditorImageFile(file);
      setEditorType('profile');
      setShowImageEditor(true);
    }
  };

  const handleCoverPhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        toast.error('Cover photo must be less than 10MB');
        return;
      }
      // Open image editor instead of directly setting
      setEditorImageFile(file);
      setEditorType('cover');
      setShowImageEditor(true);
    }
  };

  // Handle save from image editor
  const handleImageEditorSave = (blob: Blob, previewUrl: string) => {
    const file = new File([blob], `${editorType}-photo.jpg`, { type: 'image/jpeg' });

    if (editorType === 'profile') {
      setProfilePicture(file);
      setProfilePreview(previewUrl);
      toast.success('Profile photo updated!');
    } else {
      setCoverPhoto(file);
      setCoverPreview(previewUrl);
      toast.success('Cover photo updated!');
    }
  };

  const removeCoverPhoto = () => {
    setCoverPhoto(null);
    setCoverPreview('');
    toast.success('Cover photo removed');
  };

  const removeProfilePicture = () => {
    setProfilePicture(null);
    setProfilePreview('');
    toast.success('Profile picture removed');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!username.trim()) {
      toast.error('Username is required');
      return;
    }

    if (usernameStatus !== 'available') {
      toast.error('Please choose an available username');
      return;
    }

    // Check if user is logged in (has accessToken)
    const accessToken = localStorage.getItem('accessToken');
    if (!accessToken) {
      toast.error('Session expired. Please login again.');
      router.push('/login');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await authService.completeProfile({
        username: username.trim(),
        bio: bio.trim(),
        profilePicture: profilePicture || undefined,
        coverPhoto: coverPhoto || undefined,
        interests: selectedInterests.length > 0 ? selectedInterests : undefined,
      });

      if (response.success && response.data) {
        // Update user data in localStorage (keep existing tokens)
        if (response.data.accessToken) {
          localStorage.setItem('accessToken', response.data.accessToken);
        }
        if (response.data.refreshToken) {
          localStorage.setItem('refreshToken', response.data.refreshToken);
        }
        if (response.data.user) {
          localStorage.setItem('user', JSON.stringify(response.data.user));
        }
        toast.success('Profile completed successfully!');
        router.push('/home');
      } else {
        toast.error(response.message || 'Failed to complete profile');
      }
    } catch (err) {
      const apiError = err as ApiError;
      if (apiError.statusCode === 409) {
        toast.error(apiError.message || 'This email may already be in use.');
      } else {
        toast.error(apiError.message || 'An error occurred. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      {/* Profile Image Editor Modal - WhatsApp/Instagram/Telegram style */}
      <ProfileImageEditor
        isOpen={showImageEditor}
        onClose={() => {
          setShowImageEditor(false);
          setEditorImageFile(null);
        }}
        imageFile={editorImageFile}
        type={editorType}
        onSave={handleImageEditorSave}
        enableFaceDetection={true}
        coverAspectRatio={2.5}
      />

      <main className="min-h-screen bg-gray-50 dark:bg-black flex">
        {/* Left Side - Phone Mockup */}
        <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-gradient-to-br from-gray-900 via-gray-800 to-black items-center justify-center">
          {/* Background Pattern */}
          <div className="absolute inset-0 opacity-30">
            <div className="absolute top-20 left-20 w-72 h-72 bg-purple-500 rounded-full blur-[120px]"></div>
            <div className="absolute bottom-20 right-20 w-72 h-72 bg-pink-500 rounded-full blur-[120px]"></div>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-orange-500 rounded-full blur-[150px]"></div>
          </div>

          {/* Logo */}
          <Link href="/" className="absolute top-8 left-8 flex items-center gap-2 z-20">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-600 via-pink-500 to-orange-400 flex items-center justify-center">
              <Camera className="w-6 h-6 text-white" />
            </div>
            <span className="text-2xl font-bold text-white">ClickME</span>
          </Link>

          {/* Phone Mockup */}
          <div className="relative z-10">
            <div className="relative w-[320px] h-[650px] bg-gray-900 rounded-[3rem] p-2 shadow-2xl border border-gray-700">
              {/* Notch */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-8 bg-gray-900 rounded-b-2xl z-20"></div>

              {/* Screen */}
              <div className="w-full h-full bg-black rounded-[2.5rem] overflow-hidden flex flex-col">
                {/* Status Bar */}
                <div className="h-10 flex items-end justify-between px-6 pb-1 text-white text-xs flex-shrink-0">
                  <span className="font-medium">9:41</span>
                  <div className="flex gap-1 items-center">
                    <div className="flex gap-0.5">
                      <div className="w-1 h-1 bg-white rounded-full"></div>
                      <div className="w-1 h-1 bg-white rounded-full"></div>
                      <div className="w-1 h-1 bg-white rounded-full"></div>
                      <div className="w-1 h-1 bg-white/50 rounded-full"></div>
                    </div>
                    <svg className="w-4 h-4" fill="white" viewBox="0 0 24 24">
                      <rect
                        x="2"
                        y="7"
                        width="18"
                        height="10"
                        rx="2"
                        stroke="white"
                        strokeWidth="2"
                        fill="none"
                      />
                      <rect x="20" y="10" width="2" height="4" rx="1" fill="white" />
                    </svg>
                  </div>
                </div>

                {/* App Header */}
                <div className="px-4 py-2 flex items-center justify-between border-b border-gray-800 flex-shrink-0">
                  <span className="text-white font-semibold text-lg">ClickME</span>
                  <div className="flex gap-4">
                    <Heart className="w-5 h-5 text-white" />
                    <Send className="w-5 h-5 text-white" />
                  </div>
                </div>

                {/* Post Content */}
                <div className="flex-1 overflow-hidden">
                  {/* User Header */}
                  <div className="px-4 py-3 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400 p-0.5">
                      <div className="w-full h-full rounded-full bg-gray-800 flex items-center justify-center">
                        <span className="text-white text-xs">U</span>
                      </div>
                    </div>
                    <div>
                      <p className="text-white text-sm font-semibold">clickme_user</p>
                      <p className="text-gray-400 text-xs">Sponsored</p>
                    </div>
                  </div>

                  {/* Image Carousel */}
                  <div className="relative aspect-square bg-gray-800">
                    {images.map((img, index) => (
                      <img
                        key={index}
                        src={img}
                        alt={`Post ${index + 1}`}
                        className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ${
                          currentImage === index ? 'opacity-100' : 'opacity-0'
                        }`}
                      />
                    ))}
                    {/* Play Button Overlay */}
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-16 h-16 rounded-full bg-black/30 flex items-center justify-center backdrop-blur-sm">
                        <Play className="w-8 h-8 text-white fill-white" />
                      </div>
                    </div>
                    {/* Carousel Dots */}
                    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1">
                      {images.map((_, i) => (
                        <div
                          key={i}
                          className={`w-1.5 h-1.5 rounded-full transition-colors ${
                            currentImage === i ? 'bg-blue-500' : 'bg-white/50'
                          }`}
                        ></div>
                      ))}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="px-4 py-3 flex items-center justify-between">
                    <div className="flex gap-4">
                      <Heart className="w-6 h-6 text-white" />
                      <MessageCircle className="w-6 h-6 text-white" />
                      <Send className="w-6 h-6 text-white" />
                    </div>
                    <Bookmark className="w-6 h-6 text-white" />
                  </div>

                  {/* Likes */}
                  <div className="px-4 pb-2">
                    <p className="text-white text-sm font-semibold">1,234 likes</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side - Profile Setup Form */}
        <div className="w-full lg:w-1/2 flex items-center justify-center p-4 lg:p-8 overflow-y-auto">
          <div className="w-full max-w-lg">
            {/* Mobile Logo */}
            <div className="lg:hidden text-center mb-6">
              <Link href="/" className="inline-flex items-center gap-2">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-600 via-pink-500 to-orange-400 flex items-center justify-center">
                  <Camera className="w-7 h-7 text-white" />
                </div>
                <span className="text-3xl font-bold text-gray-900 dark:text-white">ClickME</span>
              </Link>
            </div>

            {/* Profile Card */}
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-xl overflow-hidden">
              {/* Cover Photo Section - Click to Upload */}
              <div
                className="relative h-36 sm:h-44 bg-gradient-to-r from-purple-500 via-pink-500 to-orange-400 group cursor-pointer"
                onClick={() => coverInputRef.current?.click()}
              >
                {/* Hidden file input */}
                <input
                  ref={coverInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleCoverPhotoChange}
                  className="hidden"
                />

                {coverPreview ? (
                  <img src={coverPreview} alt="Cover" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center gap-2">
                    <ImageIcon className="w-10 h-10 text-white/40" />
                    <span className="text-white/60 text-sm font-medium">
                      Click to add cover photo
                    </span>
                  </div>
                )}

                {/* Hover Overlay */}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all duration-300 flex items-center justify-center pointer-events-none">
                  <div className="opacity-0 group-hover:opacity-100 transition-all duration-300 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-lg px-4 py-2 flex items-center gap-2 shadow-lg">
                    <Camera className="w-4 h-4 text-gray-700 dark:text-gray-300" />
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      {coverPreview ? 'Change cover' : 'Add cover'}
                    </span>
                  </div>
                </div>

                {/* Remove button (only when cover exists) */}
                {coverPreview && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeCoverPhoto();
                    }}
                    className="absolute top-3 right-3 bg-red-500/90 hover:bg-red-600 backdrop-blur-sm rounded-full p-2 shadow-lg transition-all opacity-0 group-hover:opacity-100"
                    title="Remove cover"
                  >
                    <X className="w-4 h-4 text-white" />
                  </button>
                )}

                {/* Camera icon button */}
                <div className="absolute bottom-3 right-3 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-full p-2.5 shadow-lg pointer-events-none">
                  <Camera className="w-4 h-4 text-gray-700 dark:text-gray-300" />
                </div>
              </div>

              {/* Profile Picture - Click to Upload */}
              <div className="relative px-6 -mt-14 mb-4">
                <div className="relative inline-block">
                  {/* Hidden file input */}
                  <input
                    ref={profileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleProfilePictureChange}
                    className="hidden"
                  />

                  {/* Profile Image - Click to open file picker */}
                  <div
                    className="w-28 h-28 rounded-full border-4 border-white dark:border-gray-900 bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400 overflow-hidden shadow-xl cursor-pointer group"
                    onClick={() => profileInputRef.current?.click()}
                  >
                    {profilePreview ? (
                      <>
                        <img
                          src={profilePreview}
                          alt="Profile"
                          className="w-full h-full object-cover"
                        />
                        {/* Hover overlay for profile */}
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all duration-300 flex items-center justify-center rounded-full">
                          <Camera className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      </>
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center group-hover:bg-white/10 transition-colors">
                        <User className="w-10 h-10 text-white" />
                        <span className="text-white/80 text-[10px] font-medium mt-1">
                          Add photo
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Camera Badge - Also triggers file picker */}
                  <button
                    type="button"
                    onClick={() => profileInputRef.current?.click()}
                    className="absolute bottom-1 right-1 bg-gradient-to-r from-purple-600 to-pink-500 rounded-full p-2.5 shadow-lg cursor-pointer hover:scale-110 transition-transform ring-2 ring-white dark:ring-gray-900"
                  >
                    <Camera className="w-3.5 h-3.5 text-white" />
                  </button>

                  {/* Remove button (only when profile exists) */}
                  {profilePreview && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeProfilePicture();
                      }}
                      className="absolute -top-1 -right-1 bg-red-500 hover:bg-red-600 rounded-full p-1.5 shadow-lg transition-all ring-2 ring-white dark:ring-gray-900"
                      title="Remove profile picture"
                    >
                      <X className="w-3 h-3 text-white" />
                    </button>
                  )}
                </div>

                {/* Helper text */}
                <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
                  Click to add or change photo
                </p>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit} className="px-6 pb-6 space-y-5">
                {/* Username */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Username <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Choose a unique username"
                      value={username}
                      onChange={(e) => {
                        setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''));
                        setShowSuggestions(false);
                      }}
                      maxLength={30}
                      required
                      className="w-full h-11 px-4 pr-10 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 outline-none transition-all"
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      {usernameStatus === 'checking' && (
                        <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
                      )}
                      {usernameStatus === 'available' && (
                        <Check className="w-5 h-5 text-green-500" />
                      )}
                      {usernameStatus === 'taken' && <X className="w-5 h-5 text-red-500" />}
                      {usernameStatus === 'invalid' && <X className="w-5 h-5 text-orange-500" />}
                    </div>
                  </div>
                  {usernameMessage && (
                    <p
                      className={`text-xs mt-1 ${
                        usernameStatus === 'available'
                          ? 'text-green-600 dark:text-green-400'
                          : usernameStatus === 'taken'
                            ? 'text-red-600 dark:text-red-400'
                            : 'text-orange-600 dark:text-orange-400'
                      }`}
                    >
                      {usernameMessage}
                    </p>
                  )}

                  {/* Username Suggestions - Always visible */}
                  {showSuggestions && (suggestions.length > 0 || loadingSuggestions) && (
                    <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs font-medium text-gray-600 dark:text-gray-400">
                          {username ? `Suggestions for "${username}"` : 'Suggested usernames'}
                        </p>
                        {!loadingSuggestions && (
                          <button
                            type="button"
                            onClick={() =>
                              generateAvailableSuggestions(
                                username,
                                userFullName.firstName,
                                userFullName.lastName
                              )
                            }
                            className="text-xs text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1"
                          >
                            <RotateCcw className="w-3 h-3" />
                            Refresh
                          </button>
                        )}
                      </div>
                      {loadingSuggestions ? (
                        <div className="flex items-center gap-2 py-2">
                          <Loader2 className="w-4 h-4 text-purple-500 animate-spin" />
                          <span className="text-xs text-gray-500">
                            Finding available usernames...
                          </span>
                        </div>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {suggestions.map((suggestion, index) => (
                            <button
                              key={index}
                              type="button"
                              onClick={() => {
                                setUsername(suggestion);
                                setShowSuggestions(false);
                              }}
                              className="px-3 py-1.5 text-sm bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-full text-gray-700 dark:text-gray-300 hover:border-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/20 hover:text-purple-600 dark:hover:text-purple-400 transition-all flex items-center gap-1.5"
                            >
                              <Check className="w-3 h-3 text-green-500" />
                              {suggestion}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Show suggestions button when hidden */}
                  {!showSuggestions && (
                    <button
                      type="button"
                      onClick={() => {
                        generateAvailableSuggestions(
                          username,
                          userFullName.firstName,
                          userFullName.lastName
                        );
                      }}
                      className="text-xs text-purple-600 dark:text-purple-400 hover:underline mt-2 flex items-center gap-1"
                    >
                      <Check className="w-3 h-3" />
                      Show username suggestions
                    </button>
                  )}
                </div>

                {/* Bio */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Bio <span className="text-gray-400 font-normal">(Optional)</span>
                  </label>
                  <textarea
                    placeholder="Tell us about yourself..."
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    maxLength={150}
                    rows={3}
                    className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-xl resize-none text-gray-900 dark:text-white focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 outline-none transition-all"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {bio.length}/150 characters
                  </p>
                </div>

                {/* Interests Section */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">
                      <span className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-purple-500" />
                        Your Interests <span className="text-gray-400 font-normal">(Optional)</span>
                      </span>
                    </label>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {selectedInterests.length}/10 selected
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                    {selectedInterests.length > 0 ? (
                      <>
                        Your interests:{' '}
                        <span className="text-purple-600 dark:text-purple-400 font-medium">
                          {selectedInterests.join(', ')}
                        </span>
                      </>
                    ) : (
                      'Select topics to connect with people who share your passions'
                    )}
                  </p>
                  {selectedInterests.length > 1 && (
                    <p className="text-xs text-green-600 dark:text-green-400 mb-3 flex items-center gap-1">
                      <Check className="w-3 h-3" />
                      Great choices! You'll connect with others who love{' '}
                      {selectedInterests.slice(0, 2).join(' & ')}
                    </p>
                  )}

                  {/* Interests - Mixed Grid */}
                  <div className="flex flex-wrap gap-2">
                    {(showAllInterests ? allInterests : allInterests.slice(0, 5)).map(
                      (interest) => {
                        const isSelected = selectedInterests.includes(interest);
                        return (
                          <button
                            key={interest}
                            type="button"
                            onClick={() => toggleInterest(interest)}
                            disabled={!isSelected && selectedInterests.length >= 10}
                            className={`px-3 py-1.5 text-sm rounded-full border transition-all ${
                              isSelected
                                ? 'bg-gradient-to-r from-purple-600 to-pink-500 text-white border-transparent shadow-sm'
                                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/20'
                            } ${!isSelected && selectedInterests.length >= 10 ? 'opacity-50 cursor-not-allowed' : ''}`}
                          >
                            {isSelected && <Check className="w-3 h-3 inline mr-1" />}
                            {interest}
                          </button>
                        );
                      }
                    )}
                  </div>

                  {/* Show More/Less Button */}
                  {allInterests.length > 5 && (
                    <button
                      type="button"
                      onClick={() => setShowAllInterests(!showAllInterests)}
                      className="mt-3 text-sm text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1"
                    >
                      {showAllInterests ? (
                        <>Show less</>
                      ) : (
                        <>Show more ({allInterests.length - 5} more)</>
                      )}
                    </button>
                  )}
                </div>

                {/* Submit Button */}
                <Button
                  type="submit"
                  disabled={isSubmitting || usernameStatus !== 'available'}
                  className="w-full h-12 bg-gradient-to-r from-purple-600 via-pink-500 to-orange-400 hover:from-purple-700 hover:via-pink-600 hover:to-orange-500 text-white font-semibold rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Creating Account...
                    </span>
                  ) : (
                    'Complete Profile'
                  )}
                </Button>
              </form>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
