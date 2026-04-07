import { toast as sonnerToast, ExternalToast } from 'sonner';

// Flag to track if we're on mobile - will be set by the calling component
let isMobileDevice = false;

export function setMobileDevice(value: boolean) {
  isMobileDevice = value;
}

// Wrapper around sonner toast that only shows on desktop
export const mobileAwareToast = {
  success: (message: string | React.ReactNode, data?: ExternalToast) => {
    if (!isMobileDevice) {
      return sonnerToast.success(message, data);
    }
    return undefined;
  },
  error: (message: string | React.ReactNode, data?: ExternalToast) => {
    if (!isMobileDevice) {
      return sonnerToast.error(message, data);
    }
    return undefined;
  },
  warning: (message: string | React.ReactNode, data?: ExternalToast) => {
    if (!isMobileDevice) {
      return sonnerToast.warning(message, data);
    }
    return undefined;
  },
  info: (message: string | React.ReactNode, data?: ExternalToast) => {
    if (!isMobileDevice) {
      return sonnerToast.info(message, data);
    }
    return undefined;
  },
  message: (message: string | React.ReactNode, data?: ExternalToast) => {
    if (!isMobileDevice) {
      return sonnerToast.message(message, data);
    }
    return undefined;
  },
  // For cases where we always want to show the toast (critical errors, etc.)
  always: sonnerToast,
};
