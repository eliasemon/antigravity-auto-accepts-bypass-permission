import fs from 'fs';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';

const CORE_ENGINE_CODE = `
// =========================================================================
// ANTIGRAVITY NATIVE CORE AUTO-ACCEPT ENGINE
// Directly injected into Antigravity runtime
// =========================================================================
(function initAntigravityCoreAutoAccept() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  if (window.__antigravityCoreAutoAcceptActive) return;
  window.__antigravityCoreAutoAcceptActive = true;

  console.log('[Antigravity Core Auto-Accept] ⚡ Native engine active in renderer');

  const CONFIG = {
    acceptLabels: [
      'accept', 'always allow', 'allow', 'run', 'run command',
      'approve', 'execute', 'proceed', 'confirm', 'yes', 'keep', 'apply'
    ],
    rejectLabels: [
      'reject', 'cancel', 'deny', 'skip', 'dismiss', 'no', "don't allow"
    ],
    // Safety guardrails: strictly block dangerous operations
    blacklist: [
      // 1. Recursive or forced rm
      /\\b(?:rm\\s+[^\\n;|&]*(?:-[a-zA-Z0-9]*[rR][a-zA-Z0-9]*[fF]|-[a-zA-Z0-9]*[fF][a-zA-Z0-9]*[rR]|(?:--recursive\\s+[^\\n;|&]*--force|--force\\s+[^\\n;|&]*--recursive)|(?:-(?:[a-zA-Z0-9]*[rR][a-zA-Z0-9]*)\\s+[^\\n;|&]*-(?:[a-zA-Z0-9]*[fF][a-zA-Z0-9]*))|(?:-(?:[a-zA-Z0-9]*[fF][a-zA-Z0-9]*)\\s+[^\\n;|&]*-(?:[a-zA-Z0-9]*[rR][a-zA-Z0-9]*)))|rmdir\\s+.*[\\/\\\\][sq]|del\\s+.*[\\/\\\\][fqs]|Remove-Item\\s+.*(?:-Recurse\\s+.*-Force|-Force\\s+.*-Recurse))\\b/i,
      // 2. sudo and superuser
      /\\b(?:sudo|doas|runas|pkexec)\\b|(?:^|[;&|]\\s*)su(?:\\s+-[a-zA-Z0-9]*|\\s+[a-zA-Z0-9_]+)?\\b|Set-ExecutionPolicy\\s+(?:Unrestricted|Bypass)/i,
      // 3. pipe to shell (curl | sh, curl | bash, wget)
      /\\b(?:curl|wget|fetch|invoke-webrequest|iwr)\\b[^\\n|;&]*\\|[^\\n|;&]*(?:sudo\\s+)?(?:\\/(?:usr\\/)?(?:bin|local\\/bin)\\/)?(?:ba|z)?sh\\b/i,
      /\\b(?:curl|wget|fetch|invoke-webrequest|iwr)\\b[^\\n|;&]*\\|[^\\n|;&]*(?:sudo\\s+)?(?:python[23]?|perl|pwsh|powershell)\\b/i,
      // 4. git push --force / git push -f
      /\\bgit\\s+(?:push\\s+[^\\n;&]*(?:--force(?:-with-lease|-if-includes)?\\b|-[a-zA-Z0-9]*f[a-zA-Z0-9]*\\b|\\+[a-zA-Z0-9_\\/.-]+)|reset\\s+--hard|clean\\s+-[a-zA-Z0-9]*f|branch\\s+-[dD]\\b)/i,
      // 5. DROP TABLE / TRUNCATE
      /\\b(?:DROP\\s+(?:DATABASE|SCHEMA|TABLE|VIEW|PROCEDURE)|TRUNCATE\\s+(?:TABLE\\s+)?)\\b/i,
      // 6. Sensitive credentials & keys (.env, id_rsa, id_ed25519, keys)
      /(?:\\.env(?!\\.(?:example|sample|template|dist)\\b)(?:\\.[a-zA-Z0-9_-]+)?\\b|\\bid_rsa\\b|\\bid_ed25519\\b|\\bid_ecdsa\\b|\\bid_dsa\\b|\\bauthorized_keys\\b|\\.pem\\b|\\.pfx\\b|\\.pkcs12\\b|aws_access_key_id|AWS_SECRET_ACCESS_KEY|credentials\\.json|service[_-]account.*\\.json|\\b(?:private|server|client|id_rsa)[._-]key\\b|-----BEGIN (?:RSA |OPENSSH |EC )?PRIVATE KEY-----)/i,
      // 7. System root paths and sensitive shell files
      /(?:(?:^|[\\s"'>=])\\/(?:etc|boot|sys|proc|root|System)\\/|[a-zA-Z]:\\\\Windows\\\\|~\\/(?:\\.bashrc|\\.zshrc|\\.profile|\\.bash_profile))/i,
      // 8. Directory traversal escaping workspace root
      /(?:\\.\\.[\\/\\\\])+/i,
    ]
  };

  function isDangerous(text) {
    if (!text || typeof text !== 'string') return false;
    for (const re of CONFIG.blacklist) {
      if (re.test(text)) return true;
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

  function scanAndAccept() {
    try {
      const elements = document.querySelectorAll('button, [role="button"], [tabindex="0"], a.button, input[type="button"], input[type="submit"]');

      for (let i = 0; i < elements.length; i++) {
        const el = elements[i];
        if (isInsideSidebar(el)) continue;
        if (el.hasAttribute('data-antigravity-core-auto-accepted')) continue;
        if (el.disabled || el.getAttribute('aria-disabled') === 'true') continue;

        const style = window.getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') continue;
        const rect = el.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) continue;

        const rawText = (el.innerText || el.textContent || el.value || el.getAttribute('aria-label') || '').trim();
        if (!rawText) continue;

        const lines = rawText.split(/\\r?\\n/).map(s => s.trim()).filter(Boolean);
        const firstLine = (lines[0] || '').toLowerCase();

        // Check reject buttons
        if (CONFIG.rejectLabels.some(rej => firstLine === rej || firstLine.startsWith(rej + ' '))) {
          continue;
        }

        let isAccept = false;
        for (const acc of CONFIG.acceptLabels) {
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
            if (CONFIG.acceptLabels.includes(spText)) {
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

        // Safety check!
        if (isDangerous(fullText)) {
          console.warn('[Antigravity Core Auto-Accept] ⚠️ Destructive command blocked for manual review:', fullText.slice(0, 80));
          el.setAttribute('data-antigravity-core-auto-accepted', 'blocked-safety');
          continue;
        }

        // Safe! Execute instant native click
        el.setAttribute('data-antigravity-core-auto-accepted', Date.now().toString());

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

        console.log('[Antigravity Core Auto-Accept] ✅ Auto-accepted prompt:', firstLine, (cmdText || contextText).slice(0, 80));
      }
    } catch (err) {
      console.error('[Antigravity Core Auto-Accept] Scan error:', err);
    }
  }

  function startObserver() {
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
    document.addEventListener('DOMContentLoaded', startObserver);
  } else {
    startObserver();
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
    // 1. Extract asar
    console.log(`[core-patcher] Extracting asar archive...`);
    execSync(`npx @electron/asar extract "${targetAsar}" "${tmpExtractDir}"`, { stdio: 'inherit' });

    // 2. Patch preload.js
    const preloadPath = path.join(tmpExtractDir, 'dist', 'preload.js');
    if (!fs.existsSync(preloadPath)) {
      throw new Error(`preload.js not found in extracted asar at ${preloadPath}`);
    }

    const currentPreload = fs.readFileSync(preloadPath, 'utf8');
    if (currentPreload.includes('ANTIGRAVITY NATIVE CORE AUTO-ACCEPT ENGINE')) {
      console.log(`[core-patcher] Desktop app is already patched.`);
    } else {
      console.log(`[core-patcher] Injecting Native Auto-Accept Engine into preload.js...`);
      const updatedPreload = currentPreload + '\n\n' + CORE_ENGINE_CODE;
      fs.writeFileSync(preloadPath, updatedPreload, 'utf8');
    }

    // 3. Repack asar
    console.log(`[core-patcher] Repacking patched app.asar...`);
    execSync(`npx @electron/asar pack "${tmpExtractDir}" "${targetAsar}"`, { stdio: 'inherit' });

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
  if (currentJs.includes('ANTIGRAVITY NATIVE CORE AUTO-ACCEPT ENGINE')) {
    console.log(`[core-patcher] IDE app is already patched.`);
    return { success: true, target: targetJs, alreadyPatched: true };
  }

  console.log(`[core-patcher] Injecting Native Auto-Accept Engine into jetskiAgent.js...`);
  const updatedJs = currentJs + '\n\n' + CORE_ENGINE_CODE;
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
