// Das Asoo-Logo „Sprech-Würfel“ (gleich wie public/img/logo.svg der Web-App, Quelle: zuno-app/tools/make-brand.mjs).
import Svg, { Circle, Defs, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';

export function Logo({ size = 64 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Defs>
        <LinearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#171f40" />
          <Stop offset="1" stopColor="#2c1149" />
        </LinearGradient>
        <RadialGradient id="glow" cx="0.5" cy="0.5" r="0.5">
          <Stop offset="0" stopColor="#8a63ff" stopOpacity={0.55} />
          <Stop offset="1" stopColor="#8a63ff" stopOpacity={0} />
        </RadialGradient>
        <LinearGradient id="ct" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#f1ebff" />
          <Stop offset="1" stopColor="#b9a5ff" />
        </LinearGradient>
        <LinearGradient id="cl" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#9b7dff" />
          <Stop offset="1" stopColor="#6544e0" />
        </LinearGradient>
        <LinearGradient id="cr" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#ff7fb3" />
          <Stop offset="1" stopColor="#e23c7c" />
        </LinearGradient>
      </Defs>
      <Rect width="100" height="100" rx="23" fill="url(#bg)" />
      <Circle cx="50" cy="50" r="40" fill="url(#glow)" />
      <Path d="M50 18L76 32L50 46L24 32Z" fill="url(#ct)" />
      <Path d="M24 32L50 46V78L24 64Z" fill="url(#cl)" />
      <Path d="M76 32L50 46V78L61.5 71.6L70 80.5V66.9L76 63.6Z" fill="url(#cr)" />
      <Path d="M25.2 32.1L50 19.2L74.8 32.1" fill="none" stroke="#fff" strokeOpacity={0.6} strokeWidth={0.7} strokeLinejoin="round" />
      <Path d="M50 46V78" stroke="#fff" strokeOpacity={0.22} strokeWidth={0.9} />
      <Circle cx="56.2" cy="59.6" r="2.35" fill="#fff" />
      <Circle cx="62.6" cy="56.2" r="2.35" fill="#fff" />
      <Circle cx="69" cy="52.7" r="2.35" fill="#fff" />
    </Svg>
  );
}
