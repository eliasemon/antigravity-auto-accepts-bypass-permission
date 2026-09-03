# Antigravity Auto-Accept 🚀

> Cross-platform (Windows / macOS / Linux) automation tool that auto-accepts permission prompts in Google Antigravity (both standalone desktop app and VS Code-based IDE) via Chrome DevTools Protocol (CDP), backed by rigorous safety guardrails.

---

## Key Features

- **Cross-Platform Compatibility**: Works identically on Windows, macOS, and Linux using modern Node.js.
- **CDP Webview Connection**: Connects to Antigravity's isolated Chromium webview via Chrome DevTools Protocol (default port `9333` or dynamic auto-discovery).
- **Resilient DOM Detection**: Detects prompts by matching visible button intent (`Accept`, `Allow`, `Run`, `Approve`, `Proceed`) instead of brittle, version-dependent CSS class names or internal IDs.
- **Full Shadow DOM & Iframe Traversal**: Recursively inspects standard DOM, nested Shadow DOMs, and VS Code child iframes.
- **Strict Safety Guardrails**: Inspects the pending command, diff, or action. Automatically blocks destructive commands (`rm -rf`, `sudo`, `curl | bash`, `git push --force`, `DROP TABLE`, credential access) and surfaces desktop notifications.
- **Per-Element Cooldown**: Context-aware SHA-256 hash tracking prevents double-clicking and avoids IDE lag.
- **Instant Toggle & Background Daemon**: Run as a foreground process with live key controls (`t`/`p` to pause/resume, `q` to quit) or as a background daemon with instant CLI IPC control (`antigravity-auto-accept toggle`, `status`, `stop`).
- **One-Command Doctor**: Diagnoses your Antigravity installation, checks remote debugging flags, and provides setup instructions per operating system.

---

## Architecture Overview

```
 ┌─────────────────────────────────────────────────────────────┐
 │               Google Antigravity (Desktop / IDE)            │
 │           Chromium Webview (--remote-debugging-port)        │
 └──────────────────────────────┬──────────────────────────────┘
                                │ Chrome DevTools Protocol (CDP)
                                ▼
 ┌─────────────────────────────────────────────────────────────┐
 │                Antigravity Auto-Accept Tool                 │
 │                                                             │
 │  ┌─────────────────────────┐   ┌─────────────────────────┐  │
 │  │ Target & Port Discovery │   │ In-Page Prompt Detector │  │
 │  │ (9333 / Dynamic Port)   │   │ (DOM / Shadow / Iframe) │  │
 │  └─────────────────────────┘   └────────────┬────────────┘  │
 │                                             │               │
 │                                             ▼               │
 │                                ┌─────────────────────────┐  │
 │                                │ Safety Guardrail Engine │  │
 │                                └────────────┬────────────┘  │
 │                        Safe Prompt?         │ Dangerous?    │
 │                     ┌───────────────────────┴────────────┐  │
 │                     ▼                                    ▼  │
 │        ┌─────────────────────────┐          ┌────────────┴──┐
 │        │ Synthetic Click &       │          │ Block & Alert │
 │        │ Cooldown Tracker (Hash) │          │ User Review   │
 │        └─────────────────────────┘          └───────────────┘
 └──────────────────────────────▲──────────────────────────────┘
                                │ Local IPC (Status / Toggle / Stop)
 ┌──────────────────────────────┴──────────────────────────────┐
 │             CLI: antigravity-auto-accept                    │
 └─────────────────────────────────────────────────────────────┘
```

---

## Quickstart

### Prerequisites
- Node.js 18.0.0 or higher (`node -v`)
- Google Antigravity installed

### Installation

Clone the repository and install dependencies:
```bash
git clone https://github.com/your-org/antigravity-auto-accept.git
cd antigravity-auto-accept
npm install
```

Optionally link globally:
```bash
npm link
```
Now `antigravity-auto-accept` is available anywhere in your terminal.

---

## Usage

### 1. Check Antigravity Environment
Run the diagnostic doctor to inspect running processes and active ports:
```bash
antigravity-auto-accept doctor
```

### 2. Run in Foreground (Recommended for Interactive Use)
Starts the listener in your terminal with live logs and instant keyboard controls:
```bash
antigravity-auto-accept run
```
*Keyboard shortcuts while running:*
- Press `t`, `p`, or `Space`: Toggle Pause / Resume.
- Press `q` or `Ctrl+C`: Stop and exit.

### 3. Run as a Background Daemon
Start in the background:
```bash
antigravity-auto-accept start
```

Check status, active target, and accepted prompt counts:
```bash
antigravity-auto-accept status
```

Instantly pause or resume auto-accepting:
```bash
antigravity-auto-accept toggle
```

Stop the daemon:
```bash
antigravity-auto-accept stop
```

---

## Remote Debugging Port Setup per OS

Antigravity must be launched with remote debugging enabled (default port `9333`).

### 🍎 macOS Setup

#### Method A: Wrapper Script (Recommended)
```bash
./launchers/macos/antigravity-debug.sh
```

#### Method B: Shell Alias
Add to `~/.zshrc`:
```bash
alias antigravity-debug='open -a "Google Antigravity" --args --remote-debugging-port=9333'
```
Reload shell: `source ~/.zshrc` and run `antigravity-debug`.

