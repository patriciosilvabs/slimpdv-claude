import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useTenant } from '@/hooks/useTenant';

export type SoundType = 'newOrder' | 'newReservation' | 'orderReady' | 'kdsNewOrder' | 'maxWaitAlert' | 'tableWaitAlert' | 'idleTableAlert' | 'orderCancelled' | 'bottleneckAlert' | 'stationChange' | 'itemDelayAlert';

export interface CustomSound {
  id: string;
  user_id: string;
  name: string;
  sound_type: SoundType;
  file_path: string;
  created_at: string;
}

// Predefined sounds with base64 data
export const PREDEFINED_SOUNDS = {
  beepClassic: {
    id: 'beep-classic',
    name: 'Beep Clássico',
    data: 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1NOU1JYXWcuZZyUDdDWIWz5OPTtpBjPkFeiLHf+/bpybV1UVR4q9Xp7+3btYdhW3ek0unp3sq7lW9xe6vT4+Pkz7mXgYGCqc7c3trNsJWLgoKfrdbj3NnLrJKGgoWip8zW2NLMqJGEhIqkosDJysW/oYmGh5GjsL29ubGdiIaFkZ+usLKtnJOFhYaQnamusq2kkIKFhpCdqK6tqJyOgYaGk52mqKijnI2CiIqYoKekoZaKhIiLmJ6joZ2VjImMkZebnpyWjouOkpibm5mUj4+QlZmbmpaPkJGVl5qZl5OQk5aYmpqXk5KUl5mampeTlJaYmZqZlpWWmJmampeTlZaYmZqZl5WXmJmampeVl5iZmpmXlpeYmZmZl5aXmJmZmZeXl5iZmZmXl5eYmZmZl5eXmJmZmZeXl5iZmZmXl5eYmZmZl5eXmJmZmZeXl5iZmZmXl5eYmZmZl5eXmJmZmZeXl5iZmZmXl5eYmZmZl5eXmJmZmZeXl5iZmQ=='
  },
  bell: {
    id: 'bell',
    name: 'Sino de Notificação',
    data: 'data:audio/wav;base64,UklGRjIHAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQ4HAACAfX+Dh4yMioeDfnp2dXd7gYiOkpORjIZ/eHNxcnd+houQk5OQi4R9dnBucHZ9hYySlpaSjYZ+dnBsbXJ6goyUmJeTjoV9dW5ram91fYeQmJuZlI2Dd21nZWlweYOOl5ybl5CIfXRrZWNncXuGkJmdm5iRh3xya2VjZ3F7h5GanJuYkYd8cmtlY2dxe4eRmpybmJGHfHJrZWNncXuHkZqcm5iRh3xya2VjZ3F7h5GanJuYkYd8cmtlY2dxe4eRmpybmJGHfHJrZWNncXuHkZqcm5iRh3xya2VjZ3F7h5GanJuYkYd8cmtlY2dxe4eRmpybmJGHfHJrZWNncXuHkZqcm5iRh3xya2VjZ3F7h5GanJuYkYd8cmtlY2dxe4eRmpybmJGHfA=='
  },
  dingDong: {
    id: 'ding-dong',
    name: 'Ding Dong',
    data: 'data:audio/wav;base64,UklGRqoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YYYGAACAgICAgICBgYKDhIWGh4iJiouMjY6PkJGSk5SVlpeYmZqbnJ2en6ChoqOkpaanqKmqq6ytrq+wsbKztLW2t7i5uru8vb6/wMHCw8TFxsfIycrLzM3Oz9DR0tPU1dbX2Nna29zd3t/g4eLj5OXm5+jp6uvs7e7v8PHy8/T19vf4+fr7/P3+/v7+/v79/fz7+vn49/b19PPy8fDv7u3s6+rp6Ofm5eTj4uHg397d3Nva2djX1tXU09LR0M/OzczLysnIx8bFxMPCwcC/vr28u7q5uLe2tbSzsrGwr66trKuqqainpqWko6KhoJ+enZybmpmYl5aVlJOSkZCPjo2Mi4qJiIeGhYSDgoGAgICAgICAgICAgoGCg4SFhoaHiImKi4yMjY6PkJGRkpOUlJWWl5eYmZqam5ydnZ6fn6ChoaKjo6SlpqanqKipqqusrK2ur6+wsbGys7O0tba2t7i4ubq6u7y8vb6+v8DBwcLDw8TFxcbHx8jJycrKy8zMzc7Oz9DQ0dLS09TU1dbW19fY2dnZ2trb29zc3d3e3t/f4ODh4eLi4+Pk5OXl5ubm5+fo6Onp6err6+zs7e3t7u7v7/Dw8PHx8vLy8/P09PT19fb29/f4+Pj5+fn6+vr7+/v8/Pz9/f39/v7+/v7+/v7+/v7+/v7+/f39/fz8/Pv7+/r6+vn5+Pj49/f29vX19PTz8/Ly8fHw8O/v7u7t7ezs6+vq6unp6Ofn5ubm5eTk4+Pi4uHh4ODf397e3dzc29va2tnZ2NjX19bW1dXU1NPT0tLR0dDQz8/OzszMy8vKysnJyMjHxsbFxcTEw8PCwsHBwMC/v76+vb28vLu7urq5ubm4uLe3tra1tbS0s7OysrGxsLCvr66urq2trKysq6uqqampqKinp6ampaWkpKOjo6KioaGgoKCfn56enZ2cm5uampmZmJiXl5aWlZWUlJSTk5KSkZGQkI+Pjo6NjYyMi4uKiomJiIiHh4aGhYWEhIODgoKBgYCAgA=='
  },
  urgentAlert: {
    id: 'urgent-alert',
    name: 'Alerta Urgente',
    data: 'data:audio/wav;base64,UklGRjIGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQ4GAACAgH98eXZ0cnFwcHBxc3V4e3+Dh4yQlJeZm5ydn56fn56dnJuZl5SQi4eAfHl2c3FvcG9wb3Fzd3p+goaLj5OXmpydn5+fn56dnJqYlZKPioaCfnp3dHJwb29vb3Fzd3p+goaKjpKWmZudnp+fn56dnJqYlZKPioaCfnp3dHJwb29vb3Fzd3p+goaKjpKWmZudnp+fn56dnJqYlZKPioaCfnp3dHJwb29vb3Fzd3p+goaKjpKWmZudnp+fn56dnJqYlZKPioaCfnp3dHJwb29vb3Fzd3p+goaKjpKWmZudnp+fn56dnJqYlZKPioaCfnp3dHJwb29vb3Fzd3p+goaKjpKWmZudnp+fn56dnJqYlZKPioaCfnp3dHJwb29vb3Fzd3p+goaKjpKWmZudnp+fn56dnJqYlZKPioaCfnp3dHJwb29vb3Fzd3p+goaKjpKWmZudnp+fn56dnJqYlZKPioaCfnp3dHJwb29vb3Fzd3p+goaKjpKWmZudnp+fn56dnJqYlZKPioaCfnp3dHJwb29vb3Fzd3p+goaKjpKWmZudnp+fn56dnJqYlZKPioaCfnp3dHJwb29vb3Fzd3p+goaKjpKWmZudnp+fn56dnJqYlZKPioaCfnp3dHJwb29vcA=='
  },
  cashRegister: {
    id: 'cash-register',
    name: 'Caixa Registradora',
    data: 'data:audio/wav;base64,UklGRpIGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YW4GAACAgICAgH9+fXx7enl4d3Z1dHNycXBwcHBwcXJzdHV2d3h5ent8fX5/gIGCg4SFhoeIiYqLjI2Oj5CRkpOUlZaXmJmam5ydnp+goaKjpKWmp6ipqqusra6vsLGys7S1tre4ubq7vL2+v8DBwsPExcbHyMnKy8zNzs/Q0dLT1NXW19jZ2tvc3d7f4OHi4+Tl5ufo6err7O3u7/Dx8vP09fb3+Pn6+/z9/v7+/v79/fz7+vn49/b19PPy8fDv7u3s6+rp6Ofm5eTj4uHg397d3Nva2djX1tXU09LR0M/OzczLysnIx8bFxMPCwcC/vr28u7q5uLe2tbSzsrGwr66trKuqqainpqWko6KhoJ+enZybmpmYl5aVlJOSkZCPjo2Mi4qJiIeGhYSDgoGAgH9+fXx7enl4d3Z1dHNycXBwcHBwcXJzdHV2d3h5ent8fX5/gIGCg4SFhoeIiYqLjI2Oj5CRkpOUlZaXmJmam5ydnp+goaKjpKWmp6ipqqusra6vsLGys7S1tre4ubq7vL2+v8DBwsPExcbHyMnKy8zNzs/Q0dLT1NXW19jZ2tvc3d7f4OHi4+Tl5ufo6err7O3u7/Dx8vP09fb3+Pn6+/z9/v7+/v79/fz7+vn49/b19PPy8fDv7u3s6+rp6Ofm5eTj4uHg397d3Nva2djX1tXU09LR0M/OzczLysnIx8bFxMPCwcC/vr28u7q5uLe2tbSzsrGwr66trKuqqainpqWko6KhoJ+enZybmpmYl5aVlJOSkZCPjo2Mi4qJiIeGhYSDgoGAgA=='
  }
};

