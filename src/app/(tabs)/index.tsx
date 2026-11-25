// Start wie die Web-App am Handy: links die Leiste (Direktnachrichten, Server im Farbverlauf, wenn ausgewählt),
// rechts eine schwebende Glasfläche mit Direktnachrichten oder den Kanälen des Servers (Banner, Kategorien, Schloss).
import { useEffect, useMemo, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { pickImage as chooseImage } from '@/lib/pick';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeIn, FadeInRight, LinearTransition } from 'react-native-reanimated';
import { Avatar, Badge, Empty, Press, Section, ServerIcon, Sheet, T } from '@/components/ui';
import { Icon, type IconName } from '@/components/Icon';
import { MeBar } from '@/components/MeBar';
import { Logo } from '@/components/Logo';
import { isVerified, VerifiedMark } from '@/components/Verified';
import { plainText } from '@/lib/text';
import { api, errText, mediaSource, upload } from '@/lib/api';
import { bootstrap, can, dmTitle, getState, markRead, setState, userOf, useStore, type Channel, type Server } from '@/lib/store';
import { openWeb, webAction } from '@/lib/web';
import { joinCall, leaveForWeb, nativeRoom } from '@/lib/calls';
import { matchNew } from '@/lib/match';
import { C, GRAD, GRAD_POS, HOME } from '@/lib/theme';
import { t, LOCALE } from '@/lib/i18n';

