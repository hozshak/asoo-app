// Bildschirm teilen gibt es nur in der iPhone-App (screenshare.native.ts, ReplayKit). Im Browser (Entwicklungs-Vorschau)
// stehen hier leere Gegenstücke, damit react-native-webrtc nicht mitgeladen wird.
export type ScreenQuality = '720' | '1080' | 'max';
export const onScreenShare = (_fn: (on: boolean) => void) => () => {};
export const isSharing = () => false;
export async function startScreenShare(_room: string, _pickerRef: any, _quality: ScreenQuality = '1080'): Promise<void> { throw new Error('nur iPhone'); }
export async function stopScreenShare(): Promise<void> {}
