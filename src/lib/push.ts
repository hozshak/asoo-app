// Push-Mitteilungen: Erlaubnis erfragen, Geräte-Schlüssel beim Server anmelden (/api/push/app), Tippen öffnet den Chat.
// Der Server schickt über den Expo-Push-Dienst (zuno-app/src/worker.js, pushApps), wenn man gerade nicht in der App ist.
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { api } from './api';

let current: string | null = null;

// In der App vorne: keine Banner (man sieht die Nachricht ja), aber Zähler am Symbol aktuell halten
Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: false, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: true }),
});

/** Nach dem Anmelden: Erlaubnis holen (nur einmal fragt iOS wirklich) und Schlüssel melden. Stillschweigend, wenn es nicht geht. */
export async function registerPush() {
  if (Platform.OS === 'web' || !Device.isDevice) return null;
  try {
    let { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') status = (await Notifications.requestPermissionsAsync()).status;
    if (status !== 'granted') return null;
    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    const { data } = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
    current = data;
    await api('POST', '/api/push/app', { token: data });
    return data;
  } catch { return null; }
}
/** Beim Abmelden: Dieses Gerät bekommt keine Mitteilungen mehr für das Konto. */
export async function unregisterPush() {
  if (!current) return;
  const t = current; current = null;
  try { await api('POST', '/api/push/app/remove', { token: t }); } catch {}
}
/** Aus der Ziel-Adresse der Mitteilung (z. B. /channels/<server>/<kanal>?m=…) den Chat bestimmen. */
export function chatFromUrl(url?: string | null) {
  const m = /\/channels\/([^/?]+)\/([^/?]+)/.exec(url || '');
  return m ? m[2] : null;
}
export const onPushTap = (fn: (url: string | null) => void) => {
  const sub = Notifications.addNotificationResponseReceivedListener((r) => fn((r.notification.request.content.data as any)?.url ?? null));
  // App wurde durch Tippen auf eine Mitteilung gestartet
  Notifications.getLastNotificationResponseAsync().then((r) => { if (r) fn((r.notification.request.content.data as any)?.url ?? null); }).catch(() => {});
  return () => sub.remove();
};
