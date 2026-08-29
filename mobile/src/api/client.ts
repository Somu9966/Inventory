import axios from "axios";
import * as SecureStore from "expo-secure-store";

// For local development on your machine:
// - Web/Simulator: Use localhost:4000
// - Android emulator: Use http://10.0.2.2:4000
// - Physical device: Use machine's LAN IP http://172.26.24.78:4000
export const API_BASE_URL = "http://localhost:4000";

export const TOKEN_KEY = "tyre_inventory_token";

export const api = axios.create({ baseURL: API_BASE_URL });

api.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync(TOKEN_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
