import React, { useState, useEffect, useRef, memo, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DebouncedInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  value: string;
  onSave: (value: string) => void;
  debounceMs?: number;
  showSaveIndicator?: boolean;
}

export const DebouncedInput = memo(function DebouncedInput({
  value,
  onSave,
  debounceMs = 500,
  showSaveIndicator = true,
  className,
  ...props
}: DebouncedInputProps) {
  const [localValue, setLocalValue] = useState(value);
  const [showSaved, setShowSaved] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedIndicatorRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedValueRef = useRef(value);

  // Sync with external value only when it changes from outside
  useEffect(() => {
    if (value !== savedValueRef.current) {
      setLocalValue(value);
      savedValueRef.current = value;
    }
  }, [value]);

  const showSavedIndicator = useCallback(() => {
    if (!showSaveIndicator) return;
    setShowSaved(true);
    if (savedIndicatorRef.current) {
      clearTimeout(savedIndicatorRef.current);
    }
    savedIndicatorRef.current = setTimeout(() => {
      setShowSaved(false);
    }, 1500);
  }, [showSaveIndicator]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setLocalValue(newValue);

    // Clear previous timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Schedule new save
    timeoutRef.current = setTimeout(() => {
      savedValueRef.current = newValue;
      onSave(newValue);
      showSavedIndicator();
    }, debounceMs);
  }, [debounceMs, onSave, showSavedIndicator]);

  const handleBlur = useCallback(() => {
    // Save immediately on blur if value changed
    if (localValue !== savedValueRef.current) {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      savedValueRef.current = localValue;
      onSave(localValue);
      showSavedIndicator();
    }
  }, [localValue, onSave, showSavedIndicator]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (savedIndicatorRef.current) {
        clearTimeout(savedIndicatorRef.current);
      }
    };
  }, []);

  return (
    <div className="relative">
      <Input
        value={localValue}
        onChange={handleChange}
        onBlur={handleBlur}
        className={cn(showSaved && "pr-8 border-green-500", className)}
        {...props}
      />
      {showSaved && (
        <div className="absolute right-2 top-1/2 -translate-y-1/2 text-green-500 animate-in fade-in zoom-in duration-200">
          <Check className="h-4 w-4" />
        </div>
      )}
    </div>
  );
});

interface DebouncedTextareaProps extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'onChange'> {
  value: string;
  onSave: (value: string) => void;
  debounceMs?: number;
  showSaveIndicator?: boolean;
}

export const DebouncedTextarea = memo(function DebouncedTextarea({
  value,
  onSave,
  debounceMs = 500,
  showSaveIndicator = true,
  className,
  ...props
}: DebouncedTextareaProps) {
  const [localValue, setLocalValue] = useState(value);
  const [showSaved, setShowSaved] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedIndicatorRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedValueRef = useRef(value);

  // Sync with external value only when it changes from outside
  useEffect(() => {
    if (value !== savedValueRef.current) {
      setLocalValue(value);
      savedValueRef.current = value;
    }
  }, [value]);

  const showSavedIndicatorFn = useCallback(() => {
    if (!showSaveIndicator) return;
    setShowSaved(true);
    if (savedIndicatorRef.current) {
      clearTimeout(savedIndicatorRef.current);
    }
    savedIndicatorRef.current = setTimeout(() => {
      setShowSaved(false);
    }, 1500);
  }, [showSaveIndicator]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    setLocalValue(newValue);

    // Clear previous timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Schedule new save
    timeoutRef.current = setTimeout(() => {
      savedValueRef.current = newValue;
      onSave(newValue);
      showSavedIndicatorFn();
    }, debounceMs);
  }, [debounceMs, onSave, showSavedIndicatorFn]);

  const handleBlur = useCallback(() => {
    // Save immediately on blur if value changed
    if (localValue !== savedValueRef.current) {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      savedValueRef.current = localValue;
      onSave(localValue);
      showSavedIndicatorFn();
    }
  }, [localValue, onSave, showSavedIndicatorFn]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (savedIndicatorRef.current) {
        clearTimeout(savedIndicatorRef.current);
      }
    };
  }, []);

  return (
    <div className="relative">
      <Textarea
        value={localValue}
        onChange={handleChange}
        onBlur={handleBlur}
        className={cn(showSaved && "pr-8 border-green-500", className)}
        {...props}
      />
      {showSaved && (
        <div className="absolute right-2 top-3 text-green-500 animate-in fade-in zoom-in duration-200">
          <Check className="h-4 w-4" />
        </div>
      )}
    </div>
  );
});
