'use client';

import AnimatedLogo from '@/components/animated-logo';
import { Button } from '@/components/ui/button';
import {
  Bell,
  Bookmark,
  Camera,
  Heart,
  MessageCircle,
  Music,
  Play,
  Send,
  Shield,
  Sparkles,
  Users,
  Video,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

export default function Home() {
  const [currentImage, setCurrentImage] = useState(0);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const images = [
    '/Landing/cat.jpeg',
    '/Landing/panda.jpeg',
    '/Landing/capads.jpeg',
    '/Landing/Republic%20day.jpeg',
  ];

  useEffect(() => {
    // Check if user is logged in
    const user = localStorage.getItem('user');
    setIsLoggedIn(!!user);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentImage((prev) => (prev + 1) % images.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <main className="min-h-screen bg-white dark:bg-black">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 dark:bg-black/80 backdrop-blur-xl border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AnimatedLogo size={32} />
            <span className="text-xl font-bold logo-gradient-text">ClickME</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login">
              <Button
                variant="ghost"
                size="sm"
                className="text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
              >
                Log In
              </Button>
            </Link>
            <Link href="/signup">
              <Button
                size="sm"
                className="bg-gradient-to-r from-purple-600 via-pink-500 to-orange-400 text-white border-0 hover:opacity-90"
              >
                Sign Up
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-24 pb-16 md:pt-32 md:pb-24 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Phone Mockup */}
            <div className="order-2 lg:order-1 flex justify-center">
              <div className="relative">
                {/* Phone Frame */}
                <div className="relative w-[280px] h-[580px] bg-gray-900 rounded-[3rem] p-2 shadow-2xl border border-gray-700">
                  {/* Notch */}
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-28 h-7 bg-gray-900 rounded-b-2xl z-20"></div>

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
                    <div className="px-3 py-2 flex gap-3 overflow-hidden border-b border-gray-800 flex-shrink-0">
                      {['Your Story', 'emma', 'mike', 'sara'].map((name, i) => (
                        <div key={i} className="flex flex-col items-center gap-1">
                          <div
                            className={`w-12 h-12 rounded-full p-0.5 ${i === 0 ? 'bg-gray-700' : 'bg-gradient-to-br from-purple-500 via-pink-500 to-orange-500'}`}
                          >
                            <div className="w-full h-full rounded-full bg-gray-900 p-0.5">
                              <img
                                src={images[i % images.length]}
                                alt={name}
                                className="w-full h-full rounded-full object-cover"
                              />
                            </div>
                          </div>
                          <span className="text-white text-[9px] truncate w-12 text-center">
                            {name}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Post */}
                    <div className="flex-1 flex flex-col min-h-0">
                      {/* Post Header */}
                      <div className="px-3 py-2 flex items-center gap-2 flex-shrink-0">
                        <div className="w-7 h-7 rounded-full overflow-hidden">
                          <img
                            src={images[currentImage]}
                            alt="user"
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <span className="text-white text-xs font-medium">clickme_official</span>
                        <span className="text-gray-500 text-[10px]">• 2h</span>
                      </div>

                      {/* Post Image with Animation */}
                      <div className="relative h-[200px] overflow-hidden flex-shrink-0">
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
                      <div className="px-3 py-2 flex items-center justify-between flex-shrink-0">
                        <div className="flex gap-4">
                          <Heart className="w-5 h-5 text-white hover:text-red-500 cursor-pointer transition-colors" />
                          <MessageCircle className="w-5 h-5 text-white" />
                          <Send className="w-5 h-5 text-white -rotate-12" />
                        </div>
                        <Bookmark className="w-5 h-5 text-white" />
                      </div>

                      {/* Likes */}
                      <div className="px-3 pb-3 flex-shrink-0">
                        <p className="text-white text-xs font-medium">12,458 likes</p>
                        <p className="text-white text-xs mt-1">
                          <span className="font-medium">clickme_official</span>{' '}
                          <span className="text-gray-400">Share your moments ✨</span>
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="order-1 lg:order-2 text-center lg:text-left">
              <h1 className="text-4xl md:text-6xl font-bold mb-6 text-gray-900 dark:text-white leading-tight">
                Connect, Share & <br />
                <span className="bg-gradient-to-r from-purple-600 via-pink-500 to-orange-400 bg-clip-text text-transparent">
                  Go Viral
                </span>
              </h1>
              <p className="text-lg md:text-xl text-gray-600 dark:text-gray-400 mb-8 max-w-lg mx-auto lg:mx-0">
                Join millions of creators sharing their stories, connecting with friends, and
                building communities on ClickME.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start mb-8">
                <Link href="/signup">
                  <Button
                    size="lg"
                    className="w-full sm:w-auto bg-gradient-to-r from-purple-600 via-pink-500 to-orange-400 text-white border-0 hover:opacity-90 text-lg px-8"
                  >
                    Get Started — It's Free
                  </Button>
                </Link>
                <Link href="/login">
                  <Button
                    size="lg"
                    variant="outline"
                    className="w-full sm:w-auto border-2 border-gray-300 dark:border-gray-700 text-lg px-8"
                  >
                    Sign In
                  </Button>
                </Link>
              </div>

              {/* Stats */}
              <div className="flex gap-8 justify-center lg:justify-start">
                <div className="text-center">
                  <div className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">
                    10M+
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">Active Users</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">
                    50M+
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">Posts Shared</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">
                    190+
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">Countries</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 md:py-24 bg-gray-50 dark:bg-gray-900/50">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4">
              Everything You Need to{' '}
              <span className="bg-gradient-to-r from-purple-600 to-pink-500 bg-clip-text text-transparent">
                Express Yourself
              </span>
            </h2>
            <p className="text-gray-600 dark:text-gray-400 text-lg max-w-2xl mx-auto">
              Powerful features designed for creators, influencers, and everyone who loves to share
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Feature Cards */}
            {[
              {
                icon: Camera,
                title: 'Stories & Reels',
                description:
                  'Share moments that disappear in 24 hours or create viral short-form videos',
                gradient: 'from-purple-500 to-pink-500',
              },
              {
                icon: Video,
                title: 'Live Streaming',
                description: 'Go live and connect with your audience in real-time',
                gradient: 'from-pink-500 to-orange-500',
              },
              {
                icon: MessageCircle,
                title: 'Direct Messages',
                description:
                  'Chat privately with friends, share posts, and create group conversations',
                gradient: 'from-blue-500 to-purple-500',
              },
              {
                icon: Music,
                title: 'Music Integration',
                description: 'Add trending music to your stories and reels with our vast library',
                gradient: 'from-green-500 to-teal-500',
              },
              {
                icon: Users,
                title: 'Communities',
                description: 'Join or create groups based on your interests and passions',
                gradient: 'from-orange-500 to-red-500',
              },
              {
                icon: Shield,
                title: 'Privacy First',
                description: 'Control who sees your content with advanced privacy settings',
                gradient: 'from-gray-500 to-gray-700',
              },
            ].map((feature, i) => (
              <div
                key={i}
                className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm hover:shadow-lg transition-shadow border border-gray-100 dark:border-gray-700"
              >
                <div
                  className={`w-12 h-12 rounded-xl bg-gradient-to-br ${feature.gradient} flex items-center justify-center mb-4`}
                >
                  <feature.icon className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                  {feature.title}
                </h3>
                <p className="text-gray-600 dark:text-gray-400">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* App Preview Section */}
      <section className="py-16 md:py-24 overflow-hidden">
        <div className="max-w-6xl mx-auto px-4">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-6">
                Your Feed,{' '}
                <span className="bg-gradient-to-r from-purple-600 to-pink-500 bg-clip-text text-transparent">
                  Your Way
                </span>
              </h2>
              <p className="text-gray-600 dark:text-gray-400 text-lg mb-8">
                Our smart algorithm learns what you love. Get personalized content from creators you
                care about, discover new trends, and never miss a moment.
              </p>

              <div className="space-y-4">
                {[
                  { icon: Sparkles, text: 'AI-powered content recommendations' },
                  { icon: Bell, text: 'Never miss posts from your favorites' },
                  { icon: Heart, text: 'Save and organize content you love' },
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-100 to-pink-100 dark:from-purple-900/30 dark:to-pink-900/30 flex items-center justify-center">
                      <item.icon className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                    </div>
                    <span className="text-gray-700 dark:text-gray-300">{item.text}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative">
              <div className="grid grid-cols-2 gap-4">
                {[
                  { src: '/Landing/Republic%20day.jpeg', size: 'h-48' },
                  { src: '/Landing/panda.jpeg', size: 'h-64 -mt-8' },
                  { src: '/Landing/capads.jpeg', size: 'h-56 -mt-4' },
                  { src: '/Landing/cat.jpeg', size: 'h-40' },
                ].map((card, i) => (
                  <div key={i} className={`rounded-2xl ${card.size} shadow-lg overflow-hidden`}>
                    <img
                      src={card.src}
                      alt={`Feed content ${i + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 md:py-24 bg-gradient-to-br from-purple-600 via-pink-500 to-orange-400">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-5xl font-bold text-white mb-6">
            Ready to Join the Community?
          </h2>
          <p className="text-white/90 text-lg md:text-xl mb-8 max-w-2xl mx-auto">
            Sign up today and start sharing your story with the world. It only takes a few seconds!
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/signup">
              <Button
                size="lg"
                className="w-full sm:w-auto bg-white text-purple-600 hover:bg-white/90 text-lg px-8 font-semibold"
              >
                Create Free Account
              </Button>
            </Link>
            <Link href={isLoggedIn ? '/explore' : '/login'}>
              <Button
                size="lg"
                variant="outline"
                className="w-full sm:w-auto border-2 border-white !text-white !bg-transparent hover:!bg-white/10 text-lg px-8"
              >
                Explore Content
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-12">
        <div className="max-w-6xl mx-auto px-4">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-purple-600 via-pink-500 to-orange-400 flex items-center justify-center">
                  <Camera className="w-5 h-5 text-white" />
                </div>
                <span className="text-xl font-bold text-white">ClickME</span>
              </div>
              <p className="text-sm">
                Connect with friends, share moments, and discover amazing content from creators
                worldwide.
              </p>
            </div>

            <div>
              <h4 className="text-white font-semibold mb-4">Product</h4>
              <ul className="space-y-2 text-sm">
                <li>
                  <Link href="/explore" className="hover:text-white transition-colors">
                    Explore
                  </Link>
                </li>
                <li>
                  <Link href="/reels" className="hover:text-white transition-colors">
                    Reels
                  </Link>
                </li>
                <li>
                  <Link href="/live" className="hover:text-white transition-colors">
                    Live
                  </Link>
                </li>
                <li>
                  <Link href="/chat" className="hover:text-white transition-colors">
                    Messages
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="text-white font-semibold mb-4">Company</h4>
              <ul className="space-y-2 text-sm">
                <li>
                  <a href="#" className="hover:text-white transition-colors">
                    About Us
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white transition-colors">
                    Careers
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white transition-colors">
                    Press
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white transition-colors">
                    Blog
                  </a>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="text-white font-semibold mb-4">Legal</h4>
              <ul className="space-y-2 text-sm">
                <li>
                  <a href="#" className="hover:text-white transition-colors">
                    Privacy Policy
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white transition-colors">
                    Terms of Service
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white transition-colors">
                    Cookie Policy
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white transition-colors">
                    Community Guidelines
                  </a>
                </li>
              </ul>
            </div>
          </div>

          <div className="border-t border-gray-800 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-sm">© 2026 ClickME. All rights reserved.</p>
            <div className="flex gap-6">
              <a href="#" className="hover:text-white transition-colors">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                </svg>
              </a>
              <a href="#" className="hover:text-white transition-colors">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z" />
                </svg>
              </a>
              <a href="#" className="hover:text-white transition-colors">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12.017 0C5.396 0 .029 5.367.029 11.987c0 5.079 3.158 9.417 7.618 11.162-.105-.949-.199-2.403.041-3.439.219-.937 1.406-5.957 1.406-5.957s-.359-.72-.359-1.781c0-1.663.967-2.911 2.168-2.911 1.024 0 1.518.769 1.518 1.688 0 1.029-.653 2.567-.992 3.992-.285 1.193.6 2.165 1.775 2.165 2.128 0 3.768-2.245 3.768-5.487 0-2.861-2.063-4.869-5.008-4.869-3.41 0-5.409 2.562-5.409 5.199 0 1.033.394 2.143.889 2.741.099.12.112.225.085.345-.09.375-.293 1.199-.334 1.363-.053.225-.172.271-.401.165-1.495-.69-2.433-2.878-2.433-4.646 0-3.776 2.748-7.252 7.92-7.252 4.158 0 7.392 2.967 7.392 6.923 0 4.135-2.607 7.462-6.233 7.462-1.214 0-2.354-.629-2.758-1.379l-.749 2.848c-.269 1.045-1.004 2.352-1.498 3.146 1.123.345 2.306.535 3.55.535 6.607 0 11.985-5.365 11.985-11.987C23.97 5.39 18.592.026 11.985.026L12.017 0z" />
                </svg>
              </a>
              <a href="#" className="hover:text-white transition-colors">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
                </svg>
              </a>
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}
