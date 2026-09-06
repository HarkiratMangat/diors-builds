// portal/ui/armory.logic.js — CommonJS, imports nothing. Pure op-builders + the badges-token parser for the Armory realm, tested directly by scripts/portalRealms.test.js.
//
// parseBadgesToken() is a client-side port of utils/adminParser.js's parseLoadoutBadges() -- that function lives in a Node-only module (chrono-node/dayjs deps) the browser bundle never loads, so this reproduces its exact grammar rather than reaching across the server boundary. Any change to the real parser's token vocabulary must be mirrored here.
function parseBadgesToken(badgesStr, mode) {
    const tokens = (badgesStr || '').toLowerCase().split(',').map((s) => s.trim()).filter(Boolean);
    let isMeta = false;
    let categoryRank = null;
    let dmzRangeRank = null;
    let isToxic = false;
    const unrecognized = [];

    for (const token of tokens) {
        if (token === 'meta') { isMeta = true; continue; }
        if (token === 'best') { categoryRank = 'best'; continue; }
        if (token === 'toxic') { isToxic = true; continue; }
        const rangeMatch = token.match(/^(best|top\s*\d+)(close|midlong)$/);
        if (rangeMatch) {
            const tier = rangeMatch[1].replace(/\s+/g, '');
            dmzRangeRank = `${tier}-${rangeMatch[2]}`;
            continue;
        }
        const topMatch = token.match(/^top\s*(\d+)$/);
        if (topMatch) { categoryRank = `top${topMatch[1]}`; continue; }
        unrecognized.push(token);
    }
    // DMZ never uses the per-category Best/TopN system -- same swap handlers/manage/loadouts.js applies server-side (a bare "best"/"topN" token doesn't know the mode on its own, so it moves over to dmzRangeRank here instead once the mode is known).
    if (mode === 'DMZ' && categoryRank && !dmzRangeRank) {
        dmzRangeRank = categoryRank;
        categoryRank = null;
    }
    return { isMeta, categoryRank, dmzRangeRank, isToxic, unrecognized };
}

// core/ops/loadouts.js's loadout.add/loadout.edit both run every payload field through validateBuild(), which REQUIRES weaponName + a valid mode and recomputes weaponKey itself -- callers never need to derive it. loadout.edit's real target shape is { id } (confirmed reading core/ops/loadouts.js's 'loadout.edit' entry in full: `Loadout.findById(op.target.id)`), matching loadout.delete/bulkDelete's own `{ id }`/`{ ids }` shapes. ⚠️ shareCode is NOT collected here, and this Armory form is now BEHIND Discord's own /manage on this front (reversed 2026-08-22 20:18 EDT -- this comment used to say "the real /manage add-loadout modal has no field for it either", which was true when written but is no longer true: Discord's Add/Edit Loadout modal now accepts "Build Name | Share Code" as a pipe-delimited convention on its existing `build` field, precisely because Discord modals cap at 5 fields with all 5 already used, so a real 6th field was never possible there -- see commands/manage.js/handlers/manage/loadouts.js. THIS form has no such 5-field constraint (it's a web form), so adding a real, dedicated Share Code input here would be more straightforward than the Discord workaround, not blocked by it. Filed as a follow-up in docs/db-deferred-list.md, not built here. Until then: on EDIT, this form still cannot show or change an existing (possibly /autobuild-set) shareCode at all -- the op-layer contract this comment originally described still holds and is still correct: see core/ops/loadouts.js's own header for why an always-present '' payload key would silently wipe a real gunsmith code on an EDIT (add is unaffected -- there is nothing yet to wipe on a new build). ⚠️ BADGES ARRIVE TWO WAYS NOW, and the token path stays because it is what a paste and a bulk apply speak. The add FORM sets the four fields directly — it has real controls, so making it serialise `meta, top3` into a string for this function to parse back would be a round trip through a grammar that exists for text input. An explicit field wins over the token when both are present.
//
// 🔴 shareCode IS OMITTED WHEN BLANK RATHER THAN SENT EMPTY. core/ops/loadouts.js spreads this payload straight into a Mongo $set, and its own header says an always-present '' would wipe a real code. Nothing exists to wipe on an ADD — but the two op-builders here must speak one contract, or the rule holds in one place and not the other, which is how it stops being a rule.
function buildArmoryAddOp(fields) {
    const token = parseBadgesToken(fields.badges, fields.mode);
    const pick = (explicit, fromToken) => (explicit === undefined ? fromToken : explicit);
    const shareCode = (fields.shareCode || '').trim();
    return {
        type: 'loadout.add', target: null,
        payload: {
            weaponName: fields.weaponName, category: fields.category, mode: fields.mode,
            buildName: fields.buildName || 'Standard Build', imageKey: fields.imageKey || '',
            attachments: fields.attachments || [],
            description: fields.description || '',
            ...(shareCode ? { shareCode } : {}),
            isMeta: Boolean(pick(fields.isMeta, token.isMeta)),
            isToxic: Boolean(pick(fields.isToxic, token.isToxic)),
            categoryRank: pick(fields.categoryRank, token.categoryRank) || null,
            dmzRangeRank: pick(fields.dmzRangeRank, token.dmzRangeRank) || null,
        },
    };
}

