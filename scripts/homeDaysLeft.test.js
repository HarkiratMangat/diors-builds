#!/usr/bin/env node
// scripts/homeDaysLeft.test.js — Home's restored fourth masthead figure ("days left", build-out plan 2026-09-06 01:33 EDT) and the two clarify/onboard copy changes beside it.
//
// Same convention as scripts/portalAnalytics.test.js: portal/ui/home.js cannot be `require`d or `import`ed directly in bare Node (it pulls in the buildless vendor bundle, which only exists after `npm run build`), so the pure arithmetic (dayOf/dday/seasonDaysLeft) is extracted from the REAL source text by name and evaluated with `new Function`, with only the one true external dependency — season.js's own `seasonLastDeadline` — supplied as a stub. Everything else under test is the actual bytes on disk, not a hand-copied re-implementation of them.
//
// Run: node scripts/homeDaysLeft.test.js (also via npm test)

const assert = require('assert');
const fs = require('fs');
const path = require('path');

let failures = 0;
const say = console.log.bind(console);
function check(name, fn) {
    try { fn(); say(`  ✓ ${name}`); }
    catch (e) { failures++; console.error(`  ✗ ${name}\n      ${e.message}`); }
}

say('homeDaysLeft — the season deadline reduced to a masthead figure, past-end and missing-end included');

const ROOT = path.join(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const home = read('portal/ui/home.js');

// Slices one function's source out by name, walking braces rather than regexing them so a one-line arrow (dayOf/dday, no braces at all) and a multi-line `function` declaration (seasonDaysLeft) both come out whole and nothing else.
function extract(name, src) {
    const at = src.indexOf(name);
    assert.ok(at >= 0, `${name} not found in portal/ui/home.js`);
    const braceStart = src.indexOf('{', at);
    const semi = src.indexOf(';', at);
    if (braceStart === -1 || (semi !== -1 && semi < braceStart)) return src.slice(at, semi + 1);
    let depth = 0, i = braceStart;
    for (; i < src.length; i++) {
        if (src[i] === '{') depth++;
        else if (src[i] === '}') { depth--; if (depth === 0) { i++; break; } }
    }
    return src.slice(at, i);
}

const dayOfSrc = extract('const dayOf', home);
const ddaySrc = extract('const dday', home);
const seasonDaysLeftSrc = extract('export function seasonDaysLeft', home).replace('export function', 'function');

function build(src, seasonLastDeadlineImpl) {
    // eslint-disable-next-line no-new-func
    return new Function('seasonLastDeadline', `
        ${dayOfSrc}
        ${ddaySrc}
        ${src}
        return seasonDaysLeft;
    `)(seasonLastDeadlineImpl);
}

check('a future deadline reads as the whole-day count', () => {
    const seasonDaysLeft = build(seasonDaysLeftSrc, () => '2026-09-20');
    assert.strictEqual(seasonDaysLeft({}, '2026-09-06'), 14);
});

check('a missing deadline (every line TBD or unset) reads as null, not zero or NaN', () => {
    assert.strictEqual(build(seasonDaysLeftSrc, () => '')({}, '2026-09-06'), null);
    assert.strictEqual(build(seasonDaysLeftSrc, () => undefined)({}, '2026-09-06'), null);
});

check('a deadline already in the past clamps to 0, never negative', () => {
    const seasonDaysLeft = build(seasonDaysLeftSrc, () => '2026-09-01');
    assert.strictEqual(seasonDaysLeft({}, '2026-09-06'), 0);
});

check('a deadline that falls today reads as 0', () => {
    const seasonDaysLeft = build(seasonDaysLeftSrc, () => '2026-09-06');
    assert.strictEqual(seasonDaysLeft({}, '2026-09-06'), 0);
});

check('THE CLAMP GATE CAN FAIL: without Math.max(0, …) a past deadline goes negative', () => {
    const brokenSrc = seasonDaysLeftSrc.replace('Math.max(0, dday(today, iso))', 'dday(today, iso)');
    assert.notStrictEqual(brokenSrc, seasonDaysLeftSrc, 'the clamp text has drifted — this proof no longer removes it');
    const broken = build(brokenSrc, () => '2026-09-01');
    assert.strictEqual(broken({}, '2026-09-06'), -5, 'the unclamped version should read negative — if it does not, this proof is vacuous');
});

check('the masthead label reads "announcements live", not "live now"', () => {
    assert.ok(home.includes("label: 'announcements live'"), '"announcements live" label is missing from the stats array');
    assert.ok(!home.includes("label: 'live now'"), '"live now" is still present — the rename did not remove the old label');
});

check('the two season-clock empty states name the next action', () => {
    assert.ok(/No season deadline set\.[^<]*<a href="#\/season">/.test(home), 'the "no deadline" empty state has no link to Season');
    assert.ok(/This season has ended\.[^<]*<a href="#\/season">/.test(home), 'the "season ended" empty state has no link to Season');
});

say(failures ? `\n✗ ${failures} failed` : '\n✅ homeDaysLeft: days-left computation, the announcements-live rename, and the season-clock empty states all check out');
process.exit(failures ? 1 : 0);
