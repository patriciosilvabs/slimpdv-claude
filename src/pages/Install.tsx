import { Link } from "react-router-dom";
import { ArrowLeft, Monitor, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useInstallPWA } from "@/hooks/useInstallPWA";
import { usePWAStatus } from "@/hooks/usePWAStatus";
import { IOSInstallInstructions } from "@/components/pwa/IOSInstallInstructions";
import { AndroidInstallButton } from "@/components/pwa/AndroidInstallButton";
import { InstallBenefits } from "@/components/pwa/InstallBenefits";

export default function Install() {
  const { 
    canInstall, 
    isInstalled, 
    isIOS, 
    isAndroid, 
    isStandalone,
    promptInstall 
  } = useInstallPWA();
  
  const { serviceWorkerStatus, hasBackgroundSync } = usePWAStatus();

  const getPlatformName = () => {
    if (isIOS) return "iPhone/iPad";
    if (isAndroid) return "Android";
    return "Desktop";
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur sticky top-0 z-10">
        <div className="container flex items-center gap-4 h-14 px-4">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/dashboard">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <h1 className="font-semibold">Instalar App</h1>
        </div>
      </header>

      <main className="container px-4 py-6 max-w-lg mx-auto space-y-6">
        {/* App Icon and Title */}
        <div className="flex flex-col items-center text-center">
          <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center mb-4 shadow-lg">
            <span className="text-4xl">🍕</span>
          </div>
          <h2 className="text-2xl font-bold">PDV Pizzaria</h2>
          <p className="text-muted-foreground mt-1">
            Sistema de Ponto de Venda
          </p>
        </div>

        {/* Already Installed State */}
        {(isInstalled || isStandalone) && (
          <Card className="border-green-500/20 bg-green-500/5">
            <CardContent className="p-6">
              <div className="flex flex-col items-center text-center gap-3">
                <CheckCircle2 className="h-12 w-12 text-green-500" />
                <div>
                  <p className="text-lg font-medium text-green-500">App Instalado!</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Você já está usando o PDV Pizzaria como app
                  </p>
                </div>
                <Button asChild className="mt-2">
                  <Link to="/dashboard">Ir para o Dashboard</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Installation Instructions */}
        {!isInstalled && !isStandalone && (
          <>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">
                  Instalação para {getPlatformName()}
                </CardTitle>
                <CardDescription>
                  {isIOS 
                    ? "Siga os passos abaixo usando o Safari"
                    : "Clique no botão para instalar o app"
                  }
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isIOS ? (
                  <IOSInstallInstructions />
                ) : canInstall ? (
                  <AndroidInstallButton 
                    onInstall={promptInstall} 
                    isInstalled={isInstalled} 
                  />
                ) : (
                  <div className="text-center py-6">
                    <Monitor className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                    <p className="text-muted-foreground">
                      Procure pelo ícone de instalação na barra de endereço do seu navegador
                    </p>
                    <p className="text-xs text-muted-foreground mt-2">
                      Chrome, Edge e outros navegadores mostram um ícone "+" ou de instalação
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Separator />

            {/* Benefits */}
            <div>
              <h3 className="font-semibold mb-4">Por que instalar?</h3>
              <InstallBenefits />
            </div>
          </>
        )}

        {/* PWA Status Info */}
        <Card className="bg-muted/30">
          <CardContent className="p-4">
            <h4 className="text-sm font-medium mb-2">Status do Sistema</h4>
            <div className="space-y-1 text-xs text-muted-foreground">
              <div className="flex justify-between">
                <span>Service Worker:</span>
                <span className={serviceWorkerStatus === 'active' ? 'text-green-500' : ''}>
                  {serviceWorkerStatus === 'active' ? 'Ativo' : 
                   serviceWorkerStatus === 'installing' ? 'Instalando...' :
                   serviceWorkerStatus === 'waiting' ? 'Aguardando' :
                   serviceWorkerStatus === 'error' ? 'Erro' : 'Não suportado'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Background Sync:</span>
                <span className={hasBackgroundSync ? 'text-green-500' : ''}>
                  {hasBackgroundSync ? 'Suportado' : 'Não suportado'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Modo Standalone:</span>
                <span className={isStandalone ? 'text-green-500' : ''}>
                  {isStandalone ? 'Sim' : 'Não'}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
