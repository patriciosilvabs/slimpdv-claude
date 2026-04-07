/**
 * Audio engine for notifications.
 *
 * Strategy:
 *  1. On first user interaction, AudioContext is created + resumed and common
 *     sounds are pre-decoded into AudioBuffers (cached).
 *  2. Playback uses Web Audio API (BufferSource) which continues working even
 *     when the tab is minimised or in the background — unlike HTMLAudioElement
 *     which is throttled/suspended by the browser in background tabs.
 *  3. HTMLAudioElement is kept only as a last-resort fallback when Web Audio
 *     fails completely (e.g. older mobile browsers).
 */

// ─── AudioContext ────────────────────────────────────────────────────────────

let _audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!_audioCtx || _audioCtx.state === 'closed') {
    _audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  return _audioCtx;
}

async function ensureAudioContextRunning(): Promise<AudioContext> {
  let ctx = getAudioContext();
  if (ctx.state === 'suspended') {
    try {
      await ctx.resume();
    } catch {
      _audioCtx = null;
      ctx = getAudioContext();
    }
  }
  if (ctx.state === 'closed') {
    _audioCtx = null;
    ctx = getAudioContext();
  }
  return ctx;
}

// ─── WAV generation ──────────────────────────────────────────────────────────

function createWavBlob(samples: Float32Array, sampleRate: number): Blob {
  const numChannels = 1;
  const bitsPerSample = 16;
  const bytesPerSample = bitsPerSample / 8;
  const blockAlign = numChannels * bytesPerSample;
  const dataSize = samples.length * blockAlign;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };
  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    offset += 2;
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.readAsDataURL(blob);
  });
}

function generateSamples(
  sampleRate: number,
  segments: { freq: number; duration: number; type: 'sine' | 'square'; volume: number; decay?: boolean }[],
  gapMs = 0
): Float32Array {
  const gapSamples = Math.floor((gapMs / 1000) * sampleRate);
  let totalSamples = 0;
  for (const seg of segments) {
    totalSamples += Math.floor(seg.duration * sampleRate) + gapSamples;
  }
  totalSamples -= gapSamples;

  const samples = new Float32Array(totalSamples);
  let offset = 0;

  for (let si = 0; si < segments.length; si++) {
    const seg = segments[si];
    const len = Math.floor(seg.duration * sampleRate);
    for (let i = 0; i < len; i++) {
      const t = i / sampleRate;
      let val: number;
      if (seg.type === 'square') {
        val = Math.sin(2 * Math.PI * seg.freq * t) >= 0 ? 1 : -1;
      } else {
        val = Math.sin(2 * Math.PI * seg.freq * t);
      }
      const envelope = seg.decay ? Math.exp(-3 * (i / len)) : 1;
      samples[offset + i] = val * seg.volume * envelope;
    }
    offset += len;
    if (si < segments.length - 1) offset += gapSamples;
  }
  return samples;
}

/** Generate WAV blob for a given sound ID. */
function generateSoundBlob(soundId: string): Blob {
  const sampleRate = 22050;
  let samples: Float32Array;

  switch (soundId) {
    case 'beepClassic':
      samples = generateSamples(sampleRate, [
        { freq: 800, duration: 0.2, type: 'square', volume: 0.5 },
      ]);
      break;

    case 'bell':
      samples = generateSamples(sampleRate, [
        { freq: 1200, duration: 0.4, type: 'sine', volume: 0.7, decay: true },
      ]);
      break;

    case 'dingDong':
      samples = generateSamples(sampleRate, [
        { freq: 880, duration: 0.25, type: 'sine', volume: 0.6, decay: true },
        { freq: 660, duration: 0.35, type: 'sine', volume: 0.6, decay: true },
      ]);
      break;

    case 'urgentAlert':
      samples = generateSamples(sampleRate, [
        { freq: 1000, duration: 0.1, type: 'square', volume: 0.6 },
        { freq: 1000, duration: 0.1, type: 'square', volume: 0.6 },
        { freq: 1000, duration: 0.1, type: 'square', volume: 0.6 },
      ], 80);
      break;

    case 'cashRegister': {
      const len = Math.floor(0.3 * sampleRate);
      samples = new Float32Array(len);
      for (let i = 0; i < len; i++) {
        const t = i / sampleRate;
        const progress = i / len;
        const freq = 1400 - 600 * progress;
        samples[i] = Math.sin(2 * Math.PI * freq * t) * 0.6 * (1 - progress * 0.5);
      }
      break;
    }

    default:
      samples = generateSamples(sampleRate, [
        { freq: 800, duration: 0.2, type: 'square', volume: 0.5 },
      ]);
  }

  return createWavBlob(samples, sampleRate);
}

