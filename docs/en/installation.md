# IO-Darts-Agent - Installation

This guide shows how to install IO-Darts-Agent on your system.

---

## Download

Download the appropriate version for your system from the [GitHub Releases page](https://github.com/user/io-darts-agent/releases):

| System | File | Description |
|--------|------|-------------|
| **Windows** | `IO-Darts-Agent Setup X.X.X.exe` | One-Click Installer |
| **macOS (Intel)** | `IO-Darts-Agent-X.X.X-x64.dmg` | Disk Image for Intel Macs |
| **macOS (Apple Silicon)** | `IO-Darts-Agent-X.X.X-arm64.dmg` | Disk Image for M1/M2/M3 Macs |
| **Ubuntu/Debian** | `io-darts-agent_X.X.X_amd64.deb` | Debian package |
| **Linux (Universal)** | `IO-Darts-Agent-X.X.X.AppImage` | Portable for all Linux distros |
| **Fedora/RHEL** | `io-darts-agent-X.X.X.x86_64.rpm` | RPM package |

> **Note**: Node.js is **not** required! The app includes everything.

---

## Windows Installation

### Installation

1. Download `IO-Darts-Agent Setup X.X.X.exe`
2. Double-click the file
3. If Windows SmartScreen appears: **More info** → **Run anyway**
4. Follow the installation wizard
5. The app starts automatically after installation

### Starting

- **Start Menu**: Search for "IO-Darts-Agent"
- **Desktop**: Double-click the desktop icon (if created)

### Closing

The app runs in the System Tray (next to the clock):
- **Right-click** on the icon → **Quit**

### Uninstallation

1. **Settings** → **Apps** → **IO-Darts-Agent** → **Uninstall**

---

## macOS Installation

### Installation

1. Download the `.dmg` file:
   - **Intel Mac**: `IO-Darts-Agent-X.X.X-x64.dmg`
   - **Apple Silicon (M1/M2/M3)**: `IO-Darts-Agent-X.X.X-arm64.dmg`
2. Double-click the `.dmg` file
3. Drag the app to the **Applications** folder
4. On first start: **Right-click** → **Open** (due to Gatekeeper)

### If "App can't be opened"

1. Open **System Settings** → **Privacy & Security**
2. Scroll down to "IO-Darts-Agent was blocked"
3. Click **Open Anyway**

### Starting

- **Launchpad**: Search for "IO-Darts-Agent"
- **Finder**: Applications → IO-Darts-Agent

### Closing

The app runs in the menu bar:
- Click the icon → **Quit**

### Uninstallation

1. Drag the app from **Applications** to Trash
2. Optionally delete settings: `~/Library/Application Support/io-darts-agent`

---

## Ubuntu/Debian Installation

### With .deb Package (recommended)

```bash
# Download (replace X.X.X with version)
wget https://github.com/user/io-darts-agent/releases/download/vX.X.X/io-darts-agent_X.X.X_amd64.deb

# Install
sudo dpkg -i io-darts-agent_X.X.X_amd64.deb

# If dependencies are missing
sudo apt-get install -f
```

### Starting

```bash
# Via terminal
io-darts-agent

# Or search in application menu
```

### As System Service (Autostart)

```bash
# Enable autostart
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

### Uninstallation

```bash
sudo apt remove io-darts-agent
```

---

## Linux (AppImage) Installation

AppImage works on **all** Linux distributions without installation.

### Installation

```bash
# Download
wget https://github.com/user/io-darts-agent/releases/download/vX.X.X/IO-Darts-Agent-X.X.X.AppImage

# Make executable
chmod +x IO-Darts-Agent-X.X.X.AppImage

# Optional: Move to /usr/local/bin
sudo mv IO-Darts-Agent-X.X.X.AppImage /usr/local/bin/io-darts-agent
```

### Starting

```bash
# Execute directly
./IO-Darts-Agent-X.X.X.AppImage

# Or if in PATH
io-darts-agent
```

### Create Desktop Shortcut

```bash
cat > ~/.local/share/applications/io-darts-agent.desktop << 'EOF'
[Desktop Entry]
Type=Application
Name=IO-Darts-Agent
Exec=/path/to/IO-Darts-Agent-X.X.X.AppImage
Icon=io-darts-agent
Categories=Utility;
EOF
```

---

## Fedora/RHEL Installation

### With .rpm Package

```bash
# Download
wget https://github.com/user/io-darts-agent/releases/download/vX.X.X/io-darts-agent-X.X.X.x86_64.rpm

# Install
sudo rpm -i io-darts-agent-X.X.X.x86_64.rpm

# Or with DNF (resolves dependencies)
sudo dnf install ./io-darts-agent-X.X.X.x86_64.rpm
```

### Uninstallation

```bash
sudo dnf remove io-darts-agent
```

---

## Initial Setup

After starting:

1. The app automatically opens a window with the web interface
2. If not: Open `http://localhost:3000` in your browser
3. Follow the setup wizard:
   - Enter your Autodarts credentials
   - Select your board
   - Configure the modules

### Built-in Modules

IO-Darts-Agent comes with three built-in modules:

| Module | Description |
|--------|-------------|
| **WLED Lighting Controller** | Control LED strips based on game events |
| **Game Display** | Show scores on a separate screen |
| **Darts Caller** | Professional voice announcements |

See [User Guide](user-guide.md) for detailed instructions.

---

## System Tray / Menu Bar

IO-Darts-Agent runs in the background with a tray icon:

| Action | Description |
|--------|-------------|
| **Left-click** | Opens/shows the main window |
| **Right-click** | Context menu |
| **→ Open in Browser** | Opens web interface in default browser |
| **→ Quit** | Completely closes the app |

---

## Troubleshooting

### Port 3000 is occupied

The app automatically selects a free port. If problems occur:
1. Close other programs using port 3000
2. Or change the port in settings

### App won't start (Windows)

1. Make sure installation completed
2. Temporarily disable antivirus
3. Run the app as administrator

### No connection to Autodarts

1. Check your internet connection
2. Check your credentials
3. Try logging in on autodarts.io

### Linux: "GLIBC_X.XX not found"

Your system is too old. Try:
1. Update your system
2. Or use the AppImage

### macOS: "App is damaged"

```bash
# Remove quarantine attribute
xattr -d com.apple.quarantine /Applications/IO-Darts-Agent.app
```

---

## Updates

The app shows a notification when updates are available.

**Manual update:**
1. Download the new version
2. Install it (overwrites the old version)
3. Your settings are preserved

---

## Next Steps

- [User Guide](user-guide.md) - Detailed instructions
- [FAQ](user-guide.md#faq) - Frequently asked questions
- [WLED Module](user-guide.md#wled-module) - LED lighting setup
- [Game Display](user-guide.md#game-display-module) - Score display setup
- [Darts Caller](user-guide.md#darts-caller-module) - Voice announcements setup
- [Features](features.md) - Full feature list
