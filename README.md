# <img src="https://res.cloudinary.com/dd1qlozhf/image/upload/v1750923184/icon_ve3pat.png" width="24"/> Layout Grid Visualizer

<img src="https://res.cloudinary.com/dd1qlozhf/image/upload/v1750923154/marquee-promo-tile_gencqg.png">   

## Overview
Layout Grid Visualizer is a Chrome extension that helps web developers and designers visualize and customize grid layouts on any webpage. Instantly overlay a customizable grid, including advanced split modes, to better understand, debug, and design responsive layouts.

---

## Features

- **Grid Overlay:** Visualize a customizable grid on any webpage.
- **Split & Uniform Grid Modes:** Choose between uniform columns or custom split columns.
- **Draggable Overlay:** Move the grid overlay with your mouse or keyboard (arrow keys, Shift+arrow for faster movement).
- **Grid Ruler:** Add horizontal and vertical rulers for precise layout alignment.
- **Draggable, Removable, and Persistent Guides:** Create, drag, and remove guides; guides persist across sessions.
- **Keyboard Accessibility:**
  - Move overlay and focus guides with keyboard.
  - Remove guides with Delete/Backspace or the accessible close (×) button (Tab, Enter/Space).
- **Screen Reader Support:** ARIA live region announces guide removal and other changes.
- **Visible Focus Styles:** Clear focus indicators for all interactive elements.
- **Settings Persistence:** All grid and guide settings are saved per tab.
- **Easy Reset & Clear:** Quickly reset to defaults or clear all guides.
- **High Contrast & Customizable Colors:** Adjust grid color and opacity for any background.

---

## Installation

### Install from Chrome Web Store

1. Visit the [Layout Grid Visualizer on Chrome Web Store](https://chromewebstore.google.com/detail/layout-grid-visualizer/igcfgcdgijloeenpnoacomiioiomenab).
2. Click **Add to Chrome** and confirm the installation.

### Manual Installation (for development)

1. Download or clone this repository.
2. Go to `chrome://extensions` in your Chrome browser.
3. Enable "Developer mode" (top right).
4. Click "Load unpacked" and select the project folder.

---

## Usage

1. Click the Layout Grid Visualizer icon in your Chrome toolbar.
2. Adjust grid settings (width, columns, gutter, color, opacity) in the popup.
3. Use **Split Grid** to define custom column widths (see below).
4. Toggle the grid overlay on/off per tab.
5. Drag the overlay to reposition, or use keyboard arrows for precise movement.
6. Use **Center Grid** to recenter the overlay.
7. Use **Reset to Defaults** to restore all settings.
8. Toggle **Grid Clickable** to allow or block interaction with the overlay.

---

## Split Grid Mode

- Click **Split Grid** to enable split mode.
- Add or remove columns using the + and – buttons.
- Set individual column widths (e.g., 2, 4, 6 for a 3-column split).
- Switch back to uniform mode by clicking **Uniform Grid** or resetting.

---

## Keyboard Shortcuts

- **Move Overlay:** Arrow keys (↑, ↓, ←, →)
- **Move Faster:** Shift + Arrow keys
- **Focus Overlay:** Click on the overlay

---

## Accessibility & Keyboard Features

- **Guide Removal:**
  - Each guide now has a close (×) button that is accessible by keyboard (Tab to focus, Enter/Space to activate).
  - Guides themselves are focusable (Tab) and can be removed by pressing Delete or Backspace.
- **Screen Reader Announcements:**
  - When a guide is removed, an ARIA live region announces the change for users of assistive technologies.
- **Visible Focus Styles:**
  - Both guides and close buttons have a clear, visible focus indicator for keyboard users.

---

## Permissions

- `activeTab`: To inject the grid overlay into the current page.
- `storage`: To save your grid settings and overlay position.

---

## Screenshots

<img src="https://res.cloudinary.com/dd1qlozhf/image/upload/v1750923154/screenshot-1_ehcl38.png">   
<img src="https://res.cloudinary.com/dd1qlozhf/image/upload/v1751006718/screenshot-2_aijoxt.png">   
<img src="https://res.cloudinary.com/dd1qlozhf/image/upload/v1750923155/screenshot-4_i24771.png">   
<img src="https://res.cloudinary.com/dd1qlozhf/image/upload/v1750923155/screenshot-3_dxdnyd.png">   

---

## Troubleshooting & FAQ

**Q: The grid overlay is not visible or not updating.**
- Make sure the extension is enabled and the popup settings are valid (no red fields).
- Try toggling the grid off and on, or resetting to defaults.

**Q: I can't interact with the page under the grid.**
- Uncheck the **Grid Clickable** option to make the overlay pass-through.

**Q: How do I use split grid mode?**
- Click **Split Grid**, then use the +/– buttons and set custom widths for each column.

**Q: Is the extension accessible?**
- Yes! All controls have ARIA labels and keyboard navigation is fully supported.

---

## Contributing

Pull requests and suggestions are welcome! Please open an issue or PR for bug fixes, features, or improvements.

---

## Privacy Policy

See our [Privacy Policy](PRIVACY.md) for details on data usage and user privacy.

---

## License

MIT License. See [LICENSE](LICENSE) for details.

---

## Credits

Icon made by [Pixel perfect](https://www.flaticon.com/authors/pixel-perfect) from [www.flaticon.com](http://www.flaticon.com/)
