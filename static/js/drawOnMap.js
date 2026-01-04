// Track all OSRM routing controls so they can be properly removed
let routingControls = [];

/**
 * Given the location data, list of latlngs, and color, this function calculates the routes for all given latlngs and draws it on the map as a single object.
 * @param {*} data retrieved from fetchLocations();
 * @param {*} latlngsList list of drivingLatlngs or flyingLatlngs
 * @param {*} color "blue" or "green" or "red"
 * @param {Object} options - Optional parameters for caching
 * @param {Object} options.cachedBuffer - Previously cached buffer to merge with
 * @returns {Object} The final buffer GeoJSON
 */
async function calculateAndDrawRoute(data, latlngsList, color, options = {}) {
    let lineStrings = [];
    for (const latlngs of latlngsList) {
        //drawing buffer
        if (latlngs.length > 1) {
            let linestring;

            //complex route buffer can only handle 500 points or less
            //simple route buffer can handle any number, but gets pretty slow north of 3000
            //no route is much quicker, but less accurate. Use the minDistance value to adjust accuracy.
            //Points between .01km of each other will be skipped if you pass in .01km
            if (data.features.length < 500) {
                try {
                    linestring = await calculateComplexRoute(latlngs);
                } catch (err) {
                    // OSRM routing failed (e.g., no road route possible over water)
                    // Fall back to simple route calculation
                    console.warn("Complex route calculation failed, falling back to simple route:", err.message);
                    linestring = await calculateSimpleRoute(latlngs);
                }
            } else if (data.features.length < 3000) {
                linestring = await calculateSimpleRoute(latlngs);
            } else if (data.features.length < 5000) {
                linestring = await calculateNoRoute(latlngs, 0.01);
            } else {
                linestring = await calculateNoRoute(latlngs, 0.1);
            }
            updateProgressBar();

            console.log("linestring: ", linestring);
            lineStrings.push(linestring);
        }

    }

    const buffer = await createUnifiedBuffer(lineStrings, 0.01, color, options);
    return buffer;
}


/**
     * Draw the route on the map and buffer it using the simple route method. The simple route method uses Turf.js to buffer the route without calculating the route.
     * @param {Object} data - The data to filter
     * @returns {Array} - The filtered data
     */
async function calculateNoRoute(latlngs, minDistBetweenPoints = 0.1) { //0.01 is 10m
    let start = Date.now();

    await new Promise(resolve => setTimeout(resolve, 0)); // Allow UI to update

    // Initialize an array to hold only the points that are sufficiently distant from each other
    let processedLatlngs = [];

    for (let i = 0; i < latlngs.length; i++) {
        const currentPoint = [latlngs[i][1], latlngs[i][0]]; // [lng, lat]
        let isFarEnough = true;

        // Check distance against all included points
        for (const includedPoint of processedLatlngs) {
            const distance = turf.distance(turf.point(includedPoint), turf.point(currentPoint), { units: 'kilometers' });
            if (distance < minDistBetweenPoints) {
                isFarEnough = false;
                break; // No need to check further if it's too close to any included point
            }
        }

        // Add the current point if it's far enough from all previous points
        if (isFarEnough) {
            processedLatlngs.push(currentPoint);

        }

        // Every 100 iterations, yield control back to the browser to allow the UI to update
        if (i % 100 === 0) {
            await new Promise(resolve => setTimeout(resolve, 0));
        }
    }

    // Create a lineString from the filtered list of points
    let lineString = turf.lineString(processedLatlngs);

    let timeTaken = Date.now() - start;
    completeTask("no route calculation", timeTaken);

    return lineString;
}

/**
     * Draw the route on the map and buffer it using the simple route method. The simple route method uses Turf.js to buffer the route without calculating the route.
     * @param {Object} data - The data to filter
     * @returns {Array} - The filtered data
     */
async function calculateSimpleRoute(latlngs) {
    let start = Date.now();

    await new Promise(resolve => setTimeout(resolve, 0)); // Allow UI to update

    // Split processing into smaller chunks
    let processedLatlngs = [];
    for (let i = 0; i < latlngs.length; i++) {
        processedLatlngs.push([latlngs[i][1], latlngs[i][0]]); // [lng, lat]

        // Every 100 iterations, yield control back to the browser to allow the UI to update
        if (i % 100 === 0) {
            await new Promise(resolve => setTimeout(resolve, 0));
        }
    }


    let lineString = turf.lineString(processedLatlngs);

    let timeTaken = Date.now() - start;
    completeTask("simple route calculation", timeTaken);

    return lineString;
}

