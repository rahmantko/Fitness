import "server-only";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

// Private file storage for progress photos and lab PDFs. Files live outside
// /public and are only served through /api/files after a permission check.
// Swap this module for Supabase Storage / S3 in production.
const ROOT = path.join(process.cwd(), "data", "uploads");

const ALLOWED: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "application/pdf": "pdf",
};
export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;

/** Saves a file under the client's folder and returns its key. */
export async function saveFile(clientId: string, file: File): Promise<string> {
  const ext = ALLOWED[file.type];
  if (!ext) throw new Error(`Unsupported file type: ${file.type || "unknown"}`);
  if (file.size > MAX_UPLOAD_BYTES) throw new Error("File is larger than 15 MB");
  const key = `${clientId}/${randomUUID()}.${ext}`;
  const full = path.join(ROOT, key);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, Buffer.from(await file.arrayBuffer()));
  return key;
}

export function isValidKey(key: string) {
  return /^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|png|webp|heic|pdf)$/.test(key);
}

export async function readStoredFile(key: string) {
  if (!isValidKey(key)) return null;
  const ext = key.split(".").pop()!;
  const type = Object.entries(ALLOWED).find(([, e]) => e === ext)![0];
  try {
    return { data: await readFile(path.join(ROOT, key)), type };
  } catch {
    return null;
  }
}

/** Client id that owns a file key. */
export function fileOwner(key: string) {
  return key.split("/")[0];
}
