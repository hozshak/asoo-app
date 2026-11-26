// Browser-Vorschau: kein Anruf-Bildschirm von Apple (echte Fassung: callkit.native.ts)
export const hasCallKit = false;
export const voipToken = () => '';
export const reportIncoming = (_id: string, _dm: string, _from: string, _name: string) => false;
export const endCallKit = (_dm: string, _reason = 'remote') => {};
export const callKitState = (_dm: string): { id: string; answered: boolean } | null => null;
export const setCallKitRingtone = (_name: string) => {};
export type CallKitHandlers = {
  token(token: string): void;
  incoming(dm: string, from: string, name: string): void;
  answer(dm: string): void;
  end(dm: string, answered: boolean): void;
  mute(muted: boolean): void;
};
export const startCallKit = (_h: CallKitHandlers) => () => {};
