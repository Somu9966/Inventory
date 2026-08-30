import * as Crypto from "expo-crypto";
import * as SecureStore from "expo-secure-store";

const CREDENTIALS_KEY = "tyre_inventory_admin_credentials";
const SESSION_KEY = "tyre_inventory_session";

interface StoredCredentials {
  salt: string;
  hash: string;
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function hashPassword(password: string, salt: string): Promise<string> {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, salt + password);
}

export async function hasAdminPassword(): Promise<boolean> {
  return (await SecureStore.getItemAsync(CREDENTIALS_KEY)) !== null;
}

export async function setAdminPassword(password: string): Promise<void> {
  const salt = toHex(await Crypto.getRandomBytesAsync(16));
  const hash = await hashPassword(password, salt);
  const credentials: StoredCredentials = { salt, hash };
  await SecureStore.setItemAsync(CREDENTIALS_KEY, JSON.stringify(credentials));
}

export async function verifyAdminPassword(password: string): Promise<boolean> {
  const raw = await SecureStore.getItemAsync(CREDENTIALS_KEY);
  if (!raw) return false;

  const { salt, hash }: StoredCredentials = JSON.parse(raw);
  const candidate = await hashPassword(password, salt);
  return candidate === hash;
}

export async function hasActiveSession(): Promise<boolean> {
  return (await SecureStore.getItemAsync(SESSION_KEY)) !== null;
}

export async function startSession(): Promise<void> {
  await SecureStore.setItemAsync(SESSION_KEY, "1");
}

export async function endSession(): Promise<void> {
  await SecureStore.deleteItemAsync(SESSION_KEY);
}
