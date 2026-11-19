# Asoo – iPhone-App (native, Expo)

Native App zu Asoo (Server: `C:\install\zuno-app`, live https://zuno-app.altraex.workers.dev). Gleiche Konten, Server und Chats wie Web- und Windows-App.

- **Apple:** Konto „Feierabend Code“ (Team 844JD2257D), App „Asoo“ (App-ID 6836821648), Kennung `de.feierabendcode.asoo` mit Push. API-Schlüssel „asoo-bau“: `C:/Users/hozan.shaker/.geheim/feierabend-apple.env` (+ `.p8` daneben, nie anzeigen).
- **Anmeldung:** `POST /api/auth/login` mit Kopfzeile `X-Client: asoo-app` liefert `{ token }`; danach `Authorization: Bearer <token>` für API, `/media/` und die Live-Verbindung (`/api/ws`). Server-Seite: `sessionReply`/`cookieToken` in `zuno-app/src/worker.js`, Test `zuno-app/tools/nettest/t-app-token.mjs`.

## Aufbau
- `src/lib/api.ts` – Server, Schlüssel (SecureStore), Bilder hochladen, Fehlertexte
- `src/lib/store.ts` – Zustand (Konto, Server mit Kanälen/Kategorien/Rollen, Direktnachrichten, Freunde, Ungelesenes, Nachrichten)
- `src/lib/live.ts` – Live-Verbindung mit Neuverbinden; seltene Änderungen (Kanäle, Rollen, Freunde) laden den Stand neu
- `src/lib/text.tsx` – Nachrichtentext: Links, @Erwähnungen, @Rollen (`<@&id>`), @everyone/@here, **fett**
- `src/app/` – Bildschirme (expo-router): Anmelden, Chats (Server-Leiste + Direktnachrichten/Kanäle mit Kategorien), Chat, Freunde, Mitteilungen, Ich, Profil (Melden/Blockieren), Einstellungen (Profil, Passwort, Rechtliches, Konto löschen)

## Im Browser testen
`C:\install\.claude\launch.json`: erst `zuno-lokal` (Server, 8787), dann `asoo-expo` (Expo web, 8083) und `asoo-app` (Proxy, 8091). Die App unter http://localhost:8091 öffnen. Der Proxy setzt das Cookie `dev_media_token` (setzt die App beim Anmelden im Entwicklungsmodus) in die Kopfzeile um – für Bilder und die Live-Verbindung, die im Browser keine Kopfzeilen schicken können.

## Stand (19.11.2026) – Stufe 1, erster Wurf
Geht (im Browser geprüft): Anmelden, Direktnachrichten-Liste, Server mit Kanälen, Chat lesen/schreiben, Erwähnung hervorgehoben, Nachricht eines anderen kommt live an, Freunde mit Anfragen, Ich-Seite.

Fehlt noch: Push-Mitteilungen (Server muss an Expo/APNs senden), Vorschläge beim Tippen von @, Mitgliederliste und Rollenfarben anderer, Gruppen-DMs anlegen, Sprach-/3D-Räume (Stufe 2/3), App-Symbol in 1024 px, Bauen (Expo-Projekt `eas init`, GitHub-Repo mit Secrets wie bei THFM).
