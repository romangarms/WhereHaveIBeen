import sys
from flask import (
    Flask,
    redirect,
    render_template,
    jsonify,
    request,
    session,
)
import requests
from requests.auth import HTTPBasicAuth
from datetime import timedelta, datetime
import os
import pytz
import re
from dotenv import load_dotenv

INTERNAL_ERROR_MESSAGE = "An internal error has occurred."

load_dotenv()

app = Flask(__name__)

app.secret_key = os.getenv("WHIB_FLASK_SECRET_KEY")
app.permanent_session_lifetime = timedelta(days=30)

DEFAULT_OSRM_URL = os.getenv("WHIB_DEFAULT_OSRM_URL")
OWNTRACKS_URL = os.getenv("WHIB_OWNTRACKS_URL")


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/about")
def guide():
    return render_template("about.html")


@app.route("/setup")
def setup():
    return render_template("setup.html")


"""Sign out by deleting cookie
"""


@app.route("/sign_out")
def sign_out():
    # Clear the session data
    session.clear()
    return redirect("/")


"""Create cookie with OwnTracks login info and URL

"""


@app.route("/login", methods=["POST", "GET"])
def login():
    if request.method == "POST":
        username = request.form["username"]
        password = request.form["password"]

        # Validate credentials against OwnTracks before storing in session
        try:
            validation = requests.get(
                OWNTRACKS_URL + "/api/0/last",
                auth=HTTPBasicAuth(username, password),
                timeout=10,
            )
            if validation.status_code != 200:
                app.logger.info(f"Login: OwnTracks returned {validation.status_code} for user '{username}'")
                return render_template("index.html", login_error="Invalid username or password."), 401
        except requests.RequestException as err:
            app.logger.error(f"Login: Error validating with OwnTracks: {err}")
            return render_template("index.html", login_error="Could not connect to server."), 500

        session.permanent = True
        session["username"] = username
        session["password"] = password

        return redirect("/")


@app.route("/register", methods=["POST"])
def register():
    try:
        data = request.get_json()
        username = data.get("username", "").strip() if data else ""
        password = data.get("password", "") if data else ""

        if not username or not re.match(r'^[a-zA-Z0-9_-]{1,50}$', username):
            return jsonify({"error": "Username must be 1-50 characters (letters, numbers, hyphens, underscores)."}), 400

        if len(password) < 12:
            return jsonify({"error": "Password must be at least 12 characters."}), 400
        if not re.search(r'[A-Z]', password):
            return jsonify({"error": "Password must contain an uppercase letter."}), 400
        if not re.search(r'[a-z]', password):
            return jsonify({"error": "Password must contain a lowercase letter."}), 400
        if not re.search(r'[0-9]', password):
            return jsonify({"error": "Password must contain a number."}), 400

        payload = {"username": username, "password": password}
        response = requests.post(OWNTRACKS_URL + "/api/register", json=payload, timeout=10)

        if response.status_code == 201:
            session.permanent = True
            session["username"] = username
            session["password"] = password

        return jsonify(response.json()), response.status_code

    except requests.RequestException as err:
        app.logger.error(f"Register: Error communicating with OwnTracks: {err}")
        return jsonify({"error": INTERNAL_ERROR_MESSAGE}), 500
    except Exception as err:
        app.logger.error(f"Register: Unexpected error: {err}")
        return jsonify({"error": INTERNAL_ERROR_MESSAGE}), 500


@app.route("/delete-account", methods=["POST"])
def delete_account():
    username = session.get("username")
    if not username:
        return jsonify({"error": "Not logged in."}), 401

    try:
        data = request.get_json()
        password = data.get("password", "") if data else ""

        if not password:
            return jsonify({"error": "Password is required."}), 400

        payload = {
            "username": username,
            "password": password,
        }
        response = requests.post(OWNTRACKS_URL + "/api/delete-account", json=payload, timeout=10)

        if response.status_code == 200:
            session.clear()

        return jsonify(response.json()), response.status_code

    except requests.RequestException as err:
        app.logger.error(f"DeleteAccount: Error communicating with OwnTracks: {err}")
        return jsonify({"error": INTERNAL_ERROR_MESSAGE}), 500
    except Exception as err:
        app.logger.error(f"DeleteAccount: Unexpected error: {err}")
        return jsonify({"error": INTERNAL_ERROR_MESSAGE}), 500


@app.route("/save_settings", methods=["POST"])
def save_settings():
    data = request.json
    # Retrieve user inputs from the form
    circle_size = data.get('circleSize')
    osrm_url = data.get('osrmURL')

    session.permanent = True

    # Store information in the session
    session["circle_size"] = circle_size
    session["osrm_url"] = osrm_url

    return jsonify({"message": "Settings saved successfully"})
    
