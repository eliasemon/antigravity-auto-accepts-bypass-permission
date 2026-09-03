import http from 'http';
import WebSocket from 'ws';
import fs from 'fs';

const port = fs.readFileSync('/Users/eliasemon/Library/Application Support/Antigravity/DevToolsActivePort', 'utf8').trim().split('\n')[0];

http.get(`http://127.0.0.1:${port}/json/list`, (res) => {
  let body = '';
  res.on('data', (c) => (body += c));
  res.on('end', () => {
    const list = JSON.parse(body);
    const pageTarget = list.find((t) => t.type === 'page');
    const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);

    ws.on('open', () => {
      const code = `
        (() => {
          const all = Array.from(document.querySelectorAll('*'));
          const actionItems = [];
          
          for (const el of all) {
            const role = el.getAttribute('role');
            const isClickable = el.tagName === 'BUTTON' || role === 'button' || el.onclick != null || el.getAttribute('tabindex') === '0';
            if (!isClickable) continue;

            const text = (el.innerText || el.textContent || '').trim();
            if (!text) continue;

            // Check if matches common action keywords anywhere in first 30 chars
            const firstLine = text.split('\\n')[0].trim();
            if (['run', 'accept', 'allow', 'proceed', 'approve', 'execute', 'confirm', 'apply', 'always allow', 'yes'].some(kw => firstLine.toLowerCase() === kw || firstLine.toLowerCase().startsWith(kw))) {
              actionItems.push({
                tagName: el.tagName,
                role: role,
                className: el.className,
                firstLine: firstLine,
                fullText: text.slice(0, 150),
                rect: el.getBoundingClientRect(),
                visible: el.offsetParent !== null && el.getBoundingClientRect().width > 0,
                htmlSnippet: el.outerHTML.slice(0, 200)
              });
            }
          }

          return actionItems;
        })()
      `;

      ws.send(JSON.stringify({ id: 1, method: 'Runtime.enable' }));
      setTimeout(() => {
        ws.send(JSON.stringify({ id: 2, method: 'Runtime.evaluate', params: { expression: code, returnByValue: true } }));
      }, 100);
    });

    ws.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.id === 2) {
        console.log('Action elements found:', JSON.stringify(msg.result?.result?.value, null, 2));
        process.exit(0);
      }
    });
  });
});