// The vocabulary utils/adminParser.js's parseLoadoutBadges accepts, spelled the way core/ops stores it. A DMZ build ranks on a combat RANGE as well as a tier, which is why it is one field of compound values rather than two.
const DMZ_RANGE_TOKENS = ['best-close', 'best-midlong', 'top3-close', 'top3-midlong', 'top5-close', 'top5-midlong'];
const MP_RANK_TOKENS = ['best', 'top3', 'top4', 'top5'];

// Edits one field of an existing row, preserving the rest -- loadout.edit's validate() needs the full build (weaponName/mode/etc), not a partial patch, same contract as every other entity's edit op in this portal.
function buildArmoryEditOp(row, columnKey, newValue) {
    const payload = { ...row, [columnKey]: newValue };
    delete payload.id; delete payload.coverage; delete payload.accent;
    return { type: 'loadout.edit', target: { id: row.id }, payload };
}

// ── THE BULK PASTE ────────────────────────────────────────────────────────────────────────────
//
// 🔴 A PASTE PREVIEW THAT ONLY COUNTS THE ERROR ARRAY LIES IN BOTH DIRECTIONS. utils/adminParser.js's parseBulkLoadoutList pushes an error and drops the block when it cannot read the header, and pushes an error but KEEPS the block when a badge token is unrecognised — so "6 problems" over a paste where four builds saved fine is both alarming and wrong, and "4 understood, 6 errors" reads as arithmetic nobody can follow. The server returns the BLOCK count, which makes the split exact: a block either parsed or it did not.
//
// ⚠️ THE DECOMPOSITION IS DERIVED FROM THAT PARSER'S CONTROL FLOW, not assumed — every rejecting branch there ends in `continue`, and the badge branch is the only one that pushes an error and falls through to `parsed.push`. scripts/portalArmoryBulk.test.js asserts it against the real parser on real text, so a change to the parser fails a test instead of silently re-conflating the two.
function bulkPasteSummary(result) {
    const rows = (result && result.rows) || [];
    const errors = (result && result.errors) || [];
    const blocks = Number.isFinite(result && result.blocks) ? result.blocks : rows.length;
    const rejected = Math.max(0, blocks - rows.length);
    const updates = rows.filter((r) => r.existing).length;
    return {
        blocks, understood: rows.length, rejected,
        warnings: Math.max(0, errors.length - rejected),
        updates, creates: rows.length - updates,
        canStage: rows.length > 0,
    };
}

// ⚠️ SELECTION STAYS FIRST. The Manifest's own "Export selection" has always sent `ids`, and the route still reads that before anything else — the two new scopes are additions, not a replacement, and reordering them here would silently change what an existing button exports.
function armoryExportQuery({ scope, mode, category, ids }) {
    if (scope === 'selection') return `ids=${(ids || []).join(',')}`;
    if (scope === 'category' && category) return `mode=${encodeURIComponent(mode)}&category=${encodeURIComponent(category)}`;
    return `mode=${encodeURIComponent(mode)}`;
}

