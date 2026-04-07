/**
 * Audio conversion utilities for converting WAV to MP3 in the browser
 * Uses lamejs for encoding
 */

// @ts-ignore - lamejs doesn't have TypeScript types
import lamejs from 'lamejs';

/**
 * Detected audio format type
 */
export type AudioFormat = 'wav' | 'mp3' | 'webm' | 'ogg' | 'unknown';

/**
 * Detect audio format using magic bytes (file signature)
 * More reliable than trusting file.type
 */
export async function detectAudioFormat(file: File | Blob): Promise<AudioFormat> {
  try {
    const buffer = await file.slice(0, 12).arrayBuffer();
    const view = new DataView(buffer);
    const bytes = new Uint8Array(buffer);
    
    // Check RIFF/WAVE signature (WAV files)
    if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46) {
      // RIFF header found, check for WAVE format
      if (bytes[8] === 0x57 && bytes[9] === 0x41 && bytes[10] === 0x56 && bytes[11] === 0x45) {
        return 'wav';
      }
    }
    
    // Check for MP3 (ID3 tag or frame sync)
    if (bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) {
      return 'mp3'; // ID3 tag
    }
    // MP3 frame sync (0xFFE0 to 0xFFFF)
    if (bytes[0] === 0xFF && (bytes[1] & 0xE0) === 0xE0) {
      return 'mp3';
    }
    
    // Check for OGG
    if (bytes[0] === 0x4F && bytes[1] === 0x67 && bytes[2] === 0x67 && bytes[3] === 0x53) {
      return 'ogg';
    }
    
    // Check for WebM/Matroska
    if (bytes[0] === 0x1A && bytes[1] === 0x45 && bytes[2] === 0xDF && bytes[3] === 0xA3) {
      return 'webm';
    }
    
    return 'unknown';
  } catch {
    return 'unknown';
  }
}

/**
 * Check if a file is a WAV file based on magic bytes
 * Falls back to MIME type if magic bytes check fails
 */
export async function isWavFile(file: File | Blob): Promise<boolean> {
  const format = await detectAudioFormat(file);
  if (format === 'wav') return true;
  
  // Fallback to MIME type only if format is unknown
  if (format === 'unknown') {
    const type = file.type.toLowerCase();
    return type === 'audio/wav' || 
           type === 'audio/wave' || 
           type === 'audio/x-wav';
  }
  
  return false;
}

/**
 * Check if a file is a WAV file synchronously based on MIME type only
 * Use isWavFile for more accurate detection
 */
export function isWavFileMimeType(file: File | Blob): boolean {
  const type = file.type.toLowerCase();
  return type === 'audio/wav' || 
         type === 'audio/wave' || 
         type === 'audio/x-wav';
}

/**
 * Validate WAV header structure
 */
function isValidWavHeader(arrayBuffer: ArrayBuffer): boolean {
  if (arrayBuffer.byteLength < 44) return false;
  
  try {
    const view = new DataView(arrayBuffer);
    const bytes = new Uint8Array(arrayBuffer);
    
    // Check RIFF signature
    if (bytes[0] !== 0x52 || bytes[1] !== 0x49 || bytes[2] !== 0x46 || bytes[3] !== 0x46) {
      return false;
    }
    
    // Check WAVE format
    if (bytes[8] !== 0x57 || bytes[9] !== 0x41 || bytes[10] !== 0x56 || bytes[11] !== 0x45) {
      return false;
    }
    
    // Validate reasonable values
    const channels = view.getUint16(22, true);
    const sampleRate = view.getUint32(24, true);
    const bitsPerSample = view.getUint16(34, true);
    
    // Sanity checks
    if (channels < 1 || channels > 8) return false;
    if (sampleRate < 8000 || sampleRate > 192000) return false;
    if (bitsPerSample !== 8 && bitsPerSample !== 16 && bitsPerSample !== 24 && bitsPerSample !== 32) return false;
    
    return true;
  } catch {
    return false;
  }
}

/**
 * Convert a WAV blob to MP3 format
 * @param wavBlob The WAV audio blob to convert
 * @returns A new Blob containing the MP3 audio
 * @throws Error if the file is not a valid WAV or is too large
 */
