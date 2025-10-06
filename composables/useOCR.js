// composables/useOCR.js
export const useOCR = () => {
  const processImage = async (imageFile) => {
    try {
      const { default: Tesseract } = await import('tesseract.js');

      const { data: { text } } = await Tesseract.recognize(
        imageFile,
        'eng',
        {
          logger: m => console.log(m),
          tessedit_pageseg_mode: 6,
          tessedit_char_whitelist:
            "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789%+.,/'-(): "
        }
      );

      const parsed  = parseStats(text);
      const healed  = postParseHeal(parsed);

      const unknowns = healed.filter(s => s.category === 'unknown');
      const strict = healed.map(s => {
        const check = validateCanonical(s.raw);
        const display = beautifyDisplay(s.raw);
        return {
          ...s,
          id: check.id || null,
          display,
          strict_ok: check.ok,
          strict_category: check.category || s.category,
          why: check.why || ''
        };
      });
      const mismatches = strict.filter(s => !s.strict_ok);

      if (unknowns.length > 0 || mismatches.length > 0) {
        const err = buildValidationError({ unknowns, mismatches });
        return { success: false, error: err, text, parsed: strict };
      }

      return {
        success: true,
        text,
        parsed: strict.map(({ strict_category, ...rest }) => ({
          ...rest,
          category: strict_category,
          display: beautifyDisplay(rest.raw)
        }))
      };
    } catch (error) {
      console.error('OCR Error:', error);
      return { success: false, error: error.message, text: '', parsed: [] };
    }
  };

  // ------------------ BULLET-GROUPING WITH LEADING-JUNK TOLERANCE ------------------
  const parseStats = (text) => {
    let norm = text
      .normalize('NFKC')
      .replace(/\r/g, '\n')
      .replace(/[“”]/g, '"')
      .replace(/[’]/g, "'")
      .replace(/\+\s+(\d+)/g, '+$1')                 // "+ 13121" → "+13121"
      .replace(/\+(\d+)\s+(\d{1,2})%/g, '+$1.$2%')   // "+8 40%" → "+8.40%"
      .replace(/([A-Za-z])([+\-]\d)/g, '$1 $2')      // "Crit+79" → "Crit +79"
      .replace(/(\d),(\d{3})(?=[^\d]|$)/g, '$1$2');  // 7,200 → 7200 (we’ll reformat later)

    const rawLines = norm.split('\n').map(l => l.trim()).filter(Boolean);

    const leadingJunk = `['"\`‘’“”\\s]*`;
    // bullets: @ © ® o O a A and digit bullets 8/9 (OCR look-alikes)
    const bulletCore = `(?:[@©®oOaA]|[89](?=\\s+[A-Za-z]))`;
    const bulletRE = new RegExp(`^${leadingJunk}${bulletCore}(?![A-Za-z0-9])\\s?`);
    const stripLeadingJunkAndBulletRE = new RegExp(`^${leadingJunk}${bulletCore}(?![A-Za-z0-9])\\s?`);
    const stripLeadingJunkOnlyRE = /^[\s"'`‘’“”]+/;

    const headerNoiseRE = /(Item Tier|tem Tier|Restricted Trading|Bound to Character|Untradable|Ancient|Radiant|Bracelet Bonus)/i;

    const fixShieldParen = (s) => {
      return s.replace(/\(Shield[^)]*\)/gi, (m) => {
        const hasRegen = /HP\s*Regen/i.test(m);
        const hasInc   = /Incoming\s+Damage\s+Reduction/i.test(m);
        if (hasRegen && hasInc) return '(Shield, HP Regen, Incoming Damage Reduction)';
        return m;
      });
    };

    const fixLineContent = (s) => {
      let t = s;

      // insert missing '+'
      t = t.replace(
        /^(Crit(?!\s*(Rate|Damage|Hit))|Specialization|Swiftness|Domination|Endurance|Expertise)\s+(\d{2,3})\b/i,
        (_, name, _ign, num) => `${name} +${num}`
      );
      t = t.replace(/^(Intelligence|Strength|Dexterity|Vitality)\s+(\d{3,6})\b/i,
        (_, name, num) => `${name} +${num}`
      );
      t = t.replace(/^(Max HP)\s+(\d{4,6})\b/i, (_, name, num) => `${name} +${num}`);

      // leading "Stat : number" → "+number"
      const leadingStatPlus = new RegExp(
        '^(' + [
          'Intelligence','Strength','Dexterity','Vitality','Max HP',
          'Weapon Power','Crit','Specialization','Swiftness',
          'Domination','Endurance','Expertise'
        ].join('|') + ')\\s*[:;=]\\s*(\\d+)\\b', 'i'
      );
      t = t.replace(leadingStatPlus, (_, name, num) => `${name} +${num}`);

      // punctuation heals
      t = fixShieldParen(t);
      // normalize Atk without dot before slash
      t = t.replace(/\bAtk\s*\/\s*Move Speed\b/gi, 'Atk./Move Speed');
      // other Atk. variants
      t = t.replace(/\bAtk_\.?\s*Power\b/gi, 'Atk. Power');
      t = t.replace(/\bAtk[_·•]\s*/gi, 'Atk. ');

      return t;
    };

    let groups = [];
    let current = '';
    let started = false;

    for (let i = 0; i < rawLines.length; i++) {
      let line = rawLines[i];

      if (!started && headerNoiseRE.test(line)) continue;

      const isBullet = bulletRE.test(line);
      if (!started) {
        if (isBullet) {
          started = true;
          const stripped = line.replace(stripLeadingJunkAndBulletRE, '').trim();
          current = fixLineContent(stripped);
        }
        continue; // ignore preamble before first bullet
      }

      if (isBullet) {
        if (current) groups.push(current.trim());
        const stripped = line.replace(stripLeadingJunkAndBulletRE, '').trim();
        current = fixLineContent(stripped);
      } else {
        line = line.replace(stripLeadingJunkOnlyRE, '');
        if (headerNoiseRE.test(line)) continue;
        current += (current ? ' ' : '') + fixLineContent(line);
      }
    }
    if (current) groups.push(current.trim());

    // split if a stray bullet sneaks *inside* a grouped line (e.g. "... % 9 Crit +114")
    const INNER_BULLET_SPLIT = /(?:[@©®oOaA]|[89])\s+(?=(Intelligence|Strength|Dexterity|Vitality|Crit(?!\s*(Rate|Damage|Hit))|Specialization|Swiftness|Max HP|Additional Damage|Crit Damage|Crit Rate|Weapon Power|Back Attack|Frontal|Non-direction|Outgoing Damage|Skill cooldown|On hit,|Targets that already have|Ally))/i;
    const repaired = [];
    for (const g of groups) {
      const m = g.match(INNER_BULLET_SPLIT);
      if (m && typeof m.index === 'number' && m.index > 0) {
        const left = g.slice(0, m.index).trim();
        const right = g.slice(m.index).replace(/^[^A-Za-z]*\s*/, '');
        if (left) repaired.push(left);
        if (right) repaired.push(fixLineContent(right));
      } else {
        repaired.push(g);
      }
    }
    groups = repaired;

    // loose category (UI color)
    const isCombatStat = (s) =>
      /^(?:Crit(?!\s*(Rate|Damage|Hit))|Specialization|Swiftness)\s*\+\d+(?:\.\d+)?\b/i.test(s);
    const isBasic      = (s) => /^(Intelligence|Strength|Dexterity)\s*\+\d+/i.test(s);
    const isVitality   = (s) => /^Vitality\s*\+\d+/i.test(s);
    const isMaxHpFlat  = (s) => /^Max HP\s*\+\d{4,6}$/i.test(s); // low-value
    const isSpecial    = (s) => /\bAtk\.?\/Move Speed\b/i.test(s);
    const isSupport    = (s) => /(Targets that already have|party-wide|Ally|Enhancement|target's (?:Defense|Crit Resistance|Crit Damage)\s*-[\d.]+%)/i.test(s);
    const isDps        = (s) => /(Additional Damage|Crit Rate|Crit Damage|Crit Hit Damage|Weapon Power|Outgoing Damage|Back Attack|Frontal|Non-direction|Skill cooldown)/i.test(s);
    const isLowValue   = (s) => /(Domination|Endurance|Expertise|Combat HP Recovery|Combat Resource|Natural Recovery|Mag\. Defense|Phy\. Defense|Challenge or lower|Paralysis|Push Immunity|Movement Skill\/Stand Up cooldown|Incoming Damage from Challenge or lower monsters)/i.test(s);

    const tidy = (s) => s.replace(/\s+%/g, '%').replace(/\s{2,}/g, ' ').trim();

    return groups.map(g => {
      const line = tidy(g);
      let category = 'unknown';
      if (isBasic(line))           category = 'basic';
      else if (isVitality(line))   category = 'low-value';
      else if (isMaxHpFlat(line))  category = 'low-value';
      else if (isCombatStat(line)) category = 'combat';
      else if (isSupport(line))    category = 'support';
      else if (isSpecial(line))    category = 'special';
      else if (isDps(line))        category = 'dps';
      else if (isLowValue(line))   category = 'low-value';
      return { raw: line, category };
    });
  };

  // ------------------ POST-PARSE HEALER (safe) ------------------
  const postParseHeal = (parsed) => {
    const fmt4 = (d) => d.replace(/^(\d)(\d{3})$/, '$1,$2'); // 1160→1,160; 7200→7,200

    return parsed.map(({ raw, category }) => {
      let s = raw;

      // strip stray quotes
      s = s.replace(/^['"“”‘’]+(?=\S)/, '');
      s = s.replace(/(?<=\S)['"“”‘’]+$/, '');
      s = s.replace(/(\.\s*)['"“”‘’]+(?=\S)/g, '$1');

      // normalize minus variants
      s = s.replace(/[–−]/g, '-');

      // punctuation/word heals
      s = s.replace(/\bOn hit\.\s*(?=[A-Z])/gi, 'On hit, ');
      s = s.replace(/\bAly\b/gi, 'Ally');
      s = s.replace(/getting\s+ht\b/gi, 'getting hit');
      s = s.replace(/\bAtk\s*\/\s*Move Speed\b/gi, 'Atk./Move Speed');

      // decimals with space: "-4. 2%" → "-4.2%"
      s = s.replace(/(\d)\.\s*(\d+)%/g, '$1.$2%');

      // durations / cooldowns
      s = s.replace(/\bfor\s+Ss\b\.?/gi, 'for 5s.');
      s = s.replace(/(Cooldown:\s*)(60|70|80)\b(?!s)/gi, '$1$2s');
      s = s.replace(/(Cooldown:\s*)(60|70|80)5\b/gi, '$1$2s');

      // percent gap oddities: "+2 5%" -> "+2.5%"
      s = s.replace(/\+(\d)\s(\d{1,2})%/g, '+$1.$2%');

      // normalize Shield parenthetical
      s = s.replace(/\(Shield[^)]*\)/gi, (m) => {
        const hasRegen = /HP\s*Regen/i.test(m);
        const hasInc   = /Incoming\s+Damage\s+Reduction/i.test(m);
        if (hasRegen && hasInc) return '(Shield, HP Regen, Incoming Damage Reduction)';
        return m;
      });

      // Demon/Archdemon singular
      s = s.replace(/Bonus vs\. Demons\/Archdemon/gi, 'Bonus vs. Demon/Archdemon');

      // ---- Challenge lines sanity + stray digits fix ----
      s = s.replace(/^Damage to Challenge or lower monsters\s*-\s*(4|5|6)%\.?$/i,
                    'Damage to Challenge or lower monsters +$1%.');
      s = s.replace(/^Incoming Damage from Challenge or lower monsters\s*\+\s*(6|8|10)%\.?$/i,
                    'Incoming Damage from Challenge or lower monsters -$1%.');
      // clamp accidental extra digit like "-85%" → "-8%"
      s = s.replace(/^Incoming Damage from Challenge or lower monsters\s*-\s*(6|8|10)\d%\.?$/i,
        (_m, base) => `Incoming Damage from Challenge or lower monsters -${base}%.`
      );

      // ---- Weapon Power HP≥50% variant heals ----
      if (/When your HP is 50% or higher/i.test(s)) {
        // fix period → comma before "upon hit"
        s = s.replace(/(When your HP is 50% or higher)\.\s*(upon hit,)/i, '$1, $2');
        // ensure "for 5s."
        s = s.replace(/\bfor\s*5\b(?!s)/i, 'for 5s');
        s = s.replace(/(for 5s)(?!\.)/i, '$1.');
        // add comma formatting 7,200 / 2,000
        s = s.replace(/(Weapon Power \+)(\d{4})(?=\. When your HP is 50% or higher,)/,
          (_m, p1, num) => p1 + fmt4(num)
        );
        s = s.replace(/(upon hit, Weapon Power \+)(\d{4})(?=\s*for 5s)/,
          (_m, p1, num) => p1 + fmt4(num)
        );
      }

      // fix dot as thousands separator elsewhere (2.000 → 2,000; 1.160 → 1,160)
      s = s.replace(/\b(\d{1,3})\.(\d{3})\b/g, '$1,$2');

      // Targeted comma formatting (don’t touch flat "Weapon Power +7200/8100/9000")
      s = s.replace(/(On hit, Weapon Power \+)(\d{4})(, Atk\.\/Move Speed \+1% for 10s\. \(Max\. 6 stacks\))/,
        (_m, p1, num, p3) => p1 + fmt4(num) + p3
      );
      s = s.replace(/^(Weapon Power \+)(\d{4})(\. Upon hit, Weapon Power \+(?:130|140|150) for 120s every 30s\. \(Max\. 30 stacks\))$/,
        (_m, p1, num, p3) => p1 + fmt4(num) + p3
      );
      s = s.replace(/^Weapon Power \+(\d{4})\.(\s*When your HP is 50% or higher, upon hit, Weapon Power \+)(\d{4})(\s*for 5s\.)$/,
        (_m, a, mid, b, tail) => `Weapon Power +${fmt4(a)}.${mid}${fmt4(b)}${tail}`
      );

      // strip stray trailing period on plain numeric statlines (include a few low-value flats)
      const trailingDotPlainStat = new RegExp(
        '^(?:' +
          'Intelligence|Strength|Dexterity|Vitality|Max HP|' +
          'Crit(?!\\s*(Rate|Damage|Hit))|Specialization|Swiftness|Domination|Endurance|Expertise|' +
          'Combat HP Recovery' +
        ')\\s*\\+\\d{2,6}\\.$',
        'i'
      );
      if (trailingDotPlainStat.test(s)) s = s.replace(/\.$/, '');

      // drop UI tail
      s = s.replace(/\s*Bonus can be granted.*$/i, '');

      // tidy
      s = s.replace(/\s+%/g, '%').replace(/\s{2,}/g, ' ').trim();

      return { raw: s, category };
    });
  };

  // ------------------ DISPLAY BEAUTIFIER ------------------
  const beautifyDisplay = (input) => {
    let s = input;

    const pairs = [
      [/\bcrit hit damage\b/gi, 'Crit Hit Damage'],
      [/\bcrit rate\b/gi, 'Crit Rate'],
      [/\bcrit damage\b/gi, 'Crit Damage'],
      [/\bintelligence\b/gi, 'Intelligence'],
      [/\bstrength\b/gi, 'Strength'],
      [/\bdexterity\b/gi, 'Dexterity'],
      [/\bvitality\b/gi, 'Vitality'],
      [/\bcrit\b/gi, 'Crit'],
      [/\bspecialization\b/gi, 'Specialization'],
      [/\bswiftness\b/gi, 'Swiftness'],
      [/\bdomination\b/gi, 'Domination'],
      [/\bendurance\b/gi, 'Endurance'],
      [/\bexpertise\b/gi, 'Expertise'],
      [/\bmax hp\b/gi, 'Max HP'],
      [/\bweapon power\b/gi, 'Weapon Power'],
      [/\batk\.?\s*\/\s*move speed\b/gi, 'Atk./Move Speed'],
      [/\boutgoing damage\b/gi, 'Outgoing Damage'],
      [/\bnon-direction\b/gi, 'Non-direction'],
      [/\bback attack\b/gi, 'Back Attack'],
      [/\bfrontal attack\b/gi, 'Frontal Attack'],
      [/\bskill cooldown\b/gi, 'Skill cooldown'],
      [/\bally atk\. power enhancement effect\b/gi, 'Ally Atk. Power Enhancement Effect'],
      [/\bally damage enhancement effect\b/gi, 'Ally Damage Enhancement Effect'],
      [/\bally atk\. power enhancement\b/gi, 'Ally Atk. Power Enhancement'],
      [/\bincoming damage reduction\b/gi, 'Incoming Damage Reduction'],
      [/\bhp regen\b/gi, 'HP Regen'],
      [/\bshield\b/gi, 'Shield'],
      [/\bdemon\/archdemon\b/gi, 'Demon/Archdemon']
    ];

    for (const [re, to] of pairs) s = s.replace(re, to);
    s = s.replace(/\s+%/g, '%').replace(/\s{2,}/g, ' ').trim();
    return s;
  };

  // ------------------ CANONICAL VALIDATION ------------------
  const numWithCommaOpt = (vals) =>
    `(?:${vals.map(v => String(v).replace(/(\d)(?=(\d{3})+$)/g, '$1,')).join('|')}|${vals.join('|')})`;

  const RE = {
    BASIC_MAIN: /^(Intelligence|Strength|Dexterity)\s*\+(\d{4,5})$/i,
    BASIC_VIT: /^Vitality\s*\+(\d{4,5})$/i,
    COMBAT: /^(Crit(?!\s*(Rate|Damage|Hit))|Specialization|Swiftness)\s*\+(\d{2,3})$/i,

    ATK_MOVE: /^Atk\.\/Move Speed \+(?:4|5|6)%\.?$/i,
    ADDITIONAL_DMG: /^Additional Damage \+(?:3\.00|3\.50|4\.00)%\.?$/i,
    CRIT_DMG:       /^Crit Damage \+(?:6\.80|8\.40|10\.00|6\.8|8\.4|10)%\.?$/i,
    CRIT_RATE:      /^Crit Rate \+(?:3\.40|4\.20|5\.00|3\.4|4\.2|5)%\.?$/i,
    WEAPON_POWER_FLAT: new RegExp(`^Weapon Power \\+${numWithCommaOpt([7200,8100,9000])}$`, 'i'),
    BACK_ATTACK:    /^Back Attack Damage \+(?:2\.5|3(?:\.0)?|3\.5)%\.?$/i,
    FRONTAL:        /^Frontal (?:Attack|Attck) Damage \+(?:2\.5|3(?:\.0)?|3\.5)%\.?$/i,
    NON_DIRECTION:  /^Non-direction Skill Damage \+(?:2\.5|3(?:\.0)?|3\.5)%\.? Awakening Skills do not apply\.?$/i,
    ON_HIT_WP_AMS:  /^On hit, Weapon Power \+(?:1,?160|1,?320|1,?480), Atk\.\/Move Speed \+1% for 10s\. \(Max\. 6 stacks\)$/i,
    OUTGOING_SOLO:  /^Outgoing Damage \+(?:2(?:\.0)?|2\.5|3(?:\.0)?)%\.?$/i,
    OUTGOING_STAGG: /^Outgoing Damage \+(?:2(?:\.0)?|2\.5|3(?:\.0)?)%\. Outgoing Damage \+(?:4(?:\.0)?|4\.5|5(?:\.0)?)% to Staggered foes\.?$/i,
    ADDITIONAL_DEMONS: /^Additional Damage \+(?:2\.5|3(?:\.0)?|3\.5)%\. Bonus vs\. Demon\/Archdemon \+2\.5%\.?$/i,
    CDMG_PAIR:  /^Crit Damage \+(?:6\.8|8\.4|10(?:\.0)?)%\. Crit Hit Damage \+1\.5%\.?$/i,
    CRATE_PAIR: /^Crit Rate \+(?:3\.4|4\.2|5(?:\.0)?)%\. Crit Hit Damage \+1\.5%\.?$/i,
    SKILL_COOLDOWN_OUT: /^Skill cooldown \+2%\. Outgoing Damage \+(?:4\.5|5(?:\.0)?|5\.5)%\.?$/i,
    WP_STACKING: new RegExp(`^Weapon Power \\+${numWithCommaOpt([6900,7800,8700])}\\. Upon hit, Weapon Power \\+(?:130|140|150) for 120s every 30s\\. \\(Max\\. 30 stacks\\)$`, 'i'),
    WP_HP50: new RegExp(`^Weapon Power \\+${numWithCommaOpt([7200,8100,9000])}\\. When your HP is 50% or higher, upon hit, Weapon Power \\+${numWithCommaOpt([2000,2200,2400])} for 5s\\.$`, 'i'),

    ALLY_ATK_ENH_EFFECT: /^Ally Atk\. Power Enhancement Effect \+(?:4\.00|5\.00|6\.00)%$/i,
    ALLY_DMG_ENH_EFFECT: /^Ally Damage Enhancement Effect \+(?:6\.00|7\.50|9\.00)%$/i,
    ON_HIT_DEBUFF_CD: /^On hit, target's Crit Damage -(?:3\.6|4\.2|4\.8)% for 8s\. This effect is limited to a single application per party\. Ally Atk\. Power Enhancement \+(?:2(?:\.0)?|2\.5|3(?:\.0)?)%\.?(?:\s*Bonus can be granted.*)?$/i,
    ON_HIT_DEBUFF_CR: /^On hit, target's Crit Resistance -(?:1\.8|2\.1|2\.5)% for 8s\. This effect is limited to a single application per party\. Ally Atk\. Power Enhancement \+(?:2(?:\.0)?|2\.5|3(?:\.0)?)%\.?(?:\s*Bonus can be granted.*)?$/i,
    ON_HIT_DEBUFF_DEF: /^On hit, target's Defense -(?:1\.8|2\.1|2\.5)% for 8s\. This effect is limited to a single application per party\. Ally Atk\. Power Enhancement \+(?:2(?:\.0)?|2\.5|3(?:\.0)?)%\.?(?:\s*Bonus can be granted.*)?$/i,
    TARGETS_PROTECTIVE: /^Targets that already have a party-wide protective effect \(Shield[ ,.]?\s*HP Regen[ ,.]?\s*Incoming Damage Reduction\) are granted Outgoing Damage \+(?:0\.9|1\.1|1\.3)% for 5s\. This effect is limited to a single application per party and does not apply to protective effects with no duration\. Ally Atk\. Power Enhancement \+(?:2(?:\.0)?|2\.5|3(?:\.0)?)%\.?(?:\s*Bonus can be granted.*)?$/i,

    // low-value pool
    LV_COMBAT: /^(Domination|Endurance|Expertise)\s*\+(\d{2,3})$/i,
    LV_HP_REC: /^Combat HP Recovery \+(?:100|130|160)\.?$/i, // allow optional trailing period
    LV_RESOURCE: /^Combat Resource Natural Recovery \+(?:8\.00|10\.00|12\.00)%$/i,
    LV_DEF_MAG: /^Mag\. Defense \+(?:5000|6000|7000)$/i,
    LV_DEF_PHY: /^Phy\. Defense \+(?:5000|6000|7000)$/i,
    LV_CHALLENGE_DMG: /^Damage to Challenge or lower monsters \+(?:4|5|6)%\.?$/i,
    LV_CHALLENGE_IN: /^Incoming Damage from Challenge or lower monsters \-(?:6|8|10)%\.?$/i,
    LV_IMMUNITY: /^On hit, Paralysis and Push Immunity for (?:80|70|60)s\. \(Cooldown: (?:80|70|60)s\) The effect is removed upon getting hit 1 time\.$/i,
    LV_MOVE_CD: /^Movement Skill\/Stand Up cooldown \-(?:8|10|12)%\.?$/i,
    LV_MAX_HP_FLAT: new RegExp(`^Max HP \\+${numWithCommaOpt([11200,14000,16800])}$`, 'i')
  };

  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();

  const validateCanonical = (line) => {
    const L = line.trim();

    let m = L.match(RE.BASIC_MAIN);
    if (m) {
      const stat = cap(m[1]);
      const val = parseInt(m[2], 10);
      if (val >= 9600 && val <= 16000)
        return { ok: true, category: 'basic', id: `basic:main:${stat}` };
      return { ok: false, why: `Basic stat out of range (9600–16000): ${val}` };
    }

    m = L.match(RE.BASIC_VIT);
    if (m) {
      const val = parseInt(m[1], 10);
      if (val >= 4000 && val <= 6000)
        return { ok: true, category: 'low-value', id: 'low:vit' };
      return { ok: false, why: `Vitality out of range (4000–6000): ${val}` };
    }

    if (RE.LV_MAX_HP_FLAT.test(L)) return { ok: true, category: 'low-value', id: 'low:max_hp_flat' };

    m = L.match(RE.COMBAT);
    if (m) {
      const name = cap(m[1]);
      const val = parseInt(m[3], 10);
      if (val >= 61 && val <= 120)
        return { ok: true, category: 'combat', id: `combat:${name}` };
      return { ok: false, why: `Combat stat out of range (61–120): ${val}` };
    }

    if (RE.ATK_MOVE.test(L))        return { ok: true, category: 'special', id: 'special:atk_move_speed' };
    if (RE.ADDITIONAL_DMG.test(L))  return { ok: true, category: 'dps', id: 'dps:additional_damage' };
    if (RE.CRIT_DMG.test(L))        return { ok: true, category: 'dps', id: 'dps:crit_damage' };
    if (RE.CRIT_RATE.test(L))       return { ok: true, category: 'dps', id: 'dps:crit_rate' };
    if (RE.WEAPON_POWER_FLAT.test(L)) return { ok: true, category: 'dps', id: 'dps:weapon_power_flat' };
    if (RE.BACK_ATTACK.test(L))     return { ok: true, category: 'dps', id: 'dps:back_attack' };
    if (RE.FRONTAL.test(L))         return { ok: true, category: 'dps', id: 'dps:frontal_attack' };
    if (RE.NON_DIRECTION.test(L))   return { ok: true, category: 'dps', id: 'dps:non_direction' };
    if (RE.ON_HIT_WP_AMS.test(L))   return { ok: true, category: 'dps', id: 'dps:onhit_wp_ams' };
    if (RE.OUTGOING_SOLO.test(L))   return { ok: true, category: 'dps', id: 'dps:outgoing_damage' };
    if (RE.OUTGOING_STAGG.test(L))  return { ok: true, category: 'dps', id: 'dps:outgoing_damage_staggered' };
    if (RE.ADDITIONAL_DEMONS.test(L)) return { ok: true, category: 'dps', id: 'dps:additional_damage_demon' };
    if (RE.CDMG_PAIR.test(L))       return { ok: true, category: 'dps', id: 'dps:crit_damage_plus_chd' };
    if (RE.CRATE_PAIR.test(L))      return { ok: true, category: 'dps', id: 'dps:crit_rate_plus_chd' };
    if (RE.SKILL_COOLDOWN_OUT.test(L)) return { ok: true, category: 'dps', id: 'dps:skill_cooldown_plus_outgoing' };
    if (RE.WP_STACKING.test(L))     return { ok: true, category: 'dps', id: 'dps:weapon_power_stacking' };
    if (RE.WP_HP50.test(L))         return { ok: true, category: 'dps', id: 'dps:weapon_power_hp50' };

    if (RE.ALLY_ATK_ENH_EFFECT.test(L)) return { ok: true, category: 'support', id: 'support:ally_atk_enh_effect' };
    if (RE.ALLY_DMG_ENH_EFFECT.test(L)) return { ok: true, category: 'support', id: 'support:ally_dmg_enh_effect' };
    if (RE.ON_HIT_DEBUFF_CD.test(L))    return { ok: true, category: 'support', id: 'support:debuff_crit_damage' };
    if (RE.ON_HIT_DEBUFF_CR.test(L))    return { ok: true, category: 'support', id: 'support:debuff_crit_resist' };
    if (RE.ON_HIT_DEBUFF_DEF.test(L))   return { ok: true, category: 'support', id: 'support:debuff_defense' };
    if (RE.TARGETS_PROTECTIVE.test(L))  return { ok: true, category: 'support', id: 'support:targets_protective' };

    m = L.match(RE.LV_COMBAT);
    if (m) {
      const name = cap(m[1]);
      const val = parseInt(m[2], 10);
      if (val >= 61 && val <= 120) return { ok: true, category: 'low-value', id: `low:${name}` };
      return { ok: false, why: `Low-value combat stat out of range (61–120): ${val}` };
    }
    if (RE.LV_HP_REC.test(L))       return { ok: true, category: 'low-value', id: 'low:combat_hp_recovery' };
    if (RE.LV_RESOURCE.test(L))     return { ok: true, category: 'low-value', id: 'low:combat_resource_recovery' };
    if (RE.LV_DEF_MAG.test(L))      return { ok: true, category: 'low-value', id: 'low:mag_defense' };
    if (RE.LV_DEF_PHY.test(L))      return { ok: true, category: 'low-value', id: 'low:phy_defense' };
    if (RE.LV_CHALLENGE_DMG.test(L))return { ok: true, category: 'low-value', id: 'low:damage_to_challenge' };
    if (RE.LV_CHALLENGE_IN.test(L)) return { ok: true, category: 'low-value', id: 'low:incoming_damage_from_challenge' };
    if (RE.LV_IMMUNITY.test(L))     return { ok: true, category: 'low-value', id: 'low:paralysis_push_immunity' };
    if (RE.LV_MOVE_CD.test(L))      return { ok: true, category: 'low-value', id: 'low:movement_cooldown' };

    return { ok: false, why: 'Line does not match any canonical pattern' };
  };

  // ------------------ ERROR BUILDER ------------------
  const buildValidationError = ({ unknowns, mismatches }) => {
    const linesA = unknowns.map(u => `• ${u.raw}  —  (unknown)`);
    const linesB = mismatches.map(m => `• ${m.raw}  —  (not in canonical list${m.why ? `: ${m.why}` : ''})`);
    const preview = [...linesA, ...linesB].slice(0, 10).join('\n') || '• (no preview available)';

    const tips = [
      'Crop tightly around the bracelet text (no background/UI).',
      'Use 100% zoom or higher; avoid scaled or blurred screenshots.',
      'Avoid overlapping cursors on the bracelet panel.',
      'Upload a PNG if possible.',
      'Ensure the blue bullet icon is visible for every line.'
    ].map(t => `- ${t}`).join('\n');

    return [
      'Couldn’t validate all lines against the canonical bracelet list. Please upload a cleaner, tightly-cropped screenshot.',
      '',
      'Problem lines:',
      preview,
      '',
      'Upload tips for best OCR results:',
      tips
    ].join('\n');
  };

  return { processImage };
};
