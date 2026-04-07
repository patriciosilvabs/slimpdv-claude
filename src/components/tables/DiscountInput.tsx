import React, { useState, useEffect, memo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tag, Percent } from 'lucide-react';

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

interface DiscountInputProps {
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  subtotal: number;
  onChange: (type: 'percentage' | 'fixed', value: number) => void;
  disabled?: boolean;
}

export const DiscountInput = memo(function DiscountInput({
  discountType,
  discountValue,
  subtotal,
  onChange,
  disabled = false,
}: DiscountInputProps) {
  // Local state to prevent parent re-renders on every keystroke
  const [localType, setLocalType] = useState(discountType);
  const [localValue, setLocalValue] = useState(discountValue.toString());

  // Sync with external values when they change externally
  useEffect(() => {
    setLocalType(discountType);
    setLocalValue(discountValue.toString());
  }, [discountType, discountValue]);

  // Debounced update to parent
  const handleValueChange = useCallback((value: string) => {
    setLocalValue(value);
    const numValue = parseFloat(value) || 0;
    // Use requestAnimationFrame to batch updates
    requestAnimationFrame(() => {
      onChange(localType, numValue);
    });
  }, [localType, onChange]);

  const handleTypeChange = useCallback((type: 'percentage' | 'fixed') => {
    setLocalType(type);
    const numValue = parseFloat(localValue) || 0;
    onChange(type, numValue);
  }, [localValue, onChange]);

  const discountAmount = localType === 'percentage' 
    ? (subtotal * (parseFloat(localValue) || 0) / 100)
    : Math.min(parseFloat(localValue) || 0, subtotal);

  return (
    <div className="p-3 bg-muted/30 rounded-lg space-y-2">
      <div className="flex items-center gap-2">
        <Tag className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">Desconto</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex border rounded-md overflow-hidden">
          <Button 
            variant={localType === 'percentage' ? 'secondary' : 'ghost'}
            size="sm"
            className="rounded-none h-8 px-2"
            onClick={() => handleTypeChange('percentage')}
            disabled={disabled}
          >
            <Percent className="h-3 w-3" />
          </Button>
          <Button 
            variant={localType === 'fixed' ? 'secondary' : 'ghost'}
            size="sm"
            className="rounded-none h-8 px-2"
            onClick={() => handleTypeChange('fixed')}
            disabled={disabled}
          >
            R$
          </Button>
        </div>
        <Input
          type="number"
          value={localValue}
          onChange={(e) => handleValueChange(e.target.value)}
          className="h-8 w-20"
          min={0}
          max={localType === 'percentage' ? 100 : subtotal}
          disabled={disabled}
        />
        {discountAmount > 0 && (
          <span className="text-sm text-red-500 ml-auto">
            -{formatCurrency(discountAmount)}
          </span>
        )}
      </div>
    </div>
  );
});
