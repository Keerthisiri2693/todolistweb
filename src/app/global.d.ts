export { };

declare global {
  interface Window {
    desktopInfo?: {
      isDesktop: boolean;
      platform: string;
      appName: string;
    };

    electronShare?: {
      openApp: (
        app: "whatsapp" | "gmail" | "outlook" | "telegram",
        text: string,
      ) => Promise<{
        success: boolean;
        app?: string;
      }>;

      copyText: (text: string) => Promise<{
        success: boolean;
      }>;
    };
  }
}
