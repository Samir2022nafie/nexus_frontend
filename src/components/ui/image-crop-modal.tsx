"use client"

import * as React from "react"
import { useState, useRef, useEffect, useCallback, useMemo } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { ZoomIn, ZoomOut, RotateCcw, Check, X, Loader2 } from "lucide-react"

export type CropShape = "circle" | "wide-rectangle" | "rectangle"

export interface ImageCropModalProps {
  open: boolean
  imageUrl: string
  cropShape?: CropShape
  aspectRatio?: number // default 1 for circle, 16/9 for wide-rectangle
  targetRatio?: number
  title?: string
  onConfirm: (croppedUrl: string) => void
  onClose?: () => void
  onOpenChange?: (open: boolean) => void
}

export function ImageCropModal({
  open,
  imageUrl,
  cropShape = "circle",
  aspectRatio,
  targetRatio: propsTargetRatio,
  title,
  onConfirm,
  onClose,
  onOpenChange,
}: ImageCropModalProps) {
  const [imageLoaded, setImageLoaded] = useState(false)
  const [naturalSize, setNaturalSize] = useState<{ width: number; height: number } | null>(null)
  const [zoom, setZoom] = useState(1.0)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [cropping, setCropping] = useState(false)

  const imageRef = useRef<HTMLImageElement | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)

  // Fixed container width
  const boxWidth = cropShape === "circle" ? 280 : 360

  // Minimum height for rectangle post crop strictly enforced at 1:1 ratio
  const minPostHeight = boxWidth
  const maxPostHeight = 480

  // Dynamic vertically resizable height state for post images
  const [cropHeight, setCropHeight] = useState<number>(boxWidth)
  const isResizingTop = useRef(false)
  const isResizingBottom = useRef(false)
  const resizeStartY = useRef(0)
  const resizeStartHeight = useRef(boxWidth)

  // Clean base URL without any previous crop hash or query params
  const cleanUrl = useMemo(() => {
    if (!imageUrl) return ""
    let cleaned = imageUrl.trim()
    const hashIdx = cleaned.indexOf("#crop=")
    if (hashIdx !== -1) cleaned = cleaned.slice(0, hashIdx)
    cleaned = cleaned.replace(/[?&]crop=[^&#]+/, "").replace(/\?&/, "?").replace(/\?$/, "")
    return cleaned
  }, [imageUrl])

  // Active box height based on shape and dynamic crop height
  const activeBoxHeight = useMemo(() => {
    if (cropShape === "circle") {
      return boxWidth
    }
    if (cropShape === "wide-rectangle") {
      const targetRatio = propsTargetRatio ?? aspectRatio ?? 16 / 9
      return Math.round(boxWidth / targetRatio)
    }
    // Post image (rectangle)
    return cropHeight
  }, [cropShape, boxWidth, propsTargetRatio, aspectRatio, cropHeight])

  // Base scale calculation: image always covers the container completely
  const baseScale = naturalSize
    ? Math.max(boxWidth / naturalSize.width, activeBoxHeight / naturalSize.height)
    : 1
  const renderWidth = naturalSize ? naturalSize.width * baseScale * zoom : boxWidth * zoom
  const renderHeight = naturalSize ? naturalSize.height * baseScale * zoom : activeBoxHeight * zoom

  // Clamp pan so image never detaches from container edges
  const clampPan = useCallback(
    (newX: number, newY: number, currentZoom: number, currentBoxH: number) => {
      if (!naturalSize) return { x: 0, y: 0 }
      const scale = Math.max(boxWidth / naturalSize.width, currentBoxH / naturalSize.height)
      const w = naturalSize.width * scale * currentZoom
      const h = naturalSize.height * scale * currentZoom
      const maxX = Math.max(0, (w - boxWidth) / 2)
      const maxY = Math.max(0, (h - currentBoxH) / 2)
      return {
        x: Math.max(-maxX, Math.min(maxX, newX)),
        y: Math.max(-maxY, Math.min(maxY, newY)),
      }
    },
    [boxWidth, naturalSize]
  )

  // Reset or restore state when opening modal with an image
  useEffect(() => {
    if (!open || !imageUrl) {
      setImageLoaded(false)
      setNaturalSize(null)
      setZoom(1.0)
      setPan({ x: 0, y: 0 })
      return
    }

    setImageLoaded(false)
    setZoom(1.0)
    setPan({ x: 0, y: 0 })

    const img = new window.Image()
    img.crossOrigin = "anonymous"
    img.onload = () => {
      setNaturalSize({ width: img.naturalWidth, height: img.naturalHeight })
      setImageLoaded(true)

      if (cropShape === "rectangle") {
        const naturalRatio = img.naturalWidth / img.naturalHeight
        const naturalH = Math.round(boxWidth / naturalRatio)
        const initialH = Math.min(maxPostHeight, Math.max(minPostHeight, naturalH))
        setCropHeight(initialH)
      }
    }
    img.onerror = () => {
      setNaturalSize({ width: 800, height: 800 })
      setImageLoaded(true)
      if (cropShape === "rectangle") {
        setCropHeight(boxWidth)
      }
    }
    img.src = cleanUrl
  }, [open, imageUrl, cleanUrl, cropShape, boxWidth, minPostHeight, maxPostHeight])

  // Mouse & Touch Pan handlers for moving the image inside the crop window
  const handlePointerDown = (e: React.PointerEvent) => {
    if (isResizingTop.current || isResizingBottom.current) return
    setIsDragging(true)
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y })
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return
    const rawX = e.clientX - dragStart.x
    const rawY = e.clientY - dragStart.y
    const clamped = clampPan(rawX, rawY, zoom, activeBoxHeight)
    setPan(clamped)
  }

  const handlePointerUp = (e: React.PointerEvent) => {
    setIsDragging(false)
    try {
      ;(e.target as HTMLElement).releasePointerCapture(e.pointerId)
    } catch {}
  }

  // Top resize handle listeners
  const handleTopResizeDown = (e: React.PointerEvent) => {
    e.stopPropagation()
    isResizingTop.current = true
    resizeStartY.current = e.clientY
    resizeStartHeight.current = cropHeight
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }

  const handleTopResizeMove = (e: React.PointerEvent) => {
    if (!isResizingTop.current) return
    e.stopPropagation()
    const dy = e.clientY - resizeStartY.current
    const nextH = Math.min(maxPostHeight, Math.max(minPostHeight, resizeStartHeight.current - dy))
    setCropHeight(Math.round(nextH))
    setPan((prev) => clampPan(prev.x, prev.y, zoom, Math.round(nextH)))
  }

  const handleTopResizeUp = (e: React.PointerEvent) => {
    isResizingTop.current = false
    try {
      ;(e.target as HTMLElement).releasePointerCapture(e.pointerId)
    } catch {}
  }

  // Bottom resize handle listeners
  const handleBottomResizeDown = (e: React.PointerEvent) => {
    e.stopPropagation()
    isResizingBottom.current = true
    resizeStartY.current = e.clientY
    resizeStartHeight.current = cropHeight
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }

  const handleBottomResizeMove = (e: React.PointerEvent) => {
    if (!isResizingBottom.current) return
    e.stopPropagation()
    const dy = e.clientY - resizeStartY.current
    const nextH = Math.min(maxPostHeight, Math.max(minPostHeight, resizeStartHeight.current + dy))
    setCropHeight(Math.round(nextH))
    setPan((prev) => clampPan(prev.x, prev.y, zoom, Math.round(nextH)))
  }

  const handleBottomResizeUp = (e: React.PointerEvent) => {
    isResizingBottom.current = false
    try {
      ;(e.target as HTMLElement).releasePointerCapture(e.pointerId)
    } catch {}
  }

  const handleReset = () => {
    setZoom(1.0)
    setPan({ x: 0, y: 0 })
    if (cropShape === "rectangle" && naturalSize) {
      const naturalRatio = naturalSize.width / naturalSize.height
      const naturalH = Math.round(boxWidth / naturalRatio)
      setCropHeight(Math.min(maxPostHeight, Math.max(minPostHeight, naturalH)))
    }
  }

  const handleApplyCrop = useCallback(() => {
    if (!cleanUrl || cropping) return
    setCropping(true)

    const finalRatio = Number((boxWidth / activeBoxHeight).toFixed(3))

    // Physical crop using HTML5 Canvas
    if (naturalSize && naturalSize.width > 0 && naturalSize.height > 0 && imageRef.current) {
      try {
        const scale = baseScale * zoom
        const renderW = naturalSize.width * scale
        const renderH = naturalSize.height * scale

        const cropXInRender = (renderW - boxWidth) / 2 - pan.x
        const cropYInRender = (renderH - activeBoxHeight) / 2 - pan.y

        const sx = Math.max(0, Math.round(cropXInRender / scale))
        const sy = Math.max(0, Math.round(cropYInRender / scale))
        const sw = Math.min(naturalSize.width - sx, Math.max(1, Math.round(boxWidth / scale)))
        const sh = Math.min(naturalSize.height - sy, Math.max(1, Math.round(activeBoxHeight / scale)))

        const canvas = document.createElement("canvas")
        canvas.width = sw
        canvas.height = sh
        const ctx = canvas.getContext("2d")

        if (ctx) {
          ctx.drawImage(imageRef.current, sx, sy, sw, sh, 0, 0, sw, sh)
          const dataUrl = canvas.toDataURL("image/jpeg", 0.92)
          setCropping(false)
          onConfirm(dataUrl)
          return
        }
      } catch (err) {
        console.warn("Canvas crop failed (CORS/tainted), falling back to URL parameters:", err)
      }
    }

    // Fallback: encode standard parameters onto URL
    const panXPercent = boxWidth > 0 ? (pan.x / boxWidth) * 100 : 0
    const panYPercent = activeBoxHeight > 0 ? (pan.y / activeBoxHeight) * 100 : 0
    const croppedUrl = `${cleanUrl}?crop=${zoom.toFixed(2)},${panXPercent.toFixed(1)},${panYPercent.toFixed(1)},${finalRatio}#crop=${zoom.toFixed(2)},${panXPercent.toFixed(1)},${panYPercent.toFixed(1)},${finalRatio}`

    setCropping(false)
    onConfirm(croppedUrl)
  }, [cleanUrl, cropping, boxWidth, activeBoxHeight, naturalSize, baseScale, zoom, pan, onConfirm])

  if (!open || !imageUrl) return null

  const resolvedTitle =
    title ||
    (cropShape === "circle"
      ? "Crop Profile Picture"
      : cropShape === "wide-rectangle"
      ? "Crop Banner"
      : "Crop Post Image")

  return (
    <Dialog open={open} onOpenChange={(val) => {
      if (onOpenChange) onOpenChange(val)
      if (!val && onClose) onClose()
    }}>
      <DialogContent className="sm:max-w-md bg-neutral-950 text-neutral-100 border-neutral-800 p-6">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold text-white tracking-tight">
            {resolvedTitle}
          </DialogTitle>
        </DialogHeader>

        {/* Viewport container */}
        <div className="flex flex-col items-center justify-center py-4">
          {!imageLoaded ? (
            <div className="h-64 flex flex-col items-center justify-center gap-2">
              <Loader2 className="size-7 animate-spin text-amber-500" />
              <p className="text-xs text-neutral-400">Loading image for cropping...</p>
            </div>
          ) : (
            <div
              ref={containerRef}
              className={`relative overflow-hidden cursor-grab active:cursor-grabbing bg-neutral-900 border-2 border-white shadow-2xl select-none touch-none ${
                cropShape === "circle" ? "rounded-full" : "rounded-xl"
              }`}
              style={{
                width: `${boxWidth}px`,
                height: `${activeBoxHeight}px`,
              }}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
            >
              {/* Scaled & translated image */}
              <div
                className="absolute pointer-events-none select-none"
                style={{
                  width: `${renderWidth}px`,
                  height: `${renderHeight}px`,
                  left: `calc(50% - ${renderWidth / 2}px + ${pan.x}px)`,
                  top: `calc(50% - ${renderHeight / 2}px + ${pan.y}px)`,
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  ref={imageRef}
                  src={cleanUrl}
                  alt="Crop preview"
                  crossOrigin="anonymous"
                  className="w-full h-full object-cover pointer-events-none select-none"
                  draggable={false}
                />
              </div>

              {/* Gallery-style 3x3 Rule-of-Thirds Grid (for rectangle post crops) */}
              {cropShape === "rectangle" && (
                <div className="absolute inset-0 pointer-events-none">
                  {/* Horizontal grid lines */}
                  <div className="absolute left-0 right-0 h-px bg-white/40" style={{ top: "33.33%" }} />
                  <div className="absolute left-0 right-0 h-px bg-white/40" style={{ top: "66.66%" }} />
                  {/* Vertical grid lines */}
                  <div className="absolute top-0 bottom-0 w-px bg-white/40" style={{ left: "33.33%" }} />
                  <div className="absolute top-0 bottom-0 w-px bg-white/40" style={{ left: "66.66%" }} />

                  {/* Corner Accent Brackets */}
                  <div className="absolute top-0 left-0 w-5 h-5 border-t-[3px] border-l-[3px] border-white" />
                  <div className="absolute top-0 right-0 w-5 h-5 border-t-[3px] border-r-[3px] border-white" />
                  <div className="absolute bottom-0 left-0 w-5 h-5 border-b-[3px] border-l-[3px] border-white" />
                  <div className="absolute bottom-0 right-0 w-5 h-5 border-b-[3px] border-r-[3px] border-white" />
                </div>
              )}

              {/* Top Handle Bar for Vertical Resizing */}
              {cropShape === "rectangle" && (
                <div
                  className="absolute top-0 left-0 right-0 h-7 flex items-center justify-center cursor-ns-resize z-20"
                  onPointerDown={handleTopResizeDown}
                  onPointerMove={handleTopResizeMove}
                  onPointerUp={handleTopResizeUp}
                  onPointerCancel={handleTopResizeUp}
                >
                  <div className="w-12 h-1.5 bg-white rounded-full shadow-md pointer-events-none" />
                </div>
              )}

              {/* Bottom Handle Bar for Vertical Resizing */}
              {cropShape === "rectangle" && (
                <div
                  className="absolute bottom-0 left-0 right-0 h-7 flex items-center justify-center cursor-ns-resize z-20"
                  onPointerDown={handleBottomResizeDown}
                  onPointerMove={handleBottomResizeMove}
                  onPointerUp={handleBottomResizeUp}
                  onPointerCancel={handleBottomResizeUp}
                >
                  <div className="w-12 h-1.5 bg-white rounded-full shadow-md pointer-events-none" />
                </div>
              )}
            </div>
          )}

          <p className="text-xs text-neutral-400 mt-3 font-medium text-center">
            {cropShape === "rectangle"
              ? "Drag top/bottom bars to crop height (min 1:1) • Drag image to reposition"
              : "Drag image to seek position • Use slider to zoom"}
          </p>
        </div>

        {/* Zoom & Control Bar */}
        <div className="bg-neutral-900/80 rounded-lg p-3 border border-neutral-800 space-y-2">
          <div className="flex items-center justify-between gap-3 text-xs text-neutral-300">
            <button
              type="button"
              onClick={() => {
                const newZ = Math.max(1.0, Number((zoom - 0.2).toFixed(2)))
                setZoom(newZ)
                setPan((prev) => clampPan(prev.x, prev.y, newZ, activeBoxHeight))
              }}
              className="p-1.5 rounded-md hover:bg-neutral-800 disabled:opacity-40 transition-colors"
              disabled={zoom <= 1.0}
              title="Zoom out"
            >
              <ZoomOut className="size-4" />
            </button>

            <input
              type="range"
              min={1.0}
              max={3.0}
              step={0.05}
              value={zoom}
              onChange={(e) => {
                const newZ = parseFloat(e.target.value)
                setZoom(newZ)
                setPan((prev) => clampPan(prev.x, prev.y, newZ, activeBoxHeight))
              }}
              className="flex-1 accent-amber-500 h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer"
            />

            <button
              type="button"
              onClick={() => {
                const newZ = Math.min(3.0, Number((zoom + 0.2).toFixed(2)))
                setZoom(newZ)
                setPan((prev) => clampPan(prev.x, prev.y, newZ, activeBoxHeight))
              }}
              className="p-1.5 rounded-md hover:bg-neutral-800 disabled:opacity-40 transition-colors"
              disabled={zoom >= 3.0}
              title="Zoom in"
            >
              <ZoomIn className="size-4" />
            </button>

            <span className="font-mono text-neutral-400 w-10 text-right">
              {zoom.toFixed(1)}x
            </span>
          </div>

          <div className="flex items-center justify-between pt-1 border-t border-neutral-800/60 text-xs">
            <button
              type="button"
              onClick={handleReset}
              className="flex items-center gap-1.5 text-neutral-400 hover:text-white transition-colors py-1 cursor-pointer"
            >
              <RotateCcw className="size-3.5" />
              <span>Reset</span>
            </button>
            <span className="text-[11px] text-neutral-500">
              {cropShape === "rectangle" ? `Aspect Ratio: ${(boxWidth / activeBoxHeight).toFixed(2)}` : "1:1 Avatar"}
            </span>
          </div>
        </div>

        <DialogFooter className="flex items-center justify-end gap-2 pt-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              if (onClose) onClose()
              if (onOpenChange) onOpenChange(false)
            }}
            disabled={cropping}
            className="text-neutral-400 hover:text-white hover:bg-neutral-800 cursor-pointer text-xs"
          >
            <X className="size-3.5 mr-1" />
            Cancel
          </Button>

          <Button
            type="button"
            onClick={handleApplyCrop}
            disabled={cropping || !imageLoaded}
            className="bg-amber-500 hover:bg-amber-600 text-neutral-950 font-semibold cursor-pointer text-xs"
          >
            {cropping ? (
              <>
                <Loader2 className="size-3.5 mr-1.5 animate-spin" />
                Cropping...
              </>
            ) : (
              <>
                <Check className="size-3.5 mr-1.5" />
                Apply Crop
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
