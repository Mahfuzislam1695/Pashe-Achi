/** A map pin, in WGS 84 degrees. */
export interface GeoPoint {
  lat: number
  lng: number
}

/** Where the map opens when there is no pin yet: central Dhaka. */
export const DHAKA_CENTER: GeoPoint = { lat: 23.8103, lng: 90.4125 }

/**
 * A place picked on the map, as one line: the house/flat/road the customer added, then the address
 * the map gave. Orders store this text with the pin.
 */
export const joinAddress = ({ address, details }: { address: string; details?: string | null }) =>
  details?.trim() ? `${details.trim()}, ${address}` : address

/** A pin from two nullable columns: null unless both are set. */
export const toGeoPoint = (lat: number | null | undefined, lng: number | null | undefined): GeoPoint | null =>
  lat == null || lng == null ? null : { lat, lng }

/** Opens the pin in Google Maps (no key needed), which on a phone hands it to the Maps app for directions. */
export const mapLink = ({ lat, lng }: GeoPoint) => `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`

/** Google Maps directions between two pins (no key needed): staff read the road distance from it. */
export const directionsLink = (from: GeoPoint, to: GeoPoint) =>
  `https://www.google.com/maps/dir/?api=1&origin=${from.lat},${from.lng}&destination=${to.lat},${to.lng}`

/**
 * The area of a map address for a one-line label (Home's location row): its last two parts, which
 * formatAddress writes finest to coarsest ("…, মিরপুর ১০, ঢাকা-১২১৬" → "মিরপুর ১০, ঢাকা-১২১৬").
 */
export const shortArea = (address: string) =>
  address
    .split(',')
    .map(part => part.trim())
    .filter(Boolean)
    .slice(-2)
    .join(', ')
