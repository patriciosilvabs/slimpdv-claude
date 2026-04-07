import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { client as apiClient } from '@/integrations/api/client';

export type PrintFontSize = 'normal' | 'large' | 'extra_large';
export type LogoPrintMode = 'original' | 'grayscale' | 'dithered';

interface OrderSettings {
  autoAccept: boolean;
  duplicateItems: boolean;
  duplicateItemsMaxQty: number;
  autoPrintKitchenTicket: boolean;
  autoPrintCustomerReceipt: boolean;
  kitchenFontSize: PrintFontSize;
  receiptFontSize: PrintFontSize;
  lineSpacing: number;
  leftMargin: number;
  rightMargin: number;
  restaurantName: string;
  restaurantAddress: string;
  restaurantPhone: string;
  restaurantCnpj: string;
  restaurantLogoUrl: string;
  duplicateKitchenTicket: boolean;
  asciiMode: boolean;
  charSpacing: number;
  topMargin: number;
  bottomMarginKitchen: number;
  bottomMarginReceipt: number;
  showItemNumber: boolean;
  showComplementPrice: boolean;
  showComplementName: boolean;
  largeFontProduction: boolean;
  multiplyOptions: boolean;
  showLogo: boolean;
  printCancellation: boolean;
  printRatingQr: boolean;
  printMessageStandard: string;
  printMessageTable: string;
  printQrStandard: string;
  printQrTable: string;
  logoMaxWidth: number;
  qrCodeSize: number;
  logoPrintMode: LogoPrintMode;
  hideComboQuantity: boolean;
  hideFlavorCategoryPrint: boolean;
  printIndividualItems: boolean;
}

const defaultSettings: OrderSettings = {
  autoAccept: true,
  duplicateItems: false,
  duplicateItemsMaxQty: 0,
  autoPrintKitchenTicket: true,
  autoPrintCustomerReceipt: true,
  kitchenFontSize: 'normal',
  receiptFontSize: 'normal',
  lineSpacing: 0,
  leftMargin: 0,
  rightMargin: 0,
  restaurantName: 'TOTAL',
  restaurantAddress: '',
  restaurantPhone: '',
  restaurantCnpj: '',
  restaurantLogoUrl: '',
  duplicateKitchenTicket: false,
  asciiMode: false,
  charSpacing: 1,
  topMargin: 0,
  bottomMarginKitchen: 3,
  bottomMarginReceipt: 4,
  showItemNumber: true,
  showComplementPrice: false,
  showComplementName: true,
  largeFontProduction: false,
  multiplyOptions: false,
  showLogo: true,
  printCancellation: true,
  printRatingQr: false,
  printMessageStandard: 'Obrigado pelo seu pedido!',
  printMessageTable: 'Obrigado pela preferência!',
  printQrStandard: '',
  printQrTable: '',
  logoMaxWidth: 300,
  qrCodeSize: 5,
  logoPrintMode: 'original',
  hideComboQuantity: true,
  hideFlavorCategoryPrint: false,
  printIndividualItems: false,
};

const SETTINGS_KEY = 'order_settings';

