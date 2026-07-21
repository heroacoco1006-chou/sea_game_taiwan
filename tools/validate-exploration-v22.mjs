import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const read = (rel) => JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8'));
const fail = (message) => { console.error(`FAIL: ${message}`); process.exitCode = 1; };
const unique = (values) => new Set(values).size === values.length;

const eventsData = read('src/data/exploration_events.json');
const pointsData = read('src/data/exploration_points.json');
const discoveriesData = read('src/data/discoveries.json');
const assetsData = read('assets/m5/v2/exploration/events/exploration-event-assets.json');
const discoveryIds = new Set(discoveriesData.discoveries.map((entry) => entry.id));
const eventById = new Map(eventsData.events.map((entry) => [entry.id, entry]));
const assetIds = new Set(assetsData.assets.map((entry) => entry.id));
const categories = new Set(['supply', 'hazard', 'encounter', 'clue', 'rare']);
const risks = new Set(['safe', 'medium', 'high']);

if (eventsData.version !== 2) fail('exploration_events version must be 2');
if (eventsData.chance !== 0.7) fail('event chance must be 0.7');
if (!assetIds.has(eventsData.safeEventImageId)) fail('safe event image is missing from manifest');
if (!unique(eventsData.events.map((entry) => entry.id))) fail('event ids must be unique');
if (!unique(pointsData.points.map((entry) => entry.id))) fail('point ids must be unique');
if (pointsData.points.length !== 12) fail('there must be exactly 12 exploration points');

for (const event of eventsData.events) {
  if (!event.imageId || !assetIds.has(event.imageId)) fail(`${event.id}: imageId is missing from manifest`);
  if (!categories.has(event.category)) fail(`${event.id}: invalid category`);
  if (!Array.isArray(event.tags) || event.tags.length === 0) fail(`${event.id}: tags are required`);
  if (!(event.weight > 0)) fail(`${event.id}: weight must be > 0`);
  for (const choice of event.choices ?? []) {
    if (choice.risk && !risks.has(choice.risk)) fail(`${event.id}: invalid risk`);
    const crew = choice.effects?.crew;
    if (crew !== undefined && (crew < -2 || crew > 0)) fail(`${event.id}: crew must be between -2 and 0`);
    if (crew < 0 && !['medium', 'high'].includes(choice.risk)) fail(`${event.id}: crew loss requires medium/high risk`);
  }
}

for (const point of pointsData.points) {
  if ('discoveries' in point) fail(`${point.id}: legacy discoveries field is forbidden`);
  if (!Array.isArray(point.terrainTags) || point.terrainTags.length === 0) fail(`${point.id}: terrainTags required`);
  if (!point.mainDiscoveries?.length) fail(`${point.id}: mainDiscoveries required`);
  if (!point.rareDiscoveries?.length) fail(`${point.id}: rareDiscoveries required`);
  if (!point.repeatRewards?.length) fail(`${point.id}: repeatRewards required`);
  if (!point.events?.length) fail(`${point.id}: events required`);
  for (const group of [point.mainDiscoveries ?? [], point.rareDiscoveries ?? []]) {
    for (const ref of group) {
      if (!discoveryIds.has(ref.id)) fail(`${point.id}: unknown discovery ${ref.id}`);
      if (!(ref.weight > 0)) fail(`${point.id}: discovery weight must be > 0`);
    }
  }
  const allUnique = [...point.mainDiscoveries, ...point.rareDiscoveries].map((ref) => ref.id);
  if (!unique(allUnique)) fail(`${point.id}: discovery repeated across main/rare pools`);
  for (const reward of point.repeatRewards) {
    if (!(reward.weight > 0) || !reward.text) fail(`${point.id}: invalid repeat reward`);
    if (![0, 1].includes(reward.adventureRep ?? 0)) fail(`${point.id}: repeat adventureRep must be 0 or 1`);
  }
  for (const ref of point.events) {
    if (typeof ref === 'string') fail(`${point.id}: legacy string event ref is forbidden`);
    const event = eventById.get(ref.id);
    if (!event) fail(`${point.id}: unknown event ${ref.id}`);
    if (!(ref.weight > 0)) fail(`${point.id}: event weight must be > 0`);
    if (event && !event.tags.some((tag) => point.terrainTags.includes(tag))) fail(`${point.id}: event ${ref.id} has no matching terrain tag`);
  }
}

const sourceDir = path.join(root, 'assets/m5/v2/exploration/events/source');
const runtimeDir = path.join(root, 'assets/m5/v2/exploration/events/runtime');
const pngNames = (dir) => fs.readdirSync(dir).filter((name) => name.endsWith('.png')).sort();
const sourceNames = pngNames(sourceDir);
const runtimeNames = pngNames(runtimeDir);
if (sourceNames.length !== 12 || runtimeNames.length !== 12) fail('source/runtime must each contain 12 PNG files');
if (sourceNames.join('|') !== runtimeNames.join('|')) fail('source/runtime basenames do not match');
for (const name of runtimeNames) {
  const bytes = fs.readFileSync(path.join(runtimeDir, name));
  const width = bytes.readUInt32BE(16);
  const height = bytes.readUInt32BE(20);
  if (width !== 768 || height !== 432) fail(`${name}: runtime size must be 768x432`);
}

if (!process.exitCode) {
  console.log(`Exploration v22 validation passed: ${pointsData.points.length} points, ${eventsData.events.length} events, ${runtimeNames.length} runtime images.`);
}
