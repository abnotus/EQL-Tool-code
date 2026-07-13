const CLASS_LIST = [
"Bard", "Beastlord", "Berserker", "Cleric", "Druid", "Enchanter",
"Magician", "Monk", "Necromancer", "Paladin", "Ranger", "Rogue",
"Shadow Knight", "Shaman", "Warrior", "Wizard"
];
const AA_DATA = {
general: [
{ name: "Adamant Will", ranks: 4, costs: ["2","4","6","?"], levelReq: "1", description: "Grants you an additional 20/40/?/?% chance to resist charm, and 15/30/?/?% chance to resist mesmerization spells." },
{ name: "Alchemy Mastery", ranks: 3, costs: ["3","?","?"], levelReq: "1", description: "Reduces the chance of failing Alchemy recipes by 10/?/?%." },
{ name: "Baking Mastery", ranks: 3, costs: ["2","?","?"], levelReq: "1", description: "Reduces the chance of failing Baking recipes by 10/?/?%." },
{ name: "Blacksmithing Mastery", ranks: 3, costs: ["2","?","?"], levelReq: "1", description: "Reduces the chance of failing Blacksmithing recipes by 10/?/?%." },
{ name: "Brewing Mastery", ranks: 3, costs: ["2","?","?"], levelReq: "1", description: "Reduces the chance of failing Brewing recipes by 10/?/?%." },
{ name: "Circular Breathing", ranks: 4, costs: ["2","3","4","5"], levelReq: "1", description: "Increases your endurance regeneration by 1/2/3/4 point(s)." },
{ name: "Combat Agility", ranks: 3, costs: ["2","4","6"], levelReq: "1", description: "Increases your melee avoidance by 2%/5%/10%." },
{ name: "Combat Fury", ranks: 4, costs: ["1","?","4","6"], levelReq: "1", description: "Increases your chance of performing a critical melee hit with all skills by 1/?/5/10%." },
{ name: "Combat Stability", ranks: 3, costs: ["2","?","?"], levelReq: "1", description: "Increases the armor class soft cap of your class by 2/5/?%." },
{ name: "Crafting Mastery", ranks: 6, costs: ["3","?","?","?","?","?"], levelReq: "1", description: "Allows raising 1-6 additional tradeskills from a 200 to 300 cap." },
{ name: "Fear Resistance", ranks: 4, costs: ["2","4","6","9"], levelReq: "1", description: "Grants you an additional 25/50/75/100% chance to resist most fear spells." },
{ name: "First Aid", ranks: 6, costs: ["1","?","?","?","?","?"], levelReq: "1", description: "Increases the maximum health you can bind wound to 80/90/100/100/100/100%, and increases bandage healing by 0/0/0/10/25/50%." },
{ name: "Fletching Mastery", ranks: 3, costs: ["2","?","?"], levelReq: "1", description: "Reduces the chance of failing Fletching recipes by 10/?/?%." },
{ name: "Foraging", ranks: 1, costs: ["3"], levelReq: "1", description: "Increases your Forage skill cap by 50 points." },
{ name: "Gather Party", ranks: 1, costs: ["0"], levelReq: "1", auto: true, description: "Gives everyone in your party the option of teleporting directly to your location. Automatically granted to every character — per the wiki's own General AA intro text." },
{ name: "Innate Eminence", ranks: 5, costs: ["3","3","3","?","?"], levelReq: "1", description: "Increases your strength, stamina, agility, dexterity, wisdom, intelligence, and charisma by 2/4/6/?/? points." },
{ name: "Innate Lung Capacity", ranks: 3, costs: ["1","1","1"], levelReq: "1", description: "Increases the amount of air you can hold in your lungs by 10/?/?%." },
{ name: "Innate Metabolism", ranks: 3, costs: ["1","?","?"], levelReq: "1", description: "Reduces your food and drink consumption by 110/125/?%." },
{ name: "Innate Regeneration", ranks: 7, costs: ["1","1","1","2","3","?","?"], levelReq: "1", description: "Increases your health regeneration by 1/2/3/4/5/?/? point(s)." },
{ name: "Innate Spell Resistance", ranks: 5, costs: ["2","?","?","?","?"], levelReq: "1", description: "Improves your cold, disease, fire, magic, and poison resistances by 2/?/?/?/? points." },
{ name: "Jewel Craft Mastery", ranks: 3, costs: ["2","?","?"], levelReq: "1", description: "Reduces the chance of failing Jewelcrafting recipes by 10/?/?%." },
{ name: "Natural Durability", ranks: 4, costs: ["2","4","6","2"], levelReq: "1", description: "Increases your maximum base health (derived from your stamina) by 2/5/10/12%." },
{ name: "Origin", ranks: 1, costs: ["0"], levelReq: "1", auto: true, description: "Transports you back to your starting city. Check location with /charinfo. Automatically granted to every character — per the wiki's own General AA intro text." },
{ name: "Packrat", ranks: 10, costs: ["1","?","?","?","?","?","?","?","?","?"], levelReq: "1", description: "Reduces the weight of all equipped and carried items by 5/?/?/?/?/?/?/?/?/?%." },
{ name: "Permanent Illusion", ranks: 1, costs: ["5"], levelReq: "1", description: "Extends the duration of your beneficial illusion spells to 16.6 hours and allows persistence when zoning." },
{ name: "Pottery Mastery", ranks: 3, costs: ["2","?","?"], levelReq: "1", description: "Reduces the chance of failing Pottery recipes by 10/?/?%." },
{ name: "Quick Buff", ranks: 1, costs: ["5"], levelReq: "1", description: "Cast all currently memorized beneficial spells on all valid group and raid targets in range." },
{ name: "Steadfast Will", ranks: 8, costs: ["2","2","3","3","3","3","6","12"], levelReq: "1", description: "Grants you a 15/30/50/60/70/80/90/100% chance to endure stunning melee attacks without being stunned." },
{ name: "Stoicism", ranks: 5, costs: ["2","?","?","?","?"], levelReq: "1", description: "Reduces how far incoming melee attacks push you backward by 10%." },
{ name: "Tailoring Mastery", ranks: 3, costs: ["2","?","?"], levelReq: "1", description: "Reduces the chance of failing Tailoring recipes by 10/?/?%." }
],
archetype: [
{ name: "Acrobatics", ranks: 3, costs: ["3","6","9"], levelReq: "1", description: "Reduces fall damage by increasing safe fall effectiveness by 10/20/30%." },
{ name: "Ambidexterity", ranks: 1, costs: ["9"], levelReq: "1", description: "Increases dual wield success chance by 32%." },
{ name: "Burst of Power", ranks: 3, costs: ["3","6","?"], levelReq: "46", description: "Increases flurry chance by 7/11/?%." },
{ name: "Companion's Discipline", ranks: 1, costs: ["2"], levelReq: "1", description: "Enables advanced pet commands (hold, greater hold, attack)." },
{ name: "Critical Affliction", ranks: 3, costs: ["3","6","9"], levelReq: "1", description: "Increases DoT critical damage chance by 3/6/9%." },
{ name: "Destructive Cascade", ranks: 3, costs: ["2","4","6"], levelReq: "1", prereq: "Requires Critical Affliction rank 1/2/3", description: "Increases critical DoT damage by 125/150/175%." },
{ name: "Destructive Fury", ranks: 3, costs: ["2","4","6"], levelReq: "1", prereq: "Requires Fury of Magic rank 1", description: "Increases critical direct damage spell damage by 30/60/100%." },
{ name: "Double Riposte", ranks: 3, costs: ["3","6","9"], levelReq: "15", description: "Grants 5%/10%/15% double riposte chance." },
{ name: "Exodus", ranks: 1, costs: ["6"], levelReq: "10", description: "Teleports group members within 100 feet to a safe zone location." },
{ name: "Finishing Blow", ranks: 3, costs: ["2","4","6"], levelReq: "1", description: "Critical melee attacks deal 100/200/300% damage to level 50/53/55 or lower NPCs at 10/12/15% or less health." },
{ name: "Fury of Magic", ranks: 4, costs: ["1","2","3","4"], levelReq: "1", description: "Increases critical hit chance with direct damage spells by 2% per rank." },
{ name: "Healing Adept", ranks: 3, costs: ["2","2","2"], levelReq: "1", description: "Increases instant-duration healing spell effectiveness by 2% per rank." },
{ name: "Healing Boon", ranks: 3, costs: ["3","6","9"], levelReq: "1", description: "Increases HoT exceptional heal chance by 3/6/9%." },
{ name: "Healing Gift", ranks: 3, costs: ["2","4","6"], levelReq: "1", description: "Grants instant healing spells 3%/6%/10% exceptional heal chance." },
{ name: "Improved Bash", ranks: 1, costs: ["6"], levelReq: "1", description: "Allows bash usage while wielding two-handed weapons." },
{ name: "Innate Camouflage", ranks: 1, costs: ["5"], levelReq: "40", description: "Grants standard invisibility for up to 20 minutes." },
{ name: "Innate Invis to Undead", ranks: 1, costs: ["3"], levelReq: "40", description: "Renders you invisible to undead for up to 27 minutes." },
{ name: "Intimidation", ranks: 1, costs: ["0"], levelReq: "1", auto: true, description: "Successful intimidate triggers a fear effect on level 70 or lower targets for 18 seconds." },
{ name: "Mass Group Buff", ranks: 1, costs: ["9"], levelReq: "50", description: "Doubles the mana cost of your next spell, causing it to land on all allies within radius." },
{ name: "Master of All", ranks: 4, costs: ["5","5","5","5"], levelReq: "20", description: "Allows a second specialization." },
{ name: "Mastery of the Past", ranks: 3, costs: ["2","4","6"], levelReq: "1", description: "Makes fizzling impossible for level 20/40/52 or lower spells." },
{ name: "Mend Companion", ranks: 1, costs: ["5"], levelReq: "39", description: "Instantly heals your pet for 5000 health." },
{ name: "Mental Clarity", ranks: 4, costs: ["2","3","4","5"], levelReq: "1", description: "Increases mana regeneration by 1 point per rank." },
{ name: "Mnemonic Retention", ranks: 6, costs: ["1","1","2","2","3","3"], levelReq: "1", description: "Allows memorizing 1/2/3/4/5/6 additional spells." },
{ name: "Persistent Casting", ranks: 6, costs: ["1","2","3","4","5","6"], levelReq: "1", description: "Grants an 11% chance (per rank) to complete a spell cast when stunned." },
{ name: "Pet Affinity", ranks: 1, costs: ["2"], levelReq: "1", description: "Allows pets to benefit from group beneficial spells/songs." },
{ name: "Physical Enhancement", ranks: 1, costs: ["3"], levelReq: "1", description: "Increases melee avoidance by 2% and armor class soft cap by 2%." },
{ name: "Quick Damage", ranks: 3, costs: ["3","6","9"], levelReq: "1", description: "Reduces the base cast time of 3+ second direct damage spells by 2/5/10%." },
{ name: "Rampage", ranks: 1, costs: ["5"], levelReq: "30", description: "Performs a single primary combat round on all creatures within 40 feet." },
{ name: "Spell Casting Deftness", ranks: 3, costs: ["2","2","2"], levelReq: "1", description: "Reduces beneficial spell cast time (3+ seconds) by 10% per rank." },
{ name: "Spell Casting Mastery", ranks: 3, costs: ["2","4","6"], levelReq: "1", description: "Reduces all spell mana cost by 2/5/10%." },
{ name: "Spell Casting Reinforcement", ranks: 4, costs: ["2","4","4","6"], levelReq: "1", description: "Increases beneficial spell duration by 5/15/30/50%." },
{ name: "Spell Casting Subtlety", ranks: 6, costs: ["2","?","?","?","?","?"], levelReq: "1", description: "Reduces hate generated by attacks/spells by 5/?/?/?/?/?%." },
{ name: "Thief's Intuition", ranks: 4, costs: ["3","3","3","3"], levelReq: "1", description: "Reduces Sense Traps and Disarm Traps reuse time by 1 second per rank." }
],
special: [
{ name: "Banestrike", ranks: 4, costs: ["0","0","0","0"], levelReq: "1", description: "Improves the base damage of your melee attacks and the power of your damaging and healing abilities by 2/4/?/?%. Complete Slayer achievements to progress this ability." }
],
classes: {
"Bard": [
{ name: "Instrument Mastery", ranks: 3, costs: ["3","6","9"], levelReq: "1", description: "Further improves the instrument bonus of your songs by 20/40/60%. Impacts Brass, Percussion, String and Woodwind songs." },
{ name: "Jam Fest", ranks: 3, costs: ["3","6","9"], levelReq: "1", description: "Increases the effective casting level of your songs by 1/?/? level. Improves songs that scale with level, song stacking priority, and the likelihood that dispel/cure blindness/sense-disarm-pick-trap songs succeed." },
{ name: "Reaching Notes", ranks: 6, costs: ["2","4","6","?","?","?"], levelReq: "1", description: "Extends the radius of your beneficial area songs by 10% per rank. Enabled/expendable ability." },
{ name: "Scribble Notes", ranks: 1, costs: ["3"], levelReq: "1", description: "Reduces the amount of time it takes you to memorize a song by 50%." },
{ name: "Singing Mastery", ranks: 3, costs: ["3","6","9"], levelReq: "1", description: "Further improves the singing bonus of your songs by 20/40/60%. Impacts songs that use the Singing skill." },
{ name: "Symphonic Aura", ranks: 10, costs: ["0","0","3","0","3","0","3","0","3","0"], levelReq: "1", autoRanks: 1, description: "Enables eligible Bard songs to auto-pulse. A song is eligible if it has no mana cost, no cooldown, and is a non-targeted area of effect song; eligible songs cannot be played manually while the ability is on, and are chosen from your final spell gem working backwards. Rank 1 is auto-granted. Each additional song takes two ranks: the odd rank costs 3 and grants the slot, the following even rank enables it for free. Total 5 songs at max rank, 12 points." }
],
"Beastlord": [
{ name: "Frenzy of Spirit", ranks: 1, costs: ["4"], levelReq: "45", description: "Activated: increases your melee speed by 99% and attack power by 250 points for 0:00:48. (Refresh 0:12:00)" },
{ name: "Hobble of Spirits", ranks: 1, costs: ["5"], levelReq: "30", description: "Activated: grants your pet's melee attacks a chance (150% bonus) to trigger a snare that reduces its target's movement speed by 40% for 24 seconds. Permanent duration, 3 second cast time." },
{ name: "Paragon of Spirit", ranks: 1, costs: ["6"], levelReq: "1", description: "Activated: shares your natural attunement with all group members within 200 feet, increasing health regeneration by 200 points and mana regeneration by 80 points for 0:00:36. (Refresh 0:15:00)" },
{ name: "Playing Possum", ranks: 1, costs: ["6"], levelReq: "46", description: "Activated: allows you to instantly Feign Death with an 80% chance of success. (Refresh 0:00:30)" }
],
"Berserker": [
{ name: "Blood Rune", ranks: 3, costs: ["1","2","?"], levelReq: "1", description: "Melee and ability critical hits give you 5% of the damage done as an absorption shield, up to 5% of your max hitpoints." },
{ name: "Innate Power Strike", ranks: 1, costs: ["0"], levelReq: "1", auto: true, description: "Grants the Berserker an increased chance to critically strike." },
{ name: "Tireless Spirit", ranks: 1, costs: ["3"], levelReq: "10", description: "Activated: increases your movement speed by 125% for 18 seconds. (Refresh 0:25:00)" },
{ name: "Unbound Fury", ranks: 3, costs: ["0","0","0"], levelReq: "12", auto: true, description: "Increases your chance to land a critical hit with your melee attacks and abilities by 2% per rank." }
],
"Cleric": [
{ name: "Divine Aura", ranks: 1, costs: ["0"], levelReq: "1", auto: true, description: "Grants the Cleric a 5% bonus to most direct healing spells." },
{ name: "Divine Aura", ranks: 1, costs: ["6"], levelReq: "50", description: "Activated: instantly renders you invulnerable to most attacks but also unable to attack, and heals 5000 health every 6 seconds for 0:00:18. (Refresh 0:10:00)" },
{ name: "Bestow Divine Aura", ranks: 1, costs: ["3"], levelReq: "50", prereq: "Requires Divine Aura at level 1", description: "Activated: instantly renders your target invulnerable to most attacks but also unable to attack, and heals 5000 health every 6 seconds for 0:00:18. (Refresh 0:10:00)" },
{ name: "Purify Soul", ranks: 1, costs: ["5"], levelReq: "15", prereq: "Requires Healing Gift level 3", description: "Activated: cures a target up to 100 feet away of 72 poison, disease, and curse counters and has a 95% chance to remove up to 6 detrimental effects. (Refresh 0:30:00)" },
{ name: "Turn Undead", ranks: 1, costs: ["3"], levelReq: "40", description: "Activated: infuses your undead target with holy energy, dealing 200 damage every 6 seconds for 0:00:24, with a 10% chance to trigger a critical 1000 damage effect. (Refresh 0:02:00)" },
{ name: "Unbound Boon", ranks: 3, costs: ["0","0","0"], levelReq: "12", auto: true, description: "Grants your healing spells a 2% chance per rank to score an exceptional heal, doubling the healing value of the spell." }
],
"Druid": [
{ name: "Enhanced Root", ranks: 1, costs: ["5"], levelReq: "1", description: "Reduces the chance that an NPC target entangled by your root spells will break free when struck by a non-melee attack by 50%." },
{ name: "Quick Evacuation", ranks: 3, costs: ["3","?","?"], levelReq: "1", description: "Reduces the cast time of your evacuation and succor spells and abilities by 10%/?/?." },
{ name: "Unbound Nature", ranks: 3, costs: ["0","0","0"], levelReq: "12", auto: true, description: "Increases the chance that you will land a critical hit with a spell by 2/3/?%." }
],
"Enchanter": [
{ name: "Unbound Clarity", ranks: 3, costs: ["0","0","0"], levelReq: "12", auto: true, description: "Increases your mana regeneration by 2 points per rank." }
],
"Magician": [
{ name: "Companion's Fury", ranks: 1, costs: ["6"], levelReq: "15", description: "Activated: increases your pet's combat prowess for 0:01:06 — armor class +75, overhaste +15%, strength +20, attack power +200, flurry chance on double attack +5%, accuracy +10%. (Refresh 0:01:30)" },
{ name: "Conjurer's Efficiency", ranks: 5, costs: ["3","?","?","?","?"], levelReq: "1", description: "Prevents components used in the summoning of pets from being expended." },
{ name: "Elemental Form", ranks: 1, costs: ["3"], levelReq: "40", description: "Activated: transforms you into an Air, Earth, Fire, or Water Elemental. Increases the max your stats can be raised to by 5 points, increases spell casting level by 1, and grants a 10 point damage shield." },
{ name: "Turn Summoned", ranks: 3, costs: ["3","?","?"], levelReq: "45", description: "Activated: deals 400 damage to your elemental target, with a 5% chance to trigger a critical 32000 damage effect. (Refresh 0:05:00)" },
{ name: "Unbound Companion", ranks: 1, costs: ["0"], levelReq: "12", auto: true, description: "Increases the chance that your pet will land a critical hit by 2%." }
],
"Monk": [
{ name: "Dragon Force", ranks: 1, costs: ["5"], levelReq: "15", description: "Activated: pushes your target backwards and deals 10 damage." },
{ name: "Improved Mend", ranks: 3, costs: ["3","?","?"], levelReq: "1", prereq: "Requires First Aid at level 3", description: "Gives you a 10% chance to perform a superior mend, doubling the healing of your mend skill." },
{ name: "Purify Body", ranks: 1, costs: ["9"], levelReq: "15", description: "Activated: instantly cures you of up to 20 detrimental effects (excluding charm, fear, resurrection, and revival sickness). (Refresh 0:30:00)" },
{ name: "Rapid Feign", ranks: 3, costs: ["3","6","?"], levelReq: "17", description: "Reduces the reuse time of your Feign Death skill by 1 second at rank 1, and by 3 more seconds at rank 2." }
],
"Necromancer": [
{ name: "Dead Mesmerization", ranks: 1, costs: ["3"], levelReq: "40", description: "Activated: mesmerizes up to 12 level 59 or lower undead creatures within a 35 foot radius of your target for 0:00:36. (Refresh 0:15:00)" },
{ name: "Fear Storm", ranks: 1, costs: ["5"], levelReq: "45", description: "Activated: strikes fear into up to 4 level 52 or lower creatures within a 35 foot radius of your target, causing them to run away for 0:00:36. (Refresh 1:12:00)" },
{ name: "Flesh to Bone", ranks: 1, costs: ["3"], levelReq: "10", description: "Activated: converts a meat or body part item you are holding into bone chips." },
{ name: "Life Burn", ranks: 1, costs: ["9"], levelReq: "45", description: "Activated: consumes 75% of your current health and deals 100% of that health as direct damage, then deals 250 damage every 6 seconds for 0:00:36 while healing you 250 every 6 seconds for 0:00:36. (Refresh 2:24:00)" },
{ name: "Unbound Affliction", ranks: 3, costs: ["0","0","0"], levelReq: "12", auto: true, description: "Increases the chance your damage-over-time spells deal critical damage at each tick by 2/4/6%." }
],
"Paladin": [
{ name: "Act of Valor", ranks: 1, costs: ["3"], levelReq: "20", description: "Activated: allows you to sacrifice yourself in order to transfer all of your remaining health to your target. (Refresh 1:12:00)" },
{ name: "Divine Stun", ranks: 1, costs: ["9"], levelReq: "35", description: "Activated: instantly pushes your target backwards and attempts to stun a level 70 or lower target for 2 seconds. (Refresh 0:00:30)" },
{ name: "Holy Steed", ranks: 1, costs: ["5"], levelReq: "20", description: "Activated: summons the bridle of a very fast Holy Steed (75 Velocity)." },
{ name: "Lay on Hands", ranks: 10, costs: ["0","0","0","0","0","0","0","0","0","0"], levelReq: "6", auto: true, description: "Activated: instantly heals a friendly target (or an unfriendly target's target) for 6251 health, scaling by level. (Refresh 0:15:00)" },
{ name: "Slay Undead", ranks: 3, costs: ["3","?","?"], levelReq: "1", description: "Grants your melee attacks a 2.25% chance to deal 445% damage against undead and vampiric targets." },
{ name: "Valiant Steed", ranks: 1, costs: ["9"], levelReq: "50", prereq: "Requires Holy Steed at level 1", description: "Activated: summons the bridle of a very fast Valiant Unicorn." }
],
"Ranger": [
{ name: "Hunter's Attack Power", ranks: 26, costs: Array(26).fill("0"), levelReq: "8", auto: true, description: "Increases your attack power by 4 points per rank." },
{ name: "Innate Called Shot", ranks: 1, costs: ["0"], levelReq: "1", auto: true, description: "Grants the Ranger the ability to unleash a double bow shot on stationary targets." },
{ name: "Unbounded Strikethrough", ranks: 3, costs: ["0","0","0"], levelReq: "12", auto: true, description: "Increases the chance you will strike through your opponent's active defenses (dodge, block, parry, riposte) by 10/20/30%." },
{ name: "Weapon Mastery of the Scout", ranks: 3, costs: ["3","3","3"], levelReq: "1", description: "Increases the base damage of your archery attacks by 30/60/90%." }
],
"Rogue": [
{ name: "Chaotic Stab", ranks: 1, costs: ["0"], levelReq: "1", auto: true, description: "Allows your backstab attacks to deal minimal backstab damage if you are not behind your target." },
{ name: "Escape", ranks: 1, costs: ["9"], levelReq: "10", description: "Activated: escape combat from NPCs 20 or fewer levels higher than you, become the last possible rampage target, and trigger permanent invisibility. Consumes 2% of your endurance." },
{ name: "Innate Sneakiness", ranks: 1, costs: ["0"], levelReq: "1", auto: true, description: "Grants the Rogue the ability to move while using Hide, provided sneak is also active, allowing movement unseen by most creatures." },
{ name: "Purge Poison", ranks: 1, costs: ["5"], levelReq: "15", description: "Activated: cures you of 1200 poison counters." },
{ name: "Shroud of Stealth", ranks: 1, costs: ["5"], levelReq: "35", description: "Provides a previously unheard-of level of stealth, increasing the invisibility offered by your Hide skill to tier 2, shadowing you from creatures that normally see through standard invisibility." }
],
"Shadow Knight": [
{ name: "Unholy Steed", ranks: 1, costs: ["5"], levelReq: "20", description: "Activated: summons the bridle of a very fast Unholy Steed." },
{ name: "Abyssal Steed", ranks: 1, costs: ["9"], levelReq: "50", prereq: "Requires Unholy Steed at level 1", description: "Activated: summons the bridle of a very fast Abyssal Nightmare." },
{ name: "Harm Touch", ranks: 10, costs: Array(10).fill("0"), levelReq: "6", auto: true, description: "Activated: grips a non-player target with agony, instantly dealing up to 751 damage based on your current level." },
{ name: "Leech Touch", ranks: 1, costs: ["6"], levelReq: "40", description: "Activated: instantly drains 900 health from your target." },
{ name: "Soul Abrasion", ranks: 3, costs: ["3","6","?"], levelReq: "15", description: "Increases the base damage of lifetaps triggered by Vampiric Embrace and Scream of Death by 50/100/200%." }
],
"Shaman": [
{ name: "Cannibalization", ranks: 1, costs: ["5"], levelReq: "40", prereq: "Requires Mental Clarity at level 3", description: "Activated: consumes 1924 health to restore 1066 mana. (Refresh 0:03:00)" },
{ name: "Unbound Cascade", ranks: 3, costs: ["0","0","0"], levelReq: "12", auto: true, description: "Increases the damage dealt by your critical damage-over-time spells by 10/20/30%." }
],
"Warrior": [
{ name: "Area Taunt", ranks: 1, costs: ["5"], levelReq: "25", description: "Activated: taunts all creatures within a 40 foot radius, placing you 100 points of hate higher than their previously most hated target. (Refresh 0:05:00)" },
{ name: "Heroic Leap", ranks: 1, costs: ["0"], levelReq: "12", auto: true, description: "Activated: leap approximately 10 feet in front of your target, attracting the attention of up to 8 opponents within 40 feet, increasing their hatred for you by 1250 points. (Refresh 0:00:30)" },
{ name: "Innate Fighters Tenacity", ranks: 1, costs: ["0"], levelReq: "1", auto: true, description: "Grants the Warrior the ability to go into a frenzy at low health, increasing critical strike chance, and permanently mitigate 5% of all incoming melee damage. Below 35% health, the warrior goes into a berserker frenzy, gaining increased chance to hit and turning critical attacks into crippling blows that deal increased damage and can stun the target. The warrior remains in this state until their health reaches 45%." },
{ name: "Unbound Wrath", ranks: 3, costs: ["0","0","0"], levelReq: "12", auto: true, description: "Increases your melee critical hit damage by 10/20/30%." },
{ name: "War Cry", ranks: 1, costs: ["3"], levelReq: "25", prereq: "Requires Fear Resistance at level 3", description: "Activated: grants all group members within 100 feet immunity to fear spells for 10 seconds. (Refresh 0:36:00)" },
{ name: "Warrior's Endurance", ranks: 1, costs: ["6"], levelReq: "30", description: "Increases your hit point regeneration by 1% per 6 seconds." }
],
"Wizard": [
{ name: "Improved Familiar", ranks: 1, costs: ["6"], levelReq: "45", description: "Activated: summons your familiar, increasing critical direct damage spell damage by 3%, spell casting level by 9, your cold, disease, fire, magic, and poison resistances by 25 points each, mana regeneration by 6 points, max mana by 200 points, and grants see invisible." },
{ name: "Mana Burn", ranks: 1, costs: ["5"], levelReq: "45", prereq: "Requires Mental Clarity at level 3", description: "Activated: consumes up to 3000 mana to deal 4x the consumed mana as direct damage; prevents additional Mana Burn spells from landing on that target for 0:01:00." },
{ name: "Quick Evacuation", ranks: 3, costs: ["3","?","?"], levelReq: "1", description: "Reduces the cast time of your evacuation and succor spells and abilities by 10/?/?%." },
{ name: "Strong Root", ranks: 1, costs: ["5"], levelReq: "35", description: "Activated: roots your target in place for up to 48 seconds with a 300 point resist modifier and a 2 second cast time." },
{ name: "Unbound Destruction", ranks: 3, costs: ["0","0","0"], levelReq: "12", auto: true, description: "Increases your chance to land a critical hit with your direct damage spells by 2/4/6%." }
]
}
};
