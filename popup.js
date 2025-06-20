document.addEventListener('DOMContentLoaded', () => {
  // Load saved settings
  chrome.storage.sync.get({
    gridWidth: 1320,
    columns: 12,
    gutterSize: 32,
    gridColor: '#1a73e8',
    opacity: 0.3
  }, (settings) => {
    document.getElementById('gridWidth').value = settings.gridWidth;
    document.getElementById('columns').value = settings.columns;
    document.getElementById('gutterSize').value = settings.gutterSize;
    document.getElementById('gridColor').value = settings.gridColor;
    document.getElementById('opacity').value = settings.opacity;
    // Query current tab for grid state
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      chrome.tabs.sendMessage(tabs[0].id, { action: 'getGridState' }, (response) => {
        setCurrentGridVisible(response && response.isVisible);
      });
    });
  });

  // Save settings when changed
  const inputs = ['gridWidth', 'columns', 'gutterSize', 'opacity'];
  inputs.forEach(id => {
    document.getElementById(id).addEventListener('change', saveSettings);
  });
  // Color input: update instantly
  document.getElementById('gridColor').addEventListener('input', saveSettings);

  // Toggle grid visibility
  document.getElementById('toggleGrid').addEventListener('click', () => {
    setCurrentGridVisible(!currentGridVisible); // Optimistically update
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

const DEFAULTS = {
  gridWidth: 1320,
  columns: 12,
  gutterSize: 32,
  gridColor: '#1a73e8',
  opacity: 0.3
};

function saveSettings() {
  let gridWidth = parseInt(document.getElementById('gridWidth').value);
  let columns = parseInt(document.getElementById('columns').value);
  let gutterSize = parseInt(document.getElementById('gutterSize').value);
  let gridColor = document.getElementById('gridColor').value;
  let opacity = parseFloat(document.getElementById('opacity').value);

  // If gutter size is invalid, set to default
  if (gutterSize >= gridWidth) {
    gutterSize = DEFAULTS.gutterSize;
    document.getElementById('gutterSize').value = gutterSize;
  }

  const settings = {
    gridWidth,
    columns,
    gutterSize,
    gridColor,
    opacity
  };

  chrome.storage.sync.set(settings, () => {
    updateGrid(settings);
  });
}

function toggleGrid() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    chrome.tabs.sendMessage(tabs[0].id, { action: 'toggleGrid' }, () => {
      // After toggling, always send the latest settings
      const settings = {
        gridWidth: parseInt(document.getElementById('gridWidth').value),
        columns: parseInt(document.getElementById('columns').value),
        gutterSize: parseInt(document.getElementById('gutterSize').value),
        gridColor: document.getElementById('gridColor').value,
        opacity: parseFloat(document.getElementById('opacity').value)
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
