// ESC/POS Commands for thermal printers
// Reference: https://reference.epson-biz.com/modules/ref_escpos/index.php

// Basic commands
export const ESC = '\x1B';
export const GS = '\x1D';
export const LF = '\x0A';
export const CR = '\x0D';

// Initialize printer
export const INIT = ESC + '@';

// Text formatting
export const TEXT_NORMAL = ESC + '!' + '\x00';
export const TEXT_BOLD = ESC + 'E' + '\x01';
export const TEXT_BOLD_OFF = ESC + 'E' + '\x00';
export const TEXT_DOUBLE_HEIGHT = ESC + '!' + '\x10';
export const TEXT_DOUBLE_WIDTH = ESC + '!' + '\x20';
export const TEXT_DOUBLE_SIZE = ESC + '!' + '\x30';
export const TEXT_UNDERLINE = ESC + '-' + '\x01';
export const TEXT_UNDERLINE_OFF = ESC + '-' + '\x00';

// Text alignment
export const ALIGN_LEFT = ESC + 'a' + '\x00';
export const ALIGN_CENTER = ESC + 'a' + '\x01';
export const ALIGN_RIGHT = ESC + 'a' + '\x02';

// Paper operations
export const PAPER_CUT = GS + 'V' + '\x00'; // Full cut
export const PAPER_CUT_PARTIAL = GS + 'V' + '\x01'; // Partial cut
export const PAPER_CUT_FEED = GS + 'V' + '\x41' + '\x03'; // Feed and cut

// Cash drawer
export const CASH_DRAWER_OPEN = ESC + 'p' + '\x00' + '\x19' + '\xFA'; // Pin 2
export const CASH_DRAWER_OPEN_PIN5 = ESC + 'p' + '\x01' + '\x19' + '\xFA'; // Pin 5

// Line spacing
export const LINE_SPACING_DEFAULT = ESC + '2';
export const LINE_SPACING_SET = (n: number) => ESC + '3' + String.fromCharCode(n);

// Character spacing (horizontal space between characters)
// ESC SP n - where n is the number of dot units (0-255)
export const CHAR_SPACING_SET = (n: number) => ESC + ' ' + String.fromCharCode(n);
export const CHAR_SPACING_DEFAULT = CHAR_SPACING_SET(0);

// Character size
export const CHAR_SIZE = (width: number, height: number) => {
  const n = ((width - 1) << 4) | (height - 1);
  return GS + '!' + String.fromCharCode(n);
};

// Feed lines
export const FEED_LINES = (n: number) => ESC + 'd' + String.fromCharCode(n);

// Horizontal line (using dashes)
export const HORIZONTAL_LINE = (width: number, char = '-') => char.repeat(width) + LF;

// Separator line
export const SEPARATOR_LINE = (width: number) => '='.repeat(width) + LF;

// Dashed line
export const DASHED_LINE = (width: number) => '-'.repeat(width) + LF;

// Calculate effective width based on charSpacing
// charSpacing (ESC SP n) adds n extra dots to the right of each character.
// Font A characters are 12 dots wide, so with charSpacing=n each char takes 12+n dots.
// Effective columns = floor(baseWidth * 12 / (12 + charSpacing))
export function calculateEffectiveWidth(baseWidth: number, charSpacing: number, rightMargin: number = 0): number {
  let width = baseWidth;
  if (charSpacing > 0) {
    const CHAR_WIDTH_DOTS = 12; // Font A: 12 dots/char
    width = Math.floor((baseWidth * CHAR_WIDTH_DOTS) / (CHAR_WIDTH_DOTS + charSpacing));
  }
  if (rightMargin > 0) {
    width -= rightMargin;
  }
  return Math.max(width, 20); // Minimum 20 chars
}

// Helper to create formatted text
// Prioritizes the right value (price) to never be cut off
export function formatLine(left: string, right: string, width: number): string {
  const spaces = width - left.length - right.length;
  if (spaces < 1) {
    // Ensure right value (price) is never cut - truncate left instead
    const maxLeftLength = width - right.length - 1;
    if (maxLeftLength < 3) {
      // If even 3 chars don't fit, just show the right value
      return right + LF;
    }
    return left.substring(0, maxLeftLength) + ' ' + right + LF;
  }
  return left + ' '.repeat(spaces) + right + LF;
}

// Helper to center text
export function centerText(text: string, width: number): string {
  const padding = Math.floor((width - text.length) / 2);
  return ' '.repeat(Math.max(0, padding)) + text;
}

// Helper to wrap text
export function wrapText(text: string, width: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    if ((currentLine + ' ' + word).trim().length <= width) {
      currentLine = (currentLine + ' ' + word).trim();
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    }
  }
  if (currentLine) lines.push(currentLine);

  return lines;
}

// Format currency (simple format for thermal printer compatibility)
export function formatCurrency(value: number): string {
  // Use simple string formatting to avoid special UTF-8 characters
  // that thermal printers don't support (like NBSP from Intl.NumberFormat)
  const formatted = value.toFixed(2).replace('.', ',');
  return 'R$ ' + formatted;
}

// Font size type
export type PrintFontSize = 'normal' | 'large' | 'extra_large';

// ASCII conversion map for printers that don't support accented characters
const ACCENT_MAP: Record<string, string> = {
  'á': 'a', 'à': 'a', 'ã': 'a', 'â': 'a', 'ä': 'a',
  'é': 'e', 'è': 'e', 'ê': 'e', 'ë': 'e',
  'í': 'i', 'ì': 'i', 'î': 'i', 'ï': 'i',
  'ó': 'o', 'ò': 'o', 'õ': 'o', 'ô': 'o', 'ö': 'o',
  'ú': 'u', 'ù': 'u', 'û': 'u', 'ü': 'u',
  'ç': 'c', 'ñ': 'n',
  'Á': 'A', 'À': 'A', 'Ã': 'A', 'Â': 'A', 'Ä': 'A',
  'É': 'E', 'È': 'E', 'Ê': 'E', 'Ë': 'E',
  'Í': 'I', 'Ì': 'I', 'Î': 'I', 'Ï': 'I',
  'Ó': 'O', 'Ò': 'O', 'Õ': 'O', 'Ô': 'O', 'Ö': 'O',
  'Ú': 'U', 'Ù': 'U', 'Û': 'U', 'Ü': 'U',
  'Ç': 'C', 'Ñ': 'N',
};

// Convert accented characters to ASCII
export function toAscii(text: string): string {
  return text.split('').map(char => ACCENT_MAP[char] || char).join('');
}

// Get font size command based on setting
export function getFontSizeCommand(fontSize: PrintFontSize): string {
  switch (fontSize) {
    case 'large':
      return TEXT_DOUBLE_HEIGHT;
    case 'extra_large':
      return TEXT_DOUBLE_SIZE;
    default:
      return TEXT_NORMAL;
  }
}

// Detect if a product name is a "placeholder" (e.g., "Escolha até 2 Sabores")
// These should be replaced by the actual flavor names from extras
export function isPlaceholderProductName(name: string): boolean {
  const lowerName = name.toLowerCase();
  return (
    lowerName.includes('escolha') ||
    lowerName.includes('selecione') ||
    /até \d+ sabor/.test(lowerName) ||
    lowerName.includes('monte sua') ||
    lowerName.includes('customize') ||
    lowerName.includes('escolher') ||
    lowerName.includes('sabores')
  );
}

function isBorderExtraName(name: string): boolean {
  return name.toLowerCase().includes('borda');
}

