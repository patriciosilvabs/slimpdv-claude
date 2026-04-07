/**
 * Converts a base64 image (data URL) into ESC/POS raster print commands.
 * The output is a raw string that can be concatenated with other ESC/POS data.
 */

const ESC = '\x1B';
const GS = '\x1D';

/**
 * Load an image from a data URL and return pixel data via canvas
 */
function loadImageData(dataUrl: string): Promise<{ width: number; height: number; data: Uint8ClampedArray }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('Canvas context failed')); return; }
      // White background for transparency
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      resolve({ width: canvas.width, height: canvas.height, data: imageData.data });
    };
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = dataUrl;
  });
}

/**
 * Convert RGBA pixel data to 1-bit monochrome (threshold-based).
 * Returns a 2D array of booleans: true = black dot.
 */
function toMonochrome(data: Uint8ClampedArray, width: number, height: number): boolean[][] {
  const result: boolean[][] = [];
  for (let y = 0; y < height; y++) {
    const row: boolean[] = [];
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
      row.push(gray < 128); // true = black
    }
    result.push(row);
  }
  return result;
}

/**
 * Build ESC/POS bit-image commands (ESC * mode).
 * Uses column mode (mode 33 = double density 24-dot).
 * Processes 24 rows at a time (3 bytes per column).
 */
function buildBitImageCommands(mono: boolean[][], width: number, height: number): string {
  let result = '';
  // Set line spacing to 24 dots (3 bytes) for seamless vertical tiling
  result += ESC + '3' + String.fromCharCode(24);

  for (let bandStart = 0; bandStart < height; bandStart += 24) {
    // ESC * m nL nH — select bit-image mode
    // m = 33 (double-density, 24-dot)
    const nL = width & 0xFF;
    const nH = (width >> 8) & 0xFF;
    result += ESC + '*' + String.fromCharCode(33) + String.fromCharCode(nL) + String.fromCharCode(nH);

    for (let x = 0; x < width; x++) {
      // 3 bytes per column (24 dots)
      for (let byteIdx = 0; byteIdx < 3; byteIdx++) {
        let byte = 0;
        for (let bit = 0; bit < 8; bit++) {
          const y = bandStart + byteIdx * 8 + bit;
          if (y < height && mono[y][x]) {
            byte |= (0x80 >> bit);
          }
        }
        result += String.fromCharCode(byte);
      }
    }
    result += '\x0A'; // LF after each band
  }

  // Restore default line spacing
  result += ESC + '2';
  return result;
}

/**
 * Convert a data URL image to ESC/POS raw raster string.
 * Suitable for direct concatenation with other ESC/POS text commands.
 * 
 * @param dataUrl - Full data URL (data:image/png;base64,...) or pure base64
 * @param maxWidth - Maximum pixel width for the printer (e.g. 384 for 58mm, 576 for 80mm)
 * @returns Raw string with ESC/POS image commands, or null on failure
 */
export async function imageToEscPosRaster(dataUrl: string, maxWidth: number = 384): Promise<string | null> {
  try {
    // Ensure it's a proper data URL
    let src = dataUrl;
    if (!src.startsWith('data:')) {
      src = 'data:image/png;base64,' + src;
    }

    const { width, height, data } = await loadImageData(src);

    // Resize if needed (using canvas)
    let finalWidth = width;
    let finalHeight = height;
    let finalData = data;

    if (width > maxWidth) {
      const scale = maxWidth / width;
      finalWidth = maxWidth;
      finalHeight = Math.round(height * scale);

      const canvas = document.createElement('canvas');
      canvas.width = finalWidth;
      canvas.height = finalHeight;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, finalWidth, finalHeight);

      // Re-draw scaled
      const tmpImg = new Image();
      await new Promise<void>((resolve, reject) => {
        tmpImg.onload = () => {
          ctx.drawImage(tmpImg, 0, 0, finalWidth, finalHeight);
          resolve();
        };
        tmpImg.onerror = () => reject(new Error('Resize failed'));
        tmpImg.src = src;
      });

      finalData = ctx.getImageData(0, 0, finalWidth, finalHeight).data;
    }

    // Ensure width is a multiple of 8 (pad right with white)
    const paddedWidth = Math.ceil(finalWidth / 8) * 8;
    const mono = toMonochrome(finalData, finalWidth, finalHeight);

    // Pad rows to paddedWidth
    if (paddedWidth !== finalWidth) {
      for (const row of mono) {
        while (row.length < paddedWidth) {
          row.push(false); // white padding
        }
      }
    }

    return buildBitImageCommands(mono, paddedWidth, finalHeight);
  } catch (err) {
    console.error('[escposImage] Failed to convert image:', err);
    return null;
  }
}