// 🔴 "UPDATE" IS NOT A PREVIEW. The bulk paste told you a block would update an existing build and stopped there — so a paste that silently rewrote a category, dropped a share code or changed a rank looked exactly like one that changed nothing, and the only way to find out was to stage it and read the diff on the Review screen. These are the fields the upsert actually writes.
//
// ⚠️ THE MATCH IS THE CLIENT'S, THE VERDICT IS THE SERVER'S. /api/parse-bulk/loadout decides update-or-new on `weaponKey` — a normalised form this browser does not compute — so `existing` is taken from the reply and never re-derived here. This only names the CHANGING FIELDS, and when it cannot find the local record it says so rather than reporting "no change", because a silent empty diff over a real update is the exact failure it exists to prevent.
const BULK_DIFF_FIELDS = ['category', 'shareCode', 'imageKey', 'categoryRank', 'dmzRangeRank', 'isMeta', 'isToxic'];
const FIELD_WORDS = {
    category: 'Category', shareCode: 'Share code', imageKey: 'Image reference',
    categoryRank: 'Category rank', dmzRangeRank: 'DMZ range rank', isMeta: 'Meta badge', isToxic: 'Toxic badge',
};

const sameish = (a, b) => String(a ?? '').trim().toLowerCase() === String(b ?? '').trim().toLowerCase();

function findLocalBuild(builds, row, mode) {
    return (builds || []).find((b) => b.mode === mode
        && sameish(b.weaponName, row.weaponName) && sameish(b.buildName, row.buildName)) || null;
}

function bulkFieldDiff(row, before) {
    if (!before) return null;
    const out = [];
    for (const f of BULK_DIFF_FIELDS) {
        // A field the block did not mention arrives undefined and the upsert leaves it alone; only a value that is actually present can be a change.
        if (row[f] === undefined) continue;
        if (!sameish(before[f], row[f])) out.push({ field: f, word: FIELD_WORDS[f] || f, was: before[f], now: row[f] });
    }
    // The attachment LIST is what changes; the count is what the preview row carries, and a count that matches can still be a different set. Named honestly rather than claimed as equality.
    const beforeN = (before.attachments || []).length;
    if (typeof row.attachments === 'number' && row.attachments !== beforeN) {
        out.push({ field: 'attachments', word: 'Attachments', was: `${beforeN}`, now: `${row.attachments}` });
    }
    return out;
}

// ── THE RACK'S SHAPE, AND THE TWO SEARCHES OVER IT ────────────────────────────────────────────
//
// 🔴 THE RACK IS GROUPED BY CATEGORY AND OPENS CLOSED — Harkirat, Pin 21: "WHY do I have to scroll all the way".
// Grouped by rank tier it was five permanently-open rows over the whole catalogue, so every visit began by scrolling
// past everything to reach the one weapon class you came for. Category is the axis a reader arrives with ("show me
// the SMGs"); rank has not been lost, it has moved one level down — the weapon groups inside a category are ordered
// best-first and each carries its tier as a badge, so the board still answers "what is ranked where" once it is open.
//
// ⚠️ THIS LIVES IN THE LOGIC FILE RATHER THAN IN armory.js BECAUSE EVERY FACT ON A CATEGORY HEADER IS ARITHMETIC —
// the count, the ordering, the teaser — and arithmetic that only a browser can run is arithmetic nothing checks.
// ORDER_STAMP is deliberately absent: the display order is a constant below, not a date.
const RANK_ORDER = ['best', 'top3', 'top4', 'top5', null];
const RANK_LABEL = { best: 'Best in category', top3: 'Top 3', top4: 'Top 4', top5: 'Top 5', null: 'Unranked' };
// 🔴 THESE STRINGS ARE CSS CLASS NAMES. app.css's `.t-best/.t-top3/.t-top4/.t-top5/.t-unranked` are what grade a
// tier visually, and this map once emitted `t-t3`/`t-t4`/`t-t5`/`t-none` — four selectors that named nothing while
// every gate stayed green. They now ride on the WEAPON GROUP rather than on a tier row, because the tier row is gone.
const RANK_KEY = { best: 'best', top3: 'top3', top4: 'top4', top5: 'top5', null: 'unranked' };