function isFlavorExtraName(name: string): boolean {
  const normalized = name.trim().toLowerCase();
  return /^\d+\/\d+\s+/.test(normalized) || normalized.startsWith('sabor: ');
}

function normalizeFlavorDisplayName(name: string): string {
  return name.replace(/^sabor:\s*/i, '').trim();
}

// Get the display name for a product, replacing placeholder names with flavor extras
export function getProductDisplayName(
  productName: string, 
  extras?: string[] | { name: string; price: number }[]
): { displayName: string; filteredExtras: string[] | { name: string; price: number }[] } {
  if (!isPlaceholderProductName(productName) || !extras || extras.length === 0) {
    return { displayName: productName, filteredExtras: extras || [] };
  }
  
  const extraNames = extras.map(e => typeof e === 'string' ? e : e.name);
  const flavors = extraNames
    .filter(isFlavorExtraName)
    .map(normalizeFlavorDisplayName);
  
  if (flavors.length > 0) {
    const displayName = flavors.join(' + ').toUpperCase();

    if (typeof extras[0] === 'string') {
      return {
        displayName,
        filteredExtras: (extras as string[]).filter(extra => !isFlavorExtraName(extra)),
      };
    }

    return {
      displayName,
      filteredExtras: (extras as { name: string; price: number }[]).filter(
        extra => !isFlavorExtraName(extra.name)
      ),
    };
  }

  if (typeof extras[0] === 'string') {
    return {
      displayName: productName,
      // Preserva todos os extras quando o produto é placeholder,
      // para não sumir com os sabores montados via sub-itens (🍕 PIZZA / linhas indentadas)
      filteredExtras: extras as string[],
    };
  }

  return {
    displayName: productName,
    // Preserva todos os extras quando não foi possível extrair os sabores para o nome
    filteredExtras: extras as { name: string; price: number }[],
  };
}

// Build kitchen ticket
export interface KitchenTicketItem {
  quantity: number;
  productName: string;
  variation?: string | null;
  extras?: string[];
  extrasWithPrice?: { name: string; price: number }[]; // Extras com preço
  notes?: string | null;
  print_sector_id?: string | null;
  addedBy?: string | null; // Nome do garçom que adicionou o item
  comboName?: string | null; // Nome do combo (se fizer parte de um combo)
  fulfillment_type?: string | null;
}

export interface KitchenTicketData {
  orderNumber: string;
  orderType: 'dine_in' | 'takeaway' | 'delivery';
  tableNumber?: number;
  customerName?: string | null;
  pagerNumber?: string | null;
  sectorName?: string; // Name of the print sector
  items: KitchenTicketItem[];
  notes?: string | null;
  createdAt: string;
}

// Options for kitchen ticket printing
export interface KitchenTicketOptions {
  showItemNumber?: boolean;      // Mostrar número sequencial do item
  showComplementPrice?: boolean; // Mostrar preço dos complementos
  showComplementName?: boolean;  // Mostrar nome dos complementos
  largeFontProduction?: boolean; // Usar fonte maior para produtos
  hideComboQuantity?: boolean;   // Ocultar quantidade (1x, 2x) quando nome começa com número
  hideFlavorCategory?: boolean;  // Ocultar nome da categoria dos sabores (ex: "Sabor:")
}

// Função para extrair nome do combo das notas (formato "[Combo: Nome]")
export function extractComboNameFromNotes(notes: string | null | undefined): string | null {
  if (!notes) return null;
  const match = notes.match(/\[Combo:\s*([^\]]+)\]/i);
  return match ? match[1].trim() : null;
}

// Função para remover a tag de combo das notas
export function removeComboTagFromNotes(notes: string | null | undefined): string | null {
  if (!notes) return null;
  const cleaned = notes.replace(/\[Combo:\s*[^\]]+\]\s*/gi, '').trim();
  return cleaned || null;
}