// ─── Caches ──────────────────────────────────────────────────────────────────

/** Data-URL cache (for legacy/fallback paths) */
const _dataUrlCache = new Map<string, string>();

/** Pre-decoded AudioBuffer cache — used for background-safe playback */
const _bufferCache = new Map<string, AudioBuffer>();

/** Returns a data URL for the given sound (legacy, for <audio> elements) */
export async function getPredefinedSoundUrl(soundId: string): Promise<string> {
  if (_dataUrlCache.has(soundId)) return _dataUrlCache.get(soundId)!;
  const blob = generateSoundBlob(soundId);
  const url = await blobToDataUrl(blob);
  _dataUrlCache.set(soundId, url);
  return url;
}

/** Returns a decoded AudioBuffer, decoding from scratch if not cached. */
async function getDecodedBuffer(soundId: string): Promise<AudioBuffer> {
  if (_bufferCache.has(soundId)) return _bufferCache.get(soundId)!;
  const ctx = await ensureAudioContextRunning();
  const blob = generateSoundBlob(soundId);
  const arrayBuffer = await blob.arrayBuffer();
  const decoded = await ctx.decodeAudioData(arrayBuffer);
  _bufferCache.set(soundId, decoded);
  return decoded;
}

// ─── Unlock + prewarm ────────────────────────────────────────────────────────

const COMMON_SOUNDS = ['dingDong', 'beepClassic', 'bell', 'urgentAlert'];
let _prewarmed = false;

/**
 * Call once inside a user-gesture handler (click / touchstart) to:
 *  1. Resume the AudioContext
 *  2. Pre-decode common sounds into AudioBuffers so they're ready for
 *     immediate background playback.
 */
export function unlockAudioContext(): void {
  const ctx = getAudioContext();
  const doResume = ctx.state === 'suspended'
    ? ctx.resume()
    : Promise.resolve();

  doResume.then(() => {
    if (_prewarmed) return;
    _prewarmed = true;
    // Pre-decode common sounds in background (non-blocking)
    for (const id of COMMON_SOUNDS) {
      getDecodedBuffer(id).catch(() => {});
    }
  }).catch(() => {});
}

// ─── Playback ─────────────────────────────────────────────────────────────────

/** Debounce lock: prevent same sound from firing twice within 500 ms */
const _playingLocks = new Map<string, number>();

/**
 * Play a sound via Web Audio API (works in background tabs / minimised window).
 * Falls back to HTMLAudioElement if Web Audio fails.
 */
export async function playPredefinedSound(soundId: string, volume = 0.7): Promise<void> {
  const now = Date.now();
  if (now - (_playingLocks.get(soundId) ?? 0) < 500) return;
  _playingLocks.set(soundId, now);

  try {
    const ctx = await ensureAudioContextRunning();
    const buffer = await getDecodedBuffer(soundId);

    const source = ctx.createBufferSource();
    const gain = ctx.createGain();
    gain.gain.value = Math.max(0, Math.min(1, volume));
    source.buffer = buffer;
    source.connect(gain);
    gain.connect(ctx.destination);
    source.start(0);
  } catch (webAudioErr) {
    console.warn('[sound] Web Audio failed, trying HTMLAudioElement:', soundId, webAudioErr);
    try {
      const url = await getPredefinedSoundUrl(soundId);
      const audio = new Audio(url);
      audio.volume = Math.max(0, Math.min(1, volume));
      await audio.play();
    } catch (fallbackErr) {
      console.warn('[sound] HTMLAudioElement fallback also failed:', soundId, fallbackErr);
    }
  }
}

/**
 * Play any audio URL (http/https or data:) via Web Audio API.
 * Used for custom sounds uploaded by the user.
 * Falls back to HTMLAudioElement if Web Audio fails.
 */
export async function playAudioUrl(url: string, volume = 0.7): Promise<void> {
  try {
    const ctx = await ensureAudioContextRunning();
    const resp = await fetch(url);
    const arrayBuffer = await resp.arrayBuffer();
    const buffer = await ctx.decodeAudioData(arrayBuffer);

    const source = ctx.createBufferSource();
    const gain = ctx.createGain();
    gain.gain.value = Math.max(0, Math.min(1, volume));
    source.buffer = buffer;
    source.connect(gain);
    gain.connect(ctx.destination);
    source.start(0);
  } catch (webAudioErr) {
    console.warn('[sound] playAudioUrl Web Audio failed, trying HTMLAudioElement:', webAudioErr);
    try {
      const audio = new Audio(url);
      audio.volume = Math.max(0, Math.min(1, volume));
      await audio.play();
    } catch (fallbackErr) {
      console.warn('[sound] playAudioUrl fallback also failed:', fallbackErr);
    }
  }
}
