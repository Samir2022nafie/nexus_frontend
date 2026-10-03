"use client";

import * as React from "react";
import { useState, useEffect, useRef, useMemo } from "react";
import {
  MapPin,
  Search,
  Loader2,
  X,
  Compass,
  Navigation,
  Check,
  Lock,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { cn } from "cn";

export interface LocationData {
  name: string;
  latitude: number | null;
  longitude: number | null;
}

interface LocationInputProps {
  label?: string;
  value?: string;
  latitude?: number | null;
  longitude?: number | null;
  placeholder?: string;
  hint?: string;
  error?: string;
  onChangeLocation: (location: LocationData) => void;
  showPrivacyToggle?: boolean;
  isPrivate?: boolean;
  onPrivacyChange?: (isPrivate: boolean) => void;
  privacyLabel?: string;
  privacyHint?: string;
  className?: string;
  disabled?: boolean;
}

interface NominatimResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  name?: string;
  address?: {
    road?: string;
    pedestrian?: string;
    suburb?: string;
    neighbourhood?: string;
    city_district?: string;
    city?: string;
    town?: string;
    village?: string;
    county?: string;
    state?: string;
    country?: string;
    amenity?: string;
    leisure?: string;
    building?: string;
    tourism?: string;
    shop?: string;
    office?: string;
    commercial?: string;
    historic?: string;
    club?: string;
    craft?: string;
  };
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
  const [inputText, setInputText] = useState(value);
  const [currentLat, setCurrentLat] = useState<number | null>(latitude);
  const [currentLng, setCurrentLng] = useState<number | null>(longitude);
  const [suggestions, setSuggestions] = useState<NominatimResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [isMapOpen, setIsMapOpen] = useState(false);

  // Map Picker Modal State
  const [modalLat, setModalLat] = useState<number>(latitude ?? 9.03);
  const [modalLng, setModalLng] = useState<number>(longitude ?? 38.74);
  const [modalName, setModalName] = useState(value);
  const [mapSearchText, setMapSearchText] = useState("");
  const [mapSearchResults, setMapSearchResults] = useState<NominatimResult[]>([]);
  const [isMapSearching, setIsMapSearching] = useState(false);
  const [showMapResults, setShowMapResults] = useState(false);
  const [isReverseGeocoding, setIsReverseGeocoding] = useState(false);
  const [isLocatingGps, setIsLocatingGps] = useState(false);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const mapSearchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    setInputText(value);
  }, [value]);

  useEffect(() => {
    setCurrentLat(latitude);
    setCurrentLng(longitude);
  }, [latitude, longitude]);

  // Click outside listener for dropdown
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Format clean place name from Nominatim (matching mobile app venue & address hierarchy)
  const formatNominatimName = (item: NominatimResult, clickedPlaceName?: string): string => {
    const addr = item.address || {};
    const venue =
      clickedPlaceName ||
      addr.amenity ||
      addr.leisure ||
      addr.building ||
      addr.tourism ||
      addr.shop ||
      addr.office ||
      addr.commercial ||
      addr.historic ||
      addr.club ||
      addr.craft ||
      (item.name &&
      item.name !== addr.road &&
      item.name !== addr.city &&
      item.name !== addr.country
        ? item.name
        : "");

    const street = addr.road || addr.pedestrian || "";
    const suburb = addr.suburb || addr.neighbourhood || addr.city_district || "";
    const city = addr.city || addr.town || addr.village || addr.county || "";
    const country = addr.country || "";

    const addressParts: string[] = [];
    if (street) addressParts.push(street);
    else if (suburb) addressParts.push(suburb);
    if (city) addressParts.push(city);

    let baseAddress = addressParts.join(", ");
    if (!baseAddress) {
      if (item.display_name) {
        const parts = item.display_name.split(",").map((p) => p.trim());
        baseAddress = parts.slice(0, 2).join(", ");
      } else {
        baseAddress = country || "Pinned Location";
      }
    }

    if (venue) {
      if (!baseAddress.toLowerCase().includes(venue.toLowerCase())) {
        return `${venue}, ${baseAddress}`;
      }
      return baseAddress;
    }
    return baseAddress;
  };

  // Reverse geocode coords to place name using exact mobile app routine
  const reverseGeocode = async (lat: number, lng: number, clickedPlaceName?: string) => {
    setIsReverseGeocoding(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
        {
          headers: {
            "User-Agent": "NexusAdmin/1.0",
            "Accept-Language": "en",
          },
        }
      );
      if (res.ok) {
        const data: NominatimResult = await res.json();
        const formatted = formatNominatimName(data, clickedPlaceName);
        setModalName(formatted);
      }
    } catch (err) {
      console.error("Reverse geocode failed:", err);
    } finally {
      setIsReverseGeocoding(false);
    }
  };

  // Handle direct text changes in main input
  const handleInputChange = (text: string) => {
    setInputText(text);
    onChangeLocation({
      name: text,
      latitude: currentLat,
      longitude: currentLng,
    });

    if (!text.trim() || text.length < 3) {
      setSuggestions([]);
      setShowDropdown(false);
      return;
    }

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
            text
          )}&format=json&addressdetails=1&limit=5`,
          {
            headers: {
              "User-Agent": "NexusAdmin/1.0",
              "Accept-Language": "en",
            },
          }
        );
        const data: NominatimResult[] = await res.json();
        setSuggestions(data || []);
        setShowDropdown((data || []).length > 0);
      } catch {
        setSuggestions([]);
      } finally {
        setIsSearching(false);
      }
    }, 450);
  };

  const handleSelectSuggestion = (item: NominatimResult) => {
    const formatted = formatNominatimName(item);
    const lat = parseFloat(item.lat);
    const lng = parseFloat(item.lon);

    setInputText(formatted);
    setCurrentLat(lat);
    setCurrentLng(lng);
    setShowDropdown(false);

    onChangeLocation({
      name: formatted,
      latitude: lat,
      longitude: lng,
    });
  };

  const modalCoordsRef = useRef({ lat: modalLat, lng: modalLng });
  useEffect(() => {
    modalCoordsRef.current = { lat: modalLat, lng: modalLng };
  }, [modalLat, modalLng]);

  // Open Map Picker
  const handleOpenMap = () => {
    if (disabled) return;
    const lat = currentLat ?? 9.03;
    const lng = currentLng ?? 38.74;
    setModalLat(lat);
    setModalLng(lng);
    modalCoordsRef.current = { lat, lng };
    setModalName(inputText || "");
    setMapSearchText("");
    setMapSearchResults([]);
    setShowMapResults(false);
    setIsMapOpen(true);
  };

  // Send resize and coordinate sync to iframe map when dialog is opened
  useEffect(() => {
    if (isMapOpen) {
      const syncMap = () => {
        if (iframeRef.current?.contentWindow) {
          iframeRef.current.contentWindow.postMessage({ type: "MAP_RESIZE" }, "*");
          iframeRef.current.contentWindow.postMessage(
            { type: "MAP_PAN_TO", lat: modalCoordsRef.current.lat, lng: modalCoordsRef.current.lng, zoom: 14 },
            "*"
          );
        }
      };
      const t1 = setTimeout(syncMap, 200);
      const t2 = setTimeout(syncMap, 600);
      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
      };
    }
  }, [isMapOpen]);

  // Listen to postMessage from iframe (matching mobile app location_selected format)
  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (!event.data) return;
      if (
        event.data.type === "location_selected" ||
        event.data.type === "MAP_LOCATION_PICKED"
      ) {
        const lat = Number(event.data.lat.toFixed(6));
        const lng = Number(event.data.lng.toFixed(6));
        setModalLat(lat);
        setModalLng(lng);
        modalCoordsRef.current = { lat, lng };
        reverseGeocode(lat, lng, event.data.placeName);
      } else if (event.data.type === "MAP_READY") {
        if (iframeRef.current?.contentWindow) {
          iframeRef.current.contentWindow.postMessage({ type: "MAP_RESIZE" }, "*");
          iframeRef.current.contentWindow.postMessage(
            { type: "MAP_PAN_TO", lat: modalCoordsRef.current.lat, lng: modalCoordsRef.current.lng, zoom: 14 },
            "*"
          );
        }
      }
    }

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  // Map search inside modal with debounce & results list
  const handleMapSearchQueryChange = (val: string) => {
    setMapSearchText(val);
    if (!val.trim()) {
      setMapSearchResults([]);
      setShowMapResults(false);
      return;
    }

    if (mapSearchTimeoutRef.current) {
      clearTimeout(mapSearchTimeoutRef.current);
    }

    mapSearchTimeoutRef.current = setTimeout(async () => {
      setIsMapSearching(true);
      setShowMapResults(true);
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
            val.trim()
          )}&limit=5&addressdetails=1`,
          {
            headers: {
              "User-Agent": "NexusAdmin/1.0",
              "Accept-Language": "en",
            },
          }
        );
        if (res.ok) {
          const data: NominatimResult[] = await res.json();
          setMapSearchResults(data || []);
        }
      } catch (err) {
        console.error("Map search error:", err);
      } finally {
        setIsMapSearching(false);
      }
    }, 400);
  };

  const handleSelectMapSearchResult = (item: NominatimResult) => {
    const lat = Number(parseFloat(item.lat).toFixed(6));
    const lng = Number(parseFloat(item.lon).toFixed(6));
    const name = formatNominatimName(item);

    setModalLat(lat);
    setModalLng(lng);
    modalCoordsRef.current = { lat, lng };
    setModalName(name);
    setShowMapResults(false);
    setMapSearchText("");

    if (iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage(
        { type: "MAP_PAN_TO", lat, lng, zoom: 15 },
        "*"
      );
    }
  };

  // Reset map view to overview
  const handleResetView = () => {
    if (iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage({ type: "MAP_RESET_VIEW" }, "*");
    }
  };

  // Fly to current GPS location using browser navigator.geolocation
  const handleFlyToGpsLocation = () => {
    if (!navigator.geolocation) {
      toast.error("Geolocation is not supported by your browser");
      return;
    }
    setIsLocatingGps(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsLocatingGps(false);
        const lat = Number(pos.coords.latitude.toFixed(6));
        const lng = Number(pos.coords.longitude.toFixed(6));
        setModalLat(lat);
        setModalLng(lng);
        modalCoordsRef.current = { lat, lng };
        reverseGeocode(lat, lng);

        if (iframeRef.current?.contentWindow) {
          iframeRef.current.contentWindow.postMessage(
            { type: "MAP_PAN_TO", lat, lng, zoom: 15 },
            "*"
          );
        }
      },
      (err) => {
        setIsLocatingGps(false);
        toast.error(err.message || "Failed to acquire GPS location");
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  const handleConfirmMapSelection = () => {
    if (Math.abs(modalLat) < 0.5 && Math.abs(modalLng) < 0.5) {
      toast.warning("Locations cannot be placed on the ocean. Please select a valid place on land.");
      return;
    }

    const finalName = modalName.trim() || "Selected Location";
    setInputText(finalName);
    setCurrentLat(modalLat);
    setCurrentLng(modalLng);
    setIsMapOpen(false);

    onChangeLocation({
      name: finalName,
      latitude: modalLat,
      longitude: modalLng,
    });
  };

  // Bulletproof, 100% free open-source map: Leaflet 1.9.4 + OpenStreetMap (OSM)
  // Custom Dark Vector Engine:
  // - Water bodies: pure deep black (#070b11) with seamless navy (#18283e) vector zigzag waves
  // - Continents: solid dark slate vector skin (#28323c)
  // - Borders & Labels: high-contrast (#e2e8f0) country, region, city, and street labels
  // - Attribution links & mode toggle removed as requested
  // - Interactive draggable Nexus Gold Pin
  const mapHtml = useMemo(() => {
    return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body, html {
            width: 100%;
            height: 100%;
            overflow: hidden;
            background: #070b11;
          }
          #map {
            width: 100%;
            height: 100%;
            position: absolute;
            top: 0;
            left: 0;
            z-index: 1;
            background: #070b11 !important;
          }
          .leaflet-container {
            background: #070b11 !important;
            font-family: inherit;
          }

          /* Hide Leaflet & OpenStreetMap Contributors controls */
          .leaflet-control-attribution,
          .leaflet-control-attribution a,
          .leaflet-control-attribution span {
            display: none !important;
            visibility: hidden !important;
            opacity: 0 !important;
            pointer-events: none !important;
          }

          /* Sleek Dark Zoom & Navigation Controls */
          .leaflet-bar {
            border: 1px solid rgba(255, 255, 255, 0.15) !important;
            box-shadow: 0 4px 16px rgba(0, 0, 0, 0.5) !important;
            border-radius: 8px !important;
            overflow: hidden;
          }
          .leaflet-bar a {
            background-color: rgba(18, 24, 34, 0.95) !important;
            color: #e2e8f0 !important;
            border-bottom: 1px solid rgba(255, 255, 255, 0.08) !important;
            backdrop-filter: blur(8px);
            width: 32px !important;
            height: 32px !important;
            line-height: 32px !important;
            font-size: 16px !important;
            transition: background-color 0.2s, color 0.2s;
          }
          .leaflet-bar a:hover {
            background-color: #273344 !important;
            color: #e8a736 !important;
          }
          .leaflet-bar a:last-child {
            border-bottom: none !important;
          }

          /* Interactive Location Pin (Nexus Gold Pin) - Anchored at tip via transform */
          .picker-pin-wrap {
            display: flex;
            flex-direction: column;
            align-items: center;
            cursor: grab;
            user-select: none;
            -webkit-tap-highlight-color: transparent;
            transform: translate(-50%, -100%);
          }
          .picker-pin-wrap:active { cursor: grabbing; }
          .picker-pin-body {
            width: 38px;
            height: 38px;
            border-radius: 50% 50% 50% 0;
            transform: rotate(-45deg);
            background: #e8a736;
            border: 2.5px solid #ffffff;
            box-shadow: 0 4px 18px rgba(232, 167, 54, 0.9);
            display: flex;
            align-items: center;
            justify-content: center;
            transition: transform 0.15s ease;
          }
          .picker-pin-wrap:hover .picker-pin-body {
            transform: rotate(-45deg) scale(1.1);
          }
          .picker-pin-inner {
            transform: rotate(45deg);
            width: 14px;
            height: 14px;
            border-radius: 50%;
            background: #201e1c;
          }
          .picker-pin-shadow {
            width: 20px;
            height: 6px;
            background: rgba(0, 0, 0, 0.55);
            border-radius: 50%;
            margin-top: 3px;
            filter: blur(1px);
          }
        </style>
      </head>
      <body>
        <div id="map"></div>
        <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
        <script>
          var initialLat = 9.03;
          var initialLng = 38.74;

          var map = L.map('map', {
            center: [initialLat, initialLng],
            zoom: 14,
            minZoom: 2,
            maxZoom: 19,
            attributionControl: false,
            zoomControl: true,
            // Smooth mobile-grade zooming experience
            zoomSnap: 0.25,
            zoomDelta: 0.5,
            wheelPxPerZoomLevel: 100,
            wheelDebounceTime: 20,
            zoomAnimation: true,
            zoomAnimationThreshold: 8,
            fadeAnimation: true,
            markerZoomAnimation: true
          });

          // High-DPI Retina Dark Nexus Tile Engine:
          // Smooth anti-aliased font & icon rendering (eliminates pixelated 240p look)
          // Anti-aliased zigzag waves (#18283e) on pure black water (#070b11)
          // Solid dark slate continent skin (#28323c)
          var DarkNexusTileLayer = L.TileLayer.extend({
            createTile: function(coords, done) {
              var dpr = Math.min(window.devicePixelRatio || 1, 2);
              var tile = document.createElement('canvas');
              var w = Math.round(256 * dpr);
              var h = Math.round(256 * dpr);
              tile.width = w;
              tile.height = h;
              tile.style.width = '256px';
              tile.style.height = '256px';
              var ctx = tile.getContext('2d');
              ctx.imageSmoothingEnabled = true;
              ctx.imageSmoothingQuality = 'high';

              var img = new Image();
              img.crossOrigin = 'anonymous';
              img.onload = function() {
                ctx.drawImage(img, 0, 0, w, h);
                try {
                  var imgData = ctx.getImageData(0, 0, w, h);
                  var data = imgData.data;

                  var worldTileX = coords.x * 256;
                  var worldTileY = coords.y * 256;

                  for (var y = 0; y < h; y++) {
                    var normY = worldTileY + (y / dpr);
                    for (var x = 0; x < w; x++) {
                      var idx = (y * w + x) * 4;
                      var r = data[idx];
                      var g = data[idx + 1];
                      var b = data[idx + 2];

                      // Detect water bodies in OpenStreetMap tiles (#aad3df / #b5d0d0)
                      if (b > r + 20 && b >= g - 8 && r < 210 && b > 155) {
                        var normX = worldTileX + (x / dpr);
                        var localY = ((normY % 32) + 32) % 32;
                        var localX = ((normX % 64) + 64) % 64;
                        var wave1 = 8 + Math.sin((localX / 64) * Math.PI * 2) * 4.2;
                        var wave2 = 24 + Math.sin((localX / 64) * Math.PI * 2) * 4.2;
                        var dist = Math.min(Math.abs(localY - wave1), Math.abs(localY - wave2));

                        if (dist < 1.8) {
                          var factor = Math.max(0, 1 - dist / 1.8);
                          data[idx] = Math.round(0x07 + factor * (0x18 - 0x07));
                          data[idx + 1] = Math.round(0x0b + factor * (0x28 - 0x0b));
                          data[idx + 2] = Math.round(0x11 + factor * (0x3e - 0x11));
                        } else {
                          data[idx] = 0x07;     // Pure black ocean
                          data[idx + 1] = 0x0b;
                          data[idx + 2] = 0x11;
                        }
                      } else {
                        // Continent landmass
                        if (r > 220 && g > 180 && b < 160) {
                          // Major highways (warm yellow/orange in OSM)
                          data[idx] = 0x3a;
                          data[idx + 1] = 0x4a;
                          data[idx + 2] = 0x5e;
                        } else {
                          var brightness = (r * 299 + g * 587 + b * 114) / 1000;
                          // Smooth anti-aliasing: preserves crisp text, icons (hospitals, cafes, roads) & boundaries
                          var textFactor = Math.max(0, Math.min(1, (230 - brightness) / 170));
                          data[idx] = Math.round(0x28 + textFactor * (0xe2 - 0x28));
                          data[idx + 1] = Math.round(0x32 + textFactor * (0xe8 - 0x32));
                          data[idx + 2] = Math.round(0x3c + textFactor * (0xf0 - 0x3c));
                        }
                      }
                    }
                  }
                  ctx.putImageData(imgData, 0, 0);
                } catch(err) {}
                done(null, tile);
              };
              img.onerror = function(err) {
                done(err, tile);
              };
              img.src = this.getTileUrl(coords);
              return tile;
            }
          });

          new DarkNexusTileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            subdomains: ['a', 'b', 'c'],
            maxZoom: 19
          }).addTo(map);

          // Custom Nexus Gold Pin Icon
          var nexusPinIcon = L.divIcon({
            className: 'custom-nexus-marker',
            html: '<div class="picker-pin-wrap"><div class="picker-pin-body"><div class="picker-pin-inner"></div></div><div class="picker-pin-shadow"></div></div>',
            iconSize: [38, 44],
            iconAnchor: [19, 44]
          });

          var marker = L.marker([initialLat, initialLng], {
            icon: nexusPinIcon,
            draggable: true
          }).addTo(map);

          function sendLocation(lat, lng) {
            var data = {
              type: 'location_selected',
              lat: lat,
              lng: lng
            };
            if (window.parent) {
              window.parent.postMessage(data, '*');
            }
          }

          marker.on('dragend', function() {
            var pos = marker.getLatLng();
            sendLocation(pos.lat, pos.lng);
          });

          map.on('click', function(e) {
            marker.setLatLng(e.latlng);
            sendLocation(e.latlng.lat, e.latlng.lng);
          });

          // Parent-child communication
          window.addEventListener('message', function(event) {
            if (!event.data) return;
            if (event.data.type === 'MAP_PAN_TO') {
              var targetLat = event.data.lat;
              var targetLng = event.data.lng;
              var targetZoom = event.data.zoom || 15;
              map.setView([targetLat, targetLng], targetZoom, { animate: true });
              marker.setLatLng([targetLat, targetLng]);
            } else if (event.data.type === 'MAP_RESET_VIEW') {
              map.setView([9.03, 38.74], 12, { animate: true });
            } else if (event.data.type === 'MAP_RESIZE') {
              map.invalidateSize();
            }
          });

          map.whenReady(function() {
            map.invalidateSize();
            if (window.parent) {
              window.parent.postMessage({ type: 'MAP_READY' }, '*');
            }
          });

          setTimeout(function() { map.invalidateSize(); }, 200);
          setTimeout(function() { map.invalidateSize(); }, 600);
        </script>
      </body>
    </html>
    `;
  }, []);

  return (
    <div className={cn("space-y-2", className)} ref={dropdownRef}>
      {label && (
        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </Label>
      )}

      <div className="relative flex items-center">
        <div className="absolute left-2.5 text-muted-foreground pointer-events-none">
          {isSearching ? (
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
          ) : (
            <MapPin className="h-4 w-4 text-primary" />
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
              className="h-7 w-7 text-muted-foreground hover:text-foreground cursor-pointer"
              onClick={() => {
                setInputText("");
                setCurrentLat(null);
                setCurrentLng(null);
                onChangeLocation({ name: "", latitude: null, longitude: null });
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
            className="h-7 px-2.5 text-xs font-semibold gap-1.5 bg-primary/10 hover:bg-primary/20 text-primary border-primary/30 transition-colors cursor-pointer"
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
              className="w-full px-3 py-2 text-left text-xs hover:bg-accent flex items-start gap-2 transition-colors cursor-pointer"
              onClick={() => handleSelectSuggestion(item)}
            >
              <MapPin className="h-3.5 w-3.5 mt-0.5 text-primary shrink-0" />
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
              <Label
                className="text-xs font-medium cursor-pointer"
                htmlFor="location-privacy-switch"
              >
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

      {/* Interactive Map Picker Modal — Exact Match to Mobile 3D Globe & Styling */}
      <Dialog open={isMapOpen} onOpenChange={setIsMapOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[92vh] flex flex-col p-0 gap-0 overflow-hidden border-border bg-card shadow-2xl">
          <DialogHeader className="p-3.5 pb-2.5 border-b border-border/50 shrink-0 flex flex-row items-center justify-between">
            <DialogTitle className="flex items-center gap-2 text-base font-bold text-foreground">
              <Compass className="h-4 w-4 text-primary" />
              Select Location
            </DialogTitle>
          </DialogHeader>

          {/* Search Bar matching mobile app */}
          <div className="relative p-2.5 bg-muted/30 border-b border-border/50 shrink-0">
            <div className="relative flex items-center">
              <Search className="absolute left-2.5 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Search place, street, or city..."
                value={mapSearchText}
                onChange={(e) => handleMapSearchQueryChange(e.target.value)}
                className="pl-8 pr-8 h-8 text-xs bg-background border-border/60"
              />
              {isMapSearching ? (
                <Loader2 className="absolute right-2.5 h-3.5 w-3.5 animate-spin text-primary" />
              ) : mapSearchText ? (
                <button
                  type="button"
                  onClick={() => {
                    setMapSearchText("");
                    setMapSearchResults([]);
                    setShowMapResults(false);
                  }}
                  className="absolute right-2.5 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </div>

            {/* Live Search Results Overlay */}
            {showMapResults && mapSearchResults.length > 0 && (
              <div className="absolute left-2.5 right-2.5 top-12 z-50 rounded-lg border border-border bg-popover text-popover-foreground shadow-xl overflow-hidden divide-y divide-border/40 max-h-48 overflow-y-auto">
                {mapSearchResults.map((item) => (
                  <button
                    key={item.place_id}
                    type="button"
                    className="w-full px-3 py-2 text-left text-xs hover:bg-accent flex items-start gap-2 transition-colors cursor-pointer"
                    onClick={() => handleSelectMapSearchResult(item)}
                  >
                    <MapPin className="h-3.5 w-3.5 mt-0.5 text-primary shrink-0" />
                    <div className="truncate">
                      <p className="font-medium text-foreground truncate">
                        {formatNominatimName(item)}
                      </p>
                      <p className="text-[10px] text-muted-foreground truncate">
                        {item.display_name}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Map View Frame with Floating Controls */}
          <div className="relative h-[340px] sm:h-[400px] w-full bg-[#090d12] overflow-hidden shrink-0">
            <iframe
              ref={iframeRef}
              srcDoc={mapHtml}
              title="Location Picker Map"
              className="w-full h-full border-none"
            />

            {/* Instruction pill matching mobile */}
            <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-background/85 backdrop-blur-md text-[11px] font-medium text-foreground px-3 py-1 rounded-full shadow-lg border border-border/60 pointer-events-none flex items-center gap-1.5 z-10">
              <Compass className="size-3.5 text-primary" />
              <span>Tap map or drag pin to choose location</span>
            </div>

            {/* Floating Actions (Reset View & GPS) */}
            <div className="absolute right-3 bottom-3 flex flex-col gap-2 z-10">
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={handleResetView}
                className="size-8 rounded-full bg-background/90 backdrop-blur-md border-border/80 shadow-md hover:bg-muted text-foreground cursor-pointer"
                title="Reset map view"
              >
                <Compass className="size-4 text-primary" />
              </Button>

              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={handleFlyToGpsLocation}
                disabled={isLocatingGps}
                className="size-8 rounded-full bg-background/90 backdrop-blur-md border-border/80 shadow-md hover:bg-muted text-foreground cursor-pointer"
                title="Use current GPS location"
              >
                {isLocatingGps ? (
                  <Loader2 className="size-4 animate-spin text-primary" />
                ) : (
                  <Navigation className="size-4 text-primary" />
                )}
              </Button>
            </div>
          </div>

          {/* Bottom Selection Sheet matching mobile */}
          <div className="p-3.5 border-t border-border/60 bg-card flex flex-col gap-3 shrink-0">
            <div className="flex items-center gap-3">
              <div className="size-9 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center shrink-0">
                <MapPin className="size-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground block">
                  Selected Place
                </span>
                {isReverseGeocoding ? (
                  <div className="flex items-center gap-1.5 mt-0.5 text-xs text-muted-foreground">
                    <Loader2 className="size-3.5 animate-spin text-primary" />
                    <span>Finding address...</span>
                  </div>
                ) : (
                  <Input
                    value={modalName}
                    onChange={(e) => setModalName(e.target.value)}
                    placeholder="Enter or refine location name..."
                    className="h-8 text-xs font-semibold text-foreground px-2 mt-0.5"
                  />
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsMapOpen(false)}
                className="text-xs h-8"
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleConfirmMapSelection}
                disabled={!modalName.trim() || isReverseGeocoding}
                className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs h-8 gap-1.5 cursor-pointer"
              >
                <Check className="size-3.5" />
                <span>Select This Location</span>
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
