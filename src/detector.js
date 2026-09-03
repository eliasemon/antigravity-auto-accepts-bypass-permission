import crypto from 'crypto';

/**
 * Creates a unique hash for a prompt candidate to handle per-element cooldown.
 */
export function createCandidateHash(buttonText, contextText) {
  const normButton = (buttonText || '').trim().toLowerCase();
  const normContext = (contextText || '').trim().toLowerCase();
  return crypto.createHash('sha256').update(`${normButton}::${normContext}`).digest('hex').slice(0, 16);
}

/**
 * Returns the JavaScript snippet that will be evaluated in the CDP target.
 * Recursively scans standard DOM, nested shadow roots, and accessible child iframes.
 */
export function getInPageDetectorScript(acceptLabels = [], rejectLabels = []) {
  return `
(() => {
  const acceptList = ${JSON.stringify(acceptLabels.map((l) => l.trim().toLowerCase()))};
  const rejectList = ${JSON.stringify(rejectLabels.map((l) => l.trim().toLowerCase()))};

  // Helper to check element visibility
  function isVisible(el) {
    if (!el) return false;
    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  // Check if element is inside sidebar or navigation (to prevent accidental chat switching)
  function isInsideSidebar(el) {
    if (!el) return false;
    const excludedSelectors = [
      '.sidebar',
      'aside',
      'nav',
      '[role="navigation"]',
      '[data-testid*="sidebar"]',
      '[data-testid="conversation-row-sidebar"]',
      '[data-testid*="history"]',
      '[class*="sidebar"]',
      '[class*="conversation-list"]',
      '[class*="history-list"]',
      '.explorer-viewlet',
      '.activitybar'
    ].join(', ');

    return Boolean(el.closest(excludedSelectors));
  }

  // Recursive DOM scanner collecting all button-like elements across shadow roots and iframes
  function collectButtons(node, collected = []) {
    if (!node) return collected;

    if (node.nodeType === Node.ELEMENT_NODE) {
      // Exclude sidebar subtrees early
      if (isInsideSidebar(node)) {
        return collected;
      }

      const tag = node.tagName.toLowerCase();
      const role = node.getAttribute('role');
      const isButton =
        tag === 'button' ||
        role === 'button' ||
        (tag === 'input' && ['button', 'submit'].includes(node.type)) ||
        (tag === 'a' && (node.classList.contains('button') || node.classList.contains('btn') || role === 'button')) ||
        (node.getAttribute('tabindex') === '0' && (node.classList.contains('cursor-pointer') || role === 'button'));

      if (isButton) {
        collected.push(node);
      }

      if (node.shadowRoot) {
        collectButtons(node.shadowRoot, collected);
      }

      if (tag === 'iframe') {
        try {
          if (node.contentDocument) {
            collectButtons(node.contentDocument.body, collected);
          }
        } catch (e) {}
      }
    }

    const children = node.children || node.childNodes || [];
    for (let i = 0; i < children.length; i++) {
      if (children[i].nodeType === Node.ELEMENT_NODE) {
        collectButtons(children[i], collected);
      }
    }

    return collected;
  }

  // Extract surrounding context text without destroying newlines
  function extractContext(buttonEl) {
    let parent = buttonEl.parentElement;
    let contextText = '';
    let depth = 0;

    while (parent && depth < 6) {
      const tag = parent.tagName.toLowerCase();
      const className = (parent.className || '').toString().toLowerCase();
      const role = parent.getAttribute('role') || '';

      const isContainer =
        role === 'dialog' ||
        role === 'alertdialog' ||
        className.includes('prompt') ||
        className.includes('permission') ||
        className.includes('modal') ||
        className.includes('card') ||
        className.includes('action') ||
        className.includes('terminal') ||
        className.includes('dialog') ||
        tag === 'form';

      if (isContainer || depth === 4) {
        const codeEls = parent.querySelectorAll('pre, code, .command, .code, [class*="command"], [class*="code"]');
        if (codeEls.length > 0) {
          contextText = Array.from(codeEls).map((c) => c.textContent).join('\\n');
        } else {
          contextText = parent.textContent || '';
        }
        break;
      }
      parent = parent.parentElement;
      depth++;
    }

    if (!contextText && buttonEl.parentElement) {
      contextText = buttonEl.parentElement.textContent || '';
    }

    return contextText.replace(/\\r\\n/g, '\\n').replace(/\\n{3,}/g, '\\n\\n').trim();
  }

  const buttons = collectButtons(document.body || document.documentElement);
  const candidates = [];

  for (let i = 0; i < buttons.length; i++) {
    const btn = buttons[i];

    if (!isVisible(btn)) continue;
    if (btn.disabled || btn.getAttribute('aria-disabled') === 'true') continue;

    const rawText = (btn.innerText || btn.textContent || btn.value || '').trim();
    const ariaLabel = (btn.getAttribute('aria-label') || btn.getAttribute('title') || '').trim();
    const textToCheck = rawText || ariaLabel;
    if (!textToCheck) continue;

    const lowerText = textToCheck.toLowerCase();

    // Check reject buttons
    const isReject = rejectList.some(
      (rej) => lowerText === rej || lowerText.startsWith(rej + ' ') || lowerText.startsWith(rej + '\\n')
    );
    if (isReject) continue;

    // Check lines for compound buttons like "Run\\n<command>"
    const lines = textToCheck.split(/\\r?\\n/).map((s) => s.trim()).filter(Boolean);
    const firstLine = (lines[0] || '').toLowerCase();

    let matchedAccept = null;
    for (const acc of acceptList) {
      if (
        lowerText === acc ||
        firstLine === acc ||
        lowerText.startsWith(acc + ' ') ||
        lowerText.startsWith(acc + '\\n') ||
        lowerText.startsWith(acc + ':') ||
        firstLine.startsWith(acc + ' ') ||
        firstLine.startsWith(acc + ':') ||
        lowerText.endsWith(' ' + acc)
      ) {
        matchedAccept = acc;
        break;
      }
    }

    // Also check child elements (e.g. <span class="text-secondary-foreground">Run</span>)
    if (!matchedAccept) {
      const childSpans = btn.querySelectorAll('span, b, strong, div');
      for (const sp of childSpans) {
        const spText = (sp.innerText || sp.textContent || '').trim().toLowerCase();
        if (acceptList.includes(spText)) {
          matchedAccept = spText;
          break;
        }
      }
    }

    if (matchedAccept) {
      // Extract command text directly from button payload if present
      let buttonCommand = '';
      if (lines.length > 1) {
        buttonCommand = lines.slice(1).join('\\n');
      } else if (rawText.toLowerCase().startsWith(matchedAccept)) {
        const remainder = rawText.slice(matchedAccept.length).replace(/^[:\\s-]+/, '').trim();
        if (remainder) {
          buttonCommand = remainder;
        }
      }

      // Check inner code elements
      const innerCodeEls = btn.querySelectorAll('pre, code, .command, .code, [class*="command"], [class*="code"]');
      if (innerCodeEls.length > 0) {
        const innerText = Array.from(innerCodeEls).map((el) => el.textContent.trim()).join('\\n');
        if (innerText) {
          buttonCommand = buttonCommand ? buttonCommand + '\\n' + innerText : innerText;
        }
      }

      const rect = btn.getBoundingClientRect();
      const surroundingContext = extractContext(btn);

      // Combine button command payload and surrounding context
      const fullContext = [buttonCommand, surroundingContext].filter(Boolean).join('\\n');
      const markAccepted = btn.getAttribute('data-antigravity-auto-accepted');

      candidates.push({
        index: i,
        buttonText: rawText,
        commandText: buttonCommand,
        contextText: fullContext,
        rect: {
          x: rect.x + rect.width / 2,
          y: rect.y + rect.height / 2,
          width: rect.width,
          height: rect.height,
        },
        hasAcceptedTag: Boolean(markAccepted),
        acceptedAt: markAccepted ? parseInt(markAccepted, 10) : 0,
      });
    }
  }

  return { candidates };
})()
`;
}

