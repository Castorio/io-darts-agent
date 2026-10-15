# IO-Darts-Agent Web Interface

Das Vue.js-basierte Konfigurations-Interface für IO-Darts-Agent.

## Technologie-Stack

- **Framework**: Vue 3 mit Composition API
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **State Management**: Pinia
- **Routing**: Vue Router
- **i18n**: vue-i18n, 10 Sprachen (Deutsch, Englisch, Spanisch, Französisch, Italienisch, Niederländisch, Japanisch, Chinesisch, Russisch, Ukrainisch)
- **Icons**: Inline-SVG, keine Icon-Bibliothek

## Struktur

```
web/src/
├── App.vue                 # Root-Komponente
├── main.ts                 # Vue App Entry
├── router/                 # Vue Router Konfiguration
├── api/                    # Typisierte fetch-Wrapper für die Hub-API
├── stores/                 # Pinia State Management
│   ├── app.ts
│   ├── events.ts
│   ├── modules.ts
│   ├── players.ts
│   └── index.ts
├── views/                  # Seiten
│   ├── DashboardView.vue   # Dashboard
│   ├── ModulesView.vue     # Modulverwaltung
│   ├── PlayersView.vue     # Spielerverwaltung
│   ├── SetupView.vue       # Setup-Wizard
│   ├── SettingsView.vue
│   ├── AISettingsView.vue
│   └── ...
├── components/             # Wiederverwendbare Komponenten
│   ├── BaseCard.vue
│   ├── ModuleConfigCard.vue
│   ├── PlayerEditModal.vue
│   ├── config/             # Renderer für Modul-Config-Felder (DynamicConfigForm.vue, ...)
│   └── ...
├── i18n/
│   ├── index.ts
│   └── locales/            # de.ts, en.ts, es.ts, fr.ts, it.ts, ja.ts, nl.ts, ru.ts, uk.ts, zh.ts
└── assets/                 # Statische Assets
```

## Entwicklung

```bash
# Dependencies installieren
npm install

# Dev-Server starten (mit Hot-Reload)
npm run dev

# Produktions-Build
npm run build

# Type-Check (vue-tsc)
npm run type-check
```

Es gibt kein eigenes `lint`-Script im Web-Projekt; das `npm run lint` im Repo-Root (`eslint src --ext .ts`) prüft nur das Backend unter `src/`, nicht `web/`.

Der Development-Server läuft auf `http://localhost:5173` und proxied `/api`- und `/module-ui`-Anfragen (inklusive WebSocket) an `http://localhost:3000`, siehe `vite.config.ts`. Der Hub muss dafür parallel laufen (`npm run dev` im Projekt-Root).

## Features

### Dashboard
- Verbindungsstatus zu Autodarts
- Quick-Actions (Verbinden/Trennen)
- Modul-Übersicht
- Live-Logs

### Modulverwaltung
- Module starten/stoppen
- Modul-Konfiguration
- Module aus Git installieren
- Intent-Aktionen konfigurieren

### Spielerverwaltung
- Spielerprofile erstellen
- Individuelle Farben zuweisen
- Spielernamen-Aliase

### Setup-Wizard
- Autodarts-Zugangsdaten
- Board-Auswahl
- Modul-Aktivierung

### Logs
- Echtzeit-Event-Log
- Filter nach Modul
- Filter nach Event-Typ

## Build für Produktion

```bash
npm run build
```

Der Build-Output landet in `web/dist/` und wird vom Backend unter `http://localhost:3000` bereitgestellt.

## Tailwind CSS

Das Projekt verwendet Tailwind CSS für das Styling. Die Konfiguration befindet sich in:
- `tailwind.config.js`: Tailwind-Konfiguration
- `postcss.config.js`: PostCSS-Konfiguration

## Mehrsprachigkeit

Das Interface unterstützt zehn Sprachen (`de`, `en`, `es`, `fr`, `it`, `nl`, `ja`, `zh`, `ru`, `uk`); Deutsch und Englisch sind vollständig übersetzt, die übrigen teilweise.

Die Sprache wird beim ersten Start aus den Browser-Einstellungen übernommen (Fallback auf Englisch), anschließend in `localStorage` gespeichert, und kann in den Einstellungen geändert werden.

## Empfohlene IDE-Einrichtung

- [VS Code](https://code.visualstudio.com/)
- [Volar](https://marketplace.visualstudio.com/items?itemName=Vue.volar): Vue 3 Unterstützung
- [TypeScript Vue Plugin (Volar)](https://marketplace.visualstudio.com/items?itemName=Vue.vscode-typescript-vue-plugin)
- [Tailwind CSS IntelliSense](https://marketplace.visualstudio.com/items?itemName=bradlc.vscode-tailwindcss)

## Weitere Informationen

- [Developer Guide](../docs/de/developer-guide.md): Entwickler-Dokumentation
- [API Dokumentation](../docs/de/api.md): REST API Referenz
