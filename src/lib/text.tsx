// Nachrichtentext darstellen: Links, @Erwähnungen, @Rollen (<@&id>), @everyone/@here, **fett**, Spoiler bleiben schlicht.
import React from 'react';
import { Linking, Text } from 'react-native';
import { C, F } from './theme';
import { serverOf, type Role } from './store';

const TOKEN = /(<@&[a-z0-9]{16}>)|(https?:\/\/[^\s<]+[^\s<.,:;"')\]!?])|((?:^|(?<=[^\w/@]))@(?:everyone|here)\b)|((?:^|(?<=[^\w/]))@[a-z0-9_.]{3,20})|(\*\*[^*]+\*\*)/gi;

export function RichText({ text, sid, meName, style, onUser, onLink }: { text: string; sid?: string | null; meName?: string; style?: any; onUser?: (name: string) => void; onLink?: (url: string) => void }) {
  const roles: Role[] = serverOf(sid)?.roles || [];
  const out: React.ReactNode[] = [];
  let last = 0, i = 0;
  const src = String(text || '');
  for (const m of src.matchAll(TOKEN)) {
    const at = m.index ?? 0;
    if (at > last) out.push(src.slice(last, at));
    const t = m[0];
    if (m[1]) {
      const r = roles.find((x) => x.id === t.slice(3, -1));
      const col = r?.color || C.accent;
      out.push(<Text key={i++} style={{ color: col, backgroundColor: col + '2e', fontFamily: F.bold }}>@{r ? r.name : 'gelöschte Rolle'}</Text>);
    } else if (m[2]) out.push(<Text key={i++} style={{ color: '#6cb6ff', textDecorationLine: 'underline' }} onPress={() => (onLink ? onLink(t) : Linking.openURL(t))}>{t}</Text>);
    else if (m[3]) out.push(<Text key={i++} style={{ color: C.warn, backgroundColor: 'rgba(255,176,46,0.16)', fontFamily: F.bold }}>{t}</Text>);
    else if (m[4]) {
      const me = meName && t.slice(1).toLowerCase() === meName.toLowerCase();
      out.push(<Text key={i++} onPress={onUser ? () => onUser(t.slice(1)) : undefined} style={{ color: me ? C.warn : C.accent, backgroundColor: me ? 'rgba(255,176,46,0.16)' : C.accentSoft, fontFamily: F.bold }}>{t}</Text>);
    } else if (m[5]) out.push(<Text key={i++} style={{ fontFamily: F.heavy }}>{t.slice(2, -2)}</Text>);
    last = at + t.length;
  }
  if (last < src.length) out.push(src.slice(last));
  return <Text style={style} selectable>{out}</Text>;
}

/** <@&id> → @Rollenname (Vorschau, Kopieren, Bearbeiten) */
export const plainText = (text: string, sid?: string | null) => {
  const roles = serverOf(sid)?.roles || [];
  return String(text || '').replace(/<@&([a-z0-9]{16})>/g, (_, id) => '@' + (roles.find((r) => r.id === id)?.name || '?'));
};
/** „@VIP“ beim Senden zur Rollen-Erwähnung machen (nur Rollen, die man erwähnen darf; der Server prüft nochmal). */
export function toRoleTags(text: string, sid?: string | null, isMod = false) {
  const roles = (serverOf(sid)?.roles || []).filter((r) => r.mentionable || isMod).sort((a, b) => b.name.length - a.name.length);
  let s = text;
  const esc = (x: string) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  for (const r of roles) for (const n of new Set([r.name, r.name.replace(/[^\p{L}\p{N}_.\- ]+/gu, ' ').replace(/\s+/g, ' ').trim()])) {
    if (!n) continue;
    s = s.replace(new RegExp('(^|\\s)@' + esc(n) + '(?=$|[\\s.,!?:;)])', 'giu'), (_m, pre) => pre + '<@&' + r.id + '>');
  }
  return s;
}

export function timeLabel(ts: number) {
  const d = new Date(ts), now = new Date();
  const hm = d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  if (d.toDateString() === now.toDateString()) return `Heute um ${hm}`;
  const y = new Date(now.getTime() - 864e5);
  if (d.toDateString() === y.toDateString()) return `Gestern um ${hm}`;
  return `${d.toLocaleDateString('de-DE')} ${hm}`;
}
