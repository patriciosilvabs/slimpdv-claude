import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { AudioRecorder } from '@/components/AudioRecorder';
import { useScheduledAnnouncements, ScheduledAnnouncement } from '@/hooks/useScheduledAnnouncements';
import { useVoiceTextHistory } from '@/hooks/useVoiceTextHistory';
import { useOpenAITTS, OPENAI_VOICES } from '@/hooks/useOpenAITTS';
import { Megaphone, Plus, Mic, Upload, Play, Trash2, Edit, Calendar, Clock, Volume2, Activity, AlertTriangle, Timer, Sparkles, RefreshCw, Check, History, X, Square, Pause, TriangleAlert, Loader2 } from 'lucide-react';
import { convertWavToMp3, isWavFile, replaceFileExtension, detectAudioFormat } from '@/utils/audioConverter';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const DAYS_OF_WEEK = [
  { value: 1, label: 'Dom' },
  { value: 2, label: 'Seg' },
  { value: 3, label: 'Ter' },
  { value: 4, label: 'Qua' },
  { value: 5, label: 'Qui' },
  { value: 6, label: 'Sex' },
  { value: 7, label: 'Sáb' },
];

const TARGET_SCREENS = [
  { value: 'kds', label: 'KDS (Cozinha)' },
  { value: 'counter', label: 'Balcão' },
  { value: 'order-management', label: 'Gestão de Pedidos' },
];

const CONDITION_TYPES = [
  { value: 'orders_in_production', label: 'Pedidos em Produção', description: 'Pedidos com status "Em Preparo"', category: 'quantity' },
  { value: 'orders_pending', label: 'Pedidos Pendentes', description: 'Pedidos aguardando início do preparo', category: 'quantity' },
  { value: 'orders_total_active', label: 'Total de Pedidos Ativos', description: 'Soma de pendentes + em preparo + prontos', category: 'quantity' },
  { value: 'avg_wait_time', label: 'Tempo Médio de Espera', description: 'Média em minutos de todos os pedidos ativos', category: 'time', unit: 'min' },
  { value: 'max_wait_time', label: 'Pedido Mais Antigo', description: 'Tempo do pedido esperando há mais tempo', category: 'time', unit: 'min' },
  { value: 'delayed_orders_count', label: 'Pedidos Atrasados', description: 'Quantidade de pedidos acima do tempo limite', category: 'count', hasDelayThreshold: true },
];

const CONDITION_COMPARISONS = [
  { value: 'greater_than', label: 'Maior que' },
  { value: 'greater_than_or_equal', label: 'Maior ou igual a' },
  { value: 'less_than', label: 'Menor que' },
  { value: 'less_than_or_equal', label: 'Menor ou igual a' },
  { value: 'equals', label: 'Igual a' },
];

