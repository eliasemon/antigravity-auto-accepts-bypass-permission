import fs from 'fs';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';

export const CORE_ENGINE_CODE = `
// =========================================================================
// ANTIGRAVITY PRECISE AUTO-ACCEPT ENGINE & CHATBOX TOGGLE BUTTON
// =========================================================================
(function initAntigravityCoreAutoAccept() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  if (window.__antigravityCoreAutoAcceptActive) return;
  window.__antigravityCoreAutoAcceptActive = true;

  console.log('[Antigravity Core] ⚡ Precise Auto-Accept Engine Initialized');

  // State: persistent in localStorage, defaults to ON
  let isEnabled = localStorage.getItem('antigravity_auto_accept_enabled') !== 'false';
  let acceptedCount = parseInt(localStorage.getItem('antigravity_accepted_count') || '0', 10);

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

  // --- DRAGGABLE & PROMINENT FLOATING TOGGLE BUTTON ---
  let btn = null;

  function mountToggleButton() {
    if (document.getElementById('antigravity-auto-accept-toggle-btn')) return;
    if (!document.body) return;

    btn = document.createElement('div');
    btn.id = 'antigravity-auto-accept-toggle-btn';
    btn.setAttribute('role', 'button');
    btn.style.cssText = [
      'position: fixed',
      'bottom: 110px',
      'right: 32px',
      'z-index: 2147483647',
      'display: flex',
      'align-items: center',
      'gap: 8px',
      'padding: 8px 18px',
      'border-radius: 9999px',
      'font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      'font-size: 12px',
      'font-weight: 700',
      'letter-spacing: 0.3px',
      'cursor: pointer',
      'border: 1.5px solid',
      'box-shadow: 0 4px 18px rgba(0,0,0,0.35)',
      'transition: background 0.2s, border-color 0.2s, color 0.2s, box-shadow 0.2s',
      'user-select: none',
      '-webkit-user-select: none'
    ].join('; ');

    // Restore user saved position if dragged
    const savedPos = localStorage.getItem('antigravity_btn_pos');
    if (savedPos) {
      try {
        const { x, y } = JSON.parse(savedPos);
        btn.style.bottom = 'auto';
        btn.style.right = 'auto';
        btn.style.left = x + 'px';
        btn.style.top = y + 'px';
      } catch (e) {}
    }

    function renderBtn() {
      if (!btn) return;
      if (isEnabled) {
        btn.innerHTML = '<span style="font-size:14px">⚡</span> <span>Auto-Accept: <b>ON</b></span> <span style="background:rgba(74,222,128,0.25); color:#4ade80; padding:1px 7px; border-radius:999px; font-size:10px; margin-left:2px">(' + acceptedCount + ')</span>';
        btn.style.background = '#052e16';
        btn.style.color = '#4ade80';
        btn.style.borderColor = '#22c55e';
        btn.style.boxShadow = '0 0 16px rgba(34, 197, 94, 0.4), 0 4px 12px rgba(0,0,0,0.3)';
        btn.title = '⚡ Auto-Accept is ACTIVE\\n- Auto-accepting all terminal commands & question modals\\n- Manual review for: sudo, rm, -rf, drop\\n(Click to Pause, Drag to Move anywhere)';
      } else {
        btn.innerHTML = '<span style="font-size:14px">⏸️</span> <span>Auto-Accept: <b>OFF</b></span>';
        btn.style.background = '#27272a';
        btn.style.color = '#d4d4d8';
        btn.style.borderColor = '#52525b';
        btn.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)';
        btn.title = '⏸️ Auto-Accept is PAUSED\\n(Click to Enable, Drag to Move anywhere)';
      }
    }

    // Draggable support
    let isDragging = false;
    let startX, startY, origX, origY;

    btn.addEventListener('mousedown', (e) => {
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
          btn.style.bottom = 'auto';
          btn.style.right = 'auto';
          btn.style.left = (origX + dx) + 'px';
          btn.style.top = (origY + dy) + 'px';
        }
      }

      function onMouseUp(e) {
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
        if (isDragging) {
          const rect = btn.getBoundingClientRect();
          localStorage.setItem('antigravity_btn_pos', JSON.stringify({ x: rect.left, y: rect.top }));
        } else {
          // Toggle state
          isEnabled = !isEnabled;
          localStorage.setItem('antigravity_auto_accept_enabled', isEnabled.toString());
          renderBtn();
          if (isEnabled) runPreciseScanner();
        }
      }

      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    });

    renderBtn();
    document.body.appendChild(btn);
  }

  // Click dispatcher
  function clickElement(el) {
    if (!el) return;

    // 1. React Fiber onClick invocation
    try {
      const propsKey = Object.keys(el).find(k => k.startsWith('__reactProps'));
      if (propsKey && el[propsKey] && typeof el[propsKey].onClick === 'function') {
        el[propsKey].onClick({ defaultPrevented: false, preventDefault: () => {}, stopPropagation: () => {} });
      }
    } catch (e) {}

    // 2. Synthetic pointer and mouse events
    try {
      const rect = el.getBoundingClientRect();
      const cx = rect.x + rect.width / 2;
      const cy = rect.y + rect.height / 2;
      const init = { bubbles: true, cancelable: true, view: window, clientX: cx, clientY: cy, pointerId: 1, isPrimary: true, button: 0, buttons: 1 };
      if (window.PointerEvent) {
        el.dispatchEvent(new PointerEvent('pointerdown', init));
        el.dispatchEvent(new PointerEvent('pointerup', init));
      }
      el.dispatchEvent(new MouseEvent('mousedown', init));
      el.dispatchEvent(new MouseEvent('mouseup', init));
      el.dispatchEvent(new MouseEvent('click', init));
      if (typeof el.click === 'function') el.click();
    } catch (e) {}
  }

  // PRECISE TARGET SCANNER (ZERO MISCLICKS)
  function runPreciseScanner() {
    mountToggleButton();
    if (!isEnabled) return;

    // TARGET 1: Interactive Question Modal (ask_question tool)
    const continueBtn = document.querySelector('[data-testid="interaction-continue-button"]');
    if (continueBtn && !continueBtn.disabled && !continueBtn.hasAttribute('data-ag-accepted')) {
      // Auto-select 1st option if present
      const options = document.querySelectorAll('input[type="radio"], input[type="checkbox"], [role="radio"], [role="checkbox"], [class*="option"]');
      if (options.length > 0) {
        const firstOpt = options[0];
        if (!firstOpt.checked && firstOpt.getAttribute('aria-checked') !== 'true') {
          clickElement(firstOpt);
        }
      }

      continueBtn.setAttribute('data-ag-accepted', Date.now().toString());
      clickElement(continueBtn);
      acceptedCount++;
      localStorage.setItem('antigravity_accepted_count', acceptedCount.toString());
      if (btn) {
        btn.innerHTML = '<span style="font-size:14px">⚡</span> <span>Auto-Accept: <b>ON</b></span> <span style="background:rgba(74,222,128,0.25); color:#4ade80; padding:1px 7px; border-radius:999px; font-size:10px; margin-left:2px">(' + acceptedCount + ')</span>';
      }
      console.log('[Auto-Accept] ✅ Auto-accepted question modal');
    }

    // TARGET 2: Declared Permissions Modal
    const permConfirmBtn = document.querySelector('[data-testid="declared-permissions-confirm"]');
    if (permConfirmBtn && !permConfirmBtn.disabled && !permConfirmBtn.hasAttribute('data-ag-accepted')) {
      permConfirmBtn.setAttribute('data-ag-accepted', Date.now().toString());
      clickElement(permConfirmBtn);
      acceptedCount++;
      localStorage.setItem('antigravity_accepted_count', acceptedCount.toString());
      if (btn) {
        btn.innerHTML = '<span style="font-size:14px">⚡</span> <span>Auto-Accept: <b>ON</b></span> <span style="background:rgba(74,222,128,0.25); color:#4ade80; padding:1px 7px; border-radius:999px; font-size:10px; margin-left:2px">(' + acceptedCount + ')</span>';
      }
      console.log('[Auto-Accept] ✅ Auto-accepted declared permissions modal');
    }

    // TARGET 3: Terminal Command Steps (Run buttons in [data-testid="run-command-step"])
    const runSteps = document.querySelectorAll('[data-testid="run-command-step"]');
    for (const step of runSteps) {
      const runBtn = step.querySelector('div[role="button"], button');
      if (!runBtn || runBtn.hasAttribute('data-ag-accepted')) continue;

      const text = (runBtn.innerText || runBtn.textContent || '').trim();
      const lines = text.split(/\\r?\\n/).map(l => l.trim()).filter(Boolean);
      const firstWord = (lines[0] || '').toLowerCase();

      // Only pending "Run" actions
      if (firstWord !== 'run' && !firstWord.startsWith('run')) continue;

      // Extract command text
      let cmdText = lines.slice(1).join('\\n');
      if (!cmdText) {
        const codeEl = step.querySelector('code, pre, .font-mono, [class*="command"]');
        if (codeEl) cmdText = codeEl.textContent.trim();
        else cmdText = step.textContent.trim();
      }

      // Check strict manual review filter (sudo, rm, -rf, drop)
      const blockedReason = requiresManualReview(cmdText);
      if (blockedReason) {
        console.warn('[Auto-Accept] ⚠️ Terminal command left for manual review (' + blockedReason + '):', cmdText.slice(0, 60));
        runBtn.setAttribute('data-ag-accepted', 'manual-review-' + blockedReason);
        continue;
      }

      // AUTO-ACCEPT TERMINAL COMMAND!
      runBtn.setAttribute('data-ag-accepted', 'accepted-' + Date.now());
      clickElement(runBtn);
      acceptedCount++;
      localStorage.setItem('antigravity_accepted_count', acceptedCount.toString());
      if (btn) {
        btn.innerHTML = '<span style="font-size:14px">⚡</span> <span>Auto-Accept: <b>ON</b></span> <span style="background:rgba(74,222,128,0.25); color:#4ade80; padding:1px 7px; border-radius:999px; font-size:10px; margin-left:2px">(' + acceptedCount + ')</span>';
      }
      console.log('[Auto-Accept] ✅ Auto-accepted terminal command:', cmdText.slice(0, 60));
    }

    // TARGET 4: Running Items Panel Action Buttons
    const runningPanel = document.querySelector('[data-testid="running-items-panel"]');
    if (runningPanel) {
      const actionBtns = runningPanel.querySelectorAll('button, div[role="button"]');
      for (const b of actionBtns) {
        if (b.hasAttribute('data-ag-accepted') || b.disabled) continue;
        const bText = (b.innerText || b.textContent || '').trim().toLowerCase();
        if (bText === 'run' || bText === 'accept' || bText === 'allow' || bText === 'proceed' || bText === 'approve') {
          const contextText = (runningPanel.innerText || '').trim();
          const blockedReason = requiresManualReview(contextText);
          if (blockedReason) {
            b.setAttribute('data-ag-accepted', 'manual-review-' + blockedReason);
            continue;
          }
          b.setAttribute('data-ag-accepted', 'accepted-' + Date.now());
          clickElement(b);
          acceptedCount++;
          localStorage.setItem('antigravity_accepted_count', acceptedCount.toString());
          if (btn) {
            btn.innerHTML = '<span style="font-size:14px">⚡</span> <span>Auto-Accept: <b>ON</b></span> <span style="background:rgba(74,222,128,0.25); color:#4ade80; padding:1px 7px; border-radius:999px; font-size:10px; margin-left:2px">(' + acceptedCount + ')</span>';
          }
          console.log('[Auto-Accept] ✅ Auto-accepted running-items action button');
        }
      }
    }
  }

  function startEngine() {
    mountToggleButton();
    runPreciseScanner();

    const targetNode = document.body || document.documentElement;
    if (targetNode) {
      const observer = new MutationObserver(() => runPreciseScanner());
      observer.observe(targetNode, { childList: true, subtree: true, attributes: true });
    }

    setInterval(runPreciseScanner, 25);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startEngine);
  } else {
    startEngine();
  }
})();
// =========================================================================
// END ANTIGRAVITY PRECISE AUTO-ACCEPT ENGINE
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
      .split('// =========================================================================\n// ANTIGRAVITY PRECISE AUTO-ACCEPT ENGINE')[0]
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
    .split('// =========================================================================\n// ANTIGRAVITY PRECISE AUTO-ACCEPT ENGINE')[0]
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
