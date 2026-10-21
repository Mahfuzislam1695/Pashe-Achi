import { Logger } from '@nestjs/common'

import { formatAddress, GeoService, MIN_INTERVAL_MS } from './geo.service'

const reply = (body: object, ok = true) => Promise.resolve({ ok, status: ok ? 200 : 503, json: () => Promise.resolve(body) } as Response)
const mockFetch = () => jest.spyOn(globalThis, 'fetch')

// The address parts below are from Nominatim's real replies for these places (division and ISO codes left out).
const DHAKA = { city: 'ঢাকা', county: 'ঢাকা মহানগর', state_district: 'ঢাকা জেলা', country: 'বাংলাদেশ' }

describe('formatAddress', () => {
  it('keeps the place, house, road, areas and city, with the postcode after the city and no country', () => {
    const result = formatAddress(
      {
        name: 'Mirpur Stadium',
        address: { house_number: '12', road: 'Road 3', neighbourhood: 'Section 2', suburb: 'Mirpur', city: 'Dhaka', postcode: '1216', country: 'Bangladesh' },
      },
      'en',
    )
    expect(result).toBe('Mirpur Stadium, House 12, Road 3, Section 2, Mirpur, Dhaka-1216')
  })

  it('keeps the housing area and sector, not just the suburb (Nalbhog)', () => {
    const result = formatAddress({ name: '', address: { residential: 'রূপায়ন সিটি', quarter: 'সেক্টর ১২', suburb: 'নলভোগ', ...DHAKA, postcode: '1231' } }, 'bn')
    expect(result).toBe('রূপায়ন সিটি, সেক্টর ১২, নলভোগ, ঢাকা-১২৩১')
  })

  it('keeps the block beside the suburb (Kuril)', () => {
    const result = formatAddress({ name: 'সড়ক # ৬', address: { road: 'সড়ক # ৬', quarter: 'ব্লক সি', suburb: 'কুড়িল', ...DHAKA, postcode: '1229' } }, 'bn')
    expect(result).toBe('সড়ক # ৬, ব্লক সি, কুড়িল, ঢাকা-১২২৯')
  })

  it('writes the house in the local style, with Bengali digits in Bangla (Dhanmondi)', () => {
    const reply = {
      name: 'Corsa De Carena',
      address: { house_number: '57', road: 'Road 8A', residential: 'ধানমন্ডি আবাসিক এলাকা', quarter: 'মধুবাজার', suburb: 'ধানমন্ডি', ...DHAKA, postcode: '1207' },
    }
    expect(formatAddress(reply, 'bn')).toBe('Corsa De Carena, বাসা ৫৭, Road 8A, ধানমন্ডি আবাসিক এলাকা, মধুবাজার, ধানমন্ডি, ঢাকা-১২০৭')
    expect(formatAddress(reply, 'en')).toContain('House 57, Road 8A')
  })

  it('names the upazila and district outside a city, and drops a road known only by its code (Cumilla)', () => {
    const result = formatAddress(
      { name: 'Z1219', address: { road: 'Z1219', village: 'মালাপাড়া', county: 'বুড়িচং উপজেলা', state_district: 'কুমিল্লা জেলা', country: 'বাংলাদেশ' } },
      'bn',
    )
    expect(result).toBe('মালাপাড়া, বুড়িচং উপজেলা, কুমিল্লা জেলা')
  })

  it('drops parts that repeat', () => {
    expect(formatAddress({ name: 'Road 3', address: { road: 'Road 3', suburb: 'Mirpur', city: 'Dhaka' } }, 'en')).toBe('Road 3, Mirpur, Dhaka')
  })

  it('falls back to the display name, minus postcode and country', () => {
    expect(formatAddress({ display_name: 'Somewhere, Dhaka, 1216, Bangladesh', address: { postcode: '1216', country: 'Bangladesh' } }, 'en')).toBe('Somewhere, Dhaka')
  })

  it('is null when nothing was found', () => {
    expect(formatAddress({ error: 'Unable to geocode' }, 'bn')).toBeNull()
  })
})

describe('GeoService', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined)
  })
  afterEach(() => {
    jest.restoreAllMocks()
    jest.useRealTimers()
  })

  it('asks Nominatim once per place and caches the answer', async () => {
    const fetch = mockFetch().mockImplementation(() => reply({ address: { suburb: 'Mirpur', city: 'Dhaka' } }))
    const geo = new GeoService()
    await expect(geo.reverse({ lat: 23.80701, lng: 90.36802, lang: 'bn' })).resolves.toEqual({ address: 'Mirpur, Dhaka' })
    // About a metre away: the same place once rounded.
    await expect(geo.reverse({ lat: 23.80703, lng: 90.36804, lang: 'bn' })).resolves.toEqual({ address: 'Mirpur, Dhaka' })
    expect(fetch).toHaveBeenCalledTimes(1)

    const [url, init] = fetch.mock.calls[0]
    expect(String(url)).toContain('lat=23.80701')
    expect(String(url)).toContain('accept-language=bn%2Cen')
    expect((init?.headers as Record<string, string>)['User-Agent']).toMatch(/PasheAchi/)
  })

  it('keeps lookups at least a second apart', async () => {
    const fetch = mockFetch().mockImplementation(() => reply({ address: { city: 'Dhaka' } }))
    const geo = new GeoService()
    const first = geo.reverse({ lat: 23.7, lng: 90.4, lang: 'en' })
    const second = geo.reverse({ lat: 23.9, lng: 90.4, lang: 'en' })

    await jest.advanceTimersByTimeAsync(0)
    expect(fetch).toHaveBeenCalledTimes(1)
    await jest.advanceTimersByTimeAsync(MIN_INTERVAL_MS - 1)
    expect(fetch).toHaveBeenCalledTimes(1)
    await jest.advanceTimersByTimeAsync(1)
    expect(fetch).toHaveBeenCalledTimes(2)
    await expect(Promise.all([first, second])).resolves.toEqual([{ address: 'Dhaka' }, { address: 'Dhaka' }])
  })

  it('answers null when the lookup fails, and does not cache the failure', async () => {
    const fetch = mockFetch()
      .mockImplementationOnce(() => reply({}, false))
      .mockImplementationOnce(() => Promise.reject(new Error('timed out')))
    const geo = new GeoService()
    await expect(geo.reverse({ lat: 23.7, lng: 90.4, lang: 'bn' })).resolves.toEqual({ address: null })

    const again = geo.reverse({ lat: 23.7, lng: 90.4, lang: 'bn' })
    await jest.advanceTimersByTimeAsync(MIN_INTERVAL_MS)
    await expect(again).resolves.toEqual({ address: null })
    expect(fetch).toHaveBeenCalledTimes(2)
  })
})
