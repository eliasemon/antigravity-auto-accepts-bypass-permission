import fs from 'fs';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';

export const CORE_ENGINE_CODE = `
// =========================================================================
// ANTIGRAVITY NATIVE AUTO-ACCEPT ENGINE & CHATBOX POPUP TRACKER
// =========================================================================
(function initAntigravityCoreAutoAccept() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  if (window.__antigravityCoreAutoAcceptActive) return;
  window.__antigravityCoreAutoAcceptActive = true;

  console.log('[Antigravity Core] ⚡ Native Auto-Accept Engine & Chatbox Modal Tracker Initialized');

  // State: persistent in localStorage, defaults to ON
  let isEnabled = localStorage.getItem('antigravity_auto_accept_enabled') !== 'false';
  let acceptedCount = parseInt(localStorage.getItem('antigravity_accepted_count') || '0', 10);
  let manualReviewCount = parseInt(localStorage.getItem('antigravity_manual_review_count') || '0', 10);

  // STRICT MANUAL REVIEW BLACKLIST (ONLY: sudo, rm, -rf, drop)
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

  // --- UI TOGGLE BUTTON ---
  let toggleBtn = null;

  function mountToggleButton() {
    if (document.getElementById('antigravity-auto-accept-toggle-btn')) return;
    if (!document.body) return;

    toggleBtn = document.createElement('button');
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
      if (!toggleBtn) return;
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
      console.log('[Antigravity UI] Auto-Accept toggled:', isEnabled ? 'ON' : 'OFF');
      if (isEnabled) scanAndAutoAccept();
    };

    renderBtn();
    document.body.appendChild(toggleBtn);
  }

  function clickElement(el) {
    if (!el) return;

    // 1. Direct React Fiber invocation
    try {
      const propsKey = Object.keys(el).find(k => k.startsWith('__reactProps'));
      if (propsKey && el[propsKey] && typeof el[propsKey].onClick === 'function') {
        el[propsKey].onClick({ defaultPrevented: false, preventDefault: () => {}, stopPropagation: () => {} });
      }
    } catch (e) {}

    // 2. Full pointer and mouse events
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
    } catch (e) {}
  }

  const ACCEPT_WORDS = [
    'run', 'accept', 'always allow', 'allow', 'approve', 'proceed',
    'execute', 'confirm', 'yes', 'keep', 'apply', 'submit', 'continue'
  ];
  const REJECT_WORDS = ['reject', 'cancel', 'deny', 'skip', 'dismiss', 'no', "don't allow"];

  function isAcceptButton(btn) {
    if (!btn) return false;
    if (btn === toggleBtn || (toggleBtn && toggleBtn.contains(btn))) return false;
    if (btn.disabled || btn.getAttribute('aria-disabled') === 'true') return false;

    const rawText = (btn.innerText || btn.textContent || btn.value || btn.getAttribute('aria-label') || '').trim();
    if (!rawText) return false;

    const lines = rawText.split(/\\r?\\n/).map(s => s.trim()).filter(Boolean);
    const firstLine = (lines[0] || '').toLowerCase();

    // Reject check
    if (REJECT_WORDS.some(rej => firstLine === rej || firstLine.startsWith(rej + ' '))) {
      return false;
    }

    // Ran check
    if (firstLine === 'ran' || firstLine === 'running') {
      return false;
    }

    // Accept keywords check
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

    // Child elements check
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

  function scanAndAutoAccept() {
    mountToggleButton();
    if (!isEnabled) return;

    // =========================================================================
    // 1. TRACK POPUP MODAL ON CHATBOX & MODAL OVERLAYS
    // =========================================================================
    const popupSelectors = [
      '[data-testid="agent-input-box"]',
      '[data-testid="running-items-panel"]',
      '[role="dialog"]',
      '[role="alertdialog"]',
      '[aria-modal="true"]',
      '[data-state="open"]',
      '[class*="modal"]',
      '[class*="popup"]',
      '[class*="dialog"]',
      '[class*="popover"]',
      '[class*="permission"]',
      '[class*="prompt"]'
    ];

    for (const sel of popupSelectors) {
      const containers = document.querySelectorAll(sel);
      for (const container of containers) {
        if (isInsideSidebar(container)) continue;
        if (container.hasAttribute('data-antigravity-modal-handled')) continue;

        // Auto-select 1st option if multiple choice (e.g. ask_question)
        const options = container.querySelectorAll('input[type="radio"], input[type="checkbox"], [role="radio"], [role="checkbox"], [class*="option"]');
        if (options.length > 0) {
          const firstOpt = options[0];
          if (!firstOpt.checked && firstOpt.getAttribute('aria-checked') !== 'true') {
            clickElement(firstOpt);
          }
        }

        // Click accept/proceed/submit/run button
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

            container.setAttribute('data-antigravity-modal-handled', 'accepted-' + Date.now());
            btn.setAttribute('data-antigravity-processed', 'accepted-' + Date.now());
            clickElement(btn);
            acceptedCount++;
            localStorage.setItem('antigravity_accepted_count', acceptedCount.toString());
            if (toggleBtn) {
              toggleBtn.innerHTML = '⚡ Auto-Accept: ON <span style="opacity:0.8; font-weight:normal; margin-left:3px">(' + acceptedCount + ')</span>';
            }
            console.log('[Auto-Accept] ✅ Auto-accepted chatbox popup modal:', modalText.slice(0, 80));
            break;
          }
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

      btn.setAttribute('data-antigravity-processed', 'accepted-' + Date.now());
      clickElement(btn);
      acceptedCount++;
      localStorage.setItem('antigravity_accepted_count', acceptedCount.toString());
      if (toggleBtn) {
        toggleBtn.innerHTML = '⚡ Auto-Accept: ON <span style="opacity:0.8; font-weight:normal; margin-left:3px">(' + acceptedCount + ')</span>';
      }
      console.log('[Auto-Accept] ✅ Auto-accepted terminal command:', (commandText || text).slice(0, 80));
    }

    // =========================================================================
    // 3. ANY REMAINING RUN / ACCEPT BUTTON ON SCREEN
    // =========================================================================
    const allButtons = document.querySelectorAll('div[role="button"], button');
    for (const btn of allButtons) {
      if (btn.hasAttribute('data-antigravity-processed')) continue;
      if (isInsideSidebar(btn)) continue;
      if (!isAcceptButton(btn)) continue;

      const text = (btn.innerText || btn.textContent || '').trim();
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
      if (toggleBtn) {
        toggleBtn.innerHTML = '⚡ Auto-Accept: ON <span style="opacity:0.8; font-weight:normal; margin-left:3px">(' + acceptedCount + ')</span>';
      }
      console.log('[Auto-Accept] ✅ Auto-accepted action button:', text.slice(0, 60));
    }
  }

  function startEngine() {
    mountToggleButton();
    scanAndAutoAccept();

    const targetNode = document.body || document.documentElement;
    if (targetNode) {
      const observer = new MutationObserver(() => scanAndAutoAccept());
      observer.observe(targetNode, { childList: true, subtree: true, attributes: true });
    }

    setInterval(scanAndAutoAccept, 25);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startEngine);
  } else {
    startEngine();
  }
})();
// =========================================================================
// END ANTIGRAVITY NATIVE AUTO-ACCEPT ENGINE
// =========================================================================
`;

