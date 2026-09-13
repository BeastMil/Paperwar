# Paperwar / Rival

Ein Browser-Spiel mit Schere, Stein und Papier: Stelle drei Geschwader auf und spiele gegen den PC oder einen Freund per Einladungslink.

## Lokal starten

Node.js 22 oder neuer:

```
npm install
npm start
```

Öffne http://localhost:4173. `npm test` prüft Simulation und Mehrspieler-Server.

## Spielen

- Immer eine Stein-, eine Schere- und eine Papierformation. Formation direkt auf dem Feld auswählen; der Slider darunter verteilt die Truppen bis zum verfügbaren Maximum. Ein zentraler Hinweis zeigt unplatzierte Truppen, der Startknopf wird erst bei vollständiger Verteilung aktiv. Auch der PC verwendet genau diese drei Typen.
- Formation wählen und im freien Bereich eine Linie ziehen: Breite, Drehung und Marschrichtung folgen der Linie. Die Tiefe ergibt sich aus der Truppenzahl. Formationen dürfen die eigene Zone nicht verlassen oder sich überlappen.
- Im Gefecht stößt ein Klick nahe Truppen beider Teams radial weg. Der Ring am Mauszeiger zeigt den Cooldown von 1,25 realen Sekunden.
- Stein schlägt Schere, Schere schlägt Papier, Papier schlägt Stein. Der Verlierer übernimmt Team und Symbol des Gewinners. Gleiche Teams oder Symbole werden nicht umgewandelt.
- Kollisionen sind elastisch; beim ersten Kontakt werden keine Zufallsrichtungen vergeben.
- Das Feld ist glatt grün, ohne Gelände-Effekte. 1× läuft mit halber physikalischer Simulationszeit.

## Mehrspieler

**Freund einladen** erstellt einen privaten Raum mit zwei Plätzen. Link teilen, verdeckt aufstellen, beide **Bereit für die Schlacht** klicken.

Der Server berechnet den gemeinsamen Spielstand. Der Gastgeber bleibt für beide Rot, der Gast Blau. Jeder sieht seine eigene Armee unten; beim Gast ist das Feld um 180° gedreht. Impulswellen tragen die Farbe ihres Spielers. Eine deutliche Anzeige meldet, wenn der Gegner bereit ist. Der Gastgeber legt im Aufstellungs-Footer 10–150 Truppen pro Spieler und 0,25–3× Tempo fest. Mit der ersten Bereitschaft werden diese Optionen für den Raum gesperrt. Beide haben einen getrennten Impuls-Cooldown. Im Einzelspieler bleibt das Tempo während der Schlacht veränderbar.

Bei Verbindungsabbruch pausiert das Spiel; derselbe Browser-Tab versucht sich automatisch wieder zu verbinden. Nach etwa einer Minute wird der verlassene Platz freigegeben und die Aufstellung zurückgesetzt. **Aufgeben** beendet die laufende Mehrspieler-Schlacht als Niederlage. Beide sehen **You Won** bzw. **You Lose**. Nach dem Ergebnis wechseln beide erst zurück zur Aufstellung, wenn jeder bestätigt hat.

Räume werden nur im Arbeitsspeicher gehalten. Ein Serverneustart oder Deployment beendet bestehende Räume. Das Spiel benötigt weder Accounts noch eine Datenbank.

## Render

Siehe [DEPLOY.md](DEPLOY.md). Der Node-Web-Service verwendet `npm install --omit=dev`, `npm start` und `/health` als Healthcheck. `render.yaml` enthält die passende Konfiguration. Für Einladungen übers Internet wird die öffentliche HTTPS-Adresse benötigt, keine localhost-Adresse.

## Ergebnisstatistik

Nach der Runde zeigt eine geglättete, gestapelte Zeitlinie die Anteile aller sechs Team-/Truppentypen. Farbige Grabsteine markieren den Zeitpunkt, an dem ein Team seinen letzten Agenten eines Typs verliert. Im Mehrspieler erhalten beide denselben Verlauf.

