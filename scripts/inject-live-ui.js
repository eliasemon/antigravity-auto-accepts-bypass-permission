import http from 'http';
import WebSocket from 'ws';
import fs from 'fs';

const portFile = '/Users/eliasemon/Library/Application Support/Antigravity/DevToolsActivePort';
if (!fs.existsSync(portFile)) {
  console.error('Antigravity is not running or DevToolsActivePort not found.');
  process.exit(1);
}

const port = fs.readFileSync(portFile, 'utf8').trim().split('\n')[0];

http.get(`http://127.0.0.1:${port}/json/list`, (res) => {
  let body = '';
  res.on('data', (c) => (body += c));
  res.on('end', () => {
    const list = JSON.parse(body);
    const pageTarget = list.find((t) => t.type === 'page');
    if (!pageTarget) {
      console.error('No page target found');
      process.exit(1);
    }

    const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);

    ws.on('open', () => {
      console.log('Connected to Antigravity live window');

      const injectionScript = `
        (() => {
          // Prevent multiple installations
          if (window.__antigravityAutoAcceptUIInstalled) {
            console.log('[Antigravity Auto-Accept] Already installed, updating UI...');
            const existingBtn = document.getElementById('antigravity-auto-accept-toggle-btn');
            if (existingBtn) existingBtn.remove();
          }
          window.__antigravityAutoAcceptUIInstalled = true;

          // State: default to ON, persist in localStorage
          let isAutoAcceptEnabled = localStorage.getItem('antigravity_auto_accept_enabled') !== 'false';
          let acceptedCount = parseInt(localStorage.getItem('antigravity_accepted_count') || '0', 10);
          let blockedCount = parseInt(localStorage.getItem('antigravity_blocked_count') || '0', 10);

          // 1. Strict blacklist per user requirement:
          // ONLY: rm -rf, sudo, database drop table
          const STRICT_BLACKLIST = [
            // rm -rf and recursive forced deletions
            /\\b(?:rm\\s+[^\\n;|&]*(?:-[a-zA-Z0-9]*[rR][a-zA-Z0-9]*[fF]|-[a-zA-Z0-9]*[fF][a-zA-Z0-9]*[rR]|(?:--recursive\\s+[^\\n;|&]*--force|--force\\s+[^\\n;|&]*--recursive)|(?:-(?:[a-zA-Z0-9]*[rR][a-zA-Z0-9]*)\\s+[^\\n;|&]*-(?:[a-zA-Z0-9]*[fF][a-zA-Z0-9]*))|(?:-(?:[a-zA-Z0-9]*[fF][a-zA-Z0-9]*)\\s+[^\\n;|&]*-(?:[a-zA-Z0-9]*[rR][a-zA-Z0-9]*)))|rmdir\\s+.*[\\/\\\\][sq]|del\\s+.*[\\/\\\\][fqs]|Remove-Item\\s+.*(?:-Recurse\\s+.*-Force|-Force\\s+.*-Recurse))\\b/i,
            // sudo and privilege escalation
            /\\b(?:sudo|doas|runas|pkexec)\\b|(?:^|[;&|]\\s*)su(?:\\s+-[a-zA-Z0-9]*|\\s+[a-zA-Z0-9_]+)?\\b/i,
            // database drop table / truncate / drop database
            /\\b(?:DROP\\s+(?:DATABASE|SCHEMA|TABLE|VIEW|PROCEDURE)|TRUNCATE\\s+(?:TABLE\\s+)?)\\b/i,
          ];

          function isStrictlyDangerous(text) {
            if (!text || typeof text !== 'string') return false;
            for (const re of STRICT_BLACKLIST) {
              if (re.test(text)) return true;
            }
            return false;
          }

          const ACCEPT_LABELS = [
            'run', 'run command', 'accept', 'always allow', 'allow',
            'approve', 'execute', 'proceed', 'confirm', 'yes', 'keep', 'apply'
          ];
          const REJECT_LABELS = ['reject', 'cancel', 'deny', 'skip', 'dismiss', 'no', "don't allow"];

          function isInsideSidebar(el) {
            if (!el) return false;
            const excluded = [
              '.sidebar', 'aside', 'nav', '[role="navigation"]',
              '[data-testid*="sidebar"]', '[data-testid="conversation-row-sidebar"]',
              '[data-testid*="history"]', '[class*="sidebar"]', '[class*="conversation-list"]',
              '[class*="history-list"]', '.explorer-viewlet', '.activitybar'
            ];
            return Boolean(el.closest(excluded.join(', ')));
          }

          // 2. Create Floating Toggle Button in UI
          const toggleBtn = document.createElement('button');
          toggleBtn.id = 'antigravity-auto-accept-toggle-btn';
          toggleBtn.style.cssText = \`
            position: fixed;
            top: 10px;
            right: 80px;
            z-index: 2147483647;
            display: flex;
            align-items: center;
            gap: 6px;
            padding: 5px 12px;
            border-radius: 9999px;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            font-size: 11px;
            font-weight: 600;
            cursor: pointer;
            border: 1px solid;
            transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
            user-select: none;
            box-shadow: 0 2px 10px rgba(0,0,0,0.15);
          \`;

          function updateButtonUI() {
            if (isAutoAcceptEnabled) {
              toggleBtn.innerHTML = '⚡ <span>Auto-Accept: ON</span> <span style="opacity:0.75; font-size:10px; margin-left:2px">(' + acceptedCount + ')</span>';
              toggleBtn.style.background = '#052e16';
              toggleBtn.style.color = '#4ade80';
              toggleBtn.style.borderColor = '#16a34a';
              toggleBtn.style.boxShadow = '0 0 12px rgba(74, 222, 128, 0.25), 0 2px 6px rgba(0,0,0,0.3)';
              toggleBtn.title = 'Antigravity Auto-Accept is ACTIVE (Click to Pause)\\nAccepted: ' + acceptedCount + ' | Blocked for Review: ' + blockedCount;
            } else {
              toggleBtn.innerHTML = '⏸️ <span>Auto-Accept: OFF</span>';
              toggleBtn.style.background = '#27272a';
              toggleBtn.style.color = '#a1a1aa';
              toggleBtn.style.borderColor = '#3f3f46';
              toggleBtn.style.boxShadow = '0 2px 6px rgba(0,0,0,0.2)';
              toggleBtn.title = 'Antigravity Auto-Accept is PAUSED (Click to Enable)\\nAccepted: ' + acceptedCount + ' | Blocked for Review: ' + blockedCount;
            }
          }

          toggleBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            isAutoAcceptEnabled = !isAutoAcceptEnabled;
            localStorage.setItem('antigravity_auto_accept_enabled', isAutoAcceptEnabled.toString());
            updateButtonUI();
            console.log('[Antigravity UI] Auto-Accept toggled:', isAutoAcceptEnabled ? 'ON' : 'OFF');
            if (isAutoAcceptEnabled) {
              scanAndAccept();
            }
          });

          updateButtonUI();
          document.body.appendChild(toggleBtn);

          // 3. Scan & Accept Routine
          function scanAndAccept() {
            if (!isAutoAcceptEnabled) return;

            const elements = document.querySelectorAll('button, [role="button"], [tabindex="0"]');

            for (let i = 0; i < elements.length; i++) {
              const el = elements[i];
              if (el === toggleBtn || toggleBtn.contains(el)) continue;
              if (isInsideSidebar(el)) continue;
              if (el.hasAttribute('data-antigravity-auto-accepted')) continue;
              if (el.disabled || el.getAttribute('aria-disabled') === 'true') continue;

              const style = window.getComputedStyle(el);
              if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') continue;
              const rect = el.getBoundingClientRect();
              if (rect.width === 0 || rect.height === 0) continue;

              const rawText = (el.innerText || el.textContent || el.value || el.getAttribute('aria-label') || '').trim();
              if (!rawText) continue;

              const lines = rawText.split(/\\r?\\n/).map(s => s.trim()).filter(Boolean);
              const firstLine = (lines[0] || '').toLowerCase();

              // Skip explicit rejects
              if (REJECT_LABELS.some(rej => firstLine === rej || firstLine.startsWith(rej + ' '))) {
                continue;
              }

              let isAccept = false;
              for (const acc of ACCEPT_LABELS) {
                if (
                  firstLine === acc ||
                  firstLine.startsWith(acc + ' ') ||
                  firstLine.startsWith(acc + ':') ||
                  firstLine.startsWith(acc + '\\n') ||
                  rawText.toLowerCase() === acc
                ) {
                  isAccept = true;
                  break;
                }
              }

              if (!isAccept) {
                const childSpans = el.querySelectorAll('span, b, strong');
                for (const sp of childSpans) {
                  const spText = (sp.innerText || sp.textContent || '').trim().toLowerCase();
                  if (ACCEPT_LABELS.includes(spText)) {
                    isAccept = true;
                    break;
                  }
                }
              }

              if (!isAccept) continue;

              // Extract command text
              let cmdText = lines.slice(1).join('\\n');
              let parent = el.parentElement;
              let depth = 0;
              let contextText = '';
              while (parent && depth < 5) {
                const codeEls = parent.querySelectorAll('pre, code, .command, .code, [class*="command"]');
                if (codeEls.length > 0) {
                  contextText = Array.from(codeEls).map(c => c.textContent).join('\\n');
                  break;
                }
                parent = parent.parentElement;
                depth++;
              }

              const fullText = [cmdText, contextText, rawText].filter(Boolean).join('\\n');

              // Strict Manual Review Check for ONLY: rm -rf, sudo, database drop table
              if (isStrictlyDangerous(fullText)) {
                console.warn('[Auto-Accept] ⚠️ Dangerous command requires manual review:', fullText.slice(0, 80));
                el.setAttribute('data-antigravity-auto-accepted', 'blocked-manual-review');
                blockedCount++;
                localStorage.setItem('antigravity_blocked_count', blockedCount.toString());
                updateButtonUI();
                continue;
              }

              // All other terminal commands and prompts: AUTO-ACCEPT!
              el.setAttribute('data-antigravity-auto-accepted', Date.now().toString());

              const cx = rect.x + rect.width / 2;
              const cy = rect.y + rect.height / 2;
              const eventInit = { bubbles: true, cancelable: true, view: window, clientX: cx, clientY: cy, pointerId: 1, isPrimary: true, button: 0, buttons: 1 };

              if (window.PointerEvent) {
                el.dispatchEvent(new PointerEvent('pointerdown', eventInit));
              }
              el.dispatchEvent(new MouseEvent('mousedown', eventInit));
              if (window.PointerEvent) {
                el.dispatchEvent(new PointerEvent('pointerup', eventInit));
              }
              el.dispatchEvent(new MouseEvent('mouseup', eventInit));
              el.dispatchEvent(new MouseEvent('click', eventInit));
              if (typeof el.click === 'function') {
                el.click();
              }

              acceptedCount++;
              localStorage.setItem('antigravity_accepted_count', acceptedCount.toString());
              updateButtonUI();
              console.log('[Auto-Accept] ✅ Auto-accepted command prompt:', (cmdText || rawText).slice(0, 80));
            }
          }

          // Initial scan
          scanAndAccept();

          // MutationObserver to catch prompts instantly as they appear
          const observer = new MutationObserver(() => {
            scanAndAccept();
          });
          observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style', 'disabled'] });

          // Fast poll fallback (100ms)
          setInterval(scanAndAccept, 100);

          return { success: true, enabled: isAutoAcceptEnabled };
        })()
      `;

      ws.send(JSON.stringify({ id: 1, method: 'Runtime.enable' }));
      setTimeout(() => {
        ws.send(JSON.stringify({
          id: 2,
          method: 'Runtime.evaluate',
          params: { expression: injectionScript, returnByValue: true },
        }));
      }, 100);
    });

    ws.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.id === 2) {
        console.log('Live UI Injection Result:', JSON.stringify(msg.result?.result?.value, null, 2));
        process.exit(0);
      }
    });
  });
});
