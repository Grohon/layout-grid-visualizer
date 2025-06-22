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

// Debounce helper
function debounce(fn, delay) {
  let timer = null;
  return function(...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

// Cache DOM elements
const el = {
  gridWidth: null,
  columns: null,
  gutterSize: null,
  gridColor: null,
  opacity: null,
  toggleGrid: null,
  centerGrid: null,
  splitGrid: null,
  resetGrid: null
};

let currentGridVisible = false;
let splitGridState = false;
let splitColumnValues = [DEFAULTS.columns];

function restoreSplitGridUI() {
  let formGridColumns = document.querySelector('.form-grid-columns');
  let addColumnBtn = document.getElementById('addColumn');
  let removeColumnBtn = document.getElementById('removeColumn');
  const formGridButtons = document.querySelector('.form-grid-buttons');
  if (!formGridColumns) return;

  // Remove only split-column fields, never #columns
  Array.from(formGridColumns.querySelectorAll('input.split-column')).forEach(input => input.remove());

  // Ensure #columns is present as the first child
  if (formGridColumns.firstElementChild !== el.columns) {
    formGridColumns.insertBefore(el.columns, formGridColumns.firstChild);
  }

  // Remove any existing event listeners to prevent duplicates
  el.columns.oninput = null;
  
  // Set the value based on current state
  if (splitGridState) {
    // In split mode, use the first value from splitColumnValues
    el.columns.value = splitColumnValues[0] || 1;
  } else {
    // In uniform mode, use the first value from splitColumnValues
    el.columns.value = splitColumnValues[0] || 1;
  }

  // Attach event listener to #columns using oninput property (without debounce for testing)
  el.columns.oninput = () => {
    const val = parseInt(el.columns.value) || 1;
    if (splitGridState) {
      splitColumnValues[0] = val;
      // Don't call restoreSplitGridUI here to avoid infinite recursion
    } else {
      splitColumnValues = [val];
    }
    saveSettings();
  };

  if (splitGridState) {
    // Add split column fields after #columns
    for (let i = 1; i < splitColumnValues.length; i++) {
      const input = document.createElement('input');
      input.type = 'number';
      input.className = 'split-column';
      input.min = '1';
      input.value = splitColumnValues[i];
      input.addEventListener('input', debounce(() => window.handleSplitInput(i, input), 100));
      formGridColumns.appendChild(input);
    }
    if (formGridButtons) formGridButtons.style.display = 'flex';
    if (el.splitGrid) el.splitGrid.textContent = 'Uniform Grid';
  } else {
    if (formGridButtons) formGridButtons.style.display = 'none';
    if (el.splitGrid) el.splitGrid.textContent = 'Split Grid';
  }
  updateAddRemoveListeners();
}

// Add/Remove column fields (only in split mode)
function updateAddRemoveListeners() {
  let addColumnBtn = document.getElementById('addColumn');
  let removeColumnBtn = document.getElementById('removeColumn');
  
  if (!addColumnBtn || !removeColumnBtn) return;
  addColumnBtn.onclick = null;
  removeColumnBtn.onclick = null;
  if (splitGridState) {
    addColumnBtn.onclick = () => {
      if (splitColumnValues.length < 5) {
        splitColumnValues.push(1);
        restoreSplitGridUI();
        saveSettings();
      }
    };
    removeColumnBtn.onclick = () => {
      if (splitColumnValues.length > 1) {
        splitColumnValues.pop();
        restoreSplitGridUI();
        saveSettings();
      }
    };
  }
}

document.addEventListener('DOMContentLoaded', () => {
  el.gridWidth = document.getElementById('gridWidth');
  el.columns = document.getElementById('columns');
  el.gutterSize = document.getElementById('gutterSize');
  el.gridColor = document.getElementById('gridColor');
  el.opacity = document.getElementById('opacity');
  el.toggleGrid = document.getElementById('toggleGrid');
  el.centerGrid = document.getElementById('centerGrid');
  el.splitGrid = document.getElementById('splitGrid');
  el.resetGrid = document.getElementById('resetGrid');

  let formGridColumns = document.querySelector('.form-grid-columns');
  let addColumnBtn = document.getElementById('addColumn');
  let removeColumnBtn = document.getElementById('removeColumn');

  chrome.storage.sync.get({ ...DEFAULTS, splitGridState: false, splitColumnValues: [DEFAULTS.columns] }, (settings) => {
    console.log('Loading settings from storage:', settings);
    el.gridWidth.value = settings.gridWidth;
    el.gutterSize.value = settings.gutterSize;
    el.gridColor.value = settings.gridColor;
    el.opacity.value = settings.opacity;
    
    // Set split grid state and values first
    splitGridState = settings.splitGridState;
    splitColumnValues = Array.isArray(settings.splitColumnValues) && settings.splitColumnValues.length > 0 ? settings.splitColumnValues : [settings.columns];
    
    console.log('After loading - splitGridState:', splitGridState, 'splitColumnValues:', splitColumnValues);
    
    // Now restore the UI which will set the #columns value correctly
    restoreSplitGridUI();
    
    // Don't call saveSettings here - it might override the saved state
    // Only update the grid with the current settings
    const currentSettings = {
      gridWidth: parseInt(el.gridWidth.value) || DEFAULTS.gridWidth,
      gutterSize: parseInt(el.gutterSize.value) || DEFAULTS.gutterSize,
      gridColor: el.gridColor.value || DEFAULTS.gridColor,
      opacity: clamp(parseFloat(el.opacity.value), 0, 1)
    };
    
    if (splitGridState) {
      currentSettings.splitColumns = splitColumnValues;
      currentSettings.columns = undefined;
    } else {
      currentSettings.columns = parseInt(el.columns.value) || DEFAULTS.columns;
      currentSettings.splitColumns = undefined;
    }
    
    console.log('Sending initial grid settings:', currentSettings);
    updateGrid(currentSettings);
    
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      chrome.tabs.sendMessage(tabs[0].id, { action: 'getGridState' }, (response) => {
        setCurrentGridVisible(response && response.isVisible);
        // If grid is not visible, show it automatically
        if (!response || !response.isVisible) {
          setCurrentGridVisible(true);
          toggleGrid();
        }
      });
    });
  });

  // All main inputs (excluding #columns since it's handled in restoreSplitGridUI)
  [el.gridWidth, el.gutterSize, el.opacity].forEach(input => {
    input.addEventListener('input', debounce(saveSettings, 100));
  });
  el.gridColor.addEventListener('input', debounce(saveSettings, 100));

  // Toggle grid
  el.toggleGrid.addEventListener('click', () => {
    setCurrentGridVisible(!currentGridVisible);
    toggleGrid();
  });
  el.centerGrid.addEventListener('click', centerGrid);
  el.splitGrid.addEventListener('click', () => {
    splitGridState = !splitGridState;
    
    if (!splitGridState) {
      // Switching to uniform: keep only #columns, set splitColumnValues to the current value
      const val = parseInt(el.columns.value) || 1;
      splitColumnValues = [val];
      // Don't set el.columns.value here - let restoreSplitGridUI handle it
    }

    restoreSplitGridUI();
    updateAddRemoveListeners();
    saveSettings();
  });
  el.resetGrid.addEventListener('click', resetToDefaults);

  // Helper for split column field changes
  window.handleSplitInput = function(idx, input) {
    splitColumnValues[idx] = parseInt(input.value) || 1;
    saveSettings();
  };

  updateAddRemoveListeners();
});

