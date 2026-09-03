# Windows Setup Guide for Antigravity Remote Debugging

To allow `antigravity-auto-accept` to connect to Antigravity via Chrome DevTools Protocol (CDP), Antigravity must expose a remote debugging port (default: `9333`).

---

### Option 1: Modify Desktop / Start Menu Shortcut (Recommended)

1. Find the **Google Antigravity** icon on your Desktop or Start Menu.
2. **Right-click** the shortcut and select **Properties**.
3. In the **Shortcut** tab, locate the **Target** field.
4. Go to the end of the text in **Target**, add a space, and append:
   ```text
   --remote-debugging-port=9333
   ```
   *Example Target field:*
   ```text
   "C:\Users\<YourUser>\AppData\Local\Programs\Antigravity\Antigravity.exe" --remote-debugging-port=9333
   ```
5. Click **Apply** and **OK**.
6. Whenever you launch Antigravity from this shortcut, the CDP port will be open!

---

### Option 2: Use the Included Batch / PowerShell Launcher

Run the batch launcher:
```cmd
launchers\windows\antigravity-debug.bat
```

Or run PowerShell:
```powershell
powershell -ExecutionPolicy Bypass -File .\launchers\windows\antigravity-debug.ps1
```

---

### Option 3: Command Line / Terminal

In PowerShell:
```powershell
Start-Process "Antigravity.exe" -ArgumentList "--remote-debugging-port=9333"
```

In Command Prompt:
```cmd
antigravity --remote-debugging-port=9333
```
