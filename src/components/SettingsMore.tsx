// Weitere Einstellungen – nativ (vorher nur in der Web-Ansicht „Alle Einstellungen“):
// Profilbild, Banner und Farben, Pronomen · Privatsphäre (wer schreiben darf, Blockierte, angemeldete Geräte) · Mitteilungen.
import { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Image } from 'expo-image';
import { pickImage as chooseImage } from '@/lib/pick';
import * as Notifications from 'expo-notifications';
import { LinearGradient } from 'expo-linear-gradient';
import { api, errText, mediaSource, upload } from '@/lib/api';
import { putUsers, setState, userOf, useStore } from '@/lib/store';
import { registerPush } from '@/lib/push';
import { Avatar, Btn, Glass, Section, Seg, T } from './ui';
import { Icon } from './Icon';
import { C, F, R } from '@/lib/theme';
import { t as tr, LOCALE } from '@/lib/i18n';

const ACCENTS = ['#7c5cff', '#ff5c8a', '#2ec5ff', '#3ddc97', '#ffb02e', '#ff6b3d', '#e04dff', '#5865f2', '#00c2a8', '#ff3d3d'];
type Patch = (body: any, ok?: string) => Promise<void>;

/** Profilbild, Banner, Akzent- und Bannerfarbe, Pronomen. */
export function LookSection({ patch, say }: { patch: Patch; say: (t: string) => void }) {
  const me = useStore((s) => s.me) as any;
  const [busy, setBusy] = useState<'' | 'avatar' | 'banner'>('');
  if (!me) return null;
  const pick = async (kind: 'avatar' | 'banner') => {
    const r = await chooseImage({ title: kind === 'avatar' ? tr("Profilbild ändern") : tr("Banner ändern"), crop: kind === 'avatar' ? [1, 1] : [3, 1], quality: 0.75, maxSide: kind === 'avatar' ? 1024 : 1600 });
    if (!r) return;
    setBusy(kind);
    try { const up = await upload(kind, r.uri, r.mime); await patch({ [kind]: up.key }, kind === 'avatar' ? 'Profilbild gespeichert ✓' : 'Banner gespeichert ✓'); }
    catch (e) { say(errText(e)); }
    setBusy('');
  };
  const banner = mediaSource(me.banner);
  return (
    <>
      <Glass style={s.card} intensity={20}>
        <View style={s.preview}>
          {banner ? <Image source={banner} style={StyleSheet.absoluteFill} contentFit="cover" />
            : <LinearGradient colors={[me.banner_color || me.accent || C.accent, '#ff5c8a']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />}
          <View style={s.previewAv}><Avatar user={me} size={72} /></View>
        </View>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 44 }}>
          <Btn title={busy === 'avatar' ? tr("Lädt …") : tr("Profilbild ändern")} kind="secondary" small busy={busy === 'avatar'} onPress={() => pick('avatar')} style={{ flex: 1 }} />
          <Btn title={busy === 'banner' ? tr("Lädt …") : tr("Banner ändern")} kind="secondary" small busy={busy === 'banner'} onPress={() => pick('banner')} style={{ flex: 1 }} />
        </View>
        {me.avatar || me.banner ? (
          <View style={{ flexDirection: 'row', gap: 16, marginTop: 8 }}>
            {me.avatar ? <T style={s.textLink} onPress={() => patch({ avatar: null }, 'Profilbild entfernt')}>{tr("Profilbild entfernen")}</T> : null}
            {me.banner ? <T style={s.textLink} onPress={() => patch({ banner: null }, 'Banner entfernt')}>{tr("Banner entfernen")}</T> : null}
          </View>
        ) : null}
        <T style={s.label}>{tr("Akzentfarbe")}</T>
        <View style={s.colors}>
          {ACCENTS.map((c) => <Pressable key={c} accessibilityRole="radio" accessibilityLabel={c} accessibilityState={{ checked: me.accent === c }} onPress={() => patch({ accent: c }, 'Farbe gesetzt ✓')} style={[s.dot, { backgroundColor: c }, me.accent === c && s.dotOn]} />)}
        </View>
        <T style={s.label}>{tr("Bannerfarbe")}{' '}{me.banner ? tr("(gilt, wenn kein Banner-Bild gesetzt ist)") : ''}</T>
        <View style={s.colors}>
          <Pressable accessibilityRole="radio" accessibilityLabel={tr("Standard")} accessibilityState={{ checked: !me.banner_color }} onPress={() => patch({ banner_color: null }, 'Farbe gesetzt ✓')} style={[s.dot, !me.banner_color && s.dotOn, { overflow: 'hidden' }]}>
            <LinearGradient colors={[C.accent, '#ff5c8a']} style={StyleSheet.absoluteFill} />
          </Pressable>
          {ACCENTS.map((c) => <Pressable key={c} accessibilityRole="radio" accessibilityLabel={c} accessibilityState={{ checked: me.banner_color === c }} onPress={() => patch({ banner_color: c }, 'Farbe gesetzt ✓')} style={[s.dot, { backgroundColor: c }, me.banner_color === c && s.dotOn]} />)}
        </View>
      </Glass>
    </>
  );
}

