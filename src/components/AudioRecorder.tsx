import { useState, useRef, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Mic, Square, Play, Pause, Trash2, Save } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AudioRecorderProps {
  onSave: (blob: Blob) => void;
  onCancel: () => void;
  maxDuration?: number; // seconds
}

export function AudioRecorder({ onSave, onCancel, maxDuration = 60 }: AudioRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (recordedUrl) URL.revokeObjectURL(recordedUrl);
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, [recordedUrl]);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        setRecordedBlob(blob);
        const url = URL.createObjectURL(blob);
        setRecordedUrl(url);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start(100);
      setIsRecording(true);
      setDuration(0);

      timerRef.current = setInterval(() => {
        setDuration(prev => {
          if (prev >= maxDuration) {
            stopRecording();
            return prev;
          }
          return prev + 1;
        });
      }, 1000);
    } catch (error) {
      console.error('Erro ao acessar microfone:', error);
    }
  }, [maxDuration]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  }, [isRecording]);

  const playRecording = useCallback(() => {
    if (recordedUrl) {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      const audio = new Audio(recordedUrl);
      audioRef.current = audio;
      audio.onended = () => setIsPlaying(false);
      audio.play();
      setIsPlaying(true);
    }
  }, [recordedUrl]);

  const pausePlayback = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
    }
  }, []);

  const discardRecording = useCallback(() => {
    if (recordedUrl) URL.revokeObjectURL(recordedUrl);
    setRecordedBlob(null);
    setRecordedUrl(null);
    setDuration(0);
    onCancel();
  }, [recordedUrl, onCancel]);

  const saveRecording = useCallback(() => {
    if (recordedBlob) {
      onSave(recordedBlob);
    }
  }, [recordedBlob, onSave]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const progress = (duration / maxDuration) * 100;

  return (
    <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
      {!recordedBlob ? (
        // Recording UI
        <>
          <div className="flex items-center justify-center gap-4">
            {isRecording ? (
              <div className={cn(
                "w-4 h-4 rounded-full bg-red-500",
                "animate-pulse"
              )} />
            ) : (
              <Mic className="h-5 w-5 text-muted-foreground" />
            )}
            <span className="font-mono text-2xl font-bold">
              {formatTime(duration)}
            </span>
            <span className="text-sm text-muted-foreground">
              / {formatTime(maxDuration)}
            </span>
          </div>

          <Progress value={progress} className="h-2" />

          <div className="flex justify-center gap-3">
            {!isRecording ? (
              <Button onClick={startRecording} className="gap-2">
                <Mic className="h-4 w-4" />
                Iniciar Gravação
              </Button>
            ) : (
              <Button onClick={stopRecording} variant="destructive" className="gap-2">
                <Square className="h-4 w-4" />
                Parar
              </Button>
            )}
            <Button variant="outline" onClick={onCancel}>
              Cancelar
            </Button>
          </div>
        </>
      ) : (
        // Playback UI
        <>
          <div className="flex items-center justify-center gap-4">
            <span className="text-sm text-muted-foreground">Gravação:</span>
            <span className="font-mono text-xl font-bold">
              {formatTime(duration)}
            </span>
          </div>

          <div className="flex justify-center gap-3">
            {!isPlaying ? (
              <Button onClick={playRecording} variant="outline" className="gap-2">
                <Play className="h-4 w-4" />
                Ouvir
              </Button>
            ) : (
              <Button onClick={pausePlayback} variant="outline" className="gap-2">
                <Pause className="h-4 w-4" />
                Pausar
              </Button>
            )}
            <Button onClick={saveRecording} className="gap-2">
              <Save className="h-4 w-4" />
              Salvar
            </Button>
            <Button onClick={discardRecording} variant="ghost" className="gap-2 text-destructive">
              <Trash2 className="h-4 w-4" />
              Descartar
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
