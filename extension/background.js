chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'toggle-bionic') {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id) {
        await chrome.tabs.sendMessage(tab.id, { action: 'TOGGLE_BIONIC' });
      }
    } catch (error) {
      console.error('FocusFlow could not toggle bionic reading on this page:', error);
    }
  }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action !== 'OPEN_READER_TAB') {
    return false;
  }

  const rawText = request.payload?.rawText;
  if (typeof rawText !== 'string' || !rawText.trim()) {
    sendResponse({ status: 'error', error: 'No readable article text was provided.' });
    return false;
  }

  const articleId = crypto.randomUUID();
  const storageKey = `article:${articleId}`;
  chrome.storage.local.set({ [storageKey]: request.payload }, () => {
    if (chrome.runtime.lastError) {
      sendResponse({ status: 'error', error: 'Could not save the article for the reader.' });
      return;
    }

    chrome.tabs.create(
      { url: chrome.runtime.getURL(`reader.html?article=${encodeURIComponent(articleId)}`) },
      () => {
        if (chrome.runtime.lastError) {
          chrome.storage.local.remove(storageKey);
          sendResponse({ status: 'error', error: 'Could not open the reader tab.' });
          return;
        }
        sendResponse({ status: 'ok' });
      }
    );
  });
  return true;
});