/**
 * Discovers installation paths for Antigravity Desktop App and Antigravity IDE
 */
export function getAntigravityAppPaths() {
  const paths = {
    desktopAppAsar: null,
    ideAgentJs: null,
  };

  if (process.platform === 'darwin') {
    const desktopAsar = '/Applications/Antigravity.app/Contents/Resources/app.asar';
    if (fs.existsSync(desktopAsar)) {
      paths.desktopAppAsar = desktopAsar;
    }

    const ideJs = '/Applications/Antigravity IDE.app/Contents/Resources/app/out/vs/code/electron-browser/workbench/jetskiAgent.js';
    if (fs.existsSync(ideJs)) {
      paths.ideAgentJs = ideJs;
    }
  } else if (process.platform === 'win32') {
    const localAppData = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
    const programFiles = process.env.ProgramFiles || 'C:\\Program Files';

    const winDesktopCandidates = [
      path.join(localAppData, 'Programs', 'Antigravity', 'resources', 'app.asar'),
      path.join(programFiles, 'Antigravity', 'resources', 'app.asar'),
    ];
    for (const c of winDesktopCandidates) {
      if (fs.existsSync(c)) {
        paths.desktopAppAsar = c;
        break;
      }
    }

    const winIdeCandidates = [
      path.join(localAppData, 'Programs', 'Antigravity IDE', 'resources', 'app', 'out', 'vs', 'code', 'electron-browser', 'workbench', 'jetskiAgent.js'),
      path.join(programFiles, 'Antigravity IDE', 'resources', 'app', 'out', 'vs', 'code', 'electron-browser', 'workbench', 'jetskiAgent.js'),
    ];
    for (const c of winIdeCandidates) {
      if (fs.existsSync(c)) {
        paths.ideAgentJs = c;
        break;
      }
    }
  } else {
    // Linux
    const linuxDesktopCandidates = [
      '/opt/Antigravity/resources/app.asar',
      '/usr/lib/antigravity/resources/app.asar',
      path.join(os.homedir(), '.local/share/antigravity/resources/app.asar'),
    ];
    for (const c of linuxDesktopCandidates) {
      if (fs.existsSync(c)) {
        paths.desktopAppAsar = c;
        break;
      }
    }

    const linuxIdeCandidates = [
      '/opt/Antigravity IDE/resources/app/out/vs/code/electron-browser/workbench/jetskiAgent.js',
      '/usr/lib/antigravity-ide/resources/app/out/vs/code/electron-browser/workbench/jetskiAgent.js',
    ];
    for (const c of linuxIdeCandidates) {
      if (fs.existsSync(c)) {
        paths.ideAgentJs = c;
        break;
      }
    }
  }

  return paths;
}

