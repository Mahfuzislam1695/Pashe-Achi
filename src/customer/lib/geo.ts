import type { GeoPoint } from '@/shared'

/**
 * The device's current position. Browsers offer it only on HTTPS (or localhost) and after the
 * customer allows it; anything else rejects, and the screen shows `location.unavailable`.
 */
export function getCurrentPosition(): Promise<GeoPoint> {
  return new Promise((resolve, reject) => {
    if (!window.isSecureContext || !('geolocation' in navigator)) return reject(new Error('unavailable'))
    navigator.geolocation.getCurrentPosition(
      position => resolve({ lat: position.coords.latitude, lng: position.coords.longitude }),
      reject,
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 30_000 },
    )
  })
}
