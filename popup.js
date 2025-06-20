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
  resetGrid: null
};

document.addEventListener('DOMContentLoaded', () => {
  el.gridWidth = document.getElementById('gridWidth');
  el.columns = document.getElementById('columns');
  el.gutterSize = document.getElementById('gutterSize');
  el.gridColor = document.getElementById('gridColor');
  el.opacity = document.getElementById('opacity');
  el.toggleGrid = document.getElementById('toggleGrid');
  el.centerGrid = document.getElementById('centerGrid');
  el.resetGrid = document.getElementById('resetGrid');

  chrome.storage.sync.get({ ...DEFAULTS }, (settings) => {
    el.gridWidth.value = settings.gridWidth;
    el.columns.value = settings.columns;
    el.gutterSize.value = settings.gutterSize;
    el.gridColor.value = settings.gridColor;
    el.opacity.value = settings.opacity;
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

  // Use 'input' for all fields for instant feedback, debounced for performance
  [el.gridWidth, el.columns, el.gutterSize, el.opacity].forEach(input => {
    input.addEventListener('input', debounce(saveSettings, 100));
  });

  el.gridColor.addEventListener('input', debounce(saveSettings, 100));

  el.toggleGrid.addEventListener('click', () => {
    setCurrentGridVisible(!currentGridVisible);
    toggleGrid();
  });

  el.centerGrid.addEventListener('click', centerGrid);
  el.resetGrid.addEventListener('click', resetToDefaults);
});

let currentGridVisible = false;

function setCurrentGridVisible(val) {
  currentGridVisible = val;
  updateToggleButton(currentGridVisible);
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

  const settings = { gridWidth, columns, gutterSize, gridColor, opacity };
  chrome.storage.sync.set(settings, () => updateGrid(settings));
}

function toggleGrid() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    chrome.tabs.sendMessage(tabs[0].id, { action: 'toggleGrid' }, () => {
      const settings = {
        gridWidth: Math.max(1, parseInt(el.gridWidth.value) || DEFAULTS.gridWidth),
        columns: Math.max(1, parseInt(el.columns.value) || DEFAULTS.columns),
        gutterSize: parseInt(el.gutterSize.value) || DEFAULTS.gutterSize,
        gridColor: el.gridColor.value || DEFAULTS.gridColor,
        opacity: clamp(parseFloat(el.opacity.value), 0, 1)
      };

      chrome.tabs.sendMessage(tabs[0].id, {
        action: 'updateGrid',
        settings: settings
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

function resetToDefaults() {
  el.gridWidth.value = DEFAULTS.gridWidth;
  el.columns.value = DEFAULTS.columns;
  el.gutterSize.value = DEFAULTS.gutterSize;
  el.gridColor.value = DEFAULTS.gridColor;
  el.opacity.value = DEFAULTS.opacity;

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
