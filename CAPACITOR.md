# Guía de configuración Capacitor (iOS + Android)

Este archivo documenta los pasos manuales que necesitas correr **una vez**
en tu máquina local para generar los proyectos nativos de iOS y Android.
El código JS / TS ya está listo; sólo falta inicializar los shells.

---

## 0. Prerrequisitos

| Plataforma | Necesitas |
|---|---|
| iOS | macOS con **Xcode 15+** instalado, **CocoaPods** (`sudo gem install cocoapods`), una **Apple Developer Account** activa ($99/año) |
| Android | **Android Studio** (Hedgehog 2023.1.1+), **JDK 17**, una **Google Play Console** ($25 una vez) |
| Ambos | Node 20+ + `npm install` corrido al menos una vez en este repo |

---

## 1. Instalar dependencias

```bash
npm install
```

Esto descarga `@capacitor/core`, `@capacitor/ios`, `@capacitor/android` y los
plugins (`Camera`, `PushNotifications`, `SplashScreen`, etc.) que ya están
en `package.json`.

---

## 2. Inicializar las plataformas nativas

```bash
npx cap add ios
npx cap add android
```

Esto crea las carpetas `ios/` y `android/` en la raíz del repo. Capacitor
las inicializa con la configuración de `capacitor.config.ts` (appId, appName,
splash, etc.). **Estas carpetas se commitean al repo** — son el código
fuente de las apps nativas.

---

## 3. Sincronizar el bundle web

```bash
npm run cap:sync
```

(Equivalente a `next build && npx cap sync`.) Copia el bundle de Next.js
a las carpetas nativas y actualiza los plugins.

> **Nota**: con la config "remote" (`server.url: https://marell.app`),
> Capacitor sirve `marell.app` directamente desde la WebView. El bundle
> local funciona como fallback offline.

---

## 4. Abrir en Xcode (iOS)

```bash
npm run cap:ios
```

Esto abre Xcode con el proyecto `ios/App/App.xcworkspace`.

### Configuración una vez en Xcode:

1. Selecciona el proyecto **App** en el panel izquierdo
2. Tab **Signing & Capabilities** → **Team** → tu Apple Developer Team
3. **Bundle Identifier**: `app.marell.mobile` (debe coincidir con `capacitor.config.ts`)
4. Click **+ Capability** → agrega:
   - **Push Notifications**
   - **Background Modes** → marca "Remote notifications"
   - **Camera** ya viene del plugin

5. **Info.plist** → Click derecho → Open as Source → agrega estas claves:
   ```xml
   <key>NSCameraUsageDescription</key>
   <string>MARELL usa la cámara para tomar fotos de tus recibos.</string>
   <key>NSPhotoLibraryUsageDescription</key>
   <string>MARELL accede a tu galería para adjuntar recibos a tus transacciones.</string>
   ```

### Para probar en simulador / dispositivo:

- Selecciona dispositivo en el dropdown superior
- Click el botón ▶ (Play)

---

## 5. Abrir en Android Studio

```bash
npm run cap:android
```

Esto abre Android Studio con la carpeta `android/`.

### Configuración una vez en Android Studio:

1. Espera a que Gradle sincronice (botón "Sync Now" si aparece)
2. Abre `android/app/src/main/AndroidManifest.xml` y verifica que diga:
   ```xml
   <uses-permission android:name="android.permission.CAMERA" />
   <uses-permission android:name="android.permission.INTERNET" />
   ```
3. Para Push Notifications (Firebase Cloud Messaging):
   - Crea un proyecto en https://console.firebase.google.com
   - Agrega tu Android app con el package name `app.marell.mobile`
   - Descarga `google-services.json` y ponlo en `android/app/`
   - El plugin `@capacitor/push-notifications` se encarga del resto

### Para probar:

- Inicia un emulador desde el AVD Manager
- Click el botón ▶ (Run)

---

## 6. Generar iconos + splash screens

Capacitor lee los recursos desde `resources/` (ubicación recomendada).

```bash
# Una sola vez: instala el generador
npm install -g @capacitor/assets

# Coloca tu icono y splash en /resources/
#   resources/icon.png   (1024x1024 transparente)
#   resources/splash.png (2732x2732 con tu logo centrado)

# Genera todos los tamaños
npx capacitor-assets generate
```

Esto produce automáticamente:
- iOS: `ios/App/App/Assets.xcassets/AppIcon.appiconset/*` (todos los tamaños)
- Android: `android/app/src/main/res/mipmap-*/` (densidades)

---

## 7. Configurar VAPID keys para push

Antes de que los push notifications funcionen, genera la pareja VAPID:

```bash
npx web-push generate-vapid-keys
```

Pega los valores en Vercel → Project Settings → Environment Variables:
```
NEXT_PUBLIC_VAPID_PUBLIC_KEY=<el publicKey>
VAPID_PRIVATE_KEY=<el privateKey>
VAPID_SUBJECT=mailto:hola@marell.app
```

Re-deploy. El toggle "Notificaciones push" en Ajustes ya queda funcional.

---

## 8. Ciclo de desarrollo típico

| Acción | Comando |
|---|---|
| Cambias código web → ver en mobile | `npm run cap:sync` |
| Cambios en `capacitor.config.ts` | `npm run cap:sync` |
| Cambios en plugins nativos / Info.plist | Reabrir Xcode / Android Studio |
| Build de release iOS | Xcode → Product → Archive |
| Build de release Android | Android Studio → Build → Generate Signed Bundle |

---

## 9. Solución a problemas comunes

**"Pod install failed"** (iOS) → `cd ios/App && pod install --repo-update`

**"Gradle sync failed"** (Android) → File → Invalidate Caches & Restart

**Push notifications no llegan en iOS** → necesitas un dispositivo real (no
simulador) + el certificado APNs configurado en Apple Developer Portal.

**Camera abre pero nada se sube** → revisa que el bucket `receipts` exista
en Supabase Storage y las RLS policies estén aplicadas (migration
`2026_05_07_receipts.sql`).

---

## 10. Próximo paso: submission a stores

Ver `STORES.md` (App Store + Play Store).
