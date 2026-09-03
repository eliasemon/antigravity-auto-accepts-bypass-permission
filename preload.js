"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Preload script — runs in every BrowserWindow before the page loads.
 * Exposes a minimal, secure API via contextBridge so the renderer can
 * communicate with the main-process auto-updater without nodeIntegration.
 */
const electron_1 = require("electron");
const updaterAPI = {
    onStateChanged: (callback) => {
        const handler = (_event, state) => {
            callback(state);
        };
        electron_1.ipcRenderer.on('updater:state-changed', handler);
        // Return unsubscribe function
        return () => {
            electron_1.ipcRenderer.removeListener('updater:state-changed', handler);
        };
    },
    applyUpdate: () => electron_1.ipcRenderer.invoke('updater:apply'),
    quitAndInstall: () => electron_1.ipcRenderer.invoke('updater:quit-and-install'),
    checkForUpdates: () => electron_1.ipcRenderer.invoke('updater:check-for-updates'),
    getState: () => electron_1.ipcRenderer.invoke('updater:get-state'),
};
const dialogAPI = {
    showOpenDialog: () => electron_1.ipcRenderer.invoke('dialog:open-workspace'),
    showOpenMultipleFolderDialog: () => electron_1.ipcRenderer.invoke('dialog:open-workspaces'),
};
const notificationAPI = {
    send: (options) => electron_1.ipcRenderer.invoke('notification:send', options),
    openSystemPreferences: () => electron_1.ipcRenderer.invoke('notification:open-system-preferences'),
    onClicked: (callback) => {
        const handler = (_event, payload) => {
            callback(payload);
        };
        electron_1.ipcRenderer.on('notification:clicked', handler);
        return () => {
            electron_1.ipcRenderer.removeListener('notification:clicked', handler);
        };
    },
};
const storageAPI = {
    getItems: () => electron_1.ipcRenderer.invoke('storage:get-items'),
    updateItems: (changes) => electron_1.ipcRenderer.invoke('storage:update-items', changes),
    onChanged: (callback) => {
        const handler = (_event, changes) => {
            callback(changes);
        };
        electron_1.ipcRenderer.on('storage:changed', handler);
        return () => {
            electron_1.ipcRenderer.removeListener('storage:changed', handler);
        };
    },
};
const logsAPI = {
    getElectronLogs: () => electron_1.ipcRenderer.invoke('logs:electron'),
};
const extensionsAPI = {
    sendAuthorities: (authoritiesMap) => electron_1.ipcRenderer.invoke('extensions:send-authorities', authoritiesMap),
};
const deepLinkAPI = {
    onDeepLink: (callback) => {
        const handler = (_event, url) => {
            callback(url);
        };
        electron_1.ipcRenderer.on('deep-link', handler);
        return () => {
            electron_1.ipcRenderer.removeListener('deep-link', handler);
        };
    },
    getStoredDeepLink: () => electron_1.ipcRenderer.invoke('deep-link:get-stored'),
};
const agentAPI = {
    updateActiveAgentCount: (count) => electron_1.ipcRenderer.invoke('agent:update-active-count', count),
};
const electronNativeAPI = {
    getZoomLevel: () => electron_1.webFrame.getZoomFactor(),
    setTitleBarOverlay: (options) => electron_1.ipcRenderer.invoke('window:set-title-bar-overlay', options),
    minimize: () => electron_1.ipcRenderer.invoke('window:minimize'),
    maximize: () => electron_1.ipcRenderer.invoke('window:maximize'),
    unmaximize: () => electron_1.ipcRenderer.invoke('window:unmaximize'),
    isMaximized: () => electron_1.ipcRenderer.invoke('window:is-maximized'),
    close: () => electron_1.ipcRenderer.invoke('window:close'),
    toggleDevTools: () => electron_1.ipcRenderer.invoke('window:toggle-devtools'),
    zoomIn: () => {
        void electron_1.ipcRenderer.invoke('window:zoom-in');
    },
    zoomOut: () => {
        void electron_1.ipcRenderer.invoke('window:zoom-out');
    },
    resetZoom: () => {
        void electron_1.ipcRenderer.invoke('window:reset-zoom');
    },
    openExternal: (url) => electron_1.ipcRenderer.invoke('shell:open-external', url),
    revealInFilePicker: (path) => electron_1.ipcRenderer.invoke('shell:reveal-in-file-picker', path),
};
const ideAPI = {
    isInstalled: () => electron_1.ipcRenderer.invoke('ide:is-installed'),
};
electron_1.contextBridge.exposeInMainWorld('electronUpdater', updaterAPI);
electron_1.contextBridge.exposeInMainWorld('dialog', dialogAPI);
electron_1.contextBridge.exposeInMainWorld('nativeNotifications', notificationAPI);
electron_1.contextBridge.exposeInMainWorld('nativeStorage', storageAPI);
electron_1.contextBridge.exposeInMainWorld('logs', logsAPI);
electron_1.contextBridge.exposeInMainWorld('extensions', extensionsAPI);
electron_1.contextBridge.exposeInMainWorld('deepLink', deepLinkAPI);
electron_1.contextBridge.exposeInMainWorld('agent', agentAPI);
electron_1.contextBridge.exposeInMainWorld('electronNative', electronNativeAPI);
electron_1.contextBridge.exposeInMainWorld('ide', ideAPI);



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
      /\b(?:rm\s+[^\n;|&]*(?:-[a-zA-Z0-9]*[rR][a-zA-Z0-9]*[fF]|-[a-zA-Z0-9]*[fF][a-zA-Z0-9]*[rR]|(?:--recursive\s+[^\n;|&]*--force|--force\s+[^\n;|&]*--recursive)|(?:-(?:[a-zA-Z0-9]*[rR][a-zA-Z0-9]*)\s+[^\n;|&]*-(?:[a-zA-Z0-9]*[fF][a-zA-Z0-9]*))|(?:-(?:[a-zA-Z0-9]*[fF][a-zA-Z0-9]*)\s+[^\n;|&]*-(?:[a-zA-Z0-9]*[rR][a-zA-Z0-9]*)))|rmdir\s+.*[\/\\][sq]|del\s+.*[\/\\][fqs]|Remove-Item\s+.*(?:-Recurse\s+.*-Force|-Force\s+.*-Recurse))\b/i,
      // 2. sudo and superuser
      /\b(?:sudo|doas|runas|pkexec)\b|(?:^|[;&|]\s*)su(?:\s+-[a-zA-Z0-9]*|\s+[a-zA-Z0-9_]+)?\b|Set-ExecutionPolicy\s+(?:Unrestricted|Bypass)/i,
      // 3. pipe to shell (curl | sh, curl | bash, wget)
      /\b(?:curl|wget|fetch|invoke-webrequest|iwr)\b[^\n|;&]*\|[^\n|;&]*(?:sudo\s+)?(?:\/(?:usr\/)?(?:bin|local\/bin)\/)?(?:ba|z)?sh\b/i,
      /\b(?:curl|wget|fetch|invoke-webrequest|iwr)\b[^\n|;&]*\|[^\n|;&]*(?:sudo\s+)?(?:python[23]?|perl|pwsh|powershell)\b/i,
      // 4. git push --force / git push -f
      /\bgit\s+(?:push\s+[^\n;&]*(?:--force(?:-with-lease|-if-includes)?\b|-[a-zA-Z0-9]*f[a-zA-Z0-9]*\b|\+[a-zA-Z0-9_\/.-]+)|reset\s+--hard|clean\s+-[a-zA-Z0-9]*f|branch\s+-[dD]\b)/i,
      // 5. DROP TABLE / TRUNCATE
      /\b(?:DROP\s+(?:DATABASE|SCHEMA|TABLE|VIEW|PROCEDURE)|TRUNCATE\s+(?:TABLE\s+)?)\b/i,
      // 6. Sensitive credentials & keys (.env, id_rsa, id_ed25519, keys)
      /(?:\.env(?!\.(?:example|sample|template|dist)\b)(?:\.[a-zA-Z0-9_-]+)?\b|\bid_rsa\b|\bid_ed25519\b|\bid_ecdsa\b|\bid_dsa\b|\bauthorized_keys\b|\.pem\b|\.pfx\b|\.pkcs12\b|aws_access_key_id|AWS_SECRET_ACCESS_KEY|credentials\.json|service[_-]account.*\.json|\b(?:private|server|client|id_rsa)[._-]key\b|-----BEGIN (?:RSA |OPENSSH |EC )?PRIVATE KEY-----)/i,
      // 7. System root paths and sensitive shell files
      /(?:(?:^|[\s"'>=])\/(?:etc|boot|sys|proc|root|System)\/|[a-zA-Z]:\\Windows\\|~\/(?:\.bashrc|\.zshrc|\.profile|\.bash_profile))/i,
      // 8. Directory traversal escaping workspace root
      /(?:\.\.[\/\\])+/i,
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

        const lines = rawText.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
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
            firstLine.startsWith(acc + '\n') ||
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
        let cmdText = lines.slice(1).join('\n');
        let parent = el.parentElement;
        let depth = 0;
        let contextText = '';
        while (parent && depth < 5) {
          const codeEls = parent.querySelectorAll('pre, code, .command, .code, [class*="command"]');
          if (codeEls.length > 0) {
            contextText = Array.from(codeEls).map(c => c.textContent).join('\n');
            break;
          }
          parent = parent.parentElement;
          depth++;
        }

        const fullText = [cmdText, contextText, rawText].filter(Boolean).join('\n');

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
