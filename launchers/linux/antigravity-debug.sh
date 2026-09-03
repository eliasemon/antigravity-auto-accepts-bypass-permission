#!/usr/bin/env bash
# Linux Launcher for Google Antigravity with Remote Debugging Port Enabled

PORT="${1:-9333}"

echo "🚀 Launching Antigravity with --remote-debugging-port=${PORT}..."

if command -v antigravity >/dev/null 2>&1; then
    antigravity --remote-debugging-port="${PORT}" "$@" &
elif [ -f "/opt/Antigravity/antigravity" ]; then
    /opt/Antigravity/antigravity --remote-debugging-port="${PORT}" "$@" &
elif [ -f "/usr/share/antigravity/antigravity" ]; then
    /usr/share/antigravity/antigravity --remote-debugging-port="${PORT}" "$@" &
else
    echo "⚠️  'antigravity' binary not found in standard system locations."
    echo "Trying 'google-antigravity'..."
    google-antigravity --remote-debugging-port="${PORT}" "$@" &
fi

echo "✅ Launched Antigravity with debug port ${PORT}."
