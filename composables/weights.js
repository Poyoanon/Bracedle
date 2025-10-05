//// Helpers ///////////////////////////////////////////////////////////////

const near = (x, y, tol = 0.05) => Math.abs(x - y) <= tol;

// parse numbers from text (robust to commas)
const extractPercents = (text) =>
  Array.from(text.matchAll(/([+-]?\d+(?:\.\d+)?)%/g)).map(m => parseFloat(m[1]));

const extractPlusNumbers = (text) =>
  Array.from(text.matchAll(/\+(\d{1,3}(?:,\d{3})*|\d+)/g)).map(m => parseInt(m[1].replace(/,/g, ''), 10));

//// DPS ranking → points /////////////////////////////////////////////////

const DPS_POINTS = {
  ADD_DEMON_3_5: 100,
  CD_PAIR_10_0: 97,
  CR_PAIR_5_0: 94,
  ADD_DEMON_3_0: 91,
  CD_PAIR_8_4: 88,
  CR_PAIR_3_4: 88,
  ADD_DEMON_2_5: 85,
  WP_HP50_7200_2000: 82,
  SKILL_CD_OUT_5_5: 79,
  CD_PAIR_6_8: 76,
  WP_HP50_8100_2200: 73,
  SKILL_CD_OUT_5_0: 70,
  WP_STACK_8700: 67,
  CD_SINGLE_10_0: 64,
  CR_SINGLE_5_0: 61,
  WP_FLAT_9000: 58,
  WP_STACK_7800: 55,
  BACK_3_5: 54,
  FRONT_3_5: 54,
  NONDIR_3_5: 54,
  SKILL_CD_OUT_4_5: 51,
  OUT_STAG_3_5: 48,
  OUT_SOLO_3_0: 48,
  WP_FLAT_8100: 45,
  CR_SINGLE_4_2: 42,
  ADD_SINGLE_4_0: 39,
  ONHIT_WP_AMS_1480: 36,
  BACK_3_0: 36,
  FRONT_3_0: 36,
  NONDIR_3_0: 36,
  WP_FLAT_7200: 33,
  ADD_SINGLE_3_5: 30,
  ONHIT_WP_AMS_1320: 27,
  BACK_2_5: 24,
  FRONT_2_5: 24,
  NONDIR_2_5: 24,
  ADD_SINGLE_3_0: 21,
  ONHIT_WP_AMS_1160: 18,
  OUT_STAG_2_4: 15,
  OUT_SOLO_2_0: 12,
  MAIN_16000: 9,
  ATKMS_6: 8,
  ATKMS_5: 7,
  MAIN_13000: 6,
  ATKMS_4: 6,
  MAIN_10000: 3
};

