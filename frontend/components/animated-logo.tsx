'use client';

import Image from 'next/image';

interface AnimatedLogoProps {
  size?: number;
  className?: string;
}

export default function AnimatedLogo({ size = 48, className = '' }: AnimatedLogoProps) {
  return (
    <div
      className={`rounded-xl overflow-hidden ${className}`}
      style={{ width: size, height: size }}
    >
      <Image
        src="/websitelogo/logo.png"
        alt="ClickME Logo"
        width={size}
        height={size}
        className="object-contain"
        priority
      />
    </div>
  );
}

import Lottie from 'lottie-react';

const clickAnimation = {
  v: '5.7.4',
  fr: 60,
  ip: 0,
  op: 90,
  w: 200,
  h: 200,
  nm: 'ClickME Logo',
  ddd: 0,
  assets: [],
  layers: [
    {
      ddd: 0,
      ind: 1,
      ty: 4,
      nm: 'Ripple3',
      sr: 1,
      ks: {
        o: {
          a: 1,
          k: [
            { i: { x: [0.4], y: [1] }, o: { x: [0.6], y: [0] }, t: 30, s: [60] },
            { t: 75, s: [0] },
          ],
        },
        p: { a: 0, k: [100, 70, 0] },
        s: {
          a: 1,
          k: [
            {
              i: { x: [0.4, 0.4, 0.4], y: [1, 1, 1] },
              o: { x: [0.6, 0.6, 0.6], y: [0, 0, 0] },
              t: 30,
              s: [20, 20, 100],
            },
            { t: 75, s: [140, 140, 100] },
          ],
        },
      },
      ao: 0,
      shapes: [
        {
          ty: 'gr',
          it: [
            { ty: 'el', d: 1, s: { a: 0, k: [60, 60] }, p: { a: 0, k: [0, 0] } },
            {
              ty: 'st',
              c: { a: 0, k: [0.75, 0.5, 1, 1] },
              o: { a: 0, k: 100 },
              w: { a: 0, k: 4 },
              lc: 2,
              lj: 2,
            },
            {
              ty: 'tr',
              p: { a: 0, k: [0, 0] },
              s: { a: 0, k: [100, 100] },
              r: { a: 0, k: 0 },
              o: { a: 0, k: 100 },
            },
          ],
        },
      ],
      ip: 30,
      op: 90,
    },
    {
      ddd: 0,
      ind: 2,
      ty: 4,
      nm: 'Ripple2',
      sr: 1,
      ks: {
        o: {
          a: 1,
          k: [
            { i: { x: [0.4], y: [1] }, o: { x: [0.6], y: [0] }, t: 20, s: [80] },
            { t: 60, s: [0] },
          ],
        },
        p: { a: 0, k: [100, 70, 0] },
        s: {
          a: 1,
          k: [
            {
              i: { x: [0.4, 0.4, 0.4], y: [1, 1, 1] },
              o: { x: [0.6, 0.6, 0.6], y: [0, 0, 0] },
              t: 20,
              s: [15, 15, 100],
            },
            { t: 60, s: [100, 100, 100] },
          ],
        },
      },
      ao: 0,
      shapes: [
        {
          ty: 'gr',
          it: [
            { ty: 'el', d: 1, s: { a: 0, k: [60, 60] }, p: { a: 0, k: [0, 0] } },
            {
              ty: 'st',
              c: { a: 0, k: [0.95, 0.45, 0.7, 1] },
              o: { a: 0, k: 100 },
              w: { a: 0, k: 5 },
              lc: 2,
              lj: 2,
            },
            {
              ty: 'tr',
              p: { a: 0, k: [0, 0] },
              s: { a: 0, k: [100, 100] },
              r: { a: 0, k: 0 },
              o: { a: 0, k: 100 },
            },
          ],
        },
      ],
      ip: 20,
      op: 90,
    },
    {
      ddd: 0,
      ind: 3,
      ty: 4,
      nm: 'Ripple1',
      sr: 1,
      ks: {
        o: {
          a: 1,
          k: [
            { i: { x: [0.4], y: [1] }, o: { x: [0.6], y: [0] }, t: 10, s: [100] },
            { t: 45, s: [0] },
          ],
        },
        p: { a: 0, k: [100, 70, 0] },
        s: {
          a: 1,
          k: [
            {
              i: { x: [0.4, 0.4, 0.4], y: [1, 1, 1] },
              o: { x: [0.6, 0.6, 0.6], y: [0, 0, 0] },
              t: 10,
              s: [10, 10, 100],
            },
            { t: 45, s: [70, 70, 100] },
          ],
        },
      },
      ao: 0,
      shapes: [
        {
          ty: 'gr',
          it: [
            { ty: 'el', d: 1, s: { a: 0, k: [60, 60] }, p: { a: 0, k: [0, 0] } },
            {
              ty: 'st',
              c: { a: 0, k: [1, 1, 1, 1] },
              o: { a: 0, k: 100 },
              w: { a: 0, k: 6 },
              lc: 2,
              lj: 2,
            },
            {
              ty: 'tr',
              p: { a: 0, k: [0, 0] },
              s: { a: 0, k: [100, 100] },
              r: { a: 0, k: 0 },
              o: { a: 0, k: 100 },
            },
          ],
        },
      ],
      ip: 10,
      op: 90,
    },
    {
      ddd: 0,
      ind: 4,
      ty: 4,
      nm: 'Finger',
      sr: 1,
      ks: {
        o: { a: 0, k: 100 },
        r: { a: 0, k: 0 },
        p: {
          a: 1,
          k: [
            { i: { x: 0.4, y: 1 }, o: { x: 0.6, y: 0 }, t: 0, s: [100, 110, 0] },
            { i: { x: 0.4, y: 1 }, o: { x: 0.6, y: 0 }, t: 10, s: [100, 95, 0] },
            { i: { x: 0.4, y: 1 }, o: { x: 0.6, y: 0 }, t: 20, s: [100, 110, 0] },
            { i: { x: 0.4, y: 1 }, o: { x: 0.6, y: 0 }, t: 45, s: [100, 110, 0] },
            { i: { x: 0.4, y: 1 }, o: { x: 0.6, y: 0 }, t: 55, s: [100, 95, 0] },
            { i: { x: 0.4, y: 1 }, o: { x: 0.6, y: 0 }, t: 65, s: [100, 110, 0] },
            { t: 90, s: [100, 110, 0] },
          ],
        },
        s: { a: 0, k: [100, 100, 100] },
      },
      ao: 0,
      shapes: [
        {
          ty: 'gr',
          it: [
            { ty: 'el', d: 1, s: { a: 0, k: [30, 30] }, p: { a: 0, k: [0, -30] } },
            { ty: 'rc', d: 1, s: { a: 0, k: [30, 55] }, p: { a: 0, k: [0, 0] }, r: { a: 0, k: 8 } },
            {
              ty: 'rc',
              d: 1,
              s: { a: 0, k: [55, 40] },
              p: { a: 0, k: [0, 40] },
              r: { a: 0, k: 12 },
            },
            { ty: 'fl', c: { a: 0, k: [1, 0.87, 0.7, 1] }, o: { a: 0, k: 100 }, r: 1 },
            {
              ty: 'tr',
              p: { a: 0, k: [0, 0] },
              s: { a: 0, k: [100, 100] },
              r: { a: 0, k: 0 },
              o: { a: 0, k: 100 },
            },
          ],
        },
        {
          ty: 'gr',
          it: [
            { ty: 'rc', d: 1, s: { a: 0, k: [26, 50] }, p: { a: 0, k: [4, 2] }, r: { a: 0, k: 6 } },
            { ty: 'fl', c: { a: 0, k: [0.92, 0.75, 0.55, 1] }, o: { a: 0, k: 60 }, r: 1 },
            {
              ty: 'tr',
              p: { a: 0, k: [0, 0] },
              s: { a: 0, k: [100, 100] },
              r: { a: 0, k: 0 },
              o: { a: 0, k: 100 },
            },
          ],
        },
      ],
      ip: 0,
      op: 90,
    },
    {
      ddd: 0,
      ind: 5,
      ty: 4,
      nm: 'TapDot',
      sr: 1,
      ks: {
        o: {
          a: 1,
          k: [
            { i: { x: [0.4], y: [1] }, o: { x: [0.6], y: [0] }, t: 8, s: [0] },
            { i: { x: [0.4], y: [1] }, o: { x: [0.6], y: [0] }, t: 12, s: [100] },
            { i: { x: [0.4], y: [1] }, o: { x: [0.6], y: [0] }, t: 25, s: [100] },
            { t: 40, s: [0] },
          ],
        },
        p: { a: 0, k: [100, 70, 0] },
        s: {
          a: 1,
          k: [
            {
              i: { x: [0.4, 0.4, 0.4], y: [1, 1, 1] },
              o: { x: [0.6, 0.6, 0.6], y: [0, 0, 0] },
              t: 8,
              s: [50, 50, 100],
            },
            {
              i: { x: [0.4, 0.4, 0.4], y: [1, 1, 1] },
              o: { x: [0.6, 0.6, 0.6], y: [0, 0, 0] },
              t: 15,
              s: [100, 100, 100],
            },
            { t: 40, s: [140, 140, 100] },
          ],
        },
      },
      ao: 0,
      shapes: [
        {
          ty: 'gr',
          it: [
            { ty: 'el', d: 1, s: { a: 0, k: [14, 14] }, p: { a: 0, k: [0, 0] } },
            { ty: 'fl', c: { a: 0, k: [1, 1, 1, 1] }, o: { a: 0, k: 100 }, r: 1 },
            {
              ty: 'tr',
              p: { a: 0, k: [0, 0] },
              s: { a: 0, k: [100, 100] },
              r: { a: 0, k: 0 },
              o: { a: 0, k: 100 },
            },
          ],
        },
      ],
      ip: 0,
      op: 90,
    },
    {
      ddd: 0,
      ind: 6,
      ty: 4,
      nm: 'Background',
      sr: 1,
      ks: {
        o: { a: 0, k: 100 },
        p: { a: 0, k: [100, 100, 0] },
        s: { a: 0, k: [100, 100, 100] },
      },
      ao: 0,
      shapes: [
        {
          ty: 'gr',
          it: [
            {
              ty: 'rc',
              d: 1,
              s: { a: 0, k: [185, 185] },
              p: { a: 0, k: [0, 0] },
              r: { a: 0, k: 40 },
            },
            {
              ty: 'gf',
              o: { a: 0, k: 100 },
              r: 1,
              bm: 0,
              g: {
                p: 3,
                k: {
                  a: 0,
                  k: [0, 0.45, 0.25, 0.75, 0.5, 0.65, 0.35, 0.85, 1, 0.75, 0.45, 0.95],
                },
              },
              s: { a: 0, k: [-100, -100] },
              e: { a: 0, k: [100, 100] },
              t: 1,
            },
            {
              ty: 'tr',
              p: { a: 0, k: [0, 0] },
              s: { a: 0, k: [100, 100] },
              r: { a: 0, k: 0 },
              o: { a: 0, k: 100 },
            },
          ],
        },
      ],
      ip: 0,
      op: 90,
    },
  ],
  markers: [],
};

export function AnimatedLogoLottie({
  size = 48,
  className = '',
}: {
  size?: number;
  className?: string;
}) {
  return (
    <div
      className={`rounded-xl overflow-hidden shadow-lg ${className}`}
      style={{ width: size, height: size }}
    >
      <Lottie
        animationData={clickAnimation}
        loop={true}
        autoplay={true}
        style={{ width: size, height: size }}
      />
    </div>
  );
}
