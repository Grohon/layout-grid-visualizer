// Service worker for Layout Grid Visualizer
// Handles keyboard shortcut to toggle grid overlay

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== 'toggle-grid') return;

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;

  // Ensure content script and CSS are injected
  try {
    await chrome.scripting.insertCSS({ target: { tabId: tab.id }, files: ['grid-overlay.css'] });
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
  } catch {
    // Restricted page (chrome://, edge://, Web Store, etc.) — silently ignore
    return;
  }

  // Toggle the grid in the content script
  try {
    await chrome.tabs.sendMessage(tab.id, { action: 'toggleGrid' });
  } catch {
    // Content script not ready — silently ignore
  }
});
