// Stable per-AA keys, derived from name (not array position), used at the
// state-persistence boundary: localStorage, exported build text, and share
// links. Runtime code everywhere else still addresses AAs by their index into
// AA_DATA — only saving/loading goes through here.
//
// Why this exists: state.ranks and purchaseOrder used to store raw array
// indexes directly. That's fine in memory, but AA_DATA gets regenerated from
// eqlwiki periodically (see wiki-sync/), and a fresh scrape can reorder or
// insert entries. An index saved against yesterday's ordering silently means
// a different ability today — not an error, a wrong-but-plausible build. Name
// keys survive reordering/insertion, and degrade gracefully (an unknown key
// is just dropped) instead of resolving to the wrong AA.
//
// No internal deps: reads the global AA_DATA (from data.js, loaded before
// this runs) plus the frozen LEGACY_AA_ORDER snapshot below, which captures
// AA_DATA's exact ordering as of 2026-07-09 — the last point before any AA
// data was index-addressed. It exists only to translate old index-based
// saves (from before this file existed) into name keys on load, and must
// never be regenerated/updated after the fact, or it stops describing what
// those old saves actually meant.
const LEGACY_AA_ORDER = {
  "general": [
    "Adamant Will", "Alchemy Mastery", "Baking Mastery", "Blacksmithing Mastery",
    "Brewing Mastery", "Circular Breathing", "Combat Agility", "Combat Fury",
    "Combat Stability", "Crafting Mastery", "Fear Resistance", "First Aid",
    "Fletching Mastery", "Foraging", "Gather Party", "Innate Eminence",
    "Innate Lung Capacity", "Innate Metabolism", "Innate Regeneration",
    "Innate Spell Resistance", "Jewel Craft Mastery", "Natural Durability",
    "Origin", "Packrat", "Permanent Illusion", "Pottery Mastery", "Quick Buff",
    "Steadfast Will", "Stoicism", "Tailoring Mastery"
  ],
  "archetype": [
    "Acrobatics", "Ambidexterity", "Burst of Power", "Companion's Discipline",
    "Critical Affliction", "Destructive Cascade", "Destructive Fury",
    "Double Riposte", "Exodus", "Finishing Blow", "Fury of Magic",
    "Healing Adept", "Healing Boon", "Healing Gift", "Improved Bash",
    "Innate Camouflage", "Innate Invis to Undead", "Intimidation",
    "Mass Group Buff", "Master of All", "Mastery of the Past", "Mend Companion",
    "Mental Clarity", "Mnemonic Retention", "Persistent Casting", "Pet Affinity",
    "Physical Enhancement", "Quick Damage", "Rampage", "Spell Casting Deftness",
    "Spell Casting Mastery", "Spell Casting Reinforcement",
    "Spell Casting Subtlety", "Thief's Intuition"
  ],
  "special": ["Banestrike"],
  "classes": {
    "Bard": ["Instrument Mastery", "Jam Fest", "Reaching Notes", "Scribble Notes", "Singing Mastery", "Symphonic Aura"],
    "Beastlord": ["Frenzy of Spirit", "Hobble of Spirits", "Paragon of Spirit", "Playing Possum"],
    "Berserker": ["Blood Rune", "Innate Power Strike", "Tireless Spirit", "Unbound Fury"],
    "Cleric": ["Divine Aura", "Divine Aura", "Bestow Divine Aura", "Purify Soul", "Turn Undead", "Unbound Boon"],
    "Druid": ["Enhanced Root", "Quick Evacuation", "Unbound Nature"],
    "Enchanter": ["Unbound Clarity"],
    "Magician": ["Companion's Fury", "Conjurer's Efficiency", "Elemental Form", "Turn Summoned", "Unbound Companion"],
    "Monk": ["Dragon Force", "Improved Mend", "Purify Body", "Rapid Feign"],
    "Necromancer": ["Dead Mesmerization", "Fear Storm", "Flesh to Bone", "Life Burn", "Unbound Affliction"],
    "Paladin": ["Act of Valor", "Divine Stun", "Holy Steed", "Lay on Hands", "Slay Undead", "Valiant Steed"],
    "Ranger": ["Hunter's Attack Power", "Innate Called Shot", "Unbounded Strikethrough", "Weapon Mastery of the Scout"],
    "Rogue": ["Chaotic Stab", "Escape", "Innate Sneakiness", "Purge Poison", "Shroud of Stealth"],
    "Shadow Knight": ["Unholy Steed", "Abyssal Steed", "Harm Touch", "Leech Touch", "Soul Abrasion"],
    "Shaman": ["Cannibalization", "Unbound Cascade"],
    "Warrior": ["Area Taunt", "Heroic Leap", "Innate Fighters Tenacity", "Unbound Wrath", "War Cry", "Warrior's Endurance"],
    "Wizard": ["Improved Familiar", "Mana Burn", "Quick Evacuation", "Strong Root", "Unbound Destruction"]
  }
};

function slugify(name) {
  return String(name || "")
    .toLowerCase()
    .replace(/'/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Stable key for position `idx` within `names` (a plain array of AA names in
// list order). Duplicate names get -2, -3, ... suffixes based on how many
// same-named entries precede them, so genuine same-name rows (e.g. Cleric's
// two "Divine Aura" entries) still resolve deterministically either way.
function keyForNameIdx(names, idx) {
  const name = names[idx];
  if (name == null) return null;
  const base = slugify(name);
  let dup = 0;
  for (let i = 0; i < idx; i++) {
    if (slugify(names[i]) === base) dup++;
  }
  return dup === 0 ? base : `${base}-${dup + 1}`;
}

function idxForNameKey(names, key) {
  for (let i = 0; i < names.length; i++) {
    if (keyForNameIdx(names, i) === key) return i;
  }
  return -1;
}

function currentList(scope, className) {
  return scope === "class" ? (AA_DATA.classes[className] || []) : (AA_DATA[scope] || []);
}

function currentNames(scope, className) {
  return currentList(scope, className).map((aa) => aa.name);
}

// The actual AA object at idx in today's AA_DATA, or null. Used to validate
// deserialized rank values against the AA's real max rank instead of trusting
// whatever number was in a save file.
export function aaAt(scope, className, idx) {
  return currentList(scope, className)[idx] || null;
}

function legacyNames(scope, className) {
  return scope === "class" ? (LEGACY_AA_ORDER.classes[className] || []) : (LEGACY_AA_ORDER[scope] || []);
}

// idx into today's AA_DATA -> stable name key, for writing new saves.
export function keyForIdx(scope, className, idx) {
  return keyForNameIdx(currentNames(scope, className), idx);
}

// Stable name key -> idx into today's AA_DATA, for reading saves already in
// key form. -1 if that AA no longer exists under this scope/class.
export function idxForKey(scope, className, key) {
  return idxForNameKey(currentNames(scope, className), key);
}

// idx captured against the frozen pre-key ordering -> idx into today's
// AA_DATA, for migrating old index-based saves. -1 if that AA was renamed
// or removed since the snapshot was taken. Routed through the same
// duplicate-aware key both directions use (not a plain name lookup), so
// same-named rows (e.g. Cleric's two "Divine Aura" entries) map to their
// matching occurrence instead of both collapsing onto the first one.
export function currentIdxForLegacyIdx(scope, className, legacyIdx) {
  const names = legacyNames(scope, className);
  if (legacyIdx < 0 || legacyIdx >= names.length) return -1;
  const key = keyForNameIdx(names, legacyIdx);
  if (!key) return -1;
  return idxForNameKey(currentNames(scope, className), key);
}
