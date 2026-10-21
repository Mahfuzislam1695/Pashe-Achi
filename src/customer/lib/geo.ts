import type { GeoPoint } from '@/shared'

export interface DevicePosition {
  point: GeoPoint
  /** Metres. A phone's GPS is within a few dozen; a laptop on Wi-Fi or IP can be off by hundreds or more. */
  accuracy: number
}

/**
 * The device's current position. Browsers offer it only on HTTPS (or localhost) and after the
 * customer allows it; anything else rejects, and the screen shows `location.unavailable`.
 */
export function getCurrentPosition(): Promise<DevicePosition> {
  return new Promise((resolve, reject) => {
    if (!window.isSecureContext || !('geolocation' in navigator)) return reject(new Error('unavailable'))
    navigator.geolocation.getCurrentPosition(
      position => resolve({ point: { lat: position.coords.latitude, lng: position.coords.longitude }, accuracy: position.coords.accuracy }),
      reject,
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 30_000 },
    )
  })
}
