import { Capacitor, registerPlugin } from "@capacitor/core";
import { App } from "@capacitor/app";

const SecureSession = registerPlugin("SecureSession");
const STORAGE_KEY = "anju-judge-session";

export function platformName() {
  if (window.anjuDesktop) return "windows";
  return Capacitor.getPlatform() === "android" ? "android" : "web";
}

export async function readSession() {
  try {
    if (window.anjuDesktop) {
      const value = await window.anjuDesktop.secret.get(STORAGE_KEY);
      return value ? JSON.parse(value) : null;
    }
    if (Capacitor.isNativePlatform()) {
      const result = await SecureSession.get({ key: STORAGE_KEY });
      return result.value ? JSON.parse(result.value) : null;
    }
    const value = localStorage.getItem(STORAGE_KEY);
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
}

export async function writeSession(value) {
  const serialized = JSON.stringify(value);
  if (window.anjuDesktop) {
    await window.anjuDesktop.secret.set(STORAGE_KEY, serialized);
    return;
  }
  if (Capacitor.isNativePlatform()) {
    await SecureSession.set({ key: STORAGE_KEY, value: serialized });
    return;
  }
  localStorage.setItem(STORAGE_KEY, serialized);
}

export async function clearSession() {
  if (window.anjuDesktop) {
    await window.anjuDesktop.secret.remove(STORAGE_KEY);
    return;
  }
  if (Capacitor.isNativePlatform()) {
    await SecureSession.remove({ key: STORAGE_KEY });
    return;
  }
  localStorage.removeItem(STORAGE_KEY);
}

export function randomKey() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

export function uuid() {
  return crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${randomKey().slice(0, 16)}`;
}

export function installBackHandler(onBack) {
  if (Capacitor.getPlatform() !== "android") return;
  App.addListener("backButton", async () => {
    const handled = onBack();
    if (!handled) await App.minimizeApp();
  });
}