export function buildKitchenTicket(
  data: KitchenTicketData, 
  paperWidth: '58mm' | '80mm' = '80mm', 
  fontSize: PrintFontSize = 'normal',
  lineSpacing: number = 0,
  leftMargin: number = 0,
  asciiMode: boolean = false,
  charSpacing: number = 1,
  topMargin: number = 0,
  bottomMargin: number = 3,
  options: KitchenTicketOptions = {},
  rightMargin: number = 0
): string {
  // Apply defaults for options
  const showItemNumber = options.showItemNumber ?? true;
  const showComplementPrice = options.showComplementPrice ?? false;
  const showComplementName = options.showComplementName ?? true;
  const largeFontProduction = options.largeFontProduction ?? false;
  const hideComboQuantity = options.hideComboQuantity ?? true;
  const hideFlavorCategory = options.hideFlavorCategory ?? false;
  const width = calculateEffectiveWidth(paperWidth === '58mm' ? 32 : 48, charSpacing, rightMargin);
  let ticket = '';
  const fontCmd = getFontSizeCommand(fontSize);
  const processText = (text: string) => asciiMode ? toAscii(text) : text;

  // Initialize
  ticket += INIT;

  // Top margin (blank lines at beginning)
  if (topMargin > 0) {
    ticket += FEED_LINES(topMargin);
  }

  // Apply character spacing if set (improves readability)
  if (charSpacing > 0) {
    ticket += CHAR_SPACING_SET(charSpacing);
  }

  // Apply line spacing if set
  if (lineSpacing > 0) {
    ticket += LINE_SPACING_SET(lineSpacing);
  }

  // Apply left margin if set
  if (leftMargin > 0) {
    ticket += GS + 'L' + String.fromCharCode(leftMargin) + '\x00';
  }

  // Header - use sector name if provided
  ticket += ALIGN_CENTER;
  ticket += TEXT_BOLD;
  ticket += fontCmd;
  ticket += processText(data.sectorName?.toUpperCase() || 'COZINHA') + LF;
  ticket += TEXT_DOUBLE_SIZE;
  
  if (data.orderType === 'dine_in' && data.tableNumber) {
    ticket += `MESA ${data.tableNumber}` + LF;
  } else if (data.orderType === 'takeaway') {
    ticket += processText('BALCAO') + LF;
  } else {
    ticket += 'DELIVERY' + LF;
  }

  ticket += fontCmd;
  ticket += TEXT_BOLD;
  ticket += `Pedido #${data.orderNumber.slice(-6).toUpperCase()}` + LF;
  ticket += TEXT_BOLD_OFF;
  
  if (data.pagerNumber) {
    ticket += TEXT_DOUBLE_SIZE;
    ticket += processText(`PAGER #${data.pagerNumber}`) + LF;
    ticket += fontCmd;
  }

  if (data.customerName) {
    ticket += processText(data.customerName) + LF;
  }

  ticket += TEXT_NORMAL;
  ticket += DASHED_LINE(width);

  // Date/time
  ticket += ALIGN_LEFT;
  ticket += fontCmd;
  const date = new Date(data.createdAt);
  ticket += `${date.toLocaleDateString('pt-BR')} ${date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` + LF;
  ticket += TEXT_NORMAL;
  ticket += DASHED_LINE(width);

  // Pre-process items: extract combo names from notes and group by combo
  const processedItems = data.items.map(item => {
    const comboFromNotes = extractComboNameFromNotes(item.notes);
    const cleanedNotes = removeComboTagFromNotes(item.notes);
    return {
      ...item,
      comboName: item.comboName || comboFromNotes,
      notes: cleanedNotes,
    };
  });

  // Group items by combo name
  interface ComboGroup {
    comboName: string;
    items: typeof processedItems;
  }
  
  const comboGroups: ComboGroup[] = [];
  const standaloneItems: typeof processedItems = [];
  const comboMap = new Map<string, typeof processedItems>();

  for (const item of processedItems) {
    if (item.comboName) {
      const existing = comboMap.get(item.comboName) || [];
      existing.push(item);
      comboMap.set(item.comboName, existing);
    } else {
      standaloneItems.push(item);
    }
  }

  // Convert map to array
  comboMap.forEach((items, comboName) => {
    comboGroups.push({ comboName, items });
  });

  // Print standalone items first
  let itemNumber = 0;
  for (const item of standaloneItems) {
    itemNumber++;
    ticket += printSingleItem(item, itemNumber, showItemNumber, largeFontProduction, fontCmd, showComplementName, showComplementPrice, processText, hideComboQuantity, hideFlavorCategory);
  }

  // Print combo groups
  for (const group of comboGroups) {
    itemNumber++;
    
    // Combo header
    ticket += TEXT_DOUBLE_SIZE;
    ticket += TEXT_BOLD;
    ticket += GS + 'B' + '\x01'; // INVERT ON (tarja preta para destaque)
    if (showItemNumber) {
      ticket += ` ${itemNumber}. COMBO: ${processText(group.comboName)} ` + LF;
    } else {
      ticket += ` COMBO: ${processText(group.comboName)} ` + LF;
    }
    ticket += GS + 'B' + '\x00'; // INVERT OFF
    ticket += TEXT_BOLD_OFF;
    ticket += fontCmd;
    
    // Print each item in the combo as a sub-item
    for (const item of group.items) {
      // Detectar se é produto placeholder e obter nome correto
      const extrasForName = item.extrasWithPrice || item.extras?.map(e => ({ name: e, price: 0 })) || [];
      const { displayName, filteredExtras } = getProductDisplayName(item.productName, extrasForName);
      
      // Aplicar fonte maior se largeFontProduction está ativado
      if (largeFontProduction) {
        ticket += TEXT_DOUBLE_SIZE;
      } else {
        ticket += fontCmd;
      }
      
      ticket += TEXT_BOLD;
      // Sub-item com bullet point
      ticket += `  • ${item.quantity}x ${processText(displayName)}` + LF;
      ticket += TEXT_BOLD_OFF;
      
      // Voltar para fonte normal para detalhes
      if (largeFontProduction) {
        ticket += fontCmd;
      }

      if (item.variation) {
        ticket += `    > ${processText(item.variation)}` + LF;
      }

      // Processar complementos filtrados
      const extrasToShow = filteredExtras as { name: string; price: number }[];
      if (extrasToShow && extrasToShow.length > 0) {
        let lastExtraWasPizzaHeader = false;

        for (const extra of extrasToShow) {
          const normalizedName = extra.name.trim();
          const isBorda = normalizedName.toLowerCase().includes('borda');
          const isPizzaHeader = normalizedName.startsWith('🍕 PIZZA');
          const isFractionedFlavor = /^\d+\/\d+\s+/.test(normalizedName);
          const isObservationLine = normalizedName.startsWith('OBS:');
          const isLikelyFlavorAfterHeader = lastExtraWasPizzaHeader && !isObservationLine && !isBorda;
          const isCategoryHeader = /:\s*$/.test(normalizedName) && !isPizzaHeader;
          const isUppercaseFlavor = /\([A-Z]\)\s*$/.test(normalizedName) || (normalizedName === normalizedName.toUpperCase() && normalizedName.length > 2 && !normalizedName.startsWith('#'));
          const isFlavorLine = !isCategoryHeader && ((extra.name.startsWith('  ') && !isObservationLine && !isBorda) || isFractionedFlavor || isLikelyFlavorAfterHeader || (isUppercaseFlavor && !isObservationLine && !isBorda));
          const shouldPrintExtra = showComplementName || isPizzaHeader || isFlavorLine;

          if (!shouldPrintExtra) {
            lastExtraWasPizzaHeader = false;
            continue;
          }

          let extraText = extra.name;
          
          if (showComplementPrice && extra.price > 0) {
            extraText += ` (R$ ${extra.price.toFixed(2).replace('.', ',')})`;
          }
          
          if (isBorda) {
            ticket += TEXT_BOLD;
            ticket += GS + 'B' + '\x01';
            ticket += `   + ${processText(extraText)} ` + LF;
            ticket += GS + 'B' + '\x00';
            ticket += TEXT_BOLD_OFF;
            lastExtraWasPizzaHeader = false;
          } else if (isPizzaHeader || isCategoryHeader) {
             if (!hideFlavorCategory) {
               ticket += `  ${processText(extraText)}` + LF;
             }
             lastExtraWasPizzaHeader = isPizzaHeader;
          } else if (isFlavorLine) {
            ticket += TEXT_DOUBLE_SIZE;
            ticket += TEXT_BOLD;
            ticket += processText(extraText.trim()) + LF;
            ticket += TEXT_BOLD_OFF;
            ticket += fontCmd;
            lastExtraWasPizzaHeader = false;
          } else {
            ticket += `    + ${processText(extraText)}` + LF;
            lastExtraWasPizzaHeader = false;
          }
        }
      }

      if (item.notes) {
        ticket += TEXT_DOUBLE_SIZE;
        ticket += GS + 'B' + '\x01';
        ticket += ` OBS: ${processText(item.notes)} ` + LF;
        ticket += GS + 'B' + '\x00';
        ticket += fontCmd;
      }

      if (item.addedBy) {
        ticket += `    [${processText(item.addedBy)}]` + LF;
      }
    }
    
    ticket += LF;
  }

  // Helper function to print a single item (defined inline for access to closure variables)
  function printSingleItem(
    item: typeof processedItems[0], 
    num: number, 
    showNum: boolean, 
    largeFont: boolean, 
    font: string, 
    showComp: boolean, 
    showCompPrice: boolean,
    process: (text: string) => string,
    hideQuantityForCombos: boolean = true,
    hideFlavorCat: boolean = false
  ): string {
    let output = '';
    
    // Badge "PARA VIAGEM" se item tem fulfillment_type takeaway
    if (item.fulfillment_type === 'takeaway') {
      output += ALIGN_CENTER;
      output += TEXT_BOLD;
      output += GS + 'B' + '\x01'; // INVERT ON
      output += ` *** PARA VIAGEM *** ` + LF;
      output += GS + 'B' + '\x00'; // INVERT OFF
      output += TEXT_BOLD_OFF;
      output += ALIGN_LEFT;
    }
    
    // Detectar se é produto placeholder e obter nome correto
    const extrasForName = item.extrasWithPrice || item.extras?.map(e => ({ name: e, price: 0 })) || [];
    const { displayName, filteredExtras } = getProductDisplayName(item.productName, extrasForName);
    
    // Verificar se deve ocultar quantidade quando nome começa com número
    const startsWithNumber = /^\d/.test(displayName.trim());
    const shouldShowQuantity = !(hideQuantityForCombos && startsWithNumber);
    
    // Detectar se o item tem sabores de pizza (sub_items/extras com frações)
    const hasPizzaFlavors = (item.extras || []).some(e => 
      e.startsWith('🍕 PIZZA') || /^\s*\d+\/\d+\s+/.test(e)
    );
    
    // Se tem sabores de pizza, o nome do produto fica em fonte NORMAL (menor que o sabor)
    // Caso contrário, aplica largeFontProduction normalmente
    if (hasPizzaFlavors) {
      output += font; // fonte normal para nome do produto
    } else if (largeFont) {
      output += TEXT_DOUBLE_SIZE;
    } else {
      output += font;
    }
    
    output += TEXT_BOLD;
    
    // Construir linha do item com ou sem número sequencial e quantidade
    if (showNum && shouldShowQuantity) {
      output += `${num}. ${item.quantity}x ${process(displayName)}` + LF;
    } else if (showNum) {
      output += `${num}. ${process(displayName)}` + LF;
    } else if (shouldShowQuantity) {
      output += `${item.quantity}x ${process(displayName)}` + LF;
    } else {
      output += `${process(displayName)}` + LF;
    }
    output += TEXT_BOLD_OFF;
    
    // Voltar para fonte normal para detalhes
    if (largeFont || hasPizzaFlavors) {
      output += font;
    }

    if (item.variation) {
      output += `  > ${process(item.variation)}` + LF;
    }

    // Processar complementos filtrados (sem os sabores que foram para o nome)
    const extrasToShow = filteredExtras as { name: string; price: number }[];
    if (showComp && extrasToShow && extrasToShow.length > 0) {
      let lastExtraWasPizzaHeader = false;

      for (const extra of extrasToShow) {
        const normalizedName = extra.name.trim();
        const isBorda = normalizedName.toLowerCase().includes('borda');
        const isPizzaHeader = normalizedName.startsWith('🍕 PIZZA');
        const isFractionedFlavor = /^\d+\/\d+\s+/.test(normalizedName);
        const isObservationLine = normalizedName.startsWith('OBS:');
        const isLikelyFlavorAfterHeader = lastExtraWasPizzaHeader && !isObservationLine && !isBorda;
        const isCategoryHeader = /:\s*$/.test(normalizedName) && !isPizzaHeader;
        const isUppercaseFlavor = /\([A-Z]\)\s*$/.test(normalizedName) || (normalizedName === normalizedName.toUpperCase() && normalizedName.length > 2 && !normalizedName.startsWith('#'));
        const isFlavorLine = !isCategoryHeader && ((extra.name.startsWith('  ') && !isObservationLine && !isBorda) || isFractionedFlavor || isLikelyFlavorAfterHeader || (isUppercaseFlavor && !isObservationLine && !isBorda));
        
        let extraText = extra.name;
        
        // Adicionar preço se configurado
        if (showCompPrice && extra.price > 0) {
          extraText += ` (R$ ${extra.price.toFixed(2).replace('.', ',')})`;
        }
        
        if (isPizzaHeader || isCategoryHeader) {
          // Cabeçalho de pizza/categoria — ocultar se hideFlavorCat
          if (!hideFlavorCat) {
            output += `  ${process(extraText)}` + LF;
          }
          lastExtraWasPizzaHeader = isPizzaHeader;
        } else if (isFlavorLine) {
          // Sabor da pizza — imprimir em fonte grande e bold
          output += TEXT_DOUBLE_SIZE;
          output += TEXT_BOLD;
          output += process(extraText.trim()) + LF;
          output += TEXT_BOLD_OFF;
          output += font;
          lastExtraWasPizzaHeader = false;
        } else if (isBorda) {
          // Tarja preta para destacar bordas
          output += TEXT_BOLD;
          output += GS + 'B' + '\x01'; // INVERT ON (tarja preta)
          output += ` + ${process(extraText)} ` + LF;
          output += GS + 'B' + '\x00'; // INVERT OFF
          output += TEXT_BOLD_OFF;
          lastExtraWasPizzaHeader = false;
        } else {
          output += `  + ${process(extraText)}` + LF;
          lastExtraWasPizzaHeader = false;
        }
      }
    }

    if (item.notes) {
      // Tarja preta com fonte grande para destaque visual
      output += TEXT_DOUBLE_SIZE;
      output += GS + 'B' + '\x01'; // INVERT ON (tarja preta)
      output += ` OBS: ${process(item.notes)} ` + LF;
      output += GS + 'B' + '\x00'; // INVERT OFF
      output += font; // Volta para fonte configurada
    }

    // Nome do garçom que adicionou o item
    if (item.addedBy) {
      output += `  [${process(item.addedBy)}]` + LF;
    }

    output += LF;
    return output;
  }

  // General notes - NOT printed on kitchen ticket (only shown in system)
  // Removed per user request - observações gerais appear only in the system UI

  // Footer
  ticket += TEXT_NORMAL;
  ticket += DASHED_LINE(width);
  ticket += ALIGN_CENTER;
  ticket += `Impresso: ${new Date().toLocaleString('pt-BR')}` + LF;
  
  // Feed and cut (use configurable bottom margin)
  ticket += FEED_LINES(bottomMargin);
  ticket += PAPER_CUT_PARTIAL;

  return ticket;
}