const deviceName = (ua = '') => {
  const os = /iphone|ipad|asoo-app|darwin/i.test(ua) ? 'iPhone/iPad' : /android/i.test(ua) ? 'Android' : /windows/i.test(ua) ? 'Windows' : /mac os/i.test(ua) ? 'Mac' : /linux/i.test(ua) ? 'Linux' : 'Unbekanntes Gerät';
  const br = /zunodesktop/i.test(ua) ? 'ToLobby-App' : /edg\//i.test(ua) ? 'Edge' : /firefox/i.test(ua) ? 'Firefox' : /chrome|crios/i.test(ua) ? 'Chrome' : /safari/i.test(ua) ? 'Safari' : /asoo-app|okhttp|cfnetwork|expo/i.test(ua) ? 'ToLobby-App' : '';
  return br ? `${os} · ${br}` : os;
};

/** Wer mir schreiben darf, blockierte Leute, angemeldete Geräte. */
export function PrivacySection({ patch, say }: { patch: Patch; say: (t: string) => void }) {
  const me = useStore((s) => s.me) as any;
  const blocks = useStore((s) => s.blocks);
  const users = useStore((s) => s.users);
  const [sessions, setSessions] = useState<any[] | null>(null);
  const loadSessions = () => api<any>('GET', '/api/me/sessions').then((d) => setSessions(d.sessions || [])).catch(() => setSessions([]));
  useEffect(() => { loadSessions(); }, []);
  useEffect(() => {
    for (const id of blocks) if (!users[id]) api<any>('GET', '/api/users/' + id).then((d) => putUsers([d.user])).catch(() => {});
  }, [blocks.join(',')]);
  if (!me) return null;
  const unblock = async (id: string) => {
    try { await api('POST', `/api/users/${id}/block`, { on: false }); setState((s) => ({ blocks: s.blocks.filter((x) => x !== id) })); say(tr("Blockierung aufgehoben")); }
    catch (e) { say(errText(e)); }
  };
  const others = async () => {
    try { await api('POST', '/api/me/sessions/revoke-others', {}); say(tr("Alle anderen Geräte wurden abgemeldet.")); loadSessions(); } catch (e) { say(errText(e)); }
  };
  return (
    <>
      <Glass style={s.card} intensity={20}>
        <T style={[s.label, { marginTop: 0 }]}>{tr("Wer darf mir Direktnachrichten schicken?")}</T>
        <Seg items={[['all', 'Meine Freunde'], ['none', 'Niemand']]} value={me.dm_policy === 'none' ? 'none' : 'all'} onChange={(v) => patch({ dm_policy: v })} />
        <T style={s.hint}>{tr("Schreiben und anrufen können dich nur Leute, deren Freundschaftsanfrage du angenommen hast. Mit dem Status „Unsichtbar“ sehen andere dich als offline.")}</T>
        <T style={s.label}>{tr("Blockierte Nutzer")}</T>
        {!blocks.length ? <T style={s.hint}>{tr("Du hast niemanden blockiert.")}</T> : blocks.map((id) => (
          <View key={id} style={s.row}>
            <Avatar user={userOf(id)} size={32} frame={false} />
            <T style={{ flex: 1, fontWeight: '600' }} numberOfLines={1}>{userOf(id).display}</T>
            <Btn title={tr("Freigeben")} small kind="secondary" onPress={() => unblock(id)} />
          </View>
        ))}
        <T style={s.label}>{tr("Angemeldete Geräte")}</T>
        {!sessions ? <ActivityIndicator color={C.accent} /> : sessions.map((x, i) => (
          <View key={x.id || i} style={s.row}>
            <Icon name={/iphone|android|asoo-app|expo|cfnetwork/i.test(x.ua || '') ? 'phone' : 'globe'} size={18} color={C.text2} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <T style={{ fontWeight: '600' }} numberOfLines={1}>{deviceName(x.ua)}{x.current ? tr("  · Dieses Gerät") : ''}</T>
              {x.created ? <T style={s.hint}>{tr("Angemeldet am")}{' '}{new Date(x.created).toLocaleString(LOCALE)}</T> : null}
            </View>
          </View>
        ))}
        {sessions && sessions.length > 1 ? <Btn title={tr("Alle anderen Geräte abmelden")} small kind="secondary" onPress={others} style={{ marginTop: 10 }} /> : null}
      </Glass>
    </>
  );
}

