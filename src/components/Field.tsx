// Eingabefeld im Stil der App (mit Fokus-Leuchten). Steht bewusst außerhalb anderer Bausteine: Ein Bauteil, das in
// einer Bildschirm-Funktion definiert wird, wird bei jedem Tippen neu angelegt und verliert den Fokus.
import { useState } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';
import { T } from './ui';
import { C, F, R } from '@/lib/theme';

export function Field({ label, style, ...p }: TextInputProps & { label?: string }) {
  const [focus, setFocus] = useState(false);
  return (
    <View style={{ gap: 6 }}>
      {label ? <T style={s.label}>{label}</T> : null}
      <TextInput placeholderTextColor={C.faint} {...p} onFocus={(e) => { setFocus(true); p.onFocus?.(e); }} onBlur={(e) => { setFocus(false); p.onBlur?.(e); }}
        style={[s.input, p.multiline && { height: undefined, minHeight: 84, paddingTop: 12, textAlignVertical: 'top' }, focus && s.focus, style]} />
    </View>
  );
}

const s = StyleSheet.create({
  label: { color: C.faint, fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1.1 },
  input: { backgroundColor: 'rgba(255,255,255,0.06)', color: C.text, borderRadius: R.md, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', paddingHorizontal: 14, height: 46, fontSize: 16, fontFamily: F.medium },
  focus: { borderColor: C.accent },
});
