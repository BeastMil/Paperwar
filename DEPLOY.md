# Rival auf Render veröffentlichen

Der Prototyp ist für einen einzelnen Render **Web Service** vorbereitet. Kein Static Site Service: Die Simulation und WebSockets laufen auf dem Node-Server.

## GitHub

Ein neues, vorzugsweise privates Repository anlegen und diese Dateien im Hauptverzeichnis ablegen:

- `package.json`, `pnpm-lock.yaml`, `render.yaml`, `.gitignore`
- `server.cjs`, `multiplayer.cjs`, `simulation.js`
- `index.html`, `style.css`, `app.js`, `network.js`
- `test.cjs`, `multiplayer.test.cjs`, `README.md`, `DEPLOY.md`

`node_modules` gehört nicht ins Repository. Ein vorbereitetes Archiv mit genau den Quelldateien heißt `rival-render-source.zip`; vor dem Upload auf GitHub entpacken.

## Render

1. GitHub mit Render verbinden und Zugriff auf dieses Repository erlauben.
2. **New → Web Service** → Repository auswählen.
3. Runtime: **Node**. Build Command: `npm install --omit=dev`. Start Command: `npm start`.
4. Instance Type: **Free** für den ersten Test. Keine Datenbank, keine Environment Secrets erforderlich. Health Check Path: `/health`.
5. Deploy starten. Alternativ kann **New → Blueprint** die enthaltene `render.yaml` übernehmen.

Nach erfolgreichem Deploy die von Render angezeigte HTTPS-Adresse öffnen. **Freund einladen** erzeugt einen privaten Spielraum. Den angezeigten Raumlink an den Mitspieler senden. Beide stellen auf und klicken **Bereit für die Schlacht**.

## Erste Version

- Zwei Spieler pro Raum, 100 Truppen pro Seite, gemeinsames festes 1×-Tempo.
- Jeder sieht seine eigene Armee unten als Rot; der Gegner wird als Blau dargestellt.
- Der Server berechnet Kollisionen, Umwandlungen und getrennte Impuls-Cooldowns.
- Bei Verbindungsabbruch pausiert das Gefecht. Wiederverbindung im selben Browser-Tab wird automatisch versucht. Nach rund einer Minute wird der verlassene Platz freigegeben und die Planung zurückgesetzt.
- Räume liegen im Arbeitsspeicher. Serverneustarts/Deployments verlieren laufende Räume. Ein neuer Einladungslink startet einen neuen Raum.
- Zurück zur Aufstellung setzt die Runde für beide zurück.
- Kostenlose Render-Dienste können nach Inaktivität schlafen; der erste Aufruf kann verzögert sein. Den Link erst teilen, wenn die Seite geladen ist.

## Lokal prüfen

`npm install`, danach `npm test` und `npm start`. Browser: `http://localhost:4173`.
Zum Testen zwei unabhängige Tabs öffnen; Einladungslink verwenden. Kein Konto im Spiel erforderlich.
