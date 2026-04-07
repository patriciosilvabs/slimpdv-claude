import React, { memo } from 'react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DebouncedInput, DebouncedTextarea } from '@/components/ui/debounced-input';
import { MessageSquare, QrCode } from 'lucide-react';

interface CustomMessagesSectionProps {
  printMessageStandard: string;
  printMessageTable: string;
  printQrStandard: string;
  printQrTable: string;
  qrCodeSize: number;
  onMessageStandardChange: (value: string) => void;
  onMessageTableChange: (value: string) => void;
  onQrStandardChange: (value: string) => void;
  onQrTableChange: (value: string) => void;
  onQrCodeSizeChange: (size: number) => void;
}

export const CustomMessagesSection = memo(function CustomMessagesSection({
  printMessageStandard,
  printMessageTable,
  printQrStandard,
  printQrTable,
  qrCodeSize,
  onMessageStandardChange,
  onMessageTableChange,
  onQrStandardChange,
  onQrTableChange,
  onQrCodeSizeChange,
}: CustomMessagesSectionProps) {
  return (
    <div className="space-y-4 pt-4 border-t">
      <Label className="text-base font-medium flex items-center gap-2">
        <MessageSquare className="w-4 h-4" />
        Mensagens Personalizadas
      </Label>

      <div className="space-y-4">
        {/* Standard Message (delivery, takeaway) */}
        <div className="space-y-2">
          <Label className="text-sm">Mensagem da Via Padrão (delivery, retirada e no local)</Label>
          <DebouncedTextarea
            value={printMessageStandard}
            onSave={onMessageStandardChange}
            placeholder="Obrigado pelo seu pedido!"
            rows={3}
            className="resize-none"
          />
        </div>

        <div className="space-y-2">
          <Label className="text-sm flex items-center gap-2">
            <QrCode className="w-4 h-4" />
            QR Code da Via Padrão (opcional)
          </Label>
          <DebouncedInput
            value={printQrStandard}
            onSave={onQrStandardChange}
            placeholder="https://meu-restaurante.com/avaliacao"
          />
          <p className="text-xs text-muted-foreground">
            O QR Code pode direcionar para link de avaliação ou chave Pix
          </p>
        </div>

        {/* Table Message */}
        <div className="space-y-2">
          <Label className="text-sm">Mensagem da Via de Fechamento de Mesa</Label>
          <DebouncedTextarea
            value={printMessageTable}
            onSave={onMessageTableChange}
            placeholder="Obrigado pela preferência!"
            rows={3}
            className="resize-none"
          />
        </div>

        <div className="space-y-2">
          <Label className="text-sm flex items-center gap-2">
            <QrCode className="w-4 h-4" />
            QR Code da Via de Fechamento (opcional)
          </Label>
          <DebouncedInput
            value={printQrTable}
            onSave={onQrTableChange}
            placeholder="https://meu-restaurante.com/avaliacao"
          />
          <p className="text-xs text-muted-foreground">
            O QR Code pode direcionar para link de avaliação ou chave Pix para gorjeta
          </p>
        </div>

        {/* QR Code Size */}
        {(printQrStandard || printQrTable) && (
          <div className="space-y-2 pt-2 border-t">
            <Label className="text-sm flex items-center gap-2">
              <QrCode className="w-4 h-4" />
              Tamanho do QR Code
            </Label>
            <Select value={String(qrCodeSize)} onValueChange={(v) => onQrCodeSizeChange(parseInt(v))}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="3">Pequeno (3)</SelectItem>
                <SelectItem value="4">Médio-pequeno (4)</SelectItem>
                <SelectItem value="5">Médio (5) - Padrão</SelectItem>
                <SelectItem value="6">Médio-grande (6)</SelectItem>
                <SelectItem value="8">Grande (8)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">Aumenta ou diminui o tamanho do QR Code impresso</p>
          </div>
        )}
      </div>
    </div>
  );
});
