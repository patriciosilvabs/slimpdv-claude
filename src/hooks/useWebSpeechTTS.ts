import { useState, useEffect, useCallback, useRef } from 'react';

export interface WebSpeechVoice {
  name: string;
  lang: string;
  voiceURI: string;
  localService: boolean;
}

// Supported language prefixes - empty array means ALL voices
const SUPPORTED_LANGUAGES = ['pt', 'en', 'es', 'fr', 'de', 'it', 'ja', 'zh', 'ko', 'ru', 'nl', 'pl', 'ar', 'hi', 'tr'];

export const LANGUAGE_NAMES: Record<string, string> = {
  'pt': '🇧🇷 Português',
  'pt-BR': '🇧🇷 Português (Brasil)',
  'pt-PT': '🇵🇹 Português (Portugal)',
  'en': '🇺🇸 Inglês',
  'en-US': '🇺🇸 Inglês (EUA)',
  'en-GB': '🇬🇧 Inglês (Reino Unido)',
  'en-AU': '🇦🇺 Inglês (Austrália)',
  'en-IN': '🇮🇳 Inglês (Índia)',
  'es': '🇪🇸 Espanhol',
  'es-ES': '🇪🇸 Espanhol (Espanha)',
  'es-MX': '🇲🇽 Espanhol (México)',
  'es-US': '🇺🇸 Espanhol (EUA)',
  'es-AR': '🇦🇷 Espanhol (Argentina)',
  'fr': '🇫🇷 Francês',
  'fr-FR': '🇫🇷 Francês (França)',
  'fr-CA': '🇨🇦 Francês (Canadá)',
  'de': '🇩🇪 Alemão',
  'de-DE': '🇩🇪 Alemão (Alemanha)',
  'de-AT': '🇦🇹 Alemão (Áustria)',
  'it': '🇮🇹 Italiano',
  'it-IT': '🇮🇹 Italiano',
  'ja': '🇯🇵 Japonês',
  'ja-JP': '🇯🇵 Japonês',
  'zh': '🇨🇳 Chinês',
  'zh-CN': '🇨🇳 Chinês (Simplificado)',
  'zh-TW': '🇹🇼 Chinês (Tradicional)',
  'zh-HK': '🇭🇰 Chinês (Hong Kong)',
  'ko': '🇰🇷 Coreano',
  'ko-KR': '🇰🇷 Coreano',
  'ru': '🇷🇺 Russo',
  'ru-RU': '🇷🇺 Russo',
  'nl': '🇳🇱 Holandês',
  'nl-NL': '🇳🇱 Holandês',
  'pl': '🇵🇱 Polonês',
  'pl-PL': '🇵🇱 Polonês',
  'ar': '🇸🇦 Árabe',
  'ar-SA': '🇸🇦 Árabe',
  'hi': '🇮🇳 Hindi',
  'hi-IN': '🇮🇳 Hindi',
  'tr': '🇹🇷 Turco',
  'tr-TR': '🇹🇷 Turco',
};

export const getLanguageName = (langCode: string): string => {
  return LANGUAGE_NAMES[langCode] || LANGUAGE_NAMES[langCode.split('-')[0]] || langCode;
};

export const getLanguageFlag = (langCode: string): string => {
  const name = LANGUAGE_NAMES[langCode] || LANGUAGE_NAMES[langCode.split('-')[0]] || '';
  const match = name.match(/^(\p{Emoji})/u);
  return match ? match[1] : '🌐';
};

