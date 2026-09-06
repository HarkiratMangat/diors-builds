// portal/api/access.js
//
// Access realm \u2014 owner-only, exactly like /bot access (spec §8.2: "no column, no grantable scope"). NOT part of the core operation algebra: admin grants/revokes are direct AdminUser writes, same as they always have been through /bot access, and a live PortalSession end is a direct write too. gateCommit is still used for grant/revoke (tier 3 \u2014 irreversible in effect, since a grant is a real privilege change) so the same typed-confirmation control governs every tier-3 action.
const AdminUser = require('../../models/AdminUser');
const PortalSession = require('../../models/PortalSession');
const { isOwner, parsePermissionsInput, invalidateAdminCache, MANAGE_PAGE_SCOPES, ADMIN_COMMANDS, NOT_IN_ALL } = require('../../utils/adminAccess');
const { readJsonBody, sendJson, forbidden } = require('./httpUtil');

// Access grant/revoke reuses ONLY the typed-confirmation half of the tier-3 model, never the export leg -- gateCommit's exportedAt check has no meaning for a permission change (there is no data to export), and this review pass caught that the original code accepted `body.exportedAt` straight from the client, which would have let any caller satisfy that half of the gate by just sending a timestamp. A permission change has exactly one real safeguard: the admin must type the target's own Discord ID before it takes effect.
function confirmMatchesTarget(confirmText, discordId) {
    return typeof confirmText === 'string' && confirmText === discordId;
}

function ownerOnly(handler) {
    return async (req, res, url, session) => {
        if (!isOwner(session.discordId)) return forbidden(res, 'Access is owner-only.');
        return handler(req, res, url, session);
    };
}

// pin32 — the default embed avatar Discord assigns an account with no custom avatar image, computed the same way discord.js does for the new username system: (snowflake >> 22) % 6. Used only when the lookup below finds a real account with a null avatar hash, so the preview card never shows a broken image.
function defaultAvatarUrl(discordId) {
    const idx = Number((BigInt(discordId) >> 22n) % 6n);
    return `https://cdn.discordapp.com/embed/avatars/${idx}.png`;
}

// "By scope" \u2014 flags a scope held by exactly one non-owner (a single point of failure).
function singlePointsOfFailure(admins) {
    // ⚠️ A SET, NOT A LIST. `parsePermissionsInput` accepts "manage, manage.draws", and with the two effects below now both applying (they were mutually exclusive until 2026-08-24), that admin was pushed TWICE for manage.draws — so ids.length === 2 and the one scope they hold most explicitly was the one scope never reported as a single point. Deduping by id makes "how many people hold this" mean what it says.
    const holders = new Map(); // scope -> Set<discordId>
    for (const scope of [...ADMIN_COMMANDS, ...MANAGE_PAGE_SCOPES.map(p => `manage.${p}`)]) {
        holders.set(scope, new Set());
    }
    for (const admin of admins) {
        for (const perm of admin.permissions || []) {
            // 🔴 `manage` COUNTS AS ITSELF, not only as its expansion. This was an `else if`, so a bare `manage` recorded holders for the eight page scopes and never for `manage` -- leaving the token permanently at 0 holders and therefore never reportable, when a lone holder of the FULL token is the most consequential single point of failure there is: lose them and every page goes at once. Found 2026-08-24 rebuilding the Access mockup on the real permission model, where the page's own count disagreed with this endpoint's. Both effects now apply.
            if (holders.has(perm)) holders.get(perm).add(admin.discordId);
            if (perm === 'manage') {
                for (const p of MANAGE_PAGE_SCOPES) holders.get(`manage.${p}`)?.add(admin.discordId);
            }
        }
    }
    const spof = [];
    for (const [scope, ids] of holders) if (ids.size === 1) spof.push({ scope, discordId: [...ids][0] });
    return spof;
}

// Human-readable column labels for MANAGE_PAGE_SCOPES -- read from commands/manage.js's own content-picker choices (the real, already-shipped display names) rather than inventing new copy, per this repo's naming convention.
const PAGE_LABELS = {
    draws: 'Draws', calendar: 'Calendar', loadouts_mp: 'MP', loadouts_dmz: 'DMZ',
    patchnotes: 'Patch Notes', seasondraft: 'Season Draft', season: 'Season', announcement: 'Announcement',
};
const COMMAND_LABELS = { manage: 'Manage', autobuild: 'Autobuild', bot: 'Bot' };

