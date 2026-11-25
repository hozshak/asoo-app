// Blauer Haken für verifizierte Konten (Abzeichen „verified“, vergibt das ToLobby-Team) – wie in der Web-App (verifiedMark in ui.js).
import Svg, { Path } from 'react-native-svg';
import { t } from '@/lib/i18n';

export const isVerified = (u?: { badges?: string[] } | null) => !!u?.badges?.includes('verified');

export function VerifiedMark({ size = 15 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessibilityLabel={t("Verifiziert")}>
      <Path fill="#1d9bf0" d="M22.25 12c0-1.43-.88-2.67-2.19-3.34.46-1.39.2-2.9-.81-3.91s-2.52-1.27-3.91-.81c-.66-1.31-1.91-2.19-3.34-2.19s-2.67.88-3.33 2.19c-1.4-.46-2.91-.2-3.92.81s-1.26 2.52-.8 3.91C2.63 9.33 1.75 10.57 1.75 12s.88 2.67 2.19 3.34c-.46 1.39-.2 2.9.81 3.91s2.52 1.26 3.91.81c.67 1.31 1.91 2.19 3.34 2.19s2.68-.88 3.34-2.19c1.39.45 2.9.2 3.91-.81s1.27-2.52.81-3.91c1.31-.67 2.19-1.91 2.19-3.34z" />
      <Path fill="#fff" d="M10.54 16.74l-3.8-3.8 1.42-1.42 2.38 2.38 5.3-5.3 1.42 1.42z" />
    </Svg>
  );
}
