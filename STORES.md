# Submission a App Store + Google Play

Esta guía cubre desde "tengo el .ipa / .aab listo" hasta "MARELL está vivo
en las stores". Asume que ya seguiste `CAPACITOR.md`.

---

## A. Apple App Store

### A.1 Cuentas y certificados (una vez)

1. **Apple Developer Program** ($99/año) → https://developer.apple.com/programs/
   - Necesitas Apple ID + verificación de identidad (puede tomar 1-2 días)
2. En **App Store Connect** (https://appstoreconnect.apple.com) crea la app:
   - Nombre: **MARELL**
   - Bundle ID: `app.marell.mobile`
   - SKU: `marell-mobile-001`
   - Idioma principal: **Español (México)** (cubre RD)

### A.2 Información requerida

App Store Connect te pide:

| Campo | Recomendado |
|---|---|
| **Categoría primaria** | Finanzas |
| **Categoría secundaria** | Productividad |
| **Edad mínima** | 4+ |
| **Precio** | Gratis (con compras dentro de la app — Pro $RD999/mes) |
| **Privacy Policy URL** | https://marell.app/legal/privacidad (debes crearla) |
| **Support URL** | https://marell.app/soporte o `mailto:hola@marell.app` |
| **Marketing URL** | https://marell.app |

### A.3 Screenshots (obligatorio)

Apple requiere mínimo **3 screenshots** por tamaño. Tamaños actuales:

- **iPhone 6.9"** (15 Pro Max): 1320×2868
- **iPhone 6.5"** (XS Max / 11 Pro Max): 1284×2778 o 1242×2688
- **iPad Pro 13"**: 2064×2752

Capturas recomendadas:
1. Pantalla de Resumen (KPIs + categorías)
2. Plan con asignación
3. Transacción con foto de recibo
4. Análisis (donut + tendencias)
5. Familia (compartir presupuesto)

Tip: usa el simulador de Xcode + un screenshot tool como **Picsew** para
unir varias capturas en una sola imagen vertical (storytelling).

### A.4 Texto de la ficha (App Store)

**Subtítulo (30 chars)**: `Tu dinero. Tu futuro. Bajo control.`

**Descripción (4000 chars)** — usa esta plantilla:
```
MARELL es la app de finanzas personales hecha para República Dominicana.

✓ Asigna cada peso a un trabajo (presupuesto zero-based estilo YNAB)
✓ Importa tus estados de cuenta de BPD, Banreservas, BHD, Popular y Scotia
✓ Cuotas, regalía pascual, ISR — calculadoras pensadas para RD
✓ Tarjetas de crédito, transferencias y cuentas en USD/DOP
✓ Comparte tu presupuesto con tu pareja o familia
✓ Toma fotos de tus recibos directo desde la transacción
✓ Tasa USD↔DOP del Banco Central actualizada todos los días

Suscripción Pro: RD$999/mes después del trial de 31 días gratis.
Cancela cuando quieras.

Política de privacidad: https://marell.app/legal/privacidad
```

**Keywords (100 chars, separadas por coma)**:
```
finanzas, presupuesto, ahorros, RD, Dominicana, tarjeta, banco, ynab, dinero, gastos
```

### A.5 In-App Purchase configuration

Para que Apple permita PayPal/Azul tienes que justificar que es servicio
externo (suscripciones SaaS están permitidas). Si Apple insiste en IAP,
puedes:

1. Configurar suscripción IAP en App Store Connect → Pro Mensual / Pro
   Anual
2. En la app, mostrar **dos botones**: "Pagar con tarjeta (web)" y "Pagar
   con App Store"
3. Apple generalmente acepta esto si el flujo web también está
   disponible.

### A.6 Build + submit

En Xcode:
1. **Product → Archive**
2. Cuando termina, **Distribute App** → **App Store Connect** → **Upload**
3. En App Store Connect, espera a que el build aparezca (5-15 min)
4. Adjúntalo a tu versión 1.0
5. Click **Submit for Review**

**Tiempo de review**: 24-48 horas típicamente. Si rechazan, la razón es
clara y se itera.

---

## B. Google Play Store

### B.1 Cuenta (una vez)

1. **Google Play Console** ($25 una vez) → https://play.google.com/console
2. Verifica identidad (puede tardar 1-3 días, peor que Apple)
3. Configura **payment profile** (necesario aunque la app sea gratis si
   tendrá suscripciones)

### B.2 Crear la app

- Nombre: **MARELL**
- Idioma: **Español (Estados Unidos)** o **(México)**
- Tipo: **App**
- Gratis con compras integradas

### B.3 Build de release

En Android Studio:
1. **Build → Generate Signed Bundle / APK → Android App Bundle (.aab)**
2. Si es la primera vez, crea un **keystore** y guárdalo SEGURO (si lo
   pierdes no puedes actualizar la app nunca más)
3. Sube el `.aab` a Play Console → **Production → Create release**

### B.4 Cuestionarios obligatorios

Google te hace responder:

- **Data safety**: qué datos colectas (email, nombre, transacciones
  financieras), cómo los usas, dónde los guardas (Supabase/EU)
- **Content rating**: tipo "Tools/Finance" → 3+
- **Target audience**: 18+
- **News app?**: No
- **COVID-19?**: No
- **Government app?**: No

### B.5 Screenshots (Play Store)

Mínimo 2, recomendado 8. Tamaños:
- **Phone**: 1080×1920 mínimo
- **7-inch tablet**: 1024×600
- **10-inch tablet**: 1280×800
- **Feature graphic**: 1024×500 (se muestra grande en la ficha)

Reusa las capturas de App Store con un poco de re-encuadre.

### B.6 Submission

- Production → Create release → Sube el `.aab`
- Pega release notes (`v1.0.0 — Lanzamiento inicial`)
- Click **Review release → Start rollout**

**Tiempo de review**: 1-3 días. Más rápido que Apple.

---

## C. Estrategia de lanzamiento sugerida

### Semana 1
- Sube TestFlight (iOS) y Closed Testing (Android) a 10-20 amigos
- Recopila feedback / crashes vía la propia consola
- Itera bugs críticos

### Semana 2
- Open beta en Play Store (acceso por link, no aparece en búsqueda)
- iOS sigue en TestFlight

### Semana 3
- Submit producción Apple (review 1-2 días)
- Promote Play Store closed → production

### Día del lanzamiento
- Post en Instagram + Twitter
- Mensaje al grupo de WhatsApp / Telegram de finanzas RD
- ProductHunt si aplicable

---

## D. Checklist final antes de submit

- [ ] Privacy policy publicada en `https://marell.app/legal/privacidad`
- [ ] Terms of service publicados en `https://marell.app/legal/terminos`
- [ ] Email de soporte respondido o auto-responder configurado
- [ ] Iconos generados (`npx capacitor-assets generate`)
- [ ] Splash screens generados
- [ ] Build firmado con cert de producción
- [ ] App probada en al menos 1 dispositivo iOS real + 1 Android real
- [ ] Push notifications probadas end-to-end
- [ ] Cámara para recibos probada en ambas plataformas
- [ ] Login + signup + reset password probados en mobile
- [ ] Pago con Azul probado (al menos en sandbox)
- [ ] Pago con PayPal probado (al menos en sandbox)
- [ ] Crash reporting habilitado (Sentry o similar — opcional pero
      altamente recomendado)
