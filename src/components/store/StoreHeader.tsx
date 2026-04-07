import { Input } from '@/components/ui/input';
import { Search, MapPin, Phone, Clock } from 'lucide-react';

interface StoreHeaderProps {
  tenant: {
    name: string;
    logo_url: string;
    phone: string;
    address: string;
  };
  table: { id: string; number: number } | null;
  searchQuery: string;
  onSearchChange: (q: string) => void;
}

export function StoreHeader({ tenant, table, searchQuery, onSearchChange }: StoreHeaderProps) {
  return (
    <header className="w-full">
      {/* Hero Banner */}
      <div className="relative w-full h-40 sm:h-56 bg-gradient-to-br from-amber-500 via-amber-400 to-yellow-400 overflow-hidden">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMjAiIGN5PSIyMCIgcj0iMSIgZmlsbD0icmdiYSgyNTUsMjU1LDI1NSwwLjEpIi8+PC9zdmc+')] opacity-30" />
        {table && (
          <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-sm rounded-full px-4 py-1.5 shadow-lg">
            <span className="text-sm font-bold text-amber-700">Mesa {table.number}</span>
          </div>
        )}
      </div>

      {/* Store Info Card */}
      <div className="max-w-4xl mx-auto px-4 -mt-12 relative z-10">
        <div className="bg-card rounded-2xl shadow-lg border border-border p-4 sm:p-6">
          <div className="flex items-start gap-4">
            {/* Logo */}
            {tenant.logo_url ? (
              <img
                src={tenant.logo_url}
                alt={tenant.name}
                className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl object-cover border-4 border-card shadow-md -mt-12 sm:-mt-16 bg-card"
              />
            ) : (
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-amber-500 flex items-center justify-center text-white font-bold text-3xl border-4 border-card shadow-md -mt-12 sm:-mt-16">
                {tenant.name.charAt(0)}
              </div>
            )}

            {/* Info */}
            <div className="flex-1 min-w-0 pt-1">
              <h1 className="text-lg sm:text-xl font-bold text-foreground truncate">{tenant.name}</h1>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
                {tenant.address && (
                  <span className="flex items-center gap-1 text-xs sm:text-sm text-muted-foreground">
                    <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
                    <span className="truncate">{tenant.address}</span>
                  </span>
                )}
                {tenant.phone && (
                  <a
                    href={`tel:${tenant.phone}`}
                    className="flex items-center gap-1 text-xs sm:text-sm text-muted-foreground hover:text-primary transition-colors"
                  >
                    <Phone className="h-3.5 w-3.5 flex-shrink-0" />
                    {tenant.phone}
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Sticky Search + Nav */}
      <div className="sticky top-0 z-30 bg-card/95 backdrop-blur-md border-b border-border shadow-sm mt-4">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Busque por um produto"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-9 h-10 bg-muted/50 border-muted rounded-xl text-sm"
            />
          </div>
        </div>
      </div>
    </header>
  );
}
