// Ich: großes Profil mit Banner und animiertem Rahmen (wie die Profilkarte der Web-App), Status, Einstellungen, Abmelden.
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { api, errText, mediaSource, upload } from '@/lib/api';
import { setState, useStore } from '@/lib/store';
import { signOut } from '@/lib/session';
import { openWeb } from '@/lib/web';
import { Avatar, Btn, Glass, Glow, Section, T } from '@/components/ui';
import { Icon } from '@/components/Icon';
import { FRAMES } from '@/lib/frames';
import { C, statusColor } from '@/lib/theme';

const STATUS: [string, string][] = [['online', 'Online'], ['idle', 'Abwesend'], ['dnd', 'Bitte nicht stören'], ['invisible', 'Unsichtbar']];

export default function Me() {
  const router = useRouter();
  const me = useStore((s) => s.me) as any;
  const [msg, setMsg] = useState('');
  if (!me) return null;
  const patch = async (body: any) => {
    try { const d = await api<any>('PATCH', '/api/me', body); setState((s) => ({ me: { ...s.me!, ...d.user } })); } catch (e) { setMsg(errText(e)); }
  };
  const pickAvatar = async () => {
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.9 });
    if (r.canceled || !r.assets?.[0]) return;
    try { const up = await upload('avatar', r.assets[0].uri, r.assets[0].mimeType || 'image/jpeg'); await patch({ avatar: up.key }); } catch (e) { setMsg(errText(e)); }
  };
  const logout = () => signOut();
  const banner = mediaSource(me.banner);
  const raw = me.status_raw || me.status;
  return (
    <View style={{ flex: 1 }}>
      <Glow />
      <ScrollView contentContainerStyle={{ paddingBottom: 130 }}>
        <View style={s.banner}>
          {banner ? <Image source={banner} style={StyleSheet.absoluteFill} contentFit="cover" />
            : <LinearGradient colors={[me.banner_color || me.accent || C.accent, '#ff5c9a']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />}
          <LinearGradient colors={['transparent', 'rgba(7,7,13,0.9)']} style={StyleSheet.absoluteFill} />
          <SafeAreaView edges={['top']}><Pressable accessibilityLabel="Einstellungen" onPress={() => router.push('/settings')} style={s.gear}><Icon name="gear" size={20} color="#fff" /></Pressable></SafeAreaView>
        </View>
        <Animated.View entering={FadeInDown.duration(400)} style={s.head}>
          <Pressable accessibilityLabel="Profilbild ändern" onPress={pickAvatar} style={s.avWrap}>
            <Avatar user={me} size={104} status live />
            <View style={s.cam}><Icon name="image" size={15} color="#fff" /></View>
          </Pressable>
          <T style={s.name}>{me.display}</T>
          <T style={s.handle}>@{me.username}{me.pronouns ? ' · ' + me.pronouns : ''}</T>
          {me.custom_status ? <View style={s.bubble}><T style={{ color: C.text2 }}>{me.custom_status}</T></View> : null}
          {me.deco && FRAMES[me.deco] ? <T style={s.frameName}>✨ Rahmen „{FRAMES[me.deco].name}“</T> : null}
        </Animated.View>
        {me.bio ? <Glass style={s.card} intensity={20}><Section>Über mich</Section><T style={s.bio}>{me.bio}</T></Glass> : null}
        <Glass style={s.card} intensity={20}>
          <Section style={{ marginBottom: 4 }}>Status</Section>
          {STATUS.map(([k, l]) => (
            <Pressable key={k} accessibilityRole="radio" accessibilityState={{ checked: raw === k }} onPress={() => patch({ status: k })} style={({ pressed }) => [s.opt, raw === k && s.optOn, pressed && { opacity: 0.8 }]}>
              <View style={[s.dot, { backgroundColor: k === 'invisible' ? C.faint : statusColor(k) }]} />
              <T style={s.optText}>{l}</T>
              {raw === k ? <Icon name="check" size={18} color={C.accent} stroke={2.6} /> : null}
            </Pressable>
          ))}
        </Glass>
        {msg ? <T style={s.msg}>{msg}</T> : null}
        <View style={{ paddingHorizontal: 16, gap: 10, marginTop: 6 }}>
          <Btn title="3D-Avatar bearbeiten" icon="cube" onPress={() => openWeb(router, '/settings/avatar?solo=1')} />
          <Btn title="Profil & Konto bearbeiten" icon="edit" kind="secondary" onPress={() => router.push('/settings')} />
          {/* alles Weitere wie in der Web-App: Banner, Farben, Effekte, Privatsphäre, Sprache & Video, Mitteilungen, Design & Sprache, Geräte */}
          <Btn title="Alle Einstellungen" icon="gear" kind="secondary" onPress={() => openWeb(router, '/settings/profile')} />
          <Btn title="Mein Profil ansehen" icon="user" kind="secondary" onPress={() => openWeb(router, '/u/' + me.id)} />
          {me.is_admin ? <Btn title="Admin-Bereich" icon="shield" kind="secondary" onPress={() => openWeb(router, '/admin')} /> : null}
          <Btn title="Abmelden" icon="logout" kind="ghost" onPress={logout} />
        </View>
      </ScrollView>
    </View>
  );
}
const s = StyleSheet.create({
  banner: { height: 170, overflow: 'hidden' },
  gear: { alignSelf: 'flex-end', margin: 12, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center' },
  head: { alignItems: 'center', marginTop: -60, paddingHorizontal: 16 },
  avWrap: { borderRadius: 70, borderWidth: 6, borderColor: C.bg0 },
  cam: { position: 'absolute', right: 4, top: 4, width: 30, height: 30, borderRadius: 15, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: C.bg0 },
  name: { fontSize: 28, fontWeight: '800', marginTop: 10, letterSpacing: -0.4 },
  handle: { color: C.muted, fontSize: 15, marginTop: -2 },
  bubble: { marginTop: 10, backgroundColor: C.bg3, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: C.line },
  frameName: { color: C.warn, fontSize: 13, marginTop: 8 },
  card: { marginHorizontal: 16, marginTop: 16, borderRadius: 18, padding: 14 },
  bio: { color: C.text2, lineHeight: 22, marginTop: 6 },
  opt: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 10, minHeight: 48, borderRadius: 12 },
  optOn: { backgroundColor: C.accentSoft },
  dot: { width: 12, height: 12, borderRadius: 6 },
  optText: { fontSize: 16, flex: 1, fontWeight: '600' },
  msg: { color: C.warn, padding: 16 },
});