// Build customer receipt
export interface CustomerReceiptData {
  restaurantName: string;
  restaurantAddress?: string;
  restaurantPhone?: string;
  restaurantCnpj?: string;
  orderNumber: string;
  orderType: 'dine_in' | 'takeaway' | 'delivery';
  tableNumber?: number;
  customerName?: string | null;
  items: {
    quantity: number;
    productName: string;
    variation?: string | null;
    extras?: { name: string; price: number }[];
    notes?: string | null;
    totalPrice: number;
  }[];
  subtotal: number;
  discount?: { type: 'percentage' | 'fixed'; value: number; amount: number };
  serviceCharge?: { percent: number; amount: number };
  total: number;
  payments: { method: string; amount: number }[];
  change?: number;
  splitBill?: { count: number; amountPerPerson: number };
  createdAt: string;
  customMessage?: string;
  qrCodeContent?: string;
  qrCodeSize?: number; // 1-8, default 5
  receiptType?: 'summary' | 'fiscal'; // Type of receipt: summary (before payment) or fiscal (after payment)
}

export function buildCustomerReceipt(
  data: CustomerReceiptData, 
  paperWidth: '58mm' | '80mm' = '80mm', 
  fontSize: PrintFontSize = 'normal',
  lineSpacing: number = 0,
  leftMargin: number = 0,
  asciiMode: boolean = false,
  charSpacing: number = 1,
  topMargin: number = 0,
  bottomMargin: number = 4,
  skipRestaurantName: boolean = false,
  rightMargin: number = 0
): string {
  const baseWidth = paperWidth === '58mm' ? 32 : 48;
  // Calculate effective width accounting for charSpacing to avoid cutoff
  const width = calculateEffectiveWidth(baseWidth, charSpacing, rightMargin);
  let receipt = '';
  const fontCmd = getFontSizeCommand(fontSize);
  const processText = (text: string) => asciiMode ? toAscii(text) : text;

  // Initialize — skip INIT when logo is being prepended externally
  if (!skipRestaurantName) {
    receipt += INIT;
  }

  // Top margin (blank lines at beginning)
  if (topMargin > 0) {
    receipt += FEED_LINES(topMargin);
  }

  // Apply character spacing if set (improves readability)
  if (charSpacing > 0) {
    receipt += CHAR_SPACING_SET(charSpacing);
  }

  // Apply line spacing if set
  if (lineSpacing > 0) {
    receipt += LINE_SPACING_SET(lineSpacing);
  }

  // Apply left margin if set
  if (leftMargin > 0) {
    receipt += GS + 'L' + String.fromCharCode(leftMargin) + '\x00';
  }

  // Header - skip restaurant name if logo is being printed separately
  receipt += ALIGN_CENTER;
  if (!skipRestaurantName) {
    receipt += TEXT_DOUBLE_SIZE;
    receipt += processText(data.restaurantName) + LF;
  }
  receipt += fontCmd;
  
  if (data.restaurantAddress) {
    receipt += processText(data.restaurantAddress) + LF;
  }
  if (data.restaurantPhone) {
    receipt += `Tel: ${data.restaurantPhone}` + LF;
  }
  if (data.restaurantCnpj) {
    receipt += `CNPJ: ${data.restaurantCnpj}` + LF;
  }

  receipt += TEXT_NORMAL;
  receipt += DASHED_LINE(width);

  // Receipt type banner (RESUMO DA CONTA or CUPOM FISCAL)
  if (data.receiptType) {
    receipt += ALIGN_CENTER;
    receipt += TEXT_BOLD;
    
    if (data.receiptType === 'summary') {
      // Tarja preta com fonte grande para "RESUMO DA CONTA"
      receipt += TEXT_DOUBLE_SIZE;
      receipt += GS + 'B' + '\x01'; // INVERT ON (tarja preta)
      receipt += ' RESUMO DA CONTA ' + LF;
      receipt += GS + 'B' + '\x00'; // INVERT OFF
      receipt += TEXT_NORMAL;
      receipt += fontCmd;
      receipt += processText('* Este nao e um documento fiscal *') + LF;
    } else {
      // CUPOM FISCAL
      receipt += TEXT_DOUBLE_SIZE;
      receipt += 'CUPOM FISCAL' + LF;
      receipt += TEXT_BOLD_OFF;
      receipt += fontCmd;
      receipt += processText('* Documento sem valor fiscal *') + LF;
    }
    
    receipt += TEXT_NORMAL;
    receipt += DASHED_LINE(width);
  }

  // Order info
  receipt += ALIGN_LEFT;
  receipt += fontCmd;
  receipt += `Pedido: #${data.orderNumber.slice(-8).toUpperCase()}` + LF;
  
  const orderTypeLabel = data.orderType === 'dine_in' 
    ? `Mesa ${data.tableNumber || '-'}`
    : data.orderType === 'takeaway' 
      ? 'Retirada' 
      : 'Delivery';
  receipt += processText(orderTypeLabel) + (data.customerName ? ` - ${processText(data.customerName)}` : '') + LF;
  receipt += new Date(data.createdAt).toLocaleString('pt-BR') + LF;

  receipt += TEXT_NORMAL;
  receipt += DASHED_LINE(width);

  // Items header
  receipt += fontCmd;
  receipt += TEXT_BOLD;
  receipt += 'ITENS' + LF;
  receipt += TEXT_BOLD_OFF;
  receipt += TEXT_NORMAL;
  receipt += SEPARATOR_LINE(width);

  // Items
  receipt += fontCmd;
  for (const item of data.items) {
    // Detectar se é produto placeholder e obter nome correto
    const { displayName, filteredExtras } = getProductDisplayName(item.productName, item.extras || []);
    
    const itemName = `${item.quantity}x ${processText(displayName)}${item.variation ? ` (${processText(item.variation)})` : ''}`;
    const itemPrice = formatCurrency(item.totalPrice);
    
    if (itemName.length + itemPrice.length + 1 > width) {
      receipt += itemName.substring(0, width - 1) + LF;
      receipt += formatLine('', itemPrice, width);
    } else {
      receipt += formatLine(itemName, itemPrice, width);
    }

    // Mostrar apenas extras filtrados (bordas, sem os sabores que estão no nome)
    const extrasToShow = filteredExtras as { name: string; price: number }[];
    if (extrasToShow && extrasToShow.length > 0) {
      for (const extra of extrasToShow) {
        receipt += `  + ${processText(extra.name)}` + LF;
      }
    }

    if (item.notes) {
      receipt += `  Obs: ${processText(item.notes)}` + LF;
    }
  }

  // Totals
  receipt += TEXT_NORMAL;
  receipt += DASHED_LINE(width);
  receipt += fontCmd;
  receipt += formatLine('Subtotal', formatCurrency(data.subtotal), width);

  if (data.discount && data.discount.amount > 0) {
    const discountLabel = data.discount.type === 'percentage' 
      ? `Desconto (${data.discount.value}%)`
      : 'Desconto';
    receipt += formatLine(discountLabel, `-${formatCurrency(data.discount.amount)}`, width);
  }

  if (data.serviceCharge && data.serviceCharge.amount > 0) {
    receipt += formatLine(processText(`Taxa de servico (${data.serviceCharge.percent}%)`), `+${formatCurrency(data.serviceCharge.amount)}`, width);
  }

  receipt += TEXT_NORMAL;
  receipt += SEPARATOR_LINE(width);
  receipt += TEXT_BOLD;
  receipt += TEXT_DOUBLE_HEIGHT;
  receipt += formatLine('TOTAL', formatCurrency(data.total), width);
  receipt += fontCmd;

  // Payments
  if (data.payments.length > 0) {
    receipt += TEXT_NORMAL;
    receipt += DASHED_LINE(width);
    receipt += fontCmd;
    receipt += TEXT_BOLD;
    receipt += 'PAGAMENTO' + LF;
    receipt += TEXT_BOLD_OFF;

    for (const payment of data.payments) {
      const methodLabel = payment.method === 'cash' ? 'Dinheiro' :
        payment.method === 'credit_card' ? 'Credito' :
        payment.method === 'debit_card' ? 'Debito' : 'Pix';
      receipt += formatLine(methodLabel, formatCurrency(payment.amount), width);
    }

    if (data.change && data.change > 0) {
      receipt += TEXT_BOLD;
      receipt += formatLine('Troco', formatCurrency(data.change), width);
      receipt += TEXT_BOLD_OFF;
    }
  }

  // Split bill
  if (data.splitBill && data.splitBill.count > 1) {
    receipt += TEXT_NORMAL;
    receipt += DASHED_LINE(width);
    receipt += ALIGN_CENTER;
    receipt += fontCmd;
    receipt += TEXT_BOLD;
    receipt += processText(`DIVISAO (${data.splitBill.count} pessoas)`) + LF;
    receipt += TEXT_DOUBLE_HEIGHT;
    receipt += `${formatCurrency(data.splitBill.amountPerPerson)} por pessoa` + LF;
    receipt += fontCmd;
    receipt += ALIGN_LEFT;
  }

  // Footer with custom message or receipt-type-specific message
  receipt += TEXT_NORMAL;
  receipt += DASHED_LINE(width);
  receipt += ALIGN_CENTER;
  receipt += fontCmd;
  receipt += TEXT_BOLD;
  
  if (data.customMessage) {
    const messageLines = wrapText(processText(data.customMessage), width);
    for (const line of messageLines) {
      receipt += line + LF;
    }
  } else if (data.receiptType === 'summary') {
    // For bill summary (before payment)
    receipt += processText('Aguardamos seu pagamento!') + LF;
  } else {
    // For fiscal receipt (after payment) or default
    receipt += processText('Obrigado pela preferencia!') + LF;
    receipt += TEXT_BOLD_OFF;
    receipt += 'Volte sempre!' + LF;
  }
  
  receipt += TEXT_BOLD_OFF;
  receipt += LF;
  
  // QR Code if provided
  if (data.qrCodeContent) {
    receipt += buildQRCode(data.qrCodeContent, data.qrCodeSize || 5);
    receipt += LF;
  }
  
  receipt += new Date().toLocaleString('pt-BR') + LF;

  // Feed and cut (use configurable bottom margin)
  receipt += FEED_LINES(bottomMargin);
  receipt += PAPER_CUT_PARTIAL;

  return receipt;
}

