# macOS Setup Guide for Antigravity Remote Debugging

To allow `antigravity-auto-accept` to connect to Antigravity via Chrome DevTools Protocol (CDP), Antigravity must expose a remote debugging port (default: `9333`).

---

### Option 1: Use the Provided Wrapper Script (Recommended)

Run the included wrapper script:
```bash
./launchers/macos/antigravity-debug.sh
```
Or specify a custom port:
```bash
./launchers/macos/antigravity-debug.sh 9333
```

---

### Option 2: Add a Shell Alias

Add the following to your `~/.zshrc` (or `~/.bash_profile`):

```bash
alias antigravity-debug='open -a "Google Antigravity" --args --remote-debugging-port=9333'
```

Then reload your shell:
```bash
source ~/.zshrc
```

Now you can launch Antigravity anytime with:
```bash
antigravity-debug
```

---

### Option 3: VS Code / CLI Launch

If you use the Antigravity command-line launcher (VS Code fork):
```bash
antigravity --remote-debugging-port=9333
```

---

### Option 4: Create a macOS Automator App

If you want a clickable icon in your Dock or Applications folder:
1. Open **Automator** on macOS.
2. Select **New Document** -> **Application**.
3. In the search bar, type `Run Shell Script` and drag it into the workflow panel.
4. Set the script content to:
   ```bash
   open -a "Google Antigravity" -n --args --remote-debugging-port=9333
   ```
5. File -> **Save...** -> Save as `Antigravity Debug.app` inside `/Applications`.
