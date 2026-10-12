# everyones-roads Specification

## Purpose

A shared, anonymised map of everywhere every user on the server has been, merged into a
single shape, with population-level stats.

## Requirements

### Requirement: Merged anonymous shape
The API SHALL serve one merged corridor of all users' driving, including imported history, with no per-user or per-device breakdown.

#### Scenario: Viewing
- **WHEN** a signed-in user opens `/everyone`
- **THEN** they see one merged shape with combined distance, area, top speed and highest altitude

### Requirement: No filters
The Everyone view SHALL offer no date or device filters, so it cannot reveal where anyone is now.

#### Scenario: Request with filters
- **WHEN** a client calls `/all-roads` with user, device or date parameters
- **THEN** the parameters are ignored and the same all-time shape is returned

### Requirement: Sign-in required
The Everyone page and its data SHALL require a signed-in user.

#### Scenario: Anonymous visitor
- **WHEN** an anonymous visitor opens `/everyone`
- **THEN** they are redirected to the home page

### Requirement: Warming
While the aggregate is being computed, the API SHALL answer 503 and the page SHALL retry.

#### Scenario: Cold aggregate
- **WHEN** the aggregate cache is cold
- **THEN** the page shows that it is warming and loads the shape when ready

### Requirement: Your share
The page SHALL show what share of the merged shape's area the signed-in user's own roads make up.

#### Scenario: Share shown
- **WHEN** the shape and the user's own track have loaded
- **THEN** the page reads "Your roads make up N% of this shape"
