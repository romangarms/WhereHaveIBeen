let loggedIn = false;

function checkIfLoggedIn() {
    if (loggedIn) {
        completeTask("logged in", 0);
    }
    return loggedIn;
}

/**
 * Contacts the OwnTracks server to see what users and devices have been uploading data
 * @param {*} data
 * @returns
 * 
 */
async function getUsersAndDevices() {
    try {
        const response = await fetch('/usersdevices');

        if (!response.ok) {
            loggedIn = false;
            throw new Error('Error fetching users and devices. Are you logged in?');
        }

        const data = await response.json(); // Parse the JSON from the response

        // Iterate through the data and populate the sets
        let select = document.getElementById("userBox");
        select.innerHTML = '';

        select = document.getElementById("deviceBox");
        select.innerHTML = '';

        let el;

        data.forEach(entry => {
            if (entry.username) {
                select = document.getElementById("userBox");

                el = document.createElement("option");
                el.textContent = entry.username;
                el.value = entry.username;
                select.appendChild(el);
            }
            if (entry.device) {
                select = document.getElementById("deviceBox");

                el = document.createElement("option");
                el.textContent = entry.device;
                el.value = entry.device;
                select.appendChild(el);
            }
        });
        loggedIn = true;

        return 0;  // Return 0 if everything is successful

    } catch (error) {
        console.error('Fetch users and devices error:', error);
        loggedIn = false;
        return -1; // Return -1 in case of an error
    }
}

async function getUserSettings() {
    try {
        const response = await fetch('/get_settings');

        if (!response.ok) {
            throw new Error('Error fetching settings. Are you logged in?');
        }

        const data = await response.json(); // Parse the JSON from the response

        // load settings

        //osrm url
        let select = document.getElementById("osrmURL");
        select.value = data.osrmURL;

        //buffer size
        select = document.getElementById("circleSize");
        if (data.circleSize != null) {
            select.value = data.circleSize;
        } else {
            select.value = 0.5;
        }


        return 0;  // Return 0 if everything is successful
    } catch (error) {
        console.error('Fetch settings error:', error);
        return -1; // Return -1 in case of an error
    }
}

/**
 * Shows the login prompt
 */
function openForm() {
    document.getElementById("myForm").style.display = "block";
    document.getElementById("registerForm").style.display = "none";
    document.getElementById("sign_out").style.display = "none";
}

/**
 * Closes the login prompt
 */
function closeForm() {
    document.getElementById("myForm").style.display = "none";
    document.getElementById("registerForm").style.display = "none";
    document.getElementById("sign_out").style.display = "block";
}

/**
 * Switch to the registration form
 */
function showRegisterForm() {
    document.getElementById("myForm").style.display = "none";
    document.getElementById("registerForm").style.display = "block";
    document.getElementById("registerMessage").textContent = "";
    document.getElementById("registerMessage").className = "form-message";
}

/**
 * Switch back to the login form
 */
function showLoginForm() {
    document.getElementById("registerForm").style.display = "none";
    document.getElementById("myForm").style.display = "block";
}

/**
 * Submit registration form
 */
async function submitRegistration() {
    const username = document.getElementById("regUsername").value.trim();
    const password = document.getElementById("regPassword").value;
    const passwordConfirm = document.getElementById("regPasswordConfirm").value;
    const messageEl = document.getElementById("registerMessage");

    // Validate
    if (!username || !password) {
        messageEl.textContent = "Username and password are required.";
        messageEl.className = "form-message form-message-error";
        return;
    }

    if (password !== passwordConfirm) {
        messageEl.textContent = "Passwords do not match.";
        messageEl.className = "form-message form-message-error";
        return;
    }

    try {
        const response = await fetch("/register", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();

        if (response.status === 201) {
            messageEl.textContent = "Account created! Loading...";
            messageEl.className = "form-message form-message-success";

            // Auto-login: session is already set by the proxy
            closeForm();
            await getUsersAndDevices();
            runTasks();
        } else {
            messageEl.textContent = data.error || "Registration failed.";
            messageEl.className = "form-message form-message-error";
        }
    } catch (err) {
        messageEl.textContent = "Could not connect to server.";
        messageEl.className = "form-message form-message-error";
    }
}