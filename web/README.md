# IO-Darts-Agent Web Interface

Das Vue.js-basierte Konfigurations-Interface für IO-Darts-Agent.

## Technologie-Stack

- **Framework**: Vue 3 mit Composition API
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **State Management**: Pinia
- **Routing**: Vue Router
- **i18n**: vue-i18n (Deutsch, Englisch, Spanisch)
- **Icons**: Heroicons

## Struktur

```
web/src/
├── App.vue                 # Root-Komponente
├── main.ts                 # Vue App Entry
├── router/                 # Vue Router Konfiguration
├── stores/                 # Pinia State Management
│   ├── connection.ts       # Verbindungsstatus
│   ├── modules.ts          # Module
│   ├── players.ts          # Spieler
│   └── ...
├── views/                  # Seiten
│   ├── DashboardView.vue   # Dashboard
│   ├── ModulesView.vue     # Modulverwaltung
│   ├── PlayersView.vue     # Spielerverwaltung
│   ├── SetupView.vue       # Setup-Wizard
│   └── ...
├── components/             # Wiederverwendbare Komponenten
│   ├── BaseCard.vue
│   ├── ModuleCard.vue
│   ├── PlayerForm.vue
│   └── ...
├── locales/                # Übersetzungen
│   ├── de.json             # Deutsch
│   ├── en.json             # Englisch
│   └── es.json             # Spanisch
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

# Type-Check
npm run type-check

# Lint
npm run lint
```

Der Development-Server läuft auf `http://localhost:5173` und proxied API-Anfragen an `http://localhost:3000`.

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
- `tailwind.config.js` - Tailwind-Konfiguration
- `postcss.config.js` - PostCSS-Konfiguration

## Mehrsprachigkeit

Das Interface unterstützt mehrere Sprachen:
- 🇩🇪 Deutsch (Standard)
- 🇬🇧 Englisch
- 🇪🇸 Spanisch

Die Sprache wird automatisch basierend auf den Browser-Einstellungen gewählt und kann in den Einstellungen geändert werden.

## Empfohlene IDE-Einrichtung

- [VS Code](https://code.visualstudio.com/)
- [Volar](https://marketplace.visualstudio.com/items?itemName=Vue.volar) - Vue 3 Unterstützung
- [TypeScript Vue Plugin (Volar)](https://marketplace.visualstudio.com/items?itemName=Vue.vscode-typescript-vue-plugin)
- [Tailwind CSS IntelliSense](https://marketplace.visualstudio.com/items?itemName=bradlc.vscode-tailwindcss)

## Weitere Informationen

- [Developer Guide](../docs/de/developer-guide.md) - Entwickler-Dokumentation
- [API Dokumentation](../docs/de/api.md) - REST API Referenz
