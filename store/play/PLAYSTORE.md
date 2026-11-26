# ToLobby im Google Play Store – Schritt für Schritt

Paketname: **de.feierabendcode.asoo** (steht fest, lässt sich nach dem ersten Upload nie mehr ändern)
App-Datei: GitHub → hozshak/asoo-app → Actions → „Android-Build“ → letzter Lauf → unten bei *Artifacts*
`tolobby-android-production` (darin `tolobby.aab`). Für ein Test-Handy: Lauf mit Profil `apk`.

## 1. Entwicklerkonto (du)
1. https://play.google.com/console → mit deinem Google-Konto anmelden → Konto-Typ **Privatperson** (oder Organisation,
   falls Feierabend Code ein Gewerbe hat – dann entfällt die 12-Tester-Pflicht, braucht aber eine D-U-N-S-Nummer).
2. Einmalig **25 $** bezahlen, Identität bestätigen (Ausweis), Telefonnummer bestätigen.
3. Bei Privatkonten verlangt Google: **geschlossener Test mit mindestens 12 Testern über 14 Tage**, erst dann darf die App
   in die Produktion. Tester = Google-Konten (E-Mail-Liste), die der Einladung zustimmen und die App installieren.

## 2. App anlegen
- „App erstellen“ → Name **ToLobby**, Standardsprache Deutsch, **App** (kein Spiel), **kostenlos**.
- Erklärungen bestätigen (Richtlinien, US-Exportgesetze).

## 3. App-Inhalte (Menü „Richtlinien → App-Inhalte“)
| Punkt | Antwort |
|---|---|
| Datenschutzerklärung | https://tolobby.com/legal/datenschutz.html |
| App-Zugriff | „Alle oder einige Funktionen sind eingeschränkt“ → Anmeldung nötig → Testkonto wie bei Apple (`app_review_asoo`, Zugang in `~/.geheim/asoo-pruefer.env`) |
| Werbung | Nein |
| Einstufung (Fragebogen) | Kategorie „Soziale Netzwerke / Kommunikation“; Nutzer können miteinander chatten und Bilder teilen: **Ja**; keine Gewalt/Glücksspiel |
| Zielgruppe | **ab 16** (16–17 und 18+), nicht für Kinder |
| Nachrichten-App / Kommunikation | Ja |
| Datensicherheit | siehe unten |
| Behörden-App, Finanzen, Gesundheit | Nein |

### Datensicherheit (Data safety)
- Daten werden **verschlüsselt übertragen** (HTTPS/WSS): Ja. Nutzer können **Löschung beantragen**: Ja (in der App: Einstellungen → Konto löschen).
- Erhoben (alle: App-Funktion, nicht verkauft, nicht geteilt):
  - Persönliche Infos: Name (Anzeigename), E-Mail-Adresse, Nutzer-ID
  - Nachrichten: Chats/Inhalte in der App
  - Fotos und Videos: Profilbild, Bilder im Chat
  - Audio: Sprachnachrichten (Anrufe laufen direkt zwischen den Geräten, werden nicht gespeichert)
  - App-Aktivität: In-App-Interaktionen (Reaktionen, Server)
  - Geräte-IDs: Push-Schlüssel für Mitteilungen
- Keine Standortdaten, keine Kontakte, keine Werbe-ID.

## 4. Store-Eintrag (Hauptdatensatz)
- **App-Name (max. 30):** ToLobby: Chat, Calls & 3D
- **Kurzbeschreibung (max. 80), de:** Chatten, reden und mit deinem Anime-Avatar in 3D-Räumen abhängen.
- **Kurzbeschreibung, en:** Chat, talk and hang out with your anime avatar in 3D rooms.
- **Ausführliche Beschreibung, de:**

  ToLobby ist dein Ort zum Chatten, Reden und Abhängen – mit Freunden und mit deiner Community.

  • Server und Kanäle: Erstelle eigene Server mit Kategorien, Rollen und privaten Kanälen oder tritt per Einladung bei.
  • Direktnachrichten: Schreib Freunden, schick Bilder und GIFs und reagiere mit Emojis.
  • Sprachräume und Anrufe: Rede live mit deinen Leuten, auf Wunsch mit Kamera.
  • 3D-Räume: Betritt mit deinem Anime-Avatar eine Skylounge, einen Strand oder ein Kino. Tanzt zusammen, setzt euch hin und schaut gemeinsam Videos.
  • Mitspieler-Match: Finde Leute, die dasselbe spielen wie du – gegenseitiges Like, und ihr könnt loszocken.
  • Profil mit Stil: Profilrahmen, Effekte, Banner und eigener Status.
  • Mitteilungen, wenn dir jemand schreibt oder dich erwähnt – pro Server einstellbar.

  Sicher unterwegs: Melden und Blockieren direkt in der App, Moderation durch die Mods jedes Servers und Konto-Löschung jederzeit in den Einstellungen.

  ToLobby ist kostenlos und ohne Werbung. Nutzung ab 16 Jahren.
- **Ausführliche Beschreibung, en:**

  ToLobby is your place to chat, talk and hang out – with friends and with your community.

  • Servers and channels: Create your own servers with categories, roles and private channels, or join with an invite.
  • Direct messages: Text friends, send pictures and GIFs and react with emojis.
  • Voice rooms and calls: Talk live with your people, with camera if you like.
  • 3D rooms: Enter a sky lounge, a beach or a cinema with your anime avatar. Dance together, sit down and watch videos together.
  • Teammate match: Find people who play the same games as you – like each other and start playing.
  • Profile with style: profile frames, effects, banners and your own status.
  • Notifications when someone writes to you or mentions you – adjustable per server.

  Stay safe: report and block right in the app, moderation by each server's mods, and delete your account any time in settings.

  ToLobby is free and has no ads. For ages 16 and up.
- **App-Symbol 512×512:** `store/play/icon-512.png`
- **Vorstellungsgrafik 1024×500:** `store/play/feature-1024x500.png`
- **Screenshots Handy (mind. 2):** die iPhone-Screenshots aus App Store Connect gehen auch (Play nimmt 9:16 bis 9:20)
- **Kategorie:** Soziale Netzwerke (oder Kommunikation) · **Kontakt-E-Mail:** deine Support-Adresse · **Website:** https://tolobby.com

## 5. Hochladen
1. „Test → Geschlossener Test“ → Track anlegen → Tester-Liste (E-Mails) → **Neuer Release** → `tolobby.aab` hochladen.
2. Beim ersten Upload fragt Google nach **Play App Signing** → „Von Google verwalteter Schlüssel“ (Standard) lassen.
   Unser Schlüssel im Expo-Konto ist dann nur der *Upload-Schlüssel*.
3. Versionshinweise: „Erste Android-Version von ToLobby.“ → Release prüfen → zur Überprüfung senden.
4. Nach 14 Tagen mit 12 Testern: „Produktionszugriff beantragen“ (Fragebogen) → danach Produktion-Release.

## Noch offen (für die erste Android-Version nicht nötig)
- **Mitteilungen (Push) auf Android:** braucht ein kostenloses Firebase-Projekt (google-services.json) und den
  FCM-Schlüssel im Expo-Konto. Ohne das läuft alles, nur ohne Mitteilungen bei geschlossener App.
- **Anruf wie am Telefon auf Android** (Vollbild bei gesperrtem Handy): eigener Android-Teil nötig; bis dahin klingelt es
  in der offenen App.
- **Trinkgeld auf Android:** über Google Play Billing; Artikel in der Play Console anlegen. Bis dahin ausgeblendet.
