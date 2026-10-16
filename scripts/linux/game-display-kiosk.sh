#!/bin/sh
# Opens the IO-Darts-Agent game display full screen after desktop login.
# Install: cp game-display-kiosk.sh ~/.local/bin/ && chmod +x ~/.local/bin/game-display-kiosk.sh
URL="${GAME_DISPLAY_URL:-http://localhost:3000/module-ui/game-display/}"
PROFILE="$HOME/.local/share/game-display-kiosk"
# Firefox refuses a --profile folder that does not exist ("profile cannot be loaded")
mkdir -p "$PROFILE"

# Keep the screen on (X11; the xfconf calls only matter on Xfce)
xset s off -dpms s noblank 2>/dev/null
xfconf-query -c xfce4-power-manager -p /xfce4-power-manager/presentation-mode -n -t bool -s true 2>/dev/null
xfconf-query -c xfce4-screensaver -p /saver/enabled -n -t bool -s false 2>/dev/null

# Wait until the hub serves the display
until curl -sf "$URL" >/dev/null; do sleep 2; done

exec firefox --kiosk --no-remote --profile "$PROFILE" "$URL"
