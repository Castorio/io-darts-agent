# IO-Darts-Agent - User Guide

This guide walks you through the setup and use of IO-Darts-Agent step by step. From the first start to a complete system with all modules.

---

## Table of Contents

1. [What is IO-Darts-Agent?](#what-is-io-darts-agent)
2. [System Requirements](#system-requirements)
3. [Installation](#installation)
4. [Initial Setup](#initial-setup)
5. [The Dashboard](#the-dashboard)
6. [Managing Modules](#managing-modules)
7. [WLED Module - LED Lighting](#wled-module)
8. [Game Display Module - Score Display](#game-display-module)
9. [Darts Caller Module - Voice Announcements](#darts-caller-module)
10. [Player Management](#player-management)
11. [Live Logs](#live-logs)
12. [Settings](#settings)
13. [Installing New Modules](#installing-new-modules)
14. [FAQ](#faq)
15. [Troubleshooting](#troubleshooting)

---

## What is IO-Darts-Agent?

IO-Darts-Agent is software that connects to your Autodarts system and can trigger actions for various game events:

- **🎨 Control LED lighting** - Your WLED lighting blinks on a Triple
- **📺 Display scores** - Show the game score on a second screen
- **🎙️ Voice announcements** - Professional darts caller for scores and checkouts
- **🔔 Send notifications** - Receive alerts for special events
- **And much more** - The system is extensible!

---

## System Requirements

### Minimum Requirements

| Component | Requirement |
|-----------|-------------|
| **Computer** | Windows 10+, macOS 10.15+, or Linux (Ubuntu 20.04+) |
| **Browser** | Chrome, Firefox, Safari or Edge (current) |
| **Network** | Same network as your Autodarts board |
| **Autodarts** | Account with API access (free) |

> **Note**: Node.js is **not** required! The app includes everything.

### For WLED Module Additionally

- WLED-compatible LED controller (e.g. ESP8266/ESP32)
- WLED firmware version 0.13+

---

## Installation

### Download

Download the appropriate version for your system:
👉 [GitHub Releases](https://github.com/user/io-darts-agent/releases)

| System | File |
|--------|------|
| **Windows** | `io-darts-agent Setup X.X.X.exe` |
| **macOS** | `io-darts-agent-X.X.X.dmg` |
| **Ubuntu/Debian** | `io-darts-agent_X.X.X_amd64.deb` |
| **Linux (Universal)** | `io-darts-agent-X.X.X.AppImage` |

### Installation

**Windows:** Double-click the `.exe` → Follow installer

**macOS:** Open `.dmg` → Drag app to Applications

**Ubuntu:** `sudo dpkg -i io-darts-agent_X.X.X_amd64.deb`

**Linux:** `chmod +x *.AppImage && ./io-darts-agent-X.X.X.AppImage`

Detailed instructions: [Installation](installation.md)

### Starting the App

After installation, the app starts automatically. You can find it:
- **Windows**: Start Menu → "IO-Darts-Agent"
- **macOS**: Launchpad → "IO-Darts-Agent"
- **Linux**: Application menu or terminal: `io-darts-agent`

The app runs in the System Tray / menu bar

---

## Initial Setup

### Step 1: Open Browser

Open your browser and go to:
```
http://localhost:3000
```

You'll see the Setup Wizard:

![Setup Wizard](../images/setup-wizard.png)
*(If you've already set up, you'll see the Dashboard)*

### Step 2: Autodarts Login

Enter your Autodarts credentials:

1. **Email**: Your Autodarts email address
2. **Password**: Your Autodarts password

> 💡 **Note**: The data is only stored locally on your computer and sent directly to Autodarts.

### Step 3: Select Board

After successful login, you'll see your boards. Select the board you want to use.

### Step 4: Done!

Click "Finish Setup". The hub automatically connects to Autodarts.

---

## The Dashboard

After setup, you'll see the Dashboard:

![Dashboard](../images/03-dashboard.png)

### Dashboard Areas

| Area | Description |
|------|-------------|
| **Connection Status** | Shows if connection to Autodarts is active |
| **Modules** | Overview of installed and active modules |
| **Activity** | Recent events and actions |
| **Quick Access** | Links to important functions |

### Navigation

The left sidebar leads to all areas:

- 🏠 **Dashboard** - Overview
- 📦 **Modules** - Manage modules
- 👥 **Players** - Player profiles
- 📜 **Logs** - Live events
- ⚙️ **Settings** - Configuration

---

## Managing Modules

Modules are extensions that add various functions.

### Open Module Overview

Click **Modules** in the sidebar:

![Module List](../images/04-modules-list.png)

### Module Status

| Symbol | Meaning |
|--------|---------|
| 🟢 **Running** | Module is active and processing events |
| 🔴 **Stopped** | Module is stopped |
| ⚠️ **Error** | Module has an error |

### Start/Stop Module

1. Click on a module in the list
2. Use the **Start** or **Stop** buttons

---

## WLED Module

The WLED module controls LED strips based on game events.

### What You Need

- WLED controller (e.g. ESP8266/ESP32 with WLED firmware)
- LED strip (WS2812B, SK6812, etc.)
- The controller must be on the same network

### Open WLED Module

1. Go to **Modules**
2. Click on **WLED Lighting Controller**

![WLED Module](../images/05-wled-module.png)

### Configure WLED

Click on **Configure WLED**:

![WLED Configuration](../images/06-wled-config.png)

### Basic Settings

1. **WLED IP Address**: Enter the IP of your WLED controller (e.g. `192.168.1.100`)
2. **Port**: Usually `80`
3. **Fade Time**: Transition time in milliseconds for smooth color changes (optional)
4. Click **Save**

### Set Up Event Actions

You can set an action for each event:

#### Example: Triple Hit

1. Scroll to **Throw Events**
2. For **Triple** select:
   - **Action Type**: `Effect`
   - **Effect**: `Blink` or `Rainbow`
   - **Brightness**: `255` (Maximum)
   - **Duration**: `500` (0.5 seconds, then return to player color)
3. Enable **Use Player Color** (optional)

#### Popular Configurations

| Event | Recommended Action |
|-------|-------------------|
| **Match Start** | Effect "Rainbow", Duration 2000ms |
| **Player Change** | Solid color with player color |
| **Triple** | Short blink (500ms) |
| **Bullseye** | Golden flash (500ms) |
| **180** | Fireworks effect (3s) |
| **Bust** | Red alarm (1s) |
| **Takeout Finished** | Restore player color |

### Player Colors

When you enable **Use Player Color**, the effect automatically takes the color of the current player. For this you need to:

1. Create player profiles in **Player Management**
2. Assign a color to each player
3. The name must match the Autodarts name

### Single-Player Mode

The WLED module fully supports single-player games:
- Player color is applied after match start (after optional start animation)
- Player color is restored after each takeout
- No player change event needed

### Duration and Fade Time

- **Duration**: How long an effect lasts before returning to player color
- **Fade Time**: How smoothly the transition happens (global or per-action)

---

## Game Display Module

Shows the game score on a separate screen.

### Perfect For

- Second monitor next to the board
- Tablet on the wall
- Smart TV as spectator display

### Open Game Display

1. Go to **Modules**
2. Click on **Game Display**

![Game Display Module](../images/07-game-display-module.png)

### Open Configuration

Click on **Configure Display**:

![Game Display Configuration](../images/08-game-display-config.png)

### Open Display on Another Device

1. Click **Copy URL**
2. Open the URL on the target device:
   ```
   http://YOUR-IP:3000/module-ui/game-display/
   ```
   (Replace `YOUR-IP` with your computer's IP)
3. Enable fullscreen mode (F11)

### The Display

Here's what the display looks like during a game:

![Game Display Waiting View](../images/09-game-display-ui.png)

*Waiting view without active game*

![Game Display Demo](../images/10-game-display-demo.png)

*Demo mode with sample data*

### Display Elements

| Element | Description |
|---------|-------------|
| **Player Name** | Displayed large at top |
| **Status** | Leg, Set, "On Throw" |
| **Score** | Very large remaining points |
| **Checkout** | Suggestion when finish is possible |
| **Dart Boxes** | Shows all 3 throws of the turn |
| **Turn Score** | Sum of current turn |
| **Other Players** | Bar at bottom with all other players |

### Test Demo Mode

When no game is running, you can use demo mode:

1. Click **Start Demo** in the top right
2. The display shows sample data
3. Click **End Demo** to reset

### Idle Mode Options

Configure what shows when no game is running:
- **Waiting Screen**: Default "Waiting for game..."
- **Last Game**: Show results of the last game
- **Black Screen**: Display goes completely black
- **Custom Image**: Show your own image

### Match Started Screen

Configure what shows when a match starts:
- **Default**: Shows default match started animation
- **Custom Image/GIF**: Display your own image or animated GIF

### Match Results

After a match ends, the display shows a results table with:
- Chalkboard showing all throws
- Match statistics (averages, darts thrown, etc.)
- Final scores

Configure the results display:
- **Display Duration**: How long to show results (0 = until manually dismissed)
- **Background Color**: Custom background color for the results screen

---

## Darts Caller Module

Professional darts caller with voice announcements.

### What It Does

- Announces scores after each turn
- Announces checkout requirements ("You require...")
- Special calls for 180, bust, game shot, match shot
- Announces player names on player change

### Open Darts Caller

1. Go to **Modules**
2. Click on **Darts Caller**

### Configure Caller

Click on **Configure**:

### Output Modes

| Mode | Description |
|------|-------------|
| **Browser TTS** | Uses the browser's built-in text-to-speech |
| **Audio Pack** | Uses pre-recorded audio files (MP3) |
| **Local Playback** | Plays audio directly on the server |

### Using Browser TTS

1. Select **TTS** as output type
2. Configure voice, speed, and pitch
3. Keep a browser tab open with the hub

### Using Audio Packs

1. Select **Audio** as output type
2. Choose an audio pack (or use Voice Pack Generator)
3. Audio files are played in the browser

### Voice Pack Generator

Create custom voice packs using ElevenLabs TTS:

1. Get an API key from [elevenlabs.io](https://elevenlabs.io)
2. Enter your API key
3. Choose a voice
4. Configure stability and clarity
5. Click **Generate Voice Pack**

The generator creates all required files:
- Score announcements (0-180)
- Checkout calls (2-170)
- Special calls (game on, game shot, bust, etc.)

### Announcement Options

| Option | Description |
|--------|-------------|
| **Call Scores** | Announce scores after each turn |
| **High Scores Only** | Only announce scores ≥100 |
| **Call Checkouts** | Announce checkout requirements |
| **Call Player Change** | Announce player names |
| **Call 180** | Special 180 announcement |
| **Call Busts** | Announce busts |

---

## Player Management

Here you create player profiles with individual colors.

### Open Players

Click **Players** in the sidebar:

![Player Management](../images/11-players.png)

### Create New Player

1. Click **Add Player**
2. Fill in the fields:
   - **Name**: The main name
   - **Aliases**: Alternative names (e.g. for different Autodarts profiles)
   - **Color**: Click the color field and choose a color
3. Click **Save**

### Why Player Colors?

The colors are used by modules:
- **WLED**: LEDs light up in the player color
- **Game Display**: Background in the player color
- **Darts Caller**: Can announce player-specific sounds

### Understanding Aliases

If your Autodarts name is "MaxDarts2024" but you want to be displayed as "Max":

1. Name: `Max`
2. Aliases: `MaxDarts2024`

The hub recognizes "MaxDarts2024" and uses the "Max" profile.

---

## Live Logs

Here you see all events and module activities in real-time.

### Open Logs

Click **Logs** in the sidebar:

![Live Logs](../images/12-logs.png)

### Understanding Log Entries

| Type | Color | Meaning |
|------|-------|---------|
| **event** | 🔵 Blue | Autodarts event received |
| **module** | 🟣 Purple | Module activity |
| **system** | ⚪ Gray | System message |

### Useful For

- **Debugging**: Check if events are arriving
- **WLED Test**: See if commands are being sent
- **Troubleshooting**: Identify errors

---

## Settings

Here you can change the hub configuration.

### Open Settings

Click **Settings** in the sidebar:

![Settings](../images/13-settings.png)

### Available Settings

| Setting | Description |
|---------|-------------|
| **Server Port** | Port on which the hub runs (Default: 3000) |
| **Autodarts Credentials** | Change email/password |
| **Board** | Select a different board |
| **Language** | Choose interface language (EN, DE, ES) |

> ⚠️ **Note**: After changes, the server may need to be restarted.

---

## Installing New Modules

You can install additional modules from Git repositories.

### Open Module Installation

1. Go to **Modules**
2. Click **Install Module**

![Module Installation](../images/14-module-install.png)

### Install from Git

1. Select **Git Repository**
2. Enter the Git URL, e.g.:
   ```
   https://github.com/user/autodarts-module.git
   ```
3. Optional: Enter a branch (Default: main)
4. Click **Install**

### Install Local Module

1. Select **Local Path**
2. Enter the path to the module folder
3. Click **Install**

---

## FAQ

### ❓ Does the hub need to run all the time?

Yes, the hub needs to run for events to be processed. It's best to set it up for auto-start.

### ❓ Can I use multiple boards?

No, one hub is always assigned to one board. For multiple boards, you need multiple hub instances.

### ❓ Is my data uploaded anywhere?

No! All data stays locally on your computer. Only connections to Autodarts and your own devices (e.g. WLED) are made.

### ❓ Can I open the display on a tablet?

Yes! Simply open the display URL in the tablet's browser. The tablet must be on the same network.

### ❓ My LEDs aren't responding - what to do?

1. Check the IP address of your WLED controller
2. Test the connection: Open `http://WLED-IP/json/state` in browser
3. Check the log if events are arriving
4. Make sure the WLED module is started

### ❓ The display shows "Waiting for game..."

This is normal! The display updates automatically as soon as a game starts in Autodarts.

### ❓ The display shows wrong data at game start?

The display should automatically fetch full match data via API. Check the browser console for "Match started, fetching full match data...".

### ❓ Voice announcements aren't working?

1. For Browser TTS: Keep a browser tab open
2. For Audio Packs: Check if files exist
3. Check the volume settings
4. Check the browser console for errors

---

## Troubleshooting

### Server Won't Start

```
Error: EADDRINUSE :::3000
```

**Solution**: Port 3000 is occupied. Change the port in settings or stop the other program.

### No Connection to Autodarts

1. Check your credentials
2. Check your internet connection
3. Try logging in on autodarts.io

### WLED Not Responding

1. Check the IP address
2. Ping the controller: `ping 192.168.1.100`
3. Open WLED directly in browser
4. Check the logs in the hub

### WLED Color Not Showing in Single-Player Mode

1. Make sure `player.change` has an action with **Use Player Color** enabled
2. This action is also used for single-player games
3. Check the console logs for 🎨 WLED messages

### Display Won't Load

1. Check if the hub is running
2. Check the URL (must be `/module-ui/game-display/`)
3. Clear browser cache
4. Try a different browser

### Player Colors Not Working

1. Check if player profiles are created
2. The name must exactly match Autodarts (or be an alias)
3. Restart the module

### Voice Pack Generator Not Working

1. Check your ElevenLabs API key
2. Check your character quota at ElevenLabs
3. Make sure you have an internet connection
4. Check the server logs for errors

---

## Help & Support

- **Check Logs**: Most problems are visible in the logs
- **GitHub Issues**: Report bugs or ask questions
- **Community**: Connect with other users

---

*Enjoy your IO-Darts-Agent! 🎯*
