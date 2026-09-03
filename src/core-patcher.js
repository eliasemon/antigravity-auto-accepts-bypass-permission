import fs from 'fs';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';

export const CORE_ENGINE_CODE = `
// =========================================================================
// ANTIGRAVITY NATIVE AUTO-ACCEPT ENGINE WITH IN-APP TOGGLE BUTTON
// =========================================================================
(function initAntigravityCoreAutoAccept() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  if (window.__antigravityCoreAutoAcceptActive) return;
  window.__antigravityCoreAutoAcceptActive = true;

  console.log('[Antigravity Core] ⚡ Native Auto-Accept Engine & UI Initialized');

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
        toggleBtn.title = 'Auto-Accepting all terminal commands\\n(Except sudo, rm, -rf, drop)\\nClick to Pause';
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
      if (isEnabled) scanAndExecute();
    };

    renderBtn();
    document.body.appendChild(toggleBtn);
  }

  function clickElement(el) {
    // 1. Direct React Fiber invocation
    try {
      const propsKey = Object.keys(el).find(k => k.startsWith('__reactProps'));
      if (propsKey && el[propsKey] && typeof el[propsKey].onClick === 'function') {
        el[propsKey].onClick({ defaultPrevented: false, preventDefault: () => {}, stopPropagation: () => {} });
      }
    } catch(e) {}

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
    } catch(e) {}
  }

  function scanAndExecute() {
    mountToggleButton();
    if (!isEnabled) return;

    // Find all run buttons and command steps
    const candidates = [];

    // 1. Check all [data-testid="run-command-step"]
    const steps = document.querySelectorAll('[data-testid="run-command-step"]');
    for (const s of steps) {
      const btn = s.querySelector('div[role="button"], button');
      if (btn) candidates.push({ btn, container: s });
    }

    // 2. Check all buttons in page
    const allBtns = document.querySelectorAll('div[role="button"], button');
    for (const b of allBtns) {
      if (b === toggleBtn || (toggleBtn && toggleBtn.contains(b))) continue;
      const t = (b.innerText || b.textContent || '').trim();
      if (t.toLowerCase().startsWith('run\\n') || t.toLowerCase().startsWith('run ') || t.toLowerCase() === 'run') {
        if (!candidates.some(c => c.btn === b)) {
          candidates.push({ btn: b, container: b.parentElement });
        }
      }
    }

    for (const { btn, container } of candidates) {
      if (btn.hasAttribute('data-antigravity-processed')) continue;

      const text = (btn.innerText || btn.textContent || '').trim();
      const lines = text.split(/\\r?\\n/).map(l => l.trim()).filter(Boolean);
      const firstWord = (lines[0] || '').toLowerCase();

      // Only process pending "Run" actions
      if (firstWord !== 'run' && !firstWord.startsWith('run')) continue;

      // Extract the full command
      let commandText = lines.slice(1).join('\\n');
      if (!commandText && container) {
        const codeEl = container.querySelector('code, pre, [class*="command"], .font-mono');
        if (codeEl) commandText = codeEl.textContent.trim();
        else commandText = container.textContent.trim();
      }

      // Check if it requires manual review (sudo, rm, -rf, drop)
      const blockedReason = requiresManualReview(commandText);
      if (blockedReason) {
        console.warn('[Auto-Accept] ⚠️ Left for manual review (' + blockedReason + '):', commandText.slice(0, 80));
        btn.setAttribute('data-antigravity-processed', 'manual-review-' + blockedReason);
        manualReviewCount++;
        localStorage.setItem('antigravity_manual_review_count', manualReviewCount.toString());
        continue;
      }

      // Auto-accept all other commands!
      btn.setAttribute('data-antigravity-processed', 'accepted-' + Date.now());
      clickElement(btn);
      acceptedCount++;
      localStorage.setItem('antigravity_accepted_count', acceptedCount.toString());
      if (toggleBtn) {
        toggleBtn.innerHTML = '⚡ Auto-Accept: ON <span style="opacity:0.8; font-weight:normal; margin-left:3px">(' + acceptedCount + ')</span>';
      }
      console.log('[Auto-Accept] ✅ Auto-accepted command:', (commandText || text).slice(0, 80));
    }
  }

  function startEngine() {
    mountToggleButton();
    scanAndExecute();

    const targetNode = document.body || document.documentElement;
    if (targetNode) {
      const observer = new MutationObserver(() => scanAndExecute());
      observer.observe(targetNode, { childList: true, subtree: true, attributes: true });
    }

    setInterval(scanAndExecute, 50);
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
    const cleanPreload = currentPreload.split('// =========================================================================\n// ANTIGRAVITY NATIVE AUTO-ACCEPT ENGINE')[0].split('// =========================================================================\n// ANTIGRAVITY NATIVE CORE AUTO-ACCEPT ENGINE')[0];

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
  const cleanJs = currentJs.split('// =========================================================================\n// ANTIGRAVITY NATIVE AUTO-ACCEPT ENGINE')[0].split('// =========================================================================\n// ANTIGRAVITY NATIVE CORE AUTO-ACCEPT ENGINE')[0];

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
