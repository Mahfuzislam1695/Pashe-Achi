import { toAmount } from './format'

/** Fees and rates in taka. The API stores one row of these; admins edit it in Catalog. */
export interface Pricing {
  bazarShoppingFee: number
  bazarDeliveryFee: number
  medicineDeliveryFee: number
  parcelDeliveryFee: number
  wagePerLabourer: number
  loadingRatePerFloor: number
  unloadingRatePerFloor: number
}

/** The defaults from the paper sketches. Used to seed the database. */
export const DEFAULT_PRICING: Pricing = {
  bazarShoppingFee: 150,
  bazarDeliveryFee: 80,
  medicineDeliveryFee: 60,
  parcelDeliveryFee: 60,
  wagePerLabourer: 150,
  loadingRatePerFloor: 50,
  unloadingRatePerFloor: 20,
}

/** The sketch gives one vehicle rate (1200), so every seeded vehicle starts with it. */
export const DEFAULT_VEHICLES = [
  { slug: 'covered-van', nameBn: 'কাভার্ড ভ্যান', nameEn: 'Covered van', rate: 1200 },
  { slug: 'pickup', nameBn: 'পিকআপ ভ্যান', nameEn: 'Pickup van', rate: 1200 },
  { slug: 'truck', nameBn: 'ট্রাক', nameEn: 'Truck', rate: 1200 },
] as const

/**
 * How an order's total is split. Stored on every order as a snapshot, so later price changes
 * never alter an existing bill.
 * - bazar: items + shopping fee + delivery
 * - medicine: items + delivery
 * - shifting: vehicle (items) + labour and floors (service fee)
 * - parcel: delivery only
 */
export interface Bill {
  itemsTotal: number
  serviceFee: number
  deliveryFee: number
  total: number
}

const bill = (itemsTotal: number, serviceFee: number, deliveryFee: number): Bill => ({
  itemsTotal,
  serviceFee,
  deliveryFee,
  total: itemsTotal + serviceFee + deliveryFee,
})

const sum = (prices: readonly (number | string | null | undefined)[]) => prices.reduce<number>((total, price) => total + toAmount(price), 0)

export const calcBazar = (pricing: Pricing, prices: readonly (number | string | null | undefined)[]) =>
  bill(sum(prices), pricing.bazarShoppingFee, pricing.bazarDeliveryFee)

export const calcMedicine = (pricing: Pricing, prices: readonly (number | string | null | undefined)[]) =>
  bill(sum(prices), 0, pricing.medicineDeliveryFee)

export interface ShiftingInput {
  vehicleRate: number
  labourers: number | string
  loadingFloor: number | string
  unloadingFloor: number | string
}

export const shiftingCharges = (pricing: Pricing, input: ShiftingInput) => ({
  vehicle: toAmount(input.vehicleRate),
  labour: toAmount(input.labourers) * pricing.wagePerLabourer,
  loading: toAmount(input.loadingFloor) * pricing.loadingRatePerFloor,
  unloading: toAmount(input.unloadingFloor) * pricing.unloadingRatePerFloor,
})

export const calcShifting = (pricing: Pricing, input: ShiftingInput) => {
  const charges = shiftingCharges(pricing, input)
  return bill(charges.vehicle, charges.labour + charges.loading + charges.unloading, 0)
}

export const calcParcel = (pricing: Pricing) => bill(0, 0, pricing.parcelDeliveryFee)
