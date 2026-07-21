import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const pointsPath = path.join(root, 'src/data/exploration_points.json');
const discoveriesPath = path.join(root, 'src/data/discoveries.json');
const pointsData = JSON.parse(fs.readFileSync(pointsPath, 'utf8'));
const discoveriesData = JSON.parse(fs.readFileSync(discoveriesPath, 'utf8'));
const kindById = new Map(discoveriesData.discoveries.map((item) => [item.id, item.kind]));

const config = {
  exp_taroko: {
    terrainTags: ['taiwan', 'mountain', 'forest', 'coast'],
    extraRare: ['sp_formosan_salmon'],
    events: [['aid_indigenous', 1.2], ['fresh_spring', 1], ['lost', 0.8], ['storm_landslide', 0.5], ['wildlife', 1], ['ancient_marks', 0.5]],
  },
  exp_yushan: {
    terrainTags: ['taiwan', 'mountain', 'forest'],
    extraRare: [],
    events: [['fresh_spring', 0.7], ['lost', 1.1], ['storm_landslide', 1], ['wildlife', 0.8], ['ancient_marks', 0.7]],
  },
  exp_alishan: {
    terrainTags: ['taiwan', 'mountain', 'forest'],
    extraRare: ['sp_lanyu_scops_owl'],
    events: [['aid_indigenous', 1.1], ['fresh_spring', 0.8], ['forest_food', 0.9], ['lost', 0.8], ['snake_hazard', 0.6], ['wildlife', 1.2], ['rare_specimen', 0.25]],
  },
  exp_siraya: {
    terrainTags: ['taiwan', 'settlement', 'grassland', 'coast'],
    extraRare: ['view_taiwan_west_lagoons'],
    events: [['aid_indigenous', 1.4], ['aid_local', 1], ['forest_food', 0.6], ['snake_hazard', 0.3], ['wildlife', 0.8]],
  },
  exp_quanzhou_temple: {
    terrainTags: ['settlement', 'road', 'coast'],
    extraRare: [],
    events: [['aid_local', 1.4], ['ancient_marks', 0.7]],
  },
  exp_forbidden_city: {
    terrainTags: ['settlement', 'road', 'ruins'],
    extraRare: [],
    events: [['aid_local', 0.8], ['lost', 0.8], ['ancient_marks', 1.2]],
  },
  exp_seoul: {
    terrainTags: ['settlement', 'road', 'forest'],
    extraRare: ['sp_korean_tiger'],
    events: [['aid_local', 1.3], ['fresh_spring', 0.6], ['forest_food', 0.5], ['lost', 0.5], ['wildlife', 0.9], ['ancient_marks', 0.7]],
  },
  exp_ryukyu_shuri: {
    terrainTags: ['settlement', 'island', 'coast', 'forest'],
    extraRare: ['sp_sea_turtle'],
    events: [['aid_local', 1.3], ['fresh_spring', 0.7], ['forest_food', 0.7], ['wildlife', 0.8], ['wreck_relic', 0.3]],
  },
  exp_unzen: {
    terrainTags: ['mountain', 'forest', 'volcanic', 'coast'],
    extraRare: ['view_nagasaki_dejima'],
    events: [['fresh_spring', 1], ['lost', 0.9], ['storm_landslide', 0.7], ['snake_hazard', 0.5], ['wildlife', 1], ['ancient_marks', 0.5]],
  },
  exp_sakai_route: {
    terrainTags: ['settlement', 'road', 'coast'],
    extraRare: [],
    events: [['aid_local', 1.5], ['lost', 0.4], ['ancient_marks', 0.7]],
  },
  exp_java_volcano: {
    terrainTags: ['mountain', 'volcanic', 'tropical', 'forest'],
    extraRare: [],
    events: [['fresh_spring', 0.7], ['forest_food', 0.9], ['lost', 0.8], ['storm_landslide', 0.8], ['snake_hazard', 0.8], ['wildlife', 1.1], ['rare_specimen', 0.25]],
  },
  exp_moluccas_forest: {
    terrainTags: ['island', 'coast', 'tropical', 'forest'],
    extraRare: [],
    events: [['fresh_spring', 0.7], ['forest_food', 1], ['lost', 0.9], ['snake_hazard', 0.8], ['wildlife', 1.2], ['wreck_relic', 0.3], ['rare_specimen', 0.4]],
  },
};

for (const point of pointsData.points) {
  const cfg = config[point.id];
  if (!cfg) throw new Error(`Missing v22 config for ${point.id}`);
  const treasures = point.discoveries.filter((id) => kindById.get(id) === 'treasure');
  const main = point.discoveries.filter((id) => kindById.get(id) !== 'treasure');
  point.terrainTags = cfg.terrainTags;
  point.mainDiscoveries = main.map((id, index) => ({ id, weight: Math.max(0.7, 1 - index * 0.1) }));
  point.rareDiscoveries = [...treasures, ...cfg.extraRare].map((id) => ({ id, weight: 0.04 }));
  point.repeatRewards = [
    { id: 'field_notes', weight: 1, gold: 20 + point.difficulty * 10, adventureRep: 1, text: '隊伍整理出一份實用的調查筆記。' },
    { id: 'local_supplies', weight: 0.8, food: 1 + point.difficulty, water: 1 + point.difficulty, adventureRep: 0, text: '隊伍找到少量可安全使用的補給。' },
  ];
  point.events = cfg.events.map(([id, weight]) => ({ id, weight }));
  delete point.discoveries;
}

fs.writeFileSync(pointsPath, `${JSON.stringify(pointsData, null, 2)}\n`, 'utf8');
console.log(`Migrated ${pointsData.points.length} exploration points to v22 schema.`);
