// Single source of truth for the summary stats shown on the main map page and
// the Everyone's Roads page. Each entry maps a value element id to its label and
// (optional) hover tooltip, so both pages render identical stats and info icons.
// To change a stat's wording or add an info tooltip, edit it here once.
const STAT_DEFINITIONS = [
    {
        id: "totalDist",
        label: "Total distance travelled",
        tooltip: "Note! This can be quite inaccurate over a large date range as there are some shortcuts in this calculation.",
    },
    {
        id: "totalArea",
        label: "Area explored",
    },
    {
        id: "totalAreaPct",
        label: "Percentage of west coast covered",
        tooltip: "Calculated by dividing your area explored by 863,428km, the area of Washington, Oregon, and California.",
    },
    {
        id: "highestAltitude",
        label: "Highest altitude",
    },
    {
        id: "highestVelocity",
        label: "Highest velocity",
    },
];

// Build the <h4> heading for one stat, appending the hover "i" info icon when the
// definition carries a tooltip. Mirrors the .info-icon / .tooltip-text markup that
// static/css/styles.css styles. Text is set via textContent so tooltip copy can't
// inject markup.
function buildStatHeading(def) {
    const heading = document.createElement("h4");
    heading.textContent = def.label;
    if (def.tooltip) {
        const icon = document.createElement("span");
        icon.className = "info-icon";
        icon.textContent = "i";

        const tip = document.createElement("span");
        tip.className = "tooltip-text";
        tip.textContent = def.tooltip;
        icon.appendChild(tip);

        // Leading space keeps the icon off the label, matching the original markup.
        heading.append(" ", icon);
    }
    return heading;
}

// Render all stats into `container`. When `cards` is true each stat gets its own
// .subPanel card (the Everyone's Roads flex grid); otherwise the headings/values
// stack directly inside the caller's existing panel (the main page).
function renderStatPanels(container, { cards = false } = {}) {
    if (!container) return;
    container.innerHTML = "";
    STAT_DEFINITIONS.forEach((def) => {
        const heading = buildStatHeading(def);

        const value = document.createElement("div");
        value.id = def.id;

        if (cards) {
            const card = document.createElement("div");
            card.className = "subPanel";
            card.style.flex = "1 1 180px";
            card.append(heading, value);
            container.appendChild(card);
        } else {
            container.append(heading, value);
        }
    });
}
