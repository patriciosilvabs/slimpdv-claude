/**
 * Cache em memória para logos (URL -> base64)
 * Evita fetch a cada impressão
 */
const logoCache = new Map<string, { base64: string; timestamp: number }>();
const CACHE_TTL = 1000 * 60 * 30; // 30 minutos de validade

/**
 * Limpa todo o cache de logos
 */
export function clearLogoCache(): void {
  logoCache.clear();
}

/**
 * Invalida uma URL específica do cache
 */
export function invalidateLogoCache(url: string): void {
  logoCache.delete(url);
}

/**
 * Extrai apenas o base64 puro de um data URL (remove o prefixo data:image/...;base64,)
 */
export function extractBase64Data(dataUrl: string): string {
  const base64Marker = ';base64,';
  const index = dataUrl.indexOf(base64Marker);
  return index !== -1 ? dataUrl.slice(index + base64Marker.length) : dataUrl;
}

/**
 * Redimensiona uma imagem para largura máxima especificada
 * Retorna o dataURL redimensionado
 */
export async function resizeImage(dataUrl: string, maxWidth: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      // Se a imagem já é menor que maxWidth, retorna original
      if (img.width <= maxWidth) {
        resolve(dataUrl);
        return;
      }
      
      const canvas = document.createElement('canvas');
      const scale = maxWidth / img.width;
      canvas.width = maxWidth;
      canvas.height = img.height * scale;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }
      
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => reject(new Error('Failed to load image for resize'));
    img.src = dataUrl;
  });
}

/**
 * Converte imagem para escala de cinza
 */
export async function convertToGrayscale(dataUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }
      
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      
      for (let i = 0; i < data.length; i += 4) {
        // Luminosity method for better grayscale conversion
        const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
        data[i] = gray;     // Red
        data[i + 1] = gray; // Green
        data[i + 2] = gray; // Blue
        // Alpha channel remains unchanged
      }
      
      ctx.putImageData(imageData, 0, 0);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => reject(new Error('Failed to load image for grayscale conversion'));
    img.src = dataUrl;
  });
}

/**
 * Converte imagem para preto e branco usando Floyd-Steinberg dithering
 * Melhor qualidade para impressoras térmicas
 */
export async function convertToDithered(dataUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }
      
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      const width = canvas.width;
      const height = canvas.height;
      
      // Convert to grayscale array for dithering
      const gray: number[] = [];
      for (let i = 0; i < data.length; i += 4) {
        gray.push(data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114);
      }
      
      // Floyd-Steinberg dithering
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const idx = y * width + x;
          const oldPixel = gray[idx];
          const newPixel = oldPixel < 128 ? 0 : 255;
          gray[idx] = newPixel;
          const error = oldPixel - newPixel;
          
          // Distribute error to neighboring pixels
          if (x + 1 < width) {
            gray[idx + 1] += error * 7 / 16;
          }
          if (y + 1 < height) {
            if (x > 0) {
              gray[(y + 1) * width + (x - 1)] += error * 3 / 16;
            }
            gray[(y + 1) * width + x] += error * 5 / 16;
            if (x + 1 < width) {
              gray[(y + 1) * width + (x + 1)] += error * 1 / 16;
            }
          }
        }
      }
      
      // Apply dithered values back to image data
      for (let i = 0; i < gray.length; i++) {
        const val = Math.max(0, Math.min(255, gray[i]));
        const dataIdx = i * 4;
        data[dataIdx] = val;     // Red
        data[dataIdx + 1] = val; // Green
        data[dataIdx + 2] = val; // Blue
        // Alpha remains unchanged
      }
      
      ctx.putImageData(imageData, 0, 0);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => reject(new Error('Failed to load image for dithering'));
    img.src = dataUrl;
  });
}

/**
 * Fetches an image from URL and converts it to base64 data URI
 * Used for printing images via ESC/POS on thermal printers
 */
export async function imageUrlToBase64(url: string): Promise<string | null> {
  console.log('🔄 [imageUrlToBase64] Iniciando fetch da imagem:', url.substring(0, 80) + '...');
  
  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.error('❌ [imageUrlToBase64] Falha no fetch:', {
        status: response.status,
        statusText: response.statusText,
        url: url.substring(0, 80) + '...'
      });
      console.error('💡 Dica: Verifique se a URL está acessível e se não há problemas de CORS');
      return null;
    }
    
    const blob = await response.blob();
    console.log('✅ [imageUrlToBase64] Imagem baixada, tamanho:', blob.size, 'bytes, tipo:', blob.type);
    
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        console.log('✅ [imageUrlToBase64] Conversão para base64 concluída, tamanho:', result.length);
        resolve(result);
      };
      reader.onerror = () => {
        console.error('❌ [imageUrlToBase64] FileReader error:', reader.error);
        reject(reader.error);
      };
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error('❌ [imageUrlToBase64] Erro ao converter imagem:', error);
    console.error('💡 Dicas para resolver:');
    console.error('   - Verifique se a URL está correta e acessível');
    console.error('   - Se a imagem está em outro domínio, pode haver bloqueio por CORS');
    console.error('   - Tente usar uma imagem hospedada no mesmo domínio ou em CDN com CORS habilitado');
    return null;
  }
}

/**
 * Versão com cache do imageUrlToBase64
 * Armazena em memória por 30 minutos para evitar fetch repetido
 */
export async function imageUrlToBase64Cached(url: string): Promise<string | null> {
  // Verificar cache válido
  const cached = logoCache.get(url);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    console.log('Logo loaded from cache');
    return cached.base64;
  }
  
  // Cache miss ou expirado - buscar da rede
  const base64 = await imageUrlToBase64(url);
  
  if (base64) {
    // Armazenar no cache
    logoCache.set(url, { base64, timestamp: Date.now() });
    console.log('Logo fetched and cached');
  }
  
  return base64;
}
