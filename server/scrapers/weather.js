// Open-Meteo scraper. Free, no API key, generous rate limits.
// We fetch current weather + 5-day forecast for 10 UK cities and 6
// representative world cities. The narrative outlook is synthesised from
// the London forecast because Open-Meteo doesn't ship prose summaries.

const axios = require('axios');
const cache = require('../cache');

const UK_CITIES = [
  { name: 'London',     lat: 51.5074, lon: -0.1278 },
  { name: 'Manchester', lat: 53.4808, lon: -2.2426 },
  { name: 'Birmingham', lat: 52.4862, lon: -1.8904 },
  { name: 'Leeds',      lat: 53.8008, lon: -1.5491 },
  { name: 'Liverpool',  lat: 53.4084, lon: -2.9916 },
  { name: 'Bristol',    lat: 51.4545, lon: -2.5879 },
  { name: 'Newcastle',  lat: 54.9783, lon: -1.6178 },
  { name: 'Edinburgh',  lat: 55.9533, lon: -3.1883 },
  { name: 'Cardiff',    lat: 51.4816, lon: -3.1791 },
  { name: 'Belfast',    lat: 54.5973, lon: -5.9301 },
];

const REGION_CITIES = {
  scotland:        { name: 'Edinburgh',  lat: 55.9533, lon: -3.1883 },
  wales:           { name: 'Cardiff',    lat: 51.4816, lon: -3.1791 },
  northernIreland: { name: 'Belfast',    lat: 54.5973, lon: -5.9301 },
  england:         { name: 'London',     lat: 51.5074, lon: -0.1278 },
};

const WORLD_CITIES = [
  { name: 'Paris',    lat: 48.8566, lon:   2.3522 },
  { name: 'Madrid',   lat: 40.4168, lon:  -3.7038 },
  { name: 'Rome',     lat: 41.9028, lon:  12.4964 },
  { name: 'Berlin',   lat: 52.5200, lon:  13.4050 },
  { name: 'New York', lat: 40.7128, lon: -74.0060 },
  { name: 'Sydney',   lat: -33.8688, lon:151.2093 },
];

// Descriptions capped at 11 chars to fit the weather page outlook column.
const WEATHER_CODE = new Map([
  [0,  'Clear sky'],     [1,  'Mainly cler'], [2,  'Partly cld'],
  [3,  'Overcast'],      [45, 'Fog'],          [48, 'Fog'],
  [51, 'Lt drizzle'],    [53, 'Drizzle'],      [55, 'Hvy drizzle'],
  [56, 'Frzg drzle'],    [57, 'Frzg drzle'],
  [61, 'Light rain'],    [63, 'Rain'],         [65, 'Heavy rain'],
  [66, 'Frzg rain'],     [67, 'Frzg rain'],
  [71, 'Light snow'],    [73, 'Snow'],         [75, 'Heavy snow'],
  [77, 'Snow grain'],
  [80, 'Showers'],       [81, 'Showers'],      [82, 'Hvy showers'],
  [85, 'Snow shwrs'],    [86, 'Snow shwrs'],
  [95, 'Thunder'],       [96, 'Thndr/hail'],   [99, 'Thndr/hail'],
]);

function describe(code) {
  return WEATHER_CODE.get(code) || 'Unknown';
}

function windString(speedKmh, dirDeg) {
  if (speedKmh == null) return '';
  const mph = Math.round(speedKmh * 0.6213712);
  const dirs = ['N','NE','E','SE','S','SW','W','NW'];
  const dir = dirDeg == null ? '' : dirs[Math.round(((dirDeg % 360) / 45)) % 8];
  return `${dir} ${mph}mph`.trim();
}

