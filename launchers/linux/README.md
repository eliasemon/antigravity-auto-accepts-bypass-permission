# Linux Setup Guide for Antigravity Remote Debugging

To allow `antigravity-auto-accept` to connect to Antigravity via Chrome DevTools Protocol (CDP), Antigravity must expose a remote debugging port (default: `9333`).

---

### Option 1: Install Desktop Entry (Application Menu / App Launcher)

Copy the provided `.desktop` launcher to your local user applications directory:

```bash
mkdir -p ~/.local/share/applications
cp launchers/linux/antigravity-debug.desktop ~/.local/share/applications/
update-desktop-database ~/.local/share/applications/ 2>/dev/null || true
```

Now you can launch "Google Antigravity (Debug CDP)" directly from GNOME, KDE, or your desktop application launcher.

---

### Option 2: Add a Shell Alias

Add to your `~/.bashrc` or `~/.zshrc`:

```bash
alias antigravity-debug='antigravity --remote-debugging-port=9333'
```

Then reload:
```bash
source ~/.bashrc
```

---

### Option 3: Use the Included Shell Wrapper

```bash
./launchers/linux/antigravity-debug.sh
```
Or specify a custom port:
```bash
./launchers/linux/antigravity-debug.sh 9333
```