function setCurrentGridVisible(val) {
  currentGridVisible = val;
  updateToggleButton(currentGridVisible);
}

function getSplitColumnsArray() {
  // Always use #columns as the first split value, then the rest from .split-column (excluding #columns if present)
  const formGridColumns = document.querySelector('.form-grid-columns');
  const splitInputs = Array.from(formGridColumns.querySelectorAll('input.split-column'));
  // Remove #columns if it is in splitInputs (should not be, but just in case)
  const filtered = splitInputs.filter(i => i !== el.columns);
  return [parseInt(el.columns.value) || 1, ...filtered.map(i => parseInt(i.value) || 1)];
}

function saveSettings() {
  let gridWidth = parseInt(el.gridWidth.value);
  let columns = parseInt(el.columns.value);
  let gutterSize = parseInt(el.gutterSize.value);
  let gridColor = el.gridColor.value || DEFAULTS.gridColor;
  let opacity = clamp(parseFloat(el.opacity.value), 0, 1);

  let valid = true;
  let corrections = [];

  // Gutter size
  if (el.gutterSize.value === '' || !gutterSize || gutterSize <= 0) {
    el.gutterSize.classList.add('invalid-field');
    valid = false;
    showTooltip(el.gutterSize, 'Gutter size must be greater than 0.');
    corrections.push(() => {
      gutterSize = DEFAULTS.gutterSize;
      el.gutterSize.value = gutterSize;
      el.gutterSize.classList.remove('invalid-field');
    });
  } else {
    el.gutterSize.classList.remove('invalid-field');
  }
  if (gutterSize >= (gridWidth || 1)) {
    el.gutterSize.classList.add('invalid-field');
    valid = false;
    showTooltip(el.gutterSize, 'Gutter size must be less than grid width.');
    corrections.push(() => {
      gutterSize = DEFAULTS.gutterSize;
      el.gutterSize.value = gutterSize;
      el.gutterSize.classList.remove('invalid-field');
    });
  }
  // Grid width
  if (el.gridWidth.value === '' || !gridWidth || gridWidth <= 0) {
    el.gridWidth.classList.add('invalid-field');
    valid = false;
    showTooltip(el.gridWidth, 'Grid width must be greater than 0.');
    corrections.push(() => {
      gridWidth = DEFAULTS.gridWidth;
      el.gridWidth.value = gridWidth;
      el.gridWidth.classList.remove('invalid-field');
    });
  } else {
    el.gridWidth.classList.remove('invalid-field');
  }

  // Columns
  if (el.columns.value === '' || columns < 1) {
    el.columns.classList.add('invalid-field');
    valid = false;
    showTooltip(el.columns, 'Columns must be at least 1.');
    corrections.push(() => {
      columns = DEFAULTS.columns;
      el.columns.value = columns;
      el.columns.classList.remove('invalid-field');
    });
  } else {
    el.columns.classList.remove('invalid-field');
  }
  // Opacity
  if (el.opacity.value === '' || opacity < 0 || opacity > 1 || isNaN(opacity)) {
    el.opacity.classList.add('invalid-field');
    valid = false;
    showTooltip(el.opacity, 'Opacity must be between 0 and 1.');
    corrections.push(() => {
      opacity = DEFAULTS.opacity;
      el.opacity.value = opacity;
      el.opacity.classList.remove('invalid-field');
    });
  } else {
    el.opacity.classList.remove('invalid-field');
  }

  // Optionally disable toggle if invalid
  el.toggleGrid.disabled = !valid;

  // Delay auto-correction by 1.5s to allow user to finish typing
  if (corrections.length > 0) {
    setTimeout(() => {
      corrections.forEach(fn => fn());
      // After correction, re-save settings
      saveSettings();
    }, 1500);
    return;
  }

  // If all valid, update values and grid
  el.gridWidth.value = gridWidth;
  el.columns.value = columns;
  el.opacity.value = opacity;

  // Update splitColumnValues first, then create settings object
  if (splitGridState) {
    splitColumnValues = getSplitColumnsArray();
  } else {
    splitColumnValues = [columns];
  }

  // Create settings object with updated values
  let settings = { gridWidth, gutterSize, gridColor, opacity };
  if (splitGridState) {
    settings.splitColumns = splitColumnValues;
    settings.columns = undefined;
  } else {
    settings.columns = columns;
    settings.splitColumns = undefined;
  }
  
  chrome.storage.sync.set({
    ...settings,
    splitGridState,
    splitColumnValues
  }, () => updateGrid(settings));
}