export async function convertWavToMp3(wavBlob: Blob): Promise<Blob> {
  // Maximum file size: 100MB
  const MAX_FILE_SIZE = 100 * 1024 * 1024;
  if (wavBlob.size > MAX_FILE_SIZE) {
    throw new Error('Arquivo muito grande para conversão (máximo 100MB)');
  }
  
  const arrayBuffer = await wavBlob.arrayBuffer();
  
  // Validate WAV header
  if (!isValidWavHeader(arrayBuffer)) {
    throw new Error('Arquivo não é um WAV válido');
  }
  
  const dataView = new DataView(arrayBuffer);
  
  // Parse WAV header
  const channels = dataView.getUint16(22, true);
  const sampleRate = dataView.getUint32(24, true);
  const bitsPerSample = dataView.getUint16(34, true);
  
  // Find data chunk
  let dataOffset = 44; // Standard WAV header size
  let dataLength = arrayBuffer.byteLength - dataOffset;
  
  // Try to find actual data chunk position
  for (let i = 12; i < Math.min(arrayBuffer.byteLength - 8, 1000); i++) {
    const bytes = new Uint8Array(arrayBuffer, i, 4);
    // Check for 'data' chunk (0x64 0x61 0x74 0x61)
    if (bytes[0] === 0x64 && bytes[1] === 0x61 && bytes[2] === 0x74 && bytes[3] === 0x61) {
      dataOffset = i + 8;
      dataLength = dataView.getUint32(i + 4, true);
      break;
    }
  }
  
  // Calculate number of samples
  const bytesPerSample = bitsPerSample / 8;
  const numSamples = Math.floor(dataLength / (bytesPerSample * channels));
  
  // Safety check: prevent massive allocations
  const MAX_SAMPLES = 50 * 1024 * 1024; // 50M samples max
  if (numSamples * channels > MAX_SAMPLES) {
    throw new Error('Arquivo de áudio muito longo para conversão');
  }
  
  // Read samples as Int16
  const samples = new Int16Array(numSamples * channels);
  
  if (bitsPerSample === 16) {
    for (let i = 0; i < samples.length; i++) {
      samples[i] = dataView.getInt16(dataOffset + i * 2, true);
    }
  } else if (bitsPerSample === 8) {
    for (let i = 0; i < samples.length; i++) {
      // Convert 8-bit unsigned to 16-bit signed
      samples[i] = (dataView.getUint8(dataOffset + i) - 128) * 256;
    }
  } else if (bitsPerSample === 32) {
    for (let i = 0; i < samples.length; i++) {
      // Convert 32-bit float to 16-bit signed
      const floatValue = dataView.getFloat32(dataOffset + i * 4, true);
      samples[i] = Math.max(-32768, Math.min(32767, Math.round(floatValue * 32767)));
    }
  }
  
  // Initialize MP3 encoder
  const mp3Encoder = new lamejs.Mp3Encoder(channels, sampleRate, 128);
  const mp3Data: Int8Array[] = [];
  const sampleBlockSize = 1152;
  
  if (channels === 1) {
    // Mono
    for (let i = 0; i < samples.length; i += sampleBlockSize) {
      const chunk = samples.subarray(i, i + sampleBlockSize);
      const mp3buf = mp3Encoder.encodeBuffer(chunk);
      if (mp3buf.length > 0) mp3Data.push(new Int8Array(mp3buf));
    }
  } else {
    // Stereo - separate channels
    const left = new Int16Array(Math.floor(samples.length / 2));
    const right = new Int16Array(Math.floor(samples.length / 2));
    for (let i = 0, j = 0; i < samples.length - 1; i += 2, j++) {
      left[j] = samples[i];
      right[j] = samples[i + 1];
    }
    for (let i = 0; i < left.length; i += sampleBlockSize) {
      const leftChunk = left.subarray(i, i + sampleBlockSize);
      const rightChunk = right.subarray(i, i + sampleBlockSize);
      const mp3buf = mp3Encoder.encodeBuffer(leftChunk, rightChunk);
      if (mp3buf.length > 0) mp3Data.push(new Int8Array(mp3buf));
    }
  }
  
  // Flush the encoder
  const endBuf = mp3Encoder.flush();
  if (endBuf.length > 0) mp3Data.push(new Int8Array(endBuf));
  
  // Combine all chunks
  const totalLength = mp3Data.reduce((acc, chunk) => acc + chunk.length, 0);
  const mp3Array = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of mp3Data) {
    mp3Array.set(new Uint8Array(chunk.buffer, chunk.byteOffset, chunk.length), offset);
    offset += chunk.length;
  }
  
  return new Blob([mp3Array], { type: 'audio/mp3' });
}

/**
 * Get the file extension from a filename
 */
export function getFileExtension(filename: string): string {
  return filename.slice(filename.lastIndexOf('.')).toLowerCase();
}

/**
 * Replace the file extension with a new one
 */
export function replaceFileExtension(filename: string, newExtension: string): string {
  const lastDot = filename.lastIndexOf('.');
  if (lastDot === -1) return filename + newExtension;
  return filename.slice(0, lastDot) + newExtension;
}
