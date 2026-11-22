"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { addComment, deleteComment, saveFeedback } from "@/app/feedback-actions";
import type { FormState } from "@/app/actions";
import { Avatar } from "./avatar";
import { inputCls } from "./ui";

// ---------- Video links ----------

/** Turns a Loom or YouTube share link into an embeddable player URL. */
function embedUrl(url: string): string | null {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");
    if (host === "loom.com") {
      const id = u.pathname.match(/^\/(?:share|embed)\/([0-9a-f]{16,64})/i)?.[1];
      return id ? `https://www.loom.com/embed/${id}` : null;
    }
    if (host === "youtu.be") return `https://www.youtube-nocookie.com/embed/${u.pathname.slice(1).split("/")[0]}`;
    if (host === "youtube.com" || host === "m.youtube.com") {
      const id = u.searchParams.get("v") ?? u.pathname.match(/^\/shorts\/([\w-]+)/)?.[1];
      return id ? `https://www.youtube-nocookie.com/embed/${id}` : null;
    }
  } catch {}
  return null;
}

function VideoEmbed({ url }: { url: string }) {
  const src = embedUrl(url);
  if (!src) {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm font-medium text-accent">
        ▶ Watch video feedback
      </a>
    );
  }
  return (
    <div className="space-y-1">
      <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-black">
        <iframe
          src={src}
          title="Video feedback"
          allow="autoplay; fullscreen; picture-in-picture"
          allowFullScreen
          loading="lazy"
          className="absolute inset-0 h-full w-full border-0"
        />
      </div>
      <a href={url} target="_blank" rel="noopener noreferrer" className="text-xs text-muted hover:text-accent">
        Open video in a new window
      </a>
    </div>
  );
}

// ---------- Showing feedback ----------

export type FeedbackData = { text: string | null; audioKey: string | null; videoUrl: string | null };

export function FeedbackView({ fb }: { fb: FeedbackData }) {
  return (
    <div className="space-y-3 rounded-xl bg-accent-soft p-3 text-sm">
      <div className="text-xs font-medium text-accent">Coach feedback</div>
      {fb.text && <p className="whitespace-pre-line">{fb.text}</p>}
      {fb.audioKey && (
        <div>
          <div className="mb-1 text-xs text-muted">Voice note</div>
          <audio controls preload="metadata" src={`/api/files/${fb.audioKey}`} className="w-full" />
        </div>
      )}
      {fb.videoUrl && <VideoEmbed url={fb.videoUrl} />}
    </div>
  );
}

// ---------- Voice recorder ----------

const MIME_TYPES = ["audio/mp4", "audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus"];
const MAX_SECONDS = 5 * 60;

function fmtTime(s: number) {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function VoiceRecorder({ onRecorded }: { onRecorded: (blob: Blob | null) => void }) {
  const [state, setState] = useState<"idle" | "recording" | "done">("idle");
  const [seconds, setSeconds] = useState(0);
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const rec = useRef<MediaRecorder | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearInterval(timer.current);
      rec.current?.stream.getTracks().forEach((t) => t.stop());
    },
    [],
  );
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);

  async function start() {
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      return setError("This browser can't record audio. Upload a recording instead.");
    }
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      return setError("Microphone access was blocked. Allow it in your browser settings and try again.");
    }
    const mimeType = MIME_TYPES.find((t) => MediaRecorder.isTypeSupported(t));
    const r = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    const chunks: Blob[] = [];
    r.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    r.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      if (timer.current) clearInterval(timer.current);
      const blob = new Blob(chunks, { type: (r.mimeType || mimeType || "audio/webm").split(";")[0] });
      setUrl(URL.createObjectURL(blob));
      setState("done");
      onRecorded(blob);
    };
    rec.current = r;
    r.start(1000);
    setSeconds(0);
    setState("recording");
    timer.current = setInterval(() => {
      setSeconds((s) => {
        if (s + 1 >= MAX_SECONDS) r.state === "recording" && r.stop();
        return s + 1;
      });
    }, 1000);
  }

  function discard() {
    setUrl(null);
    setState("idle");
    onRecorded(null);
  }

  return (
    <div className="space-y-2">
      {state === "idle" && (
        <button type="button" onClick={start} className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-surface-2">
          <span aria-hidden className="h-2.5 w-2.5 rounded-full bg-danger" /> Record a voice note
        </button>
      )}
      {state === "recording" && (
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-2 text-sm tabular-nums">
            <span aria-hidden className="h-2.5 w-2.5 animate-pulse rounded-full bg-danger" /> Recording {fmtTime(seconds)}
          </span>
          <button type="button" onClick={() => rec.current?.stop()} className="rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-accent-text">
            Stop
          </button>
        </div>
      )}
      {state === "done" && url && (
        <div className="space-y-1">
          <audio controls src={url} className="w-full" />
          <button type="button" onClick={discard} className="text-xs text-muted hover:text-danger">
            Discard and re-record
          </button>
        </div>
      )}
      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}

// ---------- Coach: writing feedback ----------