export default function Home() {
  const servers = useStore((s) => s.servers);
  const unread = useStore((s) => s.unread);
  const mentions = useStore((s) => s.mentions);
  const dmUnread = useStore((s) => s.dms.reduce((n, d) => n + (s.unread[d.id] || 0), 0));
  const notifUnread = useStore((s) => s.notifUnread);
  const railMatch = matchNew(useStore((s) => s.match));
  const [sel, setSel] = useState<string | null>(null); // null = Direktnachrichten
  const server = servers.find((x) => x.id === sel) || null;
  const router = useRouter();
  // von außen einen Server öffnen (Einladung angenommen, Server erstellt): /?server=<id>
  const want = useLocalSearchParams<{ server?: string; t?: string }>();
  useEffect(() => { if (want.server) setSel(want.server); }, [want.server, want.t]);
  // lange drücken auf einen Server: Menü wie in der Web-App
  const [menuFor, setMenuFor] = useState<Server | null>(null);
  // Mitteilungen je Server (wie bei Discord): Standard, alle Nachrichten, nur @Erwähnungen, nichts
  const [notifFor, setNotifFor] = useState<Server | null>(null);
  const setNotify = async (sv: Server, level: 'all' | 'mentions' | 'none' | null) => {
    try {
      const d = await api<any>('PUT', `/api/servers/${sv.id}/notify`, { level });
      setState((st) => ({ servers: st.servers.map((x) => (x.id === sv.id ? { ...x, notify: d.notify, notify_raw: d.notify_raw } : x)) }));
      setNote(t("Gespeichert ✓")); setTimeout(() => setNote(''), 1600);
    } catch (e) { setNote(errText(e)); setTimeout(() => setNote(''), 3000); }
  };
  const [note, setNote] = useState('');
  const serverMenu = (sv: Server) => { Haptics.selectionAsync().catch(() => {}); setMenuFor(sv); };
  const pickImage = async (sv: Server, kind: 'icon' | 'banner') => {
    const r = await chooseImage({ title: kind === 'icon' ? t("Server-Bild") : t("Server-Banner"), crop: kind === 'icon' ? [1, 1] : [16, 6], quality: 0.75, maxSide: kind === 'icon' ? 1024 : 1600 });
    if (!r) return;
    try {
      setNote(kind === 'icon' ? t("Server-Bild wird hochgeladen …") : t("Banner wird hochgeladen …"));
      const up = await upload(kind, r.uri, r.mime);
      await api('PATCH', `/api/servers/${sv.id}`, { [kind]: up.key });
      await bootstrap();
      setNote(t("Gespeichert ✓")); setTimeout(() => setNote(''), 1800);
    } catch (e) { setNote(errText(e)); setTimeout(() => setNote(''), 3500); }
  };
  const markServerRead = (sv: Server) => {
    for (const c of sv.channels) if (getState().unread[c.id] || getState().mentions[c.id]) markRead(c.id);
  };
  const leave = (sv: Server) => {
    const go = async () => { try { await api('POST', `/api/servers/${sv.id}/leave`, {}); setSel(null); await bootstrap(); } catch (e) { setNote(errText(e)); } };
    if (Platform.OS === 'web') { if (confirm(`„${sv.name}“ verlassen?`)) go(); return; }
    Alert.alert(t("„{0}“ verlassen?", { 0: sv.name }), t("Du kannst nur mit einer neuen Einladung wieder beitreten."), [{ text: t("Abbrechen"), style: 'cancel' }, { text: t("Verlassen"), style: 'destructive', onPress: go }]);
  };
  const menuAdmin = menuFor ? can(menuFor.id, 'admin') : false;
  return (
    <View style={{ flex: 1, backgroundColor: HOME.rail }}>
      <SafeAreaView edges={['top']} style={{ flex: 1, flexDirection: 'row' }}>
        <ScrollView style={s.rail} contentContainerStyle={{ alignItems: 'center', paddingVertical: 12, gap: 10, paddingBottom: 110 }} showsVerticalScrollIndicator={false}>
          {/* gleiche Reihenfolge wie in der Web-App: Start, Feed, Mitspieler-Match, Mitteilungen – dann die Server */}
          <RailItem active={!sel} onPress={() => setSel(null)} label={t("Start")} badge={dmUnread}>
            <View style={[s.dmBtn, { borderWidth: 0 }, !sel && s.dmOn]}><Logo size={48} /></View>
          </RailItem>
          <RailItem active={false} onPress={() => router.push('/feed')} label={t("Feed")}><View style={s.dmBtn}><Icon name="sparkle" size={22} color={C.text2} /></View></RailItem>
          <RailItem active={false} onPress={() => { Haptics.selectionAsync().catch(() => {}); router.push('/match'); }} label={t("Mitspieler-Match")} badge={railMatch}><View style={s.dmBtn}><Icon name="pad" size={23} color={C.text2} /></View></RailItem>
          <RailItem active={false} onPress={() => router.push('/notifications')} label={t("Mitteilungen")} badge={notifUnread}><View style={s.dmBtn}><Icon name="bell" size={22} color={C.text2} /></View></RailItem>
          <View style={s.railSep} />
          {servers.map((sv) => {
            const has = sv.channels.some((c) => unread[c.id]);
            const ment = sv.channels.reduce((n, c) => n + (mentions[c.id] || 0), 0);
            // Zahl = neue Nachrichten im ganzen Server; rot, wenn dich jemand erwähnt hat
            const count = sv.channels.reduce((n, c) => n + (unread[c.id] || 0), 0);
            return <RailItem key={sv.id} active={sel === sv.id} unread={has} badge={count || ment} hot={ment > 0} onPress={() => setSel(sv.id)} onLong={() => serverMenu(sv)} label={sv.name}><ServerIcon server={sv} size={48} active={sel === sv.id} radius={16} /></RailItem>;
          })}
          {/* wie in der Web-App: Server hinzufügen (erstellen/beitreten) und Server entdecken, beide grün */}
          <RailItem active={false} onPress={() => router.push('/server-new')} label={t("Server hinzufügen")}><View style={[s.dmBtn, s.green]}><Icon name="plus" size={24} color={C.ok} /></View></RailItem>
          <RailItem active={false} onPress={() => router.push({ pathname: '/server-new', params: { tab: 'discover' } })} label={t("Server entdecken")}><View style={[s.dmBtn, s.green]}><Icon name="compass" size={24} color={C.ok} /></View></RailItem>
        </ScrollView>
        <View style={s.panel}>
          {server ? <ServerPanel key={server.id} server={server} onMenu={() => serverMenu(server)} /> : <DmPanel />}
        </View>
      </SafeAreaView>
      {/* wie bei Discord über die ganze Breite, auch über der Server-Leiste */}
      <MeBar onNote={setNote} />
      {note ? <View style={s.note} pointerEvents="none"><T style={{ color: C.text, fontWeight: '700' }}>{note}</T></View> : null}
      <Sheet open={!!menuFor} onClose={() => setMenuFor(null)} title={menuFor?.name} items={menuFor ? [
        { label: t("Als gelesen markieren"), icon: 'check', onPress: () => markServerRead(menuFor) },
        { label: t("Leute einladen"), icon: 'userPlus', onPress: () => router.push({ pathname: '/server-invite', params: { sid: menuFor.id } }) },
        { label: t("Mitteilungen"), icon: 'bell', onPress: () => setNotifFor(menuFor) },
        menuAdmin ? { label: t("Server-Bild ändern"), icon: 'image', onPress: () => pickImage(menuFor, 'icon') } : null,
        menuAdmin ? { label: t("Banner ändern"), icon: 'image', onPress: () => pickImage(menuFor, 'banner') } : null,
        menuAdmin ? { label: t("Server-Einstellungen"), icon: 'gear', onPress: () => router.push({ pathname: '/server-settings', params: { sid: menuFor.id } }) } : null,
        menuFor.role !== 'owner' ? { label: t("Server verlassen"), icon: 'logout', danger: true, onPress: () => leave(menuFor) } : null,
      ] : []} />
      <Sheet open={!!notifFor} onClose={() => setNotifFor(null)} title={notifFor ? t("Mitteilungen · {0}", { 0: notifFor.name }) : undefined} items={notifFor ? ([
        [null, 'Standard (bis 50 Mitglieder alles)'], ['all', 'Alle Nachrichten'], ['mentions', 'Nur @Erwähnungen'], ['none', 'Nichts'],
      ] as const).map(([k, label]) => ({ label, icon: (notifFor.notify_raw ?? null) === k ? 'check' : 'bell', onPress: () => setNotify(notifFor, k) })) : []} />
    </View>
  );
}

