import React, { useState, useEffect, memo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table } from '@/hooks/useTables';
import { format, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar, Clock, Phone, Users } from 'lucide-react';

const timeSlots = [
  '11:00', '11:30', '12:00', '12:30', '13:00', '13:30', '14:00',
  '18:00', '18:30', '19:00', '19:30', '20:00', '20:30', '21:00', '21:30', '22:00'
];

interface ReservationData {
  table_id: string;
  customer_name: string;
  customer_phone: string;
  reservation_date: string;
  reservation_time: string;
  party_size: number;
  notes: string;
}

interface ReservationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tables: Table[] | undefined;
  onConfirm: (data: ReservationData) => Promise<void>;
  isPending?: boolean;
}

const dateOptions = Array.from({ length: 7 }, (_, i) => {
  const date = addDays(new Date(), i);
  return {
    value: format(date, 'yyyy-MM-dd'),
    label: format(date, "EEE, dd 'de' MMM", { locale: ptBR }),
  };
});

export const ReservationDialog = memo(function ReservationDialog({
  open,
  onOpenChange,
  tables,
  onConfirm,
  isPending,
}: ReservationDialogProps) {
  // Local state for inputs - prevents parent re-renders on every keystroke
  const [tableId, setTableId] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [reservationDate, setReservationDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [reservationTime, setReservationTime] = useState('19:00');
  const [partySize, setPartySize] = useState(2);
  const [notes, setNotes] = useState('');

  // Reset local state when dialog opens
  useEffect(() => {
    if (open) {
      setTableId('');
      setCustomerName('');
      setCustomerPhone('');
      setReservationDate(format(new Date(), 'yyyy-MM-dd'));
      setReservationTime('19:00');
      setPartySize(2);
      setNotes('');
    }
  }, [open]);

  const handleConfirm = async () => {
    if (!tableId || !customerName) return;
    await onConfirm({
      table_id: tableId,
      customer_name: customerName,
      customer_phone: customerPhone,
      reservation_date: reservationDate,
      reservation_time: reservationTime,
      party_size: partySize,
      notes,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Nova Reserva
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-4 max-h-[60vh] overflow-y-auto">
          <div className="space-y-2">
            <Label>Mesa *</Label>
            <Select value={tableId} onValueChange={setTableId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione uma mesa" />
              </SelectTrigger>
              <SelectContent>
                {tables?.filter(t => t.status === 'available').map(table => (
                  <SelectItem key={table.id} value={table.id}>
                    Mesa {table.number} ({table.capacity} lugares)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-1">
                <Calendar className="h-3 w-3" /> Data
              </Label>
              <Select value={reservationDate} onValueChange={setReservationDate}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {dateOptions.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-1">
                <Clock className="h-3 w-3" /> Horário
              </Label>
              <Select value={reservationTime} onValueChange={setReservationTime}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {timeSlots.map(time => (
                    <SelectItem key={time} value={time}>{time}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Nome do Cliente *</Label>
            <Input
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Nome completo"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-1">
                <Phone className="h-3 w-3" /> Telefone
              </Label>
              <Input
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="(00) 00000-0000"
              />
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-1">
                <Users className="h-3 w-3" /> Pessoas
              </Label>
              <Input
                type="number"
                min={1}
                value={partySize}
                onChange={(e) => setPartySize(parseInt(e.target.value) || 1)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Informações adicionais..."
              rows={2}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button 
            onClick={handleConfirm} 
            disabled={isPending || !tableId || !customerName}
          >
            Criar Reserva
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
});