// Build QR Code ESC/POS command
// moduleSize: 1-8 (default 5)
export function buildQRCode(content: string, moduleSize: number = 5): string {
  let qr = '';
  
  // Clamp moduleSize to valid range
  const size = Math.max(1, Math.min(8, moduleSize));
  
  // Select model 2
  qr += GS + '(k' + '\x04\x00\x31\x41\x32\x00';
  
  // Set size (module size 1-8)
  qr += GS + '(k' + '\x03\x00\x31\x43' + String.fromCharCode(size);
  
  // Set error correction level L
  qr += GS + '(k' + '\x03\x00\x31\x45\x30';
  
  // Store data
  const len = content.length + 3;
  const pL = len % 256;
  const pH = Math.floor(len / 256);
  qr += GS + '(k' + String.fromCharCode(pL) + String.fromCharCode(pH) + '\x31\x50\x30' + content;
  
  // Print QR code
  qr += GS + '(k' + '\x03\x00\x31\x51\x30';
  
  return qr;
}

// Open cash drawer
export function buildCashDrawerCommand(): string {
  return CASH_DRAWER_OPEN;
}

// Build font size test print
export function buildFontSizeTestPrint(
  paperWidth: '58mm' | '80mm' = '80mm', 
  fontSize: PrintFontSize = 'normal',
  type: 'kitchen' | 'receipt' = 'kitchen',
  restaurantName: string = 'MINHA PIZZARIA',
  lineSpacing: number = 0,
  leftMargin: number = 0,
  asciiMode: boolean = false
): string {
  const width = paperWidth === '58mm' ? 32 : 48;
  let print = '';
  const fontCmd = getFontSizeCommand(fontSize);
  const processText = (text: string) => asciiMode ? toAscii(text) : text;

  // Initialize
  print += INIT;

  // Apply line spacing if set
  if (lineSpacing > 0) {
    print += LINE_SPACING_SET(lineSpacing);
  }

  // Apply left margin if set
  if (leftMargin > 0) {
    print += GS + 'L' + String.fromCharCode(leftMargin) + '\x00';
  }

  // Header
  print += ALIGN_CENTER;
  print += TEXT_BOLD;
  print += fontCmd;
  print += processText(restaurantName.toUpperCase()) + LF;
  print += TEXT_NORMAL;
  print += DASHED_LINE(width);

  // Order info
  print += fontCmd;
  print += 'PEDIDO #123' + LF;
  if (type === 'kitchen') {
    print += 'COZINHA - Mesa: 05' + LF;
  } else {
    print += 'Mesa: 05' + LF;
  }
  print += TEXT_NORMAL;
  print += DASHED_LINE(width);

  // Items
  print += ALIGN_LEFT;
  print += fontCmd;
  print += '1x Pizza Grande' + LF;
  print += '  - Calabresa' + LF;
  print += '2x Refrigerante' + LF;
  print += TEXT_NORMAL;
  print += DASHED_LINE(width);

  // Total (only for receipt)
  if (type === 'receipt') {
    print += fontCmd;
    print += TEXT_BOLD;
    print += formatLine('TOTAL', 'R$ 65,00', width);
    print += TEXT_BOLD_OFF;
    print += TEXT_NORMAL;
    print += DASHED_LINE(width);
  }

  // Footer - test info
  print += ALIGN_CENTER;
  print += fontCmd;
  const fontLabel = fontSize === 'normal' ? 'NORMAL' : fontSize === 'large' ? 'GRANDE' : 'EXTRA GRANDE';
  print += `TESTE DE FONTE: ${fontLabel}` + LF;
  print += TEXT_NORMAL;
  print += new Date().toLocaleString('pt-BR') + LF;
  
  // Feed and cut
  print += FEED_LINES(3);
  print += PAPER_CUT_PARTIAL;

  return print;
}