function RailItem({ active, unread, badge, hot = true, onPress, onLong, label, children }: { active: boolean; unread?: boolean; badge?: number; hot?: boolean; onPress: () => void; onLong?: () => void; label: string; children: React.ReactNode }) {
  return (
    <View style={{ width: 72, alignItems: 'center' }}>
      {active ? <Animated.View entering={FadeIn} style={[s.pip, { height: 40 }]} /> : unread ? <View style={[s.pip, { height: 8, backgroundColor: C.text }]} /> : null}
      <Press onPress={onPress} onLongPress={onLong} label={label} scale={0.92}>{children}</Press>
      {badge ? <Badge n={badge} ring={HOME.rail} style={[{ position: 'absolute', right: 8, bottom: -4 }, !hot && { backgroundColor: C.accent }]} /> : null}
    </View>
  );
}

function HeadBtn({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} hitSlop={6} onPress={onPress} style={({ pressed }) => [s.headBtn, pressed && { backgroundColor: C.accentSoft }]}>
      <Icon name={icon} size={18} color={C.text2} />
    </Pressable>
  );
}

function ToolChip({ icon, label, onPress, color = C.accent, primary }: { icon: IconName; label: string; onPress: () => void; color?: string; primary?: boolean }) {
  return (
    <Press label={label} onPress={onPress} scale={0.94} style={[s.chip, primary ? s.chipPrimary : s.chipPlain]}>
      {primary ? <LinearGradient colors={GRAD as any} locations={GRAD_POS as any} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} /> : null}
      <View><Icon name={icon} size={15} color={primary ? '#fff' : C.text2} stroke={2.3} /></View>
      <T style={[s.chipText, { color: primary ? '#fff' : C.text2 }]}>{label}</T>
    </Press>
  );
}

/** Zeit wie bei Discord: „5 Min.“, heute die Uhrzeit, dann „3 T.“, ältere als Datum */
function ago(ts?: number) {
  if (!ts) return '';
  const d = Date.now() - ts, min = 60000, day = 86400000;
  if (d < min) return t('jetzt');
  if (d < 60 * min) return t('{0} Min.', { 0: Math.floor(d / min) });
  const dt = new Date(ts), now = new Date();
  if (dt.toDateString() === now.toDateString()) return dt.toLocaleTimeString(LOCALE, { hour: '2-digit', minute: '2-digit' });
  if (d < 7 * day) return t('{0} T.', { 0: Math.max(1, Math.round(d / day)) });
  return dt.toLocaleDateString(LOCALE, { day: '2-digit', month: '2-digit' });
}

