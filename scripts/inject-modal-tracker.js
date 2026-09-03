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
      ws.send(JSON.stringify({ id: 1, method: 'Runtime.enable' }));

      const modalEngineCode = `(() => {
        // Remove existing button if present to cleanly reinstall
        const oldBtn = document.getElementById('antigravity-auto-accept-toggle-btn');
        if (oldBtn) oldBtn.remove();

        let isEnabled = localStorage.getItem('antigravity_auto_accept_enabled') !== 'false';
        let acceptedCount = parseInt(localStorage.getItem('antigravity_accepted_count') || '0', 10);
        let manualReviewCount = parseInt(localStorage.getItem('antigravity_manual_review_count') || '0', 10);

        // Strict manual review filter: ONLY sudo, rm, -rf, drop
        function requiresManualReview(cmdText) {
          if (!cmdText || typeof cmdText !== 'string') return false;
          const lower = cmdText.toLowerCase();

          // 1. sudo
          if (/\\bsudo\\b/i.test(lower)) return 'sudo';
          // 2. rm (or rmdir, del, remove-item)
          if (/\\b(?:rm|rmdir|del|remove-item)\\b/i.test(lower)) return 'rm';
          // 3. -rf (-rf, -fr, -r -f)
          if (/-[a-z0-9]*r[a-z0-9]*f\\b|-[a-z0-9]*f[a-z0-9]*r\\b/i.test(lower) || lower.includes('-rf') || lower.includes('-fr')) return '-rf';
          // 4. drop (DROP TABLE, drop database, drop)
          if (/\\bdrop\\b/i.test(lower)) return 'drop';

          return false;
        }

        // Create UI button
        const toggleBtn = document.createElement('button');
        toggleBtn.id = 'antigravity-auto-accept-toggle-btn';
        toggleBtn.style.cssText = [
          'position: fixed',
          'top: 8px',
          'right: 75px',
          'z-index: 2147483647',
          'display: flex',
          'align-items: center',
          'gap: 6px',
          'padding: 5px 14px',
          'border-radius: 9999px',
          'font-family: -apple-system, BlinkMacSystemFont, sans-serif',
          'font-size: 11px',
          'font-weight: 700',
          'letter-spacing: 0.3px',
          'cursor: pointer',
          'border: 1px solid',
          'transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
          'user-select: none',
          'box-shadow: 0 2px 10px rgba(0,0,0,0.2)'
        ].join('; ');

        function renderBtn() {
          if (isEnabled) {
            toggleBtn.innerHTML = '⚡ Auto-Accept: ON <span style="opacity:0.8; font-weight:normal; margin-left:3px">(' + acceptedCount + ')</span>';
            toggleBtn.style.background = '#052e16';
            toggleBtn.style.color = '#4ade80';
            toggleBtn.style.borderColor = '#16a34a';
            toggleBtn.style.boxShadow = '0 0 14px rgba(74, 222, 128, 0.3), 0 2px 6px rgba(0,0,0,0.3)';
            toggleBtn.title = 'Auto-Accepting all terminal commands & chatbox popups\\n(Except sudo, rm, -rf, drop)\\nClick to Pause';
          } else {
            toggleBtn.innerHTML = '⏸️ Auto-Accept: OFF';
            toggleBtn.style.background = '#27272a';
            toggleBtn.style.color = '#a1a1aa';
            toggleBtn.style.borderColor = '#3f3f46';
            toggleBtn.style.boxShadow = '0 2px 6px rgba(0,0,0,0.2)';
            toggleBtn.title = 'Auto-Accept is PAUSED\\nClick to Enable';
          }
        }

        toggleBtn.onclick = (e) => {
          e.preventDefault();
          e.stopPropagation();
          isEnabled = !isEnabled;
          localStorage.setItem('antigravity_auto_accept_enabled', isEnabled.toString());
          renderBtn();
          if (isEnabled) scanAndAcceptAll();
        };

        renderBtn();
        document.body.appendChild(toggleBtn);

        function clickElement(el) {
          // Direct React Fiber invocation
          try {
            const propsKey = Object.keys(el).find(k => k.startsWith('__reactProps'));
            if (propsKey && el[propsKey] && typeof el[propsKey].onClick === 'function') {
              el[propsKey].onClick({ defaultPrevented: false, preventDefault: () => {}, stopPropagation: () => {} });
            }
          } catch(e) {}

          // Pointer and mouse events
          try {
            const rect = el.getBoundingClientRect();
            const cx = rect.x + rect.width / 2;
            const cy = rect.y + rect.height / 2;
            const eventInit = { bubbles: true, cancelable: true, view: window, clientX: cx, clientY: cy, pointerId: 1, isPrimary: true, button: 0, buttons: 1 };

            if (window.PointerEvent) {
              el.dispatchEvent(new PointerEvent('pointerdown', eventInit));
              el.dispatchEvent(new PointerEvent('pointerup', eventInit));
            }
            el.dispatchEvent(new MouseEvent('mousedown', eventInit));
            el.dispatchEvent(new MouseEvent('mouseup', eventInit));
            el.dispatchEvent(new MouseEvent('click', eventInit));
            if (typeof el.click === 'function') el.click();
          } catch(e) {}
        }

        const ACCEPT_WORDS = [
          'run', 'accept', 'always allow', 'allow', 'approve', 'proceed',
          'execute', 'confirm', 'yes', 'keep', 'apply', 'submit'
        ];
        const REJECT_WORDS = ['reject', 'cancel', 'deny', 'skip', 'dismiss', 'no', "don't allow"];

        function isAcceptButton(btn) {
          if (!btn) return false;
          if (btn === toggleBtn || toggleBtn.contains(btn)) return false;
          if (btn.disabled || btn.getAttribute('aria-disabled') === 'true') return false;

          const rawText = (btn.innerText || btn.textContent || btn.value || btn.getAttribute('aria-label') || '').trim();
          if (!rawText) return false;

          const lines = rawText.split(/\\r?\\n/).map(s => s.trim()).filter(Boolean);
          const firstLine = (lines[0] || '').toLowerCase();

          // Reject list check
          if (REJECT_WORDS.some(rej => firstLine === rej || firstLine.startsWith(rej + ' '))) {
            return false;
          }

          // Accept list check
          for (const acc of ACCEPT_WORDS) {
            if (
              firstLine === acc ||
              firstLine.startsWith(acc + ' ') ||
              firstLine.startsWith(acc + ':') ||
              firstLine.startsWith(acc + '\\n') ||
              rawText.toLowerCase() === acc
            ) {
              return true;
            }
          }

          // Check child spans
          const childSpans = btn.querySelectorAll('span, b, strong');
          for (const sp of childSpans) {
            const spText = (sp.innerText || sp.textContent || '').trim().toLowerCase();
            if (ACCEPT_WORDS.includes(spText)) {
              return true;
            }
          }

          return false;
        }

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

        function scanAndAcceptAll() {
          mountToggleButton();
          if (!isEnabled) return;

          // =========================================================================
          // 1. TRACK POPUP MODAL ON CHATBOX & MODAL OVERLAYS
          // =========================================================================
          const modalContainers = [
            // Chatbox container and anything inside/above it
            ...document.querySelectorAll('[data-testid="agent-input-box"]'),
            ...document.querySelectorAll('[data-testid="agent-input-box"] > div'),
            ...document.querySelectorAll('[data-testid="running-items-panel"]'),
            // Floating dialogs and popovers
            ...document.querySelectorAll('[role="dialog"]'),
            ...document.querySelectorAll('[role="alertdialog"]'),
            ...document.querySelectorAll('[aria-modal="true"]'),
            ...document.querySelectorAll('[data-state="open"]'),
            ...document.querySelectorAll('[class*="modal"]'),
            ...document.querySelectorAll('[class*="popup"]'),
            ...document.querySelectorAll('[class*="dialog"]'),
            ...document.querySelectorAll('[class*="popover"]'),
            ...document.querySelectorAll('[class*="permission"]'),
            ...document.querySelectorAll('[class*="prompt"]'),
          ];

          for (const container of modalContainers) {
            if (container.hasAttribute('data-antigravity-modal-handled')) continue;
            if (isInsideSidebar(container)) continue;

            // Check if there are interactive options (radio buttons or checkboxes) to select 1st option
            const options = container.querySelectorAll('input[type="radio"], input[type="checkbox"], [role="radio"], [role="checkbox"], [class*="option"]');
            if (options.length > 0) {
              const firstOpt = options[0];
              if (!firstOpt.checked && firstOpt.getAttribute('aria-checked') !== 'true') {
                clickElement(firstOpt);
              }
            }

            // Find accept / proceed / submit / run button inside modal
            const btns = container.querySelectorAll('button, [role="button"], [tabindex="0"], input[type="submit"]');
            for (const btn of btns) {
              if (isAcceptButton(btn)) {
                const modalText = (container.innerText || container.textContent || '').trim();
                const blockedReason = requiresManualReview(modalText);

                if (blockedReason) {
                  console.warn('[Auto-Accept] ⚠️ Chatbox popup left for manual review (' + blockedReason + '):', modalText.slice(0, 80));
                  container.setAttribute('data-antigravity-modal-handled', 'blocked-' + blockedReason);
                  manualReviewCount++;
                  localStorage.setItem('antigravity_manual_review_count', manualReviewCount.toString());
                  break;
                }

                // Auto-accept popup modal!
                container.setAttribute('data-antigravity-modal-handled', 'accepted-' + Date.now());
                btn.setAttribute('data-antigravity-processed', 'accepted-' + Date.now());
                clickElement(btn);
                acceptedCount++;
                localStorage.setItem('antigravity_accepted_count', acceptedCount.toString());
                renderBtn();
                console.log('[Auto-Accept] ✅ Auto-accepted chatbox popup modal:', modalText.slice(0, 80));
                break;
              }
            }
          }

          // =========================================================================
          // 2. TRACK TERMINAL RUN PROMPTS ([data-testid="run-command-step"])
          // =========================================================================
          const commandSteps = document.querySelectorAll('[data-testid="run-command-step"], [class*="command-step"], [class*="tool-step"]');
          for (const step of commandSteps) {
            const btn = step.querySelector('div[role="button"], button');
            if (!btn || btn.hasAttribute('data-antigravity-processed')) continue;

            const text = (btn.innerText || btn.textContent || '').trim();
            const lines = text.split(/\\r?\\n/).map(l => l.trim()).filter(Boolean);
            const firstWord = (lines[0] || '').toLowerCase();

            // Only pending "Run" actions
            if (firstWord !== 'run' && !firstWord.startsWith('run')) continue;

            let commandText = lines.slice(1).join('\\n');
            if (!commandText) {
              const codeEl = step.querySelector('code, pre, [class*="command"], .font-mono');
              if (codeEl) commandText = codeEl.textContent.trim();
              else commandText = step.textContent.trim();
            }

            const blockedReason = requiresManualReview(commandText);
            if (blockedReason) {
              console.warn('[Auto-Accept] ⚠️ Terminal command left for manual review (' + blockedReason + '):', commandText.slice(0, 80));
              btn.setAttribute('data-antigravity-processed', 'manual-review-' + blockedReason);
              manualReviewCount++;
              localStorage.setItem('antigravity_manual_review_count', manualReviewCount.toString());
              continue;
            }

            // Auto-accept terminal command!
            btn.setAttribute('data-antigravity-processed', 'accepted-' + Date.now());
            clickElement(btn);
            acceptedCount++;
            localStorage.setItem('antigravity_accepted_count', acceptedCount.toString());
            renderBtn();
            console.log('[Auto-Accept] ✅ Auto-accepted terminal command:', (commandText || text).slice(0, 80));
          }

          // =========================================================================
          // 3. TRACK ANY REMAINING RUN / ACCEPT BUTTON IN PAGE
          // =========================================================================
          const allButtons = document.querySelectorAll('div[role="button"], button');
          for (const btn of allButtons) {
            if (btn.hasAttribute('data-antigravity-processed')) continue;
            if (isInsideSidebar(btn)) continue;
            if (!isAcceptButton(btn)) continue;

            const text = (btn.innerText || btn.textContent || '').trim();
            const lines = text.split(/\\r?\\n/).map(l => l.trim()).filter(Boolean);
            const firstWord = (lines[0] || '').toLowerCase();

            // If it starts with "ran" or "running", already done
            if (firstWord === 'ran' || firstWord === 'running') continue;

            const parentText = (btn.parentElement ? btn.parentElement.innerText : '') || text;
            const blockedReason = requiresManualReview(parentText);
            if (blockedReason) {
              btn.setAttribute('data-antigravity-processed', 'manual-review-' + blockedReason);
              continue;
            }

            btn.setAttribute('data-antigravity-processed', 'accepted-' + Date.now());
            clickElement(btn);
            acceptedCount++;
            localStorage.setItem('antigravity_accepted_count', acceptedCount.toString());
            renderBtn();
            console.log('[Auto-Accept] ✅ Auto-accepted action button:', text.slice(0, 60));
          }
        }

        scanAndAcceptAll();

        // High frequency observation (MutationObserver + 30ms interval)
        const observer = new MutationObserver(() => scanAndAcceptAll());
        observer.observe(document.body, { childList: true, subtree: true, attributes: true });
        setInterval(scanAndAcceptAll, 30);

        return { installed: true, isEnabled, acceptedCount };
      })()`;

      setTimeout(() => {
        ws.send(JSON.stringify({
          id: 2,
          method: 'Runtime.evaluate',
          params: { expression: modalEngineCode, returnByValue: true }
        }));
      }, 100);
    });

    ws.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.id === 2) {
        console.log('Modal Tracker Result:', JSON.stringify(msg.result?.result?.value, null, 2));
        process.exit(0);
      }
    });
  });
});
