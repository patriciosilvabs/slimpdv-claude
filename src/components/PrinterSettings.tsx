import { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { usePrinter } from '@/contexts/PrinterContext';
import { useOrderSettings, PrintFontSize, LogoPrintMode } from '@/hooks/useOrderSettings';
import { usePrintSectors, usePrintSectorMutations, PrintSector } from '@/hooks/usePrintSectors';
import { usePrintServerMode } from '@/components/PrintQueueListener';
import { useGlobalSettings } from '@/hooks/useGlobalSettings';
import { invalidateLogoCache, clearLogoCache } from '@/utils/imageToBase64';
import { buildFontSizeTestPrint } from '@/utils/escpos';
import { RestaurantInfoSection, CustomMessagesSection } from '@/components/printer';
import {
  Printer, 
  RefreshCw, 
  Check, 
  X, 
  AlertTriangle, 
  Download,
  Loader2,
  Wifi,
  WifiOff,
  TestTube,
  ChefHat,
  CreditCard,
  Zap,
  Copy,
  FileText,
  Settings2,
  Flame,
  Plus,
  Edit,
  Trash2,
  Beer,
  UtensilsCrossed,
  Server,
  type LucideIcon
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

// Available icons for sectors
const SECTOR_ICONS: { value: string; label: string; icon: LucideIcon }[] = [
  { value: 'Flame', label: 'Churrasqueira', icon: Flame },
  { value: 'ChefHat', label: 'Cozinha', icon: ChefHat },
  { value: 'Beer', label: 'Bar', icon: Beer },
  { value: 'UtensilsCrossed', label: 'Chapa', icon: UtensilsCrossed },
];

export function PrinterSettings() {
  const printerCtx = usePrinter();
  const { toast } = useToast();
  const { data: printSectors } = usePrintSectors();
  const { createSector, updateSector, deleteSector } = usePrintSectorMutations();
  const { 
    autoPrintKitchenTicket, 
    toggleAutoPrintKitchenTicket,
    autoPrintCustomerReceipt,
    toggleAutoPrintCustomerReceipt,
    kitchenFontSize,
    updateKitchenFontSize,
    receiptFontSize,
    updateReceiptFontSize,
    lineSpacing,
    updateLineSpacing,
    leftMargin,
    updateLeftMargin,
    rightMargin,
    updateRightMargin,
    restaurantName,
    updateRestaurantName,
    restaurantAddress,
    updateRestaurantAddress,
    restaurantPhone,
    updateRestaurantPhone,
    restaurantCnpj,
    updateRestaurantCnpj,
    duplicateKitchenTicket,
    toggleDuplicateKitchenTicket,
    // General print settings
    showItemNumber,
    toggleShowItemNumber,
    showComplementPrice,
    toggleShowComplementPrice,
    showComplementName,
    toggleShowComplementName,
    largeFontProduction,
    toggleLargeFontProduction,
    multiplyOptions,
    toggleMultiplyOptions,
    showLogo,
    toggleShowLogo,
    printCancellation,
    togglePrintCancellation,
    printRatingQr,
    togglePrintRatingQr,
    hideComboQuantity,
    toggleHideComboQuantity,
    hideFlavorCategoryPrint,
    toggleHideFlavorCategoryPrint,
    // Custom messages
    printMessageStandard,
    updatePrintMessageStandard,
    printMessageTable,
    updatePrintMessageTable,
    printQrStandard,
    updatePrintQrStandard,
    printQrTable,
    updatePrintQrTable,
    asciiMode,
    toggleAsciiMode,
    charSpacing,
    updateCharSpacing,
    topMargin,
    updateTopMargin,
    bottomMarginKitchen,
    updateBottomMarginKitchen,
    bottomMarginReceipt,
    updateBottomMarginReceipt,
    restaurantLogoUrl,
    updateRestaurantLogoUrl,
    logoMaxWidth,
    updateLogoMaxWidth,
    logoPrintMode,
    updateLogoPrintMode,
    qrCodeSize,
    updateQrCodeSize
  } = useOrderSettings();
  const [testingPrinter, setTestingPrinter] = useState<string | null>(null);
  const [testingFont, setTestingFont] = useState<'kitchen' | 'receipt' | null>(null);
  const [logEntries, setLogEntries] = useState<{ time: string; msg: string }[]>([]);
  
  // Print server mode
  const { isPrintServer, setIsPrintServer } = usePrintServerMode();
  const { usePrintQueue, toggleUsePrintQueue, isLoading: loadingGlobalSettings } = useGlobalSettings();
  
  // Sector dialog state
  const [sectorDialogOpen, setSectorDialogOpen] = useState(false);
  const [editingSector, setEditingSector] = useState<PrintSector | null>(null);
  const [sectorForm, setSectorForm] = useState({ name: '', description: '', printer_name: '', color: '#EF4444', icon: 'Flame' });
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [localSlimprintUrl, setLocalSlimprintUrl] = useState(printerCtx.config.slimprintUrl || 'wss://127.0.0.1:9415');
  const [localSlimprintToken, setLocalSlimprintToken] = useState(printerCtx.config.slimprintToken || '123321');

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type and size
    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Formato inválido',
        description: 'Selecione uma imagem (PNG, JPG, etc.)',
        variant: 'destructive',
      });
      return;
    }

    if (file.size > 500 * 1024) {
      toast({
        title: 'Arquivo muito grande',
        description: 'O tamanho máximo é 500KB',
        variant: 'destructive',
      });
      return;
    }

    setUploadingLogo(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `logo-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('restaurant-logos')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: publicUrl } = supabase.storage
        .from('restaurant-logos')
        .getPublicUrl(fileName);

      // Invalidar cache da logo antiga
      if (restaurantLogoUrl) {
        invalidateLogoCache(restaurantLogoUrl);
      }
      
      updateRestaurantLogoUrl(publicUrl.publicUrl);
      toast({
        title: 'Logo atualizado!',
        description: 'A logomarca foi salva com sucesso.',
      });
    } catch (err: any) {
      toast({
        title: 'Erro no upload',
        description: err?.message || 'Falha ao enviar a imagem.',
        variant: 'destructive',
      });
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleRemoveLogo = () => {
    // Invalidar cache da logo
    if (restaurantLogoUrl) {
      invalidateLogoCache(restaurantLogoUrl);
    }
    updateRestaurantLogoUrl('');
    toast({
      title: 'Logo removido',
      description: 'A logomarca foi removida.',
    });
  };

  const handleClearLogoCache = () => {
    clearLogoCache();
    toast({
      title: 'Cache limpo!',
      description: 'A próxima impressão buscará a logo do servidor.',
    });
  };

  const handleConnect = async () => {
    addLog('Conectando ao SlimPrint...');
    const success = await printerCtx.connect(true);
    if (success) {
      addLog('✅ Conectado com sucesso');
      toast({ title: 'Conectado!', description: 'SlimPrint conectado com sucesso.' });
    } else {
      addLog(`❌ Falha na conexão: ${printerCtx.error || 'desconhecido'}`);
      toast({ title: 'Erro ao conectar', description: printerCtx.error || 'Não foi possível conectar ao SlimPrint.', variant: 'destructive' });
    }
  };

  const handleDisconnect = async () => {
    await printerCtx.disconnect();
    toast({
      title: 'Desconectado',
      description: 'SlimPrint desconectado.',
    });
  };

  const handleRefreshPrinters = async () => {
    const printers = await printerCtx.refreshPrinters();
    if (printers.length > 0) {
      toast({
        title: 'Impressoras atualizadas',
        description: `${printers.length} impressora(s) encontrada(s).`,
      });
    } else {
      toast({
        title: 'Nenhuma impressora',
        description: 'Nenhuma impressora foi encontrada.',
        variant: 'destructive',
      });
    }
  };

  const handleTestPrint = async (printerName: string) => {
    setTestingPrinter(printerName);
    try {
      await printerCtx.testPrint(printerName);
      toast({
        title: 'Teste enviado!',
        description: `Página de teste enviada para ${printerName}.`,
      });
    } catch (err: any) {
      toast({
        title: 'Erro no teste',
        description: err?.message || 'Falha ao enviar teste.',
        variant: 'destructive',
      });
    } finally {
      setTestingPrinter(null);
    }
  };

  const handleTestFontPrint = async (type: 'kitchen' | 'receipt', fontSize: PrintFontSize) => {
    setTestingFont(type);
    try {
      const printData = buildFontSizeTestPrint(
        printerCtx.config.paperWidth, 
        fontSize, 
        type,
        restaurantName,
        lineSpacing,
        leftMargin,
        asciiMode
      );
      const printerName = type === 'kitchen' 
        ? printerCtx.config.kitchenPrinter 
        : printerCtx.config.cashierPrinter;
      
      if (!printerName) {
        throw new Error('Impressora não configurada');
      }

      await printerCtx.print(printerName, printData);
      toast({
        title: 'Teste enviado!',
        description: `Teste de fonte enviado para ${printerName}.`,
      });
    } catch (err: any) {
      toast({
        title: 'Erro no teste',
        description: err?.message || 'Falha ao enviar teste de fonte.',
        variant: 'destructive',
      });
    } finally {
      setTestingFont(null);
    }
  };

  const getFontPreviewClass = (fontSize: PrintFontSize) => {
    switch (fontSize) {
      case 'normal':
        return 'text-xs';
      case 'large':
        return 'text-sm leading-relaxed';
      case 'extra_large':
        return 'text-base font-semibold leading-loose';
    }
  };

  const backendLabel = 'SlimPrint';

  const addLog = useCallback((msg: string) => {
    const time = new Date().toLocaleTimeString('pt-BR');
    setLogEntries(prev => [{ time, msg }, ...prev].slice(0, 15));
  }, []);

  const handleSlimPrintPing = async () => {
    addLog('Enviando ping...');
    try {
      const ok = await printerCtx.ping();
      if (ok) {
        addLog('✅ Ping OK - SlimPrint respondeu');
        toast({ title: 'Ping OK', description: 'SlimPrint respondeu com sucesso.' });
      } else {
        addLog('❌ Ping falhou');
        toast({ title: 'Ping falhou', description: 'SlimPrint não respondeu.', variant: 'destructive' });
      }
    } catch (err: any) {
      addLog(`❌ Erro: ${err?.message}`);
      toast({ title: 'Erro no ping', description: err?.message, variant: 'destructive' });
    }
  };

  const handleTestEscpos = async (printerName: string) => {
    addLog(`Teste ESC/POS → ${printerName}`);
    try {
      await printerCtx.printTestEscpos(printerName);
      addLog(`✅ Teste ESC/POS enviado para ${printerName}`);
      toast({ title: 'Teste ESC/POS enviado!', description: `Enviado para ${printerName}.` });
    } catch (err: any) {
      addLog(`❌ Erro ESC/POS: ${err?.message}`);
      toast({ title: 'Erro no teste', description: err?.message, variant: 'destructive' });
    }
  };

  const handleTestZpl = async (printerName: string) => {
    addLog(`Teste ZPL → ${printerName}`);
    try {
      await printerCtx.printTestZpl(printerName);
      addLog(`✅ Teste ZPL enviado para ${printerName}`);
      toast({ title: 'Teste ZPL enviado!', description: `Enviado para ${printerName}.` });
    } catch (err: any) {
      addLog(`❌ Erro ZPL: ${err?.message}`);
      toast({ title: 'Erro no teste', description: err?.message, variant: 'destructive' });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Printer className="w-5 h-5" />
          Impressoras ({backendLabel})
        </CardTitle>
        <CardDescription>
          Configure impressoras térmicas para impressão silenciosa de comandas e recibos
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* SlimPrint settings */}
        <div className="space-y-4 p-4 rounded-lg border bg-muted/30">
          <div className="flex items-center gap-2 mb-2">
            <Zap className="w-5 h-5 text-primary" />
            <span className="font-semibold">Configuração SlimPrint</span>
          </div>

          <div className="space-y-2">
            <Label>URL do WebSocket</Label>
            <Input
              value={localSlimprintUrl}
              onChange={(e) => setLocalSlimprintUrl(e.target.value)}
              onBlur={() => printerCtx.updateConfig({ slimprintUrl: localSlimprintUrl })}
              placeholder="wss://127.0.0.1:9415"
            />
          </div>

          <div className="space-y-2">
            <Label>Token de Autenticação</Label>
            <Input
              type="password"
              value={localSlimprintToken}
              onChange={(e) => setLocalSlimprintToken(e.target.value)}
              onBlur={() => printerCtx.updateConfig({ slimprintToken: localSlimprintToken })}
              placeholder="Token do SlimPrint"
            />
          </div>

          {!printerCtx.isConnected && !printerCtx.isConnecting && (
            <Alert variant="destructive" className="border-destructive/30 bg-destructive/5">
              <AlertTriangle className="w-4 h-4" />
              <AlertDescription className="text-xs">
                Para conectar, certifique-se de que: <strong>1)</strong> O SlimPrint está rodando no computador.{' '}
                <strong>2)</strong> A origem <code className="bg-muted px-1 rounded">https://slimpdv.lovable.app</code> está nas <strong>Origens Permitidas</strong> do SlimPrint.{' '}
                <strong>3)</strong> O certificado foi aceito — abra{' '}
                <a href="https://127.0.0.1:9415" target="_blank" rel="noopener noreferrer" className="underline font-medium">
                  https://127.0.0.1:9415
                </a>{' '}
                no navegador e clique em "Avançado → Continuar".
              </AlertDescription>
            </Alert>
          )}

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => handleConnect()} disabled={printerCtx.isConnecting}>
              <Wifi className="w-4 h-4 mr-2" />
              Conectar
            </Button>
            <Button variant="outline" size="sm" onClick={handleDisconnect} disabled={!printerCtx.isConnected}>
              <WifiOff className="w-4 h-4 mr-2" />
              Desconectar
            </Button>
            <Button variant="outline" size="sm" onClick={handleRefreshPrinters} disabled={!printerCtx.isConnected}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Listar Impressoras
            </Button>
            <Button variant="outline" size="sm" onClick={handleSlimPrintPing} disabled={!printerCtx.isConnected}>
              <Zap className="w-4 h-4 mr-2" />
              Testar Conexão
            </Button>
          </div>

          {/* Test print buttons per printer */}
          {printerCtx.isConnected && printerCtx.printers.length > 0 && (
            <div className="space-y-2 pt-2 border-t">
              <Label className="text-xs text-muted-foreground">Testes de impressão</Label>
              {printerCtx.printers.map((p) => (
                <div key={p} className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium min-w-[120px]">{p}</span>
                  <Button variant="outline" size="sm" onClick={() => handleTestEscpos(p)}>
                    <TestTube className="w-3 h-3 mr-1" />
                    ESC/POS
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleTestZpl(p)}>
                    <TestTube className="w-3 h-3 mr-1" />
                    ZPL
                  </Button>
                </div>
              ))}
            </div>
          )}

          {/* Console log panel */}
          {logEntries.length > 0 && (
            <div className="space-y-1 pt-2 border-t">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground">Log</Label>
                <Button variant="ghost" size="sm" className="h-5 text-xs px-2" onClick={() => setLogEntries([])}>
                  Limpar
                </Button>
              </div>
              <div className="max-h-32 overflow-y-auto rounded bg-muted p-2 font-mono text-xs space-y-0.5">
                {logEntries.map((entry, i) => (
                  <div key={i} className="text-muted-foreground">
                    <span className="opacity-60">{entry.time}</span> {entry.msg}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
          {usePrintQueue && !isPrintServer && (
            <Alert>
              <Printer className="w-4 h-4" />
              <AlertDescription>
                As impressões serão enviadas para a fila. Configure um computador como servidor de impressão para processar os trabalhos.
              </AlertDescription>
            </Alert>
          )}

        {/* Connection Status */}
        <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/30">
          <div className="flex items-center gap-3">
            {printerCtx.isConnected ? (
              <div className="p-2 rounded-full bg-green-500/20">
                <Wifi className="w-5 h-5 text-green-500" />
              </div>
            ) : printerCtx.isConnecting ? (
              <div className="p-2 rounded-full bg-blue-500/20">
                <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
              </div>
            ) : (
              <div className="p-2 rounded-full bg-muted">
                <WifiOff className="w-5 h-5 text-muted-foreground" />
              </div>
            )}
            <div>
              <div className="font-medium">
                Status: {printerCtx.isConnected 
                  ? 'Conectado' 
                  : printerCtx.isConnecting 
                    ? 'Conectando...' 
                    : 'Desconectado'}
              </div>
              <div className="text-sm text-muted-foreground">
                {printerCtx.isConnected 
                  ? `${printerCtx.printers.length} impressora(s) disponível(is)`
                  : printerCtx.isConnecting
                    ? 'Conectando ao SlimPrint...'
                    : 'Clique em Conectar para iniciar'}
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            {printerCtx.isConnected ? (
              <>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={handleRefreshPrinters}
                  disabled={printerCtx.isConnecting}
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Atualizar
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={handleDisconnect}
                  disabled={printerCtx.isConnecting}
                >
                  Desconectar
                </Button>
              </>
            ) : (
              <Button 
                onClick={handleConnect}
                disabled={printerCtx.isConnecting}
              >
                {printerCtx.isConnecting ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4 mr-2" />
                )}
                {printerCtx.isConnecting ? 'Conectando...' : 'Reconectar'}
              </Button>
            )}
          </div>
        </div>

        {/* Auto-connect Setting */}
        <div className="flex items-center justify-between p-4 rounded-lg border">
          <div className="flex items-center gap-3">
            <Zap className="w-5 h-5 text-muted-foreground" />
            <div>
              <div className="font-medium">Conexão automática</div>
              <div className="text-sm text-muted-foreground">
                Conectar automaticamente ao SlimPrint quando fizer login
              </div>
            </div>
          </div>
          <Switch
            checked={printerCtx.config.autoConnectOnLogin}
            onCheckedChange={(checked) => 
              printerCtx.updateConfig({ autoConnectOnLogin: checked })
            }
          />
        </div>

        {/* Print Queue / Centralized Printing Settings */}
        <div className="space-y-4 p-4 rounded-lg border bg-muted/30">
          <div className="flex items-center gap-2 mb-2">
            <Server className="w-5 h-5 text-primary" />
            <span className="font-semibold">Impressão Centralizada</span>
          </div>
          
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">Usar fila de impressão</div>
              <div className="text-sm text-muted-foreground">
                Permite que outros dispositivos enviem trabalhos para o servidor de impressão
              </div>
            </div>
            <Switch
              checked={usePrintQueue}
              onCheckedChange={() => toggleUsePrintQueue()}
              disabled={loadingGlobalSettings}
            />
          </div>
          
          {usePrintQueue && (
            <div className="flex items-center justify-between mt-2 p-3 rounded-lg bg-primary/10 border border-primary/20">
              <div>
                <div className="font-medium text-primary">Este dispositivo é o servidor de impressão</div>
                <div className="text-sm text-muted-foreground">
                  {isPrintServer 
                    ? 'Este computador processará todos os trabalhos de impressão da fila' 
                    : 'Ative para que este computador imprima trabalhos enviados por outros dispositivos'}
                </div>
              </div>
              <Switch
                checked={isPrintServer}
                onCheckedChange={setIsPrintServer}
              />
            </div>
          )}
          
          {usePrintQueue && !isPrintServer && (
            <Alert>
              <Printer className="w-4 h-4" />
              <AlertDescription>
                As impressões serão enviadas para a fila. Configure um computador como servidor de impressão para processar os trabalhos.
              </AlertDescription>
            </Alert>
          )}
          
          {usePrintQueue && isPrintServer && printerCtx.isConnected && (
            <Alert className="border-green-500/50 bg-green-500/10">
              <Check className="w-4 h-4 text-green-500" />
              <AlertDescription className="text-green-700 dark:text-green-400">
                Servidor de impressão ativo! Trabalhos da fila serão processados automaticamente.
              </AlertDescription>
            </Alert>
          )}
        </div>

        {/* Error Alert */}
        {printerCtx.error && (
          <Alert variant="destructive">
            <AlertTriangle className="w-4 h-4" />
            <AlertDescription>{printerCtx.error}</AlertDescription>
          </Alert>
        )}


        {/* Restaurant Info - Always available */}
        <RestaurantInfoSection
          restaurantName={restaurantName}
          restaurantAddress={restaurantAddress}
          restaurantPhone={restaurantPhone}
          restaurantCnpj={restaurantCnpj}
          restaurantLogoUrl={restaurantLogoUrl}
          showLogo={showLogo}
          logoPrintMode={logoPrintMode}
          logoMaxWidth={logoMaxWidth}
          paperWidth={printerCtx.config.paperWidth}
          onNameChange={updateRestaurantName}
          onAddressChange={updateRestaurantAddress}
          onPhoneChange={updateRestaurantPhone}
          onCnpjChange={updateRestaurantCnpj}
          onLogoUpload={handleLogoUpload}
          onLogoRemove={handleRemoveLogo}
          onClearLogoCache={handleClearLogoCache}
          onShowLogoChange={toggleShowLogo}
          updateLogoPrintMode={updateLogoPrintMode}
          updateLogoMaxWidth={updateLogoMaxWidth}
          uploadingLogo={uploadingLogo}
        />

          {/* Printer-dependent configuration - Only show when connected */}
          {printerCtx.isConnected && (
            <div className="space-y-4">
            {/* Paper Width */}
            <div className="space-y-2">
              <Label>Largura do Papel</Label>
              <Select
                value={printerCtx.config.paperWidth}
                onValueChange={(value: '58mm' | '80mm') => printerCtx.updateConfig({ paperWidth: value })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="58mm">58mm (bobina pequena)</SelectItem>
                  <SelectItem value="80mm">80mm (bobina padrão)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Line Spacing */}
            <div className="space-y-2">
              <Label>Espaçamento entre Linhas (Vertical)</Label>
              <Select
                value={String(lineSpacing)}
                onValueChange={(v) => updateLineSpacing(Number(v))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Normal (padrão)</SelectItem>
                  <SelectItem value="8">Pequeno (+8)</SelectItem>
                  <SelectItem value="16">Médio (+16)</SelectItem>
                  <SelectItem value="24">Grande (+24)</SelectItem>
                  <SelectItem value="32">Extra Grande (+32)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Left Margin */}
            <div className="space-y-2">
              <Label>Margem Esquerda (Horizontal)</Label>
              <Select
                value={String(leftMargin)}
                onValueChange={(v) => updateLeftMargin(Number(v))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Sem margem (padrão)</SelectItem>
                  <SelectItem value="4">Pequena (4)</SelectItem>
                  <SelectItem value="8">Média (8)</SelectItem>
                  <SelectItem value="12">Grande (12)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Right Margin */}
            <div className="space-y-2">
              <Label>Margem Direita (Horizontal)</Label>
              <Select
                value={String(rightMargin)}
                onValueChange={(v) => updateRightMargin(Number(v))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Sem margem (padrão)</SelectItem>
                  <SelectItem value="4">Pequena (4)</SelectItem>
                  <SelectItem value="8">Média (8)</SelectItem>
                  <SelectItem value="12">Grande (12)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Character Spacing */}
            <div className="space-y-2">
              <Label>Espaçamento entre Caracteres (Horizontal)</Label>
              <Select
                value={String(charSpacing)}
                onValueChange={(v) => updateCharSpacing(Number(v))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Nenhum (padrão da impressora)</SelectItem>
                  <SelectItem value="1">Pequeno (+1)</SelectItem>
                  <SelectItem value="2">Médio (+2)</SelectItem>
                  <SelectItem value="3">Grande (+3)</SelectItem>
                  <SelectItem value="4">Extra Grande (+4)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Aumenta o espaço entre as letras para melhor legibilidade
              </p>
            </div>

            {/* Top Margin */}
            <div className="space-y-2">
              <Label>Margem Superior (linhas em branco)</Label>
              <Select
                value={String(topMargin)}
                onValueChange={(v) => updateTopMargin(Number(v))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Sem margem (padrão)</SelectItem>
                  <SelectItem value="1">1 linha</SelectItem>
                  <SelectItem value="2">2 linhas</SelectItem>
                  <SelectItem value="3">3 linhas</SelectItem>
                  <SelectItem value="4">4 linhas</SelectItem>
                  <SelectItem value="5">5 linhas</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Linhas em branco antes do conteúdo
              </p>
            </div>

            {/* Bottom Margin - Kitchen */}
            <div className="space-y-2">
              <Label>Margem Inferior - Comanda (cozinha)</Label>
              <Select
                value={String(bottomMarginKitchen)}
                onValueChange={(v) => updateBottomMarginKitchen(Number(v))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Sem margem</SelectItem>
                  <SelectItem value="1">1 linha</SelectItem>
                  <SelectItem value="2">2 linhas</SelectItem>
                  <SelectItem value="3">3 linhas (padrão)</SelectItem>
                  <SelectItem value="4">4 linhas</SelectItem>
                  <SelectItem value="5">5 linhas</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Linhas em branco antes do corte (comanda de cozinha)
              </p>
            </div>

            {/* Bottom Margin - Receipt */}
            <div className="space-y-2">
              <Label>Margem Inferior - Recibo (cliente)</Label>
              <Select
                value={String(bottomMarginReceipt)}
                onValueChange={(v) => updateBottomMarginReceipt(Number(v))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Sem margem</SelectItem>
                  <SelectItem value="1">1 linha</SelectItem>
                  <SelectItem value="2">2 linhas</SelectItem>
                  <SelectItem value="3">3 linhas</SelectItem>
                  <SelectItem value="4">4 linhas (padrão)</SelectItem>
                  <SelectItem value="5">5 linhas</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Linhas em branco antes do corte (recibo do cliente)
              </p>
            </div>

            <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/30">
              <div className="space-y-0.5">
                <Label className="flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  Modo ASCII (sem acentos)
                </Label>
                <p className="text-xs text-muted-foreground">
                  Converte textos para ASCII simples. Útil para impressoras que não suportam caracteres acentuados.
                </p>
              </div>
              <Switch
                checked={asciiMode}
                onCheckedChange={toggleAsciiMode}
              />
            </div>

            <div className="space-y-2 p-4 rounded-lg border bg-muted/30">
              <Label className="text-sm font-medium">Preview de Margens e Espaçamento</Label>
              <div 
                className="bg-white dark:bg-black border-2 border-dashed rounded overflow-hidden"
                style={{ width: printerCtx.config.paperWidth === '58mm' ? '200px' : '280px' }}
              >
                <div 
                  className="font-mono text-xs text-black dark:text-white"
                  style={{ 
                    paddingLeft: `${leftMargin * 4}px`,
                    paddingTop: '8px',
                    paddingBottom: '8px'
                  }}
                >
                  {/* Visual margin indicator */}
                  {leftMargin > 0 && (
                    <div 
                      className="absolute left-0 top-0 bottom-0 bg-primary/20"
                      style={{ width: `${leftMargin * 4}px` }}
                    />
                  )}
                  <div style={{ lineHeight: `${1.2 + (lineSpacing / 32)}em`, letterSpacing: `${charSpacing * 0.5}px` }}>
                    <div className="font-bold text-center">{restaurantName || 'RESTAURANTE'}</div>
                    {restaurantAddress && <div className="text-center text-[10px]">{restaurantAddress}</div>}
                    {restaurantPhone && <div className="text-center text-[10px]">Tel: {restaurantPhone}</div>}
                    <div className="text-center my-1">─────────────</div>
                    <div>PEDIDO #123</div>
                    <div>Mesa: 05</div>
                    <div className="my-1">─────────────</div>
                    <div>1x Pizza Grande</div>
                    <div className="pl-2 text-muted-foreground">- Calabresa</div>
                    <div>2x Refrigerante</div>
                    <div className="my-1">─────────────</div>
                    <div className="font-bold">TOTAL: R$ 65,00</div>
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-4 text-xs text-muted-foreground mt-2">
                <span>Margem: {leftMargin === 0 ? 'Nenhuma' : `${leftMargin} unidades`}</span>
                <span>•</span>
                <span>Espaçamento linhas: {lineSpacing === 0 ? 'Normal' : `+${lineSpacing}`}</span>
                <span>•</span>
                <span>Espaçamento caracteres: {charSpacing === 0 ? 'Padrão' : `+${charSpacing}`}</span>
              </div>
            </div>

            {/* Kitchen Printer */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <ChefHat className="w-4 h-4" />
                Impressora da Cozinha
              </Label>
              <div className="flex gap-2">
                <Select
                  value={printerCtx.config.kitchenPrinter || '__none__'}
                  onValueChange={(value) => printerCtx.updateConfig({ kitchenPrinter: value === '__none__' ? null : value })}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Selecione uma impressora" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Nenhuma</SelectItem>
                    {printerCtx.printers.map((p) => (
                      <SelectItem key={p} value={p}>{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {printerCtx.config.kitchenPrinter && (
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => handleTestPrint(printerCtx.config.kitchenPrinter!)}
                    disabled={testingPrinter === printerCtx.config.kitchenPrinter}
                  >
                    {testingPrinter === printerCtx.config.kitchenPrinter ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <TestTube className="w-4 h-4" />
                    )}
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Usada para imprimir comandas na cozinha
              </p>

              {/* Kitchen Font Size */}
              {printerCtx.config.kitchenPrinter && (
                <div className="mt-3 space-y-2">
                  <Label className="text-sm">Tamanho da Fonte (Comanda)</Label>
                  <Select
                    value={kitchenFontSize}
                    onValueChange={(value: PrintFontSize) => updateKitchenFontSize(value)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="normal">Normal</SelectItem>
                      <SelectItem value="large">Grande (altura 2x)</SelectItem>
                      <SelectItem value="extra_large">Extra Grande (2x)</SelectItem>
                    </SelectContent>
                  </Select>

                  {/* Kitchen Font Preview */}
                  <div className="mt-2 p-4 border-2 border-dashed rounded-lg bg-white dark:bg-black">
                    <div className="text-center text-xs text-muted-foreground mb-2">
                      ═══ PREVIEW COMANDA ═══
                    </div>
                    <div 
                      className={`font-mono text-black dark:text-white text-center space-y-1 transition-all duration-200 ${getFontPreviewClass(kitchenFontSize)}`}
                    >
                      <div className="font-bold">{restaurantName.toUpperCase()}</div>
                      <div>─────────────────</div>
                      <div>COZINHA - Mesa 05</div>
                      <div>PEDIDO #123</div>
                      <div className="py-1"></div>
                      <div className="text-left">1x Pizza Grande</div>
                      <div className="text-left pl-2 text-muted-foreground">- Calabresa</div>
                      <div className="text-left">2x Refrigerante</div>
                    </div>
                  </div>

                  {/* Test Kitchen Font Button */}
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full mt-2"
                    onClick={() => handleTestFontPrint('kitchen', kitchenFontSize)}
                    disabled={!printerCtx.canPrintToKitchen || testingFont === 'kitchen'}
                  >
                    {testingFont === 'kitchen' ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Printer className="w-4 h-4 mr-2" />
                    )}
                    Testar Fonte na Impressora
                  </Button>
                </div>
              )}
            </div>

            {/* Cashier Printer */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <CreditCard className="w-4 h-4" />
                Impressora do Caixa
              </Label>
              <div className="flex gap-2">
                <Select
                  value={printerCtx.config.cashierPrinter || '__none__'}
                  onValueChange={(value) => printerCtx.updateConfig({ cashierPrinter: value === '__none__' ? null : value })}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Selecione uma impressora" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Nenhuma</SelectItem>
                    {printerCtx.printers.map((p) => (
                      <SelectItem key={p} value={p}>{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {printerCtx.config.cashierPrinter && (
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => handleTestPrint(printerCtx.config.cashierPrinter!)}
                    disabled={testingPrinter === printerCtx.config.cashierPrinter}
                  >
                    {testingPrinter === printerCtx.config.cashierPrinter ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <TestTube className="w-4 h-4" />
                    )}
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Usada para imprimir recibos do cliente e abrir gaveta
              </p>

              {/* Receipt Font Size */}
              {printerCtx.config.cashierPrinter && (
                <div className="mt-3 space-y-2">
                  <Label className="text-sm">Tamanho da Fonte (Recibo)</Label>
                  <Select
                    value={receiptFontSize}
                    onValueChange={(value: PrintFontSize) => updateReceiptFontSize(value)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="normal">Normal</SelectItem>
                      <SelectItem value="large">Grande (altura 2x)</SelectItem>
                      <SelectItem value="extra_large">Extra Grande (2x)</SelectItem>
                    </SelectContent>
                  </Select>

                  {/* Receipt Font Preview */}
                  <div className="mt-2 p-4 border-2 border-dashed rounded-lg bg-white dark:bg-black">
                    <div className="text-center text-xs text-muted-foreground mb-2">
                      ═══ PREVIEW RECIBO ═══
                    </div>
                    <div 
                      className={`font-mono text-black dark:text-white text-center space-y-1 transition-all duration-200 ${getFontPreviewClass(receiptFontSize)}`}
                    >
                      <div className="font-bold">{restaurantName.toUpperCase()}</div>
                      <div>─────────────────</div>
                      <div>PEDIDO #123 - Mesa 05</div>
                      <div className="py-1"></div>
                      <div className="text-left">1x Pizza Grande</div>
                      <div className="text-left pl-2 text-muted-foreground">- Calabresa</div>
                      <div className="text-left">2x Refrigerante</div>
                      <div className="py-1"></div>
                      <div className="font-bold">TOTAL: R$ 65,00</div>
                    </div>
                  </div>

                  {/* Test Receipt Font Button */}
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full mt-2"
                    onClick={() => handleTestFontPrint('receipt', receiptFontSize)}
                    disabled={!printerCtx.canPrintToCashier || testingFont === 'receipt'}
                  >
                    {testingFont === 'receipt' ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Printer className="w-4 h-4 mr-2" />
                    )}
                    Testar Fonte na Impressora
                  </Button>
                </div>
              )}
            </div>

            {/* Configuration Summary */}
            <div className="flex gap-2 pt-2">
              <Badge variant={printerCtx.canPrintToKitchen ? 'default' : 'secondary'}>
                {printerCtx.canPrintToKitchen ? (
                  <Check className="w-3 h-3 mr-1" />
                ) : (
                  <X className="w-3 h-3 mr-1" />
                )}
                Cozinha
              </Badge>
              <Badge variant={printerCtx.canPrintToCashier ? 'default' : 'secondary'}>
                {printerCtx.canPrintToCashier ? (
                  <Check className="w-3 h-3 mr-1" />
                ) : (
                  <X className="w-3 h-3 mr-1" />
                )}
                Caixa
              </Badge>
            </div>
            </div>
          )}

            {/* Auto Print Settings */}
            <div className="space-y-4 pt-4 border-t">
              <Label className="text-base font-medium flex items-center gap-2">
                <Zap className="w-4 h-4" />
                Impressão Automática
              </Label>
              
              <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                <div className="space-y-0.5">
                  <p className="font-medium text-sm">Imprimir comanda automaticamente</p>
                  <p className="text-xs text-muted-foreground">
                    Imprime na cozinha quando itens são adicionados ao pedido
                  </p>
                </div>
                <Switch 
                  checked={autoPrintKitchenTicket}
                  onCheckedChange={toggleAutoPrintKitchenTicket}
                />
              </div>
              
              {autoPrintKitchenTicket && !printerCtx.canPrintToKitchen && (
                <p className="text-xs text-amber-600 ml-3">
                  ⚠️ Ativado, mas a impressora da cozinha não está conectada. Conecte o SlimPrint e configure a impressora.
                </p>
              )}
              
              {/* Duplicate Kitchen Ticket Option */}
              {autoPrintKitchenTicket && (
                <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30 ml-4">
                  <div className="space-y-0.5">
                    <p className="font-medium text-sm flex items-center gap-2">
                      <Copy className="w-4 h-4" />
                      Imprimir comanda duplicada
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Uma cópia para a cozinha, outra para o garçom
                    </p>
                  </div>
                  <Switch 
                    checked={duplicateKitchenTicket}
                    onCheckedChange={toggleDuplicateKitchenTicket}
                  />
                </div>
              )}

              <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                <div className="space-y-0.5">
                  <p className="font-medium text-sm">Imprimir recibo automaticamente</p>
                  <p className="text-xs text-muted-foreground">
                    Imprime recibo do cliente após confirmação do pagamento
                  </p>
                </div>
                <Switch 
                  checked={autoPrintCustomerReceipt}
                  onCheckedChange={toggleAutoPrintCustomerReceipt}
                />
              </div>
              
              {autoPrintCustomerReceipt && !printerCtx.canPrintToCashier && (
                <p className="text-xs text-amber-600 ml-3">
                  ⚠️ Ativado, mas a impressora do caixa não está conectada. Conecte o SlimPrint e configure a impressora.
                </p>
              )}
            </div>

            {/* General Print Settings */}
            <div className="space-y-4 pt-4 border-t">
              <Label className="text-base font-medium flex items-center gap-2">
                <Settings2 className="w-4 h-4" />
                Configurações Gerais de Impressão
              </Label>

              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                  <div className="space-y-0.5">
                    <p className="font-medium text-sm">Mostrar número do item na impressão</p>
                    <p className="text-xs text-muted-foreground">
                      Exibe o número sequencial de cada item
                    </p>
                  </div>
                  <Switch 
                    checked={showItemNumber}
                    onCheckedChange={toggleShowItemNumber}
                  />
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                  <div className="space-y-0.5">
                    <p className="font-medium text-sm">Mostrar preço dos complementos</p>
                    <p className="text-xs text-muted-foreground">
                      Exibe o valor de cada complemento na impressão
                    </p>
                  </div>
                  <Switch 
                    checked={showComplementPrice}
                    onCheckedChange={toggleShowComplementPrice}
                  />
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                  <div className="space-y-0.5">
                    <p className="font-medium text-sm">Mostrar nome dos complementos</p>
                    <p className="text-xs text-muted-foreground">
                      Exibe o nome dos complementos na impressão
                    </p>
                  </div>
                  <Switch 
                    checked={showComplementName}
                    onCheckedChange={toggleShowComplementName}
                  />
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                  <div className="space-y-0.5">
                    <p className="font-medium text-sm">Fonte maior na via de produção</p>
                    <p className="text-xs text-muted-foreground">
                      Usa fonte maior para os produtos na comanda da cozinha
                    </p>
                  </div>
                  <Switch 
                    checked={largeFontProduction}
                    onCheckedChange={toggleLargeFontProduction}
                  />
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                  <div className="space-y-0.5">
                    <p className="font-medium text-sm">Multiplicar opções pela quantidade</p>
                    <p className="text-xs text-muted-foreground">
                      A quantidade de complementos será baseada na quantidade do produto
                    </p>
                  </div>
                  <Switch 
                    checked={multiplyOptions}
                    onCheckedChange={toggleMultiplyOptions}
                  />
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                  <div className="space-y-0.5">
                    <p className="font-medium text-sm">Ocultar quantidade quando nome inicia com número</p>
                    <p className="text-xs text-muted-foreground">
                      Não exibe "1x", "2x" quando o nome do produto já começa com um número
                    </p>
                  </div>
                  <Switch 
                    checked={hideComboQuantity}
                    onCheckedChange={toggleHideComboQuantity}
                  />
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                  <div className="space-y-0.5">
                    <p className="font-medium text-sm">Ocultar categoria do sabor na impressão</p>
                    <p className="text-xs text-muted-foreground">
                      Remove a linha "🍕 PIZZA 1:" na comanda, mostrando apenas os nomes dos sabores
                    </p>
                  </div>
                  <Switch 
                    checked={hideFlavorCategoryPrint}
                    onCheckedChange={toggleHideFlavorCategoryPrint}
                  />
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                  <div className="space-y-0.5">
                    <p className="font-medium text-sm">Imprimir logo da empresa</p>
                    <p className="text-xs text-muted-foreground">
                      Exibe a logo no topo do recibo (requer configuração)
                    </p>
                  </div>
                  <Switch 
                    checked={showLogo}
                    onCheckedChange={toggleShowLogo}
                  />
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                  <div className="space-y-0.5">
                    <p className="font-medium text-sm">Imprimir comprovante de cancelamento</p>
                    <p className="text-xs text-muted-foreground">
                      Imprime nota ao cancelar itens de um pedido
                    </p>
                  </div>
                  <Switch 
                    checked={printCancellation}
                    onCheckedChange={togglePrintCancellation}
                  />
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                  <div className="space-y-0.5">
                    <p className="font-medium text-sm">Imprimir QR Code de avaliação</p>
                    <p className="text-xs text-muted-foreground">
                      QR Code para avaliar o pedido (nem todas as impressoras suportam)
                    </p>
                  </div>
                  <Switch 
                    checked={printRatingQr}
                    onCheckedChange={togglePrintRatingQr}
                  />
                </div>
              </div>
            </div>

            {/* Custom Messages */}
            <CustomMessagesSection
              printMessageStandard={printMessageStandard}
              printMessageTable={printMessageTable}
              printQrStandard={printQrStandard}
              printQrTable={printQrTable}
              qrCodeSize={qrCodeSize}
              onMessageStandardChange={updatePrintMessageStandard}
              onMessageTableChange={updatePrintMessageTable}
              onQrStandardChange={updatePrintQrStandard}
              onQrTableChange={updatePrintQrTable}
              onQrCodeSizeChange={updateQrCodeSize}
            />

        {/* Print Sectors */}
        {printerCtx.isConnected && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-base font-semibold flex items-center gap-2">
                <Flame className="w-4 h-4" />
                Setores de Impressão
              </Label>
              <Button size="sm" onClick={() => { setEditingSector(null); setSectorForm({ name: '', description: '', printer_name: '', color: '#EF4444', icon: 'Flame' }); setSectorDialogOpen(true); }}>
                <Plus className="w-4 h-4 mr-1" /> Novo Setor
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">Configure setores de produção com impressoras dedicadas (Churrasqueira, Bar, Chapa, etc.)</p>
            <div className="rounded-lg border divide-y">
              {printSectors?.map((sector) => {
                const IconComponent = SECTOR_ICONS.find(i => i.value === sector.icon)?.icon || Flame;
                return (
                  <div key={sector.id} className="flex items-center justify-between p-3">
                    <div className="flex items-center gap-3">
                      <IconComponent className="w-5 h-5" style={{ color: sector.color || '#EF4444' }} />
                      <div>
                        <div className="font-medium">{sector.name}</div>
                        <div className="text-xs text-muted-foreground">{sector.printer_name || 'Sem impressora'}</div>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" onClick={() => { setEditingSector(sector); setSectorForm({ name: sector.name, description: sector.description || '', printer_name: sector.printer_name || '', color: sector.color || '#EF4444', icon: sector.icon || 'Flame' }); setSectorDialogOpen(true); }}><Edit className="w-4 h-4" /></Button>
                      <Button variant="ghost" size="sm" onClick={() => deleteSector.mutate(sector.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                    </div>
                  </div>
                );
              })}
              {(!printSectors || printSectors.length === 0) && <div className="p-4 text-center text-muted-foreground text-sm">Nenhum setor configurado</div>}
            </div>
          </div>
        )}

        {/* Available Printers List */}
        {printerCtx.isConnected && printerCtx.printers.length > 0 && (
          <div className="space-y-2">
            <Label>Impressoras Disponíveis</Label>
            <div className="rounded-lg border divide-y">
              {printerCtx.printers.map((p) => (
                <div key={p} className="flex items-center justify-between p-3">
                  <div className="flex items-center gap-2">
                    <Printer className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm">{p}</span>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => handleTestPrint(p)} disabled={testingPrinter === p}>
                    {testingPrinter === p ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Testar'}
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>

      {/* Sector Dialog */}
      <Dialog open={sectorDialogOpen} onOpenChange={setSectorDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingSector ? 'Editar' : 'Novo'} Setor</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>Nome *</Label><Input value={sectorForm.name} onChange={(e) => setSectorForm({...sectorForm, name: e.target.value})} placeholder="Ex: Churrasqueira" /></div>
            <div className="space-y-2"><Label>Descrição</Label><Input value={sectorForm.description} onChange={(e) => setSectorForm({...sectorForm, description: e.target.value})} placeholder="Ex: Carnes grelhadas" /></div>
            <div className="space-y-2"><Label>Ícone</Label>
              <Select value={sectorForm.icon} onValueChange={(v) => setSectorForm({...sectorForm, icon: v})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SECTOR_ICONS.map(iconOption => {
                    const IconComp = iconOption.icon;
                    return (
                      <SelectItem key={iconOption.value} value={iconOption.value}>
                        <div className="flex items-center gap-2">
                          <IconComp className="w-4 h-4" />
                          {iconOption.label}
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Impressora</Label>
              <Select value={sectorForm.printer_name} onValueChange={(v) => setSectorForm({...sectorForm, printer_name: v})}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>{printerCtx.printers.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Cor</Label><Input type="color" value={sectorForm.color} onChange={(e) => setSectorForm({...sectorForm, color: e.target.value})} className="h-10 w-20" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSectorDialogOpen(false)}>Cancelar</Button>
            <Button onClick={async () => {
              if (!sectorForm.name) return;
              if (editingSector) {
                await updateSector.mutateAsync({ id: editingSector.id, name: sectorForm.name, description: sectorForm.description || null, printer_name: sectorForm.printer_name || null, color: sectorForm.color, icon: sectorForm.icon });
              } else {
                await createSector.mutateAsync({ name: sectorForm.name, description: sectorForm.description || null, printer_name: sectorForm.printer_name || null, color: sectorForm.color, is_active: true, sort_order: 0, icon: sectorForm.icon });
              }
              setSectorDialogOpen(false);
            }}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
