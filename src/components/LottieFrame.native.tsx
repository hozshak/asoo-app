// Animierter Profilrahmen auf dem Gerät (Lottie).
import LottieView from 'lottie-react-native';
export const HAS_LOTTIE = true;
export function LottieFrame({ source, width, height }: { source: any; width: number; height: number }) {
  return <LottieView source={source} autoPlay loop style={{ width, height }} />;
}
