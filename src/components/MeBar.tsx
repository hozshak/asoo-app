// Leiste unten (wie bei Discord): großes eigenes Bild mit Rahmen (antippen = Profil), Name und Status (antippen = Status ändern),
// rechts die Glocke für Mitteilungen; stumm und Ton aus nur während eines Gesprächs.
// Dazu das Fenster „Online-Status ändern“ mit Auswahlkreisen.
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { api, errText } from '@/lib/api';
import { setState, useStore } from '@/lib/store';
import { matchNew } from '@/lib/match';
import { toggleVoice, useHost } from '@/lib/webhost';
import { useVoice, voice as appVoice } from '@/lib/calls';
import { Avatar, Badge, T } from './ui';
import { Icon } from './Icon';
import { C, HOME, statusColor } from '@/lib/theme';

const STATUS: [string, string][] = [['online', 'Online'], ['idle', 'Abwesend'], ['dnd', 'Bitte nicht stören'], ['invisible', 'Unsichtbar']];
export const statusLabel = (k?: string) => STATUS.find(([x]) => x === k)?.[1] || 'Online';

/** Statuspunkt wie bei Discord: Mond für abwesend, Strich für „nicht stören“, Ring für unsichtbar. */
export function StatusGlyph({ k, size = 18 }: { k: string; size?: number }) {
  const c = k === 'invisible' ? C.faint : statusColor(k);
  if (k === 'idle') return <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: c, overflow: 'hidden' }}><View style={{ position: 'absolute', width: size * 0.7, height: size * 0.7, borderRadius: size, backgroundColor: C.bg3, left: -size * 0.08, top: -size * 0.08 }} /></View>;
  if (k === 'dnd') return <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: c, alignItems: 'center', justifyContent: 'center' }}><View style={{ width: size * 0.55, height: size * 0.18, borderRadius: 2, backgroundColor: C.bg3 }} /></View>;
  if (k === 'invisible') return <View style={{ width: size, height: size, borderRadius: size / 2, borderWidth: size * 0.22, borderColor: c }} />;
  return <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: c }} />;
}

export function StatusSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const me = useStore((s) => s.me) as any;
  const router = useRouter();
  const ins = useSafeAreaInsets();
  const [err, setErr] = useState('');
  const cur = me?.status_raw || me?.status || 'online';
  const pick = async (k: string) => {
    Haptics.selectionAsync().catch(() => {});
    try { const d = await api<any>('PATCH', '/api/me', { status: k }); setState((s) => ({ me: { ...s.me!, ...d.user } })); onClose(); } catch (e) { setErr(errText(e)); }
  };
  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={s.back} onPress={onClose} accessibilityLabel="Schließen" />
      <View style={[s.sheet, { paddingBottom: ins.bottom + 16 }]}>
        <View style={s.grab} />
        <T style={s.title}>Online-Status ändern</T>
        <T style={s.label}>Online-Status</T>
        <View style={s.group}>
          {STATUS.map(([k, l], i) => (
            <Pressable key={k} accessibilityRole="radio" accessibilityState={{ checked: cur === k }} onPress={() => pick(k)} style={({ pressed }) => [s.opt, i > 0 && s.optLine, pressed && { backgroundColor: C.accentSoft }]}>
              <StatusGlyph k={k} />
              <T style={s.optText}>{l}</T>
              <View style={[s.radio, cur === k && s.radioOn]}>{cur === k ? <View style={s.radioDot} /> : null}</View>
            </Pressable>
          ))}
        </View>
        <Pressable accessibilityRole="button" onPress={() => { onClose(); router.push({ pathname: '/settings', params: { page: 'profile' } }); }} style={({ pressed }) => [s.group, s.opt, { marginTop: 14 }, pressed && { backgroundColor: C.accentSoft }]}>
          <Icon name="edit" size={18} color={C.text2} />
          <T style={[s.optText, { color: me?.custom_status ? C.text : C.muted }]} numberOfLines={1}>{me?.custom_status || 'Status-Text festlegen'}</T>
          <Icon name="chevron" size={16} color={C.muted} />
        </Pressable>
        {err ? <T style={{ color: C.danger, marginTop: 10, textAlign: 'center' }}>{err}</T> : null}
      </View>
    </Modal>
  );
}

