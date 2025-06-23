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

function settingsAffectStructure(newSettings) {
  return (
    newSettings.gridWidth !== settings.gridWidth ||
    newSettings.columns !== settings.columns ||
    newSettings.gutterSize !== settings.gutterSize
  );
}

// Load position from storage
chrome.storage.sync.get({ gridOverlayX: null, gridOverlayY: null }, (pos) => {
  overlayPosition.x = pos.gridOverlayX;
  overlayPosition.y = pos.gridOverlayY;
});

function makeDraggable(element) {
  let isDragging = false;
  let startX, startY, origX, origY;

  element.addEventListener('mousedown', (e) => {
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
  });

  window.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    overlayPosition.x = origX + dx;
    overlayPosition.y = origY + dy;
    updateGridStyles();
  });

  window.addEventListener('mouseup', () => {
    if (isDragging) {
      isDragging = false;
      document.body.style.userSelect = '';
      chrome.storage.sync.set({
        gridOverlayX: overlayPosition.x,
        gridOverlayY: overlayPosition.y
      });
    }
  });
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

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'toggleGrid') {
    if (!isGridVisible) {
      // Fetch latest settings before creating the grid
      chrome.storage.sync.get({
        gridWidth: 1320,
        columns: 12,
        gutterSize: 32,
        gridColor: '#1a73e8',
        opacity: 0.3
      }, (storedSettings) => {
        settings = { ...settings, ...storedSettings };
        createGrid();
        isGridVisible = true;
      });
      return true; // async response
    } else {
      removeGrid();
      isGridVisible = false;
      // No async response needed
    }
  } else if (request.action === 'updateGrid') {
    const needsRebuild = settingsAffectStructure(request.settings);
    settings = { ...settings, ...request.settings };
    if (gridOverlay) {
      if (needsRebuild) {
        createGrid();
      } else {
        updateGridStyles();
      }
    }
    // No async response needed
  } else if (request.action === 'getGridState') {
    sendResponse({ isVisible: isGridVisible });
    // Synchronous response
  } else if (request.action === 'centerGrid') {
    overlayPosition.x = null;
    overlayPosition.y = null;
    updateGridStyles();
    chrome.storage.sync.set({ gridOverlayX: null, gridOverlayY: null });
    // No async response needed
  }
  // Only return true if an async response will be sent
});

function createGrid() {
  if (gridOverlay) {
    removeGrid();
  }
  isGridVisible = true;

  gridOverlay = document.createElement('div');
  gridOverlay.id = 'layout-grid-visualizer';
  gridOverlay.style.cursor = 'move';
  gridOverlay.tabIndex = 0; // Make focusable

  const columnWidth = (settings.gridWidth - (settings.gutterSize * (settings.columns - 1))) / settings.columns;

  // Create columns
  for (let i = 0; i < settings.columns; i++) {
    const column = document.createElement('div');
    column.className = 'grid-column';
    column.style.width = `${columnWidth}px`;
    column.style.marginRight = i < settings.columns - 1 ? `${settings.gutterSize}px` : '0';
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
    z-index: 9999;
    cursor: move;
    background: none;
  `;

  const columns = gridOverlay.getElementsByClassName('grid-column');
  for (const column of columns) {
    column.style.backgroundColor = settings.gridColor;
    column.style.opacity = settings.opacity;
  }
}

function removeGrid() {
  if (gridOverlay && gridOverlay.parentNode) {
    gridOverlay.parentNode.removeChild(gridOverlay);
  }
  gridOverlay = null;
  isGridVisible = false;
}
