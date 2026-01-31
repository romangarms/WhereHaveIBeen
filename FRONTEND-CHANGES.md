# Frontend Changes: Quick Reference Guide

This guide covers the changes needed to the WhereHaveIBeen frontend after the UserManagementAPI is deployed on your server.

## Prerequisites

- UserManagementAPI deployed and running on mini.romangarms.com:5002
- JWT_SECRET_KEY generated and saved from server deployment
- API health check returning success: `curl http://mini.romangarms.com:5002/health`

## Phase 1: Configure Fly.io Secrets

### Set Environment Variables

```bash
# From your local machine
cd /Users/romangarms/Documents/GitHub/wherehaveibeen

# Set API URL
fly secrets set WHIB_USER_API_URL=http://mini.romangarms.com:5002

# Set JWT secret (MUST match the one from UserManagementAPI .env)
fly secrets set WHIB_JWT_SECRET_KEY=<your_jwt_secret_from_server>

# Verify secrets are set
fly secrets list
```

## Phase 2: File Changes Summary

### New Files to Create

1. **templates/register.html** - User registration page
2. **static/css/register.css** (optional) - Registration page styles

### Files to Modify

1. **app.py** - Add registration route, modify login to use JWT
2. **templates/index.html** - Remove serverurl field, add registration link, remove user dropdown
3. **static/js/logIn.js** - Remove user dropdown population
4. **static/js/manageData.js** - Remove user parameter from requests
5. **requirements.txt** - Add pyjwt dependency
6. **.env** - Add new environment variables (for local testing)

## Phase 3: Detailed Changes

### 1. Update requirements.txt

**File:** `requirements.txt`

**Add:**
```
pyjwt==2.8.0
```

### 2. Update .env (for local testing)

**File:** `.env`

**Add:**
```bash
# UserManagement API Configuration
WHIB_USER_API_URL=http://mini.romangarms.com:5002
WHIB_JWT_SECRET_KEY=<your_jwt_secret>
```

### 3. Modify app.py

**File:** `app.py`

**Add after line 30 (after DEFAULT_OSRM_URL):**
```python
USER_API_URL = os.getenv("WHIB_USER_API_URL")
JWT_SECRET = os.getenv("WHIB_JWT_SECRET_KEY")
```

**Replace the /login route (lines 64-79):**
```python
@app.route("/login", methods=["POST", "GET"])
def login():
    if request.method == "POST":
        username = request.form["username"]
        password = request.form["password"]

        # Call UserManagementAPI
        try:
            response = requests.post(
                f"{USER_API_URL}/api/login",
                json={"username": username, "password": password},
                timeout=5
            )

            if response.status_code == 200:
                data = response.json()
                session.permanent = True
                session["jwt_token"] = data["jwt_token"]
                session["username"] = username
                session["device"] = data["device"]
                return redirect("/")
            else:
                return render_template("index.html", error="Invalid credentials"), 401
        except Exception as e:
            app.logger.error(f"Login error: {e}")
            return render_template("index.html", error="Login failed"), 500

    return redirect("/")
```

**Add new /register route (after /login):**
```python
@app.route("/register", methods=["GET", "POST"])
def register():
    if request.method == "POST":
        username = request.form["username"]
        password = request.form["password"]
        confirm_password = request.form["confirm_password"]
        device = request.form.get("device", "phone")

        # Client-side validation should catch this, but double-check
        if password != confirm_password:
            return render_template("register.html", error="Passwords do not match")

        # Call UserManagementAPI
        try:
            response = requests.post(
                f"{USER_API_URL}/api/register",
                json={
                    "username": username,
                    "password": password,
                    "device": device
                },
                timeout=5
            )

            if response.status_code == 201:
                return render_template("index.html", success="Account created! Please log in.")
            else:
                error = response.json().get("error", "Registration failed")
                return render_template("register.html", error=error)
        except Exception as e:
            app.logger.error(f"Registration error: {e}")
            return render_template("register.html", error="Registration failed")

    return render_template("register.html")
```

**Modify /locations route (lines 146-150) to use JWT:**
```python
response = requests.get(
    f"{USER_API_URL}/api/locations",
    headers={"Authorization": f"Bearer {session.get('jwt_token')}"},
    params=params,
    timeout=30
)
```

**Modify /usersdevices route (lines 167-170) to use JWT:**
```python
response = requests.get(
    f"{USER_API_URL}/api/last",
    headers={"Authorization": f"Bearer {session.get('jwt_token')}"},
    timeout=10
)
```

### 4. Modify templates/index.html