// Build cancellation ticket for kitchen
export interface CancellationTicketData {
  orderNumber: string;
  orderType: 'dine_in' | 'takeaway' | 'delivery';
  tableNumber?: number;
  customerName?: string | null;
  cancellationReason: string;
  cancelledBy?: string;
  items: {
    quantity: number;
    productName: string;
    variation?: string | null;
    notes?: string | null;
    extras?: string[];
  }[];
  cancelledAt: string;
}

export function buildCancellationTicket(
  data: CancellationTicketData,
  paperWidth: '58mm' | '80mm' = '80mm',
  fontSize: PrintFontSize = 'normal',
  lineSpacing: number = 0,
  leftMargin: number = 0,
  asciiMode: boolean = false,
  charSpacing: number = 1,
  topMargin: number = 0,
  bottomMargin: number = 3,
  rightMargin: number = 0
): string {
  const width = calculateEffectiveWidth(paperWidth === '58mm' ? 32 : 48, charSpacing, rightMargin);
  let ticket = '';
  const fontCmd = getFontSizeCommand(fontSize);
  const processText = (text: string) => asciiMode ? toAscii(text) : text;

  // Initialize
  ticket += INIT;

  // Top margin
  if (topMargin > 0) {
    ticket += FEED_LINES(topMargin);
  }

  // Character spacing
  if (charSpacing > 0) {
    ticket += CHAR_SPACING_SET(charSpacing);
  }

  // Line spacing
  if (lineSpacing > 0) {
    ticket += LINE_SPACING_SET(lineSpacing);
  }

  // Left margin
  if (leftMargin > 0) {
    ticket += GS + 'L' + String.fromCharCode(leftMargin) + '\x00';
  }

  // Header - INVERTED (black background, white text) for emphasis
  ticket += ALIGN_CENTER;
  ticket += TEXT_DOUBLE_SIZE;
  ticket += GS + 'B' + '\x01'; // INVERT ON
  ticket += ' CANCELAMENTO ' + LF;
  ticket += GS + 'B' + '\x00'; // INVERT OFF
  ticket += LF;

  // Order info
  ticket += TEXT_BOLD;
  ticket += fontCmd;
  
  if (data.orderType === 'dine_in' && data.tableNumber) {
    ticket += `MESA ${data.tableNumber}` + LF;
  } else if (data.orderType === 'takeaway') {
    ticket += processText('BALCAO') + LF;
  } else {
    ticket += 'DELIVERY' + LF;
  }

  ticket += `Pedido #${data.orderNumber.slice(-6).toUpperCase()}` + LF;
  ticket += TEXT_BOLD_OFF;
  
  
  ticket += TEXT_NORMAL;
  ticket += DASHED_LINE(width);

  if (data.customerName) {
    ticket += processText(data.customerName) + LF;
  }

  ticket += TEXT_NORMAL;
  ticket += DASHED_LINE(width);

  // Cancellation reason - highlighted
  ticket += ALIGN_LEFT;
  ticket += fontCmd;
  ticket += TEXT_BOLD;
  ticket += 'MOTIVO:' + LF;
  ticket += TEXT_BOLD_OFF;
  ticket += TEXT_DOUBLE_SIZE;
  ticket += GS + 'B' + '\x01'; // INVERT ON
  ticket += ` ${processText(data.cancellationReason || 'Nao informado')} ` + LF;
  ticket += GS + 'B' + '\x00'; // INVERT OFF
  ticket += fontCmd;
  ticket += LF;

  if (data.cancelledBy) {
    ticket += `Por: ${processText(data.cancelledBy)}` + LF;
  }

  ticket += TEXT_NORMAL;
  ticket += DASHED_LINE(width);

  // Cancelled items header
  ticket += ALIGN_CENTER;
  ticket += TEXT_BOLD;
  ticket += fontCmd;
  ticket += 'ITENS CANCELADOS' + LF;
  ticket += TEXT_BOLD_OFF;
  ticket += TEXT_NORMAL;
  ticket += DASHED_LINE(width);

  // Items
  ticket += ALIGN_LEFT;
  for (const item of data.items) {
    ticket += fontCmd;
    // Strikethrough effect with dashes
    ticket += `${item.quantity}x ${processText(item.productName)}` + LF;

    if (item.variation) {
      ticket += `  > ${processText(item.variation)}` + LF;
    }

    if (item.extras && item.extras.length > 0) {
      for (const extra of item.extras) {
        ticket += `  ${processText(extra)}` + LF;
      }
    }

    if (item.notes) {
      ticket += `  OBS: ${processText(item.notes)}` + LF;
    }
  }

  // Footer
  ticket += TEXT_NORMAL;
  ticket += DASHED_LINE(width);
  ticket += ALIGN_CENTER;
  const cancelDate = new Date(data.cancelledAt);
  ticket += `Cancelado: ${cancelDate.toLocaleDateString('pt-BR')} ${cancelDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` + LF;
  ticket += `Impresso: ${new Date().toLocaleString('pt-BR')}` + LF;
  
  // Feed and cut
  ticket += FEED_LINES(bottomMargin);
  ticket += PAPER_CUT_PARTIAL;

  return ticket;
}

