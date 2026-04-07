// PrinterContext - Provides printer functionality throughout the app (SlimPrint only)
import React, { createContext, useContext, ReactNode, useCallback, useMemo, useEffect } from 'react';
import { useQzTray, PrinterConfig, PrintDataItem, ConnectionStatus } from '@/hooks/useQzTray';
import { useSlimPrint } from '@/hooks/useSlimPrint';

import { 
  buildKitchenTicket, 
  buildCustomerReceipt, 
  buildCashDrawerCommand,
  buildCancellationTicket,
  buildPartialPaymentReceipt,
  buildCashClosingReceipt,
  KitchenTicketData,
  CustomerReceiptData,
  CancellationTicketData,
  PartialPaymentReceiptData,
  CashClosingReceiptData,
  PrintFontSize,
  INIT,
  ALIGN_CENTER,
  LF
} from '@/utils/escpos';

import { PrintSector } from '@/hooks/usePrintSectors';
import { imageUrlToBase64Cached, resizeImage, convertToGrayscale, convertToDithered } from '@/utils/imageToBase64';
import { imageToEscPosRaster } from '@/utils/escposImage';

// Interface for items with sector info for sector-based printing
export interface SectorPrintItem {
  quantity: number;
  productName: string;
  variation?: string | null;
  extras?: string[];
  notes?: string | null;
  print_sector_id?: string | null;
  fulfillment_type?: string | null;
}

interface PrinterContextValue {
  // Connection state
  isConnected: boolean;
  isConnecting: boolean;
  connectionStatus: ConnectionStatus;
  error: string | null;
  
  // Available printers
  printers: string[];
  
  // Configuration
  config: PrinterConfig;
  updateConfig: (updates: Partial<PrinterConfig>) => void;
  
  // Connection methods
  connect: (force?: boolean) => Promise<boolean>;
  disconnect: () => Promise<void>;
  refreshPrinters: () => Promise<string[]>;
  
  // High-level print methods
  printKitchenTicket: (data: KitchenTicketData) => Promise<boolean>;
  printKitchenTicketsBySector: (
    items: SectorPrintItem[],
    orderInfo: Omit<KitchenTicketData, 'items'>,
    sectors: PrintSector[],
    duplicate?: boolean
  ) => Promise<boolean>;
  printCustomerReceipt: (data: CustomerReceiptData) => Promise<boolean>;
  printPartialPaymentReceipt: (data: PartialPaymentReceiptData) => Promise<boolean>;
  printCancellationTicket: (data: CancellationTicketData) => Promise<boolean>;
  printCashClosingReceipt: (data: CashClosingReceiptData) => Promise<boolean>;
  openCashDrawer: () => Promise<boolean>;
  testPrint: (printerName: string) => Promise<boolean>;
  
  // SlimPrint protocol methods
  ping: () => Promise<boolean>;
  printTestEscpos: (printerName: string) => Promise<boolean>;
  printTestZpl: (printerName: string) => Promise<boolean>;
  getStatus: () => Promise<Record<string, unknown> | null>;
  
  // Low-level print
  print: (printerName: string | null, data: string, isRaw?: boolean) => Promise<boolean>;
  
  // Utility
  canPrintToKitchen: boolean;
  canPrintToCashier: boolean;
}

const PrinterContext = createContext<PrinterContextValue | null>(null);

