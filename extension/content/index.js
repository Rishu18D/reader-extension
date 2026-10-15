import { toggleBionicMode } from './bionic.js';
import { extractArticle } from './extractor.js';

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'GET_BIONIC_STATE') {
    sendResponse({ active: document.querySelector('.focusflow-bionic-node') !== null });
    return false;
  }

  if (request.action === 'TOGGLE_BIONIC') {
    const state = toggleBionicMode();
    sendResponse({ active: state });
  }

  if (request.action === 'GET_ARTICLE_CRUX') {
    try {
      const articleData = extractArticle();
      sendResponse({ success: true, data: articleData });
    } catch (err) {
      sendResponse({ success: false, error: err.message });
    }
  }

  return true;
});