**File:** `templates/index.html`

**Find the login form (lines 13-22) and update:**

```html
<!-- BEFORE -->
<form action="/login" method="POST">
    <h3>Enter OwnTrack Login and URL</h3>
    <input type='text' placeholder='username' name='username' autocomplete="on" />
    <input type='password' placeholder='password' name='password' autocomplete="on" />
    <input type='serverurl' placeholder='https://[your domain]' name='serverurl' autocomplete="on" /></p>
    <input class="btn btn-success" type='submit' value='Login' />
</form>

<!-- AFTER -->
<form action="/login" method="POST">
    <h3>Login to WhereHaveIBeen</h3>
    <input type='text' placeholder='username' name='username' autocomplete="on" required />
    <input type='password' placeholder='password' name='password' autocomplete="on" required />
    <input class="btn btn-success" type='submit' value='Login' />
    <p style="margin-top: 10px; font-size: 0.9em;">
        Don't have an account? <a href="/register">Create one</a>
    </p>
</form>
```

**Find the user selection dropdown (around line 574) and remove it:**

```html
<!-- REMOVE THIS ENTIRE SECTION -->
<select class="form-select" id="userBox">
    <option value="" selected disabled>Choose a user</option>
</select>

<!-- KEEP ONLY DEVICE SELECTION -->
<h4>Choose a device</h4>
<select class="form-select" id="deviceBox">
    <option value="" selected disabled>Choose a device</option>
</select>
```

### 5. Modify static/js/logIn.js

**File:** `static/js/logIn.js`

**Find getUsersAndDevices() function (lines 16-63) and update:**

```javascript
async function getUsersAndDevices() {
    try {
        const response = await fetch('/usersdevices');

        if (!response.ok) {
            loggedIn = false;
            throw new Error('Error fetching users and devices. Are you logged in?');
        }

        const data = await response.json();

        // Only populate device dropdown (user is implicit from JWT)
        let select = document.getElementById("deviceBox");
        select.innerHTML = '';

        let el;

        data.forEach(entry => {
            if (entry.device) {
                select = document.getElementById("deviceBox");

                el = document.createElement("option");
                el.textContent = entry.device;
                el.value = entry.device;
                select.appendChild(el);
            }
        });
        loggedIn = true;

        return 0;

    } catch (error) {
        console.error('Fetch users and devices error:', error);
        loggedIn = false;
        return -1;
    }
}
```

### 6. Modify static/js/manageData.js

**File:** `static/js/manageData.js`

**Find where fetchLocations() builds the query parameters and remove the user parameter:**

Look for code that includes `user` in the fetch request parameters and remove it. The user is now implicit from the JWT token.

Example:
```javascript
// BEFORE
const params = new URLSearchParams({
    user: user,  // REMOVE THIS LINE
    device: device,
    startdate: startDate,
    enddate: endDate,
    format: 'geojson'
});

// AFTER
const params = new URLSearchParams({
    device: device,
    startdate: startDate,
    enddate: endDate,
    format: 'geojson'
});
```

### 7. Create templates/register.html

**File:** `templates/register.html`

**Create new file:**

