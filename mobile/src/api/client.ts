import axios from "axios";
import * as SecureStore from "expo-secure-store";
import Constants from "expo-constants";

const API_PORT = 4000;

// The device reached this bundle over some host it can actually route to, so
// reuse that host for the API instead of hardcoding an IP that goes stale
// every time the machine changes network. Set EXPO_PUBLIC_API_URL (or
// expo.extra.API_BASE_URL) to override, e.g. when pointing at a deployed API.
function resolveBaseUrl(): string {
  const configured =
    (Constants.expoConfig?.extra?.API_BASE_URL as string | undefined) ??
    process.env.EXPO_PUBLIC_API_URL;
  if (configured) {
    return configured;
  }

  // hostUri looks like "192.168.1.x:8081" — take the host, swap the port.
  const host = Constants.expoConfig?.hostUri?.split(":")[0];
  if (host) {
    return `http://${host}:${API_PORT}`;
  }

  return `http://localhost:${API_PORT}`;
}

export const API_BASE_URL = resolveBaseUrl();

export const TOKEN_KEY = "tyre_inventory_token";

export const api = axios.create({ baseURL: API_BASE_URL });

api.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync(TOKEN_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

/**
 * The API stores image paths relative to itself ("/uploads/<id>.jpg") rather
 * than absolute URLs, so records stay valid when the dev machine's IP changes.
 * Resolve one against the current API host before handing it to <Image>.
 */
export function resolveImageUrl(path: string | null | undefined): string | undefined {
  if (!path) return undefined;
  return /^https?:\/\//.test(path) ? path : `${API_BASE_URL}${path}`;
}

const MIME_BY_EXTENSION: Record<string, string> = {
  png: "image/png",
  webp: "image/webp",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
};

/** Upload a local image file; returns the relative path to store on the tyre. */
export async function uploadImage(
  uri: string,
  mimeType?: string | null
): Promise<string> {
  const name = uri.split("/").pop() || "photo.jpg";
  const extension = name.split(".").pop()?.toLowerCase() ?? "";
  const type = mimeType ?? MIME_BY_EXTENSION[extension] ?? "image/jpeg";

  const form = new FormData();
  // React Native's FormData takes this {uri, name, type} shape for files.
  form.append("image", { uri, name, type } as unknown as Blob);

  const { data } = await api.post("/uploads", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data.url as string;
}