export function useOrderSettings() {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['order-settings'],
    queryFn: async () => {
      const token = localStorage.getItem('auth_token');
      if (!token) return { settings: defaultSettings };

      try {
        const response = await apiClient.get<{ value: Record<string, unknown> | null }>(`/settings/${SETTINGS_KEY}`);
        if (!response.value) return { settings: defaultSettings };

        const dbValue = response.value;
        const mergedSettings = { ...defaultSettings };
        for (const key of Object.keys(defaultSettings) as (keyof OrderSettings)[]) {
          if (key in dbValue) {
            (mergedSettings as any)[key] = dbValue[key];
          }
        }
        return { settings: mergedSettings };
      } catch (err) {
        console.warn('[useOrderSettings] API error, using defaults:', err);
        return { settings: defaultSettings };
      }
    },
    staleTime: 1000 * 60 * 5,
  });

  const updateMutation = useMutation({
    mutationFn: async (updates: Partial<OrderSettings>) => {
      const currentSettings = data?.settings ?? defaultSettings;
      const newSettings = { ...currentSettings, ...updates };
      await apiClient.put(`/settings/${SETTINGS_KEY}`, { value: newSettings });
      return newSettings;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order-settings'] });
    },
  });

  const settings = data?.settings ?? defaultSettings;

  useEffect(() => {
    if (!data?.settings) return;
    const s = data.settings;
    localStorage.setItem('pdv_restaurant_name', s.restaurantName);
    localStorage.setItem('pdv_restaurant_address', s.restaurantAddress);
    localStorage.setItem('pdv_restaurant_phone', s.restaurantPhone);
    localStorage.setItem('pdv_restaurant_cnpj', s.restaurantCnpj);
    localStorage.setItem('pdv_print_show_logo', String(s.showLogo));
    localStorage.setItem('pdv_restaurant_logo_url', s.restaurantLogoUrl);
    localStorage.setItem('pdv_logo_max_width', String(s.logoMaxWidth));
    localStorage.setItem('pdv_logo_print_mode', s.logoPrintMode);
    localStorage.setItem('pdv_kitchen_font_size', s.kitchenFontSize);
    localStorage.setItem('pdv_receipt_font_size', s.receiptFontSize);
    localStorage.setItem('pdv_line_spacing', String(s.lineSpacing));
    localStorage.setItem('pdv_left_margin', String(s.leftMargin));
    localStorage.setItem('pdv_right_margin', String(s.rightMargin));
    localStorage.setItem('pdv_char_spacing', String(s.charSpacing));
    localStorage.setItem('pdv_top_margin', String(s.topMargin));
    localStorage.setItem('pdv_bottom_margin_kitchen', String(s.bottomMarginKitchen));
    localStorage.setItem('pdv_bottom_margin_receipt', String(s.bottomMarginReceipt));
    localStorage.setItem('pdv_print_message_standard', s.printMessageStandard);
    localStorage.setItem('pdv_print_message_table', s.printMessageTable);
    localStorage.setItem('pdv_print_qr_standard', s.printQrStandard);
    localStorage.setItem('pdv_print_qr_table', s.printQrTable);
    localStorage.setItem('pdv_qr_code_size', String(s.qrCodeSize));
    localStorage.setItem('pdv_duplicate_items', String(s.duplicateItems));
    localStorage.setItem('pdv_duplicate_items_max_qty', String(s.duplicateItemsMaxQty));
    localStorage.setItem('pdv_auto_print_kitchen', String(s.autoPrintKitchenTicket));
    localStorage.setItem('pdv_auto_print_receipt', String(s.autoPrintCustomerReceipt));
    localStorage.setItem('pdv_duplicate_kitchen_ticket', String(s.duplicateKitchenTicket));
    localStorage.setItem('pdv_ascii_mode', String(s.asciiMode));
    localStorage.setItem('pdv_show_item_number', String(s.showItemNumber));
    localStorage.setItem('pdv_show_complement_price', String(s.showComplementPrice));
    localStorage.setItem('pdv_show_complement_name', String(s.showComplementName));
    localStorage.setItem('pdv_large_font_production', String(s.largeFontProduction));
    localStorage.setItem('pdv_multiply_options', String(s.multiplyOptions));
    localStorage.setItem('pdv_print_cancellation', String(s.printCancellation));
    localStorage.setItem('pdv_print_rating_qr', String(s.printRatingQr));
    localStorage.setItem('pdv_hide_combo_quantity', String(s.hideComboQuantity));
    localStorage.setItem('pdv_hide_flavor_category_print', String(s.hideFlavorCategoryPrint));
    localStorage.setItem('pdv_print_individual_items', String(s.printIndividualItems));
  }, [data?.settings]);

  const toggleAutoAccept = (value: boolean) => updateMutation.mutate({ autoAccept: value });
  const toggleDuplicateItems = (value: boolean) => updateMutation.mutate({ duplicateItems: value });
  const updateDuplicateItemsMaxQty = (value: number) => updateMutation.mutate({ duplicateItemsMaxQty: value });
  const toggleAutoPrintKitchenTicket = (value: boolean) => updateMutation.mutate({ autoPrintKitchenTicket: value });
  const toggleAutoPrintCustomerReceipt = (value: boolean) => updateMutation.mutate({ autoPrintCustomerReceipt: value });
  const toggleDuplicateKitchenTicket = (value: boolean) => updateMutation.mutate({ duplicateKitchenTicket: value });
  const toggleAsciiMode = (value: boolean) => updateMutation.mutate({ asciiMode: value });
  const toggleShowItemNumber = (value: boolean) => updateMutation.mutate({ showItemNumber: value });
  const toggleShowComplementPrice = (value: boolean) => updateMutation.mutate({ showComplementPrice: value });
  const toggleShowComplementName = (value: boolean) => updateMutation.mutate({ showComplementName: value });
  const toggleLargeFontProduction = (value: boolean) => updateMutation.mutate({ largeFontProduction: value });
  const toggleMultiplyOptions = (value: boolean) => updateMutation.mutate({ multiplyOptions: value });
  const toggleShowLogo = (value: boolean) => updateMutation.mutate({ showLogo: value });
  const togglePrintCancellation = (value: boolean) => updateMutation.mutate({ printCancellation: value });
  const togglePrintRatingQr = (value: boolean) => updateMutation.mutate({ printRatingQr: value });
  const toggleHideComboQuantity = (value: boolean) => updateMutation.mutate({ hideComboQuantity: value });
  const toggleHideFlavorCategoryPrint = (value: boolean) => updateMutation.mutate({ hideFlavorCategoryPrint: value });
  const togglePrintIndividualItems = (value: boolean) => updateMutation.mutate({ printIndividualItems: value });
  const updateKitchenFontSize = (value: PrintFontSize) => updateMutation.mutate({ kitchenFontSize: value });
  const updateReceiptFontSize = (value: PrintFontSize) => updateMutation.mutate({ receiptFontSize: value });
  const updateLineSpacing = (value: number) => updateMutation.mutate({ lineSpacing: value });
  const updateLeftMargin = (value: number) => updateMutation.mutate({ leftMargin: value });
  const updateRightMargin = (value: number) => updateMutation.mutate({ rightMargin: value });
  const updateRestaurantName = (value: string) => updateMutation.mutate({ restaurantName: value });
  const updateRestaurantAddress = (value: string) => updateMutation.mutate({ restaurantAddress: value });
  const updateRestaurantPhone = (value: string) => updateMutation.mutate({ restaurantPhone: value });
  const updateRestaurantCnpj = (value: string) => updateMutation.mutate({ restaurantCnpj: value });
  const updateRestaurantLogoUrl = (value: string) => updateMutation.mutate({ restaurantLogoUrl: value });
  const updateCharSpacing = (value: number) => updateMutation.mutate({ charSpacing: value });
  const updateTopMargin = (value: number) => updateMutation.mutate({ topMargin: value });
  const updateBottomMarginKitchen = (value: number) => updateMutation.mutate({ bottomMarginKitchen: value });
  const updateBottomMarginReceipt = (value: number) => updateMutation.mutate({ bottomMarginReceipt: value });
  const updatePrintMessageStandard = (value: string) => updateMutation.mutate({ printMessageStandard: value });
  const updatePrintMessageTable = (value: string) => updateMutation.mutate({ printMessageTable: value });
  const updatePrintQrStandard = (value: string) => updateMutation.mutate({ printQrStandard: value });
  const updatePrintQrTable = (value: string) => updateMutation.mutate({ printQrTable: value });
  const updateLogoMaxWidth = (value: number) => updateMutation.mutate({ logoMaxWidth: value });
  const updateQrCodeSize = (value: number) => updateMutation.mutate({ qrCodeSize: value });
  const updateLogoPrintMode = (value: LogoPrintMode) => updateMutation.mutate({ logoPrintMode: value });

  return {
    autoAccept: settings.autoAccept,
    duplicateItems: settings.duplicateItems,
    duplicateItemsMaxQty: settings.duplicateItemsMaxQty,
    autoPrintKitchenTicket: settings.autoPrintKitchenTicket,
    autoPrintCustomerReceipt: settings.autoPrintCustomerReceipt,
    kitchenFontSize: settings.kitchenFontSize,
    receiptFontSize: settings.receiptFontSize,
    lineSpacing: settings.lineSpacing,
    leftMargin: settings.leftMargin,
    rightMargin: settings.rightMargin,
    restaurantName: settings.restaurantName,
    restaurantAddress: settings.restaurantAddress,
    restaurantPhone: settings.restaurantPhone,
    restaurantCnpj: settings.restaurantCnpj,
    restaurantLogoUrl: settings.restaurantLogoUrl,
    duplicateKitchenTicket: settings.duplicateKitchenTicket,
    asciiMode: settings.asciiMode,
    charSpacing: settings.charSpacing,
    topMargin: settings.topMargin,
    bottomMarginKitchen: settings.bottomMarginKitchen,
    bottomMarginReceipt: settings.bottomMarginReceipt,
    showItemNumber: settings.showItemNumber,
    showComplementPrice: settings.showComplementPrice,
    showComplementName: settings.showComplementName,
    largeFontProduction: settings.largeFontProduction,
    multiplyOptions: settings.multiplyOptions,
    showLogo: settings.showLogo,
    printCancellation: settings.printCancellation,
    printRatingQr: settings.printRatingQr,
    printMessageStandard: settings.printMessageStandard,
    printMessageTable: settings.printMessageTable,
    printQrStandard: settings.printQrStandard,
    printQrTable: settings.printQrTable,
    logoMaxWidth: settings.logoMaxWidth,
    qrCodeSize: settings.qrCodeSize,
    logoPrintMode: settings.logoPrintMode,
    hideComboQuantity: settings.hideComboQuantity,
    hideFlavorCategoryPrint: settings.hideFlavorCategoryPrint,
    printIndividualItems: settings.printIndividualItems,
    isLoading,
    isSaving: updateMutation.isPending,
    toggleAutoAccept, toggleDuplicateItems, updateDuplicateItemsMaxQty, toggleAutoPrintKitchenTicket,
    toggleAutoPrintCustomerReceipt, toggleDuplicateKitchenTicket, toggleAsciiMode,
    toggleShowItemNumber, toggleShowComplementPrice, toggleShowComplementName,
    toggleLargeFontProduction, toggleMultiplyOptions, toggleShowLogo,
    togglePrintCancellation, togglePrintRatingQr, toggleHideComboQuantity,
    toggleHideFlavorCategoryPrint, togglePrintIndividualItems,
    updateKitchenFontSize, updateReceiptFontSize, updateLineSpacing,
    updateLeftMargin, updateRightMargin, updateRestaurantName, updateRestaurantAddress,
    updateRestaurantPhone, updateRestaurantCnpj, updateRestaurantLogoUrl,
    updateCharSpacing, updateTopMargin, updateBottomMarginKitchen, updateBottomMarginReceipt,
    updatePrintMessageStandard, updatePrintMessageTable, updatePrintQrStandard,
    updatePrintQrTable, updateLogoMaxWidth, updateQrCodeSize, updateLogoPrintMode,
  };
}
