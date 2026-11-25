// Im Browser (nur Vorschau beim Entwickeln) gibt es kein eingebettetes Web-Fenster: Hinweis statt Inhalt.
// Auf dem iPhone gilt WebHost.native.tsx.
import { StyleSheet, View } from 'react-native';
import { hideWeb, useHost } from '@/lib/webhost';
import { Btn, Empty } from './ui';
import { C } from '@/lib/theme';
import { t } from '@/lib/i18n';

export function WebHost() {
  const visible = useHost((s) => s.visible);
  const path = useHost((s) => s.path);
  if (!visible) return null;
  return (
    <View style={[StyleSheet.absoluteFill, { zIndex: 50, backgroundColor: C.bg0, justifyContent: 'center', padding: 24 }]}>
      <Empty icon="cube" title={t("Nur in der iPhone-App")} text={t("Hier zeigt die App die Web-Ansicht {0}.", { 0: path })} />
      <Btn title={t("Zurück")} onPress={hideWeb} style={{ marginTop: 16 }} />
    </View>
  );
}
