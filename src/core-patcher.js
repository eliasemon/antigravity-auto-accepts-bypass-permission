import fs from 'fs';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';

export const CORE_ENGINE_CODE = `
// =========================================================================
// ANTIGRAVITY PRECISE AUTO-ACCEPT ENGINE & STATUS BAR INTEGRATION
// =========================================================================
(function initAntigravityCoreAutoAccept() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  if (window.__antigravityCoreAutoAcceptActive) return;
  window.__antigravityCoreAutoAcceptActive = true;

  console.log('[Antigravity Core] ⚡ Auto-Accept Engine & Status Bar Integration Initialized');

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

  // --- DUAL-PLACEMENT STATUS BAR MOUNTING ---
  function mountStatusBarUI() {
    // =========================================================================
    // 1. ANTIGRAVITY IDE: Bottom Status Bar (.monaco-workbench .part.statusbar)
    // =========================================================================
    const ideStatusBar = document.querySelector(
      '.monaco-workbench .part.statusbar .right-items, .monaco-workbench .part.statusbar .items-container, #workbench\\\\.parts\\\\.statusbar, footer.statusbar, .part.statusbar'
    );
    if (ideStatusBar) {
      if (document.getElementById('antigravity-ide-statusbar-btn')) return;

      const targetContainer = ideStatusBar.querySelector('.right-items, .items-container') || ideStatusBar;

      const item = document.createElement('div');
      item.id = 'antigravity-ide-statusbar-btn';
      item.className = 'statusbar-item right';
      item.style.cssText = [
        'display: inline-flex',
        'align-items: center',
        'height: 100%',
        'cursor: pointer',
        'user-select: none',
        '-webkit-user-select: none',
        'margin-left: 4px'
      ].join('; ');

      const link = document.createElement('a');
      link.className = 'statusbar-item-label';
      link.setAttribute('role', 'button');
      link.setAttribute('tabindex', '0');
      link.style.cssText = [
        'display: inline-flex',
        'align-items: center',
        'gap: 4px',
        'height: 100%',
        'padding: 0 8px',
        'font-size: 11px',
        'font-weight: 600',
        'cursor: pointer',
        'text-decoration: none',
        'transition: background 0.15s ease',
        'border-radius: 3px'
      ].join('; ');

      function renderIdeItem() {
        if (isEnabled) {
          link.innerHTML = '⚡ Auto-Accept: <span style="color:#4ade80">ON</span> <span style="opacity:0.75; font-size:10px">(' + acceptedCount + ')</span>';
          link.style.color = '#e4e4e7';
          link.title = '⚡ Antigravity Auto-Accept is ACTIVE in IDE (Click to Pause)';
        } else {
          link.innerHTML = '⏸️ Auto-Accept: <span style="color:#a1a1aa">OFF</span>';
          link.style.color = '#71717a';
          link.title = '⏸️ Antigravity Auto-Accept is PAUSED (Click to Enable)';
        }
      }

      item.addEventListener('mouseenter', () => { item.style.background = 'rgba(255, 255, 255, 0.12)'; });
      item.addEventListener('mouseleave', () => { item.style.background = 'transparent'; });
      item.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        isEnabled = !isEnabled;
        localStorage.setItem('antigravity_auto_accept_enabled', isEnabled.toString());
        renderIdeItem();
        console.log('[Antigravity IDE Status Bar] Auto-Accept toggled:', isEnabled ? 'ON' : 'OFF');
        if (isEnabled) runPreciseScanner();
      });

      renderIdeItem();
      item.appendChild(link);
      targetContainer.appendChild(item);
      return;
    }

    // =========================================================================
    // 2. ANTIGRAVITY DESKTOP APP: Top Status Bar beside three-dot menu
    // =========================================================================
    const moreBtn = document.querySelector('[data-testid="titlebar-more-actions"]');
    if (moreBtn && moreBtn.parentElement) {
      if (document.getElementById('antigravity-auto-accept-toggle-btn')) return;

      const btn = document.createElement('button');
      btn.id = 'antigravity-auto-accept-toggle-btn';
      btn.type = 'button';
      btn.style.cssText = [
        'display: inline-flex',
        'align-items: center',
        'gap: 5px',
        'height: 24px',
        'padding: 0 10px',
        'border-radius: 6px',
        'font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        'font-size: 11px',
        'font-weight: 600',
        'cursor: pointer',
        'border: 1px solid',
        'user-select: none',
        '-webkit-user-select: none',
        'margin-right: 4px',
        'transition: all 0.15s ease'
      ].join('; ');

      function renderDesktopBtn() {
        if (isEnabled) {
          btn.innerHTML = '⚡ Auto-Accept: ON <span style="opacity:0.75; font-size:10px; font-weight:normal">(' + acceptedCount + ')</span>';
          btn.style.background = '#052e16';
          btn.style.color = '#4ade80';
          btn.style.borderColor = '#16a34a';
          btn.title = '⚡ Antigravity Auto-Accept is ACTIVE (Click to Pause)';
        } else {
          btn.innerHTML = '⏸️ Auto-Accept: OFF';
          btn.style.background = '#27272a';
          btn.style.color = '#a1a1aa';
          btn.style.borderColor = '#3f3f46';
          btn.title = '⏸️ Antigravity Auto-Accept is PAUSED (Click to Enable)';
        }
      }

      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        isEnabled = !isEnabled;
        localStorage.setItem('antigravity_auto_accept_enabled', isEnabled.toString());
        renderDesktopBtn();
        console.log('[Antigravity Desktop Status Bar] Auto-Accept toggled:', isEnabled ? 'ON' : 'OFF');
        if (isEnabled) runPreciseScanner();
      });

      renderDesktopBtn();
      moreBtn.parentElement.insertBefore(btn, moreBtn);
      return;
    }
  }

  // Click dispatcher
  function clickElement(el) {
    if (!el) return;

    // 1. Direct React Fiber invocation
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
    mountStatusBarUI();
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
      updateCounters();
      console.log('[Auto-Accept] ✅ Auto-accepted question modal');
    }

    // TARGET 2: Declared Permissions Modal
    const permConfirmBtn = document.querySelector('[data-testid="declared-permissions-confirm"]');
    if (permConfirmBtn && !permConfirmBtn.disabled && !permConfirmBtn.hasAttribute('data-ag-accepted')) {
      permConfirmBtn.setAttribute('data-ag-accepted', Date.now().toString());
      clickElement(permConfirmBtn);
      acceptedCount++;
      localStorage.setItem('antigravity_accepted_count', acceptedCount.toString());
      updateCounters();
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
      updateCounters();
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
          updateCounters();
          console.log('[Auto-Accept] ✅ Auto-accepted running-items action button');
        }
      }
    }
  }

  function updateCounters() {
    const desktopBtn = document.getElementById('antigravity-auto-accept-toggle-btn');
    if (desktopBtn && isEnabled) {
      desktopBtn.innerHTML = '⚡ Auto-Accept: ON <span style="opacity:0.75; font-size:10px; font-weight:normal">(' + acceptedCount + ')</span>';
    }
    const ideItem = document.getElementById('antigravity-ide-statusbar-btn');
    if (ideItem && isEnabled) {
      const link = ideItem.querySelector('.statusbar-item-label');
      if (link) {
        link.innerHTML = '⚡ Auto-Accept: <span style="color:#4ade80">ON</span> <span style="opacity:0.75; font-size:10px">(' + acceptedCount + ')</span>';
      }
    }
  }

  function startEngine() {
    mountStatusBarUI();
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
    ideWorkbenchJs: null,
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

    const ideWorkbenchJs = '/Applications/Antigravity IDE.app/Contents/Resources/app/out/vs/code/electron-browser/workbench/workbench.js';
    if (fs.existsSync(ideWorkbenchJs)) {
      paths.ideWorkbenchJs = ideWorkbenchJs;
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

    const winWorkbenchCandidates = [
      path.join(localAppData, 'Programs', 'Antigravity IDE', 'resources', 'app', 'out', 'vs', 'code', 'electron-browser', 'workbench', 'workbench.js'),
      path.join(programFiles, 'Antigravity IDE', 'resources', 'app', 'out', 'vs', 'code', 'electron-browser', 'workbench', 'workbench.js'),
    ];
    for (const c of winWorkbenchCandidates) {
      if (fs.existsSync(c)) {
        paths.ideWorkbenchJs = c;
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

    const linuxWorkbenchCandidates = [
      '/opt/Antigravity IDE/resources/app/out/vs/code/electron-browser/workbench/workbench.js',
      '/usr/lib/antigravity-ide/resources/app/out/vs/code/electron-browser/workbench/workbench.js',
    ];
    for (const c of linuxWorkbenchCandidates) {
      if (fs.existsSync(c)) {
        paths.ideWorkbenchJs = c;
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

    console.log(`[core-patcher] Injecting Precise Auto-Accept Engine & Desktop Top-Bar UI into preload.js...`);
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
 * Directly patches the Antigravity IDE App (workbench.js + jetskiAgent.js)
 */
export async function patchIdeApp(agentJsPath = null) {
  const { ideAgentJs, ideWorkbenchJs } = getAntigravityAppPaths();
  const targetAgentJs = agentJsPath || ideAgentJs;

  let patchedCount = 0;

  // 1. Patch workbench.js (Main Workbench Window - Bottom Status Bar)
  if (ideWorkbenchJs && fs.existsSync(ideWorkbenchJs)) {
    console.log(`[core-patcher] Target IDE workbench.js (Bottom Status Bar): ${ideWorkbenchJs}`);
    const backupWorkbenchJs = `${ideWorkbenchJs}.orig`;
    if (!fs.existsSync(backupWorkbenchJs)) {
      console.log(`[core-patcher] Creating original backup: ${backupWorkbenchJs}`);
      fs.copyFileSync(ideWorkbenchJs, backupWorkbenchJs);
    }

    const currentWorkbench = fs.readFileSync(ideWorkbenchJs, 'utf8');
    const cleanWorkbench = currentWorkbench
      .split('// =========================================================================\n// ANTIGRAVITY PRECISE AUTO-ACCEPT ENGINE')[0]
      .split('// =========================================================================\n// ANTIGRAVITY NATIVE AUTO-ACCEPT ENGINE')[0]
      .split('/**\n * Antigravity & Antigravity IDE Chat Interface Auto-Accept Programmatic Tracker')[0];

    console.log(`[core-patcher] Injecting Auto-Accept Engine into workbench.js for Bottom Status Bar...`);
    const updatedWorkbench = cleanWorkbench + '\n\n' + CORE_ENGINE_CODE;
    fs.writeFileSync(ideWorkbenchJs, updatedWorkbench, 'utf8');
    patchedCount++;
  }

  // 2. Patch jetskiAgent.js (Agent Webview)
  if (targetAgentJs && fs.existsSync(targetAgentJs)) {
    console.log(`[core-patcher] Target IDE jetskiAgent.js: ${targetAgentJs}`);
    const backupAgentJs = `${targetAgentJs}.orig`;
    if (!fs.existsSync(backupAgentJs)) {
      console.log(`[core-patcher] Creating original backup: ${backupAgentJs}`);
      fs.copyFileSync(targetAgentJs, backupAgentJs);
    }

    const currentAgent = fs.readFileSync(targetAgentJs, 'utf8');
    const cleanAgent = currentAgent
      .split('// =========================================================================\n// ANTIGRAVITY PRECISE AUTO-ACCEPT ENGINE')[0]
      .split('// =========================================================================\n// ANTIGRAVITY NATIVE AUTO-ACCEPT ENGINE')[0]
      .split('// =========================================================================\n// ANTIGRAVITY NATIVE CORE AUTO-ACCEPT ENGINE')[0];

    console.log(`[core-patcher] Injecting Auto-Accept Engine into jetskiAgent.js...`);
    const updatedAgent = cleanAgent + '\n\n' + CORE_ENGINE_CODE;
    fs.writeFileSync(targetAgentJs, updatedAgent, 'utf8');
    patchedCount++;
  }

  if (patchedCount === 0) {
    throw new Error(`Neither jetskiAgent.js nor workbench.js found in Antigravity IDE`);
  }

  console.log(`[core-patcher] ✅ Antigravity IDE patched successfully (${patchedCount} files)!`);
  return { success: true, patchedCount };
}

/**
 * Reverts all core patches using the original backups
 */
export async function unpatchCore() {
  const { desktopAppAsar, ideAgentJs, ideWorkbenchJs } = getAntigravityAppPaths();
  let restoredCount = 0;

  if (desktopAppAsar) {
    const backupAsar = `${desktopAppAsar}.orig`;
    if (fs.existsSync(backupAsar)) {
      console.log(`[core-patcher] Restoring original ${desktopAppAsar}...`);
      fs.copyFileSync(backupAsar, desktopAppAsar);
      restoredCount++;
    }
  }

  if (ideWorkbenchJs) {
    const backupWorkbench = `${ideWorkbenchJs}.orig`;
    if (fs.existsSync(backupWorkbench)) {
      console.log(`[core-patcher] Restoring original ${ideWorkbenchJs}...`);
      fs.copyFileSync(backupWorkbench, ideWorkbenchJs);
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
