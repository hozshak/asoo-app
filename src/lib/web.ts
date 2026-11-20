// Teile der Web-App in der App öffnen – im dauerhaften Web-Fenster (lib/webhost.ts, components/WebHost). Alles, was es
// nativ (noch) nicht gibt, kommt so in die App: Sprach-/3D-Räume, Anrufe, Feed, alle Einstellungen, Server-Einstellungen, Admin.
import type { useRouter } from 'expo-router';
import { showWeb } from './webhost';
type Router = ReturnType<typeof useRouter>;

export type WebAction = 'add-server' | 'create-server' | 'join-server' | 'invite' | 'server-settings' | 'create-channel' | 'create-category' | 'new-group' | 'search' | 'pins' | 'switch';

/** Eine Seite der Web-App, z. B. '/feed' oder '/settings/privacy'. (router bleibt für ältere Aufrufe im Aufruf.) */
export function openWeb(_router: Router | null, path: string) {
  showWeb(path);
}

/** Nur einen Dialog der Web-App (die Seite dahinter bleibt leer, das Fenster geht danach von selbst zu). */
export function webAction(_router: Router | null, act: WebAction, opts: { sid?: string; ch?: string; tab?: string; type?: string } = {}) {
  const q = new URLSearchParams({ do: act });
  for (const [k, v] of Object.entries(opts)) if (v) q.set(k, v);
  const base = opts.sid ? `/channels/${opts.sid}` : '/channels/@me';
  showWeb(`${base}?${q.toString()}`);
}