/**
 * Directly patches the Antigravity Desktop App (app.asar / preload.js)
 */
export async function patchDesktopApp(asarPath = null) {
  const targetAsar = asarPath || getAntigravityAppPaths().desktopAppAsar;
  if (!targetAsar || !fs.existsSync(targetAsar)) {
    throw new Error(`Antigravity Desktop app.asar not found at ${targetAsar}`);
  }

  console.log(`[core-patcher] Target Desktop app.asar: ${targetAsar}`);

  const backupAsar = `${targetAsar}.orig`;
  if (!fs.existsSync(backupAsar)) {
    console.log(`[core-patcher] Creating original backup: ${backupAsar}`);
    fs.copyFileSync(targetAsar, backupAsar);
  }

  const tmpExtractDir = path.join(os.tmpdir(), `antigravity-core-patch-${Date.now()}`);
  try {
    console.log(`[core-patcher] Extracting asar archive...`);
    execSync(`npx @electron/asar extract "${targetAsar}" "${tmpExtractDir}"`, { stdio: 'inherit' });

    const preloadPath = path.join(tmpExtractDir, 'dist', 'preload.js');
    if (!fs.existsSync(preloadPath)) {
      throw new Error(`preload.js not found in extracted asar at ${preloadPath}`);
    }

    const currentPreload = fs.readFileSync(preloadPath, 'utf8');
    const cleanPreload = currentPreload
      .split('// =========================================================================\n// ANTIGRAVITY NATIVE AUTO-ACCEPT ENGINE')[0]
      .split('// =========================================================================\n// ANTIGRAVITY NATIVE CORE AUTO-ACCEPT ENGINE')[0];

    console.log(`[core-patcher] Injecting Native Auto-Accept Engine & UI into preload.js...`);
    const injectorWrapper = `
// Inject into Main World
try {
  const inlineScript = document.createElement('script');
  inlineScript.id = 'antigravity-core-auto-accept-injected';
  inlineScript.textContent = \`\${${JSON.stringify(CORE_ENGINE_CODE)}}\`;
  if (document.documentElement) {
    document.documentElement.appendChild(inlineScript);
  } else {
    document.addEventListener('DOMContentLoaded', () => {
      document.documentElement.appendChild(inlineScript);
    });
  }
} catch (e) {}

// Run in Preload World
${CORE_ENGINE_CODE}
`;

    const updatedPreload = cleanPreload + '\n\n' + injectorWrapper;
    fs.writeFileSync(preloadPath, updatedPreload, 'utf8');

    console.log(`[core-patcher] Repacking patched app.asar...`);
    execSync(`npx @electron/asar pack "${tmpExtractDir}" "${targetAsar}" --unpack-dir "{node_modules}"`, { stdio: 'inherit' });

    console.log(`[core-patcher] ✅ Antigravity Desktop core patched successfully!`);
    return { success: true, target: targetAsar };
  } finally {
    try {
      fs.rmSync(tmpExtractDir, { recursive: true, force: true });
    } catch (e) {}
  }
}

