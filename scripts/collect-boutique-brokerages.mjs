import { writeFile } from 'node:fs/promises';
import path from 'node:path';

const today = new Date().toISOString().slice(0, 10).replaceAll('-', '');
const root = process.cwd();
const csvPath = path.join(root, 'data', `boutique_brokerage_targets_${today}.csv`);
const summaryPath = path.join(root, 'data', `boutique_brokerage_targets_${today}_summary.json`);

const markets = [
  ['AL', 'Huntsville', 34.7304, -86.5861, 28],
  ['AL', 'Birmingham', 33.5186, -86.8104, 28],
  ['AR', 'Little Rock', 34.7465, -92.2896, 28],
  ['AZ', 'Tucson', 32.2226, -110.9747, 28],
  ['AZ', 'Scottsdale', 33.4942, -111.9261, 24],
  ['CA', 'Fresno', 36.7378, -119.7871, 28],
  ['CA', 'Bakersfield', 35.3733, -119.0187, 28],
  ['CA', 'Sacramento', 38.5816, -121.4944, 28],
  ['CA', 'Palm Springs', 33.8303, -116.5453, 22],
  ['CA', 'Temecula', 33.4936, -117.1484, 22],
  ['CO', 'Colorado Springs', 38.8339, -104.8214, 28],
  ['CO', 'Fort Collins', 40.5853, -105.0844, 24],
  ['FL', 'Sarasota', 27.3364, -82.5307, 24],
  ['FL', 'Tampa', 27.9506, -82.4572, 28],
  ['FL', 'Orlando', 28.5383, -81.3792, 28],
  ['FL', 'Jacksonville', 30.3322, -81.6557, 28],
  ['FL', 'Cape Coral', 26.5629, -81.9495, 24],
  ['FL', 'Naples', 26.1420, -81.7948, 22],
  ['FL', 'Destin', 30.3935, -86.4958, 22],
  ['GA', 'Savannah', 32.0809, -81.0912, 24],
  ['GA', 'Augusta', 33.4735, -82.0105, 24],
  ['GA', 'Athens', 33.9519, -83.3576, 22],
  ['GA', 'Marietta', 33.9526, -84.5499, 24],
  ['IA', 'Des Moines', 41.5868, -93.625, 28],
  ['ID', 'Boise', 43.615, -116.2023, 28],
  ['IL', 'Naperville', 41.7508, -88.1535, 24],
  ['IL', 'Peoria', 40.6936, -89.589, 24],
  ['IN', 'Fort Wayne', 41.0793, -85.1394, 24],
  ['IN', 'Carmel', 39.9784, -86.118, 24],
  ['KS', 'Wichita', 37.6872, -97.3301, 28],
  ['KY', 'Lexington', 38.0406, -84.5037, 28],
  ['KY', 'Louisville', 38.2527, -85.7585, 28],
  ['LA', 'Baton Rouge', 30.4515, -91.1871, 28],
  ['LA', 'Lafayette', 30.2241, -92.0198, 24],
  ['MA', 'Worcester', 42.2626, -71.8023, 24],
  ['MD', 'Annapolis', 38.9784, -76.4922, 22],
  ['MI', 'Grand Rapids', 42.9634, -85.6681, 28],
  ['MI', 'Ann Arbor', 42.2808, -83.743, 24],
  ['MN', 'Rochester', 44.0121, -92.4802, 24],
  ['MO', 'Springfield', 37.209, -93.2923, 24],
  ['MO', 'Columbia', 38.9517, -92.3341, 22],
  ['MT', 'Bozeman', 45.677, -111.0429, 22],
  ['NC', 'Asheville', 35.5951, -82.5515, 24],
  ['NC', 'Raleigh', 35.7796, -78.6382, 28],
  ['NC', 'Charlotte', 35.2271, -80.8431, 28],
  ['NC', 'Wilmington', 34.2104, -77.8868, 24],
  ['SC', 'Charleston', 32.7765, -79.9311, 24],
  ['SC', 'Greenville', 34.8526, -82.394, 24],
  ['SC', 'Myrtle Beach', 33.6891, -78.8867, 22],
  ['TN', 'Nashville', 36.1627, -86.7816, 28],
  ['TN', 'Knoxville', 35.9606, -83.9207, 24],
  ['TN', 'Chattanooga', 35.0456, -85.3097, 24],
  ['TN', 'Memphis', 35.1495, -90.049, 28],
  ['TX', 'Austin', 30.2672, -97.7431, 28],
  ['TX', 'San Antonio', 29.4241, -98.4936, 28],
  ['TX', 'Fort Worth', 32.7555, -97.3308, 28],
  ['TX', 'Frisco', 33.1507, -96.8236, 24],
  ['TX', 'McKinney', 33.1972, -96.6398, 24],
  ['TX', 'Waco', 31.5493, -97.1467, 24],
  ['UT', 'Provo', 40.2338, -111.6585, 24],
  ['UT', 'St. George', 37.0965, -113.5684, 22],
  ['VA', 'Richmond', 37.5407, -77.436, 28],
  ['VA', 'Virginia Beach', 36.8529, -75.978, 24],
  ['WA', 'Spokane', 47.6588, -117.426, 24],
  ['WA', 'Tacoma', 47.2529, -122.4443, 24],
  ['WI', 'Madison', 43.0731, -89.4012, 24],
];

