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
  Tv,
  Utensils,
  Wifi,
  Wrench,
  Zap,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { OnboardingAnswers } from './types'

export interface CategoryItem {
  Icon: LucideIcon
  name: string
}

export interface CategoryGroup {
  name: string
  items: CategoryItem[]
}

export function generateCategories(a: OnboardingAnswers): CategoryGroup[] {
  const bills: CategoryItem[] = []
  const needs: CategoryItem[] = []
  const wants: CategoryItem[] = []
  const goals: CategoryItem[] = []

  // ── BILLS ────────────────────────────────────────────
  if (a.housing === 'rent') bills.push({ Icon: KeyRound, name: 'Renta' })
  if (a.housing === 'own' && a.mortgage === 'yes') bills.push({ Icon: Home, name: 'Hipoteca' })

  bills.push({ Icon: Zap, name: 'Electricidad' })
  bills.push({ Icon: Droplet, name: 'Agua' })
  if (a.regularSpending.includes('tv_internet')) {
    bills.push({ Icon: Wifi, name: 'Internet' })
    bills.push({ Icon: Tv, name: 'TV / cable' })
  }
  bills.push({ Icon: Phone, name: 'Teléfono móvil' })
  bills.push({ Icon: ShieldCheck, name: 'Seguros' })

  if (a.subscriptions.includes('music')) bills.push({ Icon: Music, name: 'Música' })
  if (a.subscriptions.includes('streaming')) bills.push({ Icon: Tv, name: 'Streaming TV' })
  if (a.subscriptions.includes('fitness')) bills.push({ Icon: Dumbbell, name: 'Gimnasio' })
  if (a.subscriptions.includes('other')) bills.push({ Icon: Briefcase, name: 'Otras suscripciones' })

  // Pagos de deuda como bills
  if (a.debts.includes('credit_card')) bills.push({ Icon: CreditCard, name: 'Pago tarjeta de crédito' })
  if (a.debts.includes('auto')) bills.push({ Icon: Car, name: 'Pago préstamo auto' })
  if (a.debts.includes('student')) bills.push({ Icon: GraduationCap, name: 'Pago préstamo estudiantil' })
  if (a.debts.includes('personal')) bills.push({ Icon: Banknote, name: 'Pago préstamo personal' })
  if (a.debts.includes('medical')) bills.push({ Icon: Stethoscope, name: 'Pago deuda médica' })
  if (a.debts.includes('bnpl')) bills.push({ Icon: ShoppingBag, name: 'Pago compras a plazos' })

  // Gastos infrecuentes anualizados
  if (a.infrequentExpenses.includes('credit_card_annual'))
    bills.push({ Icon: CreditCard, name: 'Cuotas anuales tarjetas' })
  if (a.infrequentExpenses.includes('taxes')) bills.push({ Icon: Receipt, name: 'Impuestos' })

  // ── NEEDS ────────────────────────────────────────────
  needs.push({ Icon: ShoppingBag, name: 'Supermercado' })

  if (a.transport.includes('car')) {
    needs.push({ Icon: Fuel, name: 'Gasolina' })
    needs.push({ Icon: Wrench, name: 'Mantenimiento auto' })
  }
  if (a.transport.includes('motorcycle')) needs.push({ Icon: Fuel, name: 'Gasolina motor' })
  if (a.transport.includes('public') || a.transport.includes('rideshare')) {
    needs.push({ Icon: Bus, name: 'Transporte' })
  }
  if (a.transport.includes('bike')) needs.push({ Icon: Bike, name: 'Mantenimiento bici' })

  if (a.housing === 'own') needs.push({ Icon: Wrench, name: 'Mantenimiento del hogar' })
  if (a.regularSpending.includes('personal_care')) needs.push({ Icon: Scissors, name: 'Cuidado personal' })
  if (a.regularSpending.includes('clothing')) needs.push({ Icon: Shirt, name: 'Ropa' })
  if (a.regularSpending.includes('storage')) needs.push({ Icon: Package, name: 'Self storage' })
  if (a.infrequentExpenses.includes('medical')) needs.push({ Icon: Stethoscope, name: 'Gastos médicos' })

  // ── WANTS ────────────────────────────────────────────
  if (a.additionalCategories.includes('dining_out')) wants.push({ Icon: Utensils, name: 'Restaurantes' })
  if (a.additionalCategories.includes('entertainment'))
    wants.push({ Icon: Film, name: 'Entretenimiento' })
  if (a.additionalCategories.includes('hobbies')) wants.push({ Icon: Palette, name: 'Hobbies' })
  if (a.additionalCategories.includes('charity')) wants.push({ Icon: HandHeart, name: 'Caridad' })
  if (a.additionalCategories.includes('gifts')) wants.push({ Icon: Gift, name: 'Regalos' })
  if (a.additionalCategories.includes('home_decor')) wants.push({ Icon: Sofa, name: 'Decoración' })

  // ── GOALS ────────────────────────────────────────────
  if (a.goals.includes('emergency_fund')) goals.push({ Icon: LifeBuoy, name: 'Fondo de emergencia' })
  if (a.goals.includes('vacation')) goals.push({ Icon: Plane, name: 'Vacaciones' })
  if (a.goals.includes('new_car')) goals.push({ Icon: Car, name: 'Carro nuevo' })
  if (a.goals.includes('new_home')) goals.push({ Icon: HousePlus, name: 'Casa nueva' })
  if (a.goals.includes('wedding')) goals.push({ Icon: Diamond, name: 'Boda' })
  if (a.goals.includes('baby')) goals.push({ Icon: Baby, name: 'Bebé' })
  if (a.goals.includes('retirement')) goals.push({ Icon: Sun, name: 'Retiro' })

  const result: CategoryGroup[] = []
  if (bills.length) result.push({ name: 'Facturas', items: bills })
  if (needs.length) result.push({ name: 'Necesidades', items: needs })
  if (wants.length) result.push({ name: 'Gustos', items: wants })
  if (goals.length) result.push({ name: 'Metas', items: goals })
  return result
}