```html
{% extends "layout.html" %}

{%block title %}
<title>Register - WhereHaveIBeen</title>
{%endblock%}

{% block main %}

<div class="container" style="max-width: 500px; margin-top: 50px;">
    <div class="card">
        <div class="card-body">
            <h2 class="card-title">Create Account</h2>

            {% if error %}
            <div class="alert alert-danger" role="alert">
                {{ error }}
            </div>
            {% endif %}

            <form action="/register" method="POST" onsubmit="return validateForm()">
                <div class="mb-3">
                    <label for="username" class="form-label">Username</label>
                    <input type="text" class="form-control" id="username" name="username"
                           minlength="3" maxlength="20" pattern="[a-zA-Z0-9_-]+" required>
                    <div class="form-text">3-20 characters, letters, numbers, hyphens, underscores only</div>
                </div>

                <div class="mb-3">
                    <label for="password" class="form-label">Password</label>
                    <input type="password" class="form-control" id="password" name="password"
                           minlength="12" required>
                    <div class="form-text" id="passwordHelp">
                        Minimum 12 characters, must include uppercase, lowercase, and number
                    </div>
                    <div class="progress mt-2" style="height: 5px;">
                        <div id="passwordStrength" class="progress-bar" role="progressbar" style="width: 0%"></div>
                    </div>
                </div>

                <div class="mb-3">
                    <label for="confirm_password" class="form-label">Confirm Password</label>
                    <input type="password" class="form-control" id="confirm_password" name="confirm_password"
                           minlength="12" required>
                    <div id="passwordMatch" class="form-text"></div>
                </div>

                <div class="mb-3">
                    <label for="device" class="form-label">Device Name</label>
                    <input type="text" class="form-control" id="device" name="device"
                           value="phone" maxlength="50" required>
                    <div class="form-text">Name of your OwnTracks device (e.g., "phone", "tablet")</div>
                </div>

                <button type="submit" class="btn btn-primary w-100">Create Account</button>

                <p class="text-center mt-3">
                    Already have an account? <a href="/">Log in</a>
                </p>
            </form>
        </div>
    </div>
</div>

<script>
    // Password strength indicator
    const passwordInput = document.getElementById('password');
    const strengthBar = document.getElementById('passwordStrength');

    passwordInput.addEventListener('input', function() {
        const password = this.value;
        let strength = 0;

        if (password.length >= 12) strength += 25;
        if (password.length >= 16) strength += 25;
        if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength += 25;
        if (/[0-9]/.test(password)) strength += 25;

        strengthBar.style.width = strength + '%';

        if (strength < 50) {
            strengthBar.className = 'progress-bar bg-danger';
        } else if (strength < 75) {
            strengthBar.className = 'progress-bar bg-warning';
        } else {
            strengthBar.className = 'progress-bar bg-success';
        }
    });

    // Password match indicator
    const confirmInput = document.getElementById('confirm_password');
    const matchText = document.getElementById('passwordMatch');

    confirmInput.addEventListener('input', function() {
        if (this.value === passwordInput.value) {
            matchText.textContent = '✓ Passwords match';
            matchText.className = 'form-text text-success';
        } else {
            matchText.textContent = '✗ Passwords do not match';
            matchText.className = 'form-text text-danger';
        }
    });

    // Form validation
    function validateForm() {
        const password = document.getElementById('password').value;
        const confirm = document.getElementById('confirm_password').value;

        if (password !== confirm) {
            alert('Passwords do not match!');
            return false;
        }

        if (password.length < 12) {
            alert('Password must be at least 12 characters!');
            return false;
        }

        if (!/[A-Z]/.test(password)) {
            alert('Password must contain at least one uppercase letter!');
            return false;
        }

        if (!/[a-z]/.test(password)) {
            alert('Password must contain at least one lowercase letter!');
            return false;
        }

        if (!/[0-9]/.test(password)) {
            alert('Password must contain at least one number!');
            return false;
        }

        return true;
    }
</script>

{% endblock %}
```

## Phase 4: Testing

### Local Testing (Optional)

```bash
# Install dependencies
pip install -r requirements.txt

# Run locally
python app.py

# Test registration at http://localhost:5000/register
# Test login at http://localhost:5000
```

### Deploy to Fly.io

```bash
# Deploy
fly deploy

# Monitor logs
fly logs

# Test in production
# Visit https://your-app.fly.dev/register
```

## Phase 5: Verification Checklist

- [ ] Fly.io secrets configured correctly
- [ ] requirements.txt includes pyjwt
- [ ] app.py loads USER_API_URL and JWT_SECRET
- [ ] /login route uses UserManagementAPI
- [ ] /register route created
- [ ] /locations uses JWT authentication
- [ ] /usersdevices uses JWT authentication
- [ ] templates/index.html removes serverurl field
- [ ] templates/index.html removes user dropdown
- [ ] templates/index.html adds registration link
- [ ] templates/register.html created
- [ ] static/js/logIn.js removes user dropdown population
- [ ] static/js/manageData.js removes user parameter
- [ ] App deployed to Fly.io
- [ ] Can register new user
- [ ] Can log in with new user
- [ ] Can view map with location data
- [ ] Cannot see other users' data

## Rollback Plan

```bash
# Revert to previous deployment
fly releases list
fly releases rollback <previous-version>

# Or revert git changes
git revert HEAD
fly deploy
```

## Next Steps After Deployment

1. Test complete user flow:
   - Register new account
   - Log in
   - View map
   - Add device in OwnTracks mobile app
   - Verify location data appears

2. Monitor for issues:
   ```bash
   fly logs --tail
   ```

3. Test privacy enforcement:
   - Create two test accounts
   - Verify each can only see their own data

## Support

- Frontend repo: https://github.com/romangarms/wherehaveibeen
- API repo: https://github.com/romangarms/WhereHaveIBeen-API
- API deployment guide: DEPLOYMENT.md in API repo
