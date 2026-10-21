'use client'

import 'leaflet/dist/leaflet.css'

import { DHAKA_CENTER, type GeoPoint } from '@/shared'
import { useEffect } from 'react'
import { MapContainer, TileLayer, useMap, useMapEvents } from 'react-leaflet'

// OpenStreetMap's own tiles: free, no key. Their policy asks for the credit below and light use;
// a busy production site should switch TILE_URL to a tile provider.
const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
const ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>'
const PIN_ZOOM = 17
const CITY_ZOOM = 13

/** Six decimals is about 10 cm: plenty, and tidier to store. */
const round = (value: number) => Math.round(value * 1e6) / 1e6

export interface MapTarget {
  point: GeoPoint
  /** Changes on every request, so asking for the same place twice still moves the map. */
  seq: number
}

/**
 * The map behind the fixed centre pin (drawn by LocationSheet): the customer drags the map and
 * the point under the pin is the location. Leaflet needs the browser, so this file is loaded
 * with next/dynamic and ssr: false.
 */
export function MapPicker({
  start,
  target,
  onMove,
  onDragStart,
  label,
}: {
  start: GeoPoint | null
  target: MapTarget | null
  onMove: (center: GeoPoint) => void
  /** The customer started dragging the map (never fired by FlyTo). */
  onDragStart?: () => void
  label: string
}) {
  return (
    <MapContainer center={start ?? DHAKA_CENTER} zoom={start ? PIN_ZOOM : CITY_ZOOM} className="map-canvas">
      <TileLayer url={TILE_URL} attribution={ATTRIBUTION} maxZoom={19} />
      <CenterWatcher onMove={onMove} onDragStart={onDragStart} />
      <FlyTo target={target} />
      <KeepSized label={label} />
    </MapContainer>
  )
}

function CenterWatcher({ onMove, onDragStart }: { onMove: (center: GeoPoint) => void; onDragStart?: () => void }) {
  const map = useMapEvents({
    dragstart: () => onDragStart?.(),
    moveend: () => {
      const center = map.getCenter()
      onMove({ lat: round(center.lat), lng: round(center.lng) })
    },
  })
  return null
}

function FlyTo({ target }: { target: MapTarget | null }) {
  const map = useMap()
  useEffect(() => {
    if (!target) return
    const zoom = Math.max(map.getZoom(), PIN_ZOOM)
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduceMotion) map.setView(target.point, zoom)
    else map.flyTo(target.point, zoom, { duration: 0.8 })
  }, [map, target])
  return null
}

/** Names the map for screen readers and redraws it whenever its box changes size (the sheet opening, rotating a phone). */
function KeepSized({ label }: { label: string }) {
  const map = useMap()
  useEffect(() => {
    const container = map.getContainer()
    container.setAttribute('aria-label', label)
    const observer = new ResizeObserver(() => map.invalidateSize())
    observer.observe(container)
    return () => observer.disconnect()
  }, [map, label])
  return null
}
