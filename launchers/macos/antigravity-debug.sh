#!/usr/bin/env bash
# macOS Launcher for Google Antigravity with CDP Remote Debugging Enabled

PORT="${1:-9333}"

echo "🚀 Launching Google Antigravity with --remote-debugging-port=${PORT}..."

# Check common application paths
if [ -d "/Applications/Google Antigravity.app" ]; then
    open -a "Google Antigravity" -n --args --remote-debugging-port="${PORT}"
elif [ -d "/Applications/Antigravity.app" ]; then
    open -a "Antigravity" -n --args --remote-debugging-port="${PORT}"
elif command -v antigravity >/dev/null 2>&1; then
    antigravity --remote-debugging-port="${PORT}" &
else
    echo "⚠️  Google Antigravity app not found in /Applications."
    echo "Attempting to launch via 'open -a \"Google Antigravity\"'..."
    open -a "Google Antigravity" -n --args --remote-debugging-port="${PORT}" 2>/dev/null || {
        echo "❌ Could not locate Antigravity installation."
        exit 1
    }
fi

echo "✅ Launched with CDP port ${PORT}."
