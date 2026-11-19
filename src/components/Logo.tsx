// Das Asoo-Logo (gleich wie public/img/logo.svg der Web-App).
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

export function Logo({ size = 64 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Defs>
        <LinearGradient id="lg" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#7c5cff" />
          <Stop offset="1" stopColor="#ff5c8a" />
        </LinearGradient>
      </Defs>
      <Rect width="100" height="100" rx="28" fill="url(#lg)" />
      <Path fillRule="evenodd" d="M44 27h12l20 46H64l-3.9-9H39.9L36 73H24zM50 40.8L44.26 54h11.48z" fill="#fff" />
      <Circle cx="80" cy="22" r="5" fill="#fff" opacity={0.85} />
    </Svg>
  );
}