/**
 * Returns the JavaScript snippet that performs a full synthetic click on the candidate element.
 * Dispatches PointerEvents, MouseEvents, and element.click().
 */
export function getInPageClickScript(candidateIndex, timestamp) {
  return `
(() => {
  function isInsideSidebar(el) {
    if (!el) return false;
    const excluded = [
      '.sidebar', 'aside', 'nav', '[role="navigation"]',
      '[data-testid*="sidebar"]', '[data-testid="conversation-row-sidebar"]',
      '[data-testid*="history"]', '[class*="sidebar"]', '[class*="conversation-list"]',
      '.explorer-viewlet', '.activitybar'
    ].join(', ');
    return Boolean(el.closest(excluded));
  }

  function collectButtons(node, collected = []) {
    if (!node) return collected;
    if (node.nodeType === Node.ELEMENT_NODE) {
      if (isInsideSidebar(node)) return collected;
      const tag = node.tagName.toLowerCase();
      const role = node.getAttribute('role');
      const isButton =
        tag === 'button' ||
        role === 'button' ||
        (tag === 'input' && ['button', 'submit'].includes(node.type)) ||
        (tag === 'a' && (node.classList.contains('button') || node.classList.contains('btn') || role === 'button')) ||
        (node.getAttribute('tabindex') === '0' && (node.classList.contains('cursor-pointer') || role === 'button'));
      if (isButton) collected.push(node);
      if (node.shadowRoot) collectButtons(node.shadowRoot, collected);
      if (tag === 'iframe') {
        try {
          if (node.contentDocument) collectButtons(node.contentDocument.body, collected);
        } catch (e) {}
      }
    }
    const children = node.children || node.childNodes || [];
    for (let i = 0; i < children.length; i++) {
      if (children[i].nodeType === Node.ELEMENT_NODE) {
        collectButtons(children[i], collected);
      }
    }
    return collected;
  }

  const buttons = collectButtons(document.body || document.documentElement);
  const btn = buttons[${candidateIndex}];
  if (!btn) return { success: false, error: 'Button element at index ${candidateIndex} no longer found' };

  try {
    btn.setAttribute('data-antigravity-auto-accepted', '${timestamp}');

    const rect = btn.getBoundingClientRect();
    const cx = rect.x + rect.width / 2;
    const cy = rect.y + rect.height / 2;

    const eventInit = {
      bubbles: true,
      cancelable: true,
      view: window,
      clientX: cx,
      clientY: cy,
      screenX: cx,
      screenY: cy,
      pointerId: 1,
      isPrimary: true,
      button: 0,
      buttons: 1,
    };

    // Full modern pointer and mouse lifecycle
    if (window.PointerEvent) {
      btn.dispatchEvent(new PointerEvent('pointerover', eventInit));
      btn.dispatchEvent(new PointerEvent('pointerenter', eventInit));
      btn.dispatchEvent(new PointerEvent('pointerdown', eventInit));
    }

    btn.dispatchEvent(new MouseEvent('mousedown', eventInit));

    if (window.PointerEvent) {
      btn.dispatchEvent(new PointerEvent('pointerup', eventInit));
    }

    btn.dispatchEvent(new MouseEvent('mouseup', eventInit));
    btn.dispatchEvent(new MouseEvent('click', eventInit));

    if (typeof btn.click === 'function') {
      btn.click();
    }

    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
})()
`;
}
