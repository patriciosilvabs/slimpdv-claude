import { Check, X } from 'lucide-react';

interface PasswordRequirementsProps {
  password: string;
}

const requirements = [
  { label: 'Mínimo 6 caracteres', test: (p: string) => p.length >= 6 },
  { label: 'Letra minúscula (a-z)', test: (p: string) => /[a-z]/.test(p) },
  { label: 'Letra maiúscula (A-Z)', test: (p: string) => /[A-Z]/.test(p) },
  { label: 'Número (0-9)', test: (p: string) => /[0-9]/.test(p) },
  { label: 'Caractere especial (!@#$...)', test: (p: string) => /[!@#$%^&*(),.?":{}|<>]/.test(p) },
];

export function PasswordRequirements({ password }: PasswordRequirementsProps) {
  if (!password) return null;

  return (
    <div className="space-y-1 text-sm">
      {requirements.map((req, index) => {
        const passed = req.test(password);
        return (
          <div
            key={index}
            className={`flex items-center gap-2 ${passed ? 'text-green-600' : 'text-muted-foreground'}`}
          >
            {passed ? (
              <Check className="h-3 w-3" />
            ) : (
              <X className="h-3 w-3" />
            )}
            <span>{req.label}</span>
          </div>
        );
      })}
    </div>
  );
}

export function validatePassword(password: string): boolean {
  return requirements.every((req) => req.test(password));
}
