import { Zap, WifiOff, Bell, Smartphone } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

const benefits = [
  {
    icon: Zap,
    title: "Acesso Rápido",
    description: "Abra direto da tela inicial, sem precisar do navegador"
  },
  {
    icon: WifiOff,
    title: "Funciona Offline",
    description: "Registre pedidos mesmo sem conexão com a internet"
  },
  {
    icon: Bell,
    title: "Notificações",
    description: "Receba alertas de novos pedidos em tempo real"
  },
  {
    icon: Smartphone,
    title: "Experiência Nativa",
    description: "Interface otimizada para toque em tablets e celulares"
  }
];

export function InstallBenefits() {
  return (
    <div className="grid grid-cols-2 gap-3">
      {benefits.map((benefit) => (
        <Card key={benefit.title} className="border-muted">
          <CardContent className="p-3">
            <div className="flex flex-col items-center text-center gap-2">
              <div className="p-2 rounded-lg bg-primary/10">
                <benefit.icon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-medium text-sm">{benefit.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {benefit.description}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
