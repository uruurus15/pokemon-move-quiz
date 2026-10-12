// PokeAPI から SV(scarlet-violet) の習得わざデータを取得して data.js を生成する
// 使い方: node tools/build-data.mjs  (キャッシュ: tools/.cache)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cacheDir = path.join(root, 'tools', '.cache');
fs.mkdirSync(cacheDir, { recursive: true });
const API = 'https://pokeapi.co/api/v2/';
const VG = 'scarlet-violet';

async function get(url) {
  const key = url.replace(API, '').replace(/[^\w-]+/g, '_');
  const f = path.join(cacheDir, key + '.json');
  if (fs.existsSync(f)) return JSON.parse(fs.readFileSync(f, 'utf8'));
  for (let i = 0; i < 5; i++) {
    try {
      const r = await fetch(url);
      if (!r.ok) throw new Error(r.status);
      const j = await r.json();
      fs.writeFileSync(f, JSON.stringify(j));
      return j;
    } catch (e) { if (i === 4) throw new Error(url + ' ' + e.message); await new Promise(r => setTimeout(r, 800 * (i + 1))); }
  }
}
async function pool(items, n, fn) {
  const out = new Array(items.length); let i = 0;
  await Promise.all(Array.from({ length: n }, async () => {
    while (i < items.length) { const k = i++; out[k] = await fn(items[k], k); }
  }));
  return out;
}
const ja = (names) => (names.find(n => n.language.name === 'ja') || names.find(n => n.language.name === 'ja-Hrkt') || names.find(n => n.language.name === 'en')).name;
const FORM = { attack: 'アタック', defense: 'ディフェンス', speed: 'スピード', heat: 'ヒート', wash: 'ウォッシュ', frost: 'フロスト', fan: 'スピン', mow: 'カット', origin: 'オリジン', sky: 'スカイ', black: 'ブラック', white: 'ホワイト', unbound: '解放', midnight: '真夜中', dusk: '黄昏', 'low-key': 'ロー', 'rapid-strike': '連撃', ice: '白馬', shadow: '黒馬', bloodmoon: 'アカツキ', alola: 'アローラ', galar: 'ガラル', hisui: 'ヒスイ', paldea: 'パルデア', 'paldea-combat-breed': 'パルデア(格闘)', 'paldea-blaze-breed': 'パルデア(炎)', 'paldea-aqua-breed': 'パルデア(水)' };

const list = await get(API + 'pokemon?limit=2000');
console.log('pokemon entries', list.results.length);
const mons = (await pool(list.results, 8, async (r, k) => {
  const p = await get(r.url);
  const moves = [], egg = [];
  for (const m of p.moves) {
    const ds = m.version_group_details.filter(d => d.version_group.name === VG);
    if (ds.length) moves.push(m.move.name);
    if (ds.some(d => d.move_learn_method.name === 'egg')) egg.push(m.move.name);
  }
  if (!moves.length) return null;
  return { id: p.id, name: p.name, species: p.species.url, isDefault: p.is_default, moves, egg };
})).filter(Boolean);
console.log('SV pokemon', mons.length);

const speciesUrls = [...new Set(mons.map(m => m.species))];
const speciesMap = {};
await pool(speciesUrls, 8, async (u) => { speciesMap[u] = await get(u); });

// タマゴわざは進化前の段階で覚えたものを進化後も引き継ぐが、PokeAPI は中間進化形で欠落していることがある(例: カラスバ)。
// 進化元をたどってタマゴわざを補完する(地方フォルムは同じフォルムの進化元を優先)。
const byName = Object.fromEntries(mons.map(m => [m.name, m]));
const spByUrl = speciesMap;
const speciesByName = Object.fromEntries(Object.values(speciesMap).map(sp => [sp.name, sp]));
let patched = 0;
for (const m of mons) {
  const sp = spByUrl[m.species];
  const suffix = m.name.startsWith(sp.name + '-') ? m.name.slice(sp.name.length + 1) : '';
  const add = new Set();
  for (let cur = sp; cur.evolves_from_species; ) {
    const anc = cur.evolves_from_species.name;
    const a = (suffix && byName[anc + '-' + suffix]) || byName[anc];
    if (a) a.egg.forEach(e => add.add(e));
    cur = speciesByName[anc];
    if (!cur) break;
  }
  const have = new Set(m.moves);
  const miss = [...add].filter(e => !have.has(e));
  if (miss.length) { m.moves.push(...miss); patched++; console.log('補完', m.name, miss.join(',')); }
}
console.log('タマゴわざを補完したポケモン', patched);

const moveSlugs = [...new Set(mons.flatMap(m => m.moves))].sort();
const moveInfo = {};
await pool(moveSlugs, 8, async (s) => { moveInfo[s] = await get(API + 'move/' + s); });
const moveIdx = Object.fromEntries(moveSlugs.map((s, i) => [s, i]));

const moveOut = moveSlugs.map(s => {
  const m = moveInfo[s];
  return { n: ja(m.names), t: m.type.name, c: m.damage_class.name };
});

const out = mons.map(m => {
  const sp = speciesMap[m.species];
  let name = ja(sp.names);
  const suffix = m.name.startsWith(sp.name + '-') ? m.name.slice(sp.name.length + 1) : '';
  if (!m.isDefault && suffix) name += `(${FORM[suffix] || suffix})`;
  return {
    id: m.id, dex: sp.id, name,
    fam: Number(sp.evolution_chain.url.split('/').filter(Boolean).pop()),
    mv: m.moves.map(s => moveIdx[s]).sort((a, b) => a - b),
  };
}).sort((a, b) => a.dex - b.dex || a.id - b.id);

// 見た目だけのフォルム(習得わざが基本フォルムと同一)は統合する。地方フォルムは別個体として残す
const REGIONAL = /(アローラ|ガラル|ヒスイ|パルデア)/;
const sig = (p) => p.mv.join(',');
const baseSig = {};
out.forEach((p) => { if (!/\(/.test(p.name)) baseSig[p.dex] = sig(p); });
const NOISE = /(-cap|ash|busted|own-tempo|build|mode|female|white-striped|original|dada|crowned)/;
const dedup = out.filter((p) => !/\(/.test(p.name) || REGIONAL.test(p.name) || (!NOISE.test(p.name) && baseSig[p.dex] !== sig(p)));
out.length = 0; out.push(...dedup);
const smeargle = out.find(p => p.name === 'ドーブル');
if (smeargle) smeargle.all = true;
fs.writeFileSync(path.join(root, 'data.js'),
  'window.POKE_DATA=' + JSON.stringify({ vg: VG, moves: moveOut, pokemon: out }) + ';\n');
console.log('moves', moveOut.length, 'pokemon', out.length, 'smeargle', !!smeargle);
