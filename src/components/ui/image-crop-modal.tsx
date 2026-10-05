"use client"

import * as React from "react"
import { useState, useRef, useEffect, useCallback } from "react"
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
  onConfirm: (croppedDataUrl: string) => void
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

  const targetRatio = propsTargetRatio ?? aspectRatio ?? (cropShape === "circle" ? 1.0 : 16 / 9)

  // Box dimensions in modal
  const boxWidth = cropShape === "circle" ? 280 : 360
  const boxHeight = Math.round(boxWidth / targetRatio)

  // Reset state when opening modal with a new image
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
    }
    img.onerror = () => {
      // Fallback size
      setNaturalSize({ width: 800, height: 800 })
      setImageLoaded(true)
    }
    img.src = imageUrl
  }, [open, imageUrl])

  // Mouse & Touch Pan handlers
  const handlePointerDown = (e: React.PointerEvent) => {
    setIsDragging(true)
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y })
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return
    setPan({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    })
  }

  const handlePointerUp = (e: React.PointerEvent) => {
    setIsDragging(false)
    try {
      ;(e.target as HTMLElement).releasePointerCapture(e.pointerId)
    } catch {}
  }

  const handleReset = () => {
    setZoom(1.0)
    setPan({ x: 0, y: 0 })
  }

  const handleApplyCrop = useCallback(() => {
    if (!naturalSize || !imageUrl) return
    setCropping(true)

    try {
      const origW = naturalSize.width
      const origH = naturalSize.height

      const baseScale = Math.max(boxWidth / origW, boxHeight / origH)
      const totalScale = baseScale * zoom

      const dispW = origW * totalScale
      const dispH = origH * totalScale

      const imgLeft = (boxWidth - dispW) / 2 + pan.x
      const imgTop = (boxHeight - dispH) / 2 + pan.y

      const originX = Math.round(Math.max(0, -imgLeft / totalScale))
      const originY = Math.round(Math.max(0, -imgTop / totalScale))
      const cropW = Math.round(Math.min(origW - originX, boxWidth / totalScale))
      const cropH = Math.round(Math.min(origH - originY, boxHeight / totalScale))

      const safeCropW = Math.max(10, Math.min(origW - originX, cropW))
      const safeCropH = Math.max(10, Math.min(origH - originY, cropH))

      const canvas = document.createElement("canvas")
      const outputWidth = cropShape === "circle" ? 500 : 1200
      const outputHeight = Math.round(outputWidth / targetRatio)

      canvas.width = outputWidth
      canvas.height = outputHeight
      const ctx = canvas.getContext("2d")

      if (!ctx) {
        onConfirm(imageUrl)
        return
      }

      ctx.imageSmoothingEnabled = true
      ctx.imageSmoothingQuality = "high"

      const img = new window.Image()
      img.crossOrigin = "anonymous"
      img.onload = () => {
        ctx.drawImage(
          img,
          originX,
          originY,
          safeCropW,
          safeCropH,
          0,
          0,
          outputWidth,
          outputHeight
        )
        const dataUrl = canvas.toDataURL("image/jpeg", 0.92)
        onConfirm(dataUrl)
        setCropping(false)
      }
      img.onerror = () => {
        onConfirm(imageUrl)
        setCropping(false)
      }
      img.src = imageUrl
    } catch (err) {
      console.error("Canvas crop error:", err)
      onConfirm(imageUrl)
      setCropping(false)
    }
  }, [naturalSize, imageUrl, boxWidth, boxHeight, zoom, pan, cropShape, targetRatio, onConfirm])

  if (!open || !imageUrl) return null

  const resolvedTitle =
    title ||
    (cropShape === "circle"
      ? "Crop Profile Picture"
      : cropShape === "wide-rectangle"
      ? "Crop Banner"
      : "Crop Image")

  const baseScale = naturalSize
    ? Math.max(boxWidth / naturalSize.width, boxHeight / naturalSize.height)
    : 1
  const renderWidth = naturalSize ? naturalSize.width * baseScale * zoom : boxWidth * zoom
  const renderHeight = naturalSize ? naturalSize.height * baseScale * zoom : boxHeight * zoom

  const handleClose = useCallback(() => {
    if (onClose) onClose()
    if (onOpenChange) onOpenChange(false)
  }, [onClose, onOpenChange])

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
              className={`relative overflow-hidden cursor-grab active:cursor-grabbing bg-neutral-900 border-2 border-amber-500 shadow-2xl select-none touch-none ${
                cropShape === "circle" ? "rounded-full" : "rounded-xl"
              }`}
              style={{
                width: `${boxWidth}px`,
                height: `${boxHeight}px`,
              }}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
            >
              {/* Image positioned inside viewport */}
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
                  src={imageUrl}
                  alt="Crop preview"
                  className="w-full h-full object-cover pointer-events-none select-none"
                  draggable={false}
                />
              </div>

              {/* Crop guide crosshairs */}
              <div className="absolute inset-0 pointer-events-none border border-amber-500/20" />
            </div>
          )}

          <p className="text-xs text-neutral-400 mt-3 font-medium">
            Drag image to seek position • Use slider to zoom
          </p>
        </div>

        {/* Zoom & Control Bar */}
        <div className="bg-neutral-900/80 rounded-lg p-3 border border-neutral-800 space-y-2">
          <div className="flex items-center justify-between gap-3 text-xs text-neutral-300">
            <button
              type="button"
              onClick={() => setZoom((prev) => Math.max(1.0, Number((prev - 0.2).toFixed(2))))}
              className="p-1.5 rounded-md hover:bg-neutral-800 disabled:opacity-40 transition-colors"
              disabled={zoom <= 1.0}
              title="Zoom out"
            >
              <ZoomOut className="size-4" />
            </button>

            <input
              type="range"
              min={1.0}
              max={3.5}
              step={0.05}
              value={zoom}
              onChange={(e) => setZoom(parseFloat(e.target.value))}
              className="flex-1 accent-amber-500 h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer"
            />

            <button
              type="button"
              onClick={() => setZoom((prev) => Math.min(3.5, Number((prev + 0.2).toFixed(2))))}
              className="p-1.5 rounded-md hover:bg-neutral-800 disabled:opacity-40 transition-colors"
              disabled={zoom >= 3.5}
              title="Zoom in"
            >
              <ZoomIn className="size-4" />
            </button>

            <span className="w-10 text-right font-mono font-medium text-amber-400">
              {zoom.toFixed(1)}x
            </span>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleReset}
              className="h-7 px-2 text-xs text-neutral-400 hover:text-amber-400 hover:bg-neutral-800"
              title="Reset position and zoom"
            >
              <RotateCcw className="size-3.5 mr-1" />
              Reset
            </Button>
          </div>
        </div>

        <DialogFooter className="mt-2 flex items-center justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleClose}
            className="border-neutral-800 hover:bg-neutral-900 text-neutral-300"
          >
            <X className="size-4 mr-1.5" />
            Cancel
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={handleApplyCrop}
            disabled={cropping || !imageLoaded}
            className="bg-amber-500 hover:bg-amber-400 text-neutral-950 font-semibold"
          >
            {cropping ? (
              <>
                <Loader2 className="size-4 mr-1.5 animate-spin" />
                Applying...
              </>
            ) : (
              <>
                <Check className="size-4 mr-1.5" />
                Apply Crop
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
