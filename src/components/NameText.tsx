// Name im gewählten Namens-Stil wie in der Web-App (.ns-* in app.css): Farbverläufe Sonnenuntergang, Ozean, Neon, Gold …
// Der Verlauf liegt per MaskedView in der Schrift. Ohne Stil: normale Schrift (bzw. Rollenfarbe).
import React from 'react';
import { Platform, StyleSheet, View, type StyleProp, type TextStyle } from 'react-native';
import MaskedViewRaw from '@react-native-masked-view/masked-view';
import { LinearGradient } from 'expo-linear-gradient';
import { T } from './ui';

// die Typen des Pakets passen nicht zu React 19 – zur Laufzeit ist es ein normales Bauteil
const MaskedView = MaskedViewRaw as unknown as React.ComponentType<any>;

export const NAME_STYLES: [string, string, string[]][] = [
  ['default', 'Standard', []],
  ['sunset', 'Sonnenuntergang', ['#ff7a45', '#ff3d77']],
  ['ocean', 'Ozean', ['#2ec5ff', '#3d6bff']],
  ['neon', 'Neon', ['#39ff14', '#00e5ff']],
  ['gold', 'Gold', ['#ffd86b', '#ffae00', '#ffe9a8']],
  ['candy', 'Candy', ['#ff8ad8', '#b98bff']],
  ['toxic', 'Toxic', ['#b6ff00', '#00ff9d']],
  ['fire', 'Feuer', ['#ffdd00', '#ff6a00', '#ff0040']],
  ['ice', 'Eis', ['#e0f7ff', '#8fd3ff']],
  ['galaxy', 'Galaxie', ['#7c5cff', '#ff5c8a', '#2ec5ff']],
  ['rainbow', 'Regenbogen', ['#ff4d5e', '#ffb02e', '#ffe14d', '#3ddc97', '#2ec5ff', '#7c5cff']],
  ['mono', 'Code', []],
];

export function NameText({ name, styleId, style, color, numberOfLines = 1, onPress }: { name: string; styleId?: string | null; style?: StyleProp<TextStyle>; color?: string | null; numberOfLines?: number; onPress?: () => void }) {
  const def = NAME_STYLES.find((x) => x[0] === (styleId || 'default'));
  const colors = def?.[2] || [];
  if (def?.[0] === 'mono') return <T style={[style, { fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }), letterSpacing: -0.3 }]} numberOfLines={numberOfLines} onPress={onPress}>{name}</T>;
  if (colors.length < 2) return <T style={[style, color ? { color } : null]} numberOfLines={numberOfLines} onPress={onPress}>{name}</T>;
  // im Browser (nur Vorschau beim Entwickeln) gibt es keine Maske – dort die erste Farbe
  if (Platform.OS === 'web') return <T style={[style, { color: colors[0] }]} numberOfLines={numberOfLines} onPress={onPress}>{name}</T>;
  const flat = StyleSheet.flatten(style) || {};
  const { flex, flexShrink, flexGrow, alignSelf, margin, marginTop, marginBottom, marginLeft, marginRight, marginHorizontal, marginVertical, maxWidth, ...textStyle } = flat as any;
  return (
    <View style={{ flex, flexShrink: flexShrink ?? 1, flexGrow, alignSelf, margin, marginTop, marginBottom, marginLeft, marginRight, marginHorizontal, marginVertical, maxWidth }}>
      <MaskedView maskElement={<T style={[textStyle, { color: '#000' }]} numberOfLines={numberOfLines}>{name}</T>}>
        <LinearGradient colors={colors as any} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
          <T style={[textStyle, { opacity: 0 }]} numberOfLines={numberOfLines} onPress={onPress}>{name}</T>
        </LinearGradient>
      </MaskedView>
    </View>
  );
}
