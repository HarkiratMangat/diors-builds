// portal/ui/access.logic.js — CommonJS + classic script. The pure half of the Access realm.

// What an admin's stored permission list becomes after a set of grid toggles. `pending` is { scopeKey: true | false }.
//
// 🔴 A SET, BECAUSE THE LIST IS A SET AND MONGO DOES NOT KNOW THAT. models/AdminUser.js stores `permissions` as a plain array and parsePermissionsInput accepts "manage, manage.draws" — so a token can already appear twice in a live document, and adding one with `.concat()` would make it appear three times. Every duplicate is invisible in the grid (the cell is on either way) and permanent.
//
// ⚠️ IT DOES NOT EXPAND `manage`. A bare manage token INHERITS every page, and the grid renders that as a distinct cell state precisely so the two are not confused — turning an inherited page off has to mean revoking manage, which is a different act, so the caller refuses that click rather than quietly rewriting the token into eight explicit ones.
function permsAfter(permissions, pending) {
    const next = new Set(permissions || []);
    for (const [scope, on] of Object.entries(pending || {})) {
        if (on) next.add(scope);
        else next.delete(scope);
    }
    return [...next];
}

// What the grid is about to change, in words, so the confirmation names the acts rather than a count.
function describePending(pending, labelOf) {
    const granted = [], revoked = [];
    for (const [scope, on] of Object.entries(pending || {})) {
        (on ? granted : revoked).push(labelOf ? labelOf(scope) : scope);
    }
    return { granted: granted.sort(), revoked: revoked.sort() };
}

// 🔴 EVERY SESSION READ "LIVE", INCLUDING ONE LAST SEEN YESTERDAY. The Access table stamped the literal string `'live'` on every row, so the panel whose entire job is telling an owner who is signed in right now could not distinguish a tab open two minutes ago from one abandoned five hours back. A browser session has no logout event unless somebody clicks one — "signed in now" is DERIVED or it is a guess.
//
// ⚠️ FIFTEEN MINUTES IS THE PING WINDOW, not a preference. A session row's `lastSeenAt` is refreshed by the portal's own requests; a tab left open keeps touching it and a closed one stops. Anything much shorter calls a reading tab dead, and anything much longer calls a closed one alive.
const SESSION_LIVE_MS = 15 * 60 * 1000;

function sessionIsLive(session, now) {
    if (!session || !session.lastSeenAt) return false;
    const seen = new Date(session.lastSeenAt).getTime();
    if (!Number.isFinite(seen)) return false;
    // A clock skew that puts lastSeenAt in the FUTURE must read as live, not as a large negative age that trips the window.
    return (now - seen) < SESSION_LIVE_MS;
}

function sessionSummary(sessions, now) {
    const list = sessions || [];
    if (!list.length) return 'none';
    return `${list.filter((s) => sessionIsLive(s, now)).length} active · ${list.length} total`;
}

// pin32/harden — what decides whether the Grant drawer's own button may fire, and — when it may not — which SINGLE fact is missing. Pure on purpose: the drawer layers three independent gates (a resolved Discord lookup, at least one permission picked, the typed id matching), and a reader should see the first one still open rather than a plain "disabled" with no reason. Kept here rather than inline in access.js so it can be unit-tested with no DOM (scripts/portalSession.test.js) — the same reasoning permsAfter/ describePending above already follow.
function grantReady({ discordId, lookupStatus, pickedCount, confirmText }) {
    if (!discordId) return { ready: false, why: 'Enter a Discord ID.' };
    // Silent while loading and on a failed lookup (2026-09-06 09:15 EDT): the drawer's own .dw-p line already says both, and two regions saying one thing makes a reader reconcile them. The reason line speaks only for what the reader still has to DO.
    if (lookupStatus === 'loading') return { ready: false, why: '' };
    if (lookupStatus === 'error') return { ready: false, why: '' };
    if (lookupStatus !== 'ok') return { ready: false, why: 'Enter a Discord ID.' };
    if (!pickedCount) return { ready: false, why: 'Pick at least one permission.' };
    if (confirmText !== discordId) return { ready: false, why: 'Type the same id again to confirm.' };
    return { ready: true, why: '' };
}

if (typeof module !== 'undefined' && module.exports) module.exports = { permsAfter, describePending, sessionIsLive, sessionSummary, SESSION_LIVE_MS, grantReady };
