# Antigravity Auto-Accept & Permission Bypass ⚡

> **The ultimate automation & permission bypass engine for Google Antigravity (Desktop App & VS Code IDE).**  
> Auto-accepts all terminal commands, approval cards, and question modals with sub-25ms latency. Features an in-app draggable ON/OFF toggle badge, direct React Fiber execution, and a strict 4-keyword safety filter for manual review (`sudo`, `rm`, `-rf`, `drop`).

---

## 🌟 Key Highlights

- **⚡ Seamless Status Bar Placement**:
  - **Antigravity Desktop App**: Placed in the **top status bar**, positioned directly beside the three-dot menu (`titlebar-more-actions`) on the right side.
  - **Antigravity IDE**: Placed in the **bottom status bar** (VS Code status bar), right alongside language and git indicators.
  - Single click toggles between active (`⚡ Auto-Accept: ON`) and paused (`⏸️ Auto-Accept: OFF`). Remembers state in `localStorage`.
- **🎯 100% Precise Auto-Acceptance (Zero Misclicks)**: Targets internal Antigravity component test IDs directly (`run-command-step`, `interaction-continue-button`, `declared-permissions-confirm`, `running-items-panel`). Explicitly ignores settings modals, dropdown menus, sidebars, and file trees.
- **🛡️ Strict 4-Keyword Safety Guardrail**: Leaves prompts untouched for manual review **strictly** when the command contains:
  1. `sudo` (privilege escalation)
  2. `rm` (file deletions, `rm`, `rmdir`, `del`, `Remove-Item`)
  3. `-rf` (recursive force flags, `-rf`, `-fr`)
  4. `drop` (database destruction, `DROP TABLE`, `DROP DATABASE`, `drop`)
  *Every other terminal command, build script, test, or tool prompt is auto-accepted!*
- **🚀 Two Modes of Operation**:
  - **Mode 1: Permanent Native Core Patch (Recommended)**: Patches `/Applications/Antigravity.app` (`app.asar`) or IDE in one click—no background process required!
  - **Mode 2: External CDP Daemon**: Connects dynamically over Chrome DevTools Protocol (`--remote-debugging-port`) without touching core files.
- **⚡ Direct React Fiber Invocation**: Dispatches synthetic `PointerEvent` + `MouseEvent` and directly invokes React Fiber's `__reactProps$*.onClick` handler, guaranteeing zero dropped clicks.
- **🖥️ Cross-Platform Support**: Built with Node.js 18+ to support macOS, Windows, and Linux.

---

## 📐 Architecture Overview

```
 ┌─────────────────────────────────────────────────────────────────────────────┐
 │                         Google Antigravity Runtime                          │
 │                                                                             │
 │  ┌───────────────────────────────────────────────────────────────────────┐  │
 │  │                         In-App Chat Interface                         │  │
 │  │                                                                       │  │
 │  │   ┌────────────────────────────────────────────────────────────────┐  │  │
 │  │   │ [data-testid="run-command-step"] (Terminal Command Prompts)    │  │  │
 │  │   │ [data-testid="interaction-continue-button"] (Questions)       │  │  │
 │  │   │ [data-testid="declared-permissions-confirm"] (Permissions)    │  │  │
 │  │   │ [data-testid="running-items-panel"] (Action Cards)             │  │  │
 │  │   └───────────────────────────────┬────────────────────────────────┘  │  │
 │  │                                   │                                   │  │
 │  │   ┌───────────────────────────────▼────────────────────────────────┐  │  │
 │  │   │      ⚡ In-App Draggable ON/OFF Badge (Above Chatbox)          │  │  │
 │  │   │      Click to toggle • Drag to reposition • State in storage   │  │  │
 │  │   └───────────────────────────────┬────────────────────────────────┘  │  │
 │  └───────────────────────────────────┼───────────────────────────────────┘  │
 └──────────────────────────────────────┼──────────────────────────────────────┘
                                        │
                         ┌──────────────▼──────────────┐
                         │   Safety Guardrail Filter   │
                         │   (sudo, rm, -rf, drop)     │
                         └──────┬──────────────┬───────┘
                                │              │
                   Blocked ⚠️   │              │ Safe ⚡
                                ▼              ▼
                    ┌─────────────────┐   ┌─────────────────────────┐
                    │  Leave Untouched│   │ Direct React Fiber      │
                    │  Manual Review  │   │ onClick + PointerEvent  │
                    └─────────────────┘   └─────────────────────────┘
```

---

## 🚀 Quickstart

### Prerequisites
- **Node.js 18.0.0 or higher** (`node -v`)
- **Google Antigravity** desktop app or **Antigravity IDE**

### Installation

Clone the repository and install dependencies:
```bash
git clone https://github.com/eliasemon/antigravity-auto-accepts-bypass-permission.git
cd antigravity-auto-accepts-bypass-permission
npm install
npm link
```
*Note: `npm link` allows running the `antigravity-auto-accept` CLI command from anywhere in your terminal.*

---

## 🛠️ Usage

You can use this tool in two distinct ways:

### Approach A: Native Core Patch (Recommended 🌟)
Directly injects the auto-accept engine and draggable toggle button into the Antigravity desktop application (`app.asar`) and Antigravity IDE (`jetskiAgent.js`).

1. **Patch Antigravity**:
   ```bash
   antigravity-auto-accept patch-core
   ```
2. **Restart Antigravity**:
   Close and relaunch Antigravity.
