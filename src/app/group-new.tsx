// Gruppe erstellen – nativ: Freunde auswählen (2–9), dann öffnet sich der Gruppenchat.
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { api, errText } from '@/lib/api';
import { bootstrap, useStore } from '@/lib/store';
import { Avatar, Btn, Card, Empty, Glow, SheetHead, T } from '@/components/ui';
import { Field } from '@/components/Field';
import { Icon } from '@/components/Icon';
import { C } from '@/lib/theme';
import { t } from '@/lib/i18n';

export default function GroupNew() {
  const router = useRouter();
  const friends = useStore((s) => s.friends.friends);
  const [sel, setSel] = useState<string[]>([]);
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const toggle = (id: string) => setSel((x) => (x.includes(id) ? x.filter((y) => y !== id) : x.length >= 9 ? x : [...x, id]));
  const create = async () => {
    setBusy(true); setErr('');
    try { const d = await api<any>('POST', '/api/dms/group', { user_ids: sel }); await bootstrap(); router.replace({ pathname: '/chat/[id]', params: { id: d.dm.id } }); }
    catch (e) { setErr(errText(e)); } finally { setBusy(false); }
  };
  const shown = friends.filter((f) => !q.trim() || (f.display + ' ' + f.username).toLowerCase().includes(q.trim().toLowerCase()));
  return (
    <View style={{ flex: 1 }}>
      <Glow />
      <SheetHead title={t("Gruppe erstellen")} onClose={() => router.back()} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 4, gap: 12, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <T style={{ color: C.muted }}>{t("Wähle bis zu 9 Freunde aus (")}{sel.length} {' '}{t("gewählt).")}</T>
        {friends.length > 6 ? <Field value={q} onChangeText={setQ} placeholder={t("Freunde durchsuchen")} /> : null}
        {!friends.length ? <Empty icon="users" title={t("Noch keine Freunde")} text={t("Füge unter „Freunde“ Leute hinzu, dann kannst du Gruppen erstellen.")} /> : (
          <Card>{shown.map((f, i) => {
            const on = sel.includes(f.id);
            return (
              <Pressable key={f.id} accessibilityRole="checkbox" accessibilityState={{ checked: on }} onPress={() => toggle(f.id)} style={[s.row, i < shown.length - 1 && s.line, on && { backgroundColor: C.accentSoft }]}>
                <Avatar user={f} size={36} frame={false} />
                <T style={{ flex: 1, fontWeight: '700' }} numberOfLines={1}>{f.display}</T>
                <View style={[s.box, on && s.boxOn]}>{on ? <Icon name="check" size={14} color="#fff" stroke={3} /> : null}</View>
              </Pressable>
            );
          })}</Card>
        )}
        {err ? <T style={{ color: C.danger }}>{err}</T> : null}
        <Btn title={t("Gruppe erstellen")} icon="users" busy={busy} disabled={sel.length < 2} onPress={create} />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, paddingVertical: 10 },
  line: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.line },
  box: { width: 22, height: 22, borderRadius: 7, borderWidth: 1.5, borderColor: C.faint, alignItems: 'center', justifyContent: 'center' },
  boxOn: { backgroundColor: C.accent, borderColor: C.accent },
});