function DmPanel() {
  const dms = useStore((s) => s.dms);
  const me = useStore((s) => s.me);
  const unread = useStore((s) => s.unread);
  const requests = useStore((s) => s.friends.incoming.length); // offene Freundschaftsanfragen (früher in der Tab-Leiste)
  const [mailHidden, setMailHidden] = useState(false);
  useStore((s) => s.users); // Namen in der Vorschau nachzeichnen
  const match = useStore((s) => s.match);
  const matchCount = matchNew(match);
  const router = useRouter();
  const preview =(d: (typeof dms)[number]) => {
    const l = d.last;
    if (!l) return d.kind === 'group' ? t('{0} Mitglieder', { 0: d.members.length }) : '';
    const who = l.a === me?.id ? t('Du: ') : d.kind === 'group' ? (userOf(l.a)?.display || '') + ': ' : '';
    if (l.k === 'call') return who + t('Anruf');
    if (l.k === 'poll') return who + '📊 ' + plainText(l.c);
    const text = plainText(l.c).replace(/\s+/g, ' ').trim();
    return who + (text || (l.att ? t('📎 Anhang') : ''));
  };
  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
      <View style={[s.head, s.headRow]}>
        <T style={[s.headText, { flex: 1, fontSize: 22 }]}>{t("Nachrichten")}</T>
      </View>
      {/* wie bei Discord: Suchen, Freunde hinzufügen, neue Gruppe */}
      <View style={s.dmTools}>
        <Pressable accessibilityRole="button" accessibilityLabel={t("In Nachrichten suchen")} onPress={() => router.push('/search')} style={({ pressed }) => [s.toolRound, pressed && s.rowPressed]}>
          <Icon name="search" size={19} color={C.text2} />
        </Pressable>
        <Pressable accessibilityRole="button" onPress={() => router.push('/friends')} style={({ pressed }) => [s.toolWide, pressed && s.rowPressed]}>
          <Icon name="userPlus" size={18} color={C.text2} />
          <T style={{ fontWeight: '700', color: C.text2 }}>{t("Freunde hinzufügen")}</T>
          {requests ? <Badge n={requests} /> : null}
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={t("Neue Gruppe")} onPress={() => router.push('/group-new')} style={({ pressed }) => [s.toolPlus, pressed && { opacity: 0.85 }]}>
          <LinearGradient colors={GRAD as any} locations={GRAD_POS as any} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
          <View><Icon name="plus" size={22} color="#fff" stroke={2.4} /></View>
        </Pressable>
      </View>
      {/* „Mitspieler finden“ (Gamer-Matching): gut sichtbar über den Gesprächen, mit Zähler für neue Likes und Matches */}
      <Pressable accessibilityRole="button" accessibilityLabel={t("Mitspieler-Match")} onPress={() => { Haptics.selectionAsync().catch(() => {}); router.push('/match'); }} style={({ pressed }) => [s.matchCard, pressed && { opacity: 0.85 }]}>
        <LinearGradient colors={['rgba(132,104,255,0.22)', 'rgba(255,92,154,0.10)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
        <View style={s.matchIc}><LinearGradient colors={GRAD as any} locations={GRAD_POS as any} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} /><View><Icon name="pad" size={22} color="#fff" stroke={2.2} /></View></View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <T style={{ fontWeight: '800', fontSize: 15.5 }} numberOfLines={1}>{t("Mitspieler-Match")}</T>
          <T style={{ color: C.text2, fontSize: 12.5, marginTop: -2 }} numberOfLines={1}>{matchCount ? t("{0} neu · Likes & Matches", { 0: matchCount }) : match.has ? t("Karten ansehen, Likes und Matches") : t("Finde Leute zum Zocken")}</T>
        </View>
        {matchCount ? <Badge n={matchCount} /> : <View style={{ transform: [{ rotate: '-90deg' }] }}><Icon name="chevron" size={14} color={C.text2} stroke={2.4} /></View>}
      </Pressable>
      {!(me as any)?.email && !mailHidden ? (
        <View style={s.mailCard}>
          <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/settings', params: { page: 'email' } })} style={({ pressed }) => [{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 }, pressed && { opacity: 0.8 }]}>
          <View style={s.mailIc}><Icon name="at" size={18} color={C.accent} /></View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <T style={{ fontWeight: '800', fontSize: 14.5 }} numberOfLines={1}>{t("E-Mail hinzufügen")}</T>
            <T style={{ color: C.muted, fontSize: 12.5, marginTop: -2 }} numberOfLines={2}>{t("Damit du dein Passwort zurücksetzen kannst.")}</T>
          </View>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={t("Ausblenden")} hitSlop={10} onPress={() => setMailHidden(true)}><Icon name="x" size={16} color={C.muted} /></Pressable>
        </View>
      ) : null}
      {!dms.length ? <Empty icon="comment" title={t("Noch keine Gespräche")} text={t("Unter „Freunde hinzufügen“ findest du Leute und kannst ihnen schreiben.")} /> : null}
      {dms.map((d, i) => {
        const other = d.kind === 'dm' ? d.members.find((u) => u.id !== me?.id) : null;
        const n = unread[d.id];
        const pv = preview(d);
        return (
          <Animated.View key={d.id} entering={FadeInRight.delay(Math.min(i, 12) * 25).duration(260)} layout={LinearTransition}>
            <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/chat/[id]', params: { id: d.id } })} style={({ pressed }) => [s.row, s.dmRow, pressed && s.rowPressed]}>
              {other ? <Avatar user={other} size={46} status /> : <LinearGradient colors={GRAD as any} style={[s.group, { width: 46, height: 46, borderRadius: 23 }]}><Icon name="users" size={20} color="#fff" /></LinearGradient>}
              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <View style={{ flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 4 }}><T style={[s.rowName, { flexShrink: 1 }, n ? { color: C.text, fontWeight: '800' } : null]} numberOfLines={1}>{dmTitle(d, me?.id)}</T>{other && isVerified(userOf(other.id)) ? <VerifiedMark size={14} /> : null}</View>
                  <T style={[s.when, n ? { color: C.text } : null]}>{ago(d.last?.t || d.last_at)}</T>
                </View>
                {pv ? <T style={[s.rowSub, n ? { color: C.text2, fontWeight: '700' } : null]} numberOfLines={1}>{pv}</T> : other?.custom_status ? <T style={s.rowSub} numberOfLines={1}>{other.custom_status}</T> : null}
              </View>
              {n ? <Badge n={n} /> : null}
            </Pressable>
          </Animated.View>
        );
      })}
    </ScrollView>
  );
}

