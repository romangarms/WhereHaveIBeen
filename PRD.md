# PRD: Client-Side Buffer Caching

## Problem Statement

Every time a user refreshes the WhereHaveIBeen page, the application recalculates routes and buffer polygons from scratch. With 16+ months of GPS data (since August 2024), this results in significant load times. Users returning to the site a week later must wait for the entire dataset to be reprocessed, even though only a week of new data exists.

## Goal

Implement client-side caching of buffer polygons so that returning users only need to calculate new data since their last visit, dramatically reducing load times for the primary use case: viewing all-time travel history.

## Solution Overview

Cache the computed buffer polygons (the blue driving overlay and red flying overlay) in the browser's IndexedDB. On subsequent visits, load the cached buffers, fetch only new GPS data since the cache timestamp, calculate buffers for the new data, merge with cached buffers, and update the cache.

## Technical Approach

### Storage Mechanism

**IndexedDB** (not localStorage)
- Supports hundreds of MB of storage (vs 5-10MB for localStorage)
- Async operations (won't freeze UI during save/load)
- Native support for complex objects (GeoJSON)
- Wide browser support

### Cache Structure

Cache per user/device combination with separate entries for driving and flying:

```javascript
{
  key: "{user}_{device}",
  data: {
    driving: {
      buffer: <GeoJSON Polygon>,       // Merged driving buffer
      timestamp: "2024-12-30T15:30:00Z" // Latest GPS point included
    },
    flying: {
      buffer: <GeoJSON Polygon>,       // Merged flying buffer
      timestamp: "2024-12-30T15:30:00Z"
    },
    settings: {
      bufferSize: 50,                  // Buffer size when cached
      osrmUrl: "http://..."            // OSRM router URL when cached
    }
  }
}
```

### Cache Flow

#### On Page Load (with existing cache)

1. User selects user/device from dropdown
2. Check IndexedDB for cached data for this user/device
3. Validate cache settings match current settings (buffer size, OSRM URL)
4. If valid cache exists:
   - Render cached driving buffer immediately
   - Render cached flying buffer immediately
   - Fetch GPS data from `cache.timestamp` to `now`
   - Calculate buffers for new data only
   - Merge new buffers with cached buffers using Turf.js `union()`
   - Render merged result
   - Save merged buffers + new timestamp to IndexedDB
5. If no cache or invalid cache:
   - Calculate everything from scratch (current behavior)
   - Save result to IndexedDB

#### On Settings Change

- **Buffer size changed**: Invalidate cache, recalculate from scratch
- **OSRM URL changed**: Invalidate cache, recalculate from scratch

#### On Time Filter Change

- Custom time ranges calculate fresh (no caching optimization)
- Caching optimizes the "all time" use case only

### Merging Buffers

Use Turf.js `union()` to merge cached and new buffer polygons:

```javascript
import { union } from '@turf/turf';

const mergedBuffer = union(cachedBuffer, newBuffer);
```

This produces a single polygon with no overlapping/stacking transparency issues.

### Handling Driving vs Flying

- Cache driving and flying buffers separately
- Merge each independently when new data arrives
- Both use identical caching logic (reusable functions)

## User Interface Changes

### Rename "Visual Settings" to "Settings"

The existing "Visual Settings" section will be renamed to "Settings" to accommodate cache controls alongside buffer size and OSRM URL settings.

> **TODO**: Create a dedicated settings page/modal in the future for better organization.

### Cache Status Display

Add to the Settings panel:

```
Cache
──────────────────────────
Cached: Aug 15, 2024 - Dec 30, 2024
Storage: 2.7 MB
[Clear Cache]
```

Components:
- **Date range**: Earliest to latest GPS point in cache
- **Storage size**: Total size of cached data for current user/device
- **Clear Cache button**: Removes cache for current user/device, triggers fresh calculation

### Loading States

Update progress bar messages to indicate cache usage:
- "Loading from cache..." (when reading cached data)
- "Calculating new data..." (when processing only new GPS points)
- "Merging with cache..." (when combining old + new)

vs current:
- "Calculating routes..." (full calculation)

## Edge Cases

### Storage Quota Exceeded

If IndexedDB save fails due to storage limits:
1. Clear caches for other user/device combinations
2. Retry save
3. If still fails, continue without caching (graceful degradation)

### Empty New Data

If no new GPS data exists since cache timestamp:
- Render cached buffers directly
- Skip merge step
- No cache update needed

### First Visit / No Cache

- Full calculation (current behavior)
- Save result to IndexedDB for next visit

### Cache Corruption

If cached data fails to parse or render:
- Clear corrupted cache entry
- Fall back to full calculation
- Log error for debugging

## Implementation Phases

### Phase 1: Core Caching Infrastructure

1. Create IndexedDB helper module (`cacheManager.js`)
   - `initDB()`: Initialize database and object store
   - `getCache(user, device)`: Retrieve cached data
   - `setCache(user, device, data)`: Store cached data
   - `clearCache(user, device)`: Remove cached data
   - `getCacheSize(user, device)`: Calculate storage size

2. Implement cache validation
   - Check buffer size matches
   - Check OSRM URL matches
   - Return null if settings mismatch

### Phase 2: Incremental Data Loading

1. Modify `fetchLocations()` to accept optional `startDate` parameter
2. When cache exists, fetch only data after cache timestamp
3. Handle timezone conversion for cache timestamps

### Phase 3: Buffer Merging

1. After calculating new buffers, merge with cached using Turf.js `union()`
2. Handle edge case where new buffer is empty (no new data)
3. Handle edge case where cached buffer is empty (first calculation)

### Phase 4: UI Integration

1. Rename "Visual Settings" to "Settings"
2. Add cache status display component
3. Add clear cache button with confirmation
4. Update progress bar messages for cache states

### Phase 5: Polish & Edge Cases

1. Implement storage quota handling
2. Add cache corruption recovery
3. Performance testing with large datasets
4. Browser compatibility testing

## Success Metrics

- **Primary**: Return visitors see map render in <5 seconds (vs current 30-60+ seconds)
- **Secondary**: Fresh calculations (no cache) remain at current performance
- **Storage**: Typical cache size <10MB per user/device combination

## Dependencies

- **Turf.js**: Already in use, provides `union()` for polygon merging
- **IndexedDB**: Native browser API, no additional dependencies needed
- Optional: `idb` wrapper library for cleaner IndexedDB API (evaluate during implementation)

## Out of Scope

- Caching for custom time range filters (only "all time" is optimized)
- Cross-device cache sync (cache is per-browser only)
- Caching route linestrings (buffer polygons only for MVP)
- Dedicated settings page (deferred, TODO noted)

## Open Questions

None - all key decisions documented above.

---

*Generated: January 2025*
