// Abmelden: Gerät für Push abmelden, Sitzung beim Server beenden, Schlüssel und Daten auf dem Gerät löschen.
import { api, saveToken } from '@/lib/api';
import { clearState } from '@/lib/store';
import { disconnect } from '@/lib/live';
import { unregisterPush } from '@/lib/push';
import { leaveCall, resetWeb } from '@/lib/webhost';
import { voice } from '@/lib/voice';
import { unregisterVoip } from '@/lib/calls';

export async function signOut(tellServer = true) {
  await unregisterPush().catch(() => {});
  await unregisterVoip().catch(() => {});
  if (tellServer) { try { await api('POST', '/api/auth/logout', {}); } catch {} }
  leaveCall();
  voice.leave(true);
  resetWeb();
  disconnect();
  await saveToken(null);
  clearState();
}
