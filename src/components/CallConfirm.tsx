// „Anruf starten?“ – wie bei Discord kurz nachfragen, damit niemand aus Versehen anruft (der Knopf sitzt oben im Chat).
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Avatar, Glass, T } from './ui';
import { Icon } from './Icon';
import type { User } from '@/lib/store';
import { C } from '@/lib/theme';
import { t } from '@/lib/i18n';

export type CallKind = 'voice' | 'video';

export function CallConfirm({ kind, who, name, onStart, onClose }: { kind: CallKind | null; who?: User | null; name: string; onStart: (k: CallKind) => void; onClose: () => void }) {
  return (
    <Modal visible={!!kind} transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.back}>
        {/* Tippen daneben = abbrechen (eigene Fläche, nicht um die Knöpfe herum – Knopf in Knopf geht im Browser nicht) */}
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel={t("Abbrechen")} />
        <View style={{ width: '100%', maxWidth: 380 }}>
          <Glass style={s.card} intensity={50} tint="rgba(24,25,38,0.96)">
            {who ? <Avatar user={who} size={64} frame={false} /> : <View style={s.icon}><Icon name={kind === 'video' ? 'video' : 'phone'} size={28} color={C.accent} /></View>}
            <T style={s.title}>{kind === 'video' ? t("Videoanruf starten?") : t("Anruf starten?")}</T>
            <T style={s.text}>{name} {' '}{t("bekommt sofort einen Anruf")}{kind === 'video' ? t(" – deine Kamera geht dabei an") : ''}.</T>
            <Pressable accessibilityRole="button" onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {}); const k = kind!; onClose(); onStart(k); }} style={({ pressed }) => [s.btn, s.go, pressed && { opacity: 0.85 }]}>
              <Icon name={kind === 'video' ? 'video' : 'phone'} size={18} color="#062b1b" stroke={2.4} />
              <T style={[s.btnText, { color: '#062b1b' }]}>{kind === 'video' ? t("Videoanruf starten") : t("Anruf starten")}</T>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={onClose} style={({ pressed }) => [s.btn, s.cancel, pressed && { backgroundColor: C.bg4 }]}>
              <T style={s.btnText}>{t("Abbrechen")}</T>
            </Pressable>
          </Glass>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  back: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: { borderRadius: 26, padding: 22, alignItems: 'center' },
  icon: { width: 64, height: 64, borderRadius: 32, backgroundColor: C.accentSoft, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 21, fontWeight: '800', marginTop: 12, textAlign: 'center' },
  text: { color: C.text2, textAlign: 'center', marginTop: 4, marginBottom: 18, lineHeight: 21 },
  btn: { alignSelf: 'stretch', height: 50, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  go: { backgroundColor: C.ok },
  cancel: { backgroundColor: C.bg3, marginTop: 10, borderWidth: 1, borderColor: C.line },
  btnText: { fontSize: 16, fontWeight: '800' },
});
