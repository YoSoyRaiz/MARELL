// Diccionario de patrones de comercios dominicanos comunes mapeados a
// "tipos semánticos" de categoría. Lo usa el modal de Importar para
// sugerir una categoría cuando NO hay historial previo del payee — el
// historial siempre gana, este diccionario es el fallback de cold-start.
//
// Cada `kind` se traduce a una de las categorías reales del usuario
// usando KIND_ALIASES + matching case/acento-insensible. Si el usuario
// no tiene una categoría que matchee con los aliases, no se sugiere.
//
// Mantenimiento: añade aquí cualquier comercio o pago recurrente común
// en RD. Prefiere regex que matcheen variantes ("PEDIDOSYA", "Pedidos Ya",
// "PedidosYa.com"). Las cadenas con espacios o caracteres especiales en
// el payee del PDF se normalizan a uppercase antes del test.

export type CategoryKind =
  | 'supermercado'
  | 'restaurante'
  | 'delivery_comida'
  | 'transporte'
  | 'combustible'
  | 'telecom'
  | 'electricidad'
  | 'agua'
  | 'farmacia'
  | 'salud'
  | 'banco_comisiones'
  | 'streaming'
  | 'transferencia'
  | 'cajero'
  | 'compras_ropa'
  | 'gimnasio'
  | 'educacion'
  | 'mascotas'
  | 'hogar'
  | 'entretenimiento'
  | 'viajes_hotel'
  | 'seguros'
  | 'gobierno_impuestos'

interface MerchantPattern {
  regex: RegExp
  kind: CategoryKind
}

