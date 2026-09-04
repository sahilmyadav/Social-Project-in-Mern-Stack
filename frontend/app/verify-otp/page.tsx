'use client';

import { Button } from '@/components/ui/button';
import { ApiError } from '@/lib/api-client';
import { authService } from '@/lib/api-services';
import { Bookmark, Camera, Heart, MessageCircle, Play, Send } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

export default function VerifyOtpPage() {
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [timer, setTimer] = useState(120); // 2 minutes
  const [verificationData, setVerificationData] = useState<{
    identifier: string;
    method: string;
    registrationData?: {
      firstName: string;
      lastName: string;
      email: string;
      phone: string;
      gender: string;
      dob: string;
    };
  } | null>(null);
  const [currentImage, setCurrentImage] = useState(0);
  const router = useRouter();
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

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

  useEffect(() => {
    const data = localStorage.getItem('otpVerification');
    if (!data) {
      router.push('/signup');
      return;
    }
    setVerificationData(JSON.parse(data));

    const interval = setInterval(() => {
      setTimer((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [router]);

  const handleChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return; // Only allow digits

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').slice(0, 6);
    if (!/^\d+$/.test(pastedData)) return;

    const newOtp = [...otp];
    for (let i = 0; i < pastedData.length; i++) {
      newOtp[i] = pastedData[i];
    }
    setOtp(newOtp);

    const lastIndex = Math.min(pastedData.length, 5);
    inputRefs.current[lastIndex]?.focus();
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const otpCode = otp.join('');

    if (otpCode.length !== 6) {
      toast.error('Please enter complete 6-digit OTP');
      setLoading(false);
      return;
    }

    if (!verificationData) {
      toast.error('Verification data missing. Please sign up again.');
      setLoading(false);
      return;
    }

    try {
      const response = await authService.verifyRegisterOtp({
        email: verificationData.method === 'email' ? verificationData.identifier : undefined,
        phone: verificationData.method === 'sms' ? verificationData.identifier : undefined,
        userId: '',
        otp: otpCode,
      });

      if (response.success) {
        if (response.data.accessToken) {
          localStorage.setItem('accessToken', response.data.accessToken);
        }
        if (response.data.refreshToken) {
          localStorage.setItem('refreshToken', response.data.refreshToken);
        }
        if (response.data.user) {
          localStorage.setItem('user', JSON.stringify(response.data.user));
        }

        localStorage.removeItem('otpVerification');
        sessionStorage.removeItem('_otpResendKey');
        toast.success('Account verified successfully!');

        if (response.data.user && !response.data.user.profileCompleted) {
          router.push('/setup-profile');
        } else {
          router.push('/home');
        }
      } else {
        toast.error(response.message || 'OTP verification failed. Please try again.');
      }
    } catch (err) {
      const apiError = err as ApiError;
      if (apiError.statusCode === 400) {
        toast.error(apiError.message || 'Invalid or expired OTP. Please try again.');
      } else {
        toast.error(apiError.message || 'An error occurred. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (timer > 0 || !verificationData) return;

    if (!verificationData.registrationData) {
      toast.error('Registration data not found. Please sign up again.');
      localStorage.removeItem('otpVerification');
      router.push('/signup');
      return;
    }

    const resendPassword = sessionStorage.getItem('_otpResendKey');
    if (!resendPassword) {
      toast.error('Session expired. Please sign up again.');
      localStorage.removeItem('otpVerification');
      router.push('/signup');
      return;
    }

    setResendLoading(true);
    try {
      const response = await authService.register({
        ...verificationData.registrationData,
        password: resendPassword,
      });

      if (response.success && response.data.otpSent) {
        toast.success('New OTP sent to your email!');
        setTimer(120);
        setOtp(['', '', '', '', '', '']);
        inputRefs.current[0]?.focus();
      } else {
        toast.error(response.message || 'Failed to resend OTP. Please try again.');
      }
    } catch (err) {
      const apiError = err as ApiError;
      if (apiError.statusCode === 429) {
        toast.error('Too many attempts. Please wait a few minutes and try again.');
      } else if (apiError.statusCode === 409) {
        toast.error('This account may already be verified. Try logging in.');
      } else {
        toast.error(apiError.message || 'Failed to resend OTP. Please try again.');
      }
    } finally {
      setResendLoading(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-black flex">
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-gradient-to-br from-gray-900 via-gray-800 to-black items-center justify-center">
        <div className="absolute inset-0 opacity-30">
          <div className="absolute top-20 left-20 w-72 h-72 bg-purple-500 rounded-full blur-[120px]"></div>
          <div className="absolute bottom-20 right-20 w-72 h-72 bg-pink-500 rounded-full blur-[120px]"></div>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-orange-500 rounded-full blur-[150px]"></div>
        </div>

        <Link href="/" className="absolute top-8 left-8 flex items-center gap-2 z-20">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-600 via-pink-500 to-orange-400 flex items-center justify-center">
            <Camera className="w-6 h-6 text-white" />
          </div>
          <span className="text-2xl font-bold text-white">ClickME</span>
        </Link>

        <div className="relative z-10">
          <div className="relative w-[320px] h-[650px] bg-gray-900 rounded-[3rem] p-2 shadow-2xl border border-gray-700">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-8 bg-gray-900 rounded-b-2xl z-20"></div>

            <div className="w-full h-full bg-black rounded-[2.5rem] overflow-hidden flex flex-col">
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

              <div className="px-4 py-2 flex items-center justify-between border-b border-gray-800 flex-shrink-0">
                <span className="text-white font-semibold text-lg">ClickME</span>
                <div className="flex gap-4">
                  <Heart className="w-5 h-5 text-white" />
                  <Send className="w-5 h-5 text-white" />
                </div>
              </div>

              <div className="flex-1 overflow-hidden">
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

                <div className="relative aspect-square bg-gray-800">
                  {images.map((img, index) => (
                    <img
                      key={index}
                      src={img}
                      alt={`Post ${index + 1}`}
                      className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ${currentImage === index ? 'opacity-100' : 'opacity-0'
                        }`}
                    />
                  ))}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-16 h-16 rounded-full bg-black/30 flex items-center justify-center backdrop-blur-sm">
                      <Play className="w-8 h-8 text-white fill-white" />
                    </div>
                  </div>
                  <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1">
                    {images.map((_, i) => (
                      <div
                        key={i}
                        className={`w-1.5 h-1.5 rounded-full transition-colors ${currentImage === i ? 'bg-blue-500' : 'bg-white/50'
                          }`}
                      ></div>
                    ))}
                  </div>
                </div>

                <div className="px-4 py-3 flex items-center justify-between">
                  <div className="flex gap-4">
                    <Heart className="w-6 h-6 text-white" />
                    <MessageCircle className="w-6 h-6 text-white" />
                    <Send className="w-6 h-6 text-white" />
                  </div>
                  <Bookmark className="w-6 h-6 text-white" />
                </div>

                <div className="px-4 pb-2">
                  <p className="text-white text-sm font-semibold">1,234 likes</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="absolute bottom-10 left-10 text-white/60 text-sm">
          <p>Join millions of users</p>
          <p>sharing moments worldwide</p>
        </div>
      </div>

      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-md">
          <div className="lg:hidden text-center mb-8">
            <Link href="/" className="inline-flex items-center gap-2">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-600 via-pink-500 to-orange-400 flex items-center justify-center">
                <Camera className="w-7 h-7 text-white" />
              </div>
              <span className="text-3xl font-bold text-gray-900 dark:text-white">ClickME</span>
            </Link>
          </div>

          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-8 shadow-xl">
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-purple-600 via-pink-500 to-orange-400 mb-4">
                <svg
                  className="w-8 h-8 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                  />
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                Verify Your Account
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mt-2">
                Enter the 6-digit code sent to
              </p>
              <p className="text-gray-900 dark:text-white font-medium">
                {verificationData?.identifier || 'your email'}
              </p>
            </div>

            <form onSubmit={handleVerify} className="space-y-6">
              <div className="flex gap-2 justify-center">
                {otp.map((digit, index) => (
                  <input
                    key={index}
                    ref={(el) => {
                      inputRefs.current[index] = el;
                    }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleChange(index, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(index, e)}
                    onPaste={index === 0 ? handlePaste : undefined}
                    disabled={loading || resendLoading}
                    className="w-10 h-12 sm:w-11 sm:h-13 text-center text-xl sm:text-2xl font-bold rounded-lg border-2 border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 outline-none transition-all disabled:opacity-50"
                    autoFocus={index === 0}
                  />
                ))}
              </div>

              <div className="text-center">
                {timer > 0 ? (
                  <p className="text-gray-600 dark:text-gray-400 text-sm">
                    Resend OTP in{' '}
                    <span className="font-semibold text-gray-900 dark:text-white">
                      {formatTime(timer)}
                    </span>
                  </p>
                ) : (
                  <button
                    type="button"
                    onClick={handleResend}
                    disabled={resendLoading}
                    className="text-purple-600 dark:text-purple-400 font-semibold hover:underline text-sm"
                  >
                    {resendLoading ? 'Sending...' : 'Resend OTP'}
                  </button>
                )}
              </div>

              <Button
                type="submit"
                className="w-full h-12 bg-gradient-to-r from-purple-600 via-pink-500 to-orange-400 hover:from-purple-700 hover:via-pink-600 hover:to-orange-500 text-white font-semibold rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl"
                disabled={loading || otp.some((d) => !d)}
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
                    Verifying...
                  </span>
                ) : (
                  'Verify OTP'
                )}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <button
                onClick={() => {
                  localStorage.removeItem('otpVerification');
                  router.push('/signup');
                }}
                className="text-gray-600 dark:text-gray-400 text-sm hover:text-gray-900 dark:hover:text-white transition-colors"
              >
                ← Back to Sign Up
              </button>
            </div>
          </div>

          <div className="mt-8 text-center text-sm text-gray-500 dark:text-gray-400">
            <p>
              Didn&apos;t receive the code? Check your spam folder or{' '}
              <button
                onClick={() => {
                  localStorage.removeItem('otpVerification');
                  router.push('/signup');
                }}
                className="text-purple-600 dark:text-purple-400 hover:underline"
              >
                try again
              </button>
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