@app.route("/get_settings")
def get_settings():
    return jsonify({
        "circleSize": session.get("circle_size"),
        "osrmURL": session.get("osrm_url")
    })


"""Get OwnTracks data from server and return to client


"""


@app.route("/locations")
def get_locations():
    try:
        params = {
            "from": "2015-01-01T01:00:00.0002Z",
            "to": "2099-12-31T23:59:59.000Z",
            "format": "geojson",
        }

        # get filters from query
        start_date = request.args.get("startdate")
        end_date = request.args.get("enddate")
        device = request.args.get("device")

        # Convert from local time to UTC
        if start_date:
            local_dt = datetime.fromisoformat(start_date)  # interpreted as local time
            utc_dt = local_dt.astimezone(pytz.UTC)  # convert to UTC
            params["from"] = utc_dt.isoformat(timespec='milliseconds').replace("+00:00", "Z")

        if end_date:
            local_dt = datetime.fromisoformat(end_date)
            utc_dt = local_dt.astimezone(pytz.UTC)
            params["to"] = utc_dt.isoformat(timespec='milliseconds').replace("+00:00", "Z")

        params["user"] = session.get("username", "").lower()

        if device:
            params["device"] = device

        # go make the request with login info from cookie
        response = requests.get(
            OWNTRACKS_URL + "/api/0/locations",
            auth=HTTPBasicAuth(session.get("username"), session.get("password")),
            params=params,
        )
        response.raise_for_status()
        data = response.json()
        # print(data)  # Print data to console
        return jsonify(data)
    except requests.HTTPError:
        return jsonify({"error": INTERNAL_ERROR_MESSAGE}), 500
    except Exception as err:
        app.logger.error(f"Locations: Other error occurred: {err}")
        return jsonify({"error": INTERNAL_ERROR_MESSAGE}), 500


@app.route("/usersdevices")
def get_users_devices():
    try:

        # go make the request with login info from cookie
        response = requests.get(
            OWNTRACKS_URL + "/api/0/last",
            auth=HTTPBasicAuth(session.get("username"), session.get("password")),
        )
        response.raise_for_status()
        data = response.json()
        # Filter to only the logged-in user's data
        username = session.get("username")
        app.logger.info(f"UsersDevices: OwnTracks returned {len(data)} entries, filtering for user '{username}'")
        app.logger.debug(f"UsersDevices: Usernames in response: {[e.get('username') for e in data]}")
        filtered = [entry for entry in data if entry.get("username", "").lower() == username.lower()]
        app.logger.info(f"UsersDevices: {len(filtered)} entries after filtering")
        return jsonify(filtered)
    except requests.HTTPError as http_err:
        app.logger.error(f"UsersAndDevices: HTTP error occurred: {http_err}")
        return jsonify({"error": INTERNAL_ERROR_MESSAGE}), 500
    except Exception as err:
        app.logger.error(f"UsersAndDevices: Other error occurred: {err}")
        return jsonify({"error": INTERNAL_ERROR_MESSAGE}), 500


"""Proxy all insecure requests to the insecure server

Unfortunately, the insecure server does not support HTTPS. 
This means that we cannot make requests to it from the 
client browser without mixed content errors
This route makes the server handle insecure requests so 
we don't have to
"""


@app.route("/proxy", methods=["GET"])
def proxy_route():
    print("Proxying request to insecure server")

    osrm_url = request.args.get('osrmURL')
    coords = request.args.get('coords') 
    coords = coords[1:]


    #print("coords: ", coords)

    target_url = ""
    # Construct the URL you want to forward the request to
    if osrm_url:
        target_url = f"{osrm_url}/route/v1/{coords}"
        #print("using custom osrm url")
    else:
        target_url = f"{DEFAULT_OSRM_URL}/route/v1/{coords}"
        #print("using default osrm url")

    if target_url.endswith("?overview=false"):
        target_url = target_url.replace("?overview=false", "")
    
    
    #print("target_url is ", target_url)

    # Forward the request to the insecure server
    response = requests.get(target_url)

    #print("response status code: ", response.status_code)
    #print("response content: ", response.content)

    # Return the response back to the client
    return jsonify(response.json())


if __name__ == "__main__":
    if os.getenv("WHIB_DEFAULT_OSRM_URL") == None:
        sys.exit("Missing Environment Variable: WHIB_DEFAULT_OSRM_URL")
    if os.getenv("WHIB_FLASK_SECRET_KEY") == None:
        sys.exit("Missing Environment Variable: WHIB_FLASK_SECRET_KEY")
    if os.getenv("WHIB_OWNTRACKS_URL") == None:
        sys.exit("Missing Environment Variable: WHIB_OWNTRACKS_URL")

    # app.run(host='0.0.0.0', port=5000)

    from waitress import serve

    print("Server running on http://127.0.0.1:5000")
    serve(app, host="0.0.0.0", port=5000, threads=10)