// Listado en orden de especificidad: patrones más específicos primero
// para evitar que un patrón genérico (e.g. "tienda") capture algo más
// específico (e.g. "tienda agropecuaria" → mascotas).
const MERCHANT_PATTERNS: MerchantPattern[] = [
  // ── Supermercados / mayoristas RD ─────────────────────────────
  {
    regex: /\b(SUPERMIX|PRICESMART|JUMBO|NACIONAL|SUPER\s*NACIONAL|BRAVO|OL[EÉ]|LA\s*SIRENA|SIRENA|POLA|PLAZA\s*LAMA|CARREFOUR|IGA|MULTICENTRO|CCN|CENTRO\s*CUESTA|FRUSA|MAS\s*POR\s*MENOS|SUPER\s*POLA)\b/i,
    kind: 'supermercado',
  },
  // ── Delivery de comida ────────────────────────────────────────
  {
    regex: /\b(PEDIDOSYA|PEDIDOS\s*YA|UBER\s*EATS|UBEREATS|HUNGRY|DIDI\s*FOOD|GLOVO|RAPPI)\b/i,
    kind: 'delivery_comida',
  },
  // ── Restaurantes / fast-food RD ───────────────────────────────
  {
    regex: /\b(ADRIAN\s*TROPICAL|VICTORINA|POLLO\s*TROPICAL|WENDY[S']*|MCDONALD|MC\s*DONALD|KFC|BURGER\s*KING|PIZZA\s*HUT|DOMINO[S']*\s*PIZZA|DOMINOS|FRIDAY[S']*|STARBUCKS|BONCHEF|VESUVIO|MITRE|MUSEO\s*DEL\s*JAMON|BUCHE\s*PERICO|PAT[EÉ]\s*PAL[OÓ]|CAF[EÉ]|CAFETER[ÍI]A|RESTAUR|BAR\s+|GRILL|PARRILLA|PIZZER|CERVECER|PAPA\s*JOHN|SUBWAY|TACO\s*BELL|CHILIS|CHILI[S']*\s+|TGI)\b/i,
    kind: 'restaurante',
  },
  // ── Transporte / rideshare ───────────────────────────────────
  {
    regex: /\b(UBER(?!\s*EATS)|CABIFY|INDRIVE|DIDI(?!\s*FOOD)|APOLO\s*TAXI|TAXI)\b/i,
    kind: 'transporte',
  },
  // ── Combustible ───────────────────────────────────────────────
  {
    regex: /\b(SHELL|TEXACO|SUNIX|ISLA|TOTAL\s+|ESSO|REFIDOMSA|PROPAGAS|TROPIGAS|GASOLINERA|ESTACI[OÓ]N\s*DE\s*SERVICIO)\b/i,
    kind: 'combustible',
  },
  // ── Telecom (internet, teléfono, cable, datos) ────────────────
  {
    regex: /\b(CLARO|ALTICE|WIND\s*TELECOM|TIGO|VIVA\s+|ORANGE|TRICOM|CABLE|INTERNET\b|TELEFON|CELULAR|RECARGA)\b/i,
    kind: 'telecom',
  },
  // ── Electricidad ─────────────────────────────────────────────
  {
    regex: /\b(EDESUR|EDENORTE|EDEESTE|EDE\s*ESTE|EDE\s*NORTE|EDE\s*SUR|AES\s+|CDE\s+|FACTURA\s*LUZ)\b/i,
    kind: 'electricidad',
  },
  // ── Agua ─────────────────────────────────────────────────────
  {
    regex: /\b(CAASD|INAPA|CORAAVEGA|CORAASAN|CORAA|ACUEDUCTO)\b/i,
    kind: 'agua',
  },
  // ── Farmacia ─────────────────────────────────────────────────
  {
    regex: /\b(FARMACIA|FARMAX|FARMA[\s-]?VALUE|CAROL|LOS\s*HIDALGOS|GBC|MEDICAR|FARMA\s*GBC)\b/i,
    kind: 'farmacia',
  },
  // ── Salud (clínicas, hospitales, ARS) ────────────────────────
  {
    regex: /\b(HOSPITAL|CL[ÍI]NICA|CEDIMAT|CENTRO\s*M[EÉ]DICO|HOMS|REFERENCIA\s*LAB|AMADITA|PATRIA\s*RIVAS|HUMANO|SEMMA|SENASA|ARS|PALIC\s*SALUD)\b/i,
    kind: 'salud',
  },
  // ── Banco / comisiones ───────────────────────────────────────
  {
    regex: /\b(COMISI[OÓ]N|COMISIONES|MEMBRES[ÍI]A|CUOTA\s*MANEJO|CARGO\s*POR|CARGO\s*BANCARIO|INTER[EÉ]S\s*FINANC|MORA|RECARGO|COBRO\s*ANUAL|RENOVACI[OÓ]N)\b/i,
    kind: 'banco_comisiones',
  },
  // ── Streaming / suscripciones digitales ──────────────────────
  {
    regex: /\b(NETFLIX|SPOTIFY|HBO|MAX\s*WB|DISNEY|YOUTUBE|AMAZON\s*PRIME|PRIME\s*VIDEO|APPLE\.COM|APPLE\s*MUSIC|APPLE\s*TV|ICLOUD|GOOGLE\s*ONE|MICROSOFT\s*365|OFFICE\s*365|ADOBE|CANVA|NOTION|FIGMA|CHATGPT|OPENAI|ANTHROPIC|CLAUDE\.AI)\b/i,
    kind: 'streaming',
  },
  // ── Cajero / ATM ─────────────────────────────────────────────
  {
    regex: /\b(RETIRO\s*ATM|RETIRO\s*CAJERO|ATM\b|CAJERO\s*AUTOM|EFECTIVO\s*ATM|RETIRO\s*EN\s*VENTANILLA|RETIRO\s*EFECTIVO)\b/i,
    kind: 'cajero',
  },
  // ── Transferencias internas ──────────────────────────────────
  {
    regex: /\b(TRANSFERENCIA|TRANSF\b|TRANSF\.|TRANSF\s|ENV[ÍI]O\s*ACH|ACH\b|PAGO\s*A\s*TARJETA|PAGO\s*TARJETA)\b/i,
    kind: 'transferencia',
  },
  // ── Compras / ropa / e-commerce ──────────────────────────────
  {
    regex: /\b(AMAZON(?!\s*PRIME)|AMAZON\.COM|EBAY|ALIEXPRESS|SHEIN|TEMU|MERCADO\s*LIBRE|MERCADO\s*PAGO|ZARA|H&M|FOREVER\s*21|BERSHKA|PULL\s*&\s*BEAR|STRADIVARIUS|GAP\s+|UNIQLO|TOMMY|RALPH|NIKE|ADIDAS|FOOT\s*LOCKER|AGORA\s*MALL|SAMBIL|MEGACENTRO|CCN\s*MARKET|JEAN|TIENDA|BOUTIQUE|FASHION|ROPA)\b/i,
    kind: 'compras_ropa',
  },
  // ── Gimnasio / fitness ───────────────────────────────────────
  {
    regex: /\b(GYM\b|GIMNASIO|BODY\s*SHOP|FITNESS|SMART\s*FIT|WORLD\s*GYM|CROSSFIT)\b/i,
    kind: 'gimnasio',
  },
  // ── Educación ────────────────────────────────────────────────
  {
    regex: /\b(PUCMM|UNIBE|INTEC|UASD|O&M|APEC|UNAPEC|UNPHU|UTESA|COLEGIO|ESCUELA|UNIVERSIDAD|EDUCACI[OÓ]N|COURSERA|UDEMY|DUOLINGO)\b/i,
    kind: 'educacion',
  },
  // ── Mascotas / veterinario ───────────────────────────────────
  {
    regex: /\b(VETERINARIA|VETERINARIO|PET\s*SHOP|MASCOTAS|AGROVETERINARIA|ZOO\s+|ANIMAL)\b/i,
    kind: 'mascotas',
  },
  // ── Hogar (servicios, muebles, ferretería) ───────────────────
  {
    regex: /\b(MUEBLES|FERRETER[ÍI]A|IMCA\b|GBM\b|HOGAR\s+|DECORACI[OÓ]N|JARD[ÍI]N|JOMA\b|CASA\s*COCINA|BUENA\s*VIDA)\b/i,
    kind: 'hogar',
  },
  // ── Entretenimiento (cine, eventos) ──────────────────────────
  {
    regex: /\b(CARIBBEAN\s*CINEMAS|CINEMAS|CINEPOLIS|CINEMA\b|TEATRO|HARD\s*ROCK|EVENTO|TICKET|TICKETMASTER|BOLETO|BOLETER[ÍI]A)\b/i,
    kind: 'entretenimiento',
  },
  // ── Viajes / hoteles / aerolíneas ────────────────────────────
  {
    regex: /\b(HYATT|MARRIOTT|HILTON|IBEROSTAR|MELI[AÁ]|BARCEL[OÓ]|RIU|BAVARO|PUNTA\s*CANA|HOTEL|AIRBNB|BOOKING\.COM|EXPEDIA|AERODOM|AMERICAN\s*AIRLINES|DELTA|JETBLUE|COPA\s*AIRLINES|SPIRIT|UNITED|AVIANCA|ARAJET|SKY\s*HIGH)\b/i,
    kind: 'viajes_hotel',
  },
  // ── Seguros ──────────────────────────────────────────────────
  {
    regex: /\b(SEGURO|SEGUROS|MAPFRE|UNIVERSAL\s*SEGUR|BANRESERVAS\s*SEGUR|HUMANO\s*SEGUROS|LA\s*COLONIAL|PALIC\b)\b/i,
    kind: 'seguros',
  },
  // ── Gobierno / impuestos ─────────────────────────────────────
  {
    regex: /\b(DGII|DGA\b|IMPUESTO|RNC|ITBIS|ALCALD[ÍI]A|AYUNTAMIENTO|MARCBETIS)\b/i,
    kind: 'gobierno_impuestos',
  },
]

