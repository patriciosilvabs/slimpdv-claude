import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Share2, Image, FileText, Link, ArrowRight, Home } from "lucide-react";
import { toast } from "sonner";

interface SharedData {
  title?: string;
  text?: string;
  url?: string;
  files?: File[];
}

const ShareReceiver = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [sharedData, setSharedData] = useState<SharedData>({});
  const [isProcessing, setIsProcessing] = useState(true);

  useEffect(() => {
    const processSharedData = async () => {
      const title = searchParams.get('title') || '';
      const text = searchParams.get('text') || '';
      const url = searchParams.get('url') || '';
      
      // For POST requests with files, we need to handle FormData
      // This happens when the PWA receives shared files
      const data: SharedData = { title, text, url };
      
      // Check if there's any shared content
      if (title || text || url) {
        setSharedData(data);
        toast.success("Conteúdo recebido com sucesso!");
      }
      
      setIsProcessing(false);
    };

    processSharedData();
  }, [searchParams]);

  const handleNavigateToMenu = () => {
    // If there's image content, navigate to menu for product creation
    navigate('/menu', { state: { sharedData } });
  };

  const handleNavigateToOrders = () => {
    // If there's text content, it might be order notes
    navigate('/counter', { state: { sharedData } });
  };

  const hasContent = sharedData.title || sharedData.text || sharedData.url;

  if (isProcessing) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
            <Share2 className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold">Conteúdo Compartilhado</h1>
          <p className="text-muted-foreground">
            {hasContent 
              ? "Escolha para onde deseja enviar este conteúdo"
              : "Nenhum conteúdo foi recebido"}
          </p>
        </div>

        {hasContent && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Dados Recebidos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {sharedData.title && (
                <div className="flex items-start gap-2">
                  <FileText className="h-4 w-4 mt-1 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Título</p>
                    <p className="text-sm text-muted-foreground">{sharedData.title}</p>
                  </div>
                </div>
              )}
              {sharedData.text && (
                <div className="flex items-start gap-2">
                  <FileText className="h-4 w-4 mt-1 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Texto</p>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">{sharedData.text}</p>
                  </div>
                </div>
              )}
              {sharedData.url && (
                <div className="flex items-start gap-2">
                  <Link className="h-4 w-4 mt-1 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">URL</p>
                    <a 
                      href={sharedData.url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-sm text-primary hover:underline break-all"
                    >
                      {sharedData.url}
                    </a>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <div className="grid gap-4">
          <Card className="cursor-pointer hover:bg-accent/50 transition-colors" onClick={handleNavigateToMenu}>
            <CardContent className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-500/10">
                  <Image className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <CardTitle className="text-base">Cardápio</CardTitle>
                  <CardDescription>Usar para cadastrar produto</CardDescription>
                </div>
              </div>
              <ArrowRight className="h-5 w-5 text-muted-foreground" />
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:bg-accent/50 transition-colors" onClick={handleNavigateToOrders}>
            <CardContent className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-orange-500/10">
                  <FileText className="h-5 w-5 text-orange-500" />
                </div>
                <div>
                  <CardTitle className="text-base">Balcão</CardTitle>
                  <CardDescription>Usar como observação de pedido</CardDescription>
                </div>
              </div>
              <ArrowRight className="h-5 w-5 text-muted-foreground" />
            </CardContent>
          </Card>
        </div>

        <div className="pt-4">
          <Button 
            variant="outline" 
            className="w-full" 
            onClick={() => navigate('/dashboard')}
          >
            <Home className="h-4 w-4 mr-2" />
            Ir para o Dashboard
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ShareReceiver;
