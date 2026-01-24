'use client';

import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function Home() {
  return (
    <main className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="gradient-purple-peach min-h-screen flex items-center justify-center relative overflow-hidden px-4">
        <div className="text-center text-white max-w-2xl mx-auto">
          <div className="mb-8">
            <div className="inline-flex items-center justify-center w-24 h-24 rounded-2xl bg-white/20 backdrop-blur-md mb-6 p-2">
              <img
                src="/logo.png"
                alt="ClickME"
                className="w-full h-full object-cover rounded-xl"
              />
            </div>
          </div>

          <h1 className="text-5xl md:text-7xl font-bold mb-4 text-balance">Welcome to ClickME</h1>
          <p className="text-xl md:text-2xl mb-12 text-white/90">
            Share your moments, connect with friends, and explore the world
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/login">
              <Button
                size="lg"
                className="w-full sm:w-auto bg-white text-primary hover:bg-white/90"
              >
                Sign In
              </Button>
            </Link>
            <Link href="/signup">
              <Button
                size="lg"
                className="w-full sm:w-auto bg-white/20 text-white hover:bg-white/30 border border-white"
              >
                Create Account
              </Button>
            </Link>
          </div>
        </div>

        {/* Decorative elements */}
        <div className="absolute top-10 left-10 w-40 h-40 bg-white/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-10 right-10 w-40 h-40 bg-secondary/20 rounded-full blur-3xl"></div>
      </section>
    </main>
  );
}
