/**
 * Narzędzia do przetwarzania obrazów
 * - Naprawa orientacji EXIF (obrócone zdjęcia z telefonu)
 * - Kompresja
 */

/**
 * Odczytuje orientację EXIF z obrazu
 * Orientacja EXIF:
 * 1 = normalna
 * 3 = obrócona o 180°
 * 6 = obrócona o 90° w prawo
 * 8 = obrócona o 90° w lewo
 */
function getExifOrientation(file: File): Promise<number> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const view = new DataView(e.target?.result as ArrayBuffer);
      
      // Sprawdź czy to JPEG
      if (view.getUint16(0, false) !== 0xFFD8) {
        resolve(1); // Nie JPEG - brak orientacji
        return;
      }

      const length = view.byteLength;
      let offset = 2;

      while (offset < length) {
        if (view.getUint16(offset + 2, false) <= 8) {
          resolve(1);
          return;
        }
        
        const marker = view.getUint16(offset, false);
        offset += 2;

        if (marker === 0xFFE1) { // APP1 marker (EXIF)
          if (view.getUint32(offset + 2, false) !== 0x45786966) { // "Exif"
            resolve(1);
            return;
          }

          const little = view.getUint16(offset + 8, false) === 0x4949;
          offset += 8;
          
          const tags = view.getUint16(offset + 2, little);
          offset += 4;

          for (let i = 0; i < tags; i++) {
            if (view.getUint16(offset + (i * 12), little) === 0x0112) { // Orientation tag
              resolve(view.getUint16(offset + (i * 12) + 8, little));
              return;
            }
          }
        } else if ((marker & 0xFF00) !== 0xFF00) {
          break;
        } else {
          offset += view.getUint16(offset, false);
        }
      }
      
      resolve(1); // Brak orientacji = normalna
    };
    
    reader.readAsArrayBuffer(file.slice(0, 65536)); // Tylko początek pliku
  });
}

/**
 * Naprawia orientację obrazu na podstawie EXIF i opcjonalnie kompresuje
 */
export async function fixImageOrientation(
  file: File,
  maxWidth: number = 1600,
  quality: number = 0.85
): Promise<string> {
  const orientation = await getExifOrientation(file);
  
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d')!;
        
        let width = img.width;
        let height = img.height;
        
        // Skalowanie jeśli za duży
        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }
        
        // Ustaw wymiary canvas (zamień dla orientacji 6 i 8)
        if (orientation === 6 || orientation === 8) {
          canvas.width = height;
          canvas.height = width;
        } else {
          canvas.width = width;
          canvas.height = height;
        }
        
        // Transformacja na podstawie orientacji EXIF
        switch (orientation) {
          case 2: // Lustrzane odbicie poziome
            ctx.transform(-1, 0, 0, 1, width, 0);
            break;
          case 3: // Obrót 180°
            ctx.transform(-1, 0, 0, -1, width, height);
            break;
          case 4: // Lustrzane odbicie pionowe
            ctx.transform(1, 0, 0, -1, 0, height);
            break;
          case 5: // Lustrzane + obrót 90° w lewo
            ctx.transform(0, 1, 1, 0, 0, 0);
            break;
          case 6: // Obrót 90° w prawo (najczęstszy z telefonu!)
            ctx.transform(0, 1, -1, 0, height, 0);
            break;
          case 7: // Lustrzane + obrót 90° w prawo
            ctx.transform(0, -1, -1, 0, height, width);
            break;
          case 8: // Obrót 90° w lewo
            ctx.transform(0, -1, 1, 0, 0, width);
            break;
          default:
            // Orientacja 1 lub nieznana - bez transformacji
            break;
        }
        
        // Rysuj obraz
        ctx.drawImage(img, 0, 0, width, height);
        
        // Zwróć jako base64 JPEG
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      
      img.src = e.target?.result as string;
    };
    
    reader.readAsDataURL(file);
  });
}

/**
 * Kompresuje obraz base64 (bez naprawy orientacji - dla już załadowanych)
 */
export function compressImage(
  base64: string, 
  maxWidth: number = 1200, 
  quality: number = 0.8
): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;

      if (width > maxWidth) {
        height = (height * maxWidth) / width;
        width = maxWidth;
      }

      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      ctx?.drawImage(img, 0, 0, width, height);

      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.src = base64;
  });
}

/**
 * Przetwarza plik obrazu - naprawia orientację i kompresuje
 */
export async function processImageFile(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Plik nie jest obrazem');
  }
  
  return fixImageOrientation(file, 1600, 0.85);
}

