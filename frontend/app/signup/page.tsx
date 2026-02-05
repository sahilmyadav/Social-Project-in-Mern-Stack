'use client';

import type React from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ApiError } from '@/lib/api-client';
import { authService } from '@/lib/api-services';
import {
  Bookmark,
  Camera,
  ChevronDown,
  Eye,
  EyeOff,
  Heart,
  MessageCircle,
  Play,
  Send,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

export default function SignupPage() {
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    gender: '',
    birthday: '',
  });
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState({ score: 0, label: '', color: '' });
  const [currentImage, setCurrentImage] = useState(0);
  const [genderDropdownOpen, setGenderDropdownOpen] = useState(false);
  const genderDropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const genderOptions = [
    { value: 'male', label: 'Male' },
    { value: 'female', label: 'Female' },
    { value: 'other', label: 'Other' },
    { value: 'prefer_not_to_say', label: 'Prefer not to say' },
  ];

  const images = [
    '/Landing/cat.jpeg',
    '/Landing/panda.jpeg',
    '/Landing/capads.jpeg',
    '/Landing/Republic%20day.jpeg',
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentImage((prev) => (prev + 1) % images.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  // Close gender dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (genderDropdownRef.current && !genderDropdownRef.current.contains(event.target as Node)) {
        setGenderDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // Calculate age from birthday
  const calculateAge = (birthday: string): number => {
    const birthDate = new Date(birthday);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  // Get max date for 16+ restriction
  const getMaxDate = (): string => {
    const today = new Date();
    today.setFullYear(today.getFullYear() - 16);
    return today.toISOString().split('T')[0];
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // Validation - Only name, email, phone, and password are mandatory
    if (
      !formData.fullName ||
      !formData.email ||
      !formData.phone ||
      !formData.password ||
      !formData.confirmPassword
    ) {
      toast.error('Please fill in all required fields');
      setLoading(false);
      return;
    }

    // Full name validation (at least 2 words)
    const nameParts = formData.fullName
      .trim()
      .split(' ')
      .filter((part) => part.length > 0);
    if (nameParts.length < 2) {
      toast.error('Please enter your full name (first and last name)');
      setLoading(false);
      return;
    }

    if (!/\S+@\S+\.\S+/.test(formData.email)) {
      toast.error('Please enter a valid email address');
      setLoading(false);
      return;
    }

    // Phone validation (10 digits)
    const phoneDigits = formData.phone.replace(/\D/g, '');
    if (phoneDigits.length < 10) {
      toast.error('Please enter a valid phone number (at least 10 digits)');
      setLoading(false);
      return;
    }

    // Password validation - minimum 8 characters
    if (formData.password.length < 8) {
      toast.error('Password must be at least 8 characters');
      setLoading(false);
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      toast.error('Passwords do not match');
      setLoading(false);
      return;
    }

    // Age validation (16+) - only if birthday is provided
    if (formData.birthday) {
      const age = calculateAge(formData.birthday);
      if (age < 16) {
        toast.error('You must be at least 16 years old to create an account');
        setLoading(false);
        return;
      }
    }

    try {
      const response = await authService.register({
        firstName: nameParts[0],
        lastName: nameParts.slice(1).join(' '),
        email: formData.email,
        phone: formData.phone,
        password: formData.password,
        ...(formData.gender && { gender: formData.gender }),
        ...(formData.birthday && { dob: formData.birthday }),
      });

      if (response.success && response.data.otpSent) {
        // Store registration data for OTP verification and resend
        localStorage.setItem(
          'otpVerification',
          JSON.stringify({
            identifier: response.data.identifier,
            method: response.data.method,
            // Store registration data for resend
            registrationData: {
              firstName: nameParts[0],
              lastName: nameParts.slice(1).join(' '),
              email: formData.email,
              phone: formData.phone,
              password: formData.password,
              ...(formData.gender && { gender: formData.gender }),
              ...(formData.birthday && { dob: formData.birthday }),
            },
          })
        );
        toast.success('OTP sent to your email!');
        router.push('/verify-otp');
      } else {
        toast.error(response.message || 'Registration failed. Please try again.');
      }
    } catch (err) {
      const apiError = err as ApiError;

      if (apiError.statusCode === 409) {
        toast.error('Email or phone already exists. Please use different credentials or login.');
      } else if (apiError.statusCode === 400) {
        toast.error(apiError.message || 'Invalid input. Please check your information.');
      } else {
        toast.error(apiError.message || 'An error occurred. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
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
                  <Send className="w-5 h-5 text-white -rotate-12" />
                </div>
              </div>

              {/* Stories */}
              <div className="px-4 py-3 flex gap-4 overflow-hidden border-b border-gray-800 flex-shrink-0">
                {['Your Story', 'emma', 'mike', 'sara'].map((name, i) => (
                  <div key={i} className="flex flex-col items-center gap-1">
                    <div
                      className={`w-14 h-14 rounded-full p-0.5 ${i === 0 ? 'bg-gray-700' : 'bg-gradient-to-br from-purple-500 via-pink-500 to-orange-500'}`}
                    >
                      <div className="w-full h-full rounded-full bg-gray-900 p-0.5">
                        <img
                          src={images[i % images.length]}
                          alt={name}
                          className="w-full h-full rounded-full object-cover"
                        />
                      </div>
                    </div>
                    <span className="text-white text-[10px] truncate w-14 text-center">{name}</span>
                  </div>
                ))}
              </div>

              {/* Post */}
              <div className="flex-1 flex flex-col min-h-0">
                {/* Post Header */}
                <div className="px-4 py-2 flex items-center gap-2 flex-shrink-0">
                  <div className="w-8 h-8 rounded-full overflow-hidden">
                    <img
                      src={images[currentImage]}
                      alt="user"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <span className="text-white text-sm font-medium">clickme_official</span>
                  <span className="text-gray-500 text-xs">• 2h</span>
                </div>

                {/* Post Image with Animation */}
                <div className="relative h-[240px] overflow-hidden flex-shrink-0">
                  {images.map((img, i) => (
                    <img
                      key={i}
                      src={img}
                      alt="Post"
                      className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ${i === currentImage ? 'opacity-100' : 'opacity-0'}`}
                    />
                  ))}
                  {/* Reel Play Icon */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-12 h-12 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center">
                      <Play className="w-5 h-5 text-white fill-white ml-1" />
                    </div>
                  </div>
                  {/* Image Indicators */}
                  <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
                    {images.map((_, i) => (
                      <div
                        key={i}
                        className={`w-1.5 h-1.5 rounded-full transition-colors ${i === currentImage ? 'bg-white' : 'bg-white/40'}`}
                      />
                    ))}
                  </div>
                </div>

                {/* Post Actions */}
                <div className="px-4 py-2 flex items-center justify-between flex-shrink-0">
                  <div className="flex gap-4">
                    <Heart className="w-5 h-5 text-white hover:text-red-500 cursor-pointer transition-colors" />
                    <MessageCircle className="w-5 h-5 text-white" />
                    <Send className="w-5 h-5 text-white -rotate-12" />
                  </div>
                  <Bookmark className="w-5 h-5 text-white" />
                </div>

                {/* Likes */}
                <div className="px-4 pb-3 flex-shrink-0">
                  <p className="text-white text-xs font-medium">12,458 likes</p>
                  <p className="text-white text-xs mt-1">
                    <span className="font-medium">clickme_official</span>{' '}
                    <span className="text-gray-400">Join our community! 🎉</span>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Side - Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center px-4 py-4 lg:px-8 lg:py-12 bg-white dark:bg-gray-950">
        <div className="w-full max-w-md">
          {/* Mobile Logo */}
          <div className="lg:hidden flex justify-center mb-4">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-purple-600 via-pink-500 to-orange-400 flex items-center justify-center">
                <Camera className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold bg-gradient-to-r from-purple-600 via-pink-500 to-orange-400 bg-clip-text text-transparent">
                ClickME
              </span>
            </Link>
          </div>

          {/* Header */}
          <div className="mb-4 lg:mb-8">
            <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white">
              Create Account
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1 text-sm lg:text-base">
              Join ClickME and start sharing
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSignup} className="space-y-3 lg:space-y-4">
            {/* Full Name */}
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-1">
                Full Name
              </label>
              <Input
                type="text"
                name="fullName"
                placeholder="Enter your full name"
                value={formData.fullName}
                onChange={handleChange}
                disabled={loading}
                required
                className="h-10 lg:h-12 bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-800 focus:border-purple-500 focus:ring-purple-500"
              />
            </div>

            {/* Email */}
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-1">
                Email
              </label>
              <Input
                type="email"
                name="email"
                placeholder="name@example.com"
                value={formData.email}
                onChange={handleChange}
                disabled={loading}
                required
                className="h-10 lg:h-12 bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-800 focus:border-purple-500 focus:ring-purple-500"
              />
            </div>

            {/* Phone Number */}
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-1">
                Phone Number
              </label>
              <Input
                type="tel"
                name="phone"
                placeholder=""
                value={formData.phone}
                onChange={handleChange}
                disabled={loading}
                required
                className="h-10 lg:h-12 bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-800 focus:border-purple-500 focus:ring-purple-500"
              />
            </div>

            {/* Gender & Birthday Row (Optional) */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-2">
                  Gender <span className="text-gray-400 font-normal">(Optional)</span>
                </label>
                <div className="relative" ref={genderDropdownRef}>
                  <button
                    type="button"
                    onClick={() => setGenderDropdownOpen(!genderDropdownOpen)}
                    disabled={loading}
                    className="w-full h-12 px-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg focus:border-purple-500 focus:ring-purple-500 text-gray-900 dark:text-white flex items-center justify-between"
                  >
                    <span
                      className={
                        formData.gender
                          ? 'text-gray-900 dark:text-white'
                          : 'text-gray-500 dark:text-gray-400'
                      }
                    >
                      {formData.gender
                        ? genderOptions.find((g) => g.value === formData.gender)?.label
                        : 'Gender'}
                    </span>
                    <ChevronDown
                      className={`w-5 h-5 text-gray-500 transition-transform ${genderDropdownOpen ? 'rotate-180' : ''}`}
                    />
                  </button>
                  {genderDropdownOpen && (
                    <div className="absolute top-full left-0 right-0 mt-2 bg-gray-800 dark:bg-gray-800 border border-gray-700 rounded-xl shadow-xl z-50 overflow-hidden">
                      {genderOptions.map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => {
                            setFormData((prev) => ({ ...prev, gender: option.value }));
                            setGenderDropdownOpen(false);
                          }}
                          className={`w-full px-4 py-3 text-left hover:bg-gray-700 transition-colors ${
                            formData.gender === option.value
                              ? 'text-white bg-gray-700'
                              : 'text-gray-300'
                          }`}
                        >
                          {formData.gender === option.value && <span className="mr-2">✓</span>}
                          {option.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-1">
                  Birthday <span className="text-gray-400 font-normal">(Optional)</span>
                </label>
                <Input
                  type="date"
                  name="birthday"
                  value={formData.birthday}
                  onChange={handleChange}
                  max={getMaxDate()}
                  disabled={loading}
                  className="h-10 lg:h-12 bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-800 focus:border-purple-500 focus:ring-purple-500"
                />
              </div>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 -mt-1 lg:-mt-2">
              If provided, you must be at least 16 years old
            </p>

            {/* Password */}
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-1">
                Password
              </label>
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  placeholder="Minimum 8 characters"
                  value={formData.password}
                  onChange={(e) => {
                    handleChange(e);
                    // Calculate password strength based on length only
                    const pwd = e.target.value;
                    let score = 0;
                    let label = '';
                    let color = '';

                    if (pwd.length === 0) {
                      label = '';
                      color = '';
                    } else if (pwd.length < 8) {
                      score = 2;
                      label = 'Too short';
                      color = 'bg-red-500';
                    } else if (pwd.length >= 8 && pwd.length < 12) {
                      score = 3;
                      label = 'Good';
                      color = 'bg-blue-500';
                    } else {
                      score = 5;
                      label = 'Strong';
                      color = 'bg-green-500';
                    }
                    setPasswordStrength({ score, label, color });
                  }}
                  disabled={loading}
                  required
                  className="h-10 lg:h-12 bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-800 focus:border-purple-500 focus:ring-purple-500 pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {/* Password Strength Indicator */}
              {formData.password && (
                <div className="mt-2">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-300 ${passwordStrength.color}`}
                        style={{ width: `${(passwordStrength.score / 5) * 100}%` }}
                      />
                    </div>
                    <span
                      className={`text-xs font-medium ${
                        passwordStrength.label === 'Too short'
                          ? 'text-red-500'
                          : passwordStrength.label === 'Good'
                            ? 'text-blue-500'
                            : 'text-green-500'
                      }`}
                    >
                      {passwordStrength.label}
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-1">
                Confirm Password
              </label>
              <div className="relative">
                <Input
                  type={showConfirmPassword ? 'text' : 'password'}
                  name="confirmPassword"
                  placeholder="Confirm password"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  disabled={loading}
                  required
                  className="h-10 lg:h-12 bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-800 focus:border-purple-500 focus:ring-purple-500 pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
                >
                  {showConfirmPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full h-10 lg:h-12 bg-gradient-to-r from-purple-600 via-pink-500 to-orange-400 hover:opacity-90 text-white font-semibold text-sm lg:text-base rounded-xl transition-all"
              disabled={loading}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                      fill="none"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Creating Account...
                </span>
              ) : (
                'Create Account'
              )}
            </Button>
          </form>

          {/* Divider */}
          <div className="my-3 lg:my-6 flex items-center gap-4">
            <div className="flex-1 h-px bg-gray-200 dark:bg-gray-800"></div>
            <span className="text-sm text-gray-500 dark:text-gray-400">or</span>
            <div className="flex-1 h-px bg-gray-200 dark:bg-gray-800"></div>
          </div>

          {/* Sign In Link */}
          <p className="text-center text-gray-600 dark:text-gray-400 text-sm">
            Already have an account?{' '}
            <Link
              href="/login"
              className="text-purple-600 dark:text-purple-400 font-semibold hover:text-purple-700 dark:hover:text-purple-300 transition-colors"
            >
              Sign in
            </Link>
          </p>

          {/* Footer */}
          <p className="text-center text-gray-400 dark:text-gray-600 text-xs mt-4 lg:mt-8">
            © 2026 ClickME. All rights reserved.
          </p>
        </div>
      </div>
    </main>
  );
}
