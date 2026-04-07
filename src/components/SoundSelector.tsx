import { useState, useRef, useCallback } from 'react';
import { playPredefinedSound, getPredefinedSoundUrl } from '@/utils/generateTone';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCustomSounds, SoundType } from '@/hooks/useCustomSounds';
import { useVoiceTextHistory } from '@/hooks/useVoiceTextHistory';
import { useOpenAITTS, OPENAI_VOICES } from '@/hooks/useOpenAITTS';
import { Play, Upload, Trash2, Music, Mic, Sparkles, RefreshCw, Check, Volume2, History, Square } from 'lucide-react';
import { toast } from 'sonner';
import { AudioRecorder } from '@/components/AudioRecorder';
import { Textarea } from '@/components/ui/textarea';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface SoundSelectorProps {
  soundType: SoundType;
  selectedSound: string;
  onSelect: (soundId: string, soundUrl: string) => void;
  disabled?: boolean;
}

export function SoundSelector({ soundType, selectedSound, onSelect, disabled }: SoundSelectorProps) {
  const { customSounds, uploadSound, deleteSound, getSoundsForType, predefinedSounds } = useCustomSounds();
  const { getHistory, addToHistory, clearHistory } = useVoiceTextHistory();
  const { 
    voices: openAIVoices,
    isLoading: isGeneratingVoice,
    isPlaying,
    generateAudio,
    previewAudio,
    stopAudio
  } = useOpenAITTS();
  
  const [isOpen, setIsOpen] = useState(false);
  const [uploadName, setUploadName] = useState('');
  const [isRecordingMode, setIsRecordingMode] = useState(false);
  const [voiceText, setVoiceText] = useState('Pedido cancelado, atenção cozinha');
  const [selectedVoice, setSelectedVoice] = useState('nova');
  const [previewAudioUrl, setPreviewAudioUrl] = useState<string | null>(null);
  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const customForType = getSoundsForType(soundType);
  const predefinedList = Object.entries(predefinedSounds);
  const history = getHistory();

  const currentVoiceInfo = OPENAI_VOICES.find(v => v.id === selectedVoice);

  const playSoundFromUrl = (url: string) => {
    const audio = new Audio(url);
    audio.play().catch(console.warn);
  };

  const playPredefined = useCallback((soundKey: string) => {
    playPredefinedSound(soundKey).catch(console.warn);
  }, []);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!uploadName.trim()) {
      toast.error('Digite um nome para o som');
      return;
    }

    if (file.size > 1024 * 1024) {
      toast.error('Arquivo muito grande (máx. 1MB)');
      return;
    }

    await uploadSound.mutateAsync({
      file,
      name: uploadName.trim(),
      soundType
    });

    setUploadName('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSaveRecording = async (blob: Blob) => {
    if (!uploadName.trim()) {
      toast.error('Digite um nome para a gravação');
      return;
    }

    const file = new File([blob], `recording_${Date.now()}.webm`, { 
      type: 'audio/webm' 
    });

    await uploadSound.mutateAsync({
      file,
      name: uploadName.trim(),
      soundType
    });

    setUploadName('');
    setIsRecordingMode(false);
  };

  const handlePreviewVoice = async () => {
    if (!voiceText.trim()) {
      toast.error('Digite o texto para ouvir');
      return;
    }

    if (isPlaying) {
      stopAudio();
    } else {
      await previewAudio(voiceText, selectedVoice);
    }
  };

  const handleGenerateVoice = async () => {
    if (!voiceText.trim() || !uploadName.trim()) {
      toast.error('Preencha o nome do som e o texto para gerar');
      return;
    }

    // Clean previous preview
    if (previewAudioUrl) {
      URL.revokeObjectURL(previewAudioUrl);
      setPreviewAudioUrl(null);
      setPreviewBlob(null);
    }

    const blob = await generateAudio(voiceText, selectedVoice);
    if (blob) {
      const tempUrl = URL.createObjectURL(blob);
      setPreviewAudioUrl(tempUrl);
      setPreviewBlob(blob);
      toast.success('Áudio gerado! Ouça o preview.');
    }
  };

  const handleConfirmVoice = async () => {
    if (!previewBlob || !uploadName.trim()) return;
    
    try {
      addToHistory(voiceText, selectedVoice, currentVoiceInfo?.name || 'Voz OpenAI');
      
      const file = new File([previewBlob], `voice_${Date.now()}.mp3`, { type: 'audio/mpeg' });

      await uploadSound.mutateAsync({
        file,
        name: uploadName.trim(),
        soundType
      });

      if (previewAudioUrl) URL.revokeObjectURL(previewAudioUrl);
      setPreviewAudioUrl(null);
      setPreviewBlob(null);
      setVoiceText('Pedido cancelado, atenção cozinha');
      setUploadName('');
      toast.success('Áudio de voz salvo!');
    } catch (error) {
      toast.error('Erro ao salvar áudio: ' + (error as Error).message);
    }
  };

  const getCurrentSoundName = () => {
    const predefined = predefinedList.find(([key]) => key === selectedSound);
    if (predefined) return predefined[1].name;

    const custom = customSounds.find(s => s.id === selectedSound);
    if (custom) return custom.name;

    return 'Beep Clássico';
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button 
          variant="outline" 
          size="sm" 
          className="gap-2 text-xs"
          disabled={disabled}
        >
          <Music className="h-3 w-3" />
          {getCurrentSoundName()}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Selecionar Som</DialogTitle>
        </DialogHeader>

        <RadioGroup
          value={selectedSound}
          onValueChange={async (value) => {
            const predefined = predefinedList.find(([key]) => key === value);
            if (predefined) {
              const url = await getPredefinedSoundUrl(value);
              onSelect(value, url);
            } else {
              const custom = customSounds.find(s => s.id === value);
              if (custom) {
                onSelect(value, custom.file_path);
              }
            }
          }}
          className="space-y-2"
        >
          {/* Predefined Sounds */}
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Sons Pré-definidos</Label>
            {predefinedList.map(([key, sound]) => (
              <div 
                key={key} 
                className="flex items-center justify-between p-2 rounded-lg border hover:bg-muted/50"
              >
                <div className="flex items-center gap-3">
                  <RadioGroupItem value={key} id={key} />
                  <Label htmlFor={key} className="cursor-pointer">
                    {sound.name}
                  </Label>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={(e) => {
                    e.preventDefault();
                    playPredefined(key);
                  }}
                >
                  <Play className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>

          {/* Custom Sounds */}
          {customForType.length > 0 && (
            <div className="space-y-1 pt-2">
              <Label className="text-xs text-muted-foreground">Sons Personalizados</Label>
              {customForType.map((sound) => (
                <div 
                  key={sound.id} 
                  className="flex items-center justify-between p-2 rounded-lg border hover:bg-muted/50"
                >
                  <div className="flex items-center gap-3">
                    <RadioGroupItem value={sound.id} id={sound.id} />
                    <Label htmlFor={sound.id} className="cursor-pointer">
                      {sound.name}
                    </Label>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={(e) => {
                        e.preventDefault();
                        playSoundFromUrl(sound.file_path);
                      }}
                    >
                      <Play className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive"
                      onClick={(e) => {
                        e.preventDefault();
                        deleteSound.mutate(sound.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </RadioGroup>

        {/* Upload Custom Sound */}
        <div className="space-y-3 pt-4 border-t">
          <Label className="text-sm font-medium">Adicionar Som Personalizado</Label>
          <Input
            placeholder="Nome do som"
            value={uploadName}
            onChange={(e) => setUploadName(e.target.value)}
          />
          
          {isRecordingMode ? (
            <AudioRecorder
              onSave={handleSaveRecording}
              onCancel={() => setIsRecordingMode(false)}
              maxDuration={30}
            />
          ) : (
            <div className="flex gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="audio/*"
                className="hidden"
                onChange={handleFileSelect}
              />
              <Button
                variant="outline"
                className="flex-1 gap-2"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadSound.isPending || !uploadName.trim()}
              >
                <Upload className="h-4 w-4" />
                {uploadSound.isPending ? 'Enviando...' : 'Arquivo'}
              </Button>
              <Button
                variant="outline"
                className="flex-1 gap-2"
                onClick={() => setIsRecordingMode(true)}
                disabled={uploadSound.isPending || !uploadName.trim()}
              >
                <Mic className="h-4 w-4" />
                Gravar
              </Button>
            </div>
          )}
          
          <p className="text-xs text-muted-foreground">
            Formatos: MP3, WAV, OGG • Máx: 1MB • Gravação: até 30s
          </p>
        </div>

        {/* Voice Generation with OpenAI TTS */}
        <div className="space-y-3 pt-4 border-t">
          <Label className="text-sm font-medium flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Gerar Áudio com IA (OpenAI)
          </Label>
          
          {/* Voice Selection */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Voz Natural</Label>
            <Select value={selectedVoice} onValueChange={setSelectedVoice}>
              <SelectTrigger>
                <SelectValue>
                  {currentVoiceInfo ? `${currentVoiceInfo.name} - ${currentVoiceInfo.description}` : 'Selecione uma voz'}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {OPENAI_VOICES.map(voice => (
                  <SelectItem key={voice.id} value={voice.id}>
                    <div className="flex flex-col">
                      <span className="font-medium">{voice.name}</span>
                      <span className="text-xs text-muted-foreground">{voice.description}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <Textarea
            placeholder="Digite o texto para sintetizar (ex: 'Pedido cancelado, atenção cozinha!')"
            value={voiceText}
            onChange={(e) => setVoiceText(e.target.value)}
            rows={2}
            className="resize-none"
            maxLength={4096}
          />
          
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{voiceText.length}/4096 caracteres</span>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="h-6 gap-1 text-xs"
                onClick={handlePreviewVoice}
                disabled={!voiceText.trim() || isGeneratingVoice}
              >
                {isPlaying ? <Square className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                {isPlaying ? 'Parar' : isGeneratingVoice ? 'Gerando...' : 'Ouvir'}
              </Button>
              {history.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 gap-1 text-xs"
                  onClick={() => setShowHistory(!showHistory)}
                >
                  <History className="h-3 w-3" />
                  Histórico ({history.length})
                </Button>
              )}
            </div>
          </div>
          
          {/* Text History */}
          {showHistory && history.length > 0 && (
            <div className="space-y-2 p-2 border rounded-lg bg-background max-h-40 overflow-y-auto">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">Textos Recentes</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs text-destructive"
                  onClick={() => {
                    clearHistory();
                    setShowHistory(false);
                  }}
                >
                  <Trash2 className="h-3 w-3 mr-1" />
                  Limpar
                </Button>
              </div>
              {history.slice(0, 5).map(item => (
                <div
                  key={item.id}
                  className="flex items-start gap-2 p-2 rounded border hover:bg-muted/50 cursor-pointer"
                  onClick={() => {
                    setVoiceText(item.text);
                    if (item.voiceId) setSelectedVoice(item.voiceId);
                    setShowHistory(false);
                  }}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">{item.text}</p>
                    <p className="text-xs text-muted-foreground">
                      🎤 {item.voiceName} · {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true, locale: ptBR })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
          
          {/* Audio Preview */}
          {previewAudioUrl && (
            <div className="p-3 border rounded-lg bg-green-500/10 border-green-500/30 space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-green-600 dark:text-green-400">
                <Volume2 className="h-4 w-4" />
                Preview Gerado
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const audio = new Audio(previewAudioUrl);
                    audio.play();
                  }}
                  className="gap-2"
                >
                  <Play className="h-4 w-4" />
                  Ouvir
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleConfirmVoice}
                  className="gap-2 flex-1"
                >
                  <Check className="h-4 w-4" />
                  Salvar
                </Button>
              </div>
            </div>
          )}
          
          <Button
            variant={previewAudioUrl ? 'outline' : 'default'}
            className="w-full gap-2"
            onClick={handleGenerateVoice}
            disabled={isGeneratingVoice || !voiceText.trim() || !uploadName.trim()}
          >
            {isGeneratingVoice ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                Gerando com IA...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Gerar com Voz Natural
              </>
            )}
          </Button>
          
          <p className="text-xs text-muted-foreground">
            Usa OpenAI TTS para vozes naturais e expressivas. Suporta português.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
