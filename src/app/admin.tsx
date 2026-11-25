// Admin-Bereich – nativ (vorher die Web-Ansicht /admin): Meldungen bearbeiten, Nutzer suchen/sperren/Abzeichen, Zahlen.
// Gleiche Schnittstellen wie zuno-app/public/js/admin.js. Nur für Plattform-Admins (der Server prüft das ebenfalls).
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { api, errText, mediaSource } from '@/lib/api';
import { putUsers, useStore } from '@/lib/store';
import { timeLabel } from '@/lib/text';
import { Avatar, Btn, Empty, Glass, Glow, Sheet, SheetHead, T } from '@/components/ui';
import { C, F, R } from '@/lib/theme';
import { t, LOCALE } from '@/lib/i18n';

type Tab = 'open' | 'closed' | 'users' | 'stats';
const REASON: Record<string, string> = { spam: t("Spam"), harassment: t("Belästigung"), hate: t("Hass"), violence: t("Gewalt"), sexual: t("Sexuelle Inhalte"), minor_safety: t("Schutz von Minderjährigen"), self_harm: t("Selbstverletzung"), illegal: t("Illegal"), impersonation: t("Nachahmung"), other: t("Anderes") };
const STATS: [string, string][] = [['users', t("Nutzer")], ['users_today', t("Neu heute")], ['active_today', t("Aktiv heute")], ['online', t("Gerade online")], ['in_voice', t("In Sprachräumen")], ['servers', t("Server")], ['messages', t("Nachrichten")], ['messages_today', t("Nachrichten heute")], ['posts', t("Beiträge")], ['open_reports', t("Offene Meldungen")]];
const BADGES: [string, string][] = [['verified', t("✅ Verifiziert")], ['partner', t("🤝 Partner")], ['helper', t("💡 Helfer")], ['supporter', t("💎 Unterstützer")], ['creator', t("🎨 Creator")], ['bughunter', t("🐞 Fehlerjäger")]];

export default function Admin() {
  const router = useRouter();
  const me = useStore((s) => s.me) as any;
  const [tab, setTab] = useState<Tab>('open');
  const [note, setNote] = useState('');
  const say = (t: string) => { setNote(t); setTimeout(() => setNote((x) => (x === t ? '' : x)), 2400); };
  if (!me?.is_admin) return <View style={{ flex: 1, backgroundColor: C.bg0 }}><SheetHead title={t("Admin")} onClose={() => router.back()} /><T style={s.hint}>{t("Nur für Admins.")}</T></View>;
  return (
    <View style={{ flex: 1, backgroundColor: C.bg0 }}>
      <Glow />
      <SheetHead title={t("Admin-Bereich")} onClose={() => router.back()} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={s.tabs}>
        {([['open', 'Meldungen'], ['closed', 'Erledigt'], ['users', 'Nutzer'], ['stats', 'Zahlen']] as [Tab, string][]).map(([k, l]) => (
          <Pressable key={k} accessibilityRole="tab" accessibilityState={{ selected: tab === k }} onPress={() => setTab(k)} style={[s.tab, tab === k && s.tabOn]}><T style={[s.tabText, tab === k && { color: '#fff' }]}>{l}</T></Pressable>
        ))}
      </ScrollView>
      <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: 80 }} keyboardShouldPersistTaps="handled">
        {tab === 'stats' ? <Stats say={say} /> : tab === 'users' ? <Users say={say} /> : <Reports key={tab} status={tab} say={say} />}
      </ScrollView>
      {note ? <View style={s.note} pointerEvents="none"><T style={{ fontWeight: '700' }}>{note}</T></View> : null}
    </View>
  );
}

const confirmIt = (title: string, text: string, fn: () => void) => {
  if (Platform.OS === 'web') { if (confirm(`${title}\n\n${text}`)) fn(); return; }
  Alert.alert(title, text, [{ text: t("Abbrechen"), style: 'cancel' }, { text: t("Ja"), style: 'destructive', onPress: fn }]);
};

