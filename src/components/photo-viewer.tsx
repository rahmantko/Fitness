"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { StoredImage } from "./stored-image";

type Photo = { id: string; fileKey: string; label: string };

/**
 * Thumbnails that open a full-screen viewer in the page (no new tab).
 * Close with the Back button, Escape or the phone's back gesture; move between
 * photos with the arrows, the keyboard or a swipe.
 */
export function PhotoStrip({ photos, title, thumbClass = "w-20" }: { photos: Photo[]; title?: string; thumbClass?: string }) {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <>
      <div className="flex flex-wrap gap-2">
        {photos.map((p, i) => (
          <button key={p.id} type="button" onClick={() => setOpen(i)} className={`block text-left ${thumbClass}`} aria-label={`View ${p.label} photo`}>
            <StoredImage fileKey={p.fileKey} alt={`${p.label} photo`} className="aspect-[3/4] w-full rounded-lg object-cover" />
            <span className="mt-0.5 block text-center text-xs capitalize text-muted">{p.label}</span>
          </button>
        ))}
      </div>
      {open != null && <PhotoViewer photos={photos} start={open} title={title} onClose={() => setOpen(null)} />}
    </>
  );
}

export function PhotoViewer({
  photos,
  start,
  title,
  onClose,
}: {
  photos: Photo[];
  start: number;
  title?: string;
  onClose: () => void;
}) {
  const [i, setI] = useState(start);
  const touchX = useRef<number | null>(null);
  const closing = useRef(false);
  const go = useCallback((d: number) => setI((x) => (x + d + photos.length) % photos.length), [photos.length]);

  // Closing goes through history so the phone's back gesture/button also closes the viewer.
  const close = useCallback(() => {
    if (closing.current) return;
    closing.current = true;
    history.back();
  }, []);

  useEffect(() => {
    history.pushState({ photoViewer: true }, "");
    const onPop = () => onClose();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("popstate", onPop);
    window.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("popstate", onPop);
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [close, go, onClose]);

  const p = photos[i];
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${p.label} photo`}
      className="fixed inset-0 z-50 flex flex-col bg-black/95 text-white"
      onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
      onTouchEnd={(e) => {
        if (touchX.current == null) return;
        const dx = e.changedTouches[0].clientX - touchX.current;
        if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
        touchX.current = null;
      }}
    >
      <div className="flex items-center justify-between gap-3 px-4 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <button type="button" onClick={close} className="flex items-center gap-1 rounded-lg bg-white/10 px-3 py-2 text-sm font-medium hover:bg-white/20" autoFocus>
          ← Back
        </button>
        <div className="min-w-0 truncate text-sm text-white/80">
          {title && <span>{title} · </span>}
          <span className="capitalize">{p.label}</span>
          {photos.length > 1 && <span className="text-white/50"> ({i + 1}/{photos.length})</span>}
        </div>
        <span className="w-16" />
      </div>
      <div className="relative flex min-h-0 flex-1 items-center justify-center px-2 pb-[max(1rem,env(safe-area-inset-bottom))]" onClick={(e) => e.target === e.currentTarget && close()}>
        <StoredImage key={p.fileKey} fileKey={p.fileKey} alt={`${p.label} photo`} className="max-h-full max-w-full rounded-lg object-contain" />
        {photos.length > 1 && (
          <>
            <button type="button" onClick={() => go(-1)} aria-label="Previous photo" className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-white/10 px-3 py-2 text-xl hover:bg-white/20">
              ‹
            </button>
            <button type="button" onClick={() => go(1)} aria-label="Next photo" className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-white/10 px-3 py-2 text-xl hover:bg-white/20">
              ›
            </button>
          </>
        )}
      </div>
    </div>
  );
}

/** Before/after rows for the compare page; tapping a photo opens the viewer. */
export function ComparePhotos({
  rows,
  beforeLabel,
  afterLabel,
}: {
  rows: { pose: string; before: Photo | null; after: Photo | null }[];
  beforeLabel: string;
  afterLabel: string;
}) {
  const all = rows.flatMap((r) => [r.before, r.after]).filter((p): p is Photo => !!p);
  const [open, setOpen] = useState<number | null>(null);
  return (
    <div className="space-y-4">
      {rows.map((r) => (
        <div key={r.pose}>
          <h3 className="mb-2 text-sm font-medium capitalize">{r.pose}</h3>
          <div className="grid grid-cols-2 gap-3">
            {[r.before, r.after].map((p, i) =>
              p ? (
                <button key={i} type="button" onClick={() => setOpen(all.indexOf(p))} aria-label={`View ${p.label}`} className="block">
                  <StoredImage fileKey={p.fileKey} alt={p.label} className="aspect-[3/4] w-full rounded-xl object-cover" />
                  <span className="mt-1 block text-center text-xs text-muted">{i ? afterLabel : beforeLabel}</span>
                </button>
              ) : (
                <div key={i} className="flex aspect-[3/4] items-center justify-center rounded-xl bg-surface-2 text-xs text-muted">
                  No photo
                </div>
              ),
            )}
          </div>
        </div>
      ))}
      {open != null && <PhotoViewer photos={all} start={open} onClose={() => setOpen(null)} />}
    </div>
  );
}
