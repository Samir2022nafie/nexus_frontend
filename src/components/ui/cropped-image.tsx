"use client";

import React from "react";

export interface CropInfo {
  cleanUrl: string;
  zoom: number;
  panX: number; // percentage
  panY: number; // percentage
  aspectRatio?: number;
}

export function parseCropFromUrl(url?: string | null): CropInfo {
  if (!url || typeof url !== "string") {
    return { cleanUrl: "", zoom: 1, panX: 0, panY: 0 };
  }
  const trimmed = url.trim();
  const cropIdx = trimmed.indexOf("#crop=");
  if (cropIdx === -1) {
    return { cleanUrl: trimmed, zoom: 1, panX: 0, panY: 0 };
  }
  const cleanUrl = trimmed.slice(0, cropIdx);
  const cropPart = trimmed.slice(cropIdx + 6);
  const [z, x, y, ar] = cropPart.split(",").map(Number);
  return {
    cleanUrl,
    zoom: isNaN(z) || z <= 0 ? 1 : z,
    panX: isNaN(x) ? 0 : x,
    panY: isNaN(y) ? 0 : y,
    aspectRatio: !isNaN(ar) && ar > 0 ? ar : undefined,
  };
}

export interface CroppedImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src?: string;
  alt?: string;
  containerClassName?: string;
}

export const CroppedImage: React.FC<CroppedImageProps> = ({
  src,
  alt = "",
  className = "",
  containerClassName = "",
  style,
  ...props
}) => {
  const crop = parseCropFromUrl(src);

  if (!crop.cleanUrl) return null;

  const hasCrop = crop.zoom > 1 || crop.panX !== 0 || crop.panY !== 0;

  return (
    <div
      className={`relative overflow-hidden ${containerClassName}`}
      style={{
        aspectRatio: crop.aspectRatio ? `${crop.aspectRatio}` : undefined,
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={crop.cleanUrl}
        alt={alt}
        className={`w-full h-full object-cover select-none pointer-events-none ${className}`}
        style={{
          ...style,
          transform: hasCrop
            ? `scale(${crop.zoom}) translate(${crop.panX}%, ${crop.panY}%)`
            : undefined,
          transformOrigin: "center center",
        }}
        draggable={false}
        {...props}
      />
    </div>
  );
};
