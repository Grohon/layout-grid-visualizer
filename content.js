(function() {
if (window.__layoutGridVisualizerInjected) {
  return;
}
window.__layoutGridVisualizerInjected = true;

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
let gridRulerOverlay = null;
let isGridRulerVisible = false;

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
  overlayPosition.x = pos.gridOverlayX;
  overlayPosition.y = pos.gridOverlayY;
});

// Load gridClickable state from storage on script load
chrome.storage.sync.get({ gridClickable: true }, (result) => {
  gridClickable = result.gridClickable;
  if (gridOverlay) {
    gridOverlay.style.pointerEvents = gridClickable ? 'auto' : 'none';
  }
});

// On load, restore grid ruler state
chrome.storage.sync.get({ gridRuler: false }, (result) => {
  if (result.gridRuler) {
    showGridRuler();
    isGridRulerVisible = true;
  }
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
      // Async: fetch settings and create grid, then respond
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
        sendResponse(); // Respond after async operation
      });
      return true; // Indicate async response
    } else {
      removeGrid();
      isGridVisible = false;
      sendResponse(); // Synchronous response
    }
  } else if (request.action === 'updateGrid') {
    // Synchronous: update grid settings and respond
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
    sendResponse(); // Synchronous response
  } else if (request.action === 'getGridState') {
    sendResponse({ isVisible: isGridVisible }); // Synchronous response with data
  } else if (request.action === 'centerGrid') {
    overlayPosition.x = null;
    overlayPosition.y = null;
    updateGridStyles();
    chrome.storage.sync.set({ gridOverlayX: null, gridOverlayY: null });
    sendResponse(); // Synchronous response
  } else if (request.action === 'setGridClickable') {
    gridClickable = request.value;
    if (gridOverlay) {
      gridOverlay.style.pointerEvents = gridClickable ? 'auto' : 'none';
    }
    sendResponse(); // Synchronous response
  } else if (request.action === 'setGridRuler') {
    if (request.value) {
      showGridRuler();
    } else {
      removeGridRuler();
    }
    // chrome.storage.sync.set({ gridRuler: request.value });
    sendResponse(); // Synchronous response
  }
  // Always return true to indicate we may respond asynchronously
  return true;
});

function createGrid() {
  if (gridOverlay) removeGrid();
  isGridVisible = true;

  gridOverlay = document.createElement('div');
  gridOverlay.id = 'layout-grid-visualizer';
  gridOverlay.style.cursor = 'move';
  gridOverlay.tabIndex = 0; // Make focusable

  // Set up columns
  let colWidths = [];
  let numCols = 0;

  if (Array.isArray(settings.splitColumns) && settings.splitColumns.length > 0 && settings.splitColumns.some(v => Number(v) > 0)) {
    // Split grid mode
    const splitColumns = settings.splitColumns.map(Number);
    const total = splitColumns.reduce((a, b) => a + b, 0);
    numCols = splitColumns.length;
    const availableWidth = settings.gridWidth + settings.gutterSize;
    colWidths = splitColumns.map(val => availableWidth * (val / total) - settings.gutterSize);
  } else {
    // Uniform grid mode
    numCols = parseInt(settings.columns);
    if (!Number.isFinite(numCols) || numCols < 1) numCols = 12;
    const totalGutter = settings.gutterSize * (numCols - 1);
    const availableWidth = settings.gridWidth - totalGutter;
    const columnWidth = availableWidth / numCols;
    colWidths = Array(numCols).fill(columnWidth);
  }

  for (let i = 0; i < numCols; i++) {
    const column = document.createElement('div');
    column.className = 'grid-column';
    column.style.width = `${colWidths[i]}px`;
    column.style.marginRight = i < numCols - 1 ? `${settings.gutterSize}px` : '0';
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

  // Apply pointer events
  gridOverlay.style.pointerEvents = gridClickable ? 'auto' : 'none';
}

function removeGrid() {
  if (gridOverlay && gridOverlay.parentNode) {
    gridOverlay.parentNode.removeChild(gridOverlay);
  }
  gridOverlay = null;
  isGridVisible = false;
}

// --- Grid Ruler Implementation ---
function showGridRuler() {
  if (gridRulerOverlay) return;
  gridRulerOverlay = document.createElement('div');
  gridRulerOverlay.id = 'layout-grid-ruler-overlay';
  gridRulerOverlay.style.position = 'fixed';
  gridRulerOverlay.style.top = '0';
  gridRulerOverlay.style.left = '0';
  gridRulerOverlay.style.width = '100vw';
  gridRulerOverlay.style.height = '100vh';
  gridRulerOverlay.style.pointerEvents = 'none';
  gridRulerOverlay.style.zIndex = '10000';
  gridRulerOverlay.style.display = 'block';
  gridRulerOverlay.style.background = 'none';
  gridRulerOverlay.innerHTML = createRulerSVG();
  document.body.appendChild(gridRulerOverlay);
}

function removeGridRuler() {
  if (gridRulerOverlay && gridRulerOverlay.parentNode) {
    gridRulerOverlay.parentNode.removeChild(gridRulerOverlay);
  }
  gridRulerOverlay = null;
}

function createRulerSVG() {
  // Create SVG for horizontal and vertical rulers with ticks and numbers
  const width = window.innerWidth;
  const height = window.innerHeight;
  const majorTick = 50;
  const minorTick = 10;
  const rulerThickness = 24;
  let svg = `<svg width='${width}' height='${height}' style='position:absolute;top:0;left:0;pointer-events:none;'>`;
  // Horizontal ruler (top)
  svg += `<rect x='0' y='0' width='${width}' height='${rulerThickness}' fill='rgba(240,240,240,0.95)' stroke='#bbb'/>`;
  for (let x = 0; x < width; x += minorTick) {
    let isMajor = x % majorTick === 0;
    let tickHeight = isMajor ? rulerThickness : rulerThickness / 2;
    let color = isMajor ? '#888' : '#bbb';
    svg += `<line x1='${x}' y1='0' x2='${x}' y2='${tickHeight}' stroke='${color}' stroke-width='1'/>`;
    if (isMajor && x > 0) {
      svg += `<text x='${x + 2}' y='${rulerThickness - 6}' font-size='10' fill='#444' font-family='monospace'>${x}</text>`;
    }
  }
  // Vertical ruler (left)
  svg += `<rect x='0' y='0' width='${rulerThickness}' height='${height}' fill='rgba(240,240,240,0.95)' stroke='#bbb'/>`;
  for (let y = 0; y < height; y += minorTick) {
    let isMajor = y % majorTick === 0;
    let tickWidth = isMajor ? rulerThickness : rulerThickness / 2;
    let color = isMajor ? '#888' : '#bbb';
    svg += `<line x1='0' y1='${y}' x2='${tickWidth}' y2='${y}' stroke='${color}' stroke-width='1'/>`;
    if (isMajor && y > 0) {
      svg += `<text x='2' y='${y - 2}' font-size='10' fill='#444' font-family='monospace'>${y}</text>`;
    }
  }
  svg += `</svg>`;
  return svg;
}

// Redraw ruler on resize
window.addEventListener('resize', () => {
  if (gridRulerOverlay && isGridRulerVisible) {
    gridRulerOverlay.innerHTML = createRulerSVG();
  }
});
})();