export function FeedbackEditor({ checkinId, fb }: { checkinId: string; fb: FeedbackData }) {
  const [recorded, setRecorded] = useState<Blob | null>(null);
  const [removeAudio, setRemoveAudio] = useState(false);
  const [recKey, setRecKey] = useState(0);
  const [state, setState] = useState<FormState>(undefined);
  const [pending, start] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);
  const hasSaved = !!(fb.text || fb.audioKey || fb.videoUrl);

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        if (recorded) {
          const ext = recorded.type.includes("mp4") ? "m4a" : recorded.type.includes("ogg") ? "ogg" : "webm";
          fd.set("audio", new File([recorded], `voice-note.${ext}`, { type: recorded.type }));
        }
        start(async () => {
          const r = await saveFeedback(undefined, fd);
          setState(r);
          if (r?.ok) {
            setRecorded(null);
            setRemoveAudio(false);
            setRecKey((k) => k + 1);
            if (fileRef.current) fileRef.current.value = "";
          }
        });
      }}
    >
      <input type="hidden" name="checkinId" value={checkinId} />
      {removeAudio && <input type="hidden" name="removeAudio" value="1" />}
      <div className="text-xs font-medium text-muted">{hasSaved ? "Your feedback" : "Give feedback"}</div>
      <textarea name="feedback" rows={3} defaultValue={fb.text ?? ""} className={inputCls} placeholder="Written feedback for your client…" />

      <div className="space-y-2 rounded-xl border border-border p-3">
        <div className="text-xs font-medium text-muted">Voice note (optional)</div>
        {fb.audioKey && !removeAudio && !recorded && (
          <div className="space-y-1">
            <audio controls preload="metadata" src={`/api/files/${fb.audioKey}`} className="w-full" />
            <button type="button" onClick={() => setRemoveAudio(true)} className="text-xs text-muted hover:text-danger">
              Remove voice note
            </button>
          </div>
        )}
        <VoiceRecorder key={recKey} onRecorded={setRecorded} />
        {!recorded && (
          <label className="block text-xs text-muted">
            Or upload a recording (e.g. from Voice Memos)
            <input ref={fileRef} name="audio" type="file" accept="audio/*" className="mt-1 block w-full text-sm file:mr-3 file:rounded file:border-0 file:bg-surface-2 file:px-2 file:py-1" />
          </label>
        )}
      </div>

      <label className="block">
        <span className="mb-1 block text-xs font-medium text-muted">Loom or video link (optional)</span>
        <input name="videoUrl" type="url" inputMode="url" defaultValue={fb.videoUrl ?? ""} placeholder="https://www.loom.com/share/…" className={inputCls} />
      </label>

      <div className="flex items-center gap-3">
        <button disabled={pending} className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-text hover:opacity-90 disabled:opacity-60">
          {pending ? "Saving…" : "Save feedback"}
        </button>
        {state && (
          <p role="status" className={`text-sm ${state.error ? "text-danger" : "text-accent"}`}>
            {state.error ?? state.ok}
          </p>
        )}
      </div>
      {hasSaved && (fb.videoUrl || fb.audioKey) && (
        <details className="text-sm">
          <summary className="cursor-pointer text-muted">Preview what your client sees</summary>
          <div className="mt-2">
            <FeedbackView fb={fb} />
          </div>
        </details>
      )}
    </form>
  );
}

// ---------- Replies ----------

export type CommentView = {
  id: string;
  body: string;
  createdAt: Date;
  authorId: string;
  authorName: string;
  authorRole: string;
  authorAvatar: string | null;
};

export function Comments({
  checkinId,
  comments,
  viewerId,
  viewerRole,
}: {
  checkinId: string;
  comments: CommentView[];
  viewerId: string;
  viewerRole: string;
}) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="space-y-3">
      {comments.length > 0 && (
        <ul className="space-y-3">
          {comments.map((m) => (
            <li key={m.id} className="flex gap-2">
              <Avatar name={m.authorName} avatarKey={m.authorAvatar} />
              <div className="min-w-0 flex-1">
                <div className="text-xs text-muted">
                  <span className="font-medium text-text">{m.authorId === viewerId ? "You" : m.authorName}</span>
                  {m.authorRole === "coach" && m.authorId !== viewerId && " · Coach"} ·{" "}
                  {m.createdAt.toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                  {m.authorId === viewerId && (
                    <button type="button" onClick={() => start(() => deleteComment(m.id))} className="ml-2 hover:text-danger">
                      Delete
                    </button>
                  )}
                </div>
                <p className="whitespace-pre-line break-words text-sm">{m.body}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
      <form
        className="flex items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!text.trim()) return;
          start(async () => {
            const r = await addComment(checkinId, text);
            if (r.error) setError(r.error);
            else {
              setText("");
              setError(null);
            }
          });
        }}
      >
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={2}
          maxLength={2000}
          aria-label="Reply"
          placeholder={viewerRole === "client" ? "Ask your coach a question or reply…" : "Reply to your client…"}
          className={`${inputCls} min-h-[2.5rem] resize-y`}
        />
        <button disabled={pending || !text.trim()} className="shrink-0 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-accent-text disabled:opacity-50">
          {pending ? "…" : "Send"}
        </button>
      </form>
      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}
