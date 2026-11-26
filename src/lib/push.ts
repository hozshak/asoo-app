// Push-Mitteilungen: Erlaubnis erfragen, Geräte-Schlüssel beim Server anmelden (/api/push/app), Tippen öffnet den Chat.
// Der Server schickt über den Expo-Push-Dienst (zuno-app/src/worker.js, pushApps), wenn man gerade nicht in der App ist.
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { api } from './api';
import { getState, subscribeStore } from './store';
import { t } from './i18n';

let current: string | null = null;
/** Mitteilungs-Schlüssel dieses Geräts (für die Anmeldung des Anruf-Schlüssels) */
export const expoToken = () => current;

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
    // Anruf-Mitteilungen bekommen zwei Knöpfe (lange drücken bzw. herunterziehen): Annehmen öffnet die App und tritt bei
    Notifications.setNotificationCategoryAsync('call', [
      { identifier: 'answer', buttonTitle: t("Annehmen"), options: { opensAppToForeground: true } },
      { identifier: 'decline', buttonTitle: t("Ablehnen"), options: { opensAppToForeground: false, isDestructive: true } },
    ]).catch(() => {});
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
/**
 * Tippen auf eine Mitteilung. War die App ganz zu, startet iOS sie und meldet das Tippen sehr früh – oft bevor die
 * Seiten aufgebaut sind. Deshalb nur merken; _layout.tsx führt es aus, sobald Anmeldung, Daten und Navigation stehen
 * (sonst lief router.push ins Leere und die App blieb auf dem Ladebild stehen).
 * Dasselbe Tippen kann doppelt ankommen (Ereignis + „letzte Antwort“) – nur einmal ausführen.
 */
const seen = new Set<string>();
export type PushTap = { kind: string | null; action: string; ref: string | null };
export const onPushTap = (fn: (url: string | null, tap: PushTap) => void) => {
  const take = (r: Notifications.NotificationResponse | null) => {
    if (!r) return;
    const id = r.notification.request.identifier + ':' + r.actionIdentifier;
    if (seen.has(id)) return;
    seen.add(id);
    const d = (r.notification.request.content.data as any) || {};
    const action = r.actionIdentifier === Notifications.DEFAULT_ACTION_IDENTIFIER ? 'open' : r.actionIdentifier;
    fn(d.url ?? null, { kind: d.kind ?? null, action, ref: d.ref ?? null });
    Notifications.clearLastNotificationResponseAsync?.().catch(() => {});
  };
  const sub = Notifications.addNotificationResponseReceivedListener(take);
  // App wurde durch Tippen auf eine Mitteilung gestartet
  Notifications.getLastNotificationResponseAsync().then(take).catch(() => {});
  return () => sub.remove();
};

/**
 * Zahl am App-Symbol: ungelesene Direktnachrichten und Erwähnungen (wie bei Discord/WhatsApp), solange die App läuft.
 * Kommt eine Mitteilung, während die App zu ist, setzt der Server die Zahl mit (pushApps, „badge“).
 */
let lastBadge = -1;
function badgeNow() {
  const s = getState();
  if (!s.me) return 0;
  // wie der Server (badgeOf): ungelesene Direktnachrichten + ungelesene Einträge der Glocke (Erwähnungen, verpasste Anrufe …)
  let n = s.notifUnread || 0;
  for (const d of s.dms) n += Math.min(99, s.unread?.[d.id] || 0);
  return Math.min(n, 999);
}
export function startBadge() {
  if (Platform.OS === 'web') return () => {};
  const upd = () => {
    const n = badgeNow();
    if (n === lastBadge) return;
    lastBadge = n;
    Notifications.setBadgeCountAsync(n).catch(() => {});
  };
  upd();
  return subscribeStore(upd);
}
