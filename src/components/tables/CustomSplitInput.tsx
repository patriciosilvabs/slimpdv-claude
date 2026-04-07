import React, { useState, useEffect, memo, useCallback } from 'react';
import { Input } from '@/components/ui/input';

interface CustomSplitInputProps {
  index: number;
  value: number;
  onChange: (index: number, value: number) => void;
}

export const CustomSplitInput = memo(function CustomSplitInput({
  index,
  value,
  onChange,
}: CustomSplitInputProps) {
  // Local state to prevent parent re-renders on every keystroke
  const [localValue, setLocalValue] = useState(value.toString());

  // Sync with external value
  useEffect(() => {
    setLocalValue(value ? value.toString() : '');
  }, [value]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setLocalValue(newValue);
    
    // Use requestAnimationFrame to batch updates
    requestAnimationFrame(() => {
      const numValue = parseFloat(newValue.replace(',', '.')) || 0;
      onChange(index, numValue);
    });
  }, [index, onChange]);

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground w-16">Pessoa {index + 1}</span>
      <span className="text-muted-foreground">R$</span>
      <Input
        type="number"
        value={localValue}
        onChange={handleChange}
        className="h-8 flex-1"
        placeholder="0,00"
      />
    </div>
  );
});
