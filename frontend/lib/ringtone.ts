/**
 * Ringtone manager for voice and video calls.
 *
 * Uses the Web Audio API to generate pleasant ringtones without any external
 * audio files. Two tones are provided:
 *   - **incoming**: a repeated two-note chime (like a phone ringing)
 *   - **outgoing**: a steady "ringback" tone (single beep with pauses)
 *
 * Usage:
 *   import { Ringtone } from '@/lib/ringtone';
 *
 *   // Start playing
 *   Ringtone.play('incoming');   // or 'outgoing'
 *
 *   // Stop when call is answered / rejected / ended
 *   Ringtone.stop();
 */

type ToneType = 'incoming' | 'outgoing';

let audioContext: AudioContext | null = null;
let activeOscillators: OscillatorNode[] = [];
let activeGains: GainNode[] = [];
let loopTimer: ReturnType<typeof setInterval> | null = null;
let isPlaying = false;
let currentType: ToneType | null = null;

function getAudioContext(): AudioContext {
  if (!audioContext || audioContext.state === 'closed') {
    audioContext = new AudioContext();
  }
  if (audioContext.state === 'suspended') {
    audioContext.resume().catch(() => {});
  }
  return audioContext;
}

/**
 * Play two quick chime notes — a pleasant "incoming call" sound.
 * Repeats every ~2 seconds until stopped.
 */
function playIncomingChime() {
  const ctx = getAudioContext();

  const playChime = () => {
    // First note
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.value = 880; // A5
    gain1.gain.setValueAtTime(0, ctx.currentTime);
    gain1.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.05);
    gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(ctx.currentTime);
    osc1.stop(ctx.currentTime + 0.4);

    // Second note (slightly higher, starts after first)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.value = 1108.73; // C#6
    gain2.gain.setValueAtTime(0, ctx.currentTime + 0.15);
    gain2.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.2);
    gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(ctx.currentTime + 0.15);
    osc2.stop(ctx.currentTime + 0.6);

    // Third note for a pleasant tri-tone
    const osc3 = ctx.createOscillator();
    const gain3 = ctx.createGain();
    osc3.type = 'sine';
    osc3.frequency.value = 1318.51; // E6
    gain3.gain.setValueAtTime(0, ctx.currentTime + 0.3);
    gain3.gain.linearRampToValueAtTime(0.25, ctx.currentTime + 0.35);
    gain3.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);
    osc3.connect(gain3);
    gain3.connect(ctx.destination);
    osc3.start(ctx.currentTime + 0.3);
    osc3.stop(ctx.currentTime + 0.8);

    activeOscillators.push(osc1, osc2, osc3);
    activeGains.push(gain1, gain2, gain3);
  };

  playChime();
  loopTimer = setInterval(playChime, 2000);
}

/**
 * Play a classic "ringback" tone — a single mid-frequency beep with pauses.
 * Mimics the sound you hear when calling someone and waiting for them to pick up.
 * Pattern: 1s on, 3s off (standard North American ringback).
 */
function playOutgoingRingback() {
  const ctx = getAudioContext();

  const playBeep = () => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 440; // A4
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.15, ctx.currentTime + 0.05);
    gain.gain.setValueAtTime(0.15, ctx.currentTime + 0.95);
    gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 1.0);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 1.0);
    activeOscillators.push(osc);
    activeGains.push(gain);
  };

  playBeep();
  loopTimer = setInterval(playBeep, 4000); // 1s tone + 3s silence
}

function stopAll() {
  if (loopTimer) {
    clearInterval(loopTimer);
    loopTimer = null;
  }
  for (const osc of activeOscillators) {
    try {
      osc.stop();
    } catch {
      // Already stopped
    }
    try {
      osc.disconnect();
    } catch {
      // Already disconnected
    }
  }
  for (const gain of activeGains) {
    try {
      gain.disconnect();
    } catch {
      // Already disconnected
    }
  }
  activeOscillators = [];
  activeGains = [];
  isPlaying = false;
  currentType = null;
}

export const Ringtone = {
  /**
   * Start playing a ringtone. If already playing the same type, does nothing.
   * If playing a different type, stops the current one first.
   */
  play(type: ToneType) {
    if (typeof window === 'undefined') return;
    if (isPlaying && currentType === type) return;
    if (isPlaying) stopAll();

    isPlaying = true;
    currentType = type;

    try {
      if (type === 'incoming') {
        playIncomingChime();
      } else {
        playOutgoingRingback();
      }
    } catch (e) {
      console.warn('[Ringtone] Failed to play:', e);
      isPlaying = false;
      currentType = null;
    }
  },

  /** Stop any currently playing ringtone. */
  stop() {
    if (typeof window === 'undefined') return;
    stopAll();
  },

  /** Check if a ringtone is currently playing. */
  isPlaying(): boolean {
    return isPlaying;
  },
};
