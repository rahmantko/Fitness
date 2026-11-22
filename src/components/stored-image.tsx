"use client";

import { useEffect, useRef, useState } from "react";

/** An uploaded photo, with a clear placeholder if the file is missing. */
export function StoredImage({ fileKey, alt, className }: { fileKey: string; alt: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  const ref = useRef<HTMLImageElement>(null);

  // The image may fail before the page becomes interactive, when onError isn't attached yet.
  useEffect(() => {
    const img = ref.current;
    if (img && img.complete && img.naturalWidth === 0) setFailed(true);
  }, []);

  if (failed) {
    return (
      <div className={`flex items-center justify-center bg-surface-2 p-2 text-center text-xs text-muted ${className ?? ""}`} role="img" aria-label={`${alt} (unavailable)`}>
        Photo unavailable
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img ref={ref} src={`/api/files/${fileKey}`} alt={alt} onError={() => setFailed(true)} className={className} />
  );
}
