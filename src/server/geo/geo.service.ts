import { Injectable, Logger } from '@nestjs/common'
import { type Lang, type ReverseGeocodeDto, type ReverseGeocodeQuery, toBnDigits } from '@/shared'

const NOMINATIM_REVERSE_URL = 'https://nominatim.openstreetmap.org/reverse'
/** Nominatim's usage policy: an identifying User-Agent, and at most one request a second for the whole app. */
const USER_AGENT = 'PasheAchi/1.0 (Pashe Achi service app; reverse geocoding for customer map pins)'
export const MIN_INTERVAL_MS = 1000
const TIMEOUT_MS = 5000
/** Pins already looked up, by coordinates rounded to about 11 m. */
const CACHE_SIZE = 500
/** With this many lookups already waiting, answer null at once rather than make the customer wait. */
const MAX_WAITING = 10

/**
 * The area names between the road and the city, finest first. Nominatim sends only the ones
 * OpenStreetMap has for the spot: in Dhaka typically a housing area (residential), a sector or
 * block (quarter) and the suburb; outside cities a village or town.
 */
const AREA_KEYS = [
  'residential',
  'hamlet',
  'isolated_dwelling',
  'allotments',
  'industrial',
  'commercial',
  'retail',
  'city_block',
  'neighbourhood',
  'quarter',
  'suburb',
  'borough',
  'city_district',
  'village',
  'town',
] as const
/** Outside a city: the pourashava, the upazila and the district. Inside one they only repeat it ("ঢাকা মহানগর", "ঢাকা জেলা"). */
const REGION_KEYS = ['municipality', 'county', 'state_district'] as const
/** A road known only by its number (N5, Z1219) tells a rider nothing. */
const ROAD_CODE = /^[A-Z]{1,2}-?\d+$/i

/** The parts of Nominatim's jsonv2 reverse response we use. */
export interface NominatimResult {
  name?: string
  display_name?: string
  address?: Partial<Record<'house_number' | 'road' | (typeof AREA_KEYS)[number] | 'city' | (typeof REGION_KEYS)[number] | 'postcode' | 'country', string>>
  error?: string
}

/**
 * The address for a pin, finest to coarsest, the way addresses are written in Bangladesh:
 * "রূপায়ন সিটি, সেক্টর ১২, নলভোগ, ঢাকা-১২৩১" or "House 57, Road 8A, Dhanmondi, Dhaka-1207".
 * Country and division are left out. In Bangla the house number and postcode get Bengali digits;
 * names stay as OpenStreetMap writes them.
 */
export function formatAddress(result: NominatimResult, lang: Lang): string | null {
  const a = result.address ?? {}
  const number = (value: string) => (lang === 'bn' ? toBnDigits(value.trim()) : value.trim())
  const house = a.house_number && (lang === 'bn' ? `বাসা ${number(a.house_number)}` : `House ${number(a.house_number)}`)
  const place = a.city ? [a.city] : REGION_KEYS.map(key => a[key])
  const parts = [result.name, house, a.road, ...AREA_KEYS.map(key => a[key]), ...place]
  const unique = parts.map(part => part?.trim()).filter((part, index, all): part is string => !!part && !ROAD_CODE.test(part) && all.indexOf(part) === index)
  if (unique.length) {
    if (a.postcode?.trim()) unique.push(`${unique.pop()}-${number(a.postcode)}`)
    return unique.join(', ').slice(0, 300)
  }
  const fallback = result.display_name
    ?.split(',')
    .map(part => part.trim())
    .filter(part => part && part !== a.postcode && part !== a.country)
  return fallback?.length ? fallback.join(', ').slice(0, 300) : null
}

/**
 * Turns a map pin into address text with OpenStreetMap's Nominatim. Lookups go one at a time, at
 * least a second apart, and are cached. Any failure answers null: the customer types the address.
 */
@Injectable()
export class GeoService {
  private readonly logger = new Logger(GeoService.name)
  private readonly cache = new Map<string, string | null>()
  private queue: Promise<unknown> = Promise.resolve()
  private lastCallAt = 0
  private waiting = 0

  async reverse({ lat, lng, lang }: ReverseGeocodeQuery): Promise<ReverseGeocodeDto> {
    const key = `${lat.toFixed(4)},${lng.toFixed(4)},${lang}`
    if (this.cache.has(key)) return { address: this.cache.get(key) ?? null }
    if (this.waiting >= MAX_WAITING) return { address: null }

    this.waiting++
    try {
      const address = await this.oneAtATime(() => this.lookup(lat, lng, lang))
      this.remember(key, address)
      return { address }
    } catch (error) {
      this.logger.warn(`Reverse geocoding failed: ${(error as Error).message}`)
      return { address: null }
    } finally {
      this.waiting--
    }
  }

  private oneAtATime<T>(task: () => Promise<T>): Promise<T> {
    const run = this.queue.then(async () => {
      const wait = this.lastCallAt + MIN_INTERVAL_MS - Date.now()
      if (wait > 0) await new Promise(resolve => setTimeout(resolve, wait))
      this.lastCallAt = Date.now()
      return task()
    })
    this.queue = run.catch(() => undefined)
    return run
  }

  private async lookup(lat: number, lng: number, lang: Lang): Promise<string | null> {
    const params = new URLSearchParams({ format: 'jsonv2', lat: String(lat), lon: String(lng), zoom: '18', addressdetails: '1', 'accept-language': lang === 'bn' ? 'bn,en' : 'en' })
    const response = await fetch(`${NOMINATIM_REVERSE_URL}?${params}`, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    return formatAddress((await response.json()) as NominatimResult, lang)
  }

  private remember(key: string, address: string | null) {
    if (this.cache.size >= CACHE_SIZE) this.cache.delete(this.cache.keys().next().value as string)
    this.cache.set(key, address)
  }
}
