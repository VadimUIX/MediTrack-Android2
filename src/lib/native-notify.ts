import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";

export type NotifPerm = "granted" | "denied" | "default" | "unknown";

export function isNative(): boolean {
  return typeof window !== "undefined" && Capacitor.isNativePlatform();
}

export async function getNotifPermission(): Promise<NotifPerm> {
  if (isNative()) {
    try {
      const r = await LocalNotifications.checkPermissions();
      return r.display === "granted" ? "granted" : r.display === "denied" ? "denied" : "default";
    } catch {
      return "unknown";
    }
  }
  if (typeof Notification !== "undefined") return Notification.permission;
  return "unknown";
}

export async function requestNotifPermission(): Promise<NotifPerm> {
  if (isNative()) {
    try {
      const r = await LocalNotifications.requestPermissions();
      return r.display === "granted" ? "granted" : "denied";
    } catch {
      return "unknown";
    }
  }
  if (typeof Notification !== "undefined") return Notification.requestPermission();
  return "unknown";
}

function hashId(key: string): number {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) | 0;
  return Math.abs(h) % 2147483647 || 1;
}

export async function showNotification(title: string, body: string, key: string): Promise<void> {
  if (isNative()) {
    try {
      await LocalNotifications.schedule({
        notifications: [{ id: hashId(key + Date.now()), title, body }],
      });
    } catch {
      /* ignore */
    }
    return;
  }
  if (typeof Notification !== "undefined" && Notification.permission === "granted") {
    try {
      const note = new Notification(title, { body, tag: key });
      note.onclick = () => window.focus();
    } catch {
      /* unsupported */
    }
  }
}