export function useWebSpeechTTS() {
  const [voices, setVoices] = useState<WebSpeechVoice[]>([]);
  const [isSupported, setIsSupported] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      setIsSupported(true);
      
      const loadVoices = () => {
        const availableVoices = window.speechSynthesis.getVoices();
        // Filter for supported languages, or show all if no filter
        const filtered = availableVoices
          .filter(v => SUPPORTED_LANGUAGES.length === 0 || 
            SUPPORTED_LANGUAGES.some(lang => v.lang.startsWith(lang)))
          .map(v => ({
            name: v.name,
            lang: v.lang,
            voiceURI: v.voiceURI,
            localService: v.localService
          }))
          .sort((a, b) => a.lang.localeCompare(b.lang));
        setVoices(filtered);
      };

      loadVoices();
      window.speechSynthesis.onvoiceschanged = loadVoices;

      return () => {
        window.speechSynthesis.onvoiceschanged = null;
      };
    }
  }, []);

  const getVoiceByURI = useCallback((voiceURI: string): SpeechSynthesisVoice | null => {
    const availableVoices = window.speechSynthesis.getVoices();
    return availableVoices.find(v => v.voiceURI === voiceURI) || null;
  }, []);

  const speak = useCallback((text: string, voiceURI?: string) => {
    if (!isSupported) return;

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    
    if (voiceURI) {
      const voice = getVoiceByURI(voiceURI);
      if (voice) utterance.voice = voice;
    }

    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    utteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  }, [isSupported, getVoiceByURI]);

  const cancelSpeech = useCallback(() => {
    if (isSupported) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
  }, [isSupported]);

  // Generate audio blob using MediaRecorder and AudioContext
  const generateAudioBlob = useCallback(async (text: string, voiceURI?: string): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      if (!isSupported) {
        reject(new Error('Web Speech API não suportada'));
        return;
      }

      try {
        // Create audio context for capturing
        const audioContext = new AudioContext();
        const destination = audioContext.createMediaStreamDestination();
        const mediaRecorder = new MediaRecorder(destination.stream, { mimeType: 'audio/webm' });
        const chunks: BlobPart[] = [];

        mediaRecorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunks.push(e.data);
        };

        mediaRecorder.onstop = () => {
          const blob = new Blob(chunks, { type: 'audio/webm' });
          audioContext.close();
          resolve(blob);
        };

        mediaRecorder.onerror = (e) => {
          audioContext.close();
          reject(e);
        };

        // Use oscillator to capture speech via system audio (workaround)
        // Note: Web Speech API doesn't provide direct audio stream access
        // This creates a silent placeholder - actual audio plays through speakers
        const utterance = new SpeechSynthesisUtterance(text);
        
        if (voiceURI) {
          const voice = getVoiceByURI(voiceURI);
          if (voice) utterance.voice = voice;
        }

        utterance.rate = 1.0;
        utterance.pitch = 1.0;

        let speechDuration = 0;
        const startTime = Date.now();

        utterance.onstart = () => {
          mediaRecorder.start();
        };

        utterance.onend = () => {
          speechDuration = Date.now() - startTime;
          setTimeout(() => {
            if (mediaRecorder.state === 'recording') {
              mediaRecorder.stop();
            }
          }, 100);
        };

        utterance.onerror = (e) => {
          if (mediaRecorder.state === 'recording') {
            mediaRecorder.stop();
          }
          reject(new Error('Erro na síntese de voz'));
        };

        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(utterance);

      } catch (error) {
        reject(error);
      }
    });
  }, [isSupported, getVoiceByURI]);

  // Get voices grouped by language
  const getVoicesByLanguage = useCallback((langPrefix: string) => {
    return voices.filter(v => v.lang.startsWith(langPrefix));
  }, [voices]);

  const ptVoices = voices.filter(v => v.lang.startsWith('pt'));
  const enVoices = voices.filter(v => v.lang.startsWith('en'));
  const esVoices = voices.filter(v => v.lang.startsWith('es'));
  const frVoices = voices.filter(v => v.lang.startsWith('fr'));
  const deVoices = voices.filter(v => v.lang.startsWith('de'));
  const itVoices = voices.filter(v => v.lang.startsWith('it'));
  const jaVoices = voices.filter(v => v.lang.startsWith('ja'));
  const zhVoices = voices.filter(v => v.lang.startsWith('zh'));
  const koVoices = voices.filter(v => v.lang.startsWith('ko'));
  const ruVoices = voices.filter(v => v.lang.startsWith('ru'));
  const otherVoices = voices.filter(v => 
    !['pt', 'en', 'es', 'fr', 'de', 'it', 'ja', 'zh', 'ko', 'ru'].some(lang => v.lang.startsWith(lang))
  );

  return {
    voices,
    ptVoices,
    enVoices,
    esVoices,
    frVoices,
    deVoices,
    itVoices,
    jaVoices,
    zhVoices,
    koVoices,
    ruVoices,
    otherVoices,
    getVoicesByLanguage,
    isSupported,
    isSpeaking,
    speak,
    cancelSpeech,
    generateAudioBlob,
    getVoiceByURI
  };
}

// Default voices to show when no system voices available
export const DEFAULT_VOICES: WebSpeechVoice[] = [
  // Português
  { name: 'Google português do Brasil', lang: 'pt-BR', voiceURI: 'Google português do Brasil', localService: false },
  { name: 'Microsoft Maria', lang: 'pt-BR', voiceURI: 'Microsoft Maria - Portuguese (Brazil)', localService: true },
  { name: 'Google português de Portugal', lang: 'pt-PT', voiceURI: 'Google português de Portugal', localService: false },
  // Inglês
  { name: 'Google US English', lang: 'en-US', voiceURI: 'Google US English', localService: false },
  { name: 'Google UK English Female', lang: 'en-GB', voiceURI: 'Google UK English Female', localService: false },
  { name: 'Google UK English Male', lang: 'en-GB', voiceURI: 'Google UK English Male', localService: false },
  { name: 'Microsoft Zira', lang: 'en-US', voiceURI: 'Microsoft Zira - English (United States)', localService: true },
  { name: 'Microsoft David', lang: 'en-US', voiceURI: 'Microsoft David - English (United States)', localService: true },
  // Espanhol
  { name: 'Google español', lang: 'es-ES', voiceURI: 'Google español', localService: false },
  { name: 'Google español de Estados Unidos', lang: 'es-US', voiceURI: 'Google español de Estados Unidos', localService: false },
  // Francês
  { name: 'Google français', lang: 'fr-FR', voiceURI: 'Google français', localService: false },
  // Alemão
  { name: 'Google Deutsch', lang: 'de-DE', voiceURI: 'Google Deutsch', localService: false },
  // Italiano
  { name: 'Google italiano', lang: 'it-IT', voiceURI: 'Google italiano', localService: false },
  // Japonês
  { name: 'Google 日本語', lang: 'ja-JP', voiceURI: 'Google 日本語', localService: false },
  // Chinês
  { name: 'Google 普通话（中国大陆）', lang: 'zh-CN', voiceURI: 'Google 普通话（中国大陆）', localService: false },
  // Coreano
  { name: 'Google 한국의', lang: 'ko-KR', voiceURI: 'Google 한국의', localService: false },
  // Russo
  { name: 'Google русский', lang: 'ru-RU', voiceURI: 'Google русский', localService: false },
];
