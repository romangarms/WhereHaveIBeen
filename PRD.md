# PRD: Settings Panel Overlay

## Overview

Move the Settings card from below the map to a slide-in panel overlay, making settings accessible without scrolling away from the map.

## Problem

Currently, users must scroll past the map to access settings (buffer size, OSRM URL, cache management). This means they can't see the map while adjusting settings, making it harder to understand the impact of changes.

## Solution

Add a settings button overlayed on the map that triggers a slide-in panel from the right side containing the settings controls.

## Requirements

### Settings Button
- **Position**: Top-right corner of the map
- **Style**: Gear icon + "Settings" text
- **Behavior**: Clicking opens the slide-in panel

### Slide-in Panel
- **Position**: Right edge of the map, slides in from off-screen
- **Content**: The existing Settings card including:
  - Map Settings (Hide Route button, Buffer Size input)
  - Routing Settings (Custom OSRM Router URL)
  - Cache section (date range, size, Clear Cache button)
  - Save and Apply Settings button
- **Width**: Appropriate for the content (~300-350px)
- **Height**: Full height of the map container
- **Styling**: Consistent with existing panel styles (white background, rounded corners, shadow)

### Close Behavior
The panel can be closed via:
1. X button in the panel header
2. Clicking anywhere outside the panel
3. Pressing the Escape key

### Animation
- Smooth slide-in/out animation (CSS transition)
- Duration: ~300ms for a polished feel

## Technical Approach

### Files to Modify
1. `templates/index.html` - Add settings button and panel markup, move settings content
2. `static/css/styles.css` - Add styles for button, panel, animations, and overlay

### Implementation Details
1. Add a settings button element inside `#map-container` with appropriate z-index
2. Create a slide-in panel container positioned absolutely within `#map-container`
3. Move the Settings `.innerPanel` content into the new slide-in panel
4. Add CSS for:
   - Button positioning and styling
   - Panel positioning (off-screen by default)
   - Open state (translated into view)
   - Transition animation
   - Optional backdrop for click-outside detection
5. Add JavaScript for:
   - Toggle panel open/close on button click
   - Close on backdrop click
   - Close on Escape key press
   - Gear icon (inline SVG)

## Out of Scope
- Moving Filters to the overlay (stays below map)
- Moving Statistics/Information panel (stays below map)
- Mobile-specific responsive behavior (can be a future enhancement)

## Success Criteria
- Settings button visible on map without scrolling
- Panel slides in smoothly when button is clicked
- All existing settings functionality preserved
- Panel closes via X button, click outside, or Escape key
- Map remains interactive when panel is closed
