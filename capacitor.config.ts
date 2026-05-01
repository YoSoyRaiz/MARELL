import type { CapacitorConfig } from '@capacitor/cli'

/**
 * Capacitor configuration. We use the "remote" mode where the native
 * shell loads the production marell.app deployment instead of bundling
 * the static export — this lets us keep server actions, RLS, and
 * Supabase auth flows exactly as they work on the web.
 *
 * Trade-off: the app needs internet to start. Acceptable for a
 * finance product where every screen is data-driven anyway.
 *
 * Native plugins still work (Camera, Push, Biometrics, etc.) because
 * the Capacitor JS bridge is injected into the WebView regardless of
 * whether the HTML comes from disk or marell.app.
 */
const config: CapacitorConfig = {
  appId: 'app.marell.mobile',
  appName: 'MARELL',
  webDir: 'public',
  server: {
    url: 'https://marell.app',
    cleartext: false,
    androidScheme: 'https',
    iosScheme: 'https',
    // Hostnames the WebView can reach. Anything else is intercepted
    // and opened in the system browser (Safari / Chrome).
    allowNavigation: [
      'marell.app',
      '*.marell.app',
      '*.supabase.co',
      'pagos.azul.com.do',
      'www.paypal.com',
      'www.sandbox.paypal.com',
    ],
  },
  ios: {
    contentInset: 'always',
    backgroundColor: '#0B0B0C',
    limitsNavigationsToAppBoundDomains: true,
  },
  android: {
    backgroundColor: '#0B0B0C',
    allowMixedContent: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: '#0B0B0C',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: true,
      spinnerColor: '#3DDC97',
      splashFullScreen: true,
      splashImmersive: true,
    },
    StatusBar: {
      // Match the dark theme; the web overlay handles its own bar
      // color when the WebView reports the layout.
      style: 'DARK',
      backgroundColor: '#0B0B0C',
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
    Camera: {
      // No-op here; per-call options are passed at .getPhoto() time.
    },
  },
}

export default config
