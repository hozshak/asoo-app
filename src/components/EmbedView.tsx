// Im Browser (nur Vorschau beim Entwickeln) gibt es kein eingebettetes Web-Fenster: Hinweis statt Raum.
// Auf dem iPhone gilt EmbedView.native.tsx.
import { View } from 'react-native';
import { Btn, Empty } from '@/components/ui';

export function EmbedView({ path, onClose }: { path: string; onClose: () => void; onAuthLost: () => void }) {
  return (
    <View style={{ flex: 1, justifyContent: 'center', padding: 24 }}>
      <Empty icon="cube" title="Nur in der iPhone-App" text={`Hier öffnet die App die Web-Ansicht ${path}.`} />
      <Btn title="Zurück" onPress={onClose} style={{ marginTop: 16 }} />
    </View>
  );
}
