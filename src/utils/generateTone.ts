// Generates valid audio tones programmatically using Web Audio API

const audioCache = new Map<string, string>();

// Shared AudioContext — must be resumed via user gesture before audio can play.
let _audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!_audioCtx || _audioCtx.state === 'closed') {
    _audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  return _audioCtx;
}

/** Call this once inside a user-gesture handler (click / touchstart) to unlock audio. */
export function unlockAudioContext(): void {
  const ctx = getAudioContext();
  if (ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
  }
}

/** Ensure the audio context is running before every playback attempt. */
async function ensureAudioContextRunning(): Promise<AudioContext> {
  let ctx = getAudioContext();
  if (ctx.state === 'suspended') {
    try {
      await ctx.resume();
    } catch (_) {
      // Resume failed — recreate context
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

function createWavBlob(samples: Float32Array, sampleRate: number): Blob {
  const numChannels = 1;
  const bitsPerSample = 16;
  const bytesPerSample = bitsPerSample / 8;
  const blockAlign = numChannels * bytesPerSample;
  const dataSize = samples.length * blockAlign;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  // WAV header
  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };
  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);

  // Write samples
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

// Simple tone generator
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
  totalSamples -= gapSamples; // no gap after last

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
    if (si < segments.length - 1) {
      offset += gapSamples; // silence gap
    }
  }

  return samples;
}

export async function getPredefinedSoundUrl(soundId: string): Promise<string> {
  if (audioCache.has(soundId)) return audioCache.get(soundId)!;

  const sampleRate = 22050;
  let samples: Float32Array;

  switch (soundId) {
    case 'beepClassic':
      // 800Hz square wave, 200ms
      samples = generateSamples(sampleRate, [
        { freq: 800, duration: 0.2, type: 'square', volume: 0.5 }
      ]);
      break;

    case 'bell':
      // 1200Hz sine with decay, 400ms
      samples = generateSamples(sampleRate, [
        { freq: 1200, duration: 0.4, type: 'sine', volume: 0.7, decay: true }
      ]);
      break;

    case 'dingDong':
      // Two notes: 880Hz then 660Hz
      samples = generateSamples(sampleRate, [
        { freq: 880, duration: 0.25, type: 'sine', volume: 0.6, decay: true },
        { freq: 660, duration: 0.35, type: 'sine', volume: 0.6, decay: true },
      ]);
      break;

    case 'urgentAlert':
      // 3 rapid beeps at 1000Hz
      samples = generateSamples(sampleRate, [
        { freq: 1000, duration: 0.1, type: 'square', volume: 0.6 },
        { freq: 1000, duration: 0.1, type: 'square', volume: 0.6 },
        { freq: 1000, duration: 0.1, type: 'square', volume: 0.6 },
      ], 80);
      break;

    case 'cashRegister':
      // Descending tone 1400→800Hz
      {
        const len = Math.floor(0.3 * sampleRate);
        samples = new Float32Array(len);
        for (let i = 0; i < len; i++) {
          const t = i / sampleRate;
          const progress = i / len;
          const freq = 1400 - 600 * progress;
          samples[i] = Math.sin(2 * Math.PI * freq * t) * 0.6 * (1 - progress * 0.5);
        }
      }
      break;

    default:
      // Fallback beep
      samples = generateSamples(sampleRate, [
        { freq: 800, duration: 0.2, type: 'square', volume: 0.5 }
      ]);
  }

  const blob = createWavBlob(samples, sampleRate);
  const url = await blobToDataUrl(blob);
  audioCache.set(soundId, url);
  return url;
}

// Debounce lock: prevent same sound from double-firing within 500ms
const _playingLocks = new Map<string, number>();

export async function playPredefinedSound(soundId: string, volume = 0.7): Promise<void> {
  // Deduplicate: if this exact sound fired less than 500ms ago, skip
  const now = Date.now();
  const lastPlayed = _playingLocks.get(soundId) ?? 0;
  if (now - lastPlayed < 500) return;
  _playingLocks.set(soundId, now);

  try {
    const url = await getPredefinedSoundUrl(soundId);
    const ctx = await ensureAudioContextRunning();

    // Decode the WAV data URL via fetch → ArrayBuffer → AudioBuffer
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer);

    const gainNode = ctx.createGain();
    gainNode.gain.value = volume;
    gainNode.connect(ctx.destination);

    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(gainNode);
    source.start();
  } catch (error) {
    console.warn('[sound] playPredefinedSound failed:', soundId, error);
  }
}
