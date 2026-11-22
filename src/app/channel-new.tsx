// Kanal oder Kategorie erstellen – nativ (nur Admins). Kanal: Name, Art (Text, Sprache, 3D-Raum mit Raumwahl), Kategorie.
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { api, errText } from '@/lib/api';
import { bootstrap, serverOf } from '@/lib/store';
import { Btn, Glow, Seg, SheetHead, T } from '@/components/ui';
import { Field } from '@/components/Field';
import { Icon } from '@/components/Icon';
import { C } from '@/lib/theme';

type Kind = 'text' | 'voice' | 'voice3d' | 'game';
const ROOMS: [string, string, any][] = [
  ['lounge', 'Skylounge', require('../../assets/rooms/lounge.webp')], ['beach', 'Strand', require('../../assets/rooms/beach.webp')],
  ['theater', 'Kino', require('../../assets/rooms/theater.webp')], ['wedding', 'Dawet (Hochzeit)', require('../../assets/rooms/wedding.webp')],
  ['orbit', 'Raumstation', require('../../assets/rooms/orbit.webp')], ['gaming', 'Gaming-Arena', require('../../assets/rooms/gaming.webp')],
];

export default function ChannelNew() {
  const p = useLocalSearchParams<{ sid: string; category?: string }>();
  const router = useRouter();
  const server = serverOf(p.sid);
  const isCat = p.category === '1';
  const [kind, setKind] = useState<Kind>('text');
  const [name, setName] = useState('');
  const [theme, setTheme] = useState('lounge');
  const [parent, setParent] = useState<string | null>(server?.categories?.[0]?.id || null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const save = async () => {
    setBusy(true); setErr('');
    try {
      if (isCat) await api('POST', `/api/servers/${p.sid}/categories`, { name: name.trim() });
      else await api('POST', `/api/servers/${p.sid}/channels`, { name: name.trim(), type: kind, theme: kind === 'voice3d' ? theme : undefined, parent });
      await bootstrap();
      router.back();
    } catch (e) { setErr(errText(e)); } finally { setBusy(false); }
  };
  return (
    <View style={{ flex: 1 }}>
      <Glow />
      <SheetHead title={isCat ? 'Kategorie erstellen' : 'Kanal erstellen'} onClose={() => router.back()} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 4, gap: 14, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
          {!isCat ? <Seg<Kind> items={[['text', '# Text'], ['voice', '🔊 Sprache'], ['voice3d', '🧊 3D-Raum'], ['game', '🎯 Spiel']]} value={kind} onChange={setKind} /> : null}
          <Field label={isCat ? 'Name der Kategorie' : 'Name'} value={name} onChangeText={setName} placeholder={isCat ? 'z. B. 🎮 Gaming' : kind === 'text' ? 'z. B. allgemein' : 'z. B. Chillecke'} maxLength={isCat ? 40 : 50} autoFocus />
          {!isCat && kind === 'voice3d' ? <>
            <T style={s.label}>Raum</T>
            <View style={s.grid}>{ROOMS.map(([k, l, img]) => (
              <Pressable key={k} accessibilityRole="radio" accessibilityState={{ checked: theme === k }} onPress={() => setTheme(k)} style={[s.room, theme === k && s.roomOn]}>
                <Image source={img} style={s.roomImg} contentFit="cover" />
                <T style={s.roomName} numberOfLines={1}>{l}</T>
              </Pressable>
            ))}</View>
          </> : null}
          {!isCat && server?.categories?.length ? <>
            <T style={s.label}>Kategorie</T>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
              {[{ id: null as string | null, name: 'Ohne' }, ...server.categories].map((c) => (
                <Pressable key={c.id || 'ohne'} onPress={() => setParent(c.id)} style={[s.chip, parent === c.id && s.chipOn]}>
                  {parent === c.id ? <Icon name="check" size={13} color={C.accent} stroke={2.6} /> : null}
                  <T style={[s.chipText, parent === c.id && { color: C.text }]} numberOfLines={1}>{c.name}</T>
                </Pressable>
              ))}
            </ScrollView>
          </> : null}
          {err ? <T style={{ color: C.danger }}>{err}</T> : null}
          <Btn title="Erstellen" icon="plus" busy={busy} disabled={!name.trim()} onPress={save} />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const s = StyleSheet.create({
  label: { color: C.faint, fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1.1 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  room: { width: '31%', flexGrow: 1, borderRadius: 14, overflow: 'hidden', borderWidth: 1.5, borderColor: C.line, backgroundColor: C.bg2 },
  roomOn: { borderColor: C.accent },
  roomImg: { height: 58 },
  roomName: { fontSize: 12.5, fontWeight: '700', padding: 6, textAlign: 'center' },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, height: 34, borderRadius: 17, backgroundColor: C.bg3, borderWidth: 1, borderColor: C.line },
  chipOn: { borderColor: C.accentLine, backgroundColor: C.accentSoft },
  chipText: { color: C.muted, fontWeight: '700', fontSize: 13.5 },
});