export function useCustomSounds() {
  const queryClient = useQueryClient();
  const { tenantId } = useTenant();

  const { data: customSounds = [], isLoading } = useQuery({
    queryKey: ['custom-sounds', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];

      const { data, error } = await supabase
        .from('custom_sounds')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as CustomSound[];
    },
    enabled: !!tenantId
  });

  const uploadSound = useMutation({
    throwOnError: false,
    mutationFn: async ({
      file,
      name,
      soundType
    }: {
      file: File;
      name: string;
      soundType: SoundType
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${soundType}_${Date.now()}.${fileExt}`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from('notification-sounds')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('notification-sounds')
        .getPublicUrl(fileName);

      // Save to database
      const { data, error } = await supabase
        .from('custom_sounds')
        .insert({
          user_id: user.id,
          name,
          sound_type: soundType,
          file_path: urlData.publicUrl,
          tenant_id: tenantId
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custom-sounds'] });
      toast.success('Som personalizado salvo!');
    },
    onError: (error) => {
      toast.error('Erro ao salvar som: ' + error.message);
    }
  });

  const deleteSound = useMutation({
    throwOnError: false,
    mutationFn: async (soundId: string) => {
      const sound = customSounds.find(s => s.id === soundId);
      if (!sound) throw new Error('Som não encontrado');

      // Delete from storage (support both legacy Supabase and local /api/sounds/file/ paths)
      const filePath = sound.file_path.split('/notification-sounds/')[1]
        || sound.file_path.split('/api/sounds/file/')[1];
      if (filePath) {
        await supabase.storage.from('notification-sounds').remove([filePath]);
      }

      // Delete from database
      const { error } = await supabase
        .from('custom_sounds')
        .delete()
        .eq('id', soundId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custom-sounds'] });
      toast.success('Som excluído!');
    },
    onError: (error) => {
      toast.error('Erro ao excluir som: ' + error.message);
    }
  });

  const getSoundsForType = (type: SoundType) => {
    return customSounds.filter(s => s.sound_type === type);
  };

  return {
    customSounds,
    isLoading,
    uploadSound,
    deleteSound,
    getSoundsForType,
    predefinedSounds: PREDEFINED_SOUNDS
  };
}
