import type { LucideIcon } from 'lucide-react'
import {
  Baby,
  Banknote,
  Bike,
  Briefcase,
  Bus,
  Car,
  CreditCard,
  Diamond,
  Droplet,
  Dumbbell,
  Film,
  Fuel,
  Gift,
  GraduationCap,
  HandHeart,
  Home,
  HousePlus,
  KeyRound,
  LifeBuoy,
  Music,
  Package,
  Palette,
  Phone,
  Plane,
  Receipt,
  Scissors,
  ShieldCheck,
  Shirt,
  ShoppingBag,
  Sofa,
  Stethoscope,
  Sun,
  Tag,
  Tv,
  Utensils,
  Wifi,
  Wrench,
  Zap,
} from 'lucide-react'

// Single source of truth for category-name → icon mapping.
// Used by both the onboarding wizard's category generator
// and the /app/plan view to keep visual consistency.
export const ICON_BY_CATEGORY: Record<string, LucideIcon> = {
  // Bills
  'Renta': KeyRound,
  'Hipoteca': Home,
  'Electricidad': Zap,
  'Agua': Droplet,
  'Internet': Wifi,
  'TV / cable': Tv,
  'Teléfono móvil': Phone,
  'Seguros': ShieldCheck,
  'Música': Music,
  'Streaming TV': Tv,
  'Gimnasio': Dumbbell,
  'Otras suscripciones': Briefcase,
  'Pago tarjeta de crédito': CreditCard,
  'Pago préstamo auto': Car,
  'Pago préstamo estudiantil': GraduationCap,
  'Pago préstamo personal': Banknote,
  'Pago deuda médica': Stethoscope,
  'Pago compras a plazos': ShoppingBag,
  'Cuotas anuales tarjetas': CreditCard,
  'Impuestos': Receipt,

  // Needs
  'Supermercado': ShoppingBag,
  'Gasolina': Fuel,
  'Mantenimiento auto': Wrench,
  'Gasolina motor': Fuel,
  'Transporte': Bus,
  'Mantenimiento bici': Bike,
  'Mantenimiento del hogar': Wrench,
  'Cuidado personal': Scissors,
  'Ropa': Shirt,
  'Self storage': Package,
  'Gastos médicos': Stethoscope,

  // Wants
  'Restaurantes': Utensils,
  'Entretenimiento': Film,
  'Hobbies': Palette,
  'Caridad': HandHeart,
  'Regalos': Gift,
  'Decoración': Sofa,

  // Goals
  'Fondo de emergencia': LifeBuoy,
  'Vacaciones': Plane,
  'Carro nuevo': Car,
  'Casa nueva': HousePlus,
  'Boda': Diamond,
  'Bebé': Baby,
  'Retiro': Sun,
}

export function iconForCategoryName(name: string): LucideIcon {
  return ICON_BY_CATEGORY[name] ?? Tag
}
