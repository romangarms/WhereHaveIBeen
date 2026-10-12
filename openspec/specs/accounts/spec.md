# accounts Specification

## Purpose

How people create, sign in to, and delete a WhereHaveIBeen account. The account is the
OwnTracks recorder login, stored by WhereHaveIBeen-API. The web app keeps no user
database of its own.

## Requirements

### Requirement: Registration
The web app SHALL create an account through WhereHaveIBeen-API. The username is 3–20 letters, digits or hyphens. The password is at least 12 characters with an uppercase letter, a lowercase letter and a digit. A successful registration SHALL sign the user in.

#### Scenario: Valid registration
- **WHEN** a visitor registers with a valid, unused username and a valid password
- **THEN** the account is created and the visitor is signed in

#### Scenario: Username with an underscore
- **WHEN** a visitor registers with a username containing `_`
- **THEN** registration is refused with "Username must be 3-20 characters (letters, numbers, and hyphens)."

#### Scenario: Repeated attempts
- **WHEN** one client IP makes more registration attempts than the API's hourly limit
- **THEN** further attempts are refused until the window passes

### Requirement: Sign in
The web app SHALL check the username and password against the recorder before signing a user in, and SHALL keep the session for 30 days.

#### Scenario: Wrong password
- **WHEN** a user signs in with a wrong password
- **THEN** the page shows "Invalid username or password." and no session is created

#### Scenario: Server unreachable
- **WHEN** the recorder cannot be reached during sign in
- **THEN** the page shows "Could not connect to server."

### Requirement: Session handling
The session cookie SHALL be signed with `WHIB_FLASK_SECRET_KEY` and set `Secure`, `HttpOnly` and `SameSite=Lax`. It holds the username and password and is signed but not encrypted.

#### Scenario: Cookie attributes
- **WHEN** a user signs in
- **THEN** the session cookie carries the Secure, HttpOnly and SameSite=Lax attributes and expires after 30 days

### Requirement: Sign out
Signing out SHALL clear the whole session.

#### Scenario: Sign out
- **WHEN** a signed-in user opens `/sign_out`
- **THEN** the session is cleared and they are returned to the home page signed out

### Requirement: Account deletion
A signed-in user SHALL be able to delete their account by re-entering their password. On success the session is cleared.

#### Scenario: Delete with password
- **WHEN** a signed-in user confirms deletion with their correct password
- **THEN** the account is deleted through the API and they are signed out

#### Scenario: Not signed in
- **WHEN** an anonymous request asks to delete an account
- **THEN** it is refused with 401

### Requirement: Inactive accounts
The API SHALL refuse every authenticated request from an account marked inactive.

#### Scenario: Inactive account
- **WHEN** an inactive account makes any authenticated request
- **THEN** the request is refused: 401 at the recorder gate, 403 on `/api/me/*`
