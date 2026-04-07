import { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle, X, AlertTriangle } from 'lucide-react';
import { useMenuImport } from '@/hooks/useMenuImport';
import { ScrollArea } from '@/components/ui/scroll-area';

interface ImportMenuDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ImportMenuDialog({ open, onOpenChange }: ImportMenuDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const { importFile, isImporting, result, reset } = useMenuImport();

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      setFile(selected);
      reset();
    }
  };

  const handleImport = async () => {
    if (!file) return;
    await importFile(file);
  };

  const handleClose = () => {
    if (!isImporting) {
      setFile(null);
      reset();
      onOpenChange(false);
    }
  };

  const stats = result?.stats;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Importar Cardápio via Planilha
          </DialogTitle>
          <DialogDescription>Selecione um arquivo .xlsx para importar categorias, produtos e complementos.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Warning */}
          <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg">
            <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
            <p className="text-xs text-amber-700 dark:text-amber-400">
              <strong>Atenção:</strong> A importação irá <strong>substituir completamente</strong> todo o cardápio atual (categorias, produtos, complementos). Os dados anteriores serão removidos.
            </p>
          </div>

          {/* File upload */}
          <div
            className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
            onClick={() => fileRef.current?.click()}
          >
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={handleFileSelect}
            />
            {file ? (
              <div className="flex items-center justify-center gap-2">
                <FileSpreadsheet className="h-5 w-5 text-primary" />
                <span className="font-medium">{file.name}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={(e) => { e.stopPropagation(); setFile(null); reset(); }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Clique para selecionar arquivo <strong>.xlsx</strong>
                </p>
                <p className="text-xs text-muted-foreground">
                  Formato: Tipo | Categoria/Complemento | Nome | Código interno | Preço
                </p>
              </div>
            )}
          </div>

          {/* Progress */}
          {isImporting && (
            <div className="space-y-3 animate-fade-in">
              <div className="flex items-center gap-3">
                <div className="relative h-5 w-5">
                  <div className="absolute inset-0 rounded-full border-2 border-primary/30" />
                  <div className="absolute inset-0 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                </div>
                <p className="text-sm font-medium text-foreground">Importando cardápio...</p>
              </div>
              <Progress className="h-2 animate-pulse" />
              <p className="text-xs text-muted-foreground animate-pulse">
                Removendo dados anteriores e importando nova planilha...
              </p>
            </div>
          )}

          {/* Results */}
          {stats && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                {result?.success ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-destructive" />
                )}
                <span className="font-medium">
                  {result?.success ? 'Importação concluída' : 'Importação com erros'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="flex justify-between p-2 bg-muted rounded">
                  <span>Categorias criadas</span>
                  <Badge variant="secondary">{stats.categories_created}</Badge>
                </div>
                <div className="flex justify-between p-2 bg-muted rounded">
                  <span>Produtos criados</span>
                  <Badge variant="secondary">{stats.products_created}</Badge>
                </div>
                <div className="flex justify-between p-2 bg-muted rounded">
                  <span>Grupos criados</span>
                  <Badge variant="secondary">{stats.groups_created}</Badge>
                </div>
                <div className="flex justify-between p-2 bg-muted rounded">
                  <span>Opções criadas</span>
                  <Badge variant="secondary">{stats.options_created}</Badge>
                </div>
                <div className="flex justify-between p-2 bg-muted rounded">
                  <span>Vínculos criados</span>
                  <Badge variant="secondary">{stats.links_created}</Badge>
                </div>
                <div className="flex justify-between p-2 bg-muted rounded">
                  <span>Total de linhas</span>
                  <Badge variant="secondary">{stats.total_rows}</Badge>
                </div>
              </div>

              {stats.errors.length > 0 && (
                <ScrollArea className="max-h-32">
                  <div className="space-y-1">
                    {stats.errors.map((err, i) => (
                      <p key={i} className="text-xs text-destructive">{err}</p>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={handleClose} disabled={isImporting}>
              {result ? 'Fechar' : 'Cancelar'}
            </Button>
            {!result && (
              <Button onClick={handleImport} disabled={!file || isImporting} variant="destructive">
                <Upload className="h-4 w-4 mr-2" />
                Substituir e Importar
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
