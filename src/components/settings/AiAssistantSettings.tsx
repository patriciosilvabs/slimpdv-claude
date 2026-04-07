import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { client } from '@/integrations/api/client';
import { Eye, EyeOff, Save, Bot } from 'lucide-react';

export function AiAssistantSettings() {
  const [apiKey, setApiKey] = useState('');
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    client.get('/settings/gemini_api_key')
      .then((data: any) => {
        if (data?.value) setApiKey(data.value);
      })
      .catch(() => {})
      .finally(() => setFetching(false));
  }, []);

  const handleSave = async () => {
    if (!apiKey.trim()) return;
    setLoading(true);
    try {
      await client.put('/settings/gemini_api_key', { value: apiKey.trim() });
      toast({ title: 'Chave salva com sucesso!' });
    } catch (err: any) {
      toast({ title: 'Erro ao salvar', description: err?.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bot className="h-5 w-5" />
          IA Assistente
        </CardTitle>
        <CardDescription>
          Configure sua chave da API Google Gemini para usar o assistente de inteligência artificial.
          Acesse <strong>aistudio.google.com</strong> para obter uma chave gratuita.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="gemini-key">Chave da API Gemini (Google AI Studio)</Label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Input
                id="gemini-key"
                type={visible ? 'text' : 'password'}
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                placeholder="AIza..."
                disabled={fetching}
                className="pr-10"
              />
              <button
                type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => setVisible(v => !v)}
              >
                {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <Button onClick={handleSave} disabled={loading || fetching || !apiKey.trim()}>
              <Save className="h-4 w-4 mr-1" />
              Salvar
            </Button>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          A chave é armazenada de forma segura no servidor. O assistente aparece como um botão flutuante em todas as telas.
        </p>
      </CardContent>
    </Card>
  );
}