// Aliases de cada `kind` para matchear contra los nombres de categoría
// que el usuario tiene en su presupuesto. Cada alias se compara
// normalizado (lowercase + sin acentos) — primero por equivalencia
// exacta, luego por substring para tolerar "Comida casa" matcheando
// con la categoría "Comida".
const KIND_ALIASES: Record<CategoryKind, string[]> = {
  supermercado: [
    'supermercado',
    'super mercado',
    'mercado',
    'super',
    'alimentos',
    'comida casa',
    'comida en casa',
    'compras del mercado',
    'comestibles',
    'colmado',
  ],
  restaurante: [
    'restaurante',
    'restaurantes',
    'comer fuera',
    'comida fuera',
    'salir a comer',
    'restoranes',
    'comida',
  ],
  delivery_comida: [
    'delivery',
    'delivery comida',
    'pedidos',
    'comida a domicilio',
    'comida fuera',
    'restaurantes',
  ],
  transporte: [
    'transporte',
    'uber',
    'taxi',
    'movilidad',
    'transportes',
    'carrera',
    'rideshare',
  ],
  combustible: [
    'combustible',
    'gasolina',
    'gas',
    'gasoil',
    'diesel',
    'combustibles',
  ],
  telecom: [
    'teléfono',
    'telefono',
    'telefonía',
    'telefonia',
    'celular',
    'celulares',
    'internet',
    'wifi',
    'data',
    'tv cable',
    'cable',
    'tv',
    'streaming y telecom',
  ],
  electricidad: [
    'electricidad',
    'luz',
    'energía',
    'energia',
    'edenorte',
    'edeeste',
    'edesur',
    'factura de luz',
  ],
  agua: ['agua', 'caasd', 'inapa', 'factura de agua'],
  farmacia: ['farmacia', 'farmacias', 'medicamentos', 'medicina'],
  salud: [
    'salud',
    'médico',
    'medico',
    'doctor',
    'doctores',
    'consultas',
    'consultas médicas',
    'ars',
    'seguro médico',
    'hospital',
    'clínica',
    'clinica',
  ],
  banco_comisiones: [
    'comisiones',
    'comisiones bancarias',
    'comisión',
    'banco',
    'banco fees',
    'fees',
    'cargos bancarios',
    'intereses',
    'membresía',
    'membresia',
  ],
  streaming: [
    'streaming',
    'suscripciones',
    'subscripciones',
    'netflix',
    'spotify',
    'entretenimiento digital',
    'apps',
  ],
  transferencia: [
    'transferencias',
    'transferencia',
    'movimientos internos',
    'envíos',
    'envios',
  ],
  cajero: [
    'cajero',
    'atm',
    'retiro efectivo',
    'efectivo',
    'retiros',
    'dinero en efectivo',
  ],
  compras_ropa: [
    'compras',
    'shopping',
    'ropa',
    'ropa y accesorios',
    'tienda',
    'tiendas',
    'vestimenta',
    'amazon',
  ],
  gimnasio: [
    'gimnasio',
    'gym',
    'fitness',
    'ejercicio',
    'deporte',
    'entrenamiento',
  ],
  educacion: [
    'educación',
    'educacion',
    'escuela',
    'colegio',
    'universidad',
    'cursos',
    'estudios',
  ],
  mascotas: ['mascotas', 'perros', 'gatos', 'veterinario', 'mascota'],
  hogar: [
    'hogar',
    'casa',
    'mantenimiento del hogar',
    'mantenimiento',
    'limpieza',
    'ferretería',
    'ferreteria',
    'muebles',
  ],
  entretenimiento: [
    'entretenimiento',
    'salidas',
    'diversión',
    'diversion',
    'ocio',
    'cine',
    'eventos',
  ],
  viajes_hotel: [
    'viajes',
    'turismo',
    'hotel',
    'hoteles',
    'vacaciones',
    'aerolíneas',
    'aerolineas',
    'pasajes',
  ],
  seguros: ['seguro', 'seguros', 'póliza', 'poliza'],
  gobierno_impuestos: [
    'impuestos',
    'impuesto',
    'gobierno',
    'dgii',
    'tributos',
  ],
}