function Stats({ say }: { say: (t: string) => void }) {
  const [d, setD] = useState<any>(null);
  useEffect(() => { api<any>('GET', '/api/admin/stats').then(setD).catch((e) => say(errText(e))); }, []);
  if (!d) return <ActivityIndicator color={C.accent} />;
  return (
    <>
      <View style={s.grid}>{STATS.filter(([k]) => d[k] !== undefined).map(([k, l]) => (
        <Glass key={k} style={s.stat} intensity={20}><T style={s.statNum}>{d[k]}</T><T style={s.statLabel}>{l}</T></Glass>
      ))}</View>
      <Btn title={t("Ungenutzte Bilder aufräumen")} kind="secondary" onPress={async () => { try { const r = await api<any>('POST', '/api/admin/cleanup', {}); say(t("{0} ungenutzte Bilder gelöscht", { 0: r.removed })); } catch (e) { say(errText(e)); } }} style={{ marginTop: 14 }} />
      <T style={s.hint}>{t("Kostenloser Cloudflare-Plan: 100.000 Anfragen pro Tag und 10 GB Bilder sind frei.")}</T>
    </>
  );
}

function Reports({ status, say }: { status: 'open' | 'closed'; say: (t: string) => void }) {
  const router = useRouter();
  const [list, setList] = useState<any[] | null>(null);
  const [ban, setBan] = useState<{ r: any; action: string } | null>(null);
  const [reason, setReason] = useState('');
  const load = () => api<any>('GET', '/api/admin/reports?status=' + status).then((d) => setList(d.reports || [])).catch((e) => { setList([]); say(errText(e)); });
  useEffect(() => { load(); }, []);
  const send = async (r: any, action: string, why = '') => {
    try { await api('POST', '/api/admin/reports/' + r.id, { action, reason: why }); say(t("Erledigt ✓")); load(); } catch (e) { say(errText(e)); }
  };
  const act = (r: any, action: string) => {
    if (action === 'dismiss') return send(r, action);
    if (action.includes('ban')) { setReason(REASON[r.reason] || ''); setBan({ r, action }); return; }
    confirmIt('Inhalt löschen?', 'Der gemeldete Inhalt wird gelöscht.', () => send(r, action));
  };
  if (!list) return <ActivityIndicator color={C.accent} />;
  if (!list.length) return status === 'open' ? <Empty icon="check" title={t("Keine offenen Meldungen")} text={t("Alles erledigt. Neue Meldungen erscheinen hier.")} /> : <Empty icon="flag" title={t("Noch nichts erledigt")} />;
  return (
    <>
      {list.map((r) => {
        const snap = r.snapshot || {};
        const img = mediaSource(snap.image || snap.avatar);
        return (
          <Glass key={r.id} style={[s.card, { marginBottom: 10 }]} intensity={20}>
            <View style={s.pills}><View style={s.pill}><T style={s.pillText}>{REASON[r.reason] || r.reason}</T></View><View style={s.pill}><T style={s.pillText}>{r.target_type}</T></View><T style={[s.hint, { marginTop: 0, flex: 1 }]}>{timeLabel(r.created)}</T></View>
            {r.target ? (
              <Pressable onPress={() => router.push({ pathname: '/user/[id]', params: { id: r.target.id } })} style={s.row}>
                <Avatar user={r.target} size={32} frame={false} />
                <View style={{ flex: 1 }}><T style={{ fontWeight: '700' }}>{r.target.display}</T><T style={[s.hint, { marginTop: 0 }]}>@{r.target.username}{r.target.deleted ? t(" (gelöscht)") : ''}</T></View>
              </Pressable>
            ) : null}
            <View style={s.snap}>
              <T style={{ color: C.text2 }}>{snap.content || snap.bio || snap.name || snap.display || '—'}</T>
              {img ? <Image source={img} style={{ width: 140, height: 100, borderRadius: 8, marginTop: 8 }} contentFit="cover" /> : null}
            </View>
            {r.details ? <T style={s.hint}><T style={{ fontWeight: '800' }}>{t("Hinweis vom Melder:")}{' '}</T>{r.details}</T> : null}
            <T style={s.hint}>{t("Gemeldet von")}{' '}{r.reporter?.display || '?'}{r.status !== 'open' ? ' · ' + r.status : ''}</T>
            {status === 'open' ? (
              <View style={s.btns}>
                <Btn title={t("Kein Verstoß")} small kind="secondary" onPress={() => act(r, 'dismiss')} style={{ flexGrow: 1 }} />
                <Btn title={t("Inhalt löschen")} small kind="danger" onPress={() => act(r, 'delete_content')} style={{ flexGrow: 1 }} />
                {r.target && !r.target.deleted ? <Btn title={t("Sperren")} small kind="danger" onPress={() => act(r, 'ban')} style={{ flexGrow: 1 }} /> : null}
                {r.target && !r.target.deleted ? <Btn title={t("Löschen + sperren")} small kind="danger" onPress={() => act(r, 'delete_and_ban')} style={{ flexGrow: 1 }} /> : null}
              </View>
            ) : null}
          </Glass>
        );
      })}
      {ban ? <ReasonBox title={t("Grund für die Sperre")} reason={reason} setReason={setReason} onCancel={() => setBan(null)} onOk={() => { const b = ban; setBan(null); send(b.r, b.action, reason); }} /> : null}
    </>
  );
}