/**
 * Directly patches the Antigravity IDE App (jetskiAgent.js)
 */
export async function patchIdeApp(agentJsPath = null) {
  const targetJs = agentJsPath || getAntigravityAppPaths().ideAgentJs;
  if (!targetJs || !fs.existsSync(targetJs)) {
    throw new Error(`Antigravity IDE jetskiAgent.js not found at ${targetJs}`);
  }

  console.log(`[core-patcher] Target IDE jetskiAgent.js: ${targetJs}`);

  const backupJs = `${targetJs}.orig`;
  if (!fs.existsSync(backupJs)) {
    console.log(`[core-patcher] Creating original backup: ${backupJs}`);
    fs.copyFileSync(targetJs, backupJs);
  }

  const currentJs = fs.readFileSync(targetJs, 'utf8');
  const cleanJs = currentJs
    .split('// =========================================================================\n// ANTIGRAVITY NATIVE AUTO-ACCEPT ENGINE')[0]
    .split('// =========================================================================\n// ANTIGRAVITY NATIVE CORE AUTO-ACCEPT ENGINE')[0];

  console.log(`[core-patcher] Injecting Native Auto-Accept Engine & UI into jetskiAgent.js...`);
  const updatedJs = cleanJs + '\n\n' + CORE_ENGINE_CODE;
  fs.writeFileSync(targetJs, updatedJs, 'utf8');

  console.log(`[core-patcher] ✅ Antigravity IDE core patched successfully!`);
  return { success: true, target: targetJs };
}

/**
 * Reverts all core patches using the original backups
 */
export async function unpatchCore() {
  const { desktopAppAsar, ideAgentJs } = getAntigravityAppPaths();
  let restoredCount = 0;

  if (desktopAppAsar) {
    const backupAsar = `${desktopAppAsar}.orig`;
    if (fs.existsSync(backupAsar)) {
      console.log(`[core-patcher] Restoring original ${desktopAppAsar}...`);
      fs.copyFileSync(backupAsar, desktopAppAsar);
      restoredCount++;
    }
  }

  if (ideAgentJs) {
    const backupJs = `${ideAgentJs}.orig`;
    if (fs.existsSync(backupJs)) {
      console.log(`[core-patcher] Restoring original ${ideAgentJs}...`);
      fs.copyFileSync(backupJs, ideAgentJs);
      restoredCount++;
    }
  }

  console.log(`[core-patcher] ✅ Restored ${restoredCount} original core files.`);
  return { restoredCount };
}