const positivePattern = /\b(realty|realtors?|real\s+estate|properties|brokerage|brokers?|group|homes?|living|estate|land|coastal|premier|signature)\b/i;
const majorBrandPattern = /\b(keller\s*williams|\bkw\b|coldwell\s*banker|re\s*\/?\s*max|remax|century\s*21|\bc21\b|berkshire\s+hathaway|sotheby|compass|redfin|e\s*x\s*p\s*realty|exp\s+realty|exit\s+realty|era\s+real\s+estate|better\s+homes\s+and\s+gardens|bhgre|howard\s+hanna|long\s*&\s*foster|weichert|fathom\s+realty|realty\s+one|homesmart|united\s+real\s+estate|douglas\s+elliman|corcoran|the\s+agency\b|windermere|crye[-\s]*leike|allen\s+tate|john\s+l\.?\s*scott|william\s+raveis|realty\s+executives|russ\s+lyon|baird\s*&\s*warner|@properties|intero|sereno|first\s+team|harcourts|nest\s+realty|zillow|orchard|opendoor|offerpad)\b/i;
const badTypePattern = /\b(apartments?|apartment\s+homes|leasing\s+office|storage|title\s+company|mortgage|lending|loans?|insurance|inspection|appraisal|academy|school|commercial|property\s+management|vacation\s+rental|short\s+term\s+rental|airbnb|timeshare|home\s+buyers?|cash\s+offer|we\s+buy\s+houses?|hoa|association|developer|development|construction|builders?|new\s+homes?\s+sales|senior\s+living|student\s+housing)\b/i;
const smallTeamPattern = /\b(realtor|agent|team|group|associates?)\b/i;

function bbox(lat, lon, km) {
  const dLat = km / 111;
  const dLon = km / (111 * Math.max(0.2, Math.cos(lat * Math.PI / 180)));
  return `${lat - dLat},${lon - dLon},${lat + dLat},${lon + dLon}`;
}

