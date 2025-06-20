const DEFAULTS = {
  gridWidth: 1320,
  columns: 12,
  gutterSize: 32,
  gridColor: '#1a73e8',
  opacity: 0.3
};

function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

document.addEventListener('DOMContentLoaded', () => {
  chrome.storage.sync.get({ ...DEFAULTS }, (settings) => {
    document.getElementById('gridWidth').value = settings.gridWidth;
    document.getElementById('columns').value = settings.columns;
    document.getElementById('gutterSize').value = settings.gutterSize;
    document.getElementById('gridColor').value = settings.gridColor;
    document.getElementById('opacity').value = settings.opacity;
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      chrome.tabs.sendMessage(tabs[0].id, { action: 'getGridState' }, (response) => {
        setCurrentGridVisible(response && response.isVisible);
      });
    });
  });

  // Use 'input' for all fields for instant feedback
  ['gridWidth', 'columns', 'gutterSize', 'opacity'].forEach(id => {
    document.getElementById(id).addEventListener('input', saveSettings);
  });
  document.getElementById('gridColor').addEventListener('input', saveSettings);

  document.getElementById('toggleGrid').addEventListener('click', () => {
    setCurrentGridVisible(!currentGridVisible);
    toggleGrid();
  });
  document.getElementById('centerGrid').addEventListener('click', centerGrid);
  document.getElementById('resetGrid').addEventListener('click', resetToDefaults);
});

let currentGridVisible = false;

function setCurrentGridVisible(val) {
  currentGridVisible = val;
  updateToggleButton(currentGridVisible);
}

function saveSettings() {
  let gridWidth = Math.max(1, parseInt(document.getElementById('gridWidth').value) || DEFAULTS.gridWidth);
  let columns = Math.max(1, parseInt(document.getElementById('columns').value) || DEFAULTS.columns);
  let gutterSize = parseInt(document.getElementById('gutterSize').value);
  let gridColor = document.getElementById('gridColor').value || DEFAULTS.gridColor;
  let opacity = clamp(parseFloat(document.getElementById('opacity').value), 0, 1);

  // Prevent gutter size from being 0 or less
  if (!gutterSize || gutterSize <= 0) {
    gutterSize = DEFAULTS.gutterSize;
    document.getElementById('gutterSize').value = gutterSize;
  }

  if (gutterSize >= gridWidth) {
    gutterSize = DEFAULTS.gutterSize;
    document.getElementById('gutterSize').value = gutterSize;
  }

  document.getElementById('gridWidth').value = gridWidth;
  document.getElementById('columns').value = columns;
  document.getElementById('opacity').value = opacity;

  const settings = { gridWidth, columns, gutterSize, gridColor, opacity };
  chrome.storage.sync.set(settings, () => updateGrid(settings));
}

function toggleGrid() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    chrome.tabs.sendMessage(tabs[0].id, { action: 'toggleGrid' }, () => {
      const settings = {
        gridWidth: Math.max(1, parseInt(document.getElementById('gridWidth').value) || DEFAULTS.gridWidth),
        columns: Math.max(1, parseInt(document.getElementById('columns').value) || DEFAULTS.columns),
        gutterSize: parseInt(document.getElementById('gutterSize').value) || DEFAULTS.gutterSize,
        gridColor: document.getElementById('gridColor').value || DEFAULTS.gridColor,
        opacity: clamp(parseFloat(document.getElementById('opacity').value), 0, 1)
      };
      chrome.tabs.sendMessage(tabs[0].id, {
        action: 'updateGrid',
        settings: settings
      });
    });
  });
}

function updateToggleButton(isVisible) {
  const button = document.getElementById('toggleGrid');
  button.textContent = isVisible ? 'Hide Grid' : 'Show Grid';
  button.style.background = isVisible ? '#d93025' : '#1a73e8';
}

function updateGrid(settings) {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    chrome.tabs.sendMessage(tabs[0].id, {
      action: 'updateGrid',
      settings: settings
    });
  });
}

function centerGrid() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    chrome.tabs.sendMessage(tabs[0].id, { action: 'centerGrid' });
  });
}

function resetToDefaults() {
  document.getElementById('gridWidth').value = DEFAULTS.gridWidth;
  document.getElementById('columns').value = DEFAULTS.columns;
  document.getElementById('gutterSize').value = DEFAULTS.gutterSize;
  document.getElementById('gridColor').value = DEFAULTS.gridColor;
  document.getElementById('opacity').value = DEFAULTS.opacity;
  chrome.storage.sync.set({ ...DEFAULTS }, () => {
    updateGrid({ ...DEFAULTS });
  });
}
