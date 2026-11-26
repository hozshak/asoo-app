// Ziel einer Mitteilung öffnen (Push antippen oder Eintrag in der Glocke) – genau an die Stelle:
// Nachricht im Chat (?m=…), Beitrag, Profil, Freundschaftsanfragen, Mitspieler-Suche.

export function openTarget(router: { push: (href: any) => void }, url: string | null | undefined, actorId?: string | null) {
  const u = url || '';
  const chat = /\/channels\/([^/?]+)\/([^/?#]+)/.exec(u);
  const m = /[?&]m=([\w-]+)/.exec(u)?.[1];
  if (chat) { router.push({ pathname: '/chat/[id]', params: m ? { id: chat[2], m } : { id: chat[2] } }); return true; }
  if (/^\/channels\/@me\/?$/.test(u)) { router.push('/friends'); return true; } // Freundschaftsanfrage
  const post = /^\/post\/([\w-]+)/.exec(u);
  if (post) { router.push({ pathname: '/post/[id]', params: { id: post[1] } }); return true; }
  const prof = /^\/u\/([\w-]+)/.exec(u);
  if (prof) { router.push({ pathname: '/user/[id]', params: { id: prof[1] } }); return true; }
  if (/^\/feed/.test(u)) { router.push('/feed'); return true; }
  if (/^\/match\b/.test(u)) { router.push(/tab=/.test(u) ? '/match-likes' : '/match'); return true; }
  if (/^\/admin\b/.test(u)) { router.push('/admin'); return true; }
  if (/^\/(notifications|activity)\b/.test(u)) { router.push('/notifications'); return true; }
  if (actorId) { router.push({ pathname: '/user/[id]', params: { id: actorId } }); return true; }
  return false;
}
