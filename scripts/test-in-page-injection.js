import http from 'http';
import WebSocket from 'ws';
import fs from 'fs';

const port = fs.readFileSync('/Users/eliasemon/Library/Application Support/Antigravity/DevToolsActivePort', 'utf8').trim().split('\n')[0];

http.get(`http://127.0.0.1:${port}/json/list`, (res) => {
  let body = '';
  res.on('data', (c) => (body += c));
  res.on('end', () => {
    const list = JSON.parse(body);
    const pageTarget = list.find((t) => t.type === 'page');
    const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);

    ws.on('open', () => {
      console.log('Connected to Antigravity live window');
      
      const injectionCode = `
        (() => {
          if (window.__antigravityAutoAcceptInstalled) {
            return { alreadyInstalled: true };
          }
          window.__antigravityAutoAcceptInstalled = true;

          const acceptLabels = ['run', 'accept', 'allow', 'proceed', 'approve', 'execute', 'confirm', 'yes', 'apply', 'always allow'];
          const rejectLabels = ['reject', 'cancel', 'deny', 'skip', 'dismiss', 'no', "don't allow"];

          const blacklist = [
            /\\b(?:rm\\s+[^\\n;|&]*(?:-[a-zA-Z0-9]*[rR][a-zA-Z0-9]*[fF]|-[a-zA-Z0-9]*[fF][a-zA-Z0-9]*[rR]|(?:--recursive\\s+[^\\n;|&]*--force|--force\\s+[^\\n;|&]*--recursive)|(?:-(?:[a-zA-Z0-9]*[rR][a-zA-Z0-9]*)\\s+[^\\n;|&]*-(?:[a-zA-Z0-9]*[fF][a-zA-Z0-9]*))|(?:-(?:[a-zA-Z0-9]*[fF][a-zA-Z0-9]*)\\s+[^\\n;|&]*-(?:[a-zA-Z0-9]*[rR][a-zA-Z0-9]*)))|rmdir\\s+.*[\\/\\\\][sq]|del\\s+.*[\\/\\\\][fqs]|Remove-Item\\s+.*(?:-Recurse\\s+.*-Force|-Force\\s+.*-Recurse))\\b/i,
            /\\b(?:sudo|doas|runas|pkexec)\\b|(?:^|[;&|]\\s*)su(?:\\s+-[a-zA-Z0-9]*|\\s+[a-zA-Z0-9_]+)?\\b|Set-ExecutionPolicy\\s+(?:Unrestricted|Bypass)/i,
            /\\b(?:curl|wget|fetch|invoke-webrequest|iwr)\\b[^\\n|;&]*\\|[^\\n|;&]*(?:sudo\\s+)?(?:\\/(?:usr\\/)?(?:bin|local\\/bin)\\/)?(?:ba|z)?sh\\b/i,
            /\\b(?:curl|wget|fetch|invoke-webrequest|iwr)\\b[^\\n|;&]*\\|[^\\n|;&]*(?:sudo\\s+)?(?:python[23]?|perl|pwsh|powershell)\\b/i,
            /\\bgit\\s+(?:push\\s+[^\\n;&]*(?:--force(?:-with-lease|-if-includes)?\\b|-[a-zA-Z0-9]*f[a-zA-Z0-9]*\\b|\\+[a-zA-Z0-9_\\/.-]+)|reset\\s+--hard|clean\\s+-[a-zA-Z0-9]*f|branch\\s+-[dD]\\b)/i,
            /\\b(?:DROP\\s+(?:DATABASE|SCHEMA|TABLE|VIEW|PROCEDURE)|TRUNCATE\\s+(?:TABLE\\s+)?)\\b/i,
            /(?:\\.env(?!\\.(?:example|sample|template|dist)\\b)(?:\\.[a-zA-Z0-9_-]+)?\\b|\\bid_rsa\\b|\\bid_ed25519\\b|\\bid_ecdsa\\b|\\bid_dsa\\b|\\bauthorized_keys\\b|\\.pem\\b|\\.pfx\\b|\\.pkcs12\\b|aws_access_key_id|AWS_SECRET_ACCESS_KEY|credentials\\.json|service[_-]account.*\\.json|\\b(?:private|server|client|id_rsa)[._-]key\\b|-----BEGIN (?:RSA |OPENSSH |EC )?PRIVATE KEY-----)/i,
            /(?:(?:^|[\s"'>=])\/(?:etc|boot|sys|proc|root|System)\/|[a-zA-Z]:\\Windows\\|~\/(?:\.bashrc|\.zshrc|\.profile|\.bash_profile))/i,
            /(?:\\.\\.[\\/\\\\])+/i
          ];

          function isSafe(text) {
            if (!text) return true;
            for (const re of blacklist) {
              if (re.test(text)) return false;
            }
            return true;
          }

          function isInsideSidebar(el) {
            const excluded = ['.sidebar', 'aside', 'nav', '[role="navigation"]', '[data-testid*="sidebar"]', '[data-testid="conversation-row-sidebar"]', '[data-testid*="history"]'];
            return Boolean(el.closest(excluded.join(', ')));
          }

          function scanAndAccept() {
            const elements = document.querySelectorAll('button, [role="button"], [tabindex="0"]');
            let clicked = 0;

            for (const el of elements) {
              if (isInsideSidebar(el)) continue;
              if (el.hasAttribute('data-antigravity-core-auto-accepted')) continue;

              const style = window.getComputedStyle(el);
              if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') continue;
              const rect = el.getBoundingClientRect();
              if (rect.width === 0 || rect.height === 0) continue;

              const rawText = (el.innerText || el.textContent || '').trim();
              const lines = rawText.split(/\\r?\\n/).map(s => s.trim()).filter(Boolean);
              const firstLine = (lines[0] || '').toLowerCase();

              let isAccept = acceptLabels.some(acc => {
                return firstLine === acc ||
                  firstLine.startsWith(acc + ' ') ||
                  firstLine.startsWith(acc + ':') ||
                  firstLine.startsWith(acc + '\\n');
              });

              if (!isAccept) {
                const childSpans = el.querySelectorAll('span');
                for (const sp of childSpans) {
                  const spText = (sp.innerText || sp.textContent || '').trim().toLowerCase();
                  if (acceptLabels.includes(spText)) {
                    isAccept = true;
                    break;
                  }
                }
              }

              if (isAccept) {
                // Extract command text
                let cmdText = lines.slice(1).join('\\n');
                if (!cmdText && el.parentElement) {
                  cmdText = el.parentElement.textContent || '';
                }

                if (!isSafe(cmdText) || !isSafe(rawText)) {
                  console.warn('[Core Auto-Accept] ⚠️ Destructive command blocked for manual review:', cmdText.slice(0, 100));
                  el.setAttribute('data-antigravity-core-auto-accepted', 'blocked');
                  continue;
                }

                // Click the element!
                el.setAttribute('data-antigravity-core-auto-accepted', Date.now().toString());

                const eventInit = { bubbles: true, cancelable: true, view: window, clientX: rect.x + rect.width / 2, clientY: rect.y + rect.height / 2 };
                el.dispatchEvent(new PointerEvent('pointerdown', eventInit));
                el.dispatchEvent(new MouseEvent('mousedown', eventInit));
                el.dispatchEvent(new PointerEvent('pointerup', eventInit));
                el.dispatchEvent(new MouseEvent('mouseup', eventInit));
                el.dispatchEvent(new MouseEvent('click', eventInit));
                if (typeof el.click === 'function') el.click();

                console.log('[Core Auto-Accept] ✅ Auto-accepted:', firstLine, cmdText.slice(0, 80));
                clicked++;
              }
            }

            return clicked;
          }

          // Initial scan
          const initialClicks = scanAndAccept();

          // MutationObserver to auto-accept dynamically as prompts appear
          const observer = new MutationObserver(() => {
            scanAndAccept();
          });
          observer.observe(document.body || document.documentElement, { childList: true, subtree: true });

          // Also set interval fallback (every 300ms)
          const timer = setInterval(scanAndAccept, 300);

          return { installed: true, initialClicks };
        })()
      `;

      ws.send(JSON.stringify({ id: 1, method: 'Runtime.enable' }));
      setTimeout(() => {
        ws.send(JSON.stringify({ id: 2, method: 'Runtime.evaluate', params: { expression: injectionCode, returnByValue: true } }));
      }, 100);
    });

    ws.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.id === 2) {
        console.log('Injection test result:', JSON.stringify(msg.result?.result?.value, null, 2));
        process.exit(0);
      }
    });
  });
});
