import http from 'http';
import WebSocket from 'ws';
import fs from 'fs';

const portFile = '/Users/eliasemon/Library/Application Support/Antigravity/DevToolsActivePort';
const port = fs.readFileSync(portFile, 'utf8').trim().split('\n')[0];

http.get(`http://127.0.0.1:${port}/json/list`, (res) => {
  let body = '';
  res.on('data', (c) => (body += c));
  res.on('end', () => {
    const list = JSON.parse(body);
    const pageTarget = list.find((t) => t.type === 'page');
    const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);

    ws.on('open', () => {
      ws.send(JSON.stringify({ id: 1, method: 'Runtime.enable' }));

      const testScript = `(() => {
        // Remove any old buttons
        document.querySelectorAll("#antigravity-auto-accept-toggle-btn, #antigravity-ide-statusbar-btn").forEach(e => e.remove());

        let isEnabled = localStorage.getItem("antigravity_auto_accept_enabled") !== "false";
        let acceptedCount = parseInt(localStorage.getItem("antigravity_accepted_count") || "0", 10);

        function mountUI() {
          // 1. ANTIGRAVITY IDE: Bottom Status Bar
          const ideStatusBar = document.querySelector(".monaco-workbench .part.statusbar .right-items, .part.statusbar .items-container, #workbench\\\\.parts\\\\.statusbar, footer.statusbar");
          if (ideStatusBar) {
            if (document.getElementById("antigravity-ide-statusbar-btn")) return;
            const item = document.createElement("div");
            item.id = "antigravity-ide-statusbar-btn";
            item.className = "statusbar-item right";
            item.style.cssText = "display:inline-flex; align-items:center; height:100%; cursor:pointer; user-select:none; margin-left:4px;";
            
            const link = document.createElement("a");
            link.className = "statusbar-item-label";
            link.setAttribute("role", "button");
            link.setAttribute("tabindex", "0");
            link.style.cssText = "display:inline-flex; align-items:center; gap:4px; height:100%; padding:0 8px; font-size:11px; font-weight:600; cursor:pointer; text-decoration:none; transition:background 0.15s ease; border-radius:3px;";
            
            function renderIdeItem() {
              if (isEnabled) {
                link.innerHTML = '⚡ Auto-Accept: <span style="color:#4ade80">ON</span> <span style="opacity:0.75; font-size:10px">(' + acceptedCount + ')</span>';
                link.style.color = "#e4e4e7";
                link.title = "⚡ Antigravity Auto-Accept is ACTIVE\\n(Click to Pause)";
              } else {
                link.innerHTML = '⏸️ Auto-Accept: <span style="color:#a1a1aa">OFF</span>';
                link.style.color = "#71717a";
                link.title = "⏸️ Antigravity Auto-Accept is PAUSED\\n(Click to Enable)";
              }
            }
            
            item.addEventListener("mouseenter", () => { item.style.background = "rgba(255, 255, 255, 0.12)"; });
            item.addEventListener("mouseleave", () => { item.style.background = "transparent"; });
            item.addEventListener("click", (e) => {
              e.preventDefault();
              e.stopPropagation();
              isEnabled = !isEnabled;
              localStorage.setItem("antigravity_auto_accept_enabled", isEnabled.toString());
              renderIdeItem();
              console.log("[Antigravity IDE] Auto-Accept toggled:", isEnabled ? "ON" : "OFF");
            });
            
            renderIdeItem();
            item.appendChild(link);
            ideStatusBar.appendChild(item);
            return { mounted: "ide-statusbar" };
          }

          // 2. ANTIGRAVITY DESKTOP APP: Top Status Bar beside three-dot menu (titlebar-more-actions)
          const moreBtn = document.querySelector('[data-testid="titlebar-more-actions"]');
          if (moreBtn && moreBtn.parentElement) {
            if (document.getElementById("antigravity-auto-accept-toggle-btn")) return;
            const btn = document.createElement("button");
            btn.id = "antigravity-auto-accept-toggle-btn";
            btn.type = "button";
            btn.style.cssText = [
              "display: inline-flex",
              "align-items: center",
              "gap: 5px",
              "height: 24px",
              "padding: 0 10px",
              "border-radius: 6px",
              "font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
              "font-size: 11px",
              "font-weight: 600",
              "cursor: pointer",
              "border: 1px solid",
              "user-select: none",
              "-webkit-user-select: none",
              "margin-right: 4px",
              "transition: all 0.15s ease"
            ].join("; ");

            function renderDesktopBtn() {
              if (isEnabled) {
                btn.innerHTML = '⚡ Auto-Accept: ON <span style="opacity:0.75; font-size:10px; font-weight:normal">(' + acceptedCount + ')</span>';
                btn.style.background = "#052e16";
                btn.style.color = "#4ade80";
                btn.style.borderColor = "#16a34a";
                btn.title = "⚡ Antigravity Auto-Accept is ACTIVE\\n(Click to Pause)";
              } else {
                btn.innerHTML = "⏸️ Auto-Accept: OFF";
                btn.style.background = "#27272a";
                btn.style.color = "#a1a1aa";
                btn.style.borderColor = "#3f3f46";
                btn.title = "⏸️ Antigravity Auto-Accept is PAUSED\\n(Click to Enable)";
              }
            }

            btn.addEventListener("click", (e) => {
              e.preventDefault();
              e.stopPropagation();
              isEnabled = !isEnabled;
              localStorage.setItem("antigravity_auto_accept_enabled", isEnabled.toString());
              renderDesktopBtn();
              console.log("[Antigravity Desktop] Auto-Accept toggled:", isEnabled ? "ON" : "OFF");
            });

            renderDesktopBtn();
            moreBtn.parentElement.insertBefore(btn, moreBtn);
            return { mounted: "desktop-titlebar" };
          }

          return { mounted: "none" };
        }

        return mountUI();
      })()`;

      setTimeout(() => {
        ws.send(JSON.stringify({
          id: 2,
          method: 'Runtime.evaluate',
          params: { expression: testScript, returnByValue: true }
        }));
      }, 100);
    });

    ws.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.id === 2) {
        console.log('Mount Test Result:', JSON.stringify(msg.result?.result?.value, null, 2));
        process.exit(0);
      }
    });
  });
});