function ReasonBox({ title, reason, setReason, onCancel, onOk }: { title: string; reason: string; setReason: (v: string) => void; onCancel: () => void; onOk: () => void }) {
  return (
    <View style={s.overlay}>
      <Glass style={[s.card, { width: '100%' }]} intensity={50} tint="rgba(19,20,32,0.96)">
        <T style={{ fontSize: 17, fontWeight: '800' }}>{title}</T>
        <T style={s.hint}>{t("Die Person sieht diesen Grund.")}</T>
        <TextInput autoFocus value={reason} onChangeText={setReason} maxLength={200} style={[s.input, { marginTop: 10 }]} placeholderTextColor={C.faint} />
        <View style={s.btns}><Btn title={t("Abbrechen")} small kind="secondary" onPress={onCancel} style={{ flex: 1 }} /><Btn title={t("Sperren")} small kind="danger" onPress={onOk} style={{ flex: 1 }} /></View>
      </Glass>
    </View>
  );
}

function Users({ say }: { say: (t: string) => void }) {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [list, setList] = useState<any[] | null>(null);
  const [badges, setBadges] = useState<any | null>(null);
  const [ban, setBan] = useState<any | null>(null);
  const [reason, setReason] = useState('');
  const load = (query = q) => api<any>('GET', '/api/admin/users?q=' + encodeURIComponent(query.trim())).then((d) => { putUsers(d.users || []); setList(d.users || []); }).catch((e) => { setList([]); say(errText(e)); });
  useEffect(() => { const t = setTimeout(() => load(q), 300); return () => clearTimeout(t); }, [q]);
  const unban = async (u: any) => { try { await api('POST', `/api/admin/users/${u.id}/ban`, { on: false }); say(t("Entsperrt")); load(); } catch (e) { say(errText(e)); } };
  const setBadge = async (u: any, k: string) => {
    const have = new Set<string>((u.badges || []).filter((b: string) => BADGES.some(([x]) => x === b)));
    have.has(k) ? have.delete(k) : have.add(k);
    try { await api('POST', `/api/admin/users/${u.id}/badges`, { badges: [...have] }); say(t("Gespeichert ✓")); load(); } catch (e) { say(errText(e)); }
  };
  return (
    <>
      <TextInput value={q} onChangeText={setQ} placeholder={t("Name, Benutzername oder ID")} placeholderTextColor={C.faint} autoCapitalize="none" style={s.input} />
      {!list ? <ActivityIndicator color={C.accent} style={{ marginTop: 16 }} /> : list.map((u) => (
        <View key={u.id} style={[s.row, { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.line }]}>
          <Pressable onPress={() => router.push({ pathname: '/user/[id]', params: { id: u.id } })}><Avatar user={u} size={38} status frame={false} /></Pressable>
          <View style={{ flex: 1, minWidth: 0 }}>
            <T style={{ fontWeight: '700' }} numberOfLines={1}>{u.display}{u.is_admin ? t("  · Admin") : ''}{u.banned ? t("  · gesperrt") : ''}</T>
            <T style={[s.hint, { marginTop: 0 }]} numberOfLines={2}>@{u.username} · {u.messages} {' '}{t("Nachrichten · dabei seit")}{' '}{new Date(u.created).toLocaleDateString(LOCALE)}{u.last_seen ? t(" · zuletzt {0}", { 0: timeLabel(u.last_seen) }) : ''}</T>
            {u.banned && u.ban_reason ? <T style={{ color: C.danger, fontSize: 12.5 }}>{u.ban_reason}</T> : null}
          </View>
          {!u.is_admin ? <Pressable accessibilityRole="button" onPress={() => setBadges(u)} style={s.mini}><T style={s.miniText}>{t("Abzeichen")}</T></Pressable> : null}
          {!u.is_admin ? <Pressable accessibilityRole="button" onPress={() => (u.banned ? unban(u) : (setReason(''), setBan(u)))} style={[s.mini, !u.banned && { borderColor: C.danger }]}><T style={[s.miniText, !u.banned && { color: C.danger }]}>{u.banned ? t("Entsperren") : t("Sperren")}</T></Pressable> : null}
        </View>
      ))}
      <Sheet open={!!badges} onClose={() => setBadges(null)} title={badges ? t("Abzeichen für {0}", { 0: badges.display }) : ''} items={badges ? BADGES.map(([k, l]) => ({ label: ((badges.badges || []).includes(k) ? '✓ ' : '') + l, onPress: () => setBadge(badges, k) })) : []} />
      {ban ? <ReasonBox title={t("{0} sperren?", { 0: ban.display })} reason={reason} setReason={setReason} onCancel={() => setBan(null)} onOk={async () => {
        const u = ban; setBan(null);
        try { await api('POST', `/api/admin/users/${u.id}/ban`, { on: true, reason }); say(t("Gesperrt")); load(); } catch (e) { say(errText(e)); }
      }} /> : null}
    </>
  );
}

