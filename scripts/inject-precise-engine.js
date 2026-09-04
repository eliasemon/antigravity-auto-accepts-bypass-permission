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

      const preciseEngineCode = `(() => {
        // Clean up any previous buttons
        document.querySelectorAll("#antigravity-auto-accept-toggle-btn, .ag-auto-accept-btn").forEach(e => e.remove());

        let isEnabled = localStorage.getItem("antigravity_auto_accept_enabled") !== "false";
        let acceptedCount = parseInt(localStorage.getItem("antigravity_accepted_count") || "0", 10);

        // Strict manual review filter: ONLY sudo, rm, -rf, drop
        function requiresManualReview(cmdText) {
          if (!cmdText || typeof cmdText !== "string") return false;
          const lower = cmdText.toLowerCase();
          if (/\\bsudo\\b/i.test(lower)) return "sudo";
          if (/\\b(?:rm|rmdir|del|remove-item)\\b/i.test(lower)) return "rm";
          if (/-[a-z0-9]*r[a-z0-9]*f\\b|-[a-z0-9]*f[a-z0-9]*r\\b/i.test(lower) || lower.includes("-rf") || lower.includes("-fr")) return "-rf";
          if (/\\bdrop\\b/i.test(lower)) return "drop";
          return false;
        }

        // --- DRAGGABLE & HIGH VISIBILITY FLOATING TOGGLE BUTTON ---
        const btn = document.createElement("div");
        btn.id = "antigravity-auto-accept-toggle-btn";
        btn.setAttribute("role", "button");
        btn.style.cssText = [
          "position: fixed",
          "bottom: 110px",
          "right: 32px",
          "z-index: 2147483647",
          "display: flex",
          "align-items: center",
          "gap: 8px",
          "padding: 8px 18px",
          "border-radius: 9999px",
          "font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          "font-size: 12px",
          "font-weight: 700",
          "letter-spacing: 0.3px",
          "cursor: pointer",
          "border: 1.5px solid",
          "box-shadow: 0 4px 18px rgba(0,0,0,0.35)",
          "transition: background 0.2s, border-color 0.2s, color 0.2s, box-shadow 0.2s",
          "user-select: none",
          "-webkit-user-select: none"
        ].join("; ");

        // Restore saved position if dragged
        const savedPos = localStorage.getItem("antigravity_btn_pos");
        if (savedPos) {
          try {
            const { x, y } = JSON.parse(savedPos);
            btn.style.bottom = "auto";
            btn.style.right = "auto";
            btn.style.left = x + "px";
            btn.style.top = y + "px";
          } catch(e) {}
        }

        function renderBtn() {
          if (isEnabled) {
            btn.innerHTML = '<span style="font-size:14px">⚡</span> <span>Auto-Accept: <b>ON</b></span> <span style="background:rgba(74,222,128,0.25); color:#4ade80; padding:1px 7px; border-radius:999px; font-size:10px; margin-left:2px">(' + acceptedCount + ')</span>';
            btn.style.background = "#052e16";
            btn.style.color = "#4ade80";
            btn.style.borderColor = "#22c55e";
            btn.style.boxShadow = "0 0 16px rgba(34, 197, 94, 0.4), 0 4px 12px rgba(0,0,0,0.3)";
            btn.title = "⚡ Auto-Accept is ACTIVE\\n- Auto-accepting all terminal commands & questions\\n- Manual review for: sudo, rm, -rf, drop\\n(Click to Pause, Drag to Move anywhere)";
          } else {
            btn.innerHTML = '<span style="font-size:14px">⏸️</span> <span>Auto-Accept: <b>OFF</b></span>';
            btn.style.background = "#27272a";
            btn.style.color = "#d4d4d8";
            btn.style.borderColor = "#52525b";
            btn.style.boxShadow = "0 4px 12px rgba(0,0,0,0.3)";
            btn.title = "⏸️ Auto-Accept is PAUSED\\n(Click to Enable, Drag to Move anywhere)";
          }
        }

        // Dragging support
        let isDragging = false;
        let startX, startY, origX, origY;

        btn.addEventListener("mousedown", (e) => {
          isDragging = false;
          startX = e.clientX;
          startY = e.clientY;
          const rect = btn.getBoundingClientRect();
          origX = rect.left;
          origY = rect.top;

          function onMouseMove(e) {
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;
            if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
              isDragging = true;
              btn.style.bottom = "auto";
              btn.style.right = "auto";
              btn.style.left = (origX + dx) + "px";
              btn.style.top = (origY + dy) + "px";
            }
          }

          function onMouseUp(e) {
            window.removeEventListener("mousemove", onMouseMove);
            window.removeEventListener("mouseup", onMouseUp);
            if (isDragging) {
              const rect = btn.getBoundingClientRect();
              localStorage.setItem("antigravity_btn_pos", JSON.stringify({ x: rect.left, y: rect.top }));
            } else {
              // Click toggle!
              isEnabled = !isEnabled;
              localStorage.setItem("antigravity_auto_accept_enabled", isEnabled.toString());
              renderBtn();
              if (isEnabled) runPreciseScanner();
            }
          }

          window.addEventListener("mousemove", onMouseMove);
          window.addEventListener("mouseup", onMouseUp);
        });

        renderBtn();
        document.body.appendChild(btn);

        // Click dispatcher
        function clickElement(el) {
          if (!el) return;
          try {
            const propsKey = Object.keys(el).find(k => k.startsWith("__reactProps"));
            if (propsKey && el[propsKey] && typeof el[propsKey].onClick === "function") {
              el[propsKey].onClick({ defaultPrevented: false, preventDefault: () => {}, stopPropagation: () => {} });
            }
          } catch (e) {}

          try {
            const rect = el.getBoundingClientRect();
            const cx = rect.x + rect.width / 2;
            const cy = rect.y + rect.height / 2;
            const init = { bubbles: true, cancelable: true, view: window, clientX: cx, clientY: cy, pointerId: 1, isPrimary: true, button: 0, buttons: 1 };
            if (window.PointerEvent) {
              el.dispatchEvent(new PointerEvent("pointerdown", init));
              el.dispatchEvent(new PointerEvent("pointerup", init));
            }
            el.dispatchEvent(new MouseEvent("mousedown", init));
            el.dispatchEvent(new MouseEvent("mouseup", init));
            el.dispatchEvent(new MouseEvent("click", init));
            if (typeof el.click === "function") el.click();
          } catch (e) {}
        }

        // PRECISE AUTO-ACCEPT SCANNER (ZERO MISCLICKS)
        function runPreciseScanner() {
          if (!isEnabled) return;
          if (!document.getElementById("antigravity-auto-accept-toggle-btn") && document.body) {
            document.body.appendChild(btn);
          }

          // TARGET 1: Questions Modal (ask_question tool)
          const continueBtn = document.querySelector("[data-testid=\\"interaction-continue-button\\"]");
          if (continueBtn && !continueBtn.disabled && !continueBtn.hasAttribute("data-ag-accepted")) {
            // Check if options are present to select the 1st option
            const options = document.querySelectorAll("input[type=\\"radio\\"], input[type=\\"checkbox\\"], [role=\\"radio\\"], [role=\\"checkbox\\"], [class*=\\"option\\"]");
            if (options.length > 0) {
              const firstOpt = options[0];
              if (!firstOpt.checked && firstOpt.getAttribute("aria-checked") !== "true") {
                clickElement(firstOpt);
              }
            }

            continueBtn.setAttribute("data-ag-accepted", Date.now().toString());
            clickElement(continueBtn);
            acceptedCount++;
            localStorage.setItem("antigravity_accepted_count", acceptedCount.toString());
            renderBtn();
            console.log("[Auto-Accept] ✅ Auto-accepted question modal");
          }

          // TARGET 2: Declared Permissions Modal
          const permConfirmBtn = document.querySelector("[data-testid=\\"declared-permissions-confirm\\"]");
          if (permConfirmBtn && !permConfirmBtn.disabled && !permConfirmBtn.hasAttribute("data-ag-accepted")) {
            permConfirmBtn.setAttribute("data-ag-accepted", Date.now().toString());
            clickElement(permConfirmBtn);
            acceptedCount++;
            localStorage.setItem("antigravity_accepted_count", acceptedCount.toString());
            renderBtn();
            console.log("[Auto-Accept] ✅ Auto-accepted declared permissions modal");
          }

          // TARGET 3: Terminal Command Steps (Run buttons in [data-testid="run-command-step"])
          const runSteps = document.querySelectorAll("[data-testid=\\"run-command-step\\"]");
          for (const step of runSteps) {
            const runBtn = step.querySelector("div[role=\\"button\\"], button");
            if (!runBtn || runBtn.hasAttribute("data-ag-accepted")) continue;

            const text = (runBtn.innerText || runBtn.textContent || "").trim();
            const lines = text.split(/\\r?\\n/).map(l => l.trim()).filter(Boolean);
            const firstWord = (lines[0] || "").toLowerCase();

            // Only pending "Run" actions
            if (firstWord !== "run" && !firstWord.startsWith("run")) continue;

            // Extract command text
            let cmdText = lines.slice(1).join("\\n");
            if (!cmdText) {
              const codeEl = step.querySelector("code, pre, .font-mono, [class*=\\"command\\"]");
              if (codeEl) cmdText = codeEl.textContent.trim();
              else cmdText = step.textContent.trim();
            }

            // Check strict manual review filter (sudo, rm, -rf, drop)
            const blockedReason = requiresManualReview(cmdText);
            if (blockedReason) {
              console.warn("[Auto-Accept] ⚠️ Terminal command left for manual review (" + blockedReason + "):", cmdText.slice(0, 60));
              runBtn.setAttribute("data-ag-accepted", "manual-review-" + blockedReason);
              continue;
            }

            // AUTO-ACCEPT TERMINAL COMMAND!
            runBtn.setAttribute("data-ag-accepted", "accepted-" + Date.now());
            clickElement(runBtn);
            acceptedCount++;
            localStorage.setItem("antigravity_accepted_count", acceptedCount.toString());
            renderBtn();
            console.log("[Auto-Accept] ✅ Auto-accepted terminal command:", cmdText.slice(0, 60));
          }

          // TARGET 4: Action / Approval Card in Running Items Panel
          const runningPanel = document.querySelector("[data-testid=\\"running-items-panel\\"]");
          if (runningPanel) {
            const actionBtns = runningPanel.querySelectorAll("button, div[role=\\"button\\"]");
            for (const b of actionBtns) {
              if (b.hasAttribute("data-ag-accepted") || b.disabled) continue;
              const bText = (b.innerText || b.textContent || "").trim().toLowerCase();
              if (bText === "run" || bText === "accept" || bText === "allow" || bText === "proceed" || bText === "approve") {
                const contextText = (runningPanel.innerText || "").trim();
                const blockedReason = requiresManualReview(contextText);
                if (blockedReason) {
                  b.setAttribute("data-ag-accepted", "manual-review-" + blockedReason);
                  continue;
                }
                b.setAttribute("data-ag-accepted", "accepted-" + Date.now());
                clickElement(b);
                acceptedCount++;
                localStorage.setItem("antigravity_accepted_count", acceptedCount.toString());
                renderBtn();
                console.log("[Auto-Accept] ✅ Auto-accepted running-items action button");
              }
            }
          }
        }

        runPreciseScanner();

        // High frequency observation: MutationObserver + 25ms timer
        const observer = new MutationObserver(() => runPreciseScanner());
        if (document.body) {
          observer.observe(document.body, { childList: true, subtree: true, attributes: true });
        }
        setInterval(runPreciseScanner, 25);

        return {
          success: true,
          acceptedCount,
          buttonFound: Boolean(document.getElementById("antigravity-auto-accept-toggle-btn")),
          buttonText: document.getElementById("antigravity-auto-accept-toggle-btn").innerText
        };
      })()`;

      setTimeout(() => {
        ws.send(JSON.stringify({
          id: 2,
          method: 'Runtime.evaluate',
          params: { expression: preciseEngineCode, returnByValue: true }
        }));
      }, 100);
    });

    ws.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.id === 2) {
        console.log('Precise Engine Live Result:', JSON.stringify(msg.result?.result?.value, null, 2));
        process.exit(0);
      }
    });
  });
});
