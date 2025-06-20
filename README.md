# Extension Name: Layout Grid Visualizer

## Overview
The Layout Grid Visualizer is a Chrome extension designed to help web developers and designers visualize the underlying grid system of a website layout. This tool allows users to overlay a customizable grid on any webpage, making it easier to understand the structure and alignment of elements based on a defined grid system, such as the 12-column layout commonly used in frameworks like Bootstrap.

## Key Features

1. **Customizable Grid Settings:**
   - Define the total width of the grid (e.g., 1320px) and specify the number of columns (e.g., 12).
   - Set gutter sizes (e.g., 32px) between columns for precise control over the layout visualization.

2. **Dynamic Grid Overlay:**
   - Overlay a grid on the current webpage, displaying the defined columns and gutters.
   - Toggle the grid on and off with a simple button for easy visibility (per tab).
   - Move the grid overlay by dragging it with the mouse.
   - Center the grid overlay at any time with a dedicated button.

3. **Overlay Customization:**
   - Customize the appearance of the grid overlay, including color and opacity, to ensure visibility against various backgrounds.

4. **User-Friendly Interface:**
   - Simple and intuitive popup interface to adjust grid settings, toggle the overlay, and center the grid.

## Benefits
- **Enhanced Design Understanding:** Visualize the layout structure, making it easier to create and maintain consistent designs.
- **Debugging Tool:** Identify layout issues, such as misalignments or spacing problems, for quicker fixes.
- **Learning Resource:** Serves as a learning tool for those new to grid systems, providing a visual representation of how grids work in web design.

## Development Considerations
- **Chrome Extensions API:** Utilizes content scripts to inject the grid overlay into the webpage and manipulate the DOM for visualization.
- **Performance Optimization:** The extension is designed to run efficiently without causing lag or slowdowns on the webpage.
