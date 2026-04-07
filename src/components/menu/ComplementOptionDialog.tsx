import * as React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CurrencyInput } from '@/components/ui/currency-input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ImageUpload } from '@/components/ImageUpload';
import { Package, PackageCheck } from 'lucide-react';
import { ComplementOption } from '@/hooks/useComplementOptions';
import { ComplementGroup } from '@/hooks/useComplementGroups';
import { ComplementOptionIngredientSection } from './ComplementOptionIngredientSection';
import { Badge } from '@/components/ui/badge';

export interface LinkedGroupWithProducts {
  id: string;
  name: string;
  products: Array<{ id: string; name: string; category_name?: string }>;
}

interface ComplementOptionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  option: Partial<ComplementOption> | null;
  linkedGroups: LinkedGroupWithProducts[];
  onSave: (option: Partial<ComplementOption>) => void;
  isEditing: boolean;
}

export function ComplementOptionDialog({
  open,
  onOpenChange,
  option,
  linkedGroups,
  onSave,
  isEditing
}: ComplementOptionDialogProps) {
  const [form, setForm] = React.useState<Partial<ComplementOption>>({
    name: '',
    description: '',
    image_url: null,
    price: 0,
    cost_price: 0,
    internal_code: '',
    pdv_code: '',
    external_code: '',
    auto_calculate_cost: false,
    enable_stock_control: false,
    is_active: true,
    check_on_dispatch: false,
  });

  React.useEffect(() => {
    if (option) {
      setForm({
        name: option.name || '',
        description: option.description || '',
        image_url: option.image_url || null,
        price: option.price ?? 0,
        cost_price: option.cost_price ?? 0,
        internal_code: option.internal_code || '',
        pdv_code: option.pdv_code || '',
        external_code: option.external_code || '',
        auto_calculate_cost: option.auto_calculate_cost ?? false,
        enable_stock_control: option.enable_stock_control ?? false,
        is_active: option.is_active ?? true,
        check_on_dispatch: option.check_on_dispatch ?? false,
      });
    } else {
      setForm({
        name: '',
        description: '',
        image_url: null,
        price: 0,
        cost_price: 0,
        internal_code: '',
        pdv_code: '',
        external_code: '',
        auto_calculate_cost: false,
        enable_stock_control: false,
        is_active: true,
        check_on_dispatch: false,
      });
    }
  }, [option, open]);

  const handleSave = () => {
    if (!form.name?.trim()) return;
    onSave(form);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar opção' : 'Nova Opção'}</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="general" className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="general">Dados Gerais</TabsTrigger>
            <TabsTrigger value="ingredients">Ficha Técnica</TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="flex-1 overflow-hidden">
            <div className="flex flex-1 gap-6 overflow-hidden h-full">
              {/* Left Column - Image Upload */}
              <div className="w-40 shrink-0">
                <div className="aspect-square border-2 border-dashed rounded-lg flex items-center justify-center bg-muted/30">
                  <ImageUpload
                    value={form.image_url || undefined}
                    onChange={(url) => setForm({ ...form, image_url: url || null })}
                    folder="complement-options"
                  />
                </div>
              </div>

              {/* Center Column - Form Fields */}
              <div className="flex-1 overflow-y-auto space-y-4">
                {/* Nome da Opção */}
                <div className="space-y-2">
                  <Label>Nome da opção *</Label>
                  <Input
                    value={form.name || ''}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="Ex: Portuguesa (Grande)"
                  />
                </div>

                {/* Código Interno, Código PDV, Preço de custo */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Código interno</Label>
                    <Input
                      value={form.internal_code || ''}
                      onChange={(e) => setForm({ ...form, internal_code: e.target.value })}
                      placeholder="2375136"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Código PDV</Label>
                    <Input
                      value={form.pdv_code || ''}
                      onChange={(e) => setForm({ ...form, pdv_code: e.target.value })}
                      placeholder=""
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Código de integração</Label>
                    <Input
                      value={form.external_code || ''}
                      onChange={(e) => setForm({ ...form, external_code: e.target.value })}
                      placeholder="ID do item na plataforma externa"
                    />
                    <p className="text-[10px] text-muted-foreground">
                      Usado para vincular automaticamente ao CardápioWeb
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Preço de custo</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">R$</span>
                      <CurrencyInput
                        value={form.cost_price ?? 0}
                        onChange={(val) => setForm({ ...form, cost_price: val })}
                        className="pl-10"
                        placeholder="0,00"
                      />
                    </div>
                  </div>
                </div>

                {/* Descrição */}
                <div className="space-y-2">
                  <Textarea
                    value={form.description || ''}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    placeholder="Descrição do produto"
                    rows={4}
                  />
                  <p className="text-xs text-muted-foreground">
                    Estilize a descrição com <strong>*negrito*</strong> (*texto*), <em>itálico</em> (_texto_) ou <del>riscado</del> (~texto~).
                  </p>
                </div>

                {/* Toggle - Ativar controle de estoque */}
                <div className="flex items-center gap-3">
                  <Switch
                    checked={form.enable_stock_control ?? false}
                    onCheckedChange={(checked) => setForm({ ...form, enable_stock_control: checked })}
                  />
                  <Label className="font-normal">Ativar controle de estoque</Label>
                </div>

                {/* Toggle - Conferir no despacho */}
                <div className="flex items-center gap-3 p-3 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30">
                  <Switch
                    checked={form.check_on_dispatch ?? false}
                    onCheckedChange={(checked) => setForm({ ...form, check_on_dispatch: checked })}
                  />
                  <div>
                    <Label className="font-medium flex items-center gap-1.5 cursor-pointer">
                      <PackageCheck className="h-4 w-4 text-amber-600" />
                      Conferir no despacho
                    </Label>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Exige confirmação do funcionário ao despachar pedidos com este item
                    </p>
                  </div>
                </div>
              </div>

              {/* Right Sidebar - Linked Groups */}
              <div className="w-48 shrink-0 border-l pl-4 flex flex-col">
                <Label className="text-xs text-muted-foreground mb-2">Grupos vinculados</Label>
                <ScrollArea className="flex-1">
                  {linkedGroups.length > 0 ? (
                    <div className="space-y-3">
                      {linkedGroups.map(group => (
                        <div key={group.id} className="p-2 text-sm border rounded bg-muted/50">
                          <div className="font-medium">{group.name}</div>
                          {group.products.length > 0 && (
                            <div className="mt-1 space-y-1">
                              {group.products.map(p => (
                                <div key={p.id} className="text-xs text-muted-foreground flex items-center gap-1">
                                  <span className="truncate">↳ {p.name}</span>
                                  {p.category_name && (
                                    <Badge variant="secondary" className="text-[9px] px-1 py-0 shrink-0">
                                      {p.category_name}
                                    </Badge>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-center py-8">
                      <Package className="h-16 w-16 text-muted-foreground/30 mb-3" />
                      <p className="text-sm text-muted-foreground">
                        Nenhum complemento usa esta opção
                      </p>
                    </div>
                  )}
                </ScrollArea>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="ingredients" className="flex-1 overflow-auto">
            <div className="p-4 border rounded-lg bg-muted/20">
              <ComplementOptionIngredientSection 
                optionId={option?.id} 
                isEditing={isEditing} 
              />
            </div>
          </TabsContent>
        </Tabs>

        {/* Footer */}
        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            CANCELAR
          </Button>
          <Button onClick={handleSave} disabled={!form.name?.trim()}>
            SALVAR
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
