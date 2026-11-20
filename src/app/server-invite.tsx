// Leute einladen – nativ: Einladungslink (Gültigkeit wählbar), Teilen/Kopieren und direkt an Freunde schicken.
import { useEffect, useState } from 'react';
import { ScrollView, Share, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { api, BASE, errText } from '@/lib/api';
import { serverOf, useStore } from '@/lib/store';
import { Avatar, Btn, Card, Glow, Seg, SheetHead, T } from '@/components/ui';
import { Field } from '@/components/Field';
import { C } from '@/lib/theme';

const ORIGIN = (BASE || 'https://zuno-app.altraex.workers.dev').replace(/\/+$/, '');
type Exp = '168' | '24' | '720' | '0';

export default function ServerInvite() {
  const { sid } = useLocalSearchParams<{ sid: string }>();
  const router = useRouter();
  const server = serverOf(sid);
  const friends = useStore((s) => s.friends.friends);
  const [exp, setExp] = useState<Exp>('168');
  const [link, setLink] = useState('');
  const [err, setErr] = useState('');
  const [copied, setCopied] = useState(false);
  const [q, setQ] = useState('');
  const [sent, setSent] = useState<Record<string, 'busy' | 'ok'>>({});
  useEffect(() => {
    setLink(''); setErr('');
    api<any>('POST', `/api/servers/${sid}/invites`, { expires_hours: Number(exp) }).then((d) => setLink(`${ORIGIN}/i/${d.code}`)).catch((e) => setErr(errText(e)));
  }, [sid, exp]);
  const text = `Komm auf meinen Server „${server?.name || 'Asoo'}“! ${link}`;
  const sendTo = async (uid: string) => {
    if (!link) return;
    setSent((x) => ({ ...x, [uid]: 'busy' }));
    try {
      const d = await api<any>('POST', '/api/dms', { user_id: uid });
      await api('POST', `/api/channels/${d.dm.id}/messages`, { content: text });
      setSent((x) => ({ ...x, [uid]: 'ok' }));
    } catch (e) { setErr(errText(e)); setSent((x) => { const y = { ...x }; delete y[uid]; return y; }); }
  };
  const shown = friends.filter((f) => !q.trim() || (f.display + ' ' + f.username).toLowerCase().includes(q.trim().toLowerCase()));
  return (
    <View style={{ flex: 1 }}>
      <Glow />
      <SheetHead title={`Zu „${server?.name || 'Server'}“ einladen`} onClose={() => router.back()} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 4, gap: 14, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <Card style={{ padding: 14, gap: 12 }}>
          <T style={s.label}>Einladungslink</T>
          <View style={s.linkBox}><T style={s.link} numberOfLines={1} selectable>{link || (err ? err : 'Wird erstellt …')}</T></View>
          <Seg<Exp> items={[['24', '1 Tag'], ['168', '7 Tage'], ['720', '30 Tage'], ['0', 'Nie']]} value={exp} onChange={setExp} />
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Btn title={copied ? 'Kopiert ✓' : 'Kopieren'} icon="copy" kind="secondary" disabled={!link} onPress={async () => { await Clipboard.setStringAsync(link); setCopied(true); setTimeout(() => setCopied(false), 1500); }} style={{ flex: 1 }} />
            <Btn title="Teilen" icon="link" disabled={!link} onPress={() => Share.share({ message: text }).catch(() => {})} style={{ flex: 1 }} />
          </View>
        </Card>
        <T style={s.label}>Freunde einladen</T>
        {friends.length > 6 ? <Field value={q} onChangeText={setQ} placeholder="Freunde durchsuchen" /> : null}
        {!friends.length ? <T style={s.hint}>Du hast noch keine Freunde hinzugefügt – teile einfach den Link.</T> : null}
        <Card>
          {shown.map((f, i) => (
            <View key={f.id} style={[s.friend, i < shown.length - 1 && s.line]}>
              <Avatar user={f} size={36} frame={false} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <T style={{ fontWeight: '700' }} numberOfLines={1}>{f.display}</T>
                <T style={s.hint} numberOfLines={1}>@{f.username}</T>
              </View>
              <Btn small title={sent[f.id] === 'ok' ? 'Gesendet ✓' : 'Einladen'} kind={sent[f.id] === 'ok' ? 'secondary' : 'primary'} busy={sent[f.id] === 'busy'} disabled={!link || sent[f.id] === 'ok'} onPress={() => sendTo(f.id)} />
            </View>
          ))}
        </Card>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  label: { color: C.faint, fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1.1 },
  linkBox: { backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 12, paddingHorizontal: 12, height: 44, justifyContent: 'center', borderWidth: 1, borderColor: C.line },
  link: { color: C.text2, fontSize: 14.5 },
  hint: { color: C.muted, fontSize: 13 },
  friend: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, paddingVertical: 10 },
  line: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.line },
});
