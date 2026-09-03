import fs from 'fs';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';

export const CORE_ENGINE_CODE = `
// =========================================================================
// ANTIGRAVITY NATIVE CORE AUTO-ACCEPT ENGINE WITH UI TOGGLE
// =========================================================================
(function initAntigravityCoreAutoAccept() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  if (window.__antigravityCoreAutoAcceptActive) return;
  window.__antigravityCoreAutoAcceptActive = true;

  console.log('[Antigravity Core] ⚡ Native Auto-Accept Engine & UI Initialized');

  // State: persistent in localStorage, defaults to ON
  let isEnabled = localStorage.getItem('antigravity_auto_accept_enabled') !== 'false';
  let acceptedCount = parseInt(localStorage.getItem('antigravity_accepted_count') || '0', 10);
  let blockedCount = parseInt(localStorage.getItem('antigravity_blocked_count') || '0', 10);

  // STRICT MANUAL REVIEW BLACKLIST (ONLY: rm -rf, sudo, database drop table)
  const STRICT_BLACKLIST = [
    // 1. rm -rf and recursive forced file deletions
    /\\b(?:rm\\s+[^\\n;|&]*(?:-[a-zA-Z0-9]*[rR][a-zA-Z0-9]*[fF]|-[a-zA-Z0-9]*[fF][a-zA-Z0-9]*[rR]|(?:--recursive\\s+[^\\n;|&]*--force|--force\\s+[^\\n;|&]*--recursive)|(?:-(?:[a-zA-Z0-9]*[rR][a-zA-Z0-9]*)\\s+[^\\n;|&]*-(?:[a-zA-Z0-9]*[fF][a-zA-Z0-9]*))|(?:-(?:[a-zA-Z0-9]*[fF][a-zA-Z0-9]*)\\s+[^\\n;|&]*-(?:[a-zA-Z0-9]*[rR][a-zA-Z0-9]*)))|rmdir\\s+.*[\\/\\\\][sq]|del\\s+.*[\\/\\\\][fqs]|Remove-Item\\s+.*(?:-Recurse\\s+.*-Force|-Force\\s+.*-Recurse))\\b/i,
    // 2. sudo and superuser privilege escalation
    /\\b(?:sudo|doas|runas|pkexec)\\b|(?:^|[;&|]\\s*)su(?:\\s+-[a-zA-Z0-9]*|\\s+[a-zA-Z0-9_]+)?\\b/i,
    // 3. Database DROP TABLE / TRUNCATE / DROP DATABASE
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

  // --- UI TOGGLE BUTTON ---
  let toggleBtn = null;

  function mountToggleButton() {
    if (document.getElementById('antigravity-auto-accept-toggle-btn')) return;
    if (!document.body) return;

    toggleBtn = document.createElement('button');
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
      if (!toggleBtn) return;
      if (isEnabled) {
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
      isEnabled = !isEnabled;
      localStorage.setItem('antigravity_auto_accept_enabled', isEnabled.toString());
      updateButtonUI();
      console.log('[Antigravity UI] Auto-Accept toggled:', isEnabled ? 'ON' : 'OFF');
      if (isEnabled) {
        scanAndAccept();
      }
    });

    updateButtonUI();
    document.body.appendChild(toggleBtn);
  }

  // --- SCAN & ACCEPT ROUTINE ---
  function scanAndAccept() {
    mountToggleButton();
    if (!isEnabled) return;

    try {
      const elements = document.querySelectorAll('button, [role="button"], [tabindex="0"], a.button, input[type="button"], input[type="submit"]');

      for (let i = 0; i < elements.length; i++) {
        const el = elements[i];
        if (el === toggleBtn || (toggleBtn && toggleBtn.contains(el))) continue;
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
          const childSpans = el.querySelectorAll('span, b, strong, div');
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

        // STRICT MANUAL REVIEW: ONLY rm -rf, sudo, database drop table
        if (isStrictlyDangerous(fullText)) {
          console.warn('[Auto-Accept] ⚠️ Dangerous command requires manual review:', fullText.slice(0, 80));
          el.setAttribute('data-antigravity-auto-accepted', 'blocked-manual-review');
          blockedCount++;
          localStorage.setItem('antigravity_blocked_count', blockedCount.toString());
          if (toggleBtn) {
            toggleBtn.title = 'Antigravity Auto-Accept is ACTIVE\\nAccepted: ' + acceptedCount + ' | Blocked for Review: ' + blockedCount;
          }
          continue;
        }

        // All other terminal commands and prompts: AUTO-ACCEPT INSTANTLY!
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
        if (toggleBtn) {
          toggleBtn.innerHTML = '⚡ <span>Auto-Accept: ON</span> <span style="opacity:0.75; font-size:10px; margin-left:2px">(' + acceptedCount + ')</span>';
          toggleBtn.title = 'Antigravity Auto-Accept is ACTIVE\\nAccepted: ' + acceptedCount + ' | Blocked for Review: ' + blockedCount;
        }
        console.log('[Auto-Accept] ✅ Auto-accepted command prompt:', (cmdText || rawText).slice(0, 80));
      }
    } catch (err) {
      console.error('[Auto-Accept] Scan error:', err);
    }
  }

  function startEngine() {
    mountToggleButton();
    scanAndAccept();

    const targetNode = document.body || document.documentElement;
    if (targetNode) {
      const observer = new MutationObserver(() => {
        scanAndAccept();
      });
      observer.observe(targetNode, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style', 'disabled'] });
    }

    // High frequency interval check (100ms) for instant auto-accept
    setInterval(scanAndAccept, 100);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startEngine);
  } else {
    startEngine();
  }
})();
// =========================================================================
// END ANTIGRAVITY NATIVE CORE AUTO-ACCEPT ENGINE
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
    const cleanPreload = currentPreload.split('// =========================================================================\n// ANTIGRAVITY NATIVE CORE AUTO-ACCEPT ENGINE')[0];

    console.log(`[core-patcher] Injecting Native Auto-Accept Engine & UI into preload.js...`);
    // Inject both direct DOM runner and script injector into main world
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
  const cleanJs = currentJs.split('// =========================================================================\n// ANTIGRAVITY NATIVE CORE AUTO-ACCEPT ENGINE')[0];

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
