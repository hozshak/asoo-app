// Zusatzprogramm „Bildschirm teilen“ (ReplayKit, Broadcast Upload Extension). iOS nimmt damit den GANZEN Bildschirm auf,
// auch wenn man die App verlässt. Die Bilder gehen über eine Unix-Socket-Datei im gemeinsamen App-Group-Ordner an die App
// (react-native-webrtc, ScreenCapturer), die sie per WebRTC an alle im Anruf schickt (src/lib/screenshare.ts).
/** @type {import('@bacons/apple-targets/app.plugin').Config} */
module.exports = {
  type: 'broadcast-upload',
  name: 'AsooBroadcast',
  displayName: 'Asoo',
  bundleIdentifier: '.broadcast',
  deploymentTarget: '15.1',
  frameworks: ['ReplayKit'],
  entitlements: {
    'com.apple.security.application-groups': ['group.de.feierabendcode.asoo'],
  },
};
