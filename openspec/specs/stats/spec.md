# stats Specification

## Purpose

The numbers shown alongside a map: how far, how much area, how much of the West Coast,
and records. The web app and the iOS app share the wording and units.

## Requirements

### Requirement: Stat set
Each stats display SHALL show distance, area explored, "West coast covered" (area as a percentage of WA + OR + CA, 863,428 km²), highest altitude and top speed.

#### Scenario: Coverage
- **WHEN** the explored area is 10,274.6 km²
- **THEN** "West coast covered" shows 1.19 %

### Requirement: Units
Values SHALL be shown in imperial units first (mi, mi², ft, mph), with the metric value underneath (km, km², m, km/h).

#### Scenario: Distance
- **WHEN** the distance is 48,709.3 km
- **THEN** the stat shows 30,267 mi with 48,709 km underneath

### Requirement: Flights in stats
Driving stats SHALL exclude flights unless flights are shown. A top speed above 200 mph SHALL be noted as on a flight.

#### Scenario: Flights shown
- **WHEN** flights are shown
- **THEN** distance and area include flights, the label reads "Distance travelled", and maxima take the larger of driving and flying