const normalize = (s: string): string =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()

/**
 * Returns the semantic kind that best fits the payee, or null if no
 * pattern matches. The first matching pattern wins, so order matters
 * (more-specific patterns are listed first in `MERCHANT_PATTERNS`).
 */
export function suggestKindFromPayee(payeeName: string): CategoryKind | null {
  const upper = payeeName.toUpperCase()
  for (const p of MERCHANT_PATTERNS) {
    if (p.regex.test(upper)) return p.kind
  }
  return null
}

/**
 * Picks the category id from the user's actual category list that best
 * matches the given semantic kind. Tries exact alias match first, then
 * substring (so a user's "Comida" category gets the supermarket bucket
 * when they don't have a more-specific "Supermercado"). Returns null
 * when none of the aliases match any category.
 */
export function pickCategoryIdForKind(
  kind: CategoryKind,
  userCategories: { id: string; name: string }[],
): string | null {
  const aliases = KIND_ALIASES[kind]
  if (!aliases || aliases.length === 0) return null

  const normalizedCats = userCategories.map((c) => ({
    id: c.id,
    norm: normalize(c.name),
  }))

  // 1) Exact alias match
  for (const alias of aliases) {
    const n = normalize(alias)
    const hit = normalizedCats.find((c) => c.norm === n)
    if (hit) return hit.id
  }
  // 2) Substring fallback (alias contained in cat name OR cat name contained in alias)
  for (const alias of aliases) {
    const n = normalize(alias)
    const hit = normalizedCats.find(
      (c) => c.norm.includes(n) || n.includes(c.norm),
    )
    if (hit) return hit.id
  }
  return null
}

/**
 * Convenience wrapper: payeeName → categoryId (or null). Returns the
 * kind too so the UI can show a tooltip explaining why the category
 * was suggested.
 */
export function suggestCategoryFromMerchantPattern(
  payeeName: string,
  userCategories: { id: string; name: string }[],
): { categoryId: string; kind: CategoryKind } | null {
  const kind = suggestKindFromPayee(payeeName)
  if (!kind) return null
  const categoryId = pickCategoryIdForKind(kind, userCategories)
  if (!categoryId) return null
  return { categoryId, kind }
}
