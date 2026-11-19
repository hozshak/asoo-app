// Teile der Web-App in der App öffnen (room.tsx). Alles, was es nativ (noch) nicht gibt, kommt so in die App:
// Sprach-/3D-Räume, Anrufe, Feed, Entdecken, alle Einstellungen, Server-Verwaltung, Suche, Admin.
import type { useRouter } from 'expo-router';
type Router = ReturnType<typeof useRouter>;

export type WebAction = 'add-server' | 'create-server' | 'join-server' | 'invite' | 'server-settings' | 'create-channel' | 'create-category' | 'new-group' | 'search' | 'pins' | 'switch';

/** Eine Seite der Web-App, z. B. '/feed' oder '/settings/privacy'. */
export function openWeb(router: Router, path: string) {
  router.push({ pathname: '/room', params: { path } });
}

/** Nur einen Dialog der Web-App (die Seite dahinter bleibt leer, das Fenster geht danach von selbst zu). */
export function webAction(router: Router, act: WebAction, opts: { sid?: string; ch?: string; tab?: string; type?: string } = {}) {
  const q = new URLSearchParams({ do: act });
  for (const [k, v] of Object.entries(opts)) if (v) q.set(k, v);
  const base = opts.sid ? `/channels/${opts.sid}` : '/channels/@me';
  openWeb(router, `${base}?${q.toString()}`);
}
