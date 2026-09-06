// portal/ui/composer.logic.js — CommonJS + classic script. The pure half of the in-page composer.

// 🔴 THE REASON, NOT A BOOLEAN. A disabled Stage button that will not say why is a dead end: you are looking at a form with four fields and no indication which one is holding it. This returns the sentence the composer prints beside the button, and `null` when there is nothing standing in the way — so "is it ready" and "why not" are one answer rather than two that can disagree.
function composerReason(state, type) {
    if (!type) return 'Pick what you are adding.';
    if (!String(state.name || '').trim()) return 'Give it a name.';
    if (!state.aIso) {
        // An unparsed value is a DIFFERENT failure from an empty one, and saying so is the whole point of parsing as you type: "not a date yet" tells you the field is being read and rejected, where "set a date" reads as though you had not typed anything.
        return String(state.aText || '').trim() ? 'That first date does not resolve to a day yet.' : 'Set a date.';
    }
    if (type.shape === 'span') {
        if (!state.bIso) return String(state.bText || '').trim() ? 'That second date does not resolve to a day yet.' : 'Set a closing date.';
        if (state.bIso < state.aIso) return 'It closes before it opens.';
    }
    // 🔴 A DRAW'S SECOND DATE IS OPTIONAL AND IS NOT THE DRAW'S OWN. `newDraws[].date` is the only date the
    // draw record has (models/SeasonalData.js), so a closing date here does not go on the draw at all — it
    // stages a SECOND op, a calendar row with category 'Draw', which is what a draw window has always been.
    // Blank is therefore a complete answer and must not read as an unfinished one; only a typed value that
    // does not resolve, or one that closes before the release, can hold the button.
    if (type.windowable) {
        const typed = String(state.bText || '').trim();
        if (typed && !state.bIso) return 'That closing date does not resolve to a day yet.';
        if (state.bIso && state.bIso < state.aIso) return 'The window closes before the draw releases.';
    }
    return null;
}

// The patch-note image slots, exactly as /manage splits them: the first five URLs are slot 1 and the next
// five slot 2 (commands/manage.js's buildPatchAddSeasonModal collects two paragraph fields for the same
// reason). One textarea rather than two, because a reader pasting ten links should not have to count to five
// — the split is arithmetic, and arithmetic belongs on this side of the form.
function splitPatchUrls(text) {
    const urls = String(text || '').split('\n').map((u) => u.trim()).filter(Boolean);
    return { urls1: urls.slice(0, 5), urls2: urls.slice(5, 10), over: Math.max(0, urls.length - 10) };
}

// What the composer hands its caller. Deliberately the SAME field names the existing buildSeasonAddOp already takes, so the composer replaces a form rather than introducing a second vocabulary for the same act.
function composerFields(state, type) {
    const title = state.name.trim();
    // An event's Double CP mark is a real stored field (`calendar[].isDoubleCP`), not a label — /calendar
    // renders it, so it has to reach the payload rather than the title.
    if (type.shape === 'span') return { title, startDate: state.aIso, endDate: state.bIso, isDoubleCP: !!state.doubleCP };
    // A patch note is a point whose OTHER fields are the whole of it. buildSeasonAddOp used to hardcode an
    // empty description and two empty URL slots, so the one control on this page that could create a
    // publication created an empty one — /manage was the only place the content could be written.
    if (type.key === 'patchnote') {
        const { urls1, urls2 } = splitPatchUrls(state.urls);
        return { title, startDate: '', endDate: state.aIso, description: String(state.description || '').trim(), urls1, urls2 };
    }
    // A point has one date, and it is the END date: a draw's schema field is `date` and buildSeasonAddOp reads it from `endDate`. Putting it in `startDate` would stage a draw with no date at all.
    const fields = { title, startDate: '', endDate: state.aIso };
    if (type.windowable) {
        // ⚠️ THE NOTE IS AN ITEM, NOT A FIELD, and that is the bot's own shape rather than a shortcut:
        // utils/adminParser.js's parseItemLine returns exactly {tier:'comment', name} for a "-# …" line and
        // core/ops/draws.js stores it in the same `items` array. Giving the note its own payload key would
        // invent a second place for a thing the record already has one place for.
        const note = String(state.note || '').trim();
        fields.items = [...(state.itemRows || []), ...(note ? [{ tier: 'comment', name: note }] : [])];
        const thumb = String(state.thumb || '').trim();
        if (thumb) fields.thumbnailUrl = thumb;
        // The window is reported separately from the draw's own date: buildSeasonAddOps turns it into the
        // second op, and a builder that returns one op must never see it as part of the first.
        if (state.bIso) fields.windowEnd = state.bIso;
    }
    return fields;
}

// 🔴 THE GHOST'S PAYLOAD IS DERIVED HERE so it can be tested in Node — the component that draws it is ESM the browser loads and Node cannot require, which is the same reason every other .logic.js sibling exists.
//
// ⚠️ IT REPORTS THE RESOLVED ISO, NEVER THE TYPED TEXT. `aText` is only what the field shows, so a repaint does not discard half-typed words; `aIso` is what the bot's own parser returned over HTTP. A ghost placed from raw text would slide around the axis while somebody types "sep" on the way to "sep 21", and would land on a day nobody chose.
//
// ⚠️ A POINT'S END IS ITS START. A draw has one date and no end — the record has no second field — so an end derived from an empty `bIso` has to collapse onto the start rather than become today, or NaN, or a bar the record cannot have.
function composeGhostFor(state, type) {
    if (!state || !state.type || !state.aIso) return null;
    const shape = type ? type.shape : 'point';
    return {
        lane: state.type,
        name: state.name || '',
        start: state.aIso,
        end: shape === 'point' ? state.aIso : (state.bIso || state.aIso),
        shape,
    };
}

if (typeof module !== 'undefined' && module.exports) module.exports = { composerReason, composerFields, composeGhostFor, splitPatchUrls };
