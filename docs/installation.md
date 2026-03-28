# IO-Darts-Agent - Installation

Diese Anleitung zeigt, wie du IO-Darts-Agent auf deinem System installierst.

---

## Download

Lade die passende Version für dein System von der [GitHub Releases Seite](https://github.com/Castorio/io-darts-agent/releases) herunter:

| System | Datei | Beschreibung |
|--------|-------|--------------|
| **Windows** | `IO-Darts-Agent Setup X.X.X.exe` | One-Click Installer |
| **macOS (Intel)** | `IO-Darts-Agent-X.X.X-x64.dmg` | Disk Image für Intel Macs |
| **macOS (Apple Silicon)** | `IO-Darts-Agent-X.X.X-arm64.dmg` | Disk Image für M1/M2/M3 Macs |
| **Ubuntu/Debian** | `io-darts-agent_X.X.X_amd64.deb` | Debian-Paket |
| **Linux (Universal)** | `IO-Darts-Agent-X.X.X.AppImage` | Portable für alle Linux-Distros |
| **Fedora/RHEL** | `io-darts-agent-X.X.X.x86_64.rpm` | RPM-Paket |

> **Hinweis**: Node.js ist **nicht** erforderlich! Die App bringt alles mit.

---

## Windows Installation

### Installation

1. Lade `IO-Darts-Agent Setup X.X.X.exe` herunter
2. Doppelklicke auf die Datei
3. Falls Windows SmartScreen erscheint: **Weitere Informationen** → **Trotzdem ausführen**
4. Folge dem Installationsassistenten
5. Die App startet automatisch nach der Installation

### Starten

- **Start-Menü**: Suche nach "IO-Darts-Agent"
- **Desktop**: Doppelklicke auf das Desktop-Symbol (falls erstellt)

### Beenden

Die App läuft im System-Tray (neben der Uhr):
- **Rechtsklick** auf das Symbol → **Beenden**

### Deinstallation

1. **Einstellungen** → **Apps** → **IO-Darts-Agent** → **Deinstallieren**

---

## macOS Installation

### Installation

1. Lade die `.dmg`-Datei herunter:
   - **Intel Mac**: `IO-Darts-Agent-X.X.X-x64.dmg`
   - **Apple Silicon (M1/M2/M3)**: `IO-Darts-Agent-X.X.X-arm64.dmg`
2. Doppelklicke auf die `.dmg`-Datei
3. Ziehe die App in den **Applications**-Ordner
4. Beim ersten Start: **Rechtsklick** → **Öffnen** (wegen Gatekeeper)

### Bei "App kann nicht geöffnet werden"

1. Öffne **Systemeinstellungen** → **Datenschutz & Sicherheit**
2. Scrolle nach unten zu "IO-Darts-Agent wurde blockiert"
3. Klicke auf **Trotzdem öffnen**

### Starten

- **Launchpad**: Suche nach "IO-Darts-Agent"
- **Finder**: Applications → IO-Darts-Agent

### Beenden

Die App läuft in der Menüleiste:
- Klicke auf das Symbol → **Beenden**

### Deinstallation

1. Ziehe die App aus **Applications** in den Papierkorb
2. Lösche ggf. Einstellungen: `~/Library/Application Support/io-darts-agent`

---

## Ubuntu/Debian Installation

### Mit .deb-Paket (empfohlen)

```bash
# Herunterladen (ersetze X.X.X mit der Version)
wget https://github.com/Castorio/io-darts-agent/releases/download/vX.X.X/io-darts-agent_X.X.X_amd64.deb

# Installieren
sudo dpkg -i io-darts-agent_X.X.X_amd64.deb

# Falls Abhängigkeiten fehlen
sudo apt-get install -f
```

### Starten

```bash
# Über das Terminal
io-darts-agent

# Oder über das Anwendungsmenü suchen
```

### Als Systemdienst (Autostart)

```bash
# Autostart aktivieren
mkdir -p ~/.config/autostart
cat > ~/.config/autostart/io-darts-agent.desktop << 'EOF'
[Desktop Entry]
Type=Application
Name=IO-Darts-Agent
Exec=io-darts-agent
Hidden=false
NoDisplay=false
X-GNOME-Autostart-enabled=true
EOF
```

### Deinstallation

```bash
sudo apt remove io-darts-agent
```

---

## Linux (AppImage) Installation

AppImage funktioniert auf **allen** Linux-Distributionen ohne Installation.

### Installation

```bash
# Herunterladen
wget https://github.com/Castorio/io-darts-agent/releases/download/vX.X.X/IO-Darts-Agent-X.X.X.AppImage

# Ausführbar machen
chmod +x IO-Darts-Agent-X.X.X.AppImage

# Optional: In /usr/local/bin verschieben
sudo mv IO-Darts-Agent-X.X.X.AppImage /usr/local/bin/io-darts-agent
```

### Starten

```bash
# Direkt ausführen
./IO-Darts-Agent-X.X.X.AppImage

# Oder wenn in PATH
io-darts-agent
```

### Desktop-Verknüpfung erstellen

```bash
cat > ~/.local/share/applications/io-darts-agent.desktop << 'EOF'
[Desktop Entry]
Type=Application
Name=IO-Darts-Agent
Exec=/pfad/zur/IO-Darts-Agent-X.X.X.AppImage
Icon=io-darts-agent
Categories=Utility;
EOF
```

---

## Fedora/RHEL Installation

### Mit .rpm-Paket

```bash
# Herunterladen
wget https://github.com/Castorio/io-darts-agent/releases/download/vX.X.X/io-darts-agent-X.X.X.x86_64.rpm

# Installieren
sudo rpm -i io-darts-agent-X.X.X.x86_64.rpm

# Oder mit DNF (löst Abhängigkeiten auf)
sudo dnf install ./io-darts-agent-X.X.X.x86_64.rpm
```

### Deinstallation

```bash
sudo dnf remove io-darts-agent
```

---

## Erste Einrichtung

Nach dem Start:

1. Die App öffnet automatisch ein Fenster mit dem Web-Interface
2. Falls nicht: Öffne `http://localhost:3000` im Browser
3. Folge dem Setup-Wizard:
   - Gib deine Autodarts-Zugangsdaten ein
   - Wähle dein Board
   - Konfiguriere die Module

Siehe [Benutzerhandbuch](user-guide.md) für detaillierte Anleitungen.

---

## System Tray / Menüleiste

IO-Darts-Agent läuft im Hintergrund mit einem Tray-Icon:

| Aktion | Beschreibung |
|--------|--------------|
| **Linksklick** | Öffnet/zeigt das Hauptfenster |
| **Rechtsklick** | Kontextmenü |
| **→ Im Browser öffnen** | Öffnet das Web-Interface im Standard-Browser |
| **→ Beenden** | Beendet die App vollständig |

---

## Fehlerbehebung

### Port 3000 ist belegt

Die App wählt automatisch einen freien Port. Falls Probleme auftreten:
1. Beende andere Programme auf Port 3000
2. Oder ändere den Port in den Einstellungen

### App startet nicht (Windows)

1. Stelle sicher, dass die Installation abgeschlossen wurde
2. Deaktiviere vorübergehend den Virenschutz
3. Führe die App als Administrator aus

### Keine Verbindung zu Autodarts

1. Prüfe deine Internetverbindung
2. Prüfe deine Zugangsdaten
3. Versuche dich auf autodarts.io anzumelden

### Linux: "GLIBC_X.XX not found"

Dein System ist zu alt. Versuche:
1. System aktualisieren
2. Oder das AppImage verwenden

### macOS: "App ist beschädigt"

```bash
# Quarantäne-Attribut entfernen
xattr -d com.apple.quarantine /Applications/IO-Darts-Agent.app
```

---

## Updates

Die App zeigt eine Benachrichtigung wenn Updates verfügbar sind.

**Manuelles Update:**
1. Lade die neue Version herunter
2. Installiere sie (überschreibt die alte Version)
3. Deine Einstellungen bleiben erhalten

---

## Nächste Schritte

- [Benutzerhandbuch](user-guide.md) - Ausführliche Anleitung
- [FAQ](user-guide.md#faq) - Häufige Fragen
- [Module](user-guide.md#module-verwalten) - WLED, Game Display, etc.