export function PrinterProvider({ children }: { children: ReactNode }) {
  const { config, updateConfig, isLoadingConfig } = useQzTray();
  const slimPrint = useSlimPrint({
    url: config.slimprintUrl || 'wss://127.0.0.1:9415',
    token: config.slimprintToken || '123321',
    autoConnect: false,
  });

  // Auto-connect on mount when auth token exists and config is loaded
  useEffect(() => {
    if (!config.autoConnectOnLogin) return;
    if (isLoadingConfig) return;

    const token = localStorage.getItem('auth_token');
    if (!token) return;

    if (slimPrint.isConnected || slimPrint.isConnecting) return;

    const timer = setTimeout(() => {
      slimPrint.connect().catch(console.error);
    }, 800);

    return () => clearTimeout(timer);
  }, [config.autoConnectOnLogin, isLoadingConfig]); // eslint-disable-line react-hooks/exhaustive-deps

  const printKitchenTicket = useCallback(async (data: KitchenTicketData): Promise<boolean> => {
    if (!config.kitchenPrinter) {
      console.warn('No kitchen printer configured');
      return false;
    }

    try {
      const currentKitchenFontSize = (localStorage.getItem('pdv_kitchen_font_size') as PrintFontSize) || 'normal';
      const currentLineSpacing = parseInt(localStorage.getItem('pdv_line_spacing') || '0');
      const currentLeftMargin = parseInt(localStorage.getItem('pdv_left_margin') || '0');
      const currentRightMargin = parseInt(localStorage.getItem('pdv_right_margin') || '0');
      const currentAsciiMode = localStorage.getItem('pdv_ascii_mode') === 'true';
      const currentCharSpacing = parseInt(localStorage.getItem('pdv_char_spacing') || '1');
      const currentTopMargin = parseInt(localStorage.getItem('pdv_top_margin') || '0');
      const currentBottomMarginKitchen = parseInt(localStorage.getItem('pdv_bottom_margin_kitchen') || '3');
      
      const showItemNumber = localStorage.getItem('pdv_show_item_number') !== 'false';
      const showComplementPrice = localStorage.getItem('pdv_show_complement_price') === 'true';
      const showComplementName = localStorage.getItem('pdv_show_complement_name') !== 'false';
      const largeFontProduction = localStorage.getItem('pdv_large_font_production') === 'true';
      const hideComboQuantity = localStorage.getItem('pdv_hide_combo_quantity') !== 'false';
      const hideFlavorCategory = localStorage.getItem('pdv_hide_flavor_category_print') === 'true';
      
      const ticketData = buildKitchenTicket(
        data, 
        config.paperWidth, 
        currentKitchenFontSize, 
        currentLineSpacing, 
        currentLeftMargin, 
        currentAsciiMode, 
        currentCharSpacing, 
        currentTopMargin, 
        currentBottomMarginKitchen,
        {
          showItemNumber,
          showComplementPrice,
          showComplementName,
          largeFontProduction,
          hideComboQuantity,
          hideFlavorCategory
        },
        currentRightMargin
      );
      await slimPrint.print(config.kitchenPrinter, ticketData);
      return true;
    } catch (err) {
      console.error('Failed to print kitchen ticket:', err);
      return false;
    }
  }, [config, slimPrint]);

  const printKitchenTicketsBySector = useCallback(async (
    items: SectorPrintItem[],
    orderInfo: Omit<KitchenTicketData, 'items'>,
    sectors: PrintSector[],
    duplicate: boolean = false
  ): Promise<boolean> => {
    try {
      const currentKitchenFontSize = (localStorage.getItem('pdv_kitchen_font_size') as PrintFontSize) || 'normal';
      const currentLineSpacing = parseInt(localStorage.getItem('pdv_line_spacing') || '0');
      const currentLeftMargin = parseInt(localStorage.getItem('pdv_left_margin') || '0');
      const currentRightMargin = parseInt(localStorage.getItem('pdv_right_margin') || '0');
      const currentAsciiMode = localStorage.getItem('pdv_ascii_mode') === 'true';
      const currentCharSpacing = parseInt(localStorage.getItem('pdv_char_spacing') || '1');
      const currentTopMargin = parseInt(localStorage.getItem('pdv_top_margin') || '0');
      const currentBottomMarginKitchen = parseInt(localStorage.getItem('pdv_bottom_margin_kitchen') || '3');
      
      const showItemNumber = localStorage.getItem('pdv_show_item_number') !== 'false';
      const showComplementPrice = localStorage.getItem('pdv_show_complement_price') === 'true';
      const showComplementName = localStorage.getItem('pdv_show_complement_name') !== 'false';
      const largeFontProduction = localStorage.getItem('pdv_large_font_production') === 'true';
      const hideComboQuantity = localStorage.getItem('pdv_hide_combo_quantity') !== 'false';
      const hideFlavorCategory = localStorage.getItem('pdv_hide_flavor_category_print') === 'true';

      const itemsBySector: Record<string, SectorPrintItem[]> = {};
      const defaultSectorId = '_default';

      for (const item of items) {
        const sectorId = item.print_sector_id || defaultSectorId;
        if (!itemsBySector[sectorId]) {
          itemsBySector[sectorId] = [];
        }
        itemsBySector[sectorId].push(item);
      }

      const printIndividualItems = localStorage.getItem('pdv_print_individual_items') === 'true';

      for (const [sectorId, sectorItems] of Object.entries(itemsBySector)) {
        let printerName: string | null = null;
        let sectorName: string | undefined = undefined;

        if (sectorId === defaultSectorId) {
          printerName = config.kitchenPrinter;
          sectorName = undefined;
        } else {
          const sector = sectors.find(s => s.id === sectorId);
          if (sector) {
            printerName = sector.printer_name || config.kitchenPrinter;
            sectorName = sector.name;
          } else {
            printerName = config.kitchenPrinter;
          }
        }

        if (!printerName) {
          console.warn(`No printer for sector ${sectorId}, skipping`);
          continue;
        }

        const buildOpts = {
          showItemNumber,
          showComplementPrice,
          showComplementName,
          largeFontProduction,
          hideComboQuantity,
          hideFlavorCategory
        };

        const mapItem = (item: SectorPrintItem) => ({
          quantity: item.quantity,
          productName: item.productName,
          variation: item.variation,
          extras: item.extras,
          notes: item.notes,
          fulfillment_type: item.fulfillment_type,
        });

        // If printIndividualItems is enabled, print each item as a separate ticket
        const itemGroups = printIndividualItems
          ? sectorItems.map(item => [item])
          : [sectorItems];

        for (const group of itemGroups) {
          const ticketData: KitchenTicketData = {
            ...orderInfo,
            sectorName,
            items: group.map(mapItem),
          };

          const printData = buildKitchenTicket(
            ticketData, 
            config.paperWidth, 
            currentKitchenFontSize, 
            currentLineSpacing, 
            currentLeftMargin,
            currentAsciiMode,
            currentCharSpacing,
            currentTopMargin,
            currentBottomMarginKitchen,
            buildOpts,
            currentRightMargin
          );

          await slimPrint.print(printerName, printData);

          if (duplicate) {
            await slimPrint.print(printerName, printData);
          }
        }
      }

      return true;
    } catch (err) {
      console.error('Failed to print kitchen tickets by sector:', err);
      return false;
    }
  }, [config, slimPrint]);

  const printCustomerReceipt = useCallback(async (data: CustomerReceiptData): Promise<boolean> => {
    if (!config.cashierPrinter) {
      console.warn('No cashier printer configured');
      return false;
    }

    try {
      const currentReceiptFontSize = (localStorage.getItem('pdv_receipt_font_size') as PrintFontSize) || 'normal';
      const currentLineSpacing = parseInt(localStorage.getItem('pdv_line_spacing') || '0');
      const currentLeftMargin = parseInt(localStorage.getItem('pdv_left_margin') || '0');
      const currentRightMargin = parseInt(localStorage.getItem('pdv_right_margin') || '0');
      const currentRestaurantName = localStorage.getItem('pdv_restaurant_name') || 'Minha Pizzaria';
      const currentRestaurantAddress = localStorage.getItem('pdv_restaurant_address') || '';
      const currentRestaurantPhone = localStorage.getItem('pdv_restaurant_phone') || '';
      const currentRestaurantCnpj = localStorage.getItem('pdv_restaurant_cnpj') || '';
      const currentAsciiMode = localStorage.getItem('pdv_ascii_mode') === 'true';
      const currentCharSpacing = parseInt(localStorage.getItem('pdv_char_spacing') || '1');
      const currentTopMargin = parseInt(localStorage.getItem('pdv_top_margin') || '0');
      const currentBottomMarginReceipt = parseInt(localStorage.getItem('pdv_bottom_margin_receipt') || '4');
      
      const showLogo = localStorage.getItem('pdv_print_show_logo') === 'true';
      const logoUrl = localStorage.getItem('pdv_restaurant_logo_url') || '';
      const logoMaxWidth = parseInt(localStorage.getItem('pdv_logo_max_width') || '300');
      
      const isTableOrder = data.orderType === 'dine_in';
      const customMessage = isTableOrder 
        ? localStorage.getItem('pdv_print_message_table') || 'Obrigado pela preferência!'
        : localStorage.getItem('pdv_print_message_standard') || 'Obrigado pelo seu pedido!';
      const qrCodeContent = isTableOrder
        ? localStorage.getItem('pdv_print_qr_table') || ''
        : localStorage.getItem('pdv_print_qr_standard') || '';
      const qrCodeSize = parseInt(localStorage.getItem('pdv_qr_code_size') || '5');
      
      const shouldPrintLogo = showLogo && !!logoUrl;
      
      const enrichedData: CustomerReceiptData = {
        ...data,
        restaurantName: currentRestaurantName,
        restaurantAddress: currentRestaurantAddress || undefined,
        restaurantPhone: currentRestaurantPhone || undefined,
        restaurantCnpj: currentRestaurantCnpj || undefined,
        customMessage: customMessage || undefined,
        qrCodeContent: qrCodeContent || undefined,
        qrCodeSize,
      };
      
      const receiptData = buildCustomerReceipt(
        enrichedData, 
        config.paperWidth, 
        currentReceiptFontSize, 
        currentLineSpacing, 
        currentLeftMargin, 
        currentAsciiMode, 
        currentCharSpacing, 
        currentTopMargin, 
        currentBottomMarginReceipt,
        shouldPrintLogo,
        currentRightMargin
      );
      
      if (shouldPrintLogo) {
        try {
          const logoBase64 = await imageUrlToBase64Cached(logoUrl);
          
          if (logoBase64) {
            let processedLogo = await resizeImage(logoBase64, logoMaxWidth);
            
            const currentLogoPrintMode = localStorage.getItem('pdv_logo_print_mode') || 'original';
            if (currentLogoPrintMode === 'grayscale') {
              processedLogo = await convertToGrayscale(processedLogo);
            } else if (currentLogoPrintMode === 'dithered') {
              processedLogo = await convertToDithered(processedLogo);
            }
            
            const rasterData = await imageToEscPosRaster(processedLogo, logoMaxWidth);
            
            if (rasterData) {
              // Send logo + receipt as single raw string
              const fullPayload = INIT + ALIGN_CENTER + rasterData + LF + LF + receiptData;
              await slimPrint.print(config.cashierPrinter, fullPayload);
              return true;
            }
          }
        } catch (logoErr) {
          console.warn('[PrinterContext] Logo conversion failed, printing without logo:', logoErr);
        }
      }
      
      await slimPrint.print(config.cashierPrinter, receiptData);
      return true;
    } catch (err) {
      console.error('Failed to print customer receipt:', err);
      return false;
    }
  }, [config, slimPrint]);

  const printCancellationTicket = useCallback(async (data: CancellationTicketData): Promise<boolean> => {
    if (!config.kitchenPrinter) {
      console.warn('No kitchen printer configured for cancellation ticket');
      return false;
    }

    try {
      const currentKitchenFontSize = (localStorage.getItem('pdv_kitchen_font_size') as PrintFontSize) || 'normal';
      const currentLineSpacing = parseInt(localStorage.getItem('pdv_line_spacing') || '0');
      const currentLeftMargin = parseInt(localStorage.getItem('pdv_left_margin') || '0');
      const currentRightMargin = parseInt(localStorage.getItem('pdv_right_margin') || '0');
      const currentAsciiMode = localStorage.getItem('pdv_ascii_mode') === 'true';
      const currentCharSpacing = parseInt(localStorage.getItem('pdv_char_spacing') || '1');
      const currentTopMargin = parseInt(localStorage.getItem('pdv_top_margin') || '0');
      const currentBottomMarginKitchen = parseInt(localStorage.getItem('pdv_bottom_margin_kitchen') || '3');
      
      const ticketData = buildCancellationTicket(
        data, 
        config.paperWidth, 
        currentKitchenFontSize, 
        currentLineSpacing, 
        currentLeftMargin, 
        currentAsciiMode, 
        currentCharSpacing, 
        currentTopMargin, 
        currentBottomMarginKitchen,
        currentRightMargin
      );
      await slimPrint.print(config.kitchenPrinter, ticketData);
      return true;
    } catch (err) {
      console.error('Failed to print cancellation ticket:', err);
      return false;
    }
  }, [config, slimPrint]);

  const printPartialPaymentReceipt = useCallback(async (data: PartialPaymentReceiptData): Promise<boolean> => {
    if (!config.cashierPrinter) {
      console.warn('No cashier printer configured');
      return false;
    }

    try {
      const currentReceiptFontSize = (localStorage.getItem('pdv_receipt_font_size') as PrintFontSize) || 'normal';
      const currentLineSpacing = parseInt(localStorage.getItem('pdv_line_spacing') || '0');
      const currentLeftMargin = parseInt(localStorage.getItem('pdv_left_margin') || '0');
      const currentRightMargin = parseInt(localStorage.getItem('pdv_right_margin') || '0');
      const currentAsciiMode = localStorage.getItem('pdv_ascii_mode') === 'true';
      const currentCharSpacing = parseInt(localStorage.getItem('pdv_char_spacing') || '1');
      const currentTopMargin = parseInt(localStorage.getItem('pdv_top_margin') || '0');
      const currentBottomMarginReceipt = parseInt(localStorage.getItem('pdv_bottom_margin_receipt') || '4');
      
      const currentRestaurantName = localStorage.getItem('pdv_restaurant_name') || 'Minha Pizzaria';
      const currentRestaurantAddress = localStorage.getItem('pdv_restaurant_address') || '';
      const currentRestaurantPhone = localStorage.getItem('pdv_restaurant_phone') || '';
      const currentRestaurantCnpj = localStorage.getItem('pdv_restaurant_cnpj') || '';
      
      const showLogo = localStorage.getItem('pdv_print_show_logo') === 'true';
      const logoUrl = localStorage.getItem('pdv_restaurant_logo_url') || '';
      const logoMaxWidth = parseInt(localStorage.getItem('pdv_logo_max_width') || '300');
      
      const shouldPrintLogo = showLogo && !!logoUrl;
      
      const enrichedData: PartialPaymentReceiptData = {
        ...data,
        restaurantName: currentRestaurantName,
        restaurantAddress: currentRestaurantAddress || undefined,
        restaurantPhone: currentRestaurantPhone || undefined,
        restaurantCnpj: currentRestaurantCnpj || undefined,
      };
      
      const receiptData = buildPartialPaymentReceipt(
        enrichedData,
        config.paperWidth,
        currentReceiptFontSize,
        currentLineSpacing,
        currentLeftMargin,
        currentAsciiMode,
        currentCharSpacing,
        currentTopMargin,
        currentBottomMarginReceipt,
        shouldPrintLogo,
        currentRightMargin
      );
      
      if (shouldPrintLogo) {
        try {
          const logoBase64 = await imageUrlToBase64Cached(logoUrl);
          
          if (logoBase64) {
            let processedLogo = await resizeImage(logoBase64, logoMaxWidth);
            
            const currentLogoPrintMode = localStorage.getItem('pdv_logo_print_mode') || 'original';
            if (currentLogoPrintMode === 'grayscale') {
              processedLogo = await convertToGrayscale(processedLogo);
            } else if (currentLogoPrintMode === 'dithered') {
              processedLogo = await convertToDithered(processedLogo);
            }
            
            const rasterData = await imageToEscPosRaster(processedLogo, logoMaxWidth);
            
            if (rasterData) {
              const fullPayload = INIT + ALIGN_CENTER + rasterData + LF + LF + receiptData;
              await slimPrint.print(config.cashierPrinter, fullPayload);
              return true;
            }
          }
        } catch (logoErr) {
          console.warn('[PrinterContext] Logo conversion failed, printing without logo:', logoErr);
        }
      }
      
      await slimPrint.print(config.cashierPrinter, receiptData);
      return true;
    } catch (err) {
      console.error('Failed to print partial payment receipt:', err);
      return false;
    }
  }, [config, slimPrint]);

  const printCashClosingReceipt = useCallback(async (data: CashClosingReceiptData): Promise<boolean> => {
    if (!config.cashierPrinter) {
      console.warn('No cashier printer configured');
      return false;
    }

    try {
      const currentReceiptFontSize = (localStorage.getItem('pdv_receipt_font_size') as PrintFontSize) || 'normal';
      const currentLineSpacing = parseInt(localStorage.getItem('pdv_line_spacing') || '0');
      const currentLeftMargin = parseInt(localStorage.getItem('pdv_left_margin') || '0');
      const currentRightMargin = parseInt(localStorage.getItem('pdv_right_margin') || '0');
      const currentAsciiMode = localStorage.getItem('pdv_ascii_mode') === 'true';
      const currentCharSpacing = parseInt(localStorage.getItem('pdv_char_spacing') || '1');
      const currentTopMargin = parseInt(localStorage.getItem('pdv_top_margin') || '0');
      const currentBottomMarginReceipt = parseInt(localStorage.getItem('pdv_bottom_margin_receipt') || '4');

      const receiptData = buildCashClosingReceipt(
        data,
        config.paperWidth,
        currentReceiptFontSize,
        currentLineSpacing,
        currentLeftMargin,
        currentAsciiMode,
        currentCharSpacing,
        currentTopMargin,
        currentBottomMarginReceipt,
        currentRightMargin
      );

      await slimPrint.print(config.cashierPrinter, receiptData);
      return true;
    } catch (err) {
      console.error('Failed to print cash closing receipt:', err);
      return false;
    }
  }, [config, slimPrint]);

  const openCashDrawer = useCallback(async (): Promise<boolean> => {
    if (!config.cashierPrinter) {
      console.warn('No cashier printer configured');
      return false;
    }

    try {
      const command = buildCashDrawerCommand();
      await slimPrint.print(config.cashierPrinter, command);
      return true;
    } catch (err) {
      console.error('Failed to open cash drawer:', err);
      return false;
    }
  }, [config, slimPrint]);

  const pingWrapped = useCallback(async (): Promise<boolean> => {
    return slimPrint.ping();
  }, [slimPrint]);

  const printTestEscpos = useCallback(async (printerName: string): Promise<boolean> => {
    return slimPrint.printTest('escpos', printerName);
  }, [slimPrint]);

  const printTestZpl = useCallback(async (printerName: string): Promise<boolean> => {
    return slimPrint.printTest('zpl', printerName);
  }, [slimPrint]);

  const getStatusWrapped = useCallback(async (): Promise<Record<string, unknown> | null> => {
    return slimPrint.getStatus();
  }, [slimPrint]);

  const value = useMemo<PrinterContextValue>(() => ({
    isConnected: slimPrint.isConnected,
    isConnecting: slimPrint.isConnecting,
    connectionStatus: slimPrint.connectionStatus,
    error: slimPrint.error,
    printers: slimPrint.printers,
    config,
    updateConfig,
    connect: slimPrint.connect,
    disconnect: slimPrint.disconnect,
    refreshPrinters: slimPrint.refreshPrinters,
    printKitchenTicket,
    printKitchenTicketsBySector,
    printCustomerReceipt,
    printPartialPaymentReceipt,
    printCancellationTicket,
    printCashClosingReceipt,
    openCashDrawer,
    testPrint: slimPrint.testPrint,
    ping: pingWrapped,
    printTestEscpos,
    printTestZpl,
    getStatus: getStatusWrapped,
    print: slimPrint.print,
    canPrintToKitchen: slimPrint.isConnected && !!config.kitchenPrinter,
    canPrintToCashier: slimPrint.isConnected && !!config.cashierPrinter,
  }), [config, updateConfig, slimPrint, printKitchenTicket, printKitchenTicketsBySector, printCustomerReceipt, printPartialPaymentReceipt, printCancellationTicket, printCashClosingReceipt, openCashDrawer, pingWrapped, printTestEscpos, printTestZpl, getStatusWrapped]);

  return (
    <PrinterContext.Provider value={value}>
      {children}
    </PrinterContext.Provider>
  );
}

export function usePrinter() {
  const context = useContext(PrinterContext);
  if (!context) {
    throw new Error('usePrinter must be used within a PrinterProvider');
  }
  return context;
}

// Hook for optional printer access (doesn't throw if not in provider)
export function usePrinterOptional() {
  return useContext(PrinterContext);
}
