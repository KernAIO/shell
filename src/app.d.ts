import 'vite-plugin-pwa/svelte'
import 'vite-plugin-pwa/info'

declare global {
  namespace App {
    // interface Error {}
    // interface Locals {}
    // interface PageData {}
    // interface PageState {}
    // interface Platform {}
  }

  interface Navigator {
    setAppBadge?: (count?: number) => Promise<void>
    clearAppBadge?: () => Promise<void>
  }

  interface Window {
    /** Chromium PWA install prompt captured in root layout */
    deferredInstallPrompt?: Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> }
  }
}
