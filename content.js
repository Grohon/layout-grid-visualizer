(function() {
// Re-injection replaces an older instance (for example after an extension reload)
if (typeof window.__layoutGridVisualizerCleanup === 'function') {
  try {
    window.__layoutGridVisualizerCleanup();
  } catch {
    // Old instance is stale — ignore cleanup failures
  }
}

function handlePingMessage(msg, sender, sendResponse) {
  if (msg.type === "ping") {
    sendResponse({ status: "alive" });
  }
}

chrome.runtime.onMessage.addListener(handlePingMessage);
chrome.runtime.onMessage.addListener(handleRuntimeMessage);

let gridOverlay = null;
let settings = {
  gridWidth: 1320,
  columns: 12,
  gutterSize: 32,
  gridColor: '#1a73e8',
  opacity: 0.3
};
let overlayPosition = { x: null, y: null };
let isGridVisible = false;
let gridClickable = true;
let cleanupDragListeners = null;

const MAX_COLUMNS = 100;
const MAX_SPLIT_COLUMNS = 6;

// Largest gutter that still leaves every column with a positive width.
function getMaxGutter(gridWidth, columns, splitColumns) {
  if (!(gridWidth > 0)) return 0;

  if (Array.isArray(splitColumns) && splitColumns.length > 0) {
    const total = splitColumns.reduce((sum, ratio) => sum + ratio, 0);
    if (!(total > 0)) return 0;

    let max = Infinity;
    for (const ratio of splitColumns) {
      const remaining = total - ratio;
      if (remaining > 0) {
        max = Math.min(max, (gridWidth * ratio) / remaining);
      }
    }
    return Number.isFinite(max) ? Math.ceil(max) - 1 : Math.floor(gridWidth) - 1;
  }

  if (columns <= 1) return Math.floor(gridWidth) - 1;
  return Math.floor((gridWidth - 1) / (columns - 1));
}

function settingsAffectStructure(newSettings) {
  // Check if splitColumns changed (for split mode)
  const currentSplitColumns = settings.splitColumns;
  const newSplitColumns = newSettings.splitColumns;
  const splitColumnsChanged = (
    (Array.isArray(currentSplitColumns) && Array.isArray(newSplitColumns) &&
     JSON.stringify(currentSplitColumns) !== JSON.stringify(newSplitColumns)) ||
    (!Array.isArray(currentSplitColumns) && Array.isArray(newSplitColumns)) ||
    (Array.isArray(currentSplitColumns) && !Array.isArray(newSplitColumns))
  );

  // Check if we're switching between split and uniform modes
  const currentIsSplit = Array.isArray(settings.splitColumns) && settings.splitColumns.length > 0;
  const newIsSplit = Array.isArray(newSettings.splitColumns) && newSettings.splitColumns.length > 0;
  const modeChanged = currentIsSplit !== newIsSplit;

  const result = (
    newSettings.gridWidth !== settings.gridWidth ||
    newSettings.gutterSize !== settings.gutterSize ||
    splitColumnsChanged ||
    modeChanged ||
    // For uniform mode, check columns
    (newSettings.columns !== settings.columns && !Array.isArray(newSettings.splitColumns))
  );

  return result;
}

// Load position from storage
chrome.storage.sync.get({ gridOverlayX: null, gridOverlayY: null }, (pos) => {
  if (chrome.runtime.lastError) return;
  overlayPosition.x = pos.gridOverlayX;
  overlayPosition.y = pos.gridOverlayY;
});

// Load gridClickable state from storage on script load
chrome.storage.sync.get({ gridClickable: true }, (result) => {
  if (chrome.runtime.lastError) return;
  gridClickable = result.gridClickable;
  if (gridOverlay) {
    gridOverlay.style.pointerEvents = gridClickable ? 'auto' : 'none';
  }
});

function makeDraggable(element) {
  if (cleanupDragListeners) {
    cleanupDragListeners();
    cleanupDragListeners = null;
  }

  let isDragging = false;
  let startX, startY, origX, origY;

  const handleMouseDown = (e) => {
    isDragging = true;
    startX = e.clientX;
    startY = e.clientY;
    if (overlayPosition.x !== null && overlayPosition.y !== null) {
      origX = overlayPosition.x;
      origY = overlayPosition.y;
    } else {
      // Calculate current center position in pixels
      const rect = gridOverlay.getBoundingClientRect();
      origX = rect.left;
      origY = rect.top;
    }
    document.body.style.userSelect = 'none';
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    overlayPosition.x = origX + dx;
    overlayPosition.y = origY + dy;
    updateGridStyles();
  };

  const handleMouseUp = () => {
    if (isDragging) {
      isDragging = false;
      document.body.style.userSelect = '';
      chrome.storage.sync.set({
        gridOverlayX: overlayPosition.x,
        gridOverlayY: overlayPosition.y
      });
    }
  };

  element.addEventListener('mousedown', handleMouseDown);
  window.addEventListener('mousemove', handleMouseMove);
  window.addEventListener('mouseup', handleMouseUp);

  cleanupDragListeners = () => {
    element.removeEventListener('mousedown', handleMouseDown);
    window.removeEventListener('mousemove', handleMouseMove);
    window.removeEventListener('mouseup', handleMouseUp);
    document.body.style.userSelect = '';
    isDragging = false;
  };
}

function makeKeyboardMovable(element) {
  element.addEventListener('keydown', function(e) {
    let moved = false;
    let step = e.shiftKey ? 10 : 1;
    if (e.key === 'ArrowLeft') {
      overlayPosition.x = (overlayPosition.x ?? element.getBoundingClientRect().left) - step;
      moved = true;
    } else if (e.key === 'ArrowRight') {
      overlayPosition.x = (overlayPosition.x ?? element.getBoundingClientRect().left) + step;
      moved = true;
    } else if (e.key === 'ArrowUp') {
      overlayPosition.y = (overlayPosition.y ?? element.getBoundingClientRect().top) - step;
      moved = true;
    } else if (e.key === 'ArrowDown') {
      overlayPosition.y = (overlayPosition.y ?? element.getBoundingClientRect().top) + step;
      moved = true;
    }
    if (moved) {
      e.preventDefault();
      updateGridStyles();
      chrome.storage.sync.set({
        gridOverlayX: overlayPosition.x,
        gridOverlayY: overlayPosition.y
      });
    }
  });
  // Optional: focus overlay on click for keyboard movement
  element.addEventListener('mousedown', function() {
    element.focus();
  });
}

function handleRuntimeMessage(request, sender, sendResponse) {
  if (request.action === 'toggleGrid') {
    if (!isGridVisible) {
      // Async: fetch settings and create grid, then respond
      chrome.storage.sync.get({
        gridWidth: 1320,
        columns: 12,
        gutterSize: 32,
        gridColor: '#1a73e8',
        opacity: 0.3,
        splitGridState: false,
        splitColumnValues: [12]
      }, (storedSettings) => {
        if (chrome.runtime.lastError) {
          sendResponse();
          return;
        }
        const { splitGridState, splitColumnValues, ...baseSettings } = storedSettings;
        settings = { ...settings, ...baseSettings };
        if (splitGridState && Array.isArray(splitColumnValues) && splitColumnValues.length > 0) {
          settings.splitColumns = splitColumnValues;
        } else {
          delete settings.splitColumns;
        }
        createGrid();
        isGridVisible = true;
        sendResponse();
      });
      return true; // Indicate async response
    } else {
      removeGrid();
      isGridVisible = false;
      sendResponse();
    }
  } else if (request.action === 'updateGrid') {
    const needsRebuild = settingsAffectStructure(request.settings);

    // Properly merge settings, handling undefined values
    settings = { ...settings, ...request.settings };

    // Explicitly handle undefined values for splitColumns and columns
    if (request.settings.splitColumns === undefined) {
      delete settings.splitColumns;
    }

    if (request.settings.columns === undefined) {
      delete settings.columns;
    }
    if (gridOverlay) {
      if (needsRebuild) {
        createGrid();
      } else {
        updateGridStyles();
      }
    }
    sendResponse();
  } else if (request.action === 'getGridState') {
    sendResponse({ isVisible: isGridVisible });
  } else if (request.action === 'centerGrid') {
    overlayPosition.x = null;
    overlayPosition.y = null;
    updateGridStyles();
    chrome.storage.sync.set({ gridOverlayX: null, gridOverlayY: null });
    sendResponse();
  } else if (request.action === 'setGridClickable') {
    gridClickable = request.value;
    if (gridOverlay) {
      gridOverlay.style.pointerEvents = gridClickable ? 'auto' : 'none';
    }
    sendResponse();
  }
  // Always return true to indicate we may respond asynchronously
  return true;
}

function createGrid() {
  if (gridOverlay) removeGrid();
  isGridVisible = true;

  gridOverlay = document.createElement('div');
  gridOverlay.id = 'layout-grid-visualizer';
  gridOverlay.style.cursor = 'move';
  gridOverlay.tabIndex = 0; // Make focusable
  gridOverlay.setAttribute('role', 'group');
  gridOverlay.setAttribute('aria-label', 'Layout grid overlay. Use arrow keys to move, Shift plus arrow keys for larger steps.');
  gridOverlay.setAttribute('aria-roledescription', 'Draggable layout grid');
  gridOverlay.setAttribute('aria-keyshortcuts', 'ArrowUp ArrowDown ArrowLeft ArrowRight');

  // Set up columns
  let colWidths = [];
  let numCols = 0;

  const splitColumns = Array.isArray(settings.splitColumns)
    ? settings.splitColumns
        .map(Number)
        .filter(value => Number.isFinite(value) && value > 0)
        .slice(0, MAX_SPLIT_COLUMNS)
    : [];

  if (splitColumns.length > 0) {
    // Split grid mode
    settings.splitColumns = splitColumns;
    numCols = splitColumns.length;
  } else {
    // Uniform grid mode
    delete settings.splitColumns;
    numCols = parseInt(settings.columns, 10);
    if (!Number.isFinite(numCols) || numCols < 1) numCols = 12;
    numCols = Math.min(numCols, MAX_COLUMNS);
  }

  // Guard against legacy or hand-edited settings that cannot fit on screen.
  const gridWidth = Number(settings.gridWidth) > 0 ? Number(settings.gridWidth) : 1320;
  const requestedGutter = Number(settings.gutterSize) > 0 ? Number(settings.gutterSize) : 0;
  const maxGutter = getMaxGutter(gridWidth, numCols, splitColumns);
  const gutterSize = Math.max(0, Math.min(requestedGutter, maxGutter));
  settings.gridWidth = gridWidth;
  settings.gutterSize = gutterSize;

  if (splitColumns.length > 0) {
    const total = splitColumns.reduce((a, b) => a + b, 0);
    const availableWidth = gridWidth + gutterSize;
    colWidths = splitColumns.map(val => availableWidth * (val / total) - gutterSize);
  } else {
    const totalGutter = gutterSize * (numCols - 1);
    const availableWidth = gridWidth - totalGutter;
    const columnWidth = availableWidth / numCols;
    colWidths = Array(numCols).fill(columnWidth);
  }

  for (let i = 0; i < numCols; i++) {
    const column = document.createElement('div');
    column.className = 'grid-column';
    column.setAttribute('aria-hidden', 'true');
    column.style.width = `${colWidths[i]}px`;
    column.style.marginRight = i < numCols - 1 ? `${gutterSize}px` : '0';
    gridOverlay.appendChild(column);
  }

  updateGridStyles();
  document.body.appendChild(gridOverlay);
  makeDraggable(gridOverlay);
  makeKeyboardMovable(gridOverlay);
}

function updateGridStyles() {
  if (!gridOverlay) return;

  let left = '50%';
  let top = '0';
  let transform = 'translateX(-50%)';
  if (overlayPosition.x !== null && overlayPosition.y !== null) {
    left = overlayPosition.x + 'px';
    top = overlayPosition.y + 'px';
    transform = '';
  }

  gridOverlay.style.cssText = `
    position: fixed;
    top: ${top};
    left: ${left};
    transform: ${transform};
    width: ${settings.gridWidth}px;
    height: 100vh;
    display: flex;
    z-index: 100000;
    cursor: move;
    background: none;
    pointer-events: ${gridClickable ? 'auto' : 'none'};
  `;

  const columns = gridOverlay.getElementsByClassName('grid-column');
  for (const column of columns) {
    column.style.backgroundColor = settings.gridColor;
    column.style.opacity = settings.opacity;
  }
}

function removeGrid() {
  if (cleanupDragListeners) {
    cleanupDragListeners();
    cleanupDragListeners = null;
  }
  if (gridOverlay && gridOverlay.parentNode) {
    gridOverlay.parentNode.removeChild(gridOverlay);
  }
  gridOverlay = null;
  isGridVisible = false;
}

window.__layoutGridVisualizerCleanup = () => {
  try {
    removeGrid();
  } catch {
    // Ignore cleanup errors from a stale extension context
  }
  try {
    chrome.runtime.onMessage.removeListener(handlePingMessage);
    chrome.runtime.onMessage.removeListener(handleRuntimeMessage);
  } catch {
    // Ignore cleanup errors from a stale extension context
  }
};
})();