// Leiste unten (wie bei Discord): eigenes Bild, Name und Status – antippen ändert den Status; daneben stumm und Ton aus.
// Dazu das Fenster „Online-Status ändern“ mit Auswahlkreisen.
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { api, errText } from '@/lib/api';
import { setState, useStore } from '@/lib/store';
import { toggleVoice, useHost } from '@/lib/webhost';
import { Avatar, Glass, T } from './ui';
import { Icon } from './Icon';
import { C, statusColor } from '@/lib/theme';

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
  const muted = useHost((s) => s.muted);
  const deaf = useHost((s) => s.deaf);
  const [sheet, setSheet] = useState(false);
  if (!me) return null;
  const raw = me.status_raw || me.status || 'online';
  const voice = (what: 'mute' | 'deaf') => {
    Haptics.selectionAsync().catch(() => {});
    if (!toggleVoice(what)) onNote?.('Einen Moment – die Sprachverbindung wird noch vorbereitet.');
  };
  return (
    <>
      <Glass style={s.bar} intensity={40} tint="rgba(24,25,38,0.94)">
        <Pressable accessibilityRole="button" accessibilityLabel="Status ändern" onPress={() => setSheet(true)} style={s.who}>
          <Avatar user={me} size={40} status frame={false} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <T style={s.name} numberOfLines={1}>{me.display}</T>
              <Icon name="chevron" size={14} color={C.muted} />
            </View>
            <T style={s.sub} numberOfLines={1}>{me.custom_status || statusLabel(raw)}</T>
          </View>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={muted ? 'Stummschaltung aufheben' : 'Stummschalten'} hitSlop={4} onPress={() => voice('mute')} style={[s.btn, (muted || deaf) && s.btnOff]}>
          <Icon name={muted || deaf ? 'micOff' : 'mic'} size={19} color={muted || deaf ? C.danger : C.text2} />
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={deaf ? 'Ton wieder an' : 'Ton aus'} hitSlop={4} onPress={() => voice('deaf')} style={[s.btn, deaf && s.btnOff]}>
          <Icon name={deaf ? 'headOff' : 'head'} size={19} color={deaf ? C.danger : C.text2} />
        </Pressable>
      </Glass>
      <StatusSheet open={sheet} onClose={() => setSheet(false)} />
    </>
  );
}

const s = StyleSheet.create({
  // über der Tab-Leiste (die ist 84 hoch und liegt unten über allem)
  bar: { position: 'absolute', left: 8, right: 8, bottom: 92, height: 60, borderRadius: 20, flexDirection: 'row', alignItems: 'center', paddingLeft: 10, paddingRight: 8, gap: 4 },
  who: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 10 },
  name: { fontSize: 15.5, fontWeight: '800', flexShrink: 1 },
  sub: { color: C.muted, fontSize: 12.5, marginTop: -2 },
  btn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
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
