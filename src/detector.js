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
  const acceptList = ${JSON.stringify(acceptLabels.map(l => l.trim().toLowerCase()))};
  const rejectList = ${JSON.stringify(rejectLabels.map(l => l.trim().toLowerCase()))};

  // Helper to check element visibility
  function isVisible(el) {
    if (!el) return false;
    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  // Recursive DOM scanner collecting all button-like elements across shadow roots and iframes
  function collectButtons(node, collected = []) {
    if (!node) return collected;

    // Check if current node is a button or interactive action element
    if (node.nodeType === Node.ELEMENT_NODE) {
      const tag = node.tagName.toLowerCase();
      const role = node.getAttribute('role');
      const isButton = tag === 'button' ||
        role === 'button' ||
        (tag === 'input' && ['button', 'submit'].includes(node.type)) ||
        (tag === 'a' && (node.classList.contains('button') || node.classList.contains('btn') || role === 'button'));

      if (isButton) {
        collected.push(node);
      }

      // Traverse shadow DOM if present
      if (node.shadowRoot) {
        collectButtons(node.shadowRoot, collected);
      }

      // Traverse child iframe if same-origin and accessible
      if (tag === 'iframe') {
        try {
          if (node.contentDocument) {
            collectButtons(node.contentDocument.body, collected);
          }
        } catch (e) {
          // Cross-origin iframe, skipped
        }
      }
    }

    // Traverse light DOM children
    const children = node.children || node.childNodes || [];
    for (let i = 0; i < children.length; i++) {
      if (children[i].nodeType === Node.ELEMENT_NODE) {
        collectButtons(children[i], collected);
      }
    }

    return collected;
  }

  // Extract surrounding context text (command, diff, description, tool call)
  function extractContext(buttonEl) {
    let parent = buttonEl.parentElement;
    let contextText = '';
    let depth = 0;

    // Search upwards for prompt container, modal, or card
    while (parent && depth < 6) {
      const tag = parent.tagName.toLowerCase();
      const className = (parent.className || '').toString().toLowerCase();
      const role = parent.getAttribute('role') || '';

      const isContainer = role === 'dialog' ||
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
        // Collect pre, code, or overall text
        const codeEls = parent.querySelectorAll('pre, code, .command, .code, [class*="command"], [class*="code"]');
        if (codeEls.length > 0) {
          contextText = Array.from(codeEls).map(c => c.textContent).join('\\n');
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

    return contextText.trim().replace(/\\s+/g, ' ');
  }

  const buttons = collectButtons(document.body || document.documentElement);
  const candidates = [];

  for (let i = 0; i < buttons.length; i++) {
    const btn = buttons[i];

    if (!isVisible(btn)) continue;
    if (btn.disabled || btn.getAttribute('aria-disabled') === 'true') continue;

    // Get visible text (including text inside child spans/divs or aria-label/value)
    const text = (btn.innerText || btn.textContent || btn.value || btn.getAttribute('aria-label') || '').trim();
    if (!text) continue;

    const lowerText = text.toLowerCase();

    // Skip reject/cancel buttons explicitly
    const isReject = rejectList.some(rej => lowerText === rej || lowerText.startsWith(rej + ' '));
    if (isReject) continue;

    // Match accept labels
    const isAccept = acceptList.some(acc => {
      return lowerText === acc || lowerText.startsWith(acc + ' ') || lowerText.endsWith(' ' + acc);
    });

    if (isAccept) {
      const rect = btn.getBoundingClientRect();
      const context = extractContext(btn);
      const markAccepted = btn.getAttribute('data-antigravity-auto-accepted');

      candidates.push({
        index: i,
        buttonText: text,
        contextText: context,
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
 * Returns the JavaScript snippet that performs a click on the candidate element.
 */
export function getInPageClickScript(candidateIndex, timestamp) {
  return `
(() => {
  // Re-run collector to get elements
  function collectButtons(node, collected = []) {
    if (!node) return collected;
    if (node.nodeType === Node.ELEMENT_NODE) {
      const tag = node.tagName.toLowerCase();
      const role = node.getAttribute('role');
      const isButton = tag === 'button' ||
        role === 'button' ||
        (tag === 'input' && ['button', 'submit'].includes(node.type)) ||
        (tag === 'a' && (node.classList.contains('button') || node.classList.contains('btn') || role === 'button'));
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

    // Dispatch full pointer and mouse event lifecycle
    const mousedown = new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window });
    const mouseup = new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window });
    const click = new MouseEvent('click', { bubbles: true, cancelable: true, view: window });

    btn.dispatchEvent(mousedown);
    btn.dispatchEvent(mouseup);
    btn.dispatchEvent(click);

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
