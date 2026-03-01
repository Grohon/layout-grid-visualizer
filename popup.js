const DEFAULTS = {
  gridWidth: 1320,
  columns: 12,
  gutterSize: 32,
  gridColor: '#1a73e8',
  opacity: 0.3,
  gridClickable: true,
  splitGridState: false,
  splitColumnValues: [12]
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
  opacityRange: null,
  toggleGrid: null,
  centerGrid: null,
  splitGrid: null,
  resetGrid: null,
  gridClickable: null
};

let currentGridVisible = false;
let splitGridState = false;
let splitColumnValues = [DEFAULTS.columns];

// --- Helper to send a message to the active tab's content script ---
// Ensures content script + CSS are injected, then sends the message.
async function ensureContentScriptInjected(tabId) {
  try {
    await new Promise((resolve, reject) => {
      chrome.tabs.sendMessage(tabId, { type: "ping" }, (response) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(response);
        }
      });
    });
  } catch {
    // Not injected — inject both CSS and JS
    try {
      await chrome.scripting.insertCSS({ target: { tabId }, files: ['grid-overlay.css'] });
      await chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] });
    } catch {
      // Restricted page — silently ignore
    }
  }
}

async function sendToActiveTab(action, data = {}) {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return undefined;
    await ensureContentScriptInjected(tab.id);
    return new Promise((resolve) => {
      chrome.tabs.sendMessage(tab.id, { action, ...data }, (response) => {
        if (chrome.runtime.lastError) {
          resolve(undefined);
        } else {
          resolve(response);
        }
      });
    });
  } catch {
    // Messaging failed (restricted page, etc.) — silently ignore
    return undefined;
  }
}

function restoreSplitGridUI() {
  let formGridColumns = document.querySelector('.form-grid-columns');
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

  // Both split and uniform modes use splitColumnValues[0] as the #columns value.
  // In split mode, it represents the first split ratio; in uniform mode, the total column count.
  el.columns.value = splitColumnValues[0] || 1;

  // Attach event listener to #columns
  el.columns.oninput = () => {
    const val = parseInt(el.columns.value) || 1;
    if (splitGridState) {
      splitColumnValues[0] = val;
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
      if (splitColumnValues.length < 6) {
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
  el.opacityRange = document.getElementById('opacityRange');
  el.toggleGrid = document.getElementById('toggleGrid');
  el.centerGrid = document.getElementById('centerGrid');
  el.splitGrid = document.getElementById('splitGrid');
  el.resetGrid = document.getElementById('resetGrid');
  el.gridClickable = document.getElementById('gridClickable');

  chrome.storage.sync.get(DEFAULTS, (settings) => {
    if (chrome.runtime.lastError) return;

    el.gridWidth.value = settings.gridWidth;
    el.gutterSize.value = settings.gutterSize;
    el.gridColor.value = settings.gridColor;
    el.opacity.value = settings.opacity;
    if (el.opacityRange) el.opacityRange.value = settings.opacity;

    // Set split grid state and values first
    splitGridState = settings.splitGridState;
    splitColumnValues = Array.isArray(settings.splitColumnValues) && settings.splitColumnValues.length > 0 ? settings.splitColumnValues : [settings.columns];

    // Now restore the UI which will set the #columns value correctly
    restoreSplitGridUI();

    // Update the grid with the current settings (don't call saveSettings to avoid overwriting)
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

    updateGrid(currentSettings);

    el.gridClickable.checked = settings.gridClickable !== false;

    sendToActiveTab('getGridState').then((response) => {
      setCurrentGridVisible(response && response.isVisible);
    });
    sendToActiveTab('setGridClickable', { value: el.gridClickable.checked });
  });

  // All main inputs (excluding #columns since it's handled in restoreSplitGridUI)
  [el.gridWidth, el.gutterSize, el.opacity].forEach(input => {
    input.addEventListener('input', debounce(saveSettings, 100));
  });
  el.gridColor.addEventListener('input', debounce(saveSettings, 100));

  // Opacity range slider sync
  if (el.opacityRange) {
    el.opacityRange.addEventListener('input', () => {
      el.opacity.value = el.opacityRange.value;
      saveSettings();
    });
    // Also sync the range when the number input changes
    el.opacity.addEventListener('input', () => {
      el.opacityRange.value = el.opacity.value;
    });
  }

  // Toggle grid
  el.toggleGrid.addEventListener('click', () => {
    setCurrentGridVisible(!currentGridVisible);
    toggleGrid();
  });
  el.centerGrid.addEventListener('click', centerGrid);
  el.splitGrid.addEventListener('click', splitGrid);
  el.resetGrid.addEventListener('click', resetToDefaults);
  el.gridClickable.addEventListener('change', handleGridClickableChange);

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
  const formGridColumns = document.querySelector('.form-grid-columns');
  const splitInputs = Array.from(formGridColumns.querySelectorAll('input.split-column'));
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
      if (el.opacityRange) el.opacityRange.value = opacity;
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
  if (el.opacityRange) el.opacityRange.value = opacity;

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

async function toggleGrid() {
  await sendToActiveTab('toggleGrid');
  // Send current settings after toggling
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

  await sendToActiveTab('updateGrid', { settings: currentSettings });
}

function updateToggleButton(isVisible) {
  el.toggleGrid.textContent = isVisible ? 'Hide Grid' : 'Show Grid';
  el.toggleGrid.style.background = isVisible ? '#d93025' : '#1a73e8';
}

async function updateGrid(settings) {
  await sendToActiveTab('updateGrid', { settings });
}

async function centerGrid() {
  await sendToActiveTab('centerGrid');
}

function splitGrid() {
  splitGridState = !splitGridState;

  if (!splitGridState) {
    // Switching to uniform: keep only #columns, set splitColumnValues to the current value
    const val = parseInt(el.columns.value) || 1;
    splitColumnValues = [val];
  }

  restoreSplitGridUI();
  updateAddRemoveListeners();
  saveSettings();
}

async function resetToDefaults() {
  el.gridWidth.value = DEFAULTS.gridWidth;
  el.columns.value = DEFAULTS.columns;
  el.gutterSize.value = DEFAULTS.gutterSize;
  el.gridColor.value = DEFAULTS.gridColor;
  el.opacity.value = DEFAULTS.opacity;
  if (el.opacityRange) el.opacityRange.value = DEFAULTS.opacity;
  el.gridClickable.checked = DEFAULTS.gridClickable;

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

  chrome.storage.sync.set({ ...DEFAULTS }, async () => {
    await updateGrid({ ...DEFAULTS });
    await sendToActiveTab('setGridClickable', { value: DEFAULTS.gridClickable });
  });

  [el.gridWidth, el.columns, el.gutterSize, el.opacity].forEach(input => input.classList.remove('invalid-field'));
  el.toggleGrid.disabled = false;
}

async function handleGridClickableChange() {
  const isClickable = el.gridClickable.checked;
  chrome.storage.sync.set({ gridClickable: isClickable });
  await sendToActiveTab('setGridClickable', { value: isClickable });
}

function showTooltip(input, message) {
  const formGroup = input.closest('.form-group');
  if (!formGroup) return;

  const oldTooltip = formGroup.querySelector('.input-tooltip');
  if (oldTooltip) oldTooltip.remove();

  const tooltip = document.createElement('div');
  tooltip.className = 'input-tooltip';
  tooltip.textContent = message;

  formGroup.appendChild(tooltip);
  setTimeout(() => tooltip.remove(), 1500);
}

function saveSplitGridState() {
  chrome.storage.sync.set({
    splitGridState,
    splitColumnValues
  });
}