// Gap audit §3.2: the permission-grid data this needs already exists (getAdminPermissionsMap, MANAGE_PAGE_SCOPES) -- this reuses the EXACT same scope enumeration singlePointsOfFailure() above already established, rather than a second list that could drift from it. Shaped for a grid component directly (rows=admins, columns=scopes), not a raw dump of AdminUser docs.
function buildPermissionMatrix(admins) {
    // The realm a scope governs travels with it, so the grid's column colour is a fact from the permission model rather than a palette the UI invented. Required lazily for the same reason auth.js does it: these three modules register routes of their own and requiring them at load time would make the import order load-bearing.
    const { realmForScope } = require('./realmAccess');
    const pageLists = {
        SEASON_PAGES: require('./season').SEASON_PAGES,
        ARMORY_PAGES: require('./armory').ARMORY_PAGES,
        BROADCAST_PAGES: require('./broadcast').BROADCAST_PAGES,
    };
    const scopes = [
        // 🔴 `ownerOnly` WAS NEVER EMITTED HERE, SO THE GRID'S LOCK EXISTED ONLY IN THE HARNESS. Three sites in access.js gate the 🔒 on this field and the realm key names it unconditionally -- against a scope list that has never carried it. The fixture does (`assets/fixtures.js` sets it on `destructive`), which is exactly why every instrument in the conformance pass reported the mark as present: they all read the harness. On the real server the legend named a mark the page could not draw. ⚠️ IT IS DERIVED FROM `NOT_IN_ALL`, NOT RESTATED. That constant is what makes `destructive` owner-only in the bot -- the one token the `all` shorthand refuses to expand into -- so the mark and the rule cannot drift apart. Hardcoding `key === 'destructive'` here would be a second source of truth for a list that already exists.
        ...ADMIN_COMMANDS.map((key) => ({ key, label: COMMAND_LABELS[key] || key, kind: 'command', ownerOnly: NOT_IN_ALL.includes(key), realm: realmForScope(key, pageLists) })),
        ...MANAGE_PAGE_SCOPES.map((page) => ({ key: `manage.${page}`, label: PAGE_LABELS[page] || page, kind: 'page', ownerOnly: false, realm: realmForScope(`manage.${page}`, pageLists) })),
    ];
    const rows = admins.map((admin) => {
        const perms = admin.permissions || [];
        const grants = {};
        for (const scope of scopes) {
            // 🔴 DIRECT vs INHERITED is the whole reason a grid beats the comma-separated string it replaces, and the original shape collapsed them into one boolean. A bare `manage` token lights every page column -- but you did not hand those pages over individually, and revoking `manage` takes all of them back at once. 06-access-and-analytics.html renders the two differently for exactly that reason, and its own legend spells it out: "granted directly / inherited — bare manage covers every page."
            const direct = perms.includes(scope.key);
            const inherited = scope.kind === 'page' && !direct && perms.includes('manage');
            grants[scope.key] = { direct, inherited, held: direct || inherited };
        }
        // ⚠️ `grantedAt` IS STORED. models/AdminUser.js has declared `grantedAt: { type: Date, default: Date.now }` since 566b3ca (2026-08-13) and every live document carries one -- this comment previously asserted the model "has no timestamp at all", which was already ten days stale when it was written, and the derivation below silently discarded the real value. The ObjectId fallback is kept for a document written before the field existed, but it is a FALLBACK: an ObjectId's embedded timestamp is the DOCUMENT's creation and never moves when permissions are later edited, so it answers a different question than "when was this granted".
        const grantedAt = admin.grantedAt
            ? new Date(admin.grantedAt)
            : (admin._id ? new Date(parseInt(String(admin._id).slice(0, 8), 16) * 1000) : null);
        return { discordId: admin.discordId, grants, permissions: perms, grantedBy: admin.grantedBy || null, note: admin.note || '', grantedAt };
    });
    return { admins: rows, scopes };
}