// score functions per DPS id
const dpsScorers = {
  'dps:additional_damage_demon': ({ percents }) => {
    const p = percents?.[0] ?? 0;
    if (near(p, 3.5)) return DPS_POINTS.ADD_DEMON_3_5;
    if (near(p, 3.0)) return DPS_POINTS.ADD_DEMON_3_0;
    if (near(p, 2.5)) return DPS_POINTS.ADD_DEMON_2_5;
    return p * 10;
  },

  'dps:crit_damage_plus_chd': ({ percents }) => {
    const cd = percents?.[0] ?? 0;
    if (near(cd, 10.0)) return DPS_POINTS.CD_PAIR_10_0;
    if (near(cd, 8.4))  return DPS_POINTS.CD_PAIR_8_4;
    if (near(cd, 6.8))  return DPS_POINTS.CD_PAIR_6_8;
    return cd * 7 + 10;
  },

  'dps:crit_rate_plus_chd': ({ percents }) => {
    const cr = percents?.[0] ?? 0;
    if (near(cr, 5.0)) return DPS_POINTS.CR_PAIR_5_0;
    if (near(cr, 3.4)) return DPS_POINTS.CR_PAIR_3_4;
    if (near(cr, 4.2)) return 86;
    return cr * 6 + 8;
  },

  'dps:weapon_power_hp50': ({ amounts }) => {
    const base = amounts?.[0] ?? 0;
    const bonus = amounts?.[1] ?? 0;
    if (base === 7200 && bonus === 2000) return DPS_POINTS.WP_HP50_7200_2000;
    if (base === 8100 && bonus === 2200) return DPS_POINTS.WP_HP50_8100_2200;
    if (base === 9000 && bonus === 2400) return 65;
    return base / 300 + bonus / 120;
  },

  'dps:skill_cooldown_plus_outgoing': ({ percents }) => {
    const pcs = percents || [];
    const out = pcs.length >= 2 ? pcs[1] : pcs[0] || 0;
    if (near(out, 5.5)) return DPS_POINTS.SKILL_CD_OUT_5_5;
    if (near(out, 5.0)) return DPS_POINTS.SKILL_CD_OUT_5_0;
    if (near(out, 4.5)) return DPS_POINTS.SKILL_CD_OUT_4_5;
    return out * 10;
  },

  'dps:weapon_power_stacking': ({ amounts }) => {
    const base = amounts?.[0] ?? 0;
    if (base === 8700) return DPS_POINTS.WP_STACK_8700;
    if (base === 7800) return DPS_POINTS.WP_STACK_7800;
    if (base === 6900) return 47;
    return base / 180;
  },

  'dps:crit_damage': ({ percents }) => {
    const p = percents?.[0] ?? 0;
    if (near(p, 10.0)) return DPS_POINTS.CD_SINGLE_10_0;
    if (near(p, 8.4))  return 50;
    if (near(p, 6.8))  return 40;
    return p * 5;
  },

  'dps:crit_rate': ({ percents }) => {
    const p = percents?.[0] ?? 0;
    if (near(p, 5.0)) return DPS_POINTS.CR_SINGLE_5_0;
    if (near(p, 4.2)) return 42;
    if (near(p, 3.4)) return 30;
    return p * 4.5;
  },

  'dps:outgoing_damage_staggered': ({ percents }) => {
    const base = percents?.[0] ?? 0;
    const stag = percents?.[1] ?? 0;
    if (near(base, 3.0) && near(stag, 5.0)) return DPS_POINTS.OUT_STAG_3_5;
    if (near(base, 2.0) && near(stag, 4.0)) return DPS_POINTS.OUT_STAG_2_4;
    return base * 8 + stag * 4;
  },

  'dps:outgoing_damage': ({ percents }) => {
    const p = percents?.[0] ?? 0;
    if (near(p, 3.0)) return DPS_POINTS.OUT_SOLO_3_0;
    if (near(p, 2.0)) return DPS_POINTS.OUT_SOLO_2_0;
    if (near(p, 2.5)) return 30;
    return p * 9;
  },

  'dps:onhit_wp_ams': ({ amounts }) => {
    const v = amounts?.[0] ?? 0;
    if (v === 1480) return DPS_POINTS.ONHIT_WP_AMS_1480;
    if (v === 1320) return DPS_POINTS.ONHIT_WP_AMS_1320;
    if (v === 1160) return DPS_POINTS.ONHIT_WP_AMS_1160;
    return v / 60;
  },

  'dps:weapon_power_flat': ({ amounts }) => {
    const v = amounts?.[0] ?? 0;
    if (v === 9000) return DPS_POINTS.WP_FLAT_9000;
    if (v === 8100) return DPS_POINTS.WP_FLAT_8100;
    if (v === 7200) return DPS_POINTS.WP_FLAT_7200;
    return v / 160;
  },

  'dps:back_attack':     ({ percents }) => { const p = percents?.[0] ?? 0; if (near(p,3.5)) return DPS_POINTS.BACK_3_5; if (near(p,3.0)) return DPS_POINTS.BACK_3_0; if (near(p,2.5)) return DPS_POINTS.BACK_2_5; return p*7; },
  'dps:frontal_attack':  ({ percents }) => { const p = percents?.[0] ?? 0; if (near(p,3.5)) return DPS_POINTS.FRONT_3_5; if (near(p,3.0)) return DPS_POINTS.FRONT_3_0; if (near(p,2.5)) return DPS_POINTS.FRONT_2_5; return p*7; },
  'dps:non_direction':   ({ percents }) => { const p = percents?.[0] ?? 0; if (near(p,3.5)) return DPS_POINTS.NONDIR_3_5; if (near(p,3.0)) return DPS_POINTS.NONDIR_3_0; if (near(p,2.5)) return DPS_POINTS.NONDIR_2_5; return p*7; },

  'special:atk_move_speed': ({ percents }) => {
    const p = percents?.[0] ?? 0;
    if (near(p, 6)) return DPS_POINTS.ATKMS_6;
    if (near(p, 5)) return DPS_POINTS.ATKMS_5;
    if (near(p, 4)) return DPS_POINTS.ATKMS_4;
    return p;
  },

  'basic:main:Intelligence': ({ amounts }) => {
    const v = amounts?.[0] ?? 0;
    if (v >= 15800) return DPS_POINTS.MAIN_16000;
    if (v >= 12800) return DPS_POINTS.MAIN_13000;
    if (v >= 9600)  return DPS_POINTS.MAIN_10000;
    return 0;
  },
  'basic:main:Strength': ({ amounts }) => dpsScorers['basic:main:Intelligence']({ amounts }),
  'basic:main:Dexterity': ({ amounts }) => dpsScorers['basic:main:Intelligence']({ amounts }),

  'dps:additional_damage': ({ percents }) => {
    const p = percents?.[0] ?? 0;
    if (near(p, 4.0)) return DPS_POINTS.ADD_SINGLE_4_0;
    if (near(p, 3.5)) return DPS_POINTS.ADD_SINGLE_3_5;
    if (near(p, 3.0)) return DPS_POINTS.ADD_SINGLE_3_0;
    return p * 7;
  }
};