#### Method C: Command Line
```bash
open -a "Google Antigravity" --args --remote-debugging-port=9333
```
Or for the VS Code-based IDE:
```bash
antigravity --remote-debugging-port=9333
```

---

### 🪟 Windows Setup

#### Method A: Desktop / Start Menu Shortcut (Recommended)
1. Right-click your **Google Antigravity** desktop icon and choose **Properties**.
2. In the **Target** field, append ` --remote-debugging-port=9333`.
   *Example:*
   ```text
   "C:\Users\username\AppData\Local\Programs\Antigravity\Antigravity.exe" --remote-debugging-port=9333
   ```
3. Click **Apply** and launch via the shortcut.

#### Method B: Batch / PowerShell Launcher
```cmd
launchers\windows\antigravity-debug.bat
```
Or PowerShell:
```powershell
powershell -ExecutionPolicy Bypass -File .\launchers\windows\antigravity-debug.ps1
```

---

### 🐧 Linux Setup

#### Method A: Desktop Entry (Application Menu)
```bash
cp launchers/linux/antigravity-debug.desktop ~/.local/share/applications/
update-desktop-database ~/.local/share/applications/ 2>/dev/null || true
```

#### Method B: Shell Alias
Add to `~/.bashrc`:
```bash
alias antigravity-debug='antigravity --remote-debugging-port=9333'
```

#### Method C: Wrapper Script
```bash
./launchers/linux/antigravity-debug.sh
```

---

## Safety Guardrails

Security is a primary requirement. Before dispatching any synthetic click, the safety engine extracts and analyzes the surrounding prompt text, command snippet, and diff preview against configurable blacklist rules:

| Category | Blocked Patterns |
| :--- | :--- |
| **Destructive Deletions** | `rm -rf`, `rm -fr`, `rmdir /s`, `del /f /s` |
| **Privilege Escalations** | `sudo`, `doas`, `runas`, `pkexec`, `Set-ExecutionPolicy Unrestricted` |
| **Remote Code Execution** | `curl ... \| bash`, `wget ... \| sh`, `Invoke-WebRequest ... \| powershell` |
| **Destructive Git** | `git push --force`, `git push -f`, `git reset --hard`, `git clean -fdx` |
| **Database Drops** | `DROP DATABASE`, `DROP TABLE`, `DROP SCHEMA`, `TRUNCATE TABLE` |
| **Sensitive Secrets** | `.env`, `.env.*`, `id_rsa`, `id_ed25519`, `authorized_keys`, `.pem`, `.key`, `AWS_SECRET_ACCESS_KEY`, `credentials.json` |
| **Disk & Firmware** | `dd if=`, `mkfs`, `format C:`, write to `/dev/sd*`, fork bombs |
| **System Root Paths** | `/etc/`, `/boot/`, `/sys/`, `C:\Windows\`, `~/.bashrc`, `~/.zshrc` |

When a blocked pattern is detected:
1. Auto-accept is **immediately inhibited** for that prompt.
2. An alert is printed to the terminal / daemon log with the matching snippet.
3. A native desktop notification is dispatched to prompt manual human review.

---

## Configuration

Configuration is stored in `~/.config/antigravity-auto-accept/config.json` (or `%APPDATA%/antigravity-auto-accept/config.json` on Windows).

To view the active configuration:
```bash
antigravity-auto-accept config show
```

To initialize a default configuration file:
```bash
antigravity-auto-accept config init
```

To see the configuration file path:
```bash
antigravity-auto-accept config path
```

### Example `config.json`:
```json
{
  "cdp": {
    "host": "127.0.0.1",
    "port": 9333,
    "pollIntervalMs": 500,
    "reconnectDelayMs": 2000
  },
  "cooldown": {
    "elementCooldownMs": 5000
  },
  "buttons": {
    "acceptLabels": [
      "Accept",
      "Always Allow",
      "Allow",
      "Run",
      "Run Command",
      "Approve",
      "Execute",
      "Proceed",
      "Confirm",
      "Yes",
      "Keep",
      "Apply"
    ],
    "rejectLabels": [
      "Reject",
      "Cancel",
      "Deny",
      "Skip",
      "Dismiss",
      "No"
    ]
  },
  "safety": {
    "enabled": true,
    "notifyOnBlock": true,
    "blacklist": [
      {
        "id": "destructive-rm",
        "description": "Recursive or forced file deletion",
        "pattern": "\\b(?:rm\\s+-[a-zA-Z0-9]*[rf]|rmdir\\s+/[sq]|del\\s+/[fqs])\\b",
        "flags": "i"
      }
    ]
  }
}
```

---

## Verification & Tests

Run the full automated test suite (75 tests):
```bash
npm test
```

Coverage includes:
- **`tests/safety.test.js`**: Unit tests verifying benign command acceptance and blocking of all dangerous command categories.
- **`tests/config.test.js`**: Deep merging, default configurations, and custom config file parsing.
- **`tests/detector.test.js`**: Hash generation, button filtering, and DOM script generation.
- **`tests/integration.test.js`**: Mock CDP HTTP + WebSocket server validating target connection, DOM evaluation, prompt acceptance, cooldown suppression, safety blocking, and IPC commands.
- **`tests/cli.test.js`**: CLI argument parsing, flags, help, version, doctor, and status subcommands.

---

## License

MIT
