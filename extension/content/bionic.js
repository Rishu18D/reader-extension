let isBionicActive = false;

export function toggleBionicMode() {
  if (isBionicActive) {
    const processedNodes = document.querySelectorAll('.focusflow-bionic-node');
    processedNodes.forEach((span) => {
      const textNode = document.createTextNode(span.getAttribute('data-original') ?? span.textContent ?? '');
      span.parentNode.replaceChild(textNode, span);
    });
    isBionicActive = false;
    return false;
  }

  const ignoredTags = new Set([
    'SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA', 'INPUT',
    'CODE', 'PRE', 'SELECT', 'BUTTON', 'SVG', 'CANVAS', 'IFRAME'
  ]);

  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode(node) {
        if (!node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
        const parent = node.parentElement;
        if (!parent || ignoredTags.has(parent.tagName)) return NodeFilter.FILTER_REJECT;
        if (parent.closest('[contenteditable="true"]') || parent.closest('.focusflow-bionic-node')) {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      }
    }
  );

  const textNodes = [];
  while (walker.nextNode()) {
    textNodes.push(walker.currentNode);
  }

  textNodes.forEach((node) => {
    const originalText = node.nodeValue ?? '';
    const span = document.createElement('span');
    span.className = 'focusflow-bionic-node';
    span.setAttribute('data-original', originalText);
    const parts = originalText.split(/(\b[A-Za-z0-9]+\b)/g);
    parts.forEach((part) => {
      if (/^[A-Za-z0-9]+$/.test(part)) {
        const bold = document.createElement('b');
        bold.textContent = part.slice(0, part.length <= 3 ? 1 : Math.ceil(part.length * 0.45));
        span.appendChild(bold);
        span.appendChild(document.createTextNode(part.slice(bold.textContent.length)));
      } else {
        span.appendChild(document.createTextNode(part));
      }
    });
    node.parentNode.replaceChild(span, node);
  });

  isBionicActive = true;
  return true;
}