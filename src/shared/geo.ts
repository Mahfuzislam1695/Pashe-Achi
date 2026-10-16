import type { Text } from './enums'

/** A map pin, in WGS 84 degrees. */
export interface GeoPoint {
  lat: number
  lng: number
}

/** Where the map opens when there is no pin yet: central Dhaka. */
export const DHAKA_CENTER: GeoPoint = { lat: 23.8103, lng: 90.4125 }

/** How many locations a customer can save. */
export const MAX_SAVED_LOCATIONS = 10

/** Quick names for a saved location; the customer can also type their own. */
export const LOCATION_LABEL_PRESETS: readonly Text[] = [
  { bn: 'বাসা', en: 'Home' },
  { bn: 'অফিস', en: 'Office' },
]

/** A pin from two nullable columns: null unless both are set. */
export const toGeoPoint = (lat: number | null | undefined, lng: number | null | undefined): GeoPoint | null =>
  lat == null || lng == null ? null : { lat, lng }

/** Opens the pin in Google Maps (no key needed), which on a phone hands it to the Maps app for directions. */
export const mapLink = ({ lat, lng }: GeoPoint) => `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`
