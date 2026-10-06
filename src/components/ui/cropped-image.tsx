"use client";

import React, { useState } from "react";
import { Image as ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface CropInfo {
  cleanUrl: string;
  zoom: number;
  panX: number; // percentage
  panY: number; // percentage
  aspectRatio?: number;
}

/**
 * Universal crop parser for image URLs.
 * Supports #crop=zoom,panX,panY[,aspectRatio], ?crop=..., and base64 data:image URIs.
 */
export function parseCropFromUrl(url?: string | null): CropInfo {
  if (!url || typeof url !== "string") {
    return { cleanUrl: "", zoom: 1, panX: 0, panY: 0 };
  }
  const trimmed = url.trim();

  // If it's a data URI (e.g. base64 cropped gallery photo), return as-is
  if (trimmed.startsWith("data:image/")) {
    return { cleanUrl: trimmed, zoom: 1, panX: 0, panY: 0 };
  }

  let cleanUrl = trimmed;
  let cropPart = "";

  // 1. Primary: hash fragment #crop=
  const hashIdx = trimmed.indexOf("#crop=");
  if (hashIdx !== -1) {
    cleanUrl = trimmed.slice(0, hashIdx);
    cropPart = trimmed.slice(hashIdx + 6).split("&")[0];
  } else {
    // 2. Query parameter ?crop= or &crop=
    const queryMatch = trimmed.match(/[?&]crop=([^&#]+)/);
    if (queryMatch) {
      cropPart = decodeURIComponent(queryMatch[1]);
    }
  }

  // Strip any crop query parameters cleanly without breaking other params
  cleanUrl = cleanUrl
    .replace(/[?&]crop=[^&#]+/, "")
    .replace(/\?&/, "?")
    .replace(/[?&]$/, "");

  // Also handle Google Images redirect parameter if present
  const imgUrlMatch = cleanUrl.match(/[?&]imgurl=([^&]+)/);
  if (imgUrlMatch) {
    try {
      cleanUrl = decodeURIComponent(imgUrlMatch[1]);
    } catch {}
  }

  if (!cropPart) {
    return { cleanUrl, zoom: 1, panX: 0, panY: 0 };
  }

  const [z, x, y, ar] = cropPart.split(",").map((p) => parseFloat(p.trim()));
  return {
    cleanUrl,
    zoom: isNaN(z) || z < 1 ? 1 : z,
    panX: isNaN(x) ? 0 : x,
    panY: isNaN(y) ? 0 : y,
    aspectRatio: !isNaN(ar) && ar > 0 ? ar : undefined,
  };
}

/**
 * Encodes crop parameters onto an image URL.
 */
export function encodeCropUrl(
  baseUrl: string,
  zoom: number,
  panXPercent: number,
  panYPercent: number,
  aspectRatio?: number
): string {
  if (!baseUrl) return "";
  const parsed = parseCropFromUrl(baseUrl);
  const cleanBase = parsed.cleanUrl;
  const z = Math.max(1, zoom).toFixed(2);
  const x = panXPercent.toFixed(1);
  const y = panYPercent.toFixed(1);
  const ar = aspectRatio && aspectRatio > 0 ? `,${aspectRatio.toFixed(3)}` : "";
  return `${cleanBase}#crop=${z},${x},${y}${ar}`;
}

export function extractDirectImageUrl(rawUrl?: string | null): string {
  if (!rawUrl || typeof rawUrl !== "string") return "";
  const trimmed = rawUrl.trim();
  if (trimmed.startsWith("data:image/")) return trimmed;
  return parseCropFromUrl(trimmed).cleanUrl;
}

export interface CroppedImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src?: string;
  alt?: string;
  fill?: boolean;
  containerClassName?: string;
  containerStyle?: React.CSSProperties;
  fallbackIconSize?: number;
}

export const CroppedImage: React.FC<CroppedImageProps> = ({
  src,
  alt = "",
  fill = false,
  className = "",
  containerClassName = "",
  containerStyle,
  fallbackIconSize = 24,
  style,
  ...props
}) => {
  const [hasError, setHasError] = useState(false);
  const crop = parseCropFromUrl(src);

  if (!crop.cleanUrl) return null;

  const hasCrop = crop.zoom > 1 || crop.panX !== 0 || crop.panY !== 0;
  const effectiveRatio = crop.aspectRatio && crop.aspectRatio > 0 ? crop.aspectRatio : 16 / 9;

  return (
    <div
      className={cn(
        "relative overflow-hidden w-full bg-muted/20 flex items-center justify-center rounded-lg",
        fill && "h-full",
        containerClassName
      )}
      style={{
        aspectRatio: fill ? undefined : `${effectiveRatio}`,
        maxHeight: fill ? undefined : "480px",
        ...containerStyle,
      }}
    >
      {hasError ? (
        <div className="flex flex-col items-center justify-center p-4 text-muted-foreground gap-1.5 select-none">
          <ImageIcon className="opacity-40" style={{ width: fallbackIconSize, height: fallbackIconSize }} />
          <span className="text-[11px] font-medium opacity-60">Image unavailable</span>
        </div>
      ) : (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={crop.cleanUrl}
          alt={alt}
          className={cn(
            "absolute inset-0 w-full h-full object-cover select-none pointer-events-none",
            className
          )}
          style={{
            ...style,
            transform: hasCrop
              ? `translate(${crop.panX}%, ${crop.panY}%) scale(${crop.zoom})`
              : undefined,
            transformOrigin: "center center",
          }}
          draggable={false}
          onError={() => setHasError(true)}
          {...props}
        />
      )}
    </div>
  );
};
