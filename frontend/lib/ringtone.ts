/**
 * Ringtone manager for voice and video calls.
 *
 * - **incoming**: plays /saiyaara.mp3 at max volume (receiver hears this)
 * - **outgoing**: plays a simple ringback beep tone (caller hears this)
 *
 * Usage:
 *   import { Ringtone } from '@/lib/ringtone';
 *
 *   Ringtone.play('incoming');   // receiver's phone rings with saiyaara.mp3
 *   Ringtone.play('outgoing');   // caller hears ringback tone
 *   Ringtone.stop();
 */

type ToneType = 'incoming' | 'outgoing';

let audioElement: HTMLAudioElement | null = null;
let audioContext: AudioContext | null = null;
let activeOscillators: OscillatorNode[] = [];
let activeGains: GainNode[] = [];
let loopTimer: ReturnType<typeof setInterval> | null = null;
let isPlaying = false;
let currentType: ToneType | null = null;

// --- Incoming: saiyaara.mp3 at max volume ---

function getAudio(): HTMLAudioElement {
  if (!audioElement) {
    audioElement = new Audio('/saiyaara.mp3');
    audioElement.loop = true;
    audioElement.volume = 1.0; // Max volume
    audioElement.preload = 'auto';
  }
  return audioElement;
}

// Unlock audio playback on first user interaction (required by mobile browsers).
// We play a silent snippet so the Audio element is "warm" and can be triggered
// programmatically later (e.g. on incoming call via socket event).
if (typeof window !== 'undefined') {
  const unlock = () => {
    const audio = getAudio();
    audio.muted = true;
    audio
      .play()
      .then(() => {
        audio.pause();
        audio.muted = false;
        audio.currentTime = 0;
        console.log('[Ringtone] Audio unlocked for autoplay');
      })
      .catch(() => {
        // Retry on next interaction
        return;
      });
    window.removeEventListener('click', unlock);
    window.removeEventListener('touchstart', unlock);
    window.removeEventListener('touchend', unlock);
    window.removeEventListener('keydown', unlock);
  };
  window.addEventListener('click', unlock, { once: false });
  window.addEventListener('touchstart', unlock, { once: false });
  window.addEventListener('touchend', unlock, { once: false });
  window.addEventListener('keydown', unlock, { once: false });
}

function playIncomingRingtone() {
  const audio = getAudio();
  audio.volume = 1.0;
  audio.currentTime = 0;
  const playPromise = audio.play();
  if (playPromise) {
    playPromise.catch((e) => {
      console.warn('[Ringtone] Autoplay blocked, retrying with user gesture workaround:', e);
      // Fallback: try Web Audio API beep so the user at least hears something
      try {
        const ctx = getAudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = 880;
        gain.gain.value = 0.5;
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.5);
        activeOscillators.push(osc);
        activeGains.push(gain);
        // Keep retrying the mp3 every 500ms
        const retryInterval = setInterval(() => {
          if (!isPlaying || currentType !== 'incoming') {
            clearInterval(retryInterval);
            return;
          }
          audio
            .play()
            .then(() => {
              clearInterval(retryInterval);
              console.log('[Ringtone] saiyaara.mp3 playback started on retry');
            })
            .catch(() => {
              /* still blocked, will retry */
            });
        }, 500);
      } catch {
        // Web Audio also blocked — nothing we can do
        isPlaying = false;
        currentType = null;
      }
    });
  }
}

// --- Outgoing: simple ringback beep via Web Audio API ---

function getAudioContext(): AudioContext {
  if (!audioContext || audioContext.state === 'closed') {
    audioContext = new AudioContext();
  }
  if (audioContext.state === 'suspended') {
    audioContext.resume().catch(() => {});
  }
  return audioContext;
}

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

// --- Stop ---

function stopAll() {
  // Stop mp3 audio
  if (audioElement) {
    audioElement.pause();
    audioElement.currentTime = 0;
  }

  // Stop Web Audio oscillators
  if (loopTimer) {
    clearInterval(loopTimer);
    loopTimer = null;
  }
  for (const osc of activeOscillators) {
    try {
      osc.stop();
    } catch {
      /* already stopped */
    }
    try {
      osc.disconnect();
    } catch {
      /* already disconnected */
    }
  }
  for (const gain of activeGains) {
    try {
      gain.disconnect();
    } catch {
      /* already disconnected */
    }
  }
  activeOscillators = [];
  activeGains = [];

  isPlaying = false;
  currentType = null;
}

export const Ringtone = {
  /**
   * Start playing a ringtone.
   * - 'incoming': saiyaara.mp3 at full volume (for receiver)
   * - 'outgoing': simple ringback beep (for caller)
   */
  play(type: ToneType) {
    if (typeof window === 'undefined') return;
    if (isPlaying && currentType === type) return;
    if (isPlaying) stopAll();

    isPlaying = true;
    currentType = type;

    try {
      if (type === 'incoming') {
        playIncomingRingtone();
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
