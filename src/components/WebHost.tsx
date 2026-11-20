// Im Browser (nur Vorschau beim Entwickeln) gibt es kein eingebettetes Web-Fenster: Hinweis statt Inhalt.
// Auf dem iPhone gilt WebHost.native.tsx.
import { StyleSheet, View } from 'react-native';
import { hideWeb, useHost } from '@/lib/webhost';
import { Btn, Empty } from './ui';
import { C } from '@/lib/theme';

export function WebHost() {
  const visible = useHost((s) => s.visible);
  const path = useHost((s) => s.path);
  if (!visible) return null;
  return (
    <View style={[StyleSheet.absoluteFill, { zIndex: 50, backgroundColor: C.bg0, justifyContent: 'center', padding: 24 }]}>
      <Empty icon="cube" title="Nur in der iPhone-App" text={`Hier zeigt die App die Web-Ansicht ${path}.`} />
      <Btn title="Zurück" onPress={hideWeb} style={{ marginTop: 16 }} />
    </View>
  );
}
