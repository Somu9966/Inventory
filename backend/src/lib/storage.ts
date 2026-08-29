import crypto from "crypto";
import fs from "fs/promises";
import path from "path";
import multer from "multer";
import { Request } from "express";

// Everything that knows *where* images live is in this file. Swapping disk for
// S3/Cloudinary later means reimplementing `upload`, `publicUrl` and `remove` —
// callers only ever see the relative URL.
export const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR ?? "uploads");
export const UPLOAD_ROUTE = "/uploads";

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED = new Map([
  ["image/jpeg", ".jpg"],
  ["image/png", ".png"],
  ["image/webp", ".webp"],
]);

export async function ensureUploadDir() {
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    // Random name: the served path is unguessable, and a client-supplied
    // filename never reaches the filesystem.
    const ext = ALLOWED.get(file.mimetype) ?? "";
    cb(null, `${crypto.randomUUID()}${ext}`);
  },
});

export const upload = multer({
  storage,
  limits: { fileSize: MAX_BYTES, files: 1 },
  fileFilter: (_req: Request, file, cb) => {
    if (!ALLOWED.has(file.mimetype)) {
      return cb(new Error("Only JPEG, PNG and WebP images are allowed"));
    }
    cb(null, true);
  },
});

/** Relative URL stored in the database, e.g. "/uploads/<uuid>.jpg". */
export function publicUrl(filename: string): string {
  return `${UPLOAD_ROUTE}/${filename}`;
}

/**
 * Delete a stored image. Takes the same relative URL we handed out, and
 * refuses anything that would escape the upload directory.
 */
export async function remove(url: string | null | undefined) {
  if (!url?.startsWith(`${UPLOAD_ROUTE}/`)) return;

  const filename = path.basename(url);
  const target = path.join(UPLOAD_DIR, filename);
  if (path.dirname(target) !== UPLOAD_DIR) return;

  await fs.unlink(target).catch(() => {
    // Already gone, or never written — nothing to clean up.
  });
}
