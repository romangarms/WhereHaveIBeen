// All geometry and stats are computed server-side by the user management API
// (/api/me/track, /api/me/heatmap, proxied here as /me/track and /me/heatmap).
// This module builds the query from the UI, polls while the server computes,
// and holds the returned stats so the Flights toggle can switch what the
// ribbon shows without another request.

// Speed above which a fix is treated as airborne on the server; only used for
// the "on a flight" note next to the top-speed stat.
const FLIGHT_ENTRY_KMH = 200 * KM_PER_MI;

let serverStats = emptyStats();
let firstLoad = true;
let activeTimeframe = 'all';

function emptyStats() {
    const zero = () => ({ distance_km: 0, area_km2: 0, max_alt_m: 0, max_vel_kmh: 0 });
    return { driving: zero(), flying: zero() };
}

// Convert datetime-local value to ISO 8601 UTC string
function toUTCISOString(id) {
    const value = document.getElementById(id).value;
    return value ? new Date(value).toISOString() : '';
}

// Helper: converts UTC Date to local time string suitable for datetime-local input
function toLocalDatetimeInputValue(utcDate) {
    const localDate = new Date(utcDate.getTime() - utcDate.getTimezoneOffset() * 60000);
    return localDate.toISOString().slice(0, 16); // "YYYY-MM-DDTHH:MM"
}

function changeDateRange(timeframe) {
    let start;
    const now = new Date();

    let end = toLocalDatetimeInputValue(now);

    switch (timeframe) {
        case "month":
            const oneMonthAgo = new Date(now);
            oneMonthAgo.setMonth(now.getMonth() - 1);
            start = toLocalDatetimeInputValue(oneMonthAgo);
            break;
        case "week":
            const oneWeekAgo = new Date(now);
            oneWeekAgo.setDate(now.getDate() - 7);
            start = toLocalDatetimeInputValue(oneWeekAgo);
            break;
        case "48hrs":
            start = toLocalDatetimeInputValue(new Date(now.getTime() - 48 * 60 * 60 * 1000));
            break;
        case "24hrs":
            start = toLocalDatetimeInputValue(new Date(now.getTime() - 24 * 60 * 60 * 1000));
            break;
    }
    document.getElementById('endBox').value = end;
    document.getElementById('startBox').value = start;

    console.log(`Start date: ${start}, End date: ${end}`);

    if (typeof setCustomTimeFilter === 'function') {
        setCustomTimeFilter();
    }

    activeTimeframe = timeframe;
    if (typeof syncTimeframeUI === 'function') {
        syncTimeframeUI();
    }

    resetMap();
}

/**
 * Query string for /me/track or /me/heatmap from the current UI state. An
 * all-time query sends no from/to so the server keeps one open-ended entry it
 * can extend incrementally.
 * @param {Object} options
 * @param {boolean} options.includeBuffer - add buffer_m (track only)
 * @param {boolean} options.refresh - ask the server to discard its cache entry
 */
function buildTrackQuery({ includeBuffer = true, refresh = false } = {}) {
    const params = new URLSearchParams();
    const device = document.getElementById('deviceBox').value;
    if (device) params.set('device', device);
    if (typeof isAllTimeQuery !== 'function' || !isAllTimeQuery()) {
        const from = toUTCISOString('startBox');
        const to = toUTCISOString('endBox');
        if (from) params.set('from', from);
        if (to) params.set('to', to);
    }
    if (includeBuffer) {
        const km = typeof getBufferKm === 'function' ? getBufferKm() : 0.5;
        params.set('buffer_m', String(Math.round(km * 1000)));
    }
    if (refresh) params.set('refresh', '1');
    return params;
}

// A 202 poll is a lock check on the server, so a tight interval is cheap.
const POLL_INTERVAL_MS = 1000;

/**
 * Fetch a server-computed result, polling while the server answers 202.
 * `refresh` is dropped after the first request: repeating it would make the
 * server throw away the entry it just finished.
 * @returns {Promise<Object>} parsed JSON body
 */
async function fetchServerResult(path, params, taskName) {
    const start = Date.now();
    for (;;) {
        const response = await fetch(path + '?' + params.toString());
        params.delete('refresh');

        if (response.status === 401) {
            setProgressBarError();
            throw new Error('Not logged in');
        }
        if (response.status === 202) {
            let progress = null;
            try { progress = (await response.json()).progress || null; } catch (e) { /* no body */ }
            if (progress) {
                const stage = { building: 'building corridors', importing: 'adding imported history' }[progress.stage]
                    || 'fetching GPS history';
                showServerProgress(progress.done, progress.total, `Computing on the server — ${stage}`);
            } else {
                setProgressMessage("Computing on the server — the first load of a long history can take a minute");
            }
            await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
            continue;
        }
        if (!response.ok) {
            let message = '';
            try { message = (await response.json()).error || ''; } catch (e) { /* not JSON */ }
            setProgressBarError();
            throw new Error(message || `Server error (HTTP ${response.status})`);
        }

        const data = await response.json();
        completeTask(taskName, Date.now() - start);
        return data;
    }
}

function flightsIncluded() {
    return typeof getFlightsShown === 'function' && getFlightsShown();
}

function applyServerStats(stats) {
    serverStats = stats || emptyStats();
    refreshStats();
}

function refreshStats() {
    const incl = flightsIncluded();
    const d = serverStats.driving;
    const f = serverStats.flying;
    showDistanceStat(d.distance_km + (incl ? f.distance_km : 0), incl);
    showAreaStat(d.area_km2 + (incl ? f.area_km2 : 0));
    showAltitudeStat(incl ? Math.max(d.max_alt_m, f.max_alt_m) : d.max_alt_m);
    showSpeedStat(incl ? Math.max(d.max_vel_kmh, f.max_vel_kmh) : d.max_vel_kmh, FLIGHT_ENTRY_KMH);
}

function resetCoverageStats() {
    applyServerStats(emptyStats());
}

/**
 * Stats for the anonymised all-users shape (/api/aggregate-roads properties).
 * There is no flight split in the aggregate, so everything lands under driving.
 */
function showEveryoneStats(props) {
    applyServerStats({
        driving: {
            distance_km: props.distance_km || 0,
            area_km2: props.area_km2 || 0,
            max_alt_m: props.max_alt || 0,
            max_vel_kmh: props.max_vel || 0
        },
        flying: emptyStats().flying
    });
}
