import * as React from 'react';
import { cn } from '@/lib/utils';

interface CurrencyInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value' | 'type'> {
  value: number;
  onChange: (value: number) => void;
}

const CurrencyInput = React.forwardRef<HTMLInputElement, CurrencyInputProps>(
  ({ className, value, onChange, ...props }, ref) => {
    const [displayValue, setDisplayValue] = React.useState(() =>
      value ? value.toString().replace('.', ',') : ''
    );

    // Sync display when value changes externally
    React.useEffect(() => {
      const numericDisplay = displayValue.replace(',', '.');
      if (parseFloat(numericDisplay) !== value) {
        setDisplayValue(value ? value.toString().replace('.', ',') : '');
      }
    }, [value]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      let raw = e.target.value;

      // Allow only digits, comma, and dot
      raw = raw.replace(/[^0-9.,]/g, '');
      // Replace dot with comma for display
      raw = raw.replace('.', ',');
      // Only allow one comma
      const parts = raw.split(',');
      if (parts.length > 2) {
        raw = parts[0] + ',' + parts.slice(1).join('');
      }
      // Limit to 2 decimal places
      if (parts.length === 2 && parts[1].length > 2) {
        raw = parts[0] + ',' + parts[1].substring(0, 2);
      }

      setDisplayValue(raw);
      const numeric = parseFloat(raw.replace(',', '.')) || 0;
      onChange(numeric);
    };

    return (
      <input
        ref={ref}
        type="text"
        inputMode="decimal"
        className={cn(
          'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
          className
        )}
        value={displayValue}
        onChange={handleChange}
        {...props}
      />
    );
  }
);
CurrencyInput.displayName = 'CurrencyInput';

export { CurrencyInput };