function normalizeUrl(value) {
  const url = String(value || '').trim();
  if (!url) return '';
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

function csvEscape(value) {
  const text = String(value ?? '');
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function sourceUrl(element) {
  return `https://www.openstreetmap.org/${element.type}/${element.id}`;
}

async function fetchMarket([state, market, lat, lon, km]) {
  const box = bbox(lat, lon, km);
  const query = `[out:json][timeout:25];(node["office"="estate_agent"](${box});way["office"="estate_agent"](${box});relation["office"="estate_agent"](${box}););out tags center;`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45000);

  try {
    const response = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded;charset=UTF-8',
        'user-agent': 'AdAgencyAutopilotLeadResearch/1.0 (prospecting research)',
      },
      body: new URLSearchParams({ data: query }),
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${(await response.text()).slice(0, 120)}`);
    }
    const data = await response.json();
    return { state, market, elements: data.elements || [] };
  } finally {
    clearTimeout(timeout);
  }
}

const raw = new Map();
const errors = [];

for (let i = 0; i < markets.length; i += 1) {
  const market = markets[i];
  try {
    const result = await fetchMarket(market);
    let added = 0;
    for (const element of result.elements) {
      const name = element.tags?.name?.trim();
      if (!name) continue;
      const key = `${element.type}:${element.id}`;
      const existing = raw.get(key) || { element, markets: new Set() };
      existing.markets.add(`${result.market}, ${result.state}`);
      raw.set(key, existing);
      added += 1;
    }
    console.log(`${String(i + 1).padStart(2, '0')}/${markets.length} ${result.market}, ${result.state}: ${added} elements, ${raw.size} unique`);
  } catch (error) {
    errors.push({ market: `${market[1]}, ${market[0]}`, error: error.message });
    console.log(`${String(i + 1).padStart(2, '0')}/${markets.length} ${market[1]}, ${market[0]}: skipped (${error.message})`);
  }
  await new Promise((resolve) => setTimeout(resolve, 300));
}

const rows = [];
let excluded = 0;

for (const record of raw.values()) {
  const { element, markets: seenMarkets } = record;
  const tags = element.tags || {};
  const name = String(tags.name || '').trim();
  const haystack = [tags.name, tags.brand, tags.operator, tags.description].filter(Boolean).join(' ');

  if (!positivePattern.test(haystack) || majorBrandPattern.test(haystack) || badTypePattern.test(haystack)) {
    excluded += 1;
    continue;
  }

  const center = element.center || element;
  const website = normalizeUrl(tags.website || tags['contact:website'] || tags.url);
  const phone = String(tags.phone || tags['contact:phone'] || '').trim();
  const email = String(tags.email || tags['contact:email'] || '').trim();
  const score = Math.min(
    95,
    50 +
      (website ? 15 : 0) +
      (phone ? 10 : 0) +
      (email ? 8 : 0) +
      (/\b(brokerage|brokers?|realty|real\s+estate)\b/i.test(name) ? 8 : 0) +
      (smallTeamPattern.test(name) ? 5 : 0)
  );

  rows.push({
    brokerage_name: name,
    city: tags['addr:city'] || tags['contact:city'] || '',
    state: tags['addr:state'] || tags['contact:state'] || '',
    street_address: [tags['addr:housenumber'], tags['addr:street']].filter(Boolean).join(' '),
    postal_code: tags['addr:postcode'] || '',
    phone,
    email,
    website,
    nearest_seed_markets: [...seenMarkets].sort().join('; '),
    latitude: center.lat || '',
    longitude: center.lon || '',
    lead_score: score,
    qualification_status: 'candidate_independent_boutique_needs_manual_validation',
    qualification_reason: 'OSM office=estate_agent; not matched to excluded national/franchise brand; verify license/roster before outreach',
    source: 'OpenStreetMap office=estate_agent via Overpass API',
    source_url: sourceUrl(element),
    osm_type: element.type,
    osm_id: element.id,
  });
}

const deduped = new Map();
for (const row of rows) {
  const websiteKey = row.website.toLowerCase().replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');
  const phoneKey = row.phone.replace(/\D/g, '');
  const key = websiteKey || phoneKey || `${row.brokerage_name.toLowerCase()}|${row.city.toLowerCase()}|${row.state.toLowerCase()}`;
  const existing = deduped.get(key);
  if (!existing || row.lead_score > existing.lead_score) deduped.set(key, row);
}

const finalRows = [...deduped.values()].sort((a, b) => {
  if (b.lead_score !== a.lead_score) return b.lead_score - a.lead_score;
  return `${a.state} ${a.city} ${a.brokerage_name}`.localeCompare(`${b.state} ${b.city} ${b.brokerage_name}`);
});

const fields = [
  'brokerage_name',
  'city',
  'state',
  'street_address',
  'postal_code',
  'phone',
  'email',
  'website',
  'nearest_seed_markets',
  'latitude',
  'longitude',
  'lead_score',
  'qualification_status',
  'qualification_reason',
  'source',
  'source_url',
  'osm_type',
  'osm_id',
];

const csv = [fields.join(','), ...finalRows.map((row) => fields.map((field) => csvEscape(row[field])).join(','))].join('\n') + '\n';
await writeFile(csvPath, csv, 'utf8');

const summary = {
  created: new Date().toISOString(),
  source: 'OpenStreetMap office=estate_agent via Overpass API',
  markets_queried: markets.length,
  raw_unique_osm_elements: raw.size,
  candidate_rows_after_filters_and_dedupe: finalRows.length,
  excluded_by_filter_or_low_signal: excluded,
  errors,
  output_csv: csvPath,
  filter_note:
    'Excluded obvious national/franchise brands and non-brokerage-adjacent businesses by name pattern. Rows are candidate prospects, not verified broker license/roster records.',
};
await writeFile(summaryPath, JSON.stringify(summary, null, 2), 'utf8');
console.log(JSON.stringify(summary, null, 2));
