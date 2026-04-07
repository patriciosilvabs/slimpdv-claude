import { useState, useCallback } from 'react';
import { toast } from 'sonner';

export interface OpenAIVoice {
  id: string;
  name: string;
  description: string;
  gender: 'male' | 'female' | 'neutral';
}

// Available OpenAI TTS voices
export const OPENAI_VOICES: OpenAIVoice[] = [
  // Vozes originais
  { id: 'alloy', name: 'Alloy', description: 'Voz neutra e versátil', gender: 'neutral' },
  { id: 'echo', name: 'Echo', description: 'Voz masculina profunda e clara', gender: 'male' },
  { id: 'fable', name: 'Fable', description: 'Voz masculina expressiva e narrativa', gender: 'male' },
  { id: 'nova', name: 'Nova', description: 'Voz feminina expressiva e natural', gender: 'female' },
  { id: 'onyx', name: 'Onyx', description: 'Voz masculina grave e profissional', gender: 'male' },
  { id: 'shimmer', name: 'Shimmer', description: 'Voz feminina suave e acolhedora', gender: 'female' },
  // Novas vozes (Out/2024)
  { id: 'ash', name: 'Ash', description: 'Voz masculina expressiva e dinâmica', gender: 'male' },
  { id: 'ballad', name: 'Ballad', description: 'Voz feminina melódica e narrativa', gender: 'female' },
  { id: 'coral', name: 'Coral', description: 'Voz feminina calorosa e acolhedora', gender: 'female' },
  { id: 'sage', name: 'Sage', description: 'Voz masculina calma e sábia', gender: 'male' },
  { id: 'verse', name: 'Verse', description: 'Voz masculina versátil e envolvente', gender: 'male' },
];

export const OPENAI_MODELS = [
  { id: 'tts-1', name: 'TTS-1', description: 'Rápido (alertas)' },
  { id: 'tts-1-hd', name: 'TTS-1 HD', description: 'Alta qualidade' },
];

export function useOpenAITTS() {
  const [isLoading, setIsLoading] = useState(false);
  const [currentAudio, setCurrentAudio] = useState<HTMLAudioElement | null>(null);

  const generateAudio = useCallback(async (
    text: string, 
    voice: string = 'nova',
    model: string = 'tts-1'
  ): Promise<Blob | null> => {
    if (!text.trim()) {
      toast.error('Digite o texto para gerar o áudio');
      return null;
    }

    setIsLoading(true);
    
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/openai-tts`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ text, voice, model }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Erro: ${response.status}`);
      }

      const audioBlob = await response.blob();
      return audioBlob;
    } catch (error) {
      console.error('Error generating TTS:', error);
      toast.error('Erro ao gerar áudio: ' + (error as Error).message);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const previewAudio = useCallback(async (
    text: string,
    voice: string = 'nova',
    model: string = 'tts-1'
  ): Promise<string | null> => {
    // Stop current audio if playing
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.src = '';
      setCurrentAudio(null);
    }

    const blob = await generateAudio(text, voice, model);
    if (!blob) return null;

    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    
    audio.onended = () => {
      setCurrentAudio(null);
    };
    
    setCurrentAudio(audio);
    audio.play().catch(console.warn);
    
    return url;
  }, [generateAudio, currentAudio]);

  const stopAudio = useCallback(() => {
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.src = '';
      setCurrentAudio(null);
    }
  }, [currentAudio]);

  const isPlaying = currentAudio !== null && !currentAudio.paused;

  return {
    voices: OPENAI_VOICES,
    models: OPENAI_MODELS,
    isLoading,
    isPlaying,
    generateAudio,
    previewAudio,
    stopAudio,
  };
}
