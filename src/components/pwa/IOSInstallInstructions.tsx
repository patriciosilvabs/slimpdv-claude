import { Share, Plus, ChevronDown } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export function IOSInstallInstructions() {
  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-center mb-6">
        No Safari, siga os passos abaixo para instalar o app:
      </p>
      
      <div className="space-y-3">
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-4">
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold">
                1
              </div>
              <div className="flex-1">
                <p className="font-medium">Toque no botão Compartilhar</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Na barra inferior do Safari, toque no ícone de compartilhamento
                </p>
                <div className="mt-3 flex justify-center">
                  <div className="p-3 bg-background rounded-lg border">
                    <Share className="h-8 w-8 text-primary" />
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-center">
          <ChevronDown className="h-5 w-5 text-muted-foreground animate-bounce" />
        </div>

        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-4">
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold">
                2
              </div>
              <div className="flex-1">
                <p className="font-medium">Role para baixo no menu</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Encontre a opção "Adicionar à Tela de Início"
                </p>
                <div className="mt-3 flex justify-center">
                  <div className="p-3 bg-background rounded-lg border flex items-center gap-2">
                    <Plus className="h-5 w-5 text-primary" />
                    <span className="text-sm">Adicionar à Tela de Início</span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-center">
          <ChevronDown className="h-5 w-5 text-muted-foreground animate-bounce" />
        </div>

        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-4">
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold">
                3
              </div>
              <div className="flex-1">
                <p className="font-medium">Confirme a instalação</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Toque em "Adicionar" no canto superior direito
                </p>
                <div className="mt-3 flex justify-center">
                  <div className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium">
                    Adicionar
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <p className="text-xs text-muted-foreground text-center mt-6">
        Após instalar, o app aparecerá na sua tela inicial como um ícone independente.
      </p>
    </div>
  );
}