// ============ PARTIAL PAYMENT RECEIPT ============

export interface PartialPaymentReceiptData {
  orderTotal: number;
  paymentAmount: number;
  paymentMethod: 'cash' | 'credit_card' | 'debit_card' | 'pix';
  existingPayments: { payment_method: string; amount: number }[];
  tableNumber?: number;
  customerName?: string;
  orderId: string;
  coversTotal?: boolean;
  items?: { quantity: number; productName: string; variation?: string | null; extras?: string[]; totalPrice: number }[];
  // Restaurant info for header
  restaurantName?: string;
  restaurantAddress?: string;
  restaurantPhone?: string;
  restaurantCnpj?: string;
}

const partialPaymentMethodLabels: Record<string, string> = {
  cash: 'Dinheiro',
  credit_card: 'Credito',
  debit_card: 'Debito',
  pix: 'Pix',
};

export function buildPartialPaymentReceipt(
  data: PartialPaymentReceiptData,
  paperWidth: '58mm' | '80mm' = '80mm',
  fontSize: PrintFontSize = 'normal',
  lineSpacing: number = 0,
  leftMargin: number = 0,
  asciiMode: boolean = false,
  charSpacing: number = 1,
  topMargin: number = 0,
  bottomMargin: number = 4,
  skipRestaurantName: boolean = false,
  rightMargin: number = 0
): string {
  const baseWidth = paperWidth === '58mm' ? 32 : 48;
  const width = calculateEffectiveWidth(baseWidth, charSpacing, rightMargin);
  let receipt = '';
  const fontCmd = getFontSizeCommand(fontSize);
  const processText = (text: string) => asciiMode ? toAscii(text) : text;

  const previousTotal = data.existingPayments.reduce((sum, p) => sum + Number(p.amount), 0);
  const totalPaid = previousTotal + data.paymentAmount;
  const remainingAmount = data.orderTotal - totalPaid;

  // Initialize — skip INIT when logo is being prepended externally
  if (!skipRestaurantName) {
    receipt += INIT;
  }

  // Top margin
  if (topMargin > 0) {
    receipt += FEED_LINES(topMargin);
  }

  // Apply character spacing
  if (charSpacing > 0) {
    receipt += CHAR_SPACING_SET(charSpacing);
  }

  // Apply line spacing
  if (lineSpacing > 0) {
    receipt += LINE_SPACING_SET(lineSpacing);
  }

  // Apply left margin
  if (leftMargin > 0) {
    receipt += GS + 'L' + String.fromCharCode(leftMargin) + '\x00';
  }

  // Restaurant header (only if not skipping for logo)
  if (!skipRestaurantName && data.restaurantName) {
    receipt += ALIGN_CENTER;
    receipt += TEXT_BOLD;
    receipt += TEXT_DOUBLE_SIZE;
    receipt += processText(data.restaurantName.toUpperCase()) + LF;
    receipt += fontCmd;
    receipt += TEXT_BOLD_OFF;
    
    if (data.restaurantAddress) {
      receipt += processText(data.restaurantAddress) + LF;
    }
    if (data.restaurantPhone) {
      receipt += processText(data.restaurantPhone) + LF;
    }
    if (data.restaurantCnpj) {
      receipt += 'CNPJ: ' + processText(data.restaurantCnpj) + LF;
    }
    
    receipt += TEXT_NORMAL;
    receipt += DASHED_LINE(width);
  }

  // Determine if fully paid
  const isFullyPaid = data.coversTotal ?? (remainingAmount <= 0);

  // Header
  receipt += ALIGN_CENTER;
  receipt += TEXT_BOLD;
  receipt += TEXT_DOUBLE_SIZE;
  receipt += (isFullyPaid ? 'PAGAMENTO REALIZADO' : 'PAGAMENTO PARCIAL') + LF;
  receipt += fontCmd;
  receipt += TEXT_BOLD_OFF;
  receipt += 'Comprovante de Pagamento' + LF;
  receipt += TEXT_NORMAL;
  receipt += DASHED_LINE(width);

  // Order info
  receipt += ALIGN_LEFT;
  receipt += fontCmd;
  receipt += formatLine('Pedido:', `#${data.orderId.slice(0, 8).toUpperCase()}`, width);
  
  if (data.tableNumber) {
    receipt += formatLine('Mesa:', String(data.tableNumber), width);
  }
  
  if (data.customerName) {
    receipt += formatLine('Cliente:', processText(data.customerName), width);
  }
  
  receipt += formatLine('Data/Hora:', new Date().toLocaleString('pt-BR'), width);
  
  receipt += TEXT_NORMAL;
  receipt += DASHED_LINE(width);

  // Items section
  if (data.items && data.items.length > 0) {
    receipt += ALIGN_LEFT;
    receipt += fontCmd;
    receipt += TEXT_BOLD;
    receipt += 'ITENS' + LF;
    receipt += TEXT_BOLD_OFF;
    
    for (const item of data.items) {
      const itemLine = `${item.quantity}x ${processText(item.productName)}`;
      receipt += formatLine(itemLine, formatCurrency(item.totalPrice), width);
      
      if (item.variation) {
        receipt += `  ${processText(item.variation)}` + LF;
      }
      
      if (item.extras && item.extras.length > 0) {
        for (const extra of item.extras) {
          receipt += `  ${processText(extra)}` + LF;
        }
      }
    }
    
    receipt += TEXT_NORMAL;
    receipt += DASHED_LINE(width);
  }

  // Current payment - highlighted
  receipt += ALIGN_CENTER;
  receipt += TEXT_BOLD;
  receipt += fontCmd;
  receipt += 'PAGAMENTO REGISTRADO' + LF;
  receipt += TEXT_DOUBLE_SIZE;
  receipt += formatCurrency(data.paymentAmount) + LF;
  receipt += fontCmd;
  receipt += TEXT_BOLD_OFF;
  receipt += processText(partialPaymentMethodLabels[data.paymentMethod] || data.paymentMethod) + LF;
  
  receipt += TEXT_NORMAL;
  receipt += DASHED_LINE(width);

  // Previous payments if any
  if (data.existingPayments.length > 0) {
    receipt += ALIGN_LEFT;
    receipt += fontCmd;
    receipt += TEXT_BOLD;
    receipt += 'Pagamentos anteriores:' + LF;
    receipt += TEXT_BOLD_OFF;
    
    for (const p of data.existingPayments) {
      const label = processText(partialPaymentMethodLabels[p.payment_method] || p.payment_method);
      receipt += formatLine(label, formatCurrency(Number(p.amount)), width);
    }
    
    receipt += TEXT_NORMAL;
    receipt += DASHED_LINE(width);
  }

  // Summary
  receipt += ALIGN_LEFT;
  receipt += fontCmd;
  receipt += formatLine('Total da Conta:', formatCurrency(data.orderTotal), width);
  receipt += formatLine('Total Pago:', formatCurrency(totalPaid), width);
  
  receipt += TEXT_BOLD;
  if (remainingAmount <= 0) {
    receipt += TEXT_DOUBLE_HEIGHT;
    receipt += formatLine('STATUS:', 'PAGO', width);
  } else {
    receipt += formatLine('Falta Pagar:', formatCurrency(remainingAmount), width);
  }
  receipt += TEXT_BOLD_OFF;

  // Footer
  receipt += TEXT_NORMAL;
  receipt += DASHED_LINE(width);
  receipt += ALIGN_CENTER;
  receipt += fontCmd;
  if (isFullyPaid) {
    receipt += '*** Comprovante de pagamento ***' + LF;
  } else {
    receipt += '*** Comprovante de pagamento parcial ***' + LF;
    receipt += 'Mesa continua aberta' + LF;
  }

  // Feed and cut
  receipt += FEED_LINES(bottomMargin);
  receipt += PAPER_CUT_PARTIAL;

  return receipt;
}

