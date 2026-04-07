import { Download, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";

interface AndroidInstallButtonProps {
  onInstall: () => Promise<boolean>;
  isInstalled: boolean;
}

export function AndroidInstallButton({ onInstall, isInstalled }: AndroidInstallButtonProps) {
  const [isInstalling, setIsInstalling] = useState(false);

  const handleInstall = async () => {
    setIsInstalling(true);
    try {
      await onInstall();
    } finally {
      setIsInstalling(false);
    }
  };

  if (isInstalled) {
    return (
      <div className="flex flex-col items-center gap-3 p-6 bg-green-500/10 rounded-xl border border-green-500/20">
        <CheckCircle2 className="h-12 w-12 text-green-500" />
        <p className="text-lg font-medium text-green-500">App Instalado!</p>
        <p className="text-sm text-muted-foreground text-center">
          O PDV Pizzaria está disponível na sua tela inicial
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <Button
        size="lg"
        className="w-full max-w-xs h-14 text-lg gap-3"
        onClick={handleInstall}
        disabled={isInstalling}
      >
        {isInstalling ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin" />
            Instalando...
          </>
        ) : (
          <>
            <Download className="h-5 w-5" />
            Instalar App
          </>
        )}
      </Button>
      <p className="text-xs text-muted-foreground text-center">
        A instalação é rápida e não ocupa espaço significativo
      </p>
    </div>
  );
}