/**
 * Draw the route on the map using Leaflet Routing Machine.
 * @param {Array} latlngs - The gps points to draw the route with
 */
async function calculateComplexRoute(latlngs) {
    console.log("latlngs: ", latlngs);
    let start = Date.now();

    let osrmRouter = "";
    try {
        osrmRouter = document.getElementById('osrmURL').value;
    } catch (err) {
        console.log("No custom OSRM router found, using default");
    }

    if (osrmRouter != "") {
        console.log("Using custom OSRM router: " + osrmRouter);
    } else {
        console.log("Using default OSRM router");
    }

    // Construct the service URL
    const serviceUrl = `/proxy?osrmURL=${encodeURIComponent(osrmRouter)}&coords=`;

    console.log("Service URL: ", serviceUrl);

    return new Promise((resolve, reject) => {
        let control = L.routing.control({
            waypoints: latlngs
                .map(function (latlng) {
                    return L.latLng(latlng[0], latlng[1]);
                }),
            router: L.Routing.osrmv1({
                serviceUrl: serviceUrl,
                profile: 'car', // or 'bike', 'foot' depending on your needs
            }),
            routeWhileDragging: false,
            createMarker: function () { return null; }, // Disable default marker
        }).addTo(map);

        // Track this control so it can be removed later
        routingControls.push(control);

        control.hide(); // hide top right panel

        control.on('routesfound', function (e) {
            let routes = e.routes;

            // Create a lineString for buffering based on the actual route
            let routeCoords = routes[0].coordinates.map(coord => [coord.lng, coord.lat]);
            let lineString = turf.lineString(routeCoords);

            let timeTaken = Date.now() - start;
            completeTask("complex route calculation", timeTaken);

            // Resolve the promise with the lineString
            resolve(lineString);
        });

        // Handle errors if needed
        control.on('routingerror', function (error) {
            reject(new Error("Routing failed: " + error.message));
        });
    });
}

/**
 * Add all lineStrings to a single buffer rather than separate buffers, prevents overlap on map
 * @param {*} lineStrings array of linestrings to buffer
 * @param {*} tolerance turf.simplify tolerance
 * @param {*} color color for buffer on map
 * @param {Object} options - Optional parameters for caching
 * @param {Object} options.cachedBuffer - Previously cached buffer to merge with
 * @param {boolean} options.skipRender - If true, only calculate buffer without rendering
 * @returns {Object} The unified buffer GeoJSON
 */
async function createUnifiedBuffer(lineStrings, tolerance, color, options = {}) {
    let unifiedBuffer = options.cachedBuffer || null;

    for (const lineString of lineStrings) {
        // Buffer each lineString and merge them into a single buffer
        const buffer = await drawBuffer(lineString, tolerance);
        if (unifiedBuffer) {
            try {
                unifiedBuffer = turf.union(unifiedBuffer, buffer);
            } catch (err) {
                console.error("Error merging buffers:", err);
                // If union fails, just use the new buffer
                unifiedBuffer = buffer;
            }
        } else {
            unifiedBuffer = buffer;
        }

        getLinestringStats(lineString);
        updateProgressBar();
    }

    // If no lineStrings but we have a cached buffer, use that
    if (!unifiedBuffer && options.cachedBuffer) {
        unifiedBuffer = options.cachedBuffer;
    }

    // If skipRender is true, just return the buffer without rendering
    if (options.skipRender || !unifiedBuffer) {
        return unifiedBuffer;
    }

    let bufferColor = "rgba(0, 0, 255, 0.4)"; // Default color is blue
    // Set the buffer color based on the selected color
    if (color == "blue") {
        bufferColor = "rgba(0, 0, 255, 0.4)";
    } else if (color == "green") {
        bufferColor = "rgba(0, 255, 0, 0.4)";
    }
    else if (color == "red") {
        bufferColor = "rgba(255, 0, 0, 0.4)";
    }

    // Convert the buffer to GeoJSON and add it to the map
    let bufferLayer = L.geoJSON(unifiedBuffer, {
        style: function () {
            return { color: bufferColor, weight: 2 };
        }
    }).addTo(map);

    // Adjust the map to fit the new buffer bounds
    try {
        const bounds = bufferLayer.getBounds();
        map.fitBounds(bounds);
    }
    catch (err) {
        console.log("No bounds found, err: " + err);
    }

    getBufferStats(unifiedBuffer);
    updateProgressBar();

    return unifiedBuffer;
}