/** Schwebende Leiste unten in der Chat-Liste. */
export function MeBar({ onNote }: { onNote?: (t: string) => void }) {
  const me = useStore((s) => s.me) as any;
  // Anruf in der App selbst (calls.ts) oder in der Web-Ansicht (3D-Raum, Spiel, Ersatzweg)
  const appCall = useVoice((v) => !!v.room);
  const appMuted = useVoice((v) => v.muted || v.noMic || v.smute);
  const appDeaf = useVoice((v) => v.deaf || v.sdeaf);
  const webMuted = useHost((s) => s.muted);
  const webDeaf = useHost((s) => s.deaf);
  const webCall = useHost((s) => !!s.voice);
  const inCall = appCall || webCall;
  const muted = appCall ? appMuted : webMuted;
  const deaf = appCall ? appDeaf : webDeaf;
  const notif = useStore((s) => s.notifUnread);
  const matchCount = matchNew(useStore((s) => s.match));
  const router = useRouter();
  const ins = useSafeAreaInsets();
  const [sheet, setSheet] = useState(false);
  if (!me) return null;
  const raw = me.status_raw || me.status || 'online';
  const voice = (what: 'mute' | 'deaf') => {
    Haptics.selectionAsync().catch(() => {});
    if (appCall) { if (what === 'mute') appVoice.toggleMute(); else appVoice.toggleDeaf(); return; }
    if (!toggleVoice(what)) onNote?.('Einen Moment – die Sprachverbindung wird noch vorbereitet.');
  };
  return (
    <>
      {/* Karte wie bei Discord: großes Profilbild mit Rahmen ragt links heraus, Name mit Pfeil, Status darunter, rechts die Glocke */}
      <View style={[s.bar, { bottom: Math.max(ins.bottom - 6, 10) }]}>
        <View style={[StyleSheet.absoluteFill, s.card]} />
        <Pressable accessibilityRole="button" accessibilityLabel="Mein Profil" onPress={() => router.push('/me')} style={s.av}>
          <Avatar user={me} size={AV} force live />
          <View style={s.glyph}><StatusGlyph k={raw} size={16} /></View>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Status ändern" onPress={() => setSheet(true)} style={s.who}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <T style={s.name} numberOfLines={1}>{me.display}</T>
            <Icon name="chevron" size={15} color={C.text2} stroke={2.4} />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <StatusGlyph k={raw} size={10} />
            <T style={s.sub} numberOfLines={1}>{me.custom_status || statusLabel(raw)}</T>
          </View>
        </Pressable>
        {/* stumm / Ton aus nur während eines Gesprächs – sonst wie bei Discord nur die Glocke */}
        {inCall ? <>
          <Pressable accessibilityRole="button" accessibilityLabel={muted ? 'Stummschaltung aufheben' : 'Stummschalten'} hitSlop={4} onPress={() => voice('mute')} style={[s.btn, (muted || deaf) && s.btnOff]}>
            <Icon name={muted || deaf ? 'micOff' : 'mic'} size={20} color={muted || deaf ? C.danger : C.text2} />
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={deaf ? 'Ton wieder an' : 'Ton aus'} hitSlop={4} onPress={() => voice('deaf')} style={[s.btn, deaf && s.btnOff]}>
            <Icon name={deaf ? 'headOff' : 'head'} size={20} color={deaf ? C.danger : C.text2} />
          </Pressable>
        </> : null}
        {/* Mitspieler-Match: immer einen Tipp entfernt, mit Zähler für neue Likes und Matches */}
        <Pressable accessibilityRole="button" accessibilityLabel={matchCount ? `Mitspieler-Match, ${matchCount} neu` : 'Mitspieler-Match'} hitSlop={4} onPress={() => { Haptics.selectionAsync().catch(() => {}); router.push('/match'); }} style={({ pressed }) => [s.btn, pressed && { backgroundColor: C.accentSoft }]}>
          <Icon name="pad" size={23} color={C.text2} />
          {matchCount ? <Badge n={matchCount} ring={HOME.bar} style={{ position: 'absolute', right: 0, top: 0 }} /> : null}
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={notif ? `Mitteilungen, ${notif} neu` : 'Mitteilungen'} hitSlop={4} onPress={() => router.push('/notifications')} style={({ pressed }) => [s.btn, pressed && { backgroundColor: C.accentSoft }]}>
          <Icon name="bell" size={22} color={C.text2} />
          {notif ? <Badge n={notif} ring={HOME.bar} style={{ position: 'absolute', right: 0, top: 0 }} /> : null}
        </Pressable>
        {/* ganz rechts: Einstellungen (wie das Zahnrad bei Discord) */}
        <Pressable accessibilityRole="button" accessibilityLabel="Einstellungen" hitSlop={4} onPress={() => { Haptics.selectionAsync().catch(() => {}); router.push('/settings'); }} style={({ pressed }) => [s.btn, pressed && { backgroundColor: C.accentSoft }]}>
          <Icon name="gear" size={22} color={C.text2} />
        </Pressable>
      </View>
      <StatusSheet open={sheet} onClose={() => setSheet(false)} />
    </>
  );
}
const AV = 58; // Profilbild in der Leiste (mit Rahmen)

const s = StyleSheet.create({
  // schwebende Karte ganz unten (keine Tab-Leiste mehr); das Bild ragt oben und links heraus
  bar: { position: 'absolute', left: 10, right: 10, height: 64, flexDirection: 'row', alignItems: 'center', paddingLeft: AV + 14, paddingRight: 10, gap: 2 },
  card: { borderRadius: 24, backgroundColor: HOME.bar, borderWidth: 1, borderColor: HOME.edge, shadowColor: '#000', shadowOpacity: 0.45, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 8 },
  av: { position: 'absolute', left: 4, bottom: 10, width: AV, height: AV },
  glyph: { position: 'absolute', right: -2, bottom: -2, padding: 3, borderRadius: 14, backgroundColor: HOME.bar },
  who: { flex: 1, minWidth: 0, justifyContent: 'center' },
  name: { fontSize: 17, fontWeight: '800', flexShrink: 1 },
  sub: { color: C.muted, fontSize: 13.5, flexShrink: 1 },
  btn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  btnOff: { backgroundColor: 'rgba(255,77,94,0.14)' },
  back: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' },
  sheet: { backgroundColor: C.bg2, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 16, paddingTop: 8, borderTopWidth: 1, borderColor: C.line },
  grab: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.18)', marginBottom: 12 },
  title: { fontSize: 19, fontWeight: '800', textAlign: 'center', marginBottom: 14 },
  label: { color: C.muted, fontSize: 13, marginBottom: 8, marginLeft: 2 },
  group: { backgroundColor: C.bg3, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: C.line },
  opt: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 54, paddingHorizontal: 16 },
  optLine: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.line },
  optText: { flex: 1, fontSize: 16, fontWeight: '600' },
  radio: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: C.faint, alignItems: 'center', justifyContent: 'center' },
  radioOn: { borderColor: C.accent, backgroundColor: C.accent },
  radioDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: '#fff' },
});
