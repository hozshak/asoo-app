// Einmalig: Signier-Zertifikat und Bereitstellungsprofil für Asoo anlegen und im Expo-Konto (en0o0n) ablegen.
// Nimmt den App-Store-Connect-Schlüssel „asoo-bau“ aus ~/.geheim/feierabend-apple.env (zeigt ihn nie an).
// Aufruf im Terminal: node scripts/ios-credentials.mjs   (Fragen mit Enter / „Y“ beantworten)
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.join(homedir(), '.geheim');
const vals = {};
for (const line of readFileSync(path.join(dir, 'feierabend-apple.env'), 'utf8').split(/\r?\n/)) {
  if (line && !line.startsWith('#') && line.includes('=')) vals[line.slice(0, line.indexOf('='))] = line.slice(line.indexOf('=') + 1).trim();
}
const keyFile = path.isAbsolute(vals.ASC_KEY_FILE || '') ? vals.ASC_KEY_FILE : path.join(dir, vals.ASC_KEY_FILE || `AuthKey_${vals.ASC_KEY_ID}.p8`);
const env = {
  ...process.env,
  EXPO_ASC_API_KEY_PATH: keyFile,
  EXPO_ASC_KEY_ID: vals.ASC_KEY_ID,
  EXPO_ASC_ISSUER_ID: vals.ASC_ISSUER_ID,
  EXPO_APPLE_TEAM_ID: vals.APPLE_TEAM_ID,
  EXPO_APPLE_TEAM_TYPE: 'INDIVIDUAL',
};
process.chdir(path.dirname(path.dirname(fileURLToPath(import.meta.url))));
const args = process.argv.slice(2).length ? process.argv.slice(2).join(' ') : 'credentials:configure-build --platform ios --profile production';
const res = spawnSync(`npx --yes eas-cli@latest ${args}`, { stdio: 'inherit', shell: true, env });
process.exit(res.status ?? 1);