function ServerPanel({ server, onMenu }: { server: Server; onMenu: () => void }) {
  const router = useRouter();
  const unread = useStore((s) => s.unread);
  const mentions = useStore((s) => s.mentions);
  const voice = useStore((s) => s.voice);
  useStore((s) => s.users); // Namen der Leute in Räumen nachzeichnen, sobald sie geladen sind
  const [shut, setShut] = useState<Record<string, boolean>>({});
  const groups = useMemo(() => {
    const cats = server.categories || [];
    const known = new Set(cats.map((c) => c.id));
    if (!cats.length) return [
      { id: '_t', name: 'Textkanäle', chs: server.channels.filter((c) => c.type === 'text') },
      { id: '_v', name: 'Sprachräume', chs: server.channels.filter((c) => c.type !== 'text') },
    ];
    return [{ id: '_', name: '', chs: server.channels.filter((c) => !c.parent || !known.has(c.parent)) }, ...cats.map((cat) => ({ id: cat.id, name: cat.name, chs: server.channels.filter((c) => c.parent === cat.id) }))];
  }, [server]);
  // Text- und Sprachkanäle in der App selbst, 3D-Räume und Spiele aus der Web-App
  const open = (c: Channel) => {
    if (nativeRoom(c.type)) return joinCall(c.id);
    if (c.type !== 'text') { leaveForWeb(); return openWeb(router, `/channels/${server.id}/${c.id}`); }
    markRead(c.id); router.push({ pathname: '/chat/[id]', params: { id: c.id } });
  };
  const banner = mediaSource(server.banner);
  const mod = can(server.id, 'mod'), admin = can(server.id, 'admin');
  // Server-Werkzeuge wie im Menü der Web-App: Einladen, Suchen, Kanal/Kategorie erstellen, Einstellungen bzw. Moderation
  // beschriftete Knöpfe in Farbe, waagerecht wischbar – „Einladen“ hervorgehoben
  const tools = (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.tools}>
      <ToolChip icon="userPlus" label={t("Einladen")} primary onPress={() => router.push({ pathname: '/server-invite', params: { sid: server.id } })} />
      <ToolChip icon="search" label={t("Suchen")} onPress={() => router.push({ pathname: '/search', params: { sid: server.id } })} />
      {admin ? <ToolChip icon="plusCircle" label={t("Kanal")} onPress={() => router.push({ pathname: '/channel-new', params: { sid: server.id } })} /> : null}
      {admin ? <ToolChip icon="folder" label={t("Kategorie")} onPress={() => router.push({ pathname: '/channel-new', params: { sid: server.id, category: '1' } })} /> : null}
      {mod ? <ToolChip icon={admin ? 'gear' : 'shield'} label={admin ? t("Einstellungen") : t("Moderation")} onPress={() => router.push({ pathname: '/server-settings', params: { sid: server.id, tab: admin ? 'overview' : 'members' } })} /> : null}
    </ScrollView>
  );
  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 110 }}>
      {/* Kopf antippen = Server-Menü (wie in der Web-App) */}
      <Pressable accessibilityRole="button" accessibilityLabel={t("Server-Menü")} onPress={onMenu}>
        {banner ? <View style={s.banner}><Image source={banner} style={StyleSheet.absoluteFill} contentFit="cover" /><LinearGradient colors={['transparent', 'rgba(14,15,24,0.95)']} style={StyleSheet.absoluteFill} />
            <View style={[s.headRow, { position: 'absolute', left: 16, right: 12, bottom: 10 }]}><T style={[s.headText, { flex: 1 }]} numberOfLines={1}>{server.name}</T><Icon name="chevron" size={14} color={C.text2} stroke={2.4} /></View></View>
          : <View style={[s.head, s.headRow]}><View style={{ flex: 1, minWidth: 0 }}><T style={s.headText} numberOfLines={1}>{server.name}</T>{server.member_count ? <T style={s.headSub}>{server.member_count} {' '}{t("Mitglieder")}</T> : null}</View><Icon name="chevron" size={14} color={C.muted} stroke={2.4} /></View>}
      </Pressable>
      {tools}
      {groups.map((g) => (!g.chs.length && g.id !== '_') ? null : (
        <View key={g.id}>
          {g.name ? <Pressable accessibilityRole="button" onPress={() => setShut((x) => ({ ...x, [g.id]: !x[g.id] }))} style={s.cat}>
            <View style={{ transform: [{ rotate: shut[g.id] ? '-90deg' : '0deg' }] }}><Icon name="chevron" size={12} color={C.faint} stroke={2.6} /></View>
            <Section style={{ flex: 1 }}>{g.name}</Section>
          </Pressable> : null}
          {(shut[g.id] ? [] : g.chs).map((c) => {
            const priv = c.view_role && c.view_role !== 'member';
            const n = unread[c.id], m = mentions[c.id];
            const row = (
              <Pressable key={c.id} accessibilityRole="button" onPress={() => open(c)} style={({ pressed }) => [s.ch, pressed && s.chPressed]}>
                <View>
                  <Icon name={c.type === 'text' ? 'hash' : c.type === 'voice3d' ? 'cube' : c.type === 'game' ? 'target' : 'volume'} size={18} color={n ? C.text : C.faint} />
                  {priv ? <View style={s.lock}><Icon name="lock" size={9} color={C.text2} stroke={2.6} /></View> : null}
                </View>
                <T style={[s.chName, n ? { color: C.text, fontWeight: '700' } : null]} numberOfLines={1}>{c.name}</T>
                {c.type !== 'text' && c.user_limit ? <T style={s.limit}>{new Set((voice[c.id] || []).map((x) => x.uid)).size}/{c.user_limit}</T> : null}
                {m ? <Badge n={m} /> : n ? <View style={s.dot} /> : null}
              </Pressable>
            );
            // wer gerade im Raum ist (wie in der Web-App unter dem Kanal)
            const inRoom = c.type !== 'text' ? voice[c.id] || [] : [];
            return !inRoom.length ? row : (
              <View key={c.id}>
                {row}
                {inRoom.map((vm) => (
                  <View key={vm.cid || vm.uid} style={s.vUser}>
                    <Avatar user={userOf(vm.uid)} size={22} frame={false} />
                    <T style={s.vName} numberOfLines={1}>{userOf(vm.uid).display}</T>
                    {vm.video ? <Icon name="video" size={14} color={C.muted} /> : null}
                    {vm.sdeaf || vm.deaf ? <Icon name="headOff" size={14} color={vm.sdeaf ? C.danger : C.muted} /> : vm.smute || vm.muted ? <Icon name="micOff" size={14} color={vm.smute ? C.danger : C.muted} /> : null}
                  </View>
                ))}
              </View>
            );
          })}
        </View>
      ))}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  rail: { width: 72, flexGrow: 0 },
  dmBtn: { width: 48, height: 48, borderRadius: 16, backgroundColor: HOME.raised, borderWidth: 1, borderColor: HOME.edge, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  dmOn: { borderColor: 'transparent', shadowColor: '#8468ff', shadowOpacity: 0.8, shadowRadius: 12, shadowOffset: { width: 0, height: 6 } },
  railSep: { width: 28, height: 1, backgroundColor: C.line },
  pip: { position: 'absolute', left: 0, top: '50%', marginTop: -20, width: 4, borderTopRightRadius: 4, borderBottomRightRadius: 4, backgroundColor: C.accent },
  panel: { flex: 1, overflow: 'hidden', backgroundColor: HOME.panel, borderTopLeftRadius: 22, borderTopWidth: 1, borderLeftWidth: 1, borderColor: HOME.edge },
  head: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: HOME.edge, marginBottom: 6 },
  headText: { fontSize: 18, fontWeight: '800', letterSpacing: -0.2 },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  headBtn: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  tools: { flexDirection: 'row', gap: 6, paddingHorizontal: 10, paddingTop: 2, paddingBottom: 6 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, height: 32, paddingHorizontal: 11, borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  chipPrimary: { borderColor: 'transparent' },
  chipPlain: { backgroundColor: 'rgba(255,255,255,0.06)', borderColor: C.line },
  chipText: { fontSize: 13, fontWeight: '800' },
  green: { backgroundColor: HOME.raised, borderColor: HOME.edge },
  headSub: { color: C.muted, fontSize: 12, marginTop: 1 },
  banner: { height: 120, overflow: 'hidden', marginBottom: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 10, paddingVertical: 8, marginHorizontal: 8, borderRadius: 14 },
  dmRow: { paddingVertical: 9 },
  when: { color: C.faint, fontSize: 12 },
  dmTools: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingBottom: 10 },
  matchCard: { flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: 14, marginBottom: 10, paddingHorizontal: 12, height: 60, borderRadius: 18, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(132,104,255,0.38)', backgroundColor: HOME.raised },
  matchIc: { width: 40, height: 40, borderRadius: 13, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  toolRound: { width: 44, height: 44, borderRadius: 22, backgroundColor: HOME.raised, borderWidth: 1, borderColor: HOME.edge, alignItems: 'center', justifyContent: 'center' },
  toolWide: { flex: 1, height: 44, borderRadius: 22, backgroundColor: HOME.raised, borderWidth: 1, borderColor: HOME.edge, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  toolPlus: { width: 44, height: 44, borderRadius: 14, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  rowPressed: { backgroundColor: HOME.raised },
  mailCard: { flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: 14, marginBottom: 10, padding: 12, borderRadius: 16, backgroundColor: HOME.raised, borderWidth: 1, borderColor: C.accentLine },
  mailIc: { width: 36, height: 36, borderRadius: 12, backgroundColor: C.accentSoft, alignItems: 'center', justifyContent: 'center' },
  rowName: { color: C.text2, fontSize: 16, fontWeight: '600' },
  rowSub: { color: C.muted, fontSize: 13, marginTop: -2 },
  iconBubble: { width: 42, height: 42, borderRadius: 14, backgroundColor: C.accentSoft, borderWidth: 1, borderColor: C.accentLine, alignItems: 'center', justifyContent: 'center' },
  group: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  cat: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingTop: 16, paddingBottom: 6 },
  ch: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, minHeight: 42, marginHorizontal: 8, borderRadius: 12 },
  chPressed: { backgroundColor: C.accentSoft, borderWidth: 1, borderColor: C.accentLine },
  chName: { color: C.muted, fontSize: 16, flex: 1, fontWeight: '500' },
  lock: { position: 'absolute', right: -5, bottom: -4, backgroundColor: C.bg2, borderRadius: 6, padding: 1 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.text },
  note: { position: 'absolute', left: 20, right: 20, bottom: 100, padding: 12, borderRadius: 14, backgroundColor: C.bg4, borderWidth: 1, borderColor: C.line, alignItems: 'center' },
  limit: { color: C.muted, fontSize: 12, fontWeight: '700', backgroundColor: C.bg3, borderRadius: 8, paddingHorizontal: 6, overflow: 'hidden' },
  vUser: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 42, paddingRight: 14, minHeight: 30 },
  vName: { color: C.text2, fontSize: 14, flex: 1 },
});
