'use client';

import { useEffect, useRef } from 'react';

/**
 * Detects new deployments and auto-reloads the page so clients always
 * run the latest code. Uses Next.js's build manifest as a lightweight probe.
 */
export default function VersionChecker() {
  const knownBuildId = useRef<string | null>(null);

  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;

    // Extract the current build ID from __NEXT_DATA__ (injected by Next.js at page load)
    try {
      const nextData = (window as any).__NEXT_DATA__;
      if (nextData?.buildId) {
        knownBuildId.current = nextData.buildId;
        console.log('[VersionCheck] Current build:', knownBuildId.current);
      }
    } catch {
      // Ignore
    }

    const checkVersion = async () => {
      if (!knownBuildId.current) return;
      try {
        // Probe the build manifest — returns 200 if build ID matches, 404 if build changed
        const res = await fetch(
          `/_next/static/${knownBuildId.current}/_buildManifest.js`,
          { method: 'HEAD', cache: 'no-store' }
        );
        if (res.status === 404) {
          console.log('[VersionCheck] New deployment detected — reloading...');
          window.location.reload();
        }
      } catch {
        // Network error — ignore silently
      }
    };

    // Check every 30 seconds
    const interval = setInterval(checkVersion, 30000);

    // Also check on visibility change (user switches back to tab)
    const onVisible = () => {
      if (document.visibilityState === 'visible') checkVersion();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  return null;
}
