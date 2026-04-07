import React, { useState, useEffect, memo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Check, X, Edit } from 'lucide-react';

interface CustomerNameInputProps {
  initialValue: string | null;
  onSave: (name: string) => Promise<void>;
}

export const CustomerNameInput = memo(function CustomerNameInput({
  initialValue,
  onSave,
}: CustomerNameInputProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [localValue, setLocalValue] = useState(initialValue || '');

  // Sync with external value when not editing
  useEffect(() => {
    if (!isEditing) {
      setLocalValue(initialValue || '');
    }
  }, [initialValue, isEditing]);

  const handleSave = useCallback(async () => {
    await onSave(localValue.trim());
    setIsEditing(false);
  }, [localValue, onSave]);

  const handleCancel = useCallback(() => {
    setLocalValue(initialValue || '');
    setIsEditing(false);
  }, [initialValue]);

  const handleStartEdit = useCallback(() => {
    setLocalValue(initialValue || '');
    setIsEditing(true);
  }, [initialValue]);

  if (isEditing) {
    return (
      <div className="flex items-center gap-1">
        <Input
          value={localValue}
          onChange={(e) => setLocalValue(e.target.value)}
          className="h-7 w-32 text-sm"
          placeholder="Nome do cliente"
          autoFocus
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSave();
            if (e.key === 'Escape') handleCancel();
          }}
        />
        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={handleSave}>
          <Check className="h-3 w-3" />
        </Button>
        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={handleCancel}>
          <X className="h-3 w-3" />
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <span>{initialValue || '-'}</span>
      <Button 
        size="icon" 
        variant="ghost" 
        className="h-6 w-6"
        onClick={handleStartEdit}
      >
        <Edit className="h-3 w-3" />
      </Button>
    </div>
  );
});