function toggleGrid() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    chrome.tabs.sendMessage(tabs[0].id, { action: 'toggleGrid' }, () => {
      // Use current state values based on splitGridState
      const currentSettings = {
        gridWidth: parseInt(el.gridWidth.value) || DEFAULTS.gridWidth,
        gutterSize: parseInt(el.gutterSize.value) || DEFAULTS.gutterSize,
        gridColor: el.gridColor.value || DEFAULTS.gridColor,
        opacity: clamp(parseFloat(el.opacity.value), 0, 1)
      };

      if (splitGridState) {
        currentSettings.splitColumns = splitColumnValues;
        currentSettings.columns = undefined;
      } else {
        currentSettings.columns = parseInt(el.columns.value) || DEFAULTS.columns;
        currentSettings.splitColumns = undefined;
      }

      chrome.tabs.sendMessage(tabs[0].id, {
        action: 'updateGrid',
        settings: currentSettings
      });
    });
  });
}

function updateToggleButton(isVisible) {
  el.toggleGrid.textContent = isVisible ? 'Hide Grid' : 'Show Grid';
  el.toggleGrid.style.background = isVisible ? '#d93025' : '#1a73e8';
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

function createSplitColumnInput(val = 1, idx = 1) {
  // idx: 0 means this is the #columns input, don't create a new input
  if (idx === 0) return el.columns;
  const input = document.createElement('input');
  input.type = 'number';
  input.className = 'split-column';
  input.min = '1';
  input.value = val;
  input.addEventListener('input', debounce(() => {
    saveSettings();
  }, 100));
  return input;
}

function resetToDefaults() {
  el.gridWidth.value = DEFAULTS.gridWidth;
  el.columns.value = DEFAULTS.columns;
  el.gutterSize.value = DEFAULTS.gutterSize;
  el.gridColor.value = DEFAULTS.gridColor;
  el.opacity.value = DEFAULTS.opacity;

  centerGrid();

  // Reset split grid state and columns
  splitGridState = false;
  splitColumnValues = [DEFAULTS.columns];
  
  // Manually hide the form-grid-buttons div
  const formGridButtons = document.querySelector('.form-grid-buttons');
  if (formGridButtons) {
    formGridButtons.style.display = 'none';
  }
  
  // Update the split grid button text
  if (el.splitGrid) {
    el.splitGrid.textContent = 'Split Grid';
  }
  
  // Call restoreSplitGridUI to properly handle the UI state and event listeners
  restoreSplitGridUI();
  
  saveSplitGridState();

  chrome.storage.sync.set({ ...DEFAULTS }, () => {
    updateGrid({ ...DEFAULTS });
  });

  [el.gridWidth, el.columns, el.gutterSize, el.opacity].forEach(input => input.classList.remove('invalid-field'));
  el.toggleGrid.disabled = false;
}

function showTooltip(input, message) {
  // Remove any existing tooltip in the form group
  const formGroup = input.closest('.form-group');

  if (!formGroup) return;

  const oldTooltip = formGroup.querySelector('.input-tooltip');

  if (oldTooltip) oldTooltip.remove();

  let tooltip = document.createElement('div');

  tooltip.className = 'input-tooltip';
  tooltip.textContent = message;
  tooltip.style.position = 'absolute';
  tooltip.style.background = '#d93025';
  tooltip.style.color = '#fff';
  tooltip.style.padding = '2px 8px';
  tooltip.style.borderRadius = '4px';
  tooltip.style.fontSize = '12px';
  tooltip.style.zIndex = 10000;
  tooltip.style.right = '0.5rem';
  tooltip.style.top = '100%';
  tooltip.style.marginTop = '2px';
  tooltip.style.whiteSpace = 'nowrap';

  formGroup.appendChild(tooltip);

  setTimeout(() => tooltip.remove(), 1500);
}

function saveSplitGridState() {
  chrome.storage.sync.set({
    splitGridState,
    splitColumnValues
  });
}
