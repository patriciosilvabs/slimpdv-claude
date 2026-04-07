import React, { useState, useEffect, memo, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Percent } from 'lucide-react';

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

interface ServiceChargeInputProps {
  enabled: boolean;
  percent: number;
  afterDiscountTotal: number;
  onEnabledChange: (enabled: boolean) => void;
  onPercentChange: (percent: number) => void;
}

export const ServiceChargeInput = memo(function ServiceChargeInput({
  enabled,
  percent,
  afterDiscountTotal,
  onEnabledChange,
  onPercentChange,
}: ServiceChargeInputProps) {
  // Local state to prevent parent re-renders on every keystroke
  const [localPercent, setLocalPercent] = useState(percent.toString());

  // Sync with external value
  useEffect(() => {
    setLocalPercent(percent.toString());
  }, [percent]);

  const handlePercentChange = useCallback((value: string) => {
    setLocalPercent(value);
    const numValue = parseFloat(value) || 0;
    // Use requestAnimationFrame to batch updates
    requestAnimationFrame(() => {
      onPercentChange(numValue);
    });
  }, [onPercentChange]);

  const serviceAmount = enabled ? afterDiscountTotal * (parseFloat(localPercent) || 0) / 100 : 0;

  return (
    <div className="p-3 bg-muted/30 rounded-lg space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Percent className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Taxa de serviço</span>
        </div>
        <Switch 
          checked={enabled} 
          onCheckedChange={onEnabledChange}
        />
      </div>
      {enabled && (
        <div className="flex items-center gap-2">
          <Input
            type="number"
            value={localPercent}
            onChange={(e) => handlePercentChange(e.target.value)}
            className="h-8 w-20"
            min={0}
            max={100}
          />
          <span className="text-sm text-muted-foreground">%</span>
          <span className="text-sm text-green-600 ml-auto">
            +{formatCurrency(serviceAmount)}
          </span>
        </div>
      )}
    </div>
  );
});
