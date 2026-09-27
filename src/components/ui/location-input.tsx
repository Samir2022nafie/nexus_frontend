"use client"

import * as React from "react"
import { useState, useEffect, useRef } from "react"
import { MapPin, Search, Loader2, X, Compass, Lock, Globe } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { cn } from "cn"

export interface LocationData {
  name: string
  latitude: number | null
  longitude: number | null
}

interface LocationInputProps {
  label?: string
  value?: string
  latitude?: number | null
  longitude?: number | null
  placeholder?: string
  hint?: string
  error?: string
  onChangeLocation: (location: LocationData) => void
  showPrivacyToggle?: boolean
  isPrivate?: boolean
  onPrivacyChange?: (isPrivate: boolean) => void
  privacyLabel?: string
  privacyHint?: string
  className?: string
  disabled?: boolean
}

interface NominatimResult {
  place_id: number
  display_name: string
  lat: string
  lon: string
  address?: {
    city?: string
    town?: string
    village?: string
    suburb?: string
    county?: string
    state?: string
    country?: string
    road?: string
  }
}

export function LocationInput({
  label = "Location",
  value = "",
  latitude = null,
  longitude = null,
  placeholder = "Search location or pick on map...",
  hint,
  error,
  onChangeLocation,
  showPrivacyToggle = false,
  isPrivate = false,
  onPrivacyChange,
  privacyLabel = "Keep location private",
  privacyHint = "Only you can see this location on your profile",
  className,
  disabled = false,
}: LocationInputProps) {
  const [inputText, setInputText] = useState(value)
  const [currentLat, setCurrentLat] = useState<number | null>(latitude)
  const [currentLng, setCurrentLng] = useState<number | null>(longitude)
  const [suggestions, setSuggestions] = useState<NominatimResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const [isMapOpen, setIsMapOpen] = useState(false)

  // Map Picker Modal State
  const [initialCoords, setInitialCoords] = useState<{ lat: number; lng: number }>({
    lat: latitude ?? 9.03,
    lng: longitude ?? 38.74,
  })
  const [modalLat, setModalLat] = useState<number>(latitude ?? 9.03)
  const [modalLng, setModalLng] = useState<number>(longitude ?? 38.74)
  const [modalName, setModalName] = useState(value)
  const [mapSearchText, setMapSearchText] = useState("")
  const [isMapGeocoding, setIsMapGeocoding] = useState(false)

  const dropdownRef = useRef<HTMLDivElement>(null)
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const iframeRef = useRef<HTMLIFrameElement>(null)

  useEffect(() => {
    setInputText(value)
  }, [value])

  useEffect(() => {
    setCurrentLat(latitude)
    setCurrentLng(longitude)
  }, [latitude, longitude])

  // Click outside listener for dropdown
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  // Handle direct text changes
  const handleInputChange = (text: string) => {
    setInputText(text)
    onChangeLocation({
      name: text,
      latitude: currentLat,
      longitude: currentLng,
    })

    if (!text.trim() || text.length < 3) {
      setSuggestions([])
      setShowDropdown(false)
      return
    }

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }

    searchTimeoutRef.current = setTimeout(async () => {
      setIsSearching(true)
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
            text
          )}&format=json&addressdetails=1&limit=5`,
          {
            headers: {
              "Accept-Language": "en",
            },
          }
        )
        const data: NominatimResult[] = await res.json()
        setSuggestions(data || [])
        setShowDropdown((data || []).length > 0)
      } catch {
        setSuggestions([])
      } finally {
        setIsSearching(false)
      }
    }, 450)
  }

  // Format clean place name from Nominatim
  const formatNominatimName = (item: NominatimResult) => {
    if (item.address) {
      const parts = [
        item.address.road || item.address.suburb,
        item.address.city || item.address.town || item.address.village,
        item.address.state,
        item.address.country,
      ].filter(Boolean)
      if (parts.length >= 2) return parts.join(", ")
    }
    return item.display_name.split(",").slice(0, 3).join(",").trim()
  }

  const handleSelectSuggestion = (item: NominatimResult) => {
    const formatted = formatNominatimName(item)
    const lat = parseFloat(item.lat)
    const lng = parseFloat(item.lon)

    setInputText(formatted)
    setCurrentLat(lat)
    setCurrentLng(lng)
    setShowDropdown(false)

    onChangeLocation({
      name: formatted,
      latitude: lat,
      longitude: lng,
    })
  }

  // Open Map Picker
  const handleOpenMap = () => {
    if (disabled) return
    const lat = currentLat ?? 9.03
    const lng = currentLng ?? 38.74
    setInitialCoords({ lat, lng })
    setModalLat(lat)
    setModalLng(lng)
    setModalName(inputText || "")
    setMapSearchText("")
    setIsMapOpen(true)
  }

  // Send resize to iframe map when dialog is animated in
  useEffect(() => {
    if (isMapOpen) {
      const timer = setTimeout(() => {
        if (iframeRef.current?.contentWindow) {
          iframeRef.current.contentWindow.postMessage({ type: "MAP_RESIZE" }, "*")
        }
      }, 250)
      return () => clearTimeout(timer)
    }
  }, [isMapOpen])

  // Listen to postMessage from iframe
  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (!event.data || event.data.type !== "MAP_LOCATION_PICKED") return
      const { lat, lng } = event.data
      setModalLat(lat)
      setModalLng(lng)

      // Reverse geocode via Nominatim
      setIsMapGeocoding(true)
      fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`,
        {
          headers: { "Accept-Language": "en" },
        }
      )
        .then((r) => r.json())
        .then((res: NominatimResult) => {
          if (res) {
            const formatted = formatNominatimName(res)
            setModalName(formatted)
          }
        })
        .catch(() => {})
        .finally(() => setIsMapGeocoding(false))
    }

    window.addEventListener("message", handleMessage)
    return () => window.removeEventListener("message", handleMessage)
  }, [])

  // Map search inside dialog
  const handleMapSearch = async () => {
    if (!mapSearchText.trim()) return
    setIsMapGeocoding(true)
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
          mapSearchText
        )}&format=json&addressdetails=1&limit=1`,
        {
          headers: { "Accept-Language": "en" },
        }
      )
      const data = await res.json()
      if (data && data.length > 0) {
        const item = data[0]
        const lat = parseFloat(item.lat)
        const lng = parseFloat(item.lon)
        const formatted = formatNominatimName(item)
        setModalLat(lat)
        setModalLng(lng)
        setModalName(formatted)

        // Notify iframe map to pan and move marker without reloading
        if (iframeRef.current?.contentWindow) {
          iframeRef.current.contentWindow.postMessage(
            { type: "MAP_PAN_TO", lat, lng },
            "*"
          )
        }
      }
    } catch {
    } finally {
      setIsMapGeocoding(false)
    }
  }

  const handleConfirmMapSelection = () => {
    setInputText(modalName)
    setCurrentLat(modalLat)
    setCurrentLng(modalLng)
    setIsMapOpen(false)

    onChangeLocation({
      name: modalName,
      latitude: modalLat,
      longitude: modalLng,
    })
  }

  // Stable HTML content memoized to prevent iframe reload cycles on click
  const mapHtml = React.useMemo(() => {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
          <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
          <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            html, body, #map { height: 100%; width: 100%; margin: 0; padding: 0; overflow: hidden; background: #0b0f19; }
            .leaflet-container { background: #0b0f19 !important; font-family: inherit; }
            .leaflet-div-icon { background: transparent !important; border: none !important; }
            .leaflet-control-zoom {
              border: 1px solid rgba(255, 255, 255, 0.12) !important;
              box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4) !important;
              border-radius: 8px !important;
              overflow: hidden !important;
            }
            .leaflet-control-zoom a {
              background: #141b2d !important;
              color: #f1f5f9 !important;
              border-bottom: 1px solid rgba(255, 255, 255, 0.08) !important;
              width: 30px !important;
              height: 30px !important;
              line-height: 30px !important;
            }
            .leaflet-control-zoom a:hover {
              background: #1e293b !important;
              color: #e8a736 !important;
            }

            /* Cosmic Starry Atmosphere matching mobile */
            .cosmos-bg {
              position: absolute;
              top: 0;
              left: 0;
              width: 100%;
              height: 100%;
              background: radial-gradient(ellipse at 50% 50%, #0d1538 0%, #070c20 60%, #02040a 100%);
              z-index: 0;
              pointer-events: none;
            }

            /* Interactive Location Pin (Nexus Gold Pin matching mobile app) */
            .picker-pin-wrap {
              display: flex;
              flex-direction: column;
              align-items: center;
              cursor: grab;
              user-select: none;
              -webkit-tap-highlight-color: transparent;
            }
            .picker-pin-wrap:active { cursor: grabbing; }
            .picker-pin-body {
              width: 38px;
              height: 38px;
              border-radius: 50% 50% 50% 0;
              transform: rotate(-45deg);
              background: #e8a736;
              border: 2.5px solid #ffffff;
              box-shadow: 0 4px 18px rgba(232, 167, 54, 0.85);
              display: flex;
              align-items: center;
              justify-content: center;
            }
            .picker-pin-inner {
              transform: rotate(45deg);
              width: 14px;
              height: 14px;
              border-radius: 50%;
              background: #201e1c;
            }
            .picker-pin-shadow {
              width: 18px;
              height: 6px;
              background: rgba(0, 0, 0, 0.45);
              border-radius: 50%;
              margin-top: 3px;
            }
          </style>
        </head>
        <body>
          <div id="map"></div>
          <script>
            var lat = ${initialCoords.lat};
            var lng = ${initialCoords.lng};

            var map = L.map('map', {
              center: [lat, lng],
              zoom: 14,
              zoomControl: true,
              attributionControl: false
            });

            // CartoDB Dark Matter Raster Tiles (High performance, zero WebGL failure risk)
            L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
              subdomains: 'abcd',
              maxZoom: 20,
              detectRetina: true
            }).addTo(map);

            // Custom Gold Nexus Marker
            var goldIcon = L.divIcon({
              className: 'custom-gold-marker',
              html: '<div class="picker-pin-wrap"><div class="picker-pin-body"><div class="picker-pin-inner"></div></div><div class="picker-pin-shadow"></div></div>',
              iconSize: [38, 48],
              iconAnchor: [19, 44]
            });

            var marker = L.marker([lat, lng], {
              icon: goldIcon,
              draggable: true
            }).addTo(map);

            function triggerResize() {
              try { map.invalidateSize(); } catch(e) {}
            }
            triggerResize();
            setTimeout(triggerResize, 80);
            setTimeout(triggerResize, 250);
            setTimeout(triggerResize, 600);
            window.addEventListener('resize', triggerResize);

            marker.on('dragend', function () {
              var ll = marker.getLatLng();
              window.parent.postMessage({
                type: 'MAP_LOCATION_PICKED',
                lat: Number(ll.lat.toFixed(6)),
                lng: Number(ll.lng.toFixed(6))
              }, '*');
            });

            map.on('click', function (e) {
              marker.setLatLng(e.latlng);
              window.parent.postMessage({
                type: 'MAP_LOCATION_PICKED',
                lat: Number(e.latlng.lat.toFixed(6)),
                lng: Number(e.latlng.lng.toFixed(6))
              }, '*');
            });

            window.addEventListener('message', function(event) {
              if (!event.data) return;
              if (event.data.type === 'MAP_PAN_TO') {
                var newLat = event.data.lat;
                var newLng = event.data.lng;
                map.setView([newLat, newLng], 15, { animate: true });
                marker.setLatLng([newLat, newLng]);
              } else if (event.data.type === 'MAP_RESIZE') {
                triggerResize();
              }
            });
          </script>
        </body>
      </html>
    `
  }, [initialCoords.lat, initialCoords.lng])

  return (
    <div className={cn("space-y-2", className)} ref={dropdownRef}>
      {label && <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</Label>}

      <div className="relative flex items-center">
        <div className="absolute left-2.5 text-muted-foreground pointer-events-none">
          {isSearching ? (
            <Loader2 className="h-4 w-4 animate-spin text-amber-500" />
          ) : (
            <MapPin className="h-4 w-4 text-amber-500" />
          )}
        </div>

        <Input
          type="text"
          value={inputText}
          onChange={(e) => handleInputChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          className="pl-8 pr-20 h-9"
        />

        <div className="absolute right-1 flex items-center gap-1">
          {inputText ? (
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
              onClick={() => {
                setInputText("")
                setCurrentLat(null)
                setCurrentLng(null)
                onChangeLocation({ name: "", latitude: null, longitude: null })
              }}
              title="Clear location"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          ) : null}

          <Button
            type="button"
            variant="outline"
            size="xs"
            onClick={handleOpenMap}
            disabled={disabled}
            className="h-7 px-2 text-xs font-medium gap-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/30"
            title="Pick on interactive map"
          >
            <Compass className="h-3.5 w-3.5" />
            <span>Map</span>
          </Button>
        </div>
      </div>

      {/* Autocomplete Dropdown */}
      {showDropdown && suggestions.length > 0 && (
        <div className="absolute z-50 mt-1 w-full max-w-md rounded-lg border border-border bg-popover text-popover-foreground shadow-xl overflow-hidden divide-y divide-border/40">
          {suggestions.map((item) => (
            <button
              key={item.place_id}
              type="button"
              className="w-full px-3 py-2 text-left text-xs hover:bg-accent flex items-start gap-2 transition-colors"
              onClick={() => handleSelectSuggestion(item)}
            >
              <MapPin className="h-3.5 w-3.5 mt-0.5 text-amber-500 shrink-0" />
              <div className="truncate">
                <p className="font-medium text-foreground truncate">
                  {formatNominatimName(item)}
                </p>
                <p className="text-[11px] text-muted-foreground truncate">
                  {item.display_name}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Privacy Switch (For User Profiles / Registration) */}
      {showPrivacyToggle && (
        <div className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/30 p-2.5 mt-2">
          <div className="space-y-0.5">
            <div className="flex items-center gap-1.5">
              <Lock className="h-3.5 w-3.5 text-muted-foreground" />
              <Label className="text-xs font-medium cursor-pointer" htmlFor="location-privacy-switch">
                {privacyLabel}
              </Label>
            </div>
            <p className="text-[11px] text-muted-foreground">{privacyHint}</p>
          </div>
          <Switch
            id="location-privacy-switch"
            checked={isPrivate}
            onCheckedChange={onPrivacyChange}
          />
        </div>
      )}

      {hint && !error && (
        <p className="text-[11px] text-muted-foreground">{hint}</p>
      )}
      {error && <p className="text-[11px] text-destructive">{error}</p>}

      {/* Interactive Map Picker Modal */}
      <Dialog open={isMapOpen} onOpenChange={setIsMapOpen}>
        <DialogContent className="sm:max-w-xl max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden border-border bg-card shadow-2xl">
          <DialogHeader className="p-3.5 pb-2.5 border-b border-border/50 shrink-0">
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              <Compass className="h-4 w-4 text-amber-500" />
              Select Location
            </DialogTitle>
          </DialogHeader>

          {/* Map Top Bar: Search address */}
          <div className="p-2.5 bg-muted/40 border-b border-border/50 flex gap-2 shrink-0">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search city, neighborhood, or landmark..."
                value={mapSearchText}
                onChange={(e) => setMapSearchText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleMapSearch())}
                className="pl-8 h-8 text-xs bg-background"
              />
            </div>
            <Button
              type="button"
              size="xs"
              variant="secondary"
              onClick={handleMapSearch}
              disabled={isMapGeocoding}
              className="h-8 px-3 text-xs"
            >
              {isMapGeocoding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Search"}
            </Button>
          </div>

          {/* Map Frame */}
          <div className="relative h-[290px] sm:h-[330px] w-full bg-[#02040a] shrink-0">
            <iframe
              ref={iframeRef}
              srcDoc={mapHtml}
              title="Location Picker Map"
              className="w-full h-full border-none"
            />
            <div className="absolute top-2 right-2 bg-background/90 backdrop-blur-xs text-[10px] text-muted-foreground px-2 py-0.5 rounded shadow border border-border pointer-events-none">
              Click or drag pin to position
            </div>
          </div>

          {/* Editable Place Name Input */}
          <div className="p-3 space-y-1.5 border-t border-border/50 bg-card shrink-0">
            <Label className="text-xs font-semibold text-muted-foreground">
              Selected Location Name
            </Label>
            <div className="relative">
              <MapPin className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-amber-500" />
              <Input
                value={modalName}
                onChange={(e) => setModalName(e.target.value)}
                placeholder="Location name..."
                className="pl-8 h-8 text-xs font-medium"
              />
            </div>
          </div>

          <DialogFooter className="p-2.5 sm:p-3 bg-muted/20 border-t border-border/50 flex justify-end gap-2 shrink-0 mt-auto">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsMapOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleConfirmMapSelection}
              disabled={!modalName.trim()}
              className="bg-amber-500 hover:bg-amber-600 text-black font-semibold"
            >
              Confirm Location
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