// ============ Cash Closing Receipt ============

export interface CashClosingReceiptData {
  restaurantName: string;
  openedAt: string;
  closedAt: string;
  openingAmount: number;
  suppliesTotal: number;
  withdrawalsTotal: number;
  payments: {
    cash: number;
    credit_card: number;
    debit_card: number;
    pix: number;
  };
  expectedTotal: number;
  counted: {
    cash: number;
    credit_card: number;
    debit_card: number;
    pix: number;
  };
  countedTotal: number;
  difference: number;
  operatorName?: string;
}

export function buildCashClosingReceipt(
  data: CashClosingReceiptData,
  paperWidth: '58mm' | '80mm' = '80mm',
  fontSize: PrintFontSize = 'normal',
  lineSpacing: number = 0,
  leftMargin: number = 0,
  asciiMode: boolean = false,
  charSpacing: number = 1,
  topMargin: number = 0,
  bottomMargin: number = 4,
  rightMargin: number = 0
): string {
  const baseWidth = paperWidth === '58mm' ? 32 : 48;
  const width = calculateEffectiveWidth(baseWidth, charSpacing, rightMargin);

  const fontCmd = getFontSizeCommand(fontSize);
  const t = (text: string) => asciiMode ? toAscii(text) : text;

  let receipt = INIT;

  if (topMargin > 0) receipt += FEED_LINES(topMargin);
  if (leftMargin > 0) receipt += ESC + 'l' + String.fromCharCode(leftMargin);
  if (lineSpacing > 0) receipt += LINE_SPACING_SET(lineSpacing);
  if (charSpacing > 0) receipt += CHAR_SPACING_SET(charSpacing);

  receipt += fontCmd;

  // Header
  receipt += ALIGN_CENTER;
  receipt += TEXT_BOLD;
  receipt += SEPARATOR_LINE(width);
  receipt += t(centerText('FECHAMENTO DE CAIXA', width)) + LF;
  receipt += SEPARATOR_LINE(width);
  receipt += TEXT_BOLD_OFF;

  // Restaurant name
  receipt += t(centerText(data.restaurantName, width)) + LF;
  receipt += LF;

  // Dates
  receipt += ALIGN_LEFT;
  receipt += fontCmd;
  receipt += t(formatLine('Abertura:', data.openedAt, width));
  receipt += t(formatLine('Fechamento:', data.closedAt, width));
  if (data.operatorName) {
    receipt += t(formatLine('Operador:', data.operatorName, width));
  }
  receipt += DASHED_LINE(width);

  // Opening amount
  receipt += TEXT_BOLD;
  receipt += t(formatLine('SALDO DE ABERTURA', formatCurrency(data.openingAmount), width));
  receipt += TEXT_BOLD_OFF;
  receipt += fontCmd;
  receipt += DASHED_LINE(width);

  // Movements
  receipt += TEXT_BOLD;
  receipt += t('MOVIMENTACOES') + LF;
  receipt += TEXT_BOLD_OFF;
  receipt += fontCmd;
  receipt += t(formatLine('  Suprimentos', formatCurrency(data.suppliesTotal), width));
  receipt += t(formatLine('  Sangrias', '-' + formatCurrency(data.withdrawalsTotal), width));
  receipt += DASHED_LINE(width);

  // Payments received
  receipt += TEXT_BOLD;
  receipt += t('RECEBIMENTOS') + LF;
  receipt += TEXT_BOLD_OFF;
  receipt += fontCmd;
  receipt += t(formatLine('  Dinheiro', formatCurrency(data.payments.cash), width));
  receipt += t(formatLine('  Cartao Credito', formatCurrency(data.payments.credit_card), width));
  receipt += t(formatLine('  Cartao Debito', formatCurrency(data.payments.debit_card), width));
  receipt += t(formatLine('  PIX', formatCurrency(data.payments.pix), width));
  const totalReceived = data.payments.cash + data.payments.credit_card + data.payments.debit_card + data.payments.pix;
  receipt += TEXT_BOLD;
  receipt += t(formatLine('  Total Recebido', formatCurrency(totalReceived), width));
  receipt += TEXT_BOLD_OFF;
  receipt += fontCmd;
  receipt += DASHED_LINE(width);

  // Expected
  receipt += TEXT_BOLD;
  receipt += TEXT_DOUBLE_HEIGHT;
  receipt += t(formatLine('TOTAL ESPERADO', formatCurrency(data.expectedTotal), width));
  receipt += TEXT_BOLD_OFF;
  receipt += fontCmd;
  receipt += SEPARATOR_LINE(width);

  // Counted
  receipt += TEXT_BOLD;
  receipt += t('CONTAGEM') + LF;
  receipt += TEXT_BOLD_OFF;
  receipt += fontCmd;
  receipt += t(formatLine('  Dinheiro', formatCurrency(data.counted.cash), width));
  receipt += t(formatLine('  Cartao Credito', formatCurrency(data.counted.credit_card), width));
  receipt += t(formatLine('  Cartao Debito', formatCurrency(data.counted.debit_card), width));
  receipt += t(formatLine('  PIX', formatCurrency(data.counted.pix), width));
  receipt += TEXT_BOLD;
  receipt += TEXT_DOUBLE_HEIGHT;
  receipt += t(formatLine('TOTAL CONTADO', formatCurrency(data.countedTotal), width));
  receipt += TEXT_BOLD_OFF;
  receipt += fontCmd;
  receipt += SEPARATOR_LINE(width);

  // Difference
  receipt += TEXT_BOLD;
  receipt += TEXT_DOUBLE_HEIGHT;
  const diffStr = data.difference >= 0 ? formatCurrency(data.difference) : '-' + formatCurrency(Math.abs(data.difference));
  receipt += t(formatLine('DIFERENCA', diffStr, width));
  receipt += TEXT_BOLD_OFF;
  receipt += fontCmd;
  receipt += SEPARATOR_LINE(width);

  receipt += FEED_LINES(bottomMargin);
  receipt += PAPER_CUT_PARTIAL;

  return receipt;
}
