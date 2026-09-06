// scripts/portalSession.test.js — Access realm, Unit D. Three things with no DOM and no network: sessionFor() carrying the new identity fields, the /api/discord/user route's shape for found/not-found/ bad-id, and the Grant drawer's own readiness rule (access.logic.js's grantReady). Runs with no real Mongo or Discord: models/PortalSession and the global fetch are stubbed, matching the require.cache pattern scripts/botAccessPermissions.test.js already uses for a Mongo-backed module.
const assert = require('assert');

let failures = 0;
async function check(name, fn) {
    try { await fn(); console.log(`  ✓ ${name}`); }
    catch (e) { failures++; console.error(`  ✗ ${name}\n      ${e.message}`); }
}

async function run() {
    console.log('Access realm — sessions, Discord lookup, grant readiness\n');

    // ---- stub BOTH Mongo-backed modules BEFORE anything requires portal/auth or portal/api/access ------- ⚠️ Order matters: portal/auth.js destructures {isAdmin, isOwner, hasCommandAccess} from utils/adminAccess at REQUIRE time, so overwriting require.cache AFTER auth.js has already loaded (e.g. via an earlier require of portal/auth) leaves auth.js's own closures pointing at the real, DB-backed functions — which is exactly what timed out the first version of this file (real AdminUser.find() with no Mongo connection). Both stubs go in before the first require of either module.
    const portalSessionPath = require.resolve('../models/PortalSession');
    let fakeRow = null;
    require.cache[portalSessionPath] = {
        id: portalSessionPath, filename: portalSessionPath, loaded: true, exports: Object.assign(
            {
                findOne: () => ({ lean: async () => fakeRow }),
                updateOne: async () => ({}),
            },
            { SESSION_TTL_SECONDS: 12 * 60 * 60 },
        ),
    };
    const adminAccessPath = require.resolve('../utils/adminAccess');
    require.cache[adminAccessPath] = {
        id: adminAccessPath, filename: adminAccessPath, loaded: true, exports: {
            isAdmin: async () => true, isOwner: () => true, hasCommandAccess: async () => true,
            parsePermissionsInput: () => null, invalidateAdminCache: () => {},
            MANAGE_PAGE_SCOPES: [], ADMIN_COMMANDS: [], NOT_IN_ALL: [],
        },
    };
    const { sessionFor } = require('../portal/auth');

    await check('sessionFor() returns username/globalName/avatarHash when the row has them', async () => {
        fakeRow = {
            discordId: '111111111111111111', lastSeenAt: new Date(), createdAt: new Date(),
            username: 'diorswrld', globalName: 'Dior', avatarHash: 'abc123',
        };
        const session = await sessionFor({ headers: { cookie: 'portal_session=whatever' } });
        assert.strictEqual(session.username, 'diorswrld');
        assert.strictEqual(session.globalName, 'Dior');
        assert.strictEqual(session.avatarHash, 'abc123');
    });

    await check('sessionFor() falls back to empty/null rather than undefined for a row written before these fields existed', async () => {
        fakeRow = { discordId: '222222222222222222', lastSeenAt: new Date(), createdAt: new Date() };
        const session = await sessionFor({ headers: { cookie: 'portal_session=whatever' } });
        assert.strictEqual(session.username, '');
        assert.strictEqual(session.globalName, '');
        assert.strictEqual(session.avatarHash, null);
    });

    // ---- GET /api/discord/user's shape ------------------------------------------------------------------- requireAdmin/ownerOnly both need a real admin, and both are already satisfied by the stubs above; only the DOOR session row (PortalSession.findOne) needs a fresh value for this section's requests.
    fakeRow = { discordId: '333333333333333333', lastSeenAt: new Date(), createdAt: new Date() };

    const routes = [];
    const route = (method, pattern, handler) => routes.push({ method, pattern, handler });
    require('../portal/api/access').register(route);
    const discordUserRoute = routes.find((r) => r.method === 'GET' && r.pattern.test('/api/discord/user'));
    assert.ok(discordUserRoute, 'GET /api/discord/user must be registered');

    // method:'GET' matters — requireAdmin only skips its CSRF check for a GET, and a plain object with no method reads as `undefined !== 'GET'`, which failed every case here with a 403 CSRF error before this.
    function fakeReq() { return { method: 'GET', headers: { cookie: 'portal_session=whatever' } }; }
    function fakeRes() {
        const res = { statusCode: null, body: null };
        res.writeHead = (code) => { res.statusCode = code; };
        res.end = (text) => { res.body = JSON.parse(text); };
        return res;
    }
    function fakeUrl(id) { return { searchParams: new URLSearchParams(id === undefined ? '' : `id=${id}`) }; }

    await check('a bad id (not 17-20 digits) is refused without ever calling Discord', async () => {
        const originalFetch = global.fetch;
        global.fetch = async () => { throw new Error('must not call Discord for a malformed id'); };
        try {
            const res = fakeRes();
            await discordUserRoute.handler(fakeReq(), res, fakeUrl('123'));
            assert.strictEqual(res.body.ok, false);
            assert.ok(/17 to 20 digits/.test(res.body.reason));
        } finally { global.fetch = originalFetch; }
    });

    await check('a 404 from Discord becomes {ok:false, reason} on a 200, never a thrown error', async () => {
        const originalFetch = global.fetch;
        global.fetch = async () => ({ status: 404, ok: false });
        try {
            const res = fakeRes();
            await discordUserRoute.handler(fakeReq(), res, fakeUrl('444444444444444444'));
            assert.strictEqual(res.statusCode, 200);
            assert.strictEqual(res.body.ok, false);
            assert.ok(/No Discord user/.test(res.body.reason));
        } finally { global.fetch = originalFetch; }
    });

    await check('a network failure reaching Discord returns a reason rather than throwing', async () => {
        const originalFetch = global.fetch;
        global.fetch = async () => { throw new Error('ECONNRESET'); };
        try {
            const res = fakeRes();
            await discordUserRoute.handler(fakeReq(), res, fakeUrl('555555555555555555'));
            assert.strictEqual(res.body.ok, false);
            assert.ok(/Could not reach Discord/.test(res.body.reason));
        } finally { global.fetch = originalFetch; }
    });

    await check('a found user with an avatar returns id/username/globalName/avatarUrl, no ok flag needed', async () => {
        const originalFetch = global.fetch;
        global.fetch = async () => ({
            status: 200, ok: true,
            json: async () => ({ id: '666666666666666666', username: 'diorswrld', global_name: 'Dior', avatar: 'de36d1994e834cd75ac0b7bc3b66a6db' }),
        });
        try {
            const res = fakeRes();
            await discordUserRoute.handler(fakeReq(), res, fakeUrl('666666666666666666'));
            assert.strictEqual(res.body.id, '666666666666666666');
            assert.strictEqual(res.body.username, 'diorswrld');
            assert.strictEqual(res.body.globalName, 'Dior');
            assert.strictEqual(res.body.avatarUrl, 'https://cdn.discordapp.com/avatars/666666666666666666/de36d1994e834cd75ac0b7bc3b66a6db.png?size=64');
        } finally { global.fetch = originalFetch; }
    });

    await check('a found user with NO avatar gets the default embed avatar, not a broken url', async () => {
        const originalFetch = global.fetch;
        global.fetch = async () => ({
            status: 200, ok: true,
            json: async () => ({ id: '777777777777777777', username: 'noavatar', global_name: null, avatar: null }),
        });
        try {
            const res = fakeRes();
            await discordUserRoute.handler(fakeReq(), res, fakeUrl('777777777777777777'));
            assert.ok(res.body.avatarUrl.startsWith('https://cdn.discordapp.com/embed/avatars/'));
            assert.strictEqual(res.body.globalName, null);
        } finally { global.fetch = originalFetch; }
    });

    // ---- grantReady() — the drawer's own logic, no DOM -----------------------------------------------------
    const { grantReady } = require('../portal/ui/access.logic');

    await check('an empty id asks for an id, before anything else is even checked', () => {
        assert.deepStrictEqual(grantReady({ discordId: '', lookupStatus: 'idle', pickedCount: 0, confirmText: '' }),
            { ready: false, why: 'Enter a Discord ID.' });
    });

    await check('a resolved id with nothing picked names the permission gate, not the confirm gate', () => {
        const r = grantReady({ discordId: '111111111111111111', lookupStatus: 'ok', pickedCount: 0, confirmText: '' });
        assert.strictEqual(r.ready, false);
        assert.ok(/at least one permission/.test(r.why));
    });

    await check('permissions picked but the confirm text does not match yet', () => {
        const r = grantReady({ discordId: '111111111111111111', lookupStatus: 'ok', pickedCount: 2, confirmText: 'wrong' });
        assert.strictEqual(r.ready, false);
        assert.ok(/Type the same id/.test(r.why));
    });

    await check('lookup still loading blocks Grant even if the confirm text already matches', () => {
        const r = grantReady({ discordId: '111111111111111111', lookupStatus: 'loading', pickedCount: 1, confirmText: '111111111111111111' });
        assert.strictEqual(r.ready, false);
        // silent on purpose since 2026-09-06 09:16 EDT: the drawer's .dw-p line says "Looking that id up…"; a second copy in the reason line made a reader reconcile two regions
        assert.strictEqual(r.why, '');
    });

    await check('a failed lookup blocks Grant without restating the .dw-p reason', () => {
        const r = grantReady({ discordId: '111111111111111111', lookupStatus: 'error', pickedCount: 1, confirmText: '111111111111111111' });
        assert.strictEqual(r.ready, false);
        assert.strictEqual(r.why, '');   // the server's own reason is in .dw-p; the reason line does not restate it
    });

    await check('lookup ok + a permission + a matching confirm is the only ready state', () => {
        const r = grantReady({ discordId: '111111111111111111', lookupStatus: 'ok', pickedCount: 1, confirmText: '111111111111111111' });
        assert.deepStrictEqual(r, { ready: true, why: '' });
    });
}

run().then(() => process.exit(failures ? 1 : 0));
