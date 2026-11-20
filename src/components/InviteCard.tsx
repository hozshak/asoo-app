// Einladungskarte wie in der Web-App: Server-Symbol, Name, Mitglieder/online und „Beitreten“ bzw. „Öffnen“.
// Steht unter Nachrichten mit einem Einladungslink und auf der Einladungsseite (app/invite/[code].tsx).
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { api, errText } from '@/lib/api';
import { bootstrap, getState } from '@/lib/store';
import { Btn, Glass, ServerIcon, T } from './ui';
import { C } from '@/lib/theme';

type Peek = { server: { id: string; name: string; icon?: string | null; icon_emoji?: string | null; color?: string | null; description?: string; member_count?: number; online?: number } };
const cache = new Map<string, { at: number; d: Peek | null; err?: string }>();

export async function peekInvite(code: string) {
  const c = cache.get(code);
  if (c && Date.now() - c.at < 120000) { if (c.err) throw new Error(c.err); return c.d!; }
  try { const d = await api<Peek>('GET', `/api/invites/${code}`); cache.set(code, { at: Date.now(), d }); return d; }
  catch (e) { const m = errText(e); cache.set(code, { at: Date.now(), d: null, err: m }); throw new Error(m); }
}

/** Zur Startseite mit diesem Server (seine Kanäle links). */
export function openServer(router: ReturnType<typeof useRouter>, sid: string) {
  router.dismissTo({ pathname: '/', params: { server: sid, t: String(Date.now()) } });
}

/** Beitreten, Daten neu laden und den Server zurückgeben (id). */
export async function joinInvite(code: string) {
  const r = await api<{ server_id: string }>('POST', `/api/invites/${code}`, {});
  await bootstrap();
  return r.server_id;
}

export function InviteCard({ code, big = false, onOpen }: { code: string; big?: boolean; onOpen?: (sid: string) => void }) {
  const router = useRouter();
  const [d, setD] = useState<Peek | null>(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { let on = true; peekInvite(code).then((x) => on && setD(x)).catch((e) => on && setErr(String(e.message || e))); return () => { on = false; }; }, [code]);
  const open = (sid: string) => { if (onOpen) onOpen(sid); else openServer(router, sid); };
  const member = d ? getState().servers.some((s) => s.id === d.server.id) : false;
  const go = async () => {
    if (!d) return;
    if (member) return open(d.server.id);
    setBusy(true);
    try { const sid = await joinInvite(code); open(sid); } catch (e) { setErr(errText(e)); } finally { setBusy(false); }
  };
  return (
    <Glass style={[s.card, big && s.big]} intensity={20}>
      <T style={s.label}>{err ? 'Einladung' : 'Einladung zu einem Server'}</T>
      {err ? <T style={{ color: C.muted }}>{err === 'Nicht gefunden.' ? 'Diese Einladung ist ungültig oder abgelaufen.' : err}</T>
        : !d ? <ActivityIndicator color={C.accent} style={{ alignSelf: 'flex-start', marginVertical: 8 }} />
        : big ? (
          <View style={{ alignItems: 'center', gap: 6 }}>
            <ServerIcon server={{ ...d.server, owner_id: '', role: 'member', channels: [] } as any} size={84} active />
            <T style={[s.name, { fontSize: 22, textAlign: 'center', marginTop: 8 }]} numberOfLines={2}>{d.server.name}</T>
            <T style={s.meta}><T style={{ color: C.ok }}>● </T>{d.server.online ?? 0} online  ·  {d.server.member_count ?? 0} Mitglieder</T>
            {d.server.description ? <T style={[s.meta, { textAlign: 'center' }]}>{d.server.description}</T> : null}
            <Btn title={member ? 'Server öffnen' : 'Beitreten'} busy={busy} onPress={go} style={{ alignSelf: 'stretch', marginTop: 12 }} />
          </View>
        ) : (
          <View style={{ gap: 10 }}>
            <View style={s.row}>
              <ServerIcon server={{ ...d.server, owner_id: '', role: 'member', channels: [] } as any} size={46} active />
              <View style={{ flex: 1, minWidth: 0 }}>
                <T style={s.name} numberOfLines={1}>{d.server.name}</T>
                <T style={s.meta} numberOfLines={1}><T style={{ color: C.ok }}>● </T>{d.server.online ?? 0} online  ·  {d.server.member_count ?? 0} Mitglieder</T>
              </View>
            </View>
            <Btn title={member ? 'Server öffnen' : 'Beitreten'} small busy={busy} onPress={go} kind={member ? 'secondary' : 'primary'} />
          </View>
        )}
    </Glass>
  );
}

const s = StyleSheet.create({
  card: { borderRadius: 16, padding: 12, marginTop: 8, maxWidth: 420 },
  big: { padding: 20, maxWidth: undefined },
  label: { color: C.faint, fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  name: { fontSize: 16, fontWeight: '800' },
  meta: { color: C.muted, fontSize: 13 },
});