export function ScheduledAnnouncementsSettings() {
  const { 
    announcements, 
    isLoading,
    isCheckingCompatibility,
    createAnnouncement, 
    updateAnnouncement, 
    deleteAnnouncement,
    uploadRecording,
    playAnnouncement,
    audioErrors,
    clearAudioError
  } = useScheduledAnnouncements();

  const { getHistory, addToHistory, clearHistory } = useVoiceTextHistory();
  const { 
    voices: openAIVoices,
    isLoading: isGeneratingVoice,
    isPlaying,
    generateAudio,
    previewAudio,
    stopAudio
  } = useOpenAITTS();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] = useState<ScheduledAnnouncement | null>(null);
  const [audioSource, setAudioSource] = useState<'record' | 'upload' | 'generate' | null>(null);
  const [voiceText, setVoiceText] = useState('');
  const [selectedVoice, setSelectedVoice] = useState('nova');
  const [previewAudioUrl, setPreviewAudioUrl] = useState<string | null>(null);
  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  
  // States for upload preview
  const [uploadPreviewUrl, setUploadPreviewUrl] = useState<string | null>(null);
  const [uploadPreviewBlob, setUploadPreviewBlob] = useState<Blob | null>(null);
  const [uploadFileName, setUploadFileName] = useState<string>('');
  
  // States for audio preview playback
  const [previewingAudio, setPreviewingAudio] = useState<HTMLAudioElement | null>(null);
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);
  const [audioProgress, setAudioProgress] = useState(0);
  const [audioCurrentTime, setAudioCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  
  // State for date validation
  const [showDateError, setShowDateError] = useState(false);
  
  // State for WAV to MP3 conversion
  const [isConverting, setIsConverting] = useState(false);
  
  const [form, setForm] = useState({
    name: '',
    file_path: '',
    trigger_type: 'scheduled' as 'scheduled' | 'condition',
    schedule_type: 'daily' as 'once' | 'daily' | 'weekly',
    scheduled_time: '18:00',
    scheduled_days: [2, 3, 4, 5, 6], // Mon-Fri
    scheduled_date: '',
    condition_type: 'orders_in_production' as 'orders_in_production' | 'orders_pending' | 'orders_total_active' | 'avg_wait_time' | 'max_wait_time' | 'delayed_orders_count',
    condition_threshold: 15,
    condition_comparison: 'greater_than' as 'greater_than' | 'greater_than_or_equal' | 'less_than' | 'less_than_or_equal' | 'equals',
    cooldown_minutes: 30,
    delay_threshold_minutes: 20,
    target_screens: ['kds'],
    volume: 1.0,
    is_active: true
  });

  const history = getHistory();
  const currentVoiceInfo = OPENAI_VOICES.find(v => v.id === selectedVoice);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handlePlayPreview = () => {
    if (previewingAudio) {
      previewingAudio.pause();
      previewingAudio.currentTime = 0;
    }
    
    const audio = new Audio(form.file_path);
    audio.volume = form.volume;
    
    audio.onerror = () => {
      console.error('Erro ao carregar áudio:', audio.error);
      toast.error('Erro ao reproduzir áudio. O formato pode não ser suportado pelo navegador.');
      setIsPreviewPlaying(false);
      setPreviewingAudio(null);
      setAudioProgress(0);
      setAudioCurrentTime(0);
      setAudioDuration(0);
    };
    
    audio.onplay = () => setIsPreviewPlaying(true);
    audio.onloadedmetadata = () => setAudioDuration(audio.duration);
    audio.ontimeupdate = () => {
      if (audio.duration > 0) {
        setAudioProgress((audio.currentTime / audio.duration) * 100);
        setAudioCurrentTime(audio.currentTime);
      }
    };
    audio.onended = () => {
      setIsPreviewPlaying(false);
      setPreviewingAudio(null);
      setAudioProgress(0);
      setAudioCurrentTime(0);
    };
    audio.onpause = () => setIsPreviewPlaying(false);
    
    audio.play().catch(err => {
      console.error('Erro ao reproduzir:', err);
      toast.error('Não foi possível reproduzir o áudio: ' + err.message);
      setIsPreviewPlaying(false);
      setPreviewingAudio(null);
    });
    setPreviewingAudio(audio);
  };

  const handlePauseResume = () => {
    if (!previewingAudio) return;
    
    if (isPreviewPlaying) {
      previewingAudio.pause();
    } else {
      previewingAudio.play();
    }
  };

  const handleStopPreview = () => {
    if (previewingAudio) {
      previewingAudio.pause();
      previewingAudio.currentTime = 0;
      setPreviewingAudio(null);
    }
    setIsPreviewPlaying(false);
    setAudioProgress(0);
    setAudioCurrentTime(0);
    setAudioDuration(0);
  };

  const resetForm = () => {
    handleStopPreview();
    setForm({
      name: '',
      file_path: '',
      trigger_type: 'scheduled',
      schedule_type: 'daily',
      scheduled_time: '18:00',
      scheduled_days: [2, 3, 4, 5, 6],
      scheduled_date: '',
      condition_type: 'orders_in_production',
      condition_threshold: 15,
      condition_comparison: 'greater_than',
      cooldown_minutes: 30,
      delay_threshold_minutes: 20,
      target_screens: ['kds'],
      volume: 1.0,
      is_active: true
    });
    setEditingAnnouncement(null);
    setAudioSource(null);
    setVoiceText('');
    setPreviewAudioUrl(null);
    setPreviewBlob(null);
    setShowHistory(false);
    setShowDateError(false);
    // Clear upload preview states
    if (uploadPreviewUrl) URL.revokeObjectURL(uploadPreviewUrl);
    setUploadPreviewUrl(null);
    setUploadPreviewBlob(null);
    setUploadFileName('');
  };

  const handleOpenDialog = (announcement?: ScheduledAnnouncement) => {
    if (announcement) {
      setEditingAnnouncement(announcement);
      setForm({
        name: announcement.name,
        file_path: announcement.file_path,
        trigger_type: announcement.trigger_type || 'scheduled',
        schedule_type: announcement.schedule_type,
        scheduled_time: announcement.scheduled_time.slice(0, 5),
        scheduled_days: announcement.scheduled_days || [2, 3, 4, 5, 6],
        scheduled_date: announcement.scheduled_date || '',
        condition_type: announcement.condition_type || 'orders_in_production',
        condition_threshold: announcement.condition_threshold || 15,
        condition_comparison: announcement.condition_comparison || 'greater_than',
        cooldown_minutes: announcement.cooldown_minutes || 30,
        delay_threshold_minutes: announcement.delay_threshold_minutes || 20,
        target_screens: announcement.target_screens || ['kds'],
        volume: announcement.volume || 1.0,
        is_active: announcement.is_active
      });
    } else {
      resetForm();
    }
    setIsDialogOpen(true);
    setIsRecording(false);
  };

  const handleSaveRecording = async (blob: Blob) => {
    if (!form.name.trim()) {
      toast.error('Digite um nome para o anúncio');
      return;
    }

    try {
      const url = await uploadRecording(blob, form.name);
      setForm(prev => ({ ...prev, file_path: url }));
      setIsRecording(false);
      toast.success('Gravação salva! Configure o agendamento.');
    } catch (error: any) {
      toast.error('Erro ao salvar gravação: ' + error.message);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!form.name.trim()) {
      toast.error('Digite um nome para o anúncio primeiro');
      return;
    }

    // Validate file type
    const validTypes = ['audio/mpeg', 'audio/mp3', 'audio/webm', 'audio/wav', 'audio/ogg', 'audio/x-m4a', 'audio/mp4', 'audio/x-wav', 'audio/wave'];
    if (!validTypes.includes(file.type) && !file.type.startsWith('audio/')) {
      toast.error('Formato de áudio não suportado. Use MP3, WAV, OGG ou WebM.');
      return;
    }

    // Clear previous preview
    if (uploadPreviewUrl) {
      URL.revokeObjectURL(uploadPreviewUrl);
    }

    let processedBlob: Blob = file;
    let processedFileName = file.name;

    // Detect actual file format using magic bytes
    const detectedFormat = await detectAudioFormat(file);
    console.log('Formato detectado:', detectedFormat, 'MIME type:', file.type);

    // If WAV file, try to convert to MP3 for better compatibility
    if (detectedFormat === 'wav' || (detectedFormat === 'unknown' && await isWavFile(file))) {
      setIsConverting(true);
      try {
        toast.info('Convertendo WAV para MP3 para melhor compatibilidade...');
        processedBlob = await convertWavToMp3(file);
        processedFileName = replaceFileExtension(file.name, '.mp3');
        toast.success('Conversão concluída!');
      } catch (error: any) {
        console.warn('Conversão WAV para MP3 falhou:', error.message);
        // FALLBACK: try using the original file instead of blocking
        toast.warning('Não foi possível converter o arquivo. Testando formato original...');
        processedBlob = file;
        processedFileName = file.name;
      } finally {
        setIsConverting(false);
      }
    }

    // Test if audio can be loaded before accepting
    const testUrl = URL.createObjectURL(processedBlob);
    const testAudio = new Audio(testUrl);
    
    const canPlay = await new Promise<boolean>((resolve) => {
      const timeout = setTimeout(() => resolve(false), 15000); // Increased to 15s for larger files
      testAudio.onloadedmetadata = () => {
        clearTimeout(timeout);
        resolve(true);
      };
      testAudio.onerror = () => {
        clearTimeout(timeout);
        resolve(false);
      };
    });
    
    if (!canPlay) {
      URL.revokeObjectURL(testUrl);
      toast.error(
        'Este arquivo de áudio não é compatível com o navegador. Use formato MP3 (recomendado), WebM ou OGG.',
        { duration: 5000 }
      );
      return;
    }

    // Use the same URL for preview since it's valid
    setUploadPreviewUrl(testUrl);
    setUploadPreviewBlob(processedBlob);
    setUploadFileName(processedFileName);
    
    toast.success('Arquivo carregado! Ouça o preview e confirme.');
  };

  const handleConfirmUpload = async () => {
    if (!uploadPreviewBlob || !form.name.trim()) return;
    
    try {
      const url = await uploadRecording(uploadPreviewBlob, form.name);
      setForm(prev => ({ ...prev, file_path: url }));
      
      // Clear preview
      if (uploadPreviewUrl) URL.revokeObjectURL(uploadPreviewUrl);
      setUploadPreviewUrl(null);
      setUploadPreviewBlob(null);
      setUploadFileName('');
      setAudioSource(null);
      
      toast.success('Áudio enviado com sucesso!');
    } catch (error: any) {
      toast.error('Erro ao enviar áudio: ' + error.message);
    }
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
    if (!form.name.trim()) {
      toast.error('Digite um nome para o anúncio primeiro');
      return;
    }
    if (!voiceText.trim()) {
      toast.error('Digite o texto para gerar o áudio');
      return;
    }

    // Clear previous preview
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

  const handleConfirmAndSave = async () => {
    if (!previewBlob || !form.name.trim()) return;
    
    try {
      // Save to history
      addToHistory(voiceText, selectedVoice, currentVoiceInfo?.name || 'Voz OpenAI');
      
      const url = await uploadRecording(previewBlob, form.name);
      setForm(prev => ({ ...prev, file_path: url }));
      
      // Clear preview
      if (previewAudioUrl) URL.revokeObjectURL(previewAudioUrl);
      setPreviewAudioUrl(null);
      setPreviewBlob(null);
      setVoiceText('');
      setAudioSource(null);
      
      toast.success('Áudio salvo com sucesso!');
    } catch (error: any) {
      toast.error('Erro ao salvar áudio: ' + error.message);
    }
  };

  const handleSubmit = async () => {
    if (!form.name.trim() || !form.file_path) {
      toast.error('Preencha o nome e adicione um áudio');
      return;
    }

    // Validação: data obrigatória para tipo "once"
    if (form.trigger_type === 'scheduled' && form.schedule_type === 'once' && !form.scheduled_date) {
      setShowDateError(true);
      toast.error('Selecione uma data para o agendamento único');
      return;
    }

    try {
      if (editingAnnouncement) {
        await updateAnnouncement.mutateAsync({
          id: editingAnnouncement.id,
          ...form
        });
        // Clear audio error after successful update
        clearAudioError(editingAnnouncement.id);
      } else {
        await createAnnouncement.mutateAsync(form);
      }
      setIsDialogOpen(false);
      resetForm();
    } catch (error) {
      // Error handled in mutation
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Excluir este anúncio agendado?')) {
      await deleteAnnouncement.mutateAsync(id);
    }
  };

  const toggleDay = (day: number) => {
    setForm(prev => ({
      ...prev,
      scheduled_days: prev.scheduled_days.includes(day)
        ? prev.scheduled_days.filter(d => d !== day)
        : [...prev.scheduled_days, day].sort()
    }));
  };

  const toggleScreen = (screen: string) => {
    setForm(prev => ({
      ...prev,
      target_screens: prev.target_screens.includes(screen)
        ? prev.target_screens.filter(s => s !== screen)
        : [...prev.target_screens, screen]
    }));
  };

  const getAnnouncementDescription = (announcement: ScheduledAnnouncement) => {
    if (announcement.trigger_type === 'condition') {
      const conditionType = CONDITION_TYPES.find(c => c.value === announcement.condition_type);
      const conditionLabel = conditionType?.label || '';
      const comparisonLabel = CONDITION_COMPARISONS.find(c => c.value === announcement.condition_comparison)?.label || '';
      const unit = (conditionType as any)?.unit || '';
      const suffix = unit ? ` ${unit}` : '';
      return `${conditionLabel} ${comparisonLabel} ${announcement.condition_threshold}${suffix}`;
    }
    
    if (announcement.schedule_type === 'once') {
      return announcement.scheduled_date || 'Uma vez';
    }
    if (announcement.schedule_type === 'daily') {
      return 'Diariamente';
    }
    return announcement.scheduled_days.map(d => DAYS_OF_WEEK.find(x => x.value === d)?.label).join(', ');
  };


  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Megaphone className="h-5 w-5" />
          Anúncios Agendados
        </CardTitle>
        <CardDescription>
          Grave mensagens e configure reprodução por horário ou demanda
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => handleOpenDialog()} className="w-full gap-2">
              <Plus className="h-4 w-4" />
              Novo Anúncio
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingAnnouncement ? 'Editar Anúncio' : 'Novo Anúncio'}
              </DialogTitle>
              <DialogDescription className="sr-only">
                Configure o nome, áudio, horário e condições do anúncio
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 pt-4">
              {/* Name */}
              <div className="space-y-2">
                <Label>Nome do Anúncio</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Ex: Aviso horário de pico"
                />
              </div>

              {/* Audio Source */}
              {!form.file_path ? (
                <div className="space-y-3">
                  <Label>Áudio</Label>
                  
                  {/* Mode selection */}
                  {!audioSource && !isRecording && (
                    <div className="grid grid-cols-3 gap-2">
                      <Button 
                        variant="outline" 
                        className="h-auto py-3 flex flex-col items-center gap-1"
                        onClick={() => {
                          setAudioSource('record');
                          setIsRecording(true);
                        }}
                      >
                        <Mic className="h-5 w-5" />
                        <span className="text-xs">Gravar</span>
                      </Button>
                      <Button 
                        variant="outline" 
                        className="h-auto py-3 flex flex-col items-center gap-1"
                        onClick={() => setAudioSource('upload')}
                      >
                        <Upload className="h-5 w-5" />
                        <span className="text-xs">Enviar</span>
                      </Button>
                      <Button 
                        variant="outline" 
                        className="h-auto py-3 flex flex-col items-center gap-1"
                        onClick={() => setAudioSource('generate')}
                      >
                        <Sparkles className="h-5 w-5" />
                        <span className="text-xs">Gerar Voz</span>
                      </Button>
                    </div>
                  )}

                  {/* Recording Mode */}
                  {(audioSource === 'record' || isRecording) && (
                    <AudioRecorder
                      onSave={handleSaveRecording}
                      onCancel={() => {
                        setIsRecording(false);
                        setAudioSource(null);
                      }}
                      maxDuration={120}
                    />
                  )}

                  {/* Upload Mode */}
                  {audioSource === 'upload' && (
                    <div className="space-y-3 p-3 border rounded-lg bg-muted/30">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <Upload className="h-4 w-4 text-primary" />
                        Enviar Arquivo de Áudio
                      </div>
                      
                      {/* File selector */}
                      {!uploadPreviewUrl && !isConverting && (
                        <div className="space-y-2">
                          <div className="flex gap-2">
                            <Label className="flex-1">
                              <Button variant="outline" className="w-full gap-2" asChild>
                                <span>
                                  <Upload className="h-4 w-4" />
                                  Selecionar Arquivo
                                </span>
                              </Button>
                              <input
                                type="file"
                                accept="audio/mpeg,audio/mp3,audio/webm,audio/wav,audio/ogg,.mp3,.wav,.webm,.ogg"
                                className="hidden"
                                onChange={handleFileUpload}
                              />
                            </Label>
                            <Button variant="ghost" onClick={() => setAudioSource(null)}>
                              Cancelar
                            </Button>
                          </div>
                          <p className="text-xs text-muted-foreground text-center">
                            Formatos aceitos: MP3, WAV, WebM, OGG (WAV convertido automaticamente)
                          </p>
                        </div>
                      )}
                      
                      {/* Conversion indicator */}
                      {isConverting && (
                        <div className="flex items-center gap-2 p-3 border rounded-lg bg-blue-500/10 border-blue-500/30">
                          <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                          <span className="text-sm text-blue-600 dark:text-blue-400">
                            Convertendo WAV para MP3...
                          </span>
                        </div>
                      )}
                      
                      {/* File preview */}
                      {uploadPreviewUrl && (
                        <div className="space-y-3">
                          <div className="p-3 border rounded-lg bg-green-500/10 border-green-500/30">
                            <div className="flex items-center gap-2 text-sm font-medium text-green-600 dark:text-green-400 mb-2">
                              <Volume2 className="h-4 w-4" />
                              Arquivo: {uploadFileName}
                            </div>
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  const audio = new Audio(uploadPreviewUrl);
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
                                onClick={handleConfirmUpload}
                                className="gap-2 flex-1"
                              >
                                <Check className="h-4 w-4" />
                                Confirmar e Salvar
                              </Button>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Label className="flex-1">
                              <Button variant="outline" size="sm" className="w-full gap-1" asChild>
                                <span>
                                  <RefreshCw className="h-4 w-4" />
                                  Trocar Arquivo
                                </span>
                              </Button>
                              <input
                                type="file"
                                accept="audio/mpeg,audio/mp3,audio/webm,audio/wav,audio/ogg,.mp3,.wav,.webm,.ogg,.m4a"
                                className="hidden"
                                onChange={handleFileUpload}
                              />
                            </Label>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                if (uploadPreviewUrl) URL.revokeObjectURL(uploadPreviewUrl);
                                setUploadPreviewUrl(null);
                                setUploadPreviewBlob(null);
                                setUploadFileName('');
                                setAudioSource(null);
                              }}
                            >
                              Cancelar
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Voice Generation Mode */}
                  {audioSource === 'generate' && (
                    <div className="space-y-3 p-3 border rounded-lg bg-muted/30">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <Sparkles className="h-4 w-4 text-primary" />
                        Gerar Áudio com IA (OpenAI)
                      </div>
                      
                      {/* Voice Selection */}
                      <div className="space-y-2">
                        <Label className="text-xs">Voz Natural</Label>
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
                        placeholder="Digite o texto que será convertido em áudio...&#10;Ex: Atenção cozinha, estamos com alto volume de pedidos!"
                        value={voiceText}
                        onChange={(e) => setVoiceText(e.target.value)}
                        rows={3}
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
                              onClick={handleConfirmAndSave}
                              className="gap-2 flex-1"
                            >
                              <Check className="h-4 w-4" />
                              Confirmar e Salvar
                            </Button>
                          </div>
                        </div>
                      )}
                      
                      <div className="flex gap-2">
                        <Button
                          className="flex-1 gap-2"
                          variant={previewAudioUrl ? 'outline' : 'default'}
                          onClick={handleGenerateVoice}
                          disabled={isGeneratingVoice || !voiceText.trim() || !form.name.trim()}
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
                        <Button variant="ghost" onClick={() => setAudioSource(null)}>
                          Cancelar
                        </Button>
                      </div>
                      
                      <p className="text-xs text-muted-foreground">
                        Usa OpenAI TTS para vozes naturais e expressivas. Suporta português.
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <Label>Áudio Atual</Label>
                  <div className="space-y-2 p-3 border rounded-lg bg-green-500/10 border-green-500/30">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {isPreviewPlaying ? (
                          <Volume2 className="h-4 w-4 text-green-600 animate-pulse" />
                        ) : (
                          <Volume2 className="h-4 w-4 text-green-600" />
                        )}
                        <span className="text-sm text-green-600 dark:text-green-400">
                          {previewingAudio ? (isPreviewPlaying ? 'Reproduzindo...' : 'Pausado') : 'Áudio configurado'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {previewingAudio ? (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-1"
                              onClick={handlePauseResume}
                            >
                              {isPreviewPlaying ? (
                                <>
                                  <Pause className="h-4 w-4" />
                                  Pausar
                                </>
                              ) : (
                                <>
                                  <Play className="h-4 w-4" />
                                  Retomar
                                </>
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={handleStopPreview}
                            >
                              <Square className="h-4 w-4" />
                            </Button>
                          </>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1"
                            onClick={handlePlayPreview}
                          >
                            <Play className="h-4 w-4" />
                            Ouvir
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            handleStopPreview();
                            setForm(prev => ({ ...prev, file_path: '' }));
                          }}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    
                    {/* Progress bar with time indicator */}
                    {previewingAudio && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground min-w-[40px]">
                          {formatTime(audioCurrentTime)}
                        </span>
                        <Progress value={audioProgress} className="flex-1 h-2" />
                        <span className="text-xs text-muted-foreground min-w-[40px] text-right">
                          {formatTime(audioDuration)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Trigger Type */}
              <div className="space-y-2">
                <Label>Tipo de Gatilho</Label>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant={form.trigger_type === 'scheduled' ? 'default' : 'outline'}
                    className="gap-2"
                    onClick={() => setForm(prev => ({ ...prev, trigger_type: 'scheduled' }))}
                  >
                    <Calendar className="h-4 w-4" />
                    Agendado
                  </Button>
                  <Button
                    variant={form.trigger_type === 'condition' ? 'default' : 'outline'}
                    className="gap-2"
                    onClick={() => setForm(prev => ({ ...prev, trigger_type: 'condition' }))}
                  >
                    <Activity className="h-4 w-4" />
                    Condicional
                  </Button>
                </div>
              </div>

              {/* Scheduled Options */}
              {form.trigger_type === 'scheduled' && (
                <>
                  <div className="space-y-2">
                    <Label>Frequência</Label>
                    <Select 
                      value={form.schedule_type} 
                      onValueChange={(v) => setForm({ ...form, schedule_type: v as any })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="once">Uma vez</SelectItem>
                        <SelectItem value="daily">Diariamente</SelectItem>
                        <SelectItem value="weekly">Dias específicos</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Horário</Label>
                    <Input
                      type="time"
                      value={form.scheduled_time}
                      onChange={(e) => setForm({ ...form, scheduled_time: e.target.value })}
                    />
                  </div>

                  {form.schedule_type === 'once' && (
                    <div className="space-y-2">
                      <Label className={showDateError ? 'text-destructive' : ''}>
                        Data {showDateError && <span className="text-destructive">*</span>}
                      </Label>
                      <Input
                        type="date"
                        value={form.scheduled_date}
                        onChange={(e) => {
                          setForm({ ...form, scheduled_date: e.target.value });
                          if (e.target.value) setShowDateError(false);
                        }}
                        className={showDateError ? 'border-destructive focus-visible:ring-destructive' : ''}
                      />
                      {showDateError && (
                        <p className="text-xs text-destructive">Data é obrigatória para agendamento único</p>
                      )}
                    </div>
                  )}

                  {form.schedule_type === 'weekly' && (
                    <div className="space-y-2">
                      <Label>Dias da Semana</Label>
                      <div className="flex flex-wrap gap-2">
                        {DAYS_OF_WEEK.map(day => (
                          <Button
                            key={day.value}
                            variant={form.scheduled_days.includes(day.value) ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => toggleDay(day.value)}
                          >
                            {day.label}
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Condition Options */}
              {form.trigger_type === 'condition' && (
                <>
                  <div className="space-y-2">
                    <Label>Condição</Label>
                    <Select 
                      value={form.condition_type} 
                      onValueChange={(v) => setForm({ ...form, condition_type: v as any })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CONDITION_TYPES.map(condition => (
                          <SelectItem key={condition.value} value={condition.value}>
                            {condition.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      {CONDITION_TYPES.find(c => c.value === form.condition_type)?.description}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Comparação</Label>
                      <Select 
                        value={form.condition_comparison} 
                        onValueChange={(v) => setForm({ ...form, condition_comparison: v as any })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {CONDITION_COMPARISONS.map(comp => (
                            <SelectItem key={comp.value} value={comp.value}>
                              {comp.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Valor</Label>
                      <Input
                        type="number"
                        min={0}
                        value={form.condition_threshold}
                        onChange={(e) => setForm({ ...form, condition_threshold: parseInt(e.target.value) || 0 })}
                      />
                    </div>
                  </div>

                  {form.condition_type === 'delayed_orders_count' && (
                    <div className="space-y-2">
                      <Label>Tempo de Atraso (minutos)</Label>
                      <Input
                        type="number"
                        min={1}
                        value={form.delay_threshold_minutes}
                        onChange={(e) => setForm({ ...form, delay_threshold_minutes: parseInt(e.target.value) || 20 })}
                      />
                      <p className="text-xs text-muted-foreground">
                        Pedidos acima deste tempo serão considerados atrasados
                      </p>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label>Cooldown (minutos entre reproduções)</Label>
                    <Input
                      type="number"
                      min={1}
                      value={form.cooldown_minutes}
                      onChange={(e) => setForm({ ...form, cooldown_minutes: parseInt(e.target.value) || 30 })}
                    />
                  </div>
                </>
              )}

              {/* Target Screens */}
              <div className="space-y-2">
                <Label>Telas Alvo</Label>
                <div className="space-y-2">
                  {TARGET_SCREENS.map(screen => (
                    <div key={screen.value} className="flex items-center space-x-2">
                      <Checkbox
                        id={screen.value}
                        checked={form.target_screens.includes(screen.value)}
                        onCheckedChange={() => toggleScreen(screen.value)}
                      />
                      <label htmlFor={screen.value} className="text-sm cursor-pointer">
                        {screen.label}
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Volume */}
              <div className="space-y-2">
                <Label>Volume ({Math.round(form.volume * 100)}%)</Label>
                <Slider
                  value={[form.volume]}
                  onValueChange={([v]) => setForm({ ...form, volume: v })}
                  min={0.1}
                  max={1}
                  step={0.1}
                />
              </div>

              {/* Active */}
              <div className="flex items-center justify-between">
                <Label>Ativo</Label>
                <Switch
                  checked={form.is_active}
                  onCheckedChange={(checked) => setForm({ ...form, is_active: checked })}
                />
              </div>

              {/* Submit */}
              <div className="flex gap-2 pt-4">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setIsDialogOpen(false);
                    resetForm();
                  }}
                >
                  Cancelar
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleSubmit}
                  disabled={!form.name.trim() || !form.file_path || createAnnouncement.isPending || updateAnnouncement.isPending}
                >
                  {createAnnouncement.isPending || updateAnnouncement.isPending ? 'Salvando...' : 'Salvar'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Announcements List */}
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">
            Carregando anúncios...
          </div>
        ) : announcements.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            Nenhum anúncio agendado
          </div>
        ) : (
          <div className="space-y-2">
            {/* Compatibility check indicator */}
            {isCheckingCompatibility && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground py-2 px-3 bg-muted/30 rounded-lg">
                <Loader2 className="h-3 w-3 animate-spin" />
                Verificando compatibilidade de áudio...
              </div>
            )}
            {announcements.map(announcement => (
              <div
                key={announcement.id}
                className="flex items-center gap-3 p-3 border rounded-lg"
              >
                <div className={`w-2 h-2 rounded-full ${announcement.is_active ? 'bg-green-500' : 'bg-muted'}`} />
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium truncate">{announcement.name}</span>
                    
                    {/* Audio error indicator */}
                    {audioErrors.has(announcement.id) && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <TriangleAlert className="h-4 w-4 text-amber-500 shrink-0" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Problema ao reproduzir áudio.</p>
                            <p className="text-xs text-muted-foreground">Reenvie um arquivo MP3.</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                    
                    <Badge variant="outline" className="text-xs">
                      {announcement.trigger_type === 'condition' ? (
                        <Activity className="h-3 w-3 mr-1" />
                      ) : (
                        <Clock className="h-3 w-3 mr-1" />
                      )}
                      {announcement.trigger_type === 'condition' ? 'Condicional' : announcement.scheduled_time.slice(0, 5)}
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
                    <span>{getAnnouncementDescription(announcement)}</span>
                    <span>·</span>
                    <span>{announcement.target_screens.join(', ')}</span>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => playAnnouncement(announcement)}
                  >
                    <Play className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleOpenDialog(announcement)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive"
                    onClick={() => handleDelete(announcement.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
