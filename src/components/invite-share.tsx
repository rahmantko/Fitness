"use client";

import { useEffect, useRef, useState } from "react";

/**
 * The coach's invite code as a button. On phones it opens the share sheet
 * (WhatsApp, Messages, email…); elsewhere it shows share options and a copy button.
 * The link pre-fills the code on the sign-up page.
 */
export function InviteShare({ code, coachName }: { code: string; coachName: string }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState<"link" | "message" | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  // Only read in event handlers and the menu, which exist after a click in the browser.
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !boxRef.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const link = `${origin}/signup?code=${encodeURIComponent(code)}`;
  const message =
    `${coachName} has invited you to Checkpoint, their coaching app 💪\n\n` +
    `Sign up here (your invite code ${code} is already filled in):\n${link}\n\n` +
    `On iPhone, open the link in Safari, then tap Share → Add to Home Screen to use it like an app.`;

  async function share() {
    if (navigator.share && window.matchMedia("(pointer: coarse)").matches) {
      try {
        await navigator.share({ title: "Join me on Checkpoint", text: message });
        return;
      } catch (e) {
        if ((e as Error).name === "AbortError") return; // closed the share sheet
      }
    }
    setOpen((o) => !o);
  }

  async function copy(what: "link" | "message") {
    await navigator.clipboard?.writeText(what === "link" ? link : message);
    setCopied(what);
    setTimeout(() => setCopied(null), 2000);
  }

  const enc = encodeURIComponent(message);
  const item = "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-surface-2";

  return (
    <div ref={boxRef} className="relative">
      <button
        type="button"
        onClick={share}
        className="flex items-center gap-2 rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-accent-text hover:opacity-90"
        title="Send your invite to a client"
      >
        <code className="font-mono font-semibold tracking-wider">{code}</code>
        <span aria-hidden>·</span>
        Invite client
      </button>
      {open && (
        <div role="menu" className="absolute right-0 z-20 mt-2 w-64 rounded-xl border border-border bg-surface p-1.5 shadow-lg">
          <a role="menuitem" className={item} href={`https://wa.me/?text=${enc}`} target="_blank" rel="noopener noreferrer">
            WhatsApp
          </a>
          <a role="menuitem" className={item} href={`sms:?&body=${enc}`}>
            Text message
          </a>
          <a role="menuitem" className={item} href={`mailto:?subject=${encodeURIComponent("Join me on Checkpoint")}&body=${enc}`}>
            Email
          </a>
          <div className="my-1 border-t border-border" />
          <button role="menuitem" type="button" className={item} onClick={() => copy("message")}>
            {copied === "message" ? "Copied ✓" : "Copy invite message"}
          </button>
          <button role="menuitem" type="button" className={item} onClick={() => copy("link")}>
            {copied === "link" ? "Copied ✓" : "Copy sign-up link"}
          </button>
        </div>
      )}
    </div>
  );
}
