// Ich: kompaktes Profil (Banner, Rahmen, Name, Status-Text), Status als kleine Knöpfe, darunter alles als Liste –
// 3D-Avatar, Profil bearbeiten, alle Einstellungen, eigenes Profil, Admin, Abmelden.
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
import { Avatar, Card, Glow, MenuRow, T } from '@/components/ui';
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
  const banner = mediaSource(me.banner);
  const raw = me.status_raw || me.status;
  const frame = me.deco && FRAMES[me.deco] ? FRAMES[me.deco].name : '';
  return (
    <View style={{ flex: 1 }}>
      <Glow />
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
        <View style={s.banner}>
          {banner ? <Image source={banner} style={StyleSheet.absoluteFill} contentFit="cover" />
            : <LinearGradient colors={[me.banner_color || me.accent || C.accent, '#ff5c9a']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />}
          <LinearGradient colors={['transparent', 'rgba(7,7,13,0.85)']} style={StyleSheet.absoluteFill} />
          <SafeAreaView edges={['top']}><Pressable accessibilityLabel="Einstellungen" onPress={() => router.push('/settings')} style={s.gear}><Icon name="gear" size={19} color="#fff" /></Pressable></SafeAreaView>
        </View>
        <Animated.View entering={FadeInDown.duration(350)} style={s.head}>
          <Pressable accessibilityLabel="Profilbild ändern" onPress={pickAvatar} style={s.avWrap}>
            <Avatar user={me} size={92} status live />
            <View style={s.cam}><Icon name="image" size={13} color="#fff" /></View>
          </Pressable>
          <T style={s.name} numberOfLines={1}>{me.display}</T>
          <T style={s.handle} numberOfLines={1}>@{me.username}{me.pronouns ? ' · ' + me.pronouns : ''}</T>
          {me.custom_status ? <T style={s.custom} numberOfLines={2}>{me.custom_status}</T> : null}
          {me.bio ? <T style={s.bio} numberOfLines={3}>{me.bio}</T> : null}
        </Animated.View>

        <View style={s.statusRow}>
          {STATUS.map(([k, l]) => (
            <Pressable key={k} accessibilityRole="radio" accessibilityState={{ checked: raw === k }} onPress={() => patch({ status: k })} style={[s.st, raw === k && s.stOn]}>
              <View style={[s.dot, { backgroundColor: k === 'invisible' ? C.faint : statusColor(k) }]} />
              <T style={[s.stText, raw === k && { color: C.text }]} numberOfLines={1}>{l}</T>
            </Pressable>
          ))}
        </View>
        {msg ? <T style={s.msg}>{msg}</T> : null}

        <View style={{ paddingHorizontal: 16, gap: 12, marginTop: 14 }}>
          <Card>
            <MenuRow icon="cube" label="3D-Avatar" sub="Figur, Kleidung und Tänze" color="#b260ff" onPress={() => openWeb(router, '/settings/avatar?solo=1')} />
            <MenuRow icon="edit" label="Profil bearbeiten" sub={frame ? `Rahmen „${frame}“, Name, Über mich` : 'Rahmen, Name, Über mich'} color={C.accent} onPress={() => router.push('/settings')} />
            <MenuRow icon="user" label="Mein Profil ansehen" color={C.info} onPress={() => router.push({ pathname: '/user/[id]', params: { id: me.id } })} last />
          </Card>
          <Card>
            <MenuRow icon="gear" label="Alle Einstellungen" sub="Banner, Farben, Privatsphäre, Sprache, Mitteilungen" color={C.text2} onPress={() => openWeb(router, '/settings/profile')} />
            <MenuRow icon="sparkle" label="Feed" color={C.warn} onPress={() => openWeb(router, '/feed')} />
            <MenuRow icon="compass" label="Server entdecken" color={C.ok} onPress={() => router.push({ pathname: '/server-new', params: { tab: 'discover' } })} last={!me.is_admin} />
            {me.is_admin ? <MenuRow icon="shield" label="Admin-Bereich" color={C.danger} onPress={() => openWeb(router, '/admin')} last /> : null}
          </Card>
          <Card>
            <MenuRow icon="logout" label="Abmelden" danger onPress={() => signOut()} right={null} last />
          </Card>
        </View>
      </ScrollView>
    </View>
  );
}
const s = StyleSheet.create({
  banner: { height: 130, overflow: 'hidden' },
  gear: { alignSelf: 'flex-end', margin: 10, width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center' },
  head: { alignItems: 'center', marginTop: -52, paddingHorizontal: 20 },
  avWrap: { borderRadius: 60, borderWidth: 5, borderColor: C.bg0 },
  cam: { position: 'absolute', right: 2, top: 2, width: 26, height: 26, borderRadius: 13, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: C.bg0 },
  name: { fontSize: 24, fontWeight: '800', marginTop: 8, letterSpacing: -0.3, maxWidth: '100%' },
  handle: { color: C.muted, fontSize: 14, marginTop: -2 },
  custom: { color: C.text2, fontSize: 14, marginTop: 6, textAlign: 'center' },
  bio: { color: C.muted, fontSize: 13.5, marginTop: 4, textAlign: 'center', lineHeight: 19 },
  statusRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: 16, marginTop: 14 },
  st: { width: '48.5%', flexGrow: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 36, borderRadius: 12, backgroundColor: C.bg2, borderWidth: 1, borderColor: C.line, paddingHorizontal: 6 },
  stOn: { backgroundColor: C.accentSoft, borderColor: C.accentLine },
  stText: { color: C.muted, fontSize: 13, fontWeight: '700', flexShrink: 1 },
  dot: { width: 9, height: 9, borderRadius: 5 },
  msg: { color: C.warn, paddingHorizontal: 16, paddingTop: 8 },
});