// The mockup's own chip vocabulary and display order (armory.html's `renderCatChips`) — short labels, distinct from
// the precise CATEGORY_LABEL the edit form's dropdown uses, which is verbose on purpose.
const CATEGORY_CHIP_LABEL = { AR: 'Assault', SMG: 'SMG', LMG: 'LMG', MARKSMAN: 'Marksman', SNIPER: 'Sniper', SHOTGUN: 'Shotgun', SECONDARIES: 'Secondaries' };
const CATEGORY_CHIP_ORDER = ['AR', 'SMG', 'LMG', 'MARKSMAN', 'SNIPER', 'SHOTGUN', 'SECONDARIES'];

// A DMZ build ranks on dmzRangeRank, which also encodes a combat range (`best-close`, `best-midlong`) — the tier is
// the part before the hyphen. An MP build ranks on categoryRank. Reading the wrong field is how DMZ builds all pile
// into Unranked while looking correct.
function rankOf(b) {
    const raw = b.mode === 'DMZ' ? b.dmzRangeRank : b.categoryRank;
    if (!raw) return null;
    return String(raw).split('-')[0];
}

// A weapon's position is its BEST claim, never its worst: a weapon with one Best build and three unranked ones is a
// Best weapon. `null` is RANK_ORDER's last entry, so unranked sorts last without a special case.
function bestRankIndex(list) {
    return (list || []).reduce((best, b) => Math.min(best, RANK_ORDER.indexOf(rankOf(b))), RANK_ORDER.length - 1);
}

// One entry per category PRESENT in the list, in the mockup's display order, with anything unexpected appended
// alphabetically rather than dropped — a category that exists in the data and not in the order table is a build
// nobody can find, which is worse than a row in the wrong place.
function rackCategories(builds) {
    const all = builds || [];
    const present = new Set(all.map((b) => b.category));
    const ordered = CATEGORY_CHIP_ORDER.filter((c) => present.has(c))
        .concat([...present].filter((c) => c && !CATEGORY_CHIP_ORDER.includes(c)).sort());
    return ordered.map((category) => {
        const list = all.filter((b) => b.category === category);
        const byWeapon = new Map();
        for (const b of list) {
            if (!byWeapon.has(b.weaponName)) byWeapon.set(b.weaponName, []);
            byWeapon.get(b.weaponName).push(b);
        }
        const groups = [...byWeapon.entries()]
            .map(([weapon, list2]) => {
                const tier = RANK_ORDER[bestRankIndex(list2)];
                return { weapon, builds: list2, tier, tierKey: RANK_KEY[String(tier)], tierLabel: RANK_LABEL[String(tier)] };
            })
            .sort((a, b) => RANK_ORDER.indexOf(a.tier) - RANK_ORDER.indexOf(b.tier) || a.weapon.localeCompare(b.weapon));
        // The teaser is the whole point of a closed row: a header reading "SMG 28" tells you nothing you could not
        // have guessed, and one reading "SMG 28 — Best in category: Fennec" tells you whether to open it.
        const top = groups[0] || null;
        const topBuild = top
            ? [...top.builds].sort((x, y) => RANK_ORDER.indexOf(rankOf(x)) - RANK_ORDER.indexOf(rankOf(y)))[0]
            : null;
        return {
            category, label: CATEGORY_CHIP_LABEL[category] || category,
            builds: list, groups, count: list.length, weapons: byWeapon.size,
            accent: (list[0] && list[0].accent) || null,
            teaser: topBuild ? `${topBuild.weaponName} · ${topBuild.buildName || 'Standard Build'}` : '',
            teaserRank: top ? top.tierLabel : RANK_LABEL['null'],
        };
    });
}

// ── THE WEAPON SEARCH ─────────────────────────────────────────────────────────────────────────
//
// 🔴 PICK-TWO WAS THE WRONG QUESTION — Harkirat, Pin 18: "why can't I just type the weapon name / compare multiple
// builds of that weapon". Compare offered the first forty builds in the catalogue as chips and asked you to find two
// by eye; the comparison anyone actually wants is "this weapon, all of its builds", which a chip bar can express only
// by scrolling to two chips that happen to share a name. So the entry point is a typed weapon and the comparison is
// its whole sibling set — which is exactly the set the near-duplicate flag is about.
function weaponOptions(builds) {
    const byWeapon = new Map();
    for (const b of builds || []) {
        if (!byWeapon.has(b.weaponName)) byWeapon.set(b.weaponName, []);
        byWeapon.get(b.weaponName).push(b);
    }
    return [...byWeapon.entries()]
        .map(([weapon, list]) => ({ weapon, builds: list, category: list[0].category }))
        // Most builds first, because a weapon with five builds is the one this view exists for; ties by name so the
        // list is stable between renders rather than in Map insertion order, which follows the API's own ordering.
        .sort((a, b) => b.builds.length - a.builds.length || a.weapon.localeCompare(b.weapon));
}