/**
 * Render a cached buffer directly to the map
 * @param {Object} buffer - The cached buffer GeoJSON
 * @param {string} color - "blue", "green", or "red"
 */
function renderCachedBuffer(buffer, color) {
    if (!buffer) return;

    let bufferColor = "rgba(0, 0, 255, 0.4)";
    if (color == "blue") {
        bufferColor = "rgba(0, 0, 255, 0.4)";
    } else if (color == "green") {
        bufferColor = "rgba(0, 255, 0, 0.4)";
    } else if (color == "red") {
        bufferColor = "rgba(255, 0, 0, 0.4)";
    }

    let bufferLayer = L.geoJSON(buffer, {
        style: function () {
            return { color: bufferColor, weight: 2 };
        }
    }).addTo(map);

    try {
        const bounds = bufferLayer.getBounds();
        map.fitBounds(bounds);
    } catch (err) {
        console.log("No bounds found for cached buffer, err: " + err);
    }
}

/**
 * Merge a new buffer with a cached buffer
 * @param {Object} cachedBuffer - The cached buffer GeoJSON
 * @param {Object} newBuffer - The new buffer GeoJSON
 * @returns {Object} The merged buffer GeoJSON
 */
function mergeBuffers(cachedBuffer, newBuffer) {
    if (!cachedBuffer) return newBuffer;
    if (!newBuffer) return cachedBuffer;

    try {
        return turf.union(cachedBuffer, newBuffer);
    } catch (err) {
        console.error("Error merging buffers:", err);
        // If merge fails, return the new buffer
        return newBuffer;
    }
}

/**
 * Draw a buffer around the route using Turf.js.
 * @param {Object} lineString - The lineString to buffer
 * @returns {Object} - The buffer layer
 */
async function drawBuffer(lineString, tolerance) {
    let start = Date.now();

    let circleSize = 1; // Default circle size in km
    try {
        // Get the circle size from the UI
        circleSize = document.getElementById('circleSize').value;
    } catch (err) {
        console.log("No circle size found, using default");
    }

    let simplifiedLineString = lineString;
    if (tolerance != -1) {
        // Simplify the route in chunks to avoid freezing the UI
        simplifiedLineString = turf.simplify(lineString, { tolerance: tolerance, highQuality: false });
    }

    // Add a short pause to ensure the UI updates before buffering
    await new Promise(resolve => setTimeout(resolve, 0));

    //THIS IS THE LONG TASK
    // Buffer the simplified route with Turf.js in chunks
    let buffered;
    await new Promise(resolve => setTimeout(() => {
        buffered = turf.buffer(simplifiedLineString, circleSize, { units: 'kilometers', steps: 3 }); // 1 km buffer
        resolve();
    }, 0));

    let timeTaken = Date.now() - start;
    completeTask("buffer drawing", timeTaken);

    return buffered;
}

function addPopup(lat, lng, feature) {
    //Add marker to the map (recommended only for small datasets, quite laggy)
    L.marker([lat, lng]).addTo(map)
        .bindPopup(`<b>${feature.properties.name}</b><br>Velocity: ${feature.properties.vel} km/h` +
            `<br>Altitude: ${feature.properties.alt} m` +
            `<br>Acceleration: ${feature.properties.acc} m/s²` +
            `<br>Time: ${feature.properties.isotst}` +
            `<br>Accuracy: ${feature.properties.acc} m` +
            `<br>Latitude: ` + lat + `°` +
            `<br>Longitude: ` + lng + `°`);
}

/**
 * Clears and redraws map with new data
 * @param {*} user
 * @param {*} device
 * @returns
 */
function resetMap() {
    console.log("Resetting map");

    try {
        resetProgressBar();
        eraseLayers();
        resetCoverageStats()
    }
    catch (err) {
        console.log("No map data to erase, err: " + err);
    }


    //Remake route
    // Add a tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    // get new data
    runTasks();
}

// Function to erase the route from the map
function eraseRoute() {
    map.removeControl(control);
}

// Function to erase all layers from the map
function eraseLayers() {
    // Remove all routing controls first
    routingControls.forEach(control => {
        try {
            map.removeControl(control);
        } catch (e) {
            // Control may already be removed
        }
    });
    routingControls = [];

    // Remove all other layers
    map.eachLayer((layer) => {
        layer.remove();
    });
}