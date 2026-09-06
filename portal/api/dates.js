// portal/api/dates.js
//
// 🔴 A DATE PICKER, IN A PORTAL FOR A BOT THAT HAS UNDERSTOOD "in 3 weeks" FOR A YEAR. `chrono-node` is already a dependency and `parseAdminDate()` is already how every admin date reaches this database — /manage has taken typed dates since it was built. The portal was the one surface that made you click through a calendar instead.
//
// 🔴 AND THE PARSING HAPPENS HERE, NOT IN THE BROWSER, WHICH IS THE WHOLE POINT. Shipping a second parser to the client would put two implementations behind one promise: the portal would show you what ITS parser resolved, the server would store what CHRONO resolved, and the day they disagreed the preview would be a lie about the thing being saved. `parseAdminDate` has a documented timezone subtlety of its own — it passes `{ timezone: 0 }` so the host machine's clock cannot shift a date across a day boundary — and a browser reimplementation would have to reproduce that correctly, forever, in a place nobody would think to check.
//
// ⚠️ It returns the ISO DAY, never a timestamp: `parseAdminDate` normalizes to midnight UTC because these are date-only records, and handing the client a time would invite it to render one.
const { parseAdminDate: chronoParse, parseItemLine } = require('../../utils/adminParser');
const { sendJson, readJsonBody } = require('./httpUtil');

function register(route) {
    const { requireAdmin } = require('../auth');

    // GET /api/parse-date?q=in+3+weeks -> { q, iso } — iso is null when nothing parsed, which the composer renders as "not a date yet" rather than falling back to today. A silent fallback to now is the exact defect parseAdminDate's own comment records: a typo landed on the current instant and read as a real, intentional date.
    route('GET', /^\/api\/parse-date$/, requireAdmin(async (req, res, url) => {
        const q = url.searchParams.get('q') || '';
        if (q.length > 200) return sendJson(res, 400, { error: 'that is not a date' });
        const parsed = q.trim() ? chronoParse(q) : null;
        sendJson(res, 200, { q, iso: parsed ? parsed.toISOString().slice(0, 10) : null });
    }));

    // POST /api/parse-items { text } -> { items: [{ tier, name }], errors: [] }
    //
    // 🔴 THE BOT'S OWN SHORTHAND PARSER, FOR THE SAME REASON THE DATE IS PARSED HERE. `/manage`'s add-draw
    // modal has taken an items list as one-per-line shorthand since it was built — "m Character", "l Gun",
    // "-# a note" — and `parseItemLine` is the single implementation of that grammar, including the trap
    // already paid for there: a `-#` comment line must be matched BEFORE the tier-shorthand branch, or the
    // comment text is title-cased and stored under a nonsense tier. A browser copy would preview tiers the
    // bot then resolves differently, which is the one thing a preview must not do.
    //
    // ⚠️ A LINE IT COULD NOT READ IS REPORTED, NEVER DROPPED — same contract as /api/parse-bulk. The only
    // unreadable line is one that leaves no name behind, since resolveTier falls back to `epic` rather than
    // failing, so `errors` carries the line number and the text as typed.
    route('POST', /^\/api\/parse-items$/, requireAdmin(async (req, res) => {
        const body = await readJsonBody(req);
        const text = String(body.text || '');
        if (text.length > 8000) return sendJson(res, 400, { error: 'that is more items than a draw has' });
        const items = [];
        const errors = [];
        text.split('\n').forEach((raw, i) => {
            const line = raw.trim();
            if (!line) return;
            const parsed = parseItemLine(line);
            if (!parsed || !String(parsed.name || '').trim()) { errors.push({ line: i + 1, text: line }); return; }
            items.push({ tier: parsed.tier, name: parsed.name });
        });
        sendJson(res, 200, { items, errors });
    }));
}

module.exports = { register };