// ⚠️ SUBSTRING, NOT PREFIX. "117" finds the AK117 and "fen" finds the Fennec; a prefix match would refuse the first
// and a fuzzy match would offer weapons that share no letters in order, which reads as a broken search.
// Already-picked weapons are removed rather than shown disabled: an option that cannot be chosen is a dead row in a
// list whose whole job is that every row is one keystroke from being chosen.
function matchWeapons(options, q, picked, limit = 8) {
    const needle = String(q || '').trim().toLowerCase();
    if (!needle) return [];
    const taken = picked || [];
    return (options || [])
        .filter((o) => o.weapon.toLowerCase().includes(needle) && !taken.includes(o.weapon))
        .slice(0, limit);
}

// ── WHAT STOPS A DRAWER FROM STAGING ──────────────────────────────────────────────────────────
//
// 🔴 A DISABLED CONTROL THAT DOES NOT SAY WHY IS THE SAME DEFECT AS A CHECK THAT CANNOT FAIL: the reader learns
// nothing from it. Both drawers put the reason on the footer line beside the button, so the sentence and the state it
// explains are one thing rather than a greyed button and a required-field marker eight hundred pixels above it.
//
// ⚠️ THE GUNSMITH CODE NEVER BLOCKS, and that is a decision rather than an omission. correctGunsmithCode CORRECTS a
// code — it maps look-alike characters onto whichever type each position expects — so refusing input client-side
// would refuse exactly the input the server was about to fix.
function addFormBlockers(f) {
    const out = [];
    if (!String((f && f.weaponName) || '').trim()) out.push('a weapon name');
    if (!String((f && f.category) || '').trim()) out.push('a category');
    return out;
}

// The fields loadout.edit actually writes, which is what makes "nothing has changed" answerable. `attachments` is
// compared as a LIST rather than a count: two five-attachment lists that differ in one string are a real edit, and a
// count comparison would call them equal.
const EDIT_DIRTY_FIELDS = ['weaponName', 'buildName', 'category', 'mode', 'shareCode', 'imageKey',
    'isMeta', 'isToxic', 'categoryRank', 'dmzRangeRank', 'description'];

function editedFields(build, draft) {
    const before = build || {};
    const after = draft || {};
    const out = EDIT_DIRTY_FIELDS.filter((k) => String(before[k] ?? '') !== String(after[k] ?? ''));
    if ((before.attachments || []).join('\u0000') !== (after.attachments || []).join('\u0000')) out.push('attachments');
    return out;
}

// 🔴 STAGING A NO-OP EDIT IS NOT HARMLESS — it puts a row on the Review screen that changes nothing, which somebody
// then has to read, understand and decide about. An edit drawer that cannot tell you it has nothing to stage is one
// that quietly manufactures work for the only screen that commits.
function editorBlockers(build, draft) {
    const out = [];
    if (!String((draft && draft.weaponName) || '').trim()) out.push('a weapon name');
    else if (!editedFields(build, draft).length) out.push('a change — every field still matches the live build');
    return out;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { bulkFieldDiff, findLocalBuild, buildArmoryAddOp, buildArmoryEditOp, parseBadgesToken, bulkPasteSummary, armoryExportQuery, DMZ_RANGE_TOKENS, MP_RANK_TOKENS,
        RANK_ORDER, RANK_LABEL, RANK_KEY, CATEGORY_CHIP_LABEL, CATEGORY_CHIP_ORDER,
        rankOf, bestRankIndex, rackCategories, weaponOptions, matchWeapons,
        addFormBlockers, editedFields, editorBlockers, EDIT_DIRTY_FIELDS };
}
