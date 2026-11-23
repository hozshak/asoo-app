// Unsichtbarer iOS-Knopf „Übertragung starten“ – darüber zeigt iOS das Auswahlfenster fürs Bildschirm-Teilen.
import type React from 'react';
import { Platform } from 'react-native';
import { ScreenCapturePickerView } from 'react-native-webrtc';

const PICK = ScreenCapturePickerView as unknown as React.ComponentType<any>;
export function ScreenPicker({ pickRef }: { pickRef: React.RefObject<any> }) {
  if (Platform.OS !== 'ios') return null;
  return <PICK ref={pickRef} style={{ position: 'absolute', width: 1, height: 1, opacity: 0, left: 0, top: 0 }} />;
}
