// Service worker for Layout Grid Visualizer
// Handles keyboard shortcut to toggle grid overlay

async function isContentScriptAlive(tabId) {
  try {
    await chrome.tabs.sendMessage(tabId, { type: 'ping' });
    return true;
  } catch {
    return false;
  }
}

async function ensureContentScriptInjected(tabId) {
  if (await isContentScriptAlive(tabId)) return true;

  try {
    await chrome.scripting.insertCSS({ target: { tabId }, files: ['grid-overlay.css'] });
    await chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] });
    return true;
  } catch {
    // Restricted page (chrome://, edge://, Web Store, etc.) — silently ignore
    return false;
  }
}

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== 'toggle-grid') return;

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;

  if (!(await ensureContentScriptInjected(tab.id))) return;

  // Toggle the grid in the content script
  try {
    await chrome.tabs.sendMessage(tab.id, { action: 'toggleGrid' });
  } catch {
    // Content script not ready — silently ignore
  }
});
