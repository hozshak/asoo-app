// Linien-Symbole der Web-App (gleiche Pfade, Strich 2, runde Enden).
import Svg, { Path } from 'react-native-svg';
import { P, type IconName } from './icon-paths';

export type { IconName };
export function Icon({ name, size = 20, color = '#fff', stroke = 2 }: { name: IconName; size?: number; color?: string; stroke?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round">
      <Path d={P[name] || P.x} />
    </Svg>
  );
}
