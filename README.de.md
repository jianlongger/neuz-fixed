<div align=right>
  <a href="README.中文.md">中文</a> | <a href="README.md">English</a>
</div>

&nbsp;&nbsp;&nbsp;&nbsp;

![banner]

- [Download](#download)
- [Community](#community)
- [Nutzung](#nutzung)
  - [Engagement-Verhalten](#engagement-verhalten)
  - [Farming-Automatisierung](#farming-automatisierung)
    - [Voraussetzungen](#voraussetzungen)
    - [Slot-Konfiguration](#slot-konfiguration)
  - [Support-Automatisierung](#support-automatisierung)
  - [AutoShout](#autoshout)
- [FAQ](#faq)

> `Neuz` ist ein modifizierter Flyff Universe-Client & Bot, welcher benutzerdefinierte Bilderkennung für eine Vielzahl automatisierter Aktionen nutzt.

> [!WARNING]  
> Diese Seite wurde **automatisch übersetzt**. Die englische Version ist die **maßgebliche Quelle**, und diese Übersetzung könnte Fehler enthalten.

# Download
[![Build release](https://github.com/MadrigalStreetCartel/neuz/actions/workflows/main.yml/badge.svg)](https://github.com/MadrigalStreetCartel/neuz/actions/workflows/main.yml)
- Neueste Version: [Download][download]
- Ältere Versionen (nur Windows): [Release-Archiv](./releases)

Schau dir das [Changelog][changelog] an!

# Community
**v0.12.1 ist die letzte Version, die von den ursprünglichen Entwicklern gewartet und veröffentlicht wurde. Weitere Versionen werden ausschließlich von der Community entwickelt.**

Geplante Features:
- Erkennung und Vermeidung von Giants
- Unterstützung für Skripting (umgesetzt durch eine DSL) für benutzerdefinierte Bewegungsmuster und andere Verhaltensweisen
- Vollständige plattformübergreifende Unterstützung für Mac & Linux
- Automatisiertes Deployment-Skript mit Docker-Containern für einfache Parallelisierung

Tritt unserem Discord bei: https://discord.gg/WR6FuNEYj6

# Entwicklung

Voraussetzungen:
- Installiere eine aktuelle Version von `nodejs` (die neueste Version sollte funktionieren)
- Installiere `yarn` (https://classic.yarnpkg.com/en/docs/install)
- Installiere `rustup` (https://rust-lang.org/tools/install)
- Installiere die neueste stabile Rust-Version über rustup: `rustup install stable`

Erstellung:
- Erstelle einen Build-Ordner im Hauptverzeichnis
- Führe `yarn` im Hauptverzeichnis aus, um Abhängigkeiten zu installieren
- Starte die App im Entwicklungsmodus mit `yarn tauri dev`
- Baue die App für die Produktion mit `yarn tauri build`

Vor dem Pushen:
- Führe `cargo clippy` im `src-tauri`-Verzeichnis aus, um auf Linter-Fehler zu prüfen
- Führe `cargo fmt` im `src-tauri`-Verzeichnis aus, um den Code zu formatieren

# Nutzung

1. Starte Neuz als Administrator
2. Wähle oder erstelle ein Profil
3. Drücke `Play`
4. Wähle einen Spielstil
5. Passe die Einstellungen nach deinen Wünschen an
6. Drücke `ENGAGE`

## Engagement-Verhalten

- Die Automatisierung beginnt, sobald du `ENGAGE` drückst.
- Durch Drücken von `DISENGAGE` wird die Automatisierung vollständig gestoppt.
- Ab Version 0.15.0 vollständig im Hintergrund funktionsfähig.

## Farming-Automatisierung

Nutze die Farming-Automatisierung, wenn du deinen Charakter leveln oder Sets, Quest-Items, Penya usw. farmen möchtest.

Am effektivsten in dicht bevölkerten Farmgebieten.
Falls konfiguriert, wird auch ein AOE-Angriff verwendet, wenn das Ziel nahe genug ist.

### Voraussetzungen

Standardmäßig müssen keine Einstellungen geändert werden.

1. Verwende das Standard-Theme -> Gold (ist standardmäßig eingestellt) 
2. Aktiviere den Auto-Angriff (ist standardmäßig aktiviert)

Für optimale Leistung (optional, aber nicht zwingend erforderlich):

1. Deaktiviere Wetter- und Eventeffekte.
2. Drücke <kbd>ESC</kbd> mehrmals vor dem Aktivieren, um alle störenden UI-Elemente zu entfernen.
3. Schau im #How-To-Kanal auf Discord für eine vollständige Setup-Anleitung.

## Support-Automatisierung
##### Eigenständiger Support:
- Fülle die Slots nach Wunsch (Heilzauber für das gewünschte Ziel, Essen/Pillen für dich selbst).
- Wähle den Charakter aus, dem du im Spiel folgen möchtest.
- Drücke Z, um dem Charakter zu folgen.
- Engagieren.

##### Gruppen-Support:
Der Bot folgt dem Gruppenleiter automatisch, indem er ihn aus dem Gruppenfenster auswählt. Um es zum Laufen zu bringen:
- Aktiviere die Option "Ist in einer Gruppe?" in den Einstellungen.
- Platziere das Gruppenfenster unten links und verkleinere es so weit wie möglich von den Seiten und unten.
- Schließe alle Gruppenfenster vor dem Aktivieren.
- Engagieren.
Der Bot nutzt F1 + C (Aktions-Slot), um sich basierend auf dem "Intervall zwischen Buffs"-Timer selbst zu buffen.

## Slot-Konfiguration

| Slot-Symbol | Flyff-Äquivalent |   Beschreibung    |
| ----------- | ---------------- | ---------------- |
| 🍔         | Essen            | Heilt dich schnell und hat eine kurze Abklingzeit, wird aktiviert, wenn HP unter dem Schwellenwert sind
| 💊         | Pille            | Heilt dich schnell, hat aber eine lange Abklingzeit, gleiche Auslösung
| ![](./src/assets/heal_spell_16x16.png) | Heilzauber | Nur Support, heilt den gefolgten Charakter entsprechend seines HP-Wertes
| 🐶         | Begleiter        | Ruft dein Haustier herbei, wenn nötig
| ![](./src/assets/icon_motion_pickup_16x16.png) | Aufsammeln | Hebt Gegenstände vom Boden auf
| ![](./src/assets/icon_refresher_16x16.png) | MP-Wiederherstellung | Stellt MP schnell wieder her, kurze Abklingzeit, aktiviert wenn MP unter dem Schwellenwert sind
| ![](./src/assets/icon_vitaldrink_16x16.png) | FP-Wiederherstellung | Dasselbe für FP
| 🗡️         | Angriffs-Skill  | Angriffsskill oder **Bewegung**
| 🪄         | Buff-Skill      | Lange darauf gewartet
| ![](./src/assets/rez_spell_16x16.png) | Wiederbelebungszauber | Nur Support, belebt den gefolgten Charakter wieder
| ✈️         | Board/Reittier  | Vielleicht in der Luft

## AutoShout
- Schreibe deine Nachrichten (eine pro Zeile, drücke Enter für eine neue Zeile).
- Gib das gewünschte Intervall ein.
- Aktiviere und flute den Chat!

# FAQ

**Ist das sicher?**<br>
Ja. Falls du uns nicht vertraust, kompiliere es selbst oder GTFO.

**Ist das ein Bot?**<br>
Es ist ein Client mit halbautonomen Automatisierungsfunktionen.

<!-- Links -->
[banner]: ./banner.png
[download]: https://github.com/MadrigalStreetCartel/neuz/releases/
[changelog]: https://github.com/MadrigalStreetCartel/neuz/blob/main/CHANGELOG.md

<!-- Disclaimer -->
<small>Haftungsausschluss: Wir sind NICHT mit Gala Lab Corp., Sniegu Technologies SAS oder Flyff Universe verbunden.</small>