/** Mitteilungen: Erlaubnis anzeigen und einschalten. */
export function PushSection({ say }: { say: (t: string) => void }) {
  const [status, setStatus] = useState<string>('');
  const check = () => { if (Platform.OS === 'web') { setStatus('web'); return; } Notifications.getPermissionsAsync().then((p) => setStatus(p.status)).catch(() => setStatus('')); };
  useEffect(check, []);
  const enable = async () => {
    if (status === 'denied') { Linking.openSettings().catch(() => {}); return; }
    const t = await registerPush(); check();
    say(t ? tr("Mitteilungen sind an ✓") : tr("Mitteilungen konnten nicht eingeschaltet werden."));
  };
  const label = status === 'granted' ? 'Erlaubt ✓' : status === 'denied' ? 'In den iPhone-Einstellungen ausgeschaltet' : status === 'web' ? 'Nur in der iPhone-App' : 'Noch nicht erlaubt';
  return (
    <>
      <Glass style={s.card} intensity={20}>
        <View style={s.row}>
          <Icon name="bell" size={20} color={C.text2} />
          <View style={{ flex: 1 }}>
            <T style={{ fontWeight: '700' }}>{tr("Push-Mitteilungen")}</T>
            <T style={s.hint}>{tr("Für Direktnachrichten, Erwähnungen und Anrufe – auch wenn die App zu ist.")}{' '}{label}</T>
          </View>
        </View>
        {status !== 'granted' && status !== 'web' ? <Btn title={status === 'denied' ? tr("iPhone-Einstellungen öffnen") : tr("Einschalten")} small onPress={enable} style={{ marginTop: 8 }} /> : null}
        <T style={s.hint}>{tr("Mit dem Status „Bitte nicht stören“ bekommst du keine Töne und keine Anrufe.")}</T>
      </Glass>
    </>
  );
}

const s = StyleSheet.create({
  h2: { marginTop: 22, marginBottom: 8, marginLeft: 4 },
  card: { borderRadius: R.lg, padding: 14 },
  label: { color: C.faint, fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1.1, marginTop: 16, marginBottom: 8 },
  hint: { color: C.muted, fontSize: 13, lineHeight: 18, marginTop: 6 },
  input: { backgroundColor: 'rgba(255,255,255,0.06)', color: C.text, borderRadius: R.md, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', paddingHorizontal: 14, height: 46, fontSize: 16, fontFamily: F.regular },
  preview: { height: 96, borderRadius: 16, overflow: 'visible' },
  previewAv: { position: 'absolute', left: 14, bottom: -36, borderRadius: 40, borderWidth: 4, borderColor: C.bg2 },
  textLink: { color: C.accent, fontWeight: '700', fontSize: 13.5 },
  colors: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  dot: { width: 34, height: 34, borderRadius: 17, borderWidth: 2, borderColor: 'transparent' },
  dotOn: { borderColor: '#fff', transform: [{ scale: 1.08 }] },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
});