function register(route) {
    const { requireAdmin } = require('../auth');

    route('GET', /^\/api\/access$/, requireAdmin(ownerOnly(async (req, res) => {
        // 🔴 THE OWNER IS NEVER A ROW, AND EVERY FIGURE ON THE SCREEN HAS TO AGREE ABOUT THAT. The grid draws a synthetic owner row and filters the owner out of the real ones, so an owner who also held an AdminUser document would vanish from the table while still being counted by the masthead, the view meta, every column header, the export and singlePointsOfFailure -- which would then report the OWNER as the sole holder and render "single point — only …2283 besides you", naming you as somebody besides you. One filter at the source is what keeps the six numbers in step; six filters at the call sites is how they drift.
        const admins = (await AdminUser.find({}).lean()).filter((a) => !isOwner(a.discordId));
        const sessions = await PortalSession.find({ revokedAt: null }).sort({ lastSeenAt: -1 }).lean();
        sendJson(res, 200, { admins, sessions, sessionTtlHours: PortalSession.SESSION_TTL_SECONDS / 3600, singlePointsOfFailure: singlePointsOfFailure(admins) });
    })));

    route('GET', /^\/api\/access\/matrix$/, requireAdmin(ownerOnly(async (req, res) => {
        const admins = (await AdminUser.find({}).lean()).filter((a) => !isOwner(a.discordId));
        sendJson(res, 200, buildPermissionMatrix(admins));
    })));

    // 🔴 THE PERMISSION MODEL HAD NO WAY OUT OF THE PORTAL, which is the one realm where that matters most: a grant is not derivable from anything else, `AdminUser` is the only record of who can do what, and the page that shows it is owner-only. ⚠️ The matrix goes out as CSV because it IS a grid -- prose would flatten the direct-vs-inherited distinction that is the entire reason the grid beats a comma-separated string.
    route('GET', /^\/api\/access\/export$/, requireAdmin(ownerOnly(async (req, res, url) => {
        const { toCsv } = require('./analytics');
        const scope = url.searchParams.get('scope');
        const admins = await AdminUser.find({}).lean();
        const day = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '—');
        if (scope === 'admins') {
            const text = admins.map(a => [
                a.discordId + (a.note ? `  (${a.note})` : ''),
                `granted ${day(a.grantedAt)} by ${a.grantedBy}`,
                (a.permissions || []).join(', ') || '(none)',
            ].join('\n')).join('\n\n');
            return sendJson(res, 200, { text, count: admins.length });
        }
        if (scope === 'matrix') {
            const m = buildPermissionMatrix(admins);
            // A cell says what it IS, not merely whether it is on: "direct" and "inherited" are different facts, and a boolean grid would be the string this page exists to replace. ⚠️ THE SHAPE IS `{admins:[{discordId, grants:{key:{direct,inherited}}}], scopes:[{key,label}]}` -- read off buildPermissionMatrix rather than guessed. A first draft here reached for a top-level `m.grants[id]` that does not exist, which would have written a CSV of empty cells: a well-formed file asserting that nobody holds anything.
            const cols = [
                { label: 'Admin', get: (r) => r.discordId },
                { label: 'Note', get: (r) => r.note },
                ...(m.scopes || []).map((sc) => ({
                    label: sc.label || sc.key,
                    get: (r) => { const v = (r.grants || {})[sc.key] || {}; return v.direct ? 'direct' : v.inherited ? 'inherited' : ''; },
                })),
            ];
            const rows = m.admins || [];
            return sendJson(res, 200, { text: toCsv(rows, cols), count: rows.length });
        }
        if (scope === 'sessions') {
            const sessions = await PortalSession.find({ revokedAt: null }).sort({ lastSeenAt: -1 }).lean();
            const cols = [
                { label: 'Admin', get: (r) => r.discordId },
                { label: 'Signed in', get: (r) => r.createdAt },
                { label: 'Last seen', get: (r) => r.lastSeenAt },
                { label: 'Expires', get: (r) => r.expiresAt },
            ];
            return sendJson(res, 200, { text: toCsv(sessions, cols), count: sessions.length });
        }
        return sendJson(res, 400, { error: 'export needs one of: admins, matrix, sessions' });
    })));

    route('POST', /^\/api\/access\/grant$/, requireAdmin(ownerOnly(async (req, res, url, session) => {
        const body = await readJsonBody(req);
        const permissions = parsePermissionsInput((body.permissions || []).join(','));
        if (!permissions) return sendJson(res, 400, { error: 'One or more permission tokens were not recognized.' });
        // Granting to the owner is a no-op the screen cannot represent: they short-circuit every check already, and the grid has no row for them because the owner row is synthetic. Refusing is simpler than rendering a state that means nothing, and it stops the filter above from ever having to hide a document somebody just wrote.
        if (isOwner(body.discordId)) {
            return sendJson(res, 409, { ok: false, reason: 'The owner already holds every permission — there is nothing to grant.' });
        }
        if (!confirmMatchesTarget(body.confirmText, body.discordId)) {
            return sendJson(res, 409, { ok: false, reason: 'Type the exact Discord ID being granted to confirm.' });
        }

        await AdminUser.findOneAndUpdate(
            { discordId: body.discordId },
            { discordId: body.discordId, grantedBy: session.discordId, permissions, note: body.note || '' },
            { upsert: true, new: true }
        );
        invalidateAdminCache();
        sendJson(res, 200, { ok: true });
    })));

    route('POST', /^\/api\/access\/revoke$/, requireAdmin(ownerOnly(async (req, res, url, session) => {
        const body = await readJsonBody(req);
        if (!confirmMatchesTarget(body.confirmText, body.discordId)) {
            return sendJson(res, 409, { ok: false, reason: 'Type the exact Discord ID being revoked to confirm.' });
        }
        await AdminUser.deleteOne({ discordId: body.discordId });
        invalidateAdminCache();
        sendJson(res, 200, { ok: true });
    })));

    // Ending a live session is NOT tier 3 \u2014 it costs the signed-in device a re-login, nothing irreversible. The spec's H8/§8.2 calls this out as something the bot itself cannot do at all (revoking an admin in Discord does not kill a browser session).
    route('POST', /^\/api\/access\/session\/end$/, requireAdmin(ownerOnly(async (req, res) => {
        const body = await readJsonBody(req);
        await PortalSession.updateOne({ sessionHash: body.sessionHash }, { revokedAt: new Date() });
        sendJson(res, 200, { ok: true });
    })));

    // pin32 — resolves a typed Discord id against the bot's own Discord access BEFORE the Grant drawer will let an admin submit it, so a typo or a nonexistent account is caught before it becomes an unreachable AdminUser row. Owner-only, same as every other Access route: the grant form is only ever reachable from this page. ⚠️ NEVER THROWS TO THE CLIENT — a network failure or a Discord rate limit is exactly as recoverable as a "no such user" from the drawer's point of view, so all three come back as `{ ok:false, reason }` on a 200 rather than as a 5xx the drawer has no branch for.
    route('GET', /^\/api\/discord\/user$/, requireAdmin(ownerOnly(async (req, res, url) => {
        const id = String(url.searchParams.get('id') || '').trim();
        if (!/^\d{17,20}$/.test(id)) return sendJson(res, 200, { ok: false, reason: 'That is not a Discord id — 17 to 20 digits.' });
        let discordRes;
        try {
            discordRes = await fetch(`https://discord.com/api/v10/users/${id}`, {
                headers: { authorization: `Bot ${process.env.BOT_TOKEN}` },
            });
        } catch (e) {
            return sendJson(res, 200, { ok: false, reason: 'Could not reach Discord — try again in a moment.' });
        }
        if (discordRes.status === 404) return sendJson(res, 200, { ok: false, reason: 'No Discord user has that id.' });
        if (discordRes.status === 429) return sendJson(res, 200, { ok: false, reason: 'Discord is rate-limiting lookups right now — wait a moment and try again.' });
        if (!discordRes.ok) return sendJson(res, 200, { ok: false, reason: `Discord returned ${discordRes.status} — try again.` });
        let user;
        try { user = await discordRes.json(); } catch (e) { return sendJson(res, 200, { ok: false, reason: 'Discord sent back something unreadable.' }); }
        const avatarUrl = user.avatar
            ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=64`
            : defaultAvatarUrl(user.id);
        sendJson(res, 200, { id: user.id, username: user.username, globalName: user.global_name || null, avatarUrl });
    })));
}

module.exports = { register, singlePointsOfFailure, buildPermissionMatrix };
