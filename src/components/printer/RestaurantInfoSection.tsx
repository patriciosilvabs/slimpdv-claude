import React, { memo, useCallback, useState } from 'react';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DebouncedInput } from '@/components/ui/debounced-input';
import { Store, MapPin, Phone, FileText, Image, Upload, X, RefreshCw, Loader2 } from 'lucide-react';
import { LogoPrintMode } from '@/hooks/useOrderSettings';
import { cn } from '@/lib/utils';

interface RestaurantInfoSectionProps {
  restaurantName: string;
  restaurantAddress: string;
  restaurantPhone: string;
  restaurantCnpj: string;
  restaurantLogoUrl: string;
  showLogo: boolean;
  logoPrintMode: LogoPrintMode;
  logoMaxWidth: number;
  paperWidth: string;
  onNameChange: (value: string) => void;
  onAddressChange: (value: string) => void;
  onPhoneChange: (value: string) => void;
  onCnpjChange: (value: string) => void;
  onLogoUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onLogoRemove: () => void;
  onClearLogoCache: () => void;
  onShowLogoChange: (checked: boolean) => void;
  updateLogoPrintMode: (mode: LogoPrintMode) => void;
  updateLogoMaxWidth: (width: number) => void;
  uploadingLogo: boolean;
}

export const RestaurantInfoSection = memo(function RestaurantInfoSection({
  restaurantName,
  restaurantAddress,
  restaurantPhone,
  restaurantCnpj,
  restaurantLogoUrl,
  showLogo,
  logoPrintMode,
  logoMaxWidth,
  paperWidth,
  onNameChange,
  onAddressChange,
  onPhoneChange,
  onCnpjChange,
  onLogoUpload,
  onLogoRemove,
  onClearLogoCache,
  onShowLogoChange,
  updateLogoPrintMode,
  updateLogoMaxWidth,
  uploadingLogo,
}: RestaurantInfoSectionProps) {
  return (
    <div className="space-y-4">
      <Label className="text-base font-medium flex items-center gap-2">
        <Store className="w-4 h-4" />
        Dados do Restaurante
      </Label>

      {/* Restaurant Name */}
      <div className="space-y-2">
        <Label className="flex items-center gap-2">
          <Store className="w-4 h-4" />
          Nome do Restaurante
        </Label>
        <DebouncedInput
          value={restaurantName}
          onSave={onNameChange}
          placeholder="Nome que aparecerá nas impressões"
        />
      </div>

      {/* Restaurant Address */}
      <div className="space-y-2">
        <Label className="flex items-center gap-2">
          <MapPin className="w-4 h-4" />
          Endereço do Restaurante
        </Label>
        <DebouncedInput
          value={restaurantAddress}
          onSave={onAddressChange}
          placeholder="Rua, número - Bairro, Cidade"
        />
      </div>

      {/* Restaurant Phone */}
      <div className="space-y-2">
        <Label className="flex items-center gap-2">
          <Phone className="w-4 h-4" />
          Telefone do Restaurante
        </Label>
        <DebouncedInput
          value={restaurantPhone}
          onSave={onPhoneChange}
          placeholder="(XX) XXXXX-XXXX"
        />
        <p className="text-xs text-muted-foreground">
          Telefone para contato
        </p>
      </div>

      {/* Restaurant CNPJ */}
      <div className="space-y-2">
        <Label className="flex items-center gap-2">
          <FileText className="w-4 h-4" />
          CNPJ/CPF do Restaurante
        </Label>
        <DebouncedInput
          value={restaurantCnpj}
          onSave={onCnpjChange}
          placeholder="XX.XXX.XXX/XXXX-XX ou XXX.XXX.XXX-XX"
        />
        <p className="text-xs text-muted-foreground">
          Estes dados aparecerão no cabeçalho dos recibos fiscais
        </p>
      </div>

      {/* Restaurant Logo */}
      <div className="space-y-3 p-4 rounded-lg border bg-muted/30">
        <Label className="flex items-center gap-2">
          <Image className="w-4 h-4" />
          Logomarca do Restaurante
        </Label>

        <div className="flex items-center gap-4">
          {restaurantLogoUrl ? (
            <div className="relative">
              <img
                src={restaurantLogoUrl}
                alt="Logo do restaurante"
                className="w-20 h-20 object-contain rounded border bg-white"
              />
              <Button
                variant="destructive"
                size="icon"
                className="absolute -top-2 -right-2 h-6 w-6"
                onClick={onLogoRemove}
              >
                <X className="w-3 h-3" />
              </Button>
            </div>
          ) : (
            <div className="w-20 h-20 rounded border-2 border-dashed flex items-center justify-center bg-muted/50">
              <Image className="w-8 h-8 text-muted-foreground" />
            </div>
          )}

          <div className="flex-1 space-y-2">
            <input
              type="file"
              id="logo-upload"
              accept="image/png,image/jpeg,image/jpg"
              onChange={onLogoUpload}
              className="hidden"
            />
            <Button
              variant="outline"
              onClick={() => document.getElementById('logo-upload')?.click()}
              disabled={uploadingLogo}
              className="w-full"
            >
              {uploadingLogo ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Upload className="w-4 h-4 mr-2" />
              )}
              {restaurantLogoUrl ? 'Trocar Logo' : 'Enviar Logo'}
            </Button>
            <p className="text-xs text-muted-foreground">
              Formatos: PNG, JPG • Máx: 500KB
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between pt-2 border-t">
          <div className="space-y-0.5">
            <Label className="text-sm">Imprimir logo nos recibos</Label>
            <p className="text-xs text-muted-foreground">
              A logo aparecerá no cabeçalho dos recibos de clientes
            </p>
          </div>
          <Switch
            checked={showLogo}
            onCheckedChange={onShowLogoChange}
            disabled={!restaurantLogoUrl}
          />
        </div>

        {/* Logo Print Mode */}
        {restaurantLogoUrl && showLogo && (
          <div className="space-y-3 pt-2 border-t">
            <Label className="text-sm">Modo de Cor da Logo</Label>
            <Select
              value={logoPrintMode}
              onValueChange={(v) => updateLogoPrintMode(v as LogoPrintMode)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="original">Original (colorido)</SelectItem>
                <SelectItem value="grayscale">Escala de Cinza</SelectItem>
                <SelectItem value="dithered">Preto e Branco (Dithering)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Impressoras térmicas podem ter melhor resultado com Escala de Cinza ou Dithering
            </p>

            {/* Preview dos 3 modos */}
            <div className="grid grid-cols-3 gap-2">
              {[
                { mode: 'original' as LogoPrintMode, label: 'Original' },
                { mode: 'grayscale' as LogoPrintMode, label: 'Cinza' },
                { mode: 'dithered' as LogoPrintMode, label: 'P&B' },
              ].map(({ mode, label }) => (
                <div
                  key={mode}
                  className={cn(
                    'p-2 rounded border text-center cursor-pointer transition-colors',
                    logoPrintMode === mode
                      ? 'border-primary bg-primary/10'
                      : 'border-muted hover:border-muted-foreground'
                  )}
                  onClick={() => updateLogoPrintMode(mode)}
                >
                  <div
                    className="w-full aspect-square bg-white rounded mb-1 overflow-hidden flex items-center justify-center"
                    style={{
                      filter:
                        mode === 'grayscale'
                          ? 'grayscale(100%)'
                          : mode === 'dithered'
                          ? 'grayscale(100%) contrast(200%)'
                          : 'none',
                    }}
                  >
                    <img src={restaurantLogoUrl} alt={label} className="max-w-full max-h-full object-contain" />
                  </div>
                  <span className="text-xs">{label}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Logo Max Width */}
        {restaurantLogoUrl && showLogo && (
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label className="text-sm">Largura máxima da logo (pixels)</Label>
              <Select value={String(logoMaxWidth)} onValueChange={(v) => updateLogoMaxWidth(parseInt(v))}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="150">150px (pequena)</SelectItem>
                  <SelectItem value="200">200px</SelectItem>
                  <SelectItem value="250">250px</SelectItem>
                  <SelectItem value="300">300px (padrão)</SelectItem>
                  <SelectItem value="350">350px</SelectItem>
                  <SelectItem value="400">400px (grande)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Ajuste de acordo com a largura do papel (58mm: 150-250px / 80mm: 250-400px)
              </p>
            </div>

            {/* Logo Preview */}
            <div className="space-y-2">
              <Label className="text-sm">Pré-visualização do tamanho</Label>
              <div className="p-4 bg-white dark:bg-black rounded-lg border flex flex-col items-center gap-2">
                <img
                  src={restaurantLogoUrl}
                  alt="Preview da logo"
                  style={{
                    maxWidth: `${logoMaxWidth}px`,
                    width: '100%',
                    height: 'auto',
                  }}
                  className="object-contain"
                />
                <p className="text-xs text-muted-foreground">Largura máxima: {logoMaxWidth}px</p>
              </div>
              {/* Width indicator bar */}
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <div
                  className="h-2 bg-primary/50 rounded transition-all"
                  style={{
                    width: `${Math.min((logoMaxWidth / (paperWidth === '58mm' ? 384 : 576)) * 100, 100)}%`,
                    maxWidth: '200px',
                  }}
                />
                <span>
                  {logoMaxWidth}px de {paperWidth === '58mm' ? '384' : '576'}px disponíveis
                </span>
              </div>
            </div>

            {/* Clear Cache Button */}
            <Button variant="outline" size="sm" onClick={onClearLogoCache} className="w-full">
              <RefreshCw className="w-4 h-4 mr-2" />
              Limpar Cache da Logo
            </Button>
            <p className="text-xs text-muted-foreground">
              Use se a logo foi alterada no servidor mas ainda imprime a versão antiga
            </p>
          </div>
        )}
      </div>
    </div>
  );
});
