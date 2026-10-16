import { Logger } from '@nestjs/common'

import { formatAddress, GeoService, MIN_INTERVAL_MS } from './geo.service'

const reply = (body: object, ok = true) => Promise.resolve({ ok, status: ok ? 200 : 503, json: () => Promise.resolve(body) } as Response)
const mockFetch = () => jest.spyOn(globalThis, 'fetch')

describe('formatAddress', () => {
  it('keeps the place, house and road, area and city, without postcode or country', () => {
    const result = formatAddress({
      name: 'Mirpur Stadium',
      address: { house_number: '12', road: 'Road 3', neighbourhood: 'Section 2', suburb: 'Mirpur', city: 'Dhaka', postcode: '1216', country: 'Bangladesh' },
    })
    expect(result).toBe('Mirpur Stadium, 12 Road 3, Section 2, Mirpur, Dhaka')
  })

  it('drops parts that repeat', () => {
    expect(formatAddress({ name: 'Road 3', address: { road: 'Road 3', suburb: 'Mirpur', city: 'Dhaka' } })).toBe('Road 3, Mirpur, Dhaka')
  })

  it('falls back to the display name, minus postcode and country', () => {
    expect(formatAddress({ display_name: 'Somewhere, Dhaka, 1216, Bangladesh', address: { postcode: '1216', country: 'Bangladesh' } })).toBe('Somewhere, Dhaka')
  })

  it('is null when nothing was found', () => {
    expect(formatAddress({ error: 'Unable to geocode' })).toBeNull()
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
