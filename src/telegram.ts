/**
 * Telegram Mini App integration.
 * When opened in Telegram, expands to full height and applies theme.
 * Парсит ref из URL (?ref=ref_123) для реферальной системы.
 */

declare global {
  interface Window {
    Telegram?: {
      WebApp: {
        ready: () => void;
        expand: () => void;
        close: () => void;
        enableClosingConfirmation: () => void;
        disableClosingConfirmation: () => void;
        setHeaderColor: (color: string) => void;
        setBackgroundColor: (color: string) => void;
        themeParams: { bg_color?: string; text_color?: string };
        initDataUnsafe?: { start_param?: string };
        isExpanded: boolean;
        platform: string;
      };
    };
  }
}

export const isTelegram = (): boolean =>
  typeof window !== "undefined" && !!window.Telegram?.WebApp;

export function getLaunchRef(): string | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  const ref = params.get("ref");
  if (ref && /^ref_[\w-]+$/.test(ref)) return ref;
  const tg = window.Telegram?.WebApp;
  const startParam = (tg as any)?.initDataUnsafe?.start_param;
  if (startParam && startParam.startsWith("ref_")) return startParam;
  return null;
}

export function initTelegram() {
  if (!isTelegram()) return;
  const tg = window.Telegram!.WebApp;
  tg.ready();
  tg.expand();
  tg.setHeaderColor("#003366");
  tg.setBackgroundColor("#F4F5F7");
}
