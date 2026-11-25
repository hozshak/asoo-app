// Eigene Bilder für die drei Trinkgelder (statt Standard-Emojis) – im Stil des ToLobby-Logos:
// dunkle Kachel, Lila-/Pink-Verläufe. Klein = Tasse, Groß = Geschenk, Riesig = Rakete.
import Svg, { Circle, Defs, G, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';

function Base({ id, children, size }: { id: string; children: React.ReactNode; size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Defs>
        <LinearGradient id={id + 'bg'} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#171f40" />
          <Stop offset="1" stopColor="#2c1149" />
        </LinearGradient>
        <RadialGradient id={id + 'gl'} cx="0.5" cy="0.55" r="0.5">
          <Stop offset="0" stopColor="#8a63ff" stopOpacity={0.5} />
          <Stop offset="1" stopColor="#8a63ff" stopOpacity={0} />
        </RadialGradient>
        <LinearGradient id={id + 'li'} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#f1ebff" />
          <Stop offset="1" stopColor="#b9a5ff" />
        </LinearGradient>
        <LinearGradient id={id + 'pu'} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#9b7dff" />
          <Stop offset="1" stopColor="#6544e0" />
        </LinearGradient>
        <LinearGradient id={id + 'pk'} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#ff7fb3" />
          <Stop offset="1" stopColor="#e23c7c" />
        </LinearGradient>
        <LinearGradient id={id + 'fl'} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#ffd36b" />
          <Stop offset="1" stopColor="#ff5c9a" />
        </LinearGradient>
      </Defs>
      <Rect width="100" height="100" rx="24" fill={`url(#${id}bg)`} />
      <Circle cx="50" cy="55" r="42" fill={`url(#${id}gl)`} />
      {children}
    </Svg>
  );
}

/** kleiner Funkelstern */
const Spark = ({ x, y, r, o = 0.9 }: { x: number; y: number; r: number; o?: number }) => (
  <Path d={`M${x} ${y - r}Q${x} ${y} ${x + r} ${y}Q${x} ${y} ${x} ${y + r}Q${x} ${y} ${x - r} ${y}Q${x} ${y} ${x} ${y - r}Z`} fill="#fff" fillOpacity={o} />
);

function Mug({ size }: { size: number }) {
  const u = (k: string) => `url(#tm${k})`;
  return (
    <Base id="tm" size={size}>
      {/* Dampf */}
      <Path d="M40 34c-4-5 4-8 0-13" stroke="#fff" strokeOpacity={0.55} strokeWidth={3.2} strokeLinecap="round" fill="none" />
      <Path d="M52 34c-4-5 4-8 0-13" stroke="#fff" strokeOpacity={0.4} strokeWidth={3.2} strokeLinecap="round" fill="none" />
      {/* Henkel + Tasse */}
      <Path d="M66 48h4a9 9 0 0 1 0 18h-4" stroke={u('li')} strokeWidth={5.5} fill="none" />
      <Path d="M26 41h42v26a12 12 0 0 1-12 12H38a12 12 0 0 1-12-12Z" fill={u('pu')} />
      <Path d="M26 41h42v5H26Z" fill="#fff" fillOpacity={0.22} />
      {/* Herz */}
      <Path d="M47 70c-7.5-4.8-10-9.2-7.3-12.3 2.1-2.4 5.3-1.6 7.3 0.9 2-2.5 5.2-3.3 7.3-0.9 2.7 3.1 0.2 7.5-7.3 12.3Z" fill={u('pk')} />
      <Spark x={78} y={28} r={4.5} />
      <Spark x={20} y={30} r={3} o={0.6} />
    </Base>
  );
}

function Gift({ size }: { size: number }) {
  const u = (k: string) => `url(#tg${k})`;
  return (
    <Base id="tg" size={size}>
      {/* Schleife */}
      <Path d="M50 40C44 27 30 25 31 34c0.6 5 10 6 19 6Z" fill={u('pk')} />
      <Path d="M50 40C56 27 70 25 69 34c-0.6 5-10 6-19 6Z" fill={u('pk')} />
      {/* Paket */}
      <Rect x="25" y="50" width="50" height="31" rx="5" fill={u('pu')} />
      <Rect x="21" y="39" width="58" height="14" rx="4" fill={u('li')} />
      <Rect x="45" y="39" width="10" height="42" fill={u('pk')} />
      <Rect x="25" y="53" width="50" height="3" fill="#000" fillOpacity={0.15} />
      <Spark x={80} y={26} r={5} />
      <Spark x={18} y={64} r={3.2} o={0.6} />
      <Spark x={84} y={70} r={2.6} o={0.5} />
    </Base>
  );
}

function Rocket({ size }: { size: number }) {
  const u = (k: string) => `url(#tr${k})`;
  return (
    <Base id="tr" size={size}>
      <G transform="rotate(35 50 52)">
        {/* Flamme */}
        <Path d="M42 66Q50 96 58 66Z" fill={u('fl')} />
        {/* Flossen */}
        <Path d="M38 50L25 68L39 64Z" fill={u('pk')} />
        <Path d="M62 50L75 68L61 64Z" fill={u('pk')} />
        {/* Rumpf */}
        <Path d="M50 14C63 26 65 45 62 66H38C35 45 37 26 50 14Z" fill={u('li')} />
        <Path d="M50 14C56 20 59 27 60.5 34H39.5C41 27 44 20 50 14Z" fill={u('pk')} />
        <Circle cx="50" cy="46" r="7.5" fill={u('pu')} stroke="#fff" strokeWidth={2.4} />
        <Path d="M40 66h20" stroke="#6544e0" strokeWidth={3} strokeLinecap="round" />
      </G>
      <Spark x={22} y={26} r={4.5} />
      <Spark x={80} y={22} r={3} o={0.6} />
      <Spark x={18} y={74} r={2.6} o={0.5} />
    </Base>
  );
}

/** Bild zum Trinkgeld-Artikel (Produkt-ID aus App Store Connect) */
export function TipArt({ id, size = 46 }: { id: string; size?: number }) {
  if (id === 'tolobby_tip_medium') return <Gift size={size} />;
  if (id === 'tolobby_tip_large') return <Rocket size={size} />;
  return <Mug size={size} />;
}
