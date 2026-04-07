import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Copy, Shield, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { 
  useUserPermissionsById, 
  useUserPermissionMutations,
  PERMISSION_GROUPS,
  PermissionCode 
} from '@/hooks/useUserPermissions';
import { UserWithRoles } from '@/hooks/useUserRole';

interface UserPermissionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: UserWithRoles | null;
  allUsers: UserWithRoles[];
}

export function UserPermissionsDialog({ open, onOpenChange, user, allUsers }: UserPermissionsDialogProps) {
  const { data: userPermissions, isLoading } = useUserPermissionsById(user?.id || null);
  const { setMultiplePermissions, copyPermissions } = useUserPermissionMutations();
  
  const [localPermissions, setLocalPermissions] = useState<Record<PermissionCode, boolean>>({} as Record<PermissionCode, boolean>);
  const [copyFromUserId, setCopyFromUserId] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  const [isCopying, setIsCopying] = useState(false);

  // Initialize local permissions when user permissions load
  useEffect(() => {
    if (!open) return;
    
    const permissions: Record<PermissionCode, boolean> = {} as Record<PermissionCode, boolean>;
    
    // Initialize all to false
    Object.values(PERMISSION_GROUPS).forEach(group => {
      group.permissions.forEach(p => {
        permissions[p.code] = false;
      });
    });
    
    // Set granted ones to true
    userPermissions?.forEach(p => {
      if (p.granted) {
        permissions[p.permission] = true;
      }
    });
    
    setLocalPermissions(permissions);
  }, [userPermissions, open]);

  const grantedCount = useMemo(() => 
    Object.values(localPermissions).filter(Boolean).length,
    [localPermissions]
  );

  const handleTogglePermission = (code: PermissionCode) => {
    setLocalPermissions(prev => ({
      ...prev,
      [code]: !prev[code],
    }));
  };

  const handleToggleGroup = (groupKey: string, value: boolean) => {
    const group = PERMISSION_GROUPS[groupKey as keyof typeof PERMISSION_GROUPS];
    setLocalPermissions(prev => {
      const updated = { ...prev };
      group.permissions.forEach(p => {
        updated[p.code] = value;
      });
      return updated;
    });
  };

  const isGroupFullyEnabled = (groupKey: string): boolean => {
    const group = PERMISSION_GROUPS[groupKey as keyof typeof PERMISSION_GROUPS];
    return group.permissions.every(p => localPermissions[p.code]);
  };

  const isGroupPartiallyEnabled = (groupKey: string): boolean => {
    const group = PERMISSION_GROUPS[groupKey as keyof typeof PERMISSION_GROUPS];
    const enabledCount = group.permissions.filter(p => localPermissions[p.code]).length;
    return enabledCount > 0 && enabledCount < group.permissions.length;
  };

  const handleCopyPermissions = async () => {
    if (!copyFromUserId || !user) return;
    
    setIsCopying(true);
    try {
      await copyPermissions.mutateAsync({
        fromUserId: copyFromUserId,
        toUserId: user.id,
      });
      toast.success('Permissões copiadas com sucesso!');
      onOpenChange(false);
    } catch (error: any) {
      toast.error('Erro ao copiar permissões: ' + error.message);
    } finally {
      setIsCopying(false);
    }
  };

  const handleSave = async () => {
    if (!user) return;
    
    setIsSaving(true);
    try {
      const permissions = Object.entries(localPermissions).map(([code, granted]) => ({
        permission: code as PermissionCode,
        granted,
      }));
      
      await setMultiplePermissions.mutateAsync({
        userId: user.id,
        permissions,
      });
      
      toast.success('Permissões salvas com sucesso!');
      onOpenChange(false);
    } catch (error: any) {
      toast.error('Erro ao salvar permissões: ' + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const otherUsers = allUsers.filter(u => u.id !== user?.id);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Permissões - {user?.name}
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* Header with count and copy */}
            <div className="flex items-center justify-between py-2">
              <Badge variant="secondary">
                {grantedCount} permissão(ões) concedida(s)
              </Badge>
              
              <div className="flex items-center gap-2">
                <Select value={copyFromUserId} onValueChange={setCopyFromUserId}>
                  <SelectTrigger className="w-[140px] h-8 text-xs">
                    <SelectValue placeholder="Copiar de..." />
                  </SelectTrigger>
                  <SelectContent>
                    {otherUsers.map(u => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={handleCopyPermissions}
                  disabled={!copyFromUserId || isCopying}
                >
                  {isCopying ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Copy className="h-4 w-4 mr-1" />
                      Copiar
                    </>
                  )}
                </Button>
              </div>
            </div>

            <Separator />

            {/* Permissions list */}
            <ScrollArea className="flex-1 -mx-6 px-6">
              <div className="space-y-4 py-2">
                {Object.entries(PERMISSION_GROUPS).map(([groupKey, group]) => (
                  <div key={groupKey} className="space-y-2">
                    {/* Group header */}
                    <div className="flex items-center justify-between py-1">
                      <Label className="font-semibold text-sm">{group.label}</Label>
                      <Switch
                        checked={isGroupFullyEnabled(groupKey)}
                        onCheckedChange={(checked) => handleToggleGroup(groupKey, checked)}
                        className={isGroupPartiallyEnabled(groupKey) ? 'data-[state=unchecked]:bg-primary/50' : ''}
                      />
                    </div>
                    
                    {/* Individual permissions */}
                    <div className="pl-4 space-y-2">
                      {group.permissions.map(permission => (
                        <div 
                          key={permission.code} 
                          className="flex items-center justify-between py-1"
                        >
                          <Label className="text-sm text-muted-foreground font-normal">
                            {permission.label}
                          </Label>
                          <Switch
                            checked={localPermissions[permission.code] || false}
                            onCheckedChange={() => handleTogglePermission(permission.code)}
                          />
                        </div>
                      ))}
                    </div>
                    
                    <Separator className="mt-3" />
                  </div>
                ))}
              </div>
            </ScrollArea>

            <DialogFooter className="pt-4">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  'Salvar'
                )}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
