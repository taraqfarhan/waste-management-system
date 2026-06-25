# Waste Management System — Rajshahi City Corporation

A web-based dashboard to monitor Secondary Transfer Stations (STSs) across Rajshahi City,
with live fill-level tracking, clearance countdowns, and station details.

---

## Add or Edit a New Station

Open `data/stations.json` and add a new object to the `"stations"` array:

```json
{
  "id": "northern",
  "name": "Adarsha School Secondary Transfer Station",
  "location": "Norther More, Rajshahi",
  "ward": "Ward 22",
  "capacity_tons": 50,
  "clearance_time": "06:00 pm",
  "contact": "+880721770003",
  "image": "images/sts3.jpg",
  "lat": 24.364694,
  "lng": 88.625995
}
```

Then drop `sts-terakhadia.jpg` into the `public/images/` folder.

## Add or Edit the Station Coordinates

1. First add `lat` and `lng` properties for the new station to `data/stations.json` as described above.
2. Then, edit `STATIO_COORDS` in `public/map.json` and add the new station's coordinates:

```js
const STATION_COORDS = {
  bulonpur: [24.3745, 88.5764],
  railway:  [24.374469, 88.607582],
  northern: [24.364694, 88.625995],
  sapura: [24.385446, 88.601423],
  terokhadia: [24.38479, 88.59234],
  kazla: [24.36436, 88.63281]
};
```

---

## Running Locally

```bash
npm install
npm start
```
