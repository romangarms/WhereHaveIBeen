# heatmap Specification

## Purpose

An alternative view of the user's own history that shades how often they have been
somewhere. WhereHaveIBeen-API computes it as a fixed grid.

## Requirements

### Requirement: Visit-frequency grid
The API SHALL return the user's history as grid cells of 0.0006°, each with a visit count (`[gx, gy, count]`), using the same time frame and device filters as the track.

#### Scenario: Heatmap mode
- **WHEN** the user switches the map to Heatmap
- **THEN** cells are shaded by visit count using the selected time frame and device

### Requirement: Stats in heatmap mode
In heatmap mode the stats ribbon SHALL keep showing the track stats for the same filters.

#### Scenario: Switch to heatmap
- **WHEN** the user switches from Routes to Heatmap
- **THEN** the stats ribbon still shows distance, area and records for the current filters