//// Support profile ///////////////////////////////////////////////////////

const SUP_POINTS = {
  CD_DEBUFF_LOW:  110,
  CD_DEBUFF_MID:  115,
  CD_DEBUFF_HIGH: 120,

  CR_DEBUFF_LOW:  104,
  CR_DEBUFF_MID:  109,
  CR_DEBUFF_HIGH: 114,

  DEF_DEBUFF_LOW: 100,
  DEF_DEBUFF_MID: 105,
  DEF_DEBUFF_HIGH:110,

  CHEERS_LOW:   96,
  CHEERS_MID:   101,
  CHEERS_HIGH:  106,

  ALLY_DMG_6:   80,
  ALLY_DMG_7_5: 86,
  ALLY_DMG_9:   92,

  ALLY_ATK_4:   60,
  ALLY_ATK_5:   66,
  ALLY_ATK_6:   72,

  WP_ANY_SMALL:  25,
  MAIN_SMALL:    12
};

const supportScorers = {
  // Debuff: Crit Damage 
  'support:debuff_crit_damage': ({ percents }) => {
    const mag = Math.abs(percents?.[0] ?? 0); 
    if (near(mag, 4.8)) return SUP_POINTS.CD_DEBUFF_HIGH;
    if (near(mag, 4.2)) return SUP_POINTS.CD_DEBUFF_MID;
    if (near(mag, 3.6)) return SUP_POINTS.CD_DEBUFF_LOW;
    return mag * 20;
  },
  // Debuff: Crit Resistance 
  'support:debuff_crit_resist': ({ percents }) => {
    const mag = Math.abs(percents?.[0] ?? 0); 
    if (near(mag, 2.5)) return SUP_POINTS.CR_DEBUFF_HIGH;
    if (near(mag, 2.1)) return SUP_POINTS.CR_DEBUFF_MID;
    if (near(mag, 1.8)) return SUP_POINTS.CR_DEBUFF_LOW;
    return mag * 25;
  },
  // Debuff: Defense 
  'support:debuff_defense': ({ percents }) => {
    const mag = Math.abs(percents?.[0] ?? 0); 
    if (near(mag, 2.5)) return SUP_POINTS.DEF_DEBUFF_HIGH;
    if (near(mag, 2.1)) return SUP_POINTS.DEF_DEBUFF_MID;
    if (near(mag, 1.8)) return SUP_POINTS.DEF_DEBUFF_LOW;
    return mag * 24;
  },
  // "Cheers" (Outgoing + Ally Atk)
  'support:targets_protective': ({ percents }) => {
    const out = Math.abs(percents?.[0] ?? 0);
    if (near(out, 1.3)) return SUP_POINTS.CHEERS_HIGH;
    if (near(out, 1.1)) return SUP_POINTS.CHEERS_MID;
    if (near(out, 0.9)) return SUP_POINTS.CHEERS_LOW;
    return out * 70;
  },

  'support:ally_dmg_enh_effect': ({ percents }) => {
    const v = Math.abs(percents?.[0] ?? 0);
    if (near(v, 9.0))  return SUP_POINTS.ALLY_DMG_9;
    if (near(v, 7.5))  return SUP_POINTS.ALLY_DMG_7_5;
    if (near(v, 6.0))  return SUP_POINTS.ALLY_DMG_6;
    return v * 8.5;
  },

  'support:ally_atk_enh_effect': ({ percents }) => {
    const v = Math.abs(percents?.[0] ?? 0);
    if (near(v, 6.0)) return SUP_POINTS.ALLY_ATK_6;
    if (near(v, 5.0)) return SUP_POINTS.ALLY_ATK_5;
    if (near(v, 4.0)) return SUP_POINTS.ALLY_ATK_4;
    return v * 6;
  },

  // Tiny bonuses for WP and main stat in support context
  'dps:weapon_power_flat':     () => SUP_POINTS.WP_ANY_SMALL,
  'dps:weapon_power_stacking': () => SUP_POINTS.WP_ANY_SMALL,
  'dps:onhit_wp_ams':          () => SUP_POINTS.WP_ANY_SMALL,
  'dps:weapon_power_hp50':     () => SUP_POINTS.WP_ANY_SMALL,

  'basic:main:Intelligence':   () => SUP_POINTS.MAIN_SMALL,
  'basic:main:Strength':       () => SUP_POINTS.MAIN_SMALL,
  'basic:main:Dexterity':      () => SUP_POINTS.MAIN_SMALL
};

//// Public API ////////////////////////////////////////////////////////////

export const defaultWeights = {};

export const getProfileWeights = (role = 'DPS') => {
  const map = {};
  const attach = (obj) => {
    Object.entries(obj).forEach(([id, fn]) => {
      map[id] = { score: (vals, stat) => fn(vals, stat) };
    });
  };
  if (role === 'Support') attach(supportScorers);
  else attach(dpsScorers);
  return map;
};

export const scoreStat = (stat, weights) => {
  const id = stat.id || '';
  const line = stat.raw || stat.display || '';
  const vals = {
    percents: extractPercents(line),
    amounts:  extractPlusNumbers(line),
    text:     line
  };
  const w = weights?.[id];
  if (w && typeof w.score === 'function') {
    try { return Number(w.score(vals, stat)) || 0; } catch { return 0; }
  }
  return 0;
};

export const scoreBracelet = (stats, weights) =>
  (stats || []).reduce((sum, s) => sum + scoreStat(s, weights), 0);

export const sortStatsByContribution = (stats, weights) =>
  [...(stats || [])]
    .map(s => ({ ...s, contribution: scoreStat(s, weights) }))
    .sort((a, b) => (b.contribution ?? 0) - (a.contribution ?? 0));