3. **Enjoy Zero-Friction Coding**:
   - In **Antigravity Desktop**: You will see the **`⚡ Auto-Accept: ON`** button in the **top status bar** right beside the three-dot menu on the right.
   - In **Antigravity IDE**: You will see the **`⚡ Auto-Accept: ON`** indicator in the **bottom status bar**.
   - All terminal commands, permissions, and question modals are accepted automatically.
   - Click the button to pause anytime (`⏸️ Auto-Accept: OFF`).

To remove the patch and restore original application files:
```bash
antigravity-auto-accept unpatch-core
```

---

### Approach B: External CDP Daemon (No App Modifications)
If you prefer not to modify application files, you can run the tool as an external background daemon connecting via Chrome DevTools Protocol (CDP).

1. **Check Environment**:
   ```bash
   antigravity-auto-accept doctor
   ```
2. **Run in Foreground**:
   ```bash
   antigravity-auto-accept run
   ```
   *Controls while running:*
   - `t` or `Space`: Toggle Pause / Resume
   - `q` or `Ctrl+C`: Quit
3. **Or Run as a Background Daemon**:
   ```bash
   antigravity-auto-accept start     # Start daemon in background
   antigravity-auto-accept status    # Check daemon status
   antigravity-auto-accept toggle    # Toggle pause / resume via CLI
   antigravity-auto-accept stop      # Stop background daemon
   ```

---

## 🛡️ Safety Guardrails (Strict Filter)

The engine enforces a strict blacklist. Any action or terminal command matching the following patterns will **NEVER** be auto-accepted and will be left untouched for your manual approval:

| Keyword | Pattern | Examples Blocked |
| :--- | :--- | :--- |
| **`sudo`** | `\bsudo\b` | `sudo apt-get update`, `sudo whoami` |
| **`rm`** | `\b(?:rm\|rmdir\|del\|Remove-Item)\b` | `rm file.txt`, `rmdir old_dir`, `del test.log` |
| **`-rf`** | `-[a-z0-9]*r[a-z0-9]*f\|-[a-z0-9]*f[a-z0-9]*r\|-rf\|-fr` | `rm -rf /`, `git clean -rf`, `rm -fr dir` |
| **`drop`** | `\bdrop\b` | `DROP TABLE users;`, `drop database prod;` |

### Everything Else is Auto-Accepted:
- `git` commands (`commit`, `push`, `pull`, `checkout`, `status`, `diff`)
- `npm` / `pnpm` / `yarn` / `bun` commands (`test`, `run build`, `install`)
- `node`, `python`, `cargo`, `docker`, `go`, `make`
- File operations: `cat`, `touch`, `mkdir`, `cp`, `mv`, `ls`, `grep`
- Network commands: `curl`, `wget`, `ping`
- Multi-choice question prompts (`ask_question`)
- Tool permissions confirmation dialogs

---

## 🧪 Test Prompts

Copy and paste these into your Antigravity chat to verify functionality:

### 1. Commands That Are Auto-Accepted Instantly ⚡
```text
Run this terminal command: git status
```
```text
Run this terminal command: node -v && npm -v
```
```text
Run this terminal command: echo "Hello from Auto-Accept!"
```
*Expected result:* The `Run` button is detected and clicked in **under 25ms**. The counter on the badge increments.

### 2. Commands Left for Manual Review ⚠️
```text
Run this terminal command: sudo whoami
```
```text
Run this terminal command: rm ./dummy_file.txt
```
```text
Run this terminal command: git clean -rf
```
```text
Run this terminal command: sqlite3 test.db "DROP TABLE sample;"
```
*Expected result:* The `Run` button remains unclicked on screen waiting for you to manually inspect and click it.

### 3. Testing the In-App Toggle Button
1. Click the floating **`⚡ Auto-Accept: ON`** badge above your chatbox.
2. It changes to **`⏸️ Auto-Accept: OFF`**.
3. Send: `Run this terminal command: pwd`
4. The button stays unclicked because auto-accept is paused.
5. Click the badge again to turn it back to **`⚡ Auto-Accept: ON`**. The pending command executes immediately!

---

## 📁 Repository Structure

```
antigravity-auto-accept/
├── bin/
│   └── antigravity-auto-accept.js     # CLI executable entrypoint
├── src/
│   ├── cli.js                         # CLI commands & argument parser
│   ├── cdp.js                         # WebSocket CDP client & connection manager
│   ├── config.js                      # Configuration loader & defaults
│   ├── core-patcher.js                # Core app patcher (app.asar & jetskiAgent.js)
│   ├── daemon.js                      # Foreground / background daemon runner
│   ├── detector.js                    # In-page DOM scanner & synthetic clicker
│   └── safety.js                      # Safety guardrail engine
├── scripts/
│   ├── inject-precise-engine.js       # Live CDP injector script
│   └── test-chatbox-popup.js          # Live test runner
├── tests/
│   ├── cli.test.js                    # CLI unit tests
│   ├── config.test.js                 # Configuration tests
│   ├── core-patcher.test.js           # Core patcher tests
│   ├── detector.test.js               # In-page detector tests
│   ├── integration.test.js            # Mock CDP integration tests
│   └── safety.test.js                 # Safety blacklist test suite
└── package.json
```

---

## 🧪 Automated Testing

Run the comprehensive test suite (all 56 unit and integration tests):
```bash
npm test
```

---

## 🤝 Contributing

Contributions, bug reports, and feature requests are welcome!
1. Fork the repository
2. Create your branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m "feat: add amazing feature"`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

Distributed under the [MIT License](LICENSE).