const s = StyleSheet.create({
  tabs: { gap: 6, paddingHorizontal: 12, paddingVertical: 8 },
  tab: { height: 34, paddingHorizontal: 14, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: C.line },
  tabOn: { backgroundColor: C.accent, borderColor: C.accent },
  tabText: { color: C.text2, fontWeight: '700', fontSize: 14 },
  card: { borderRadius: R.lg, padding: 14 },
  hint: { color: C.muted, fontSize: 13, lineHeight: 18, marginTop: 6, textAlign: 'left' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  stat: { width: '48.5%', borderRadius: 16, padding: 14 },
  statNum: { fontSize: 24, fontWeight: '800' },
  statLabel: { color: C.muted, fontSize: 13 },
  pills: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  pill: { paddingHorizontal: 8, height: 22, borderRadius: 11, justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.08)' },
  pillText: { color: C.text2, fontSize: 12, fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10 },
  snap: { backgroundColor: C.bg1, borderRadius: 10, padding: 10, marginTop: 10 },
  btns: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  input: { backgroundColor: 'rgba(255,255,255,0.06)', color: C.text, borderRadius: R.md, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', paddingHorizontal: 13, minHeight: 44, fontSize: 15.5, fontFamily: F.medium, position: 'relative' },
  mini: { paddingHorizontal: 9, height: 30, borderRadius: 9, borderWidth: 1, borderColor: C.line, justifyContent: 'center' },
  miniText: { fontSize: 12, fontWeight: '700', color: C.text2 },
  overlay: { position: 'absolute', left: -14, right: -14, top: -14, bottom: -400, backgroundColor: 'rgba(0,0,0,0.6)', padding: 20, paddingTop: 80 },
  note: { position: 'absolute', left: 20, right: 20, bottom: 40, padding: 12, borderRadius: 14, backgroundColor: C.bg4, borderWidth: 1, borderColor: C.line, alignItems: 'center' },
});
