import * as Crypto from "expo-crypto";
import { Directory, File, Paths } from "expo-file-system";

const IMAGES_DIR_NAME = "tyre-images";

function imagesDirectory(): Directory {
  const dir = new Directory(Paths.document, IMAGES_DIR_NAME);
  if (!dir.exists) {
    dir.create({ intermediates: true });
  }
  return dir;
}

function extensionFromUri(uri: string, mimeType?: string | null): string {
  const fromMime = mimeType?.split("/")[1];
  if (fromMime) return fromMime === "jpeg" ? "jpg" : fromMime;

  const lastSegment = uri.split("/").pop() ?? "";
  const ext = lastSegment.split(".").pop()?.toLowerCase();
  return ext && ext.length <= 4 ? ext : "jpg";
}

/** Copies a picked/captured photo into the app's own storage; returns a local file:// URI. */
export async function saveImageFromPicker(
  uri: string,
  mimeType?: string | null
): Promise<string> {
  const extension = extensionFromUri(uri, mimeType);
  const destination = new File(imagesDirectory(), `${Crypto.randomUUID()}.${extension}`);
  const source = new File(uri);

  await source.copy(destination);
  return destination.uri;
}

/** Deletes a previously-saved local image file, tolerating a missing/null path. */
export async function deleteImageFile(uri: string | null | undefined): Promise<void> {
  if (!uri) return;
  try {
    const file = new File(uri);
    if (file.exists) {
      file.delete();
    }
  } catch {
    // Best-effort cleanup — an already-missing file is not an error here.
  }
}