async function fetchCity({ name, lat, lon }) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&current=temperature_2m,weather_code,wind_speed_10m,wind_direction_10m` +
    `&daily=temperature_2m_max,temperature_2m_min,weather_code` +
    `&timezone=auto&forecast_days=5`;
  const { data } = await axios.get(url, { timeout: 8000 });
  return { name, data };
}

function summariseOutlook(londonDaily) {
  if (!londonDaily || !londonDaily.weather_code) return 'Mixed conditions across the country.';
  const today = describe(londonDaily.weather_code[0]).toLowerCase();
  const max = Math.round(londonDaily.temperature_2m_max[0]);
  const tomorrowMax = Math.round(londonDaily.temperature_2m_max[1] ?? max);
  const trend = tomorrowMax > max + 1 ? 'warmer' : (tomorrowMax < max - 1 ? 'cooler' : 'similar temperatures');
  return `${today.charAt(0).toUpperCase() + today.slice(1)} in the south today with highs around ${max}C. ` +
         `Tomorrow ${trend}, peaks ${tomorrowMax}C.`;
}

function regionSummary(name, daily) {
  if (!daily) return 'Forecast unavailable.';
  const cond = describe(daily.weather_code[0]);
  const max = Math.round(daily.temperature_2m_max[0]);
  const min = Math.round(daily.temperature_2m_min[0]);
  return `${cond} with highs of ${max}C and lows of ${min}C. ` +
         `${describe(daily.weather_code[1] ?? daily.weather_code[0])} tomorrow.`;
}

async function run() {
  const ukResults = await Promise.allSettled(UK_CITIES.map(fetchCity));
  const cities = [];
  let londonDaily = null;
  for (let i = 0; i < ukResults.length; i++) {
    const r = ukResults[i];
    if (r.status !== 'fulfilled') {
      console.warn(`weather: ${UK_CITIES[i].name} failed:`, r.reason && r.reason.message);
      continue;
    }
    const { name, data } = r.value;
    if (name === 'London') londonDaily = data.daily;
    cities.push({
      name,
      tempC: Math.round(data.current.temperature_2m),
      condition: describe(data.current.weather_code),
      wind: windString(data.current.wind_speed_10m, data.current.wind_direction_10m),
    });
  }

  // Five-day from London (representative).
  const fiveDay = [];
  if (londonDaily && londonDaily.time) {
    const dayLabels = ['Today', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun', 'Mon'];
    const today = new Date();
    for (let i = 0; i < Math.min(5, londonDaily.time.length); i++) {
      const date = new Date(londonDaily.time[i]);
      const label = i === 0 ? 'Today' : ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][date.getDay()];
      fiveDay.push({
        day: label,
        high: Math.round(londonDaily.temperature_2m_max[i]),
        low:  Math.round(londonDaily.temperature_2m_min[i]),
        icon: describe(londonDaily.weather_code[i]),
      });
    }
  }

  // Regional prose.
  const regionResults = await Promise.allSettled(
    Object.entries(REGION_CITIES).map(([_, city]) => fetchCity(city))
  );
  const regions = {};
  const regionKeys = Object.keys(REGION_CITIES);
  for (let i = 0; i < regionResults.length; i++) {
    const r = regionResults[i];
    if (r.status === 'fulfilled') {
      regions[regionKeys[i]] = regionSummary(regionKeys[i], r.value.data.daily);
    }
  }

  // World cities.
  const worldResults = await Promise.allSettled(WORLD_CITIES.map(fetchCity));
  const world = [];
  for (let i = 0; i < worldResults.length; i++) {
    const r = worldResults[i];
    if (r.status === 'fulfilled') {
      world.push({
        city: WORLD_CITIES[i].name,
        tempC: Math.round(r.value.data.current.temperature_2m),
        condition: describe(r.value.data.current.weather_code),
      });
    }
  }
  regions.world = world;

  if (cities.length === 0) {
    console.warn('weather: no cities fetched, leaving cache untouched');
    return;
  }

  cache.set('weather', {
    fetchedAt: new Date().toISOString(),
    outlook: summariseOutlook(londonDaily),
    cities,
    fiveDay,
    regions,
  });
  console.log(`weather: cached ${cities.length} UK cities, ${world.length} world cities`);
}

module.exports = {
  // Every 30 minutes.
  schedule: '*/30 * * * *',
  run,
  name: 'weather',
};
