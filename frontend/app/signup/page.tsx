'use client';

import type React from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ApiError } from '@/lib/api-client';
import { authService } from '@/lib/api-services';
import { Bookmark, Camera, Eye, EyeOff, Heart, MessageCircle, Play, Send } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

export default function SignupPage() {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [currentImage, setCurrentImage] = useState(0);
  const router = useRouter();

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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // Validation
    if (
      !formData.firstName ||
      !formData.lastName ||
      !formData.email ||
      !formData.password ||
      !formData.confirmPassword
    ) {
      toast.error('Please fill in all fields');
      setLoading(false);
      return;
    }

    if (!/\S+@\S+\.\S+/.test(formData.email)) {
      toast.error('Please enter a valid email address');
      setLoading(false);
      return;
    }

    if (formData.password.length < 6) {
      toast.error('Password must be at least 6 characters');
      setLoading(false);
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      toast.error('Passwords do not match');
      setLoading(false);
      return;
    }

    try {
      const response = await authService.register({
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        password: formData.password,
      });

      if (response.success && response.data.otpSent) {
        // Store registration data for OTP verification
        localStorage.setItem(
          'otpVerification',
          JSON.stringify({
            identifier: response.data.identifier, // Use identifier from backend
            method: response.data.method,
          })
        );
        toast.success('OTP sent to your email!');
        // Redirect to OTP verification page
        router.push('/verify-otp');
      } else {
        toast.error(response.message || 'Registration failed. Please try again.');
      }
    } catch (err) {
      const apiError = err as ApiError;

      if (apiError.statusCode === 409) {
        toast.error('Email already exists. Please use a different email or login.');
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
      <div className="w-full lg:w-1/2 flex items-center justify-center px-8 py-12 bg-white dark:bg-gray-950">
        <div className="w-full max-w-md">
          {/* Mobile Logo */}
          <div className="lg:hidden flex justify-center mb-8">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-600 via-pink-500 to-orange-400 flex items-center justify-center">
                <Camera className="w-6 h-6 text-white" />
              </div>
              <span className="text-2xl font-bold bg-gradient-to-r from-purple-600 via-pink-500 to-orange-400 bg-clip-text text-transparent">
                ClickME
              </span>
            </Link>
          </div>

          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Create Account</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-2">
              Join ClickME and start sharing your moments
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSignup} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-2">
                  First Name
                </label>
                <Input
                  type="text"
                  name="firstName"
                  placeholder="First name"
                  value={formData.firstName}
                  onChange={handleChange}
                  disabled={loading}
                  required
                  className="h-12 bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-800 focus:border-purple-500 focus:ring-purple-500"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-2">
                  Last Name
                </label>
                <Input
                  type="text"
                  name="lastName"
                  placeholder="Last name"
                  value={formData.lastName}
                  onChange={handleChange}
                  disabled={loading}
                  required
                  className="h-12 bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-800 focus:border-purple-500 focus:ring-purple-500"
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-2">
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
                className="h-12 bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-800 focus:border-purple-500 focus:ring-purple-500"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-2">
                Password
              </label>
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  placeholder="Create a password (min 6 characters)"
                  value={formData.password}
                  onChange={handleChange}
                  disabled={loading}
                  required
                  className="h-12 bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-800 focus:border-purple-500 focus:ring-purple-500 pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-2">
                Confirm Password
              </label>
              <div className="relative">
                <Input
                  type={showConfirmPassword ? 'text' : 'password'}
                  name="confirmPassword"
                  placeholder="Confirm your password"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  disabled={loading}
                  required
                  className="h-12 bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-800 focus:border-purple-500 focus:ring-purple-500 pr-12"
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
              className="w-full h-12 bg-gradient-to-r from-purple-600 via-pink-500 to-orange-400 hover:opacity-90 text-white font-semibold text-base rounded-xl transition-all"
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
          <div className="my-6 flex items-center gap-4">
            <div className="flex-1 h-px bg-gray-200 dark:bg-gray-800"></div>
            <span className="text-sm text-gray-500 dark:text-gray-400">or</span>
            <div className="flex-1 h-px bg-gray-200 dark:bg-gray-800"></div>
          </div>

          {/* Sign In Link */}
          <p className="text-center text-gray-600 dark:text-gray-400">
            Already have an account?{' '}
            <Link
              href="/login"
              className="text-purple-600 dark:text-purple-400 font-semibold hover:text-purple-700 dark:hover:text-purple-300 transition-colors"
            >
              Sign in
            </Link>
          </p>

          {/* Footer */}
          <p className="text-center text-gray-400 dark:text-gray-600 text-xs mt-8">
            © 2026 ClickME. All rights reserved.
          </p>
        </div>
      </div>
    </main>
  );
}
