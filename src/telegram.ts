/**
 * Telegram Mini App integration.
 * When opened in Telegram, expands to full height and applies theme.
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
        isExpanded: boolean;
        platform: string;
      };
    };
  }
}

export const isTelegram = (): boolean =>
  typeof window !== "undefined" && !!window.Telegram?.WebApp;

export function initTelegram() {
  if (!isTelegram()) return;
  const tg = window.Telegram!.WebApp;
  tg.ready();
  tg.expand();
  tg.setHeaderColor("#003366");
  tg.setBackgroundColor("#F4F5F7");
}
