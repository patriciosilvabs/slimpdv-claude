import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

const BUCKET_NAME = 'product-images';

export function useProductImages() {
  const uploadImage = useMutation({
    mutationFn: async ({ file, folder = 'products' }: { file: File; folder?: string }) => {
      const fileExt = file.name.split('.').pop();
      const fileName = `${folder}/${crypto.randomUUID()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(fileName, file, { upsert: false });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from(BUCKET_NAME)
        .getPublicUrl(fileName);

      return data.publicUrl;
    },
    onError: (error) => {
      toast({ title: 'Erro ao fazer upload', description: error.message, variant: 'destructive' });
    }
  });

  const deleteImage = useMutation({
    mutationFn: async (url: string) => {
      // Extract file path from URL
      const urlParts = url.split(`/${BUCKET_NAME}/`);
      if (urlParts.length < 2) return;
      
      const filePath = urlParts[1];
      const { error } = await supabase.storage
        .from(BUCKET_NAME)
        .remove([filePath]);

      if (error) throw error;
    },
    onError: (error) => {
      toast({ title: 'Erro ao remover imagem', description: error.message, variant: 'destructive' });
    }
  });

  return { uploadImage, deleteImage };
}
