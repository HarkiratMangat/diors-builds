---
kind: reference
status: live
---

# The dev portal's launchd agents — this Mac's answer to the VM's systemd units

*Written 2026-09-05 11:21 EDT. The prod portal runs on the GCP VM under systemd as `dioreo-portal` + `cloudflared`; `docs/reference/deployment-and-ops.md` documents those. **These two agents are the same arrangement on Harkirat's Mac**, for `dev-portal.dioreo.app`.*

🔴 **THE COPIES HERE ARE THE TRACKED ONES; the live copies are in `~/Library/LaunchAgents/`, with `$HOME` expanded.** They are tracked for the same reason `scripts/cloudflared-dev-config.yml` is: a machine-local file that nothing in the repo records is a machine-local file that cannot be rebuilt. Edit here, then install.

| Agent | Runs | Why it is its own unit |
|---|---|---|
| `app.dioreo.dev-portal` | `node --env-file=.env.dev portal/server.js` in the repo, on `127.0.0.1:8787` | A portal crash must not take down the tunnel |
| `app.dioreo.dev-tunnel` | `cloudflared --config ~/.cloudflared/dioreo-dev.yml tunnel run` | The tunnel dying must take down only REACHABILITY, never the server. **Prod separates them for exactly this reason** and the split is deliberate here too |

⚠️ **NEITHER RUNS THE DEV BOT.** The bot is a separate process (`node --watch --env-file=.env.dev index.js`) and is deliberately not a standing agent: it signs into Discord as a live application, and an unattended 24/7 login is a different decision from serving a local port. The portal does not need it — **they meet at the database, not at the process.** Both read `mongodb://localhost:27017/diors-builds-dev`, so a portal edit is visible to the bot the moment the bot next reads, running or not.

## Install

```bash
mkdir -p ~/Library/Logs/dioreo   # launchd does NOT create it, and an agent whose log path is missing starts and writes nothing
cp scripts/launchd/*.plist ~/Library/LaunchAgents/
sed -i "" "s|\$HOME|$HOME|g" ~/Library/LaunchAgents/app.dioreo.dev-*.plist
launchctl bootstrap "gui/$(id -u)" ~/Library/LaunchAgents/app.dioreo.dev-portal.plist
launchctl bootstrap "gui/$(id -u)" ~/Library/LaunchAgents/app.dioreo.dev-tunnel.plist
```

## Operate

```bash
launchctl print "gui/$(id -u)/app.dioreo.dev-portal" | grep -E "state|pid|last exit"
launchctl kickstart -k "gui/$(id -u)/app.dioreo.dev-portal"   # restart after a code change
launchctl bootout "gui/$(id -u)/app.dioreo.dev-tunnel"        # take the hostname offline, server untouched
tail -f ~/Library/Logs/dioreo/dev-portal.log
```

⚠️ **`RunAtLoad` + `KeepAlive` means the tunnel is up whenever the Mac is**, so `dev-portal.dioreo.app` is publicly resolvable and reachable while it runs. It is outbound-only — no inbound firewall rule, no port forwarding, the Mac's IP never referenced — and the door is Discord OAuth against the DEV app with `isOwnerId()` hardcoded to Harkirat's id. `bootout` the tunnel agent to take it offline without stopping the server.

🔴 **THE DISCORD REDIRECT URI IS THE ONE THING HERE THAT IS UNVERIFIED, AND IT IS THE LIKELIEST FAILURE.** `docs/db-deferred-list.md` records Harkirat registering `https://dev.portal.dioreo.app/auth/callback` on the `Dioreo (Dev)` application on 2026-08-28 — **the DOT form**. The hostname changed to `dev-portal` afterwards, because Universal SSL covers one label and not two, and **that entry was never updated**. So the URI this portal actually sends may not be registered. ⚠️ **It cannot be probed from a terminal**: measured 2026-09-05 14:46 EDT, an obviously unregistered `redirect_uri` returns the SAME 302 to Discord's login as the real one, so a curl check here cannot fail and proves nothing. **The only test is a sign-in.** If it errors with *Invalid OAuth2 redirect_uri*, add `https://dev-portal.dioreo.app/auth/callback` to the dev application's redirect list and retry.

## Cloudflare Access sits in front of it, since 2026-09-05 16:24 EDT

**A stranger no longer reaches this Mac at all.** Cloudflare stops the request at its own edge and 302s to `fragrant-hall-1c8b.cloudflareaccess.com`; the tunnel is never dialled and the laptop never sees the connection. Before this, an unauthenticated request got the portal's own login page — every data route already answered 401, so the lock held, but the door was reachable by anyone who guessed the name and it was reachable **whenever the Mac was on**, which is what the launchd agents changed.

| Who | How they get in |
|---|---|
| **Harkirat** | A one-time PIN emailed to `harkirat117@gmail.com`. That is Cloudflare's built-in identity provider — no Google or GitHub app to configure — and it was the only one on the account. Session lasts 24h, then Discord OAuth still runs behind it as before |
| **Automated checks** | The service token `dioreo-dev-portal-checks`, as two headers. `CF_ACCESS_CLIENT_ID` and `CF_ACCESS_CLIENT_SECRET` are in the gitignored `.env` |

```bash
curl -H "CF-Access-Client-Id: $CF_ACCESS_CLIENT_ID" -H "CF-Access-Client-Secret: $CF_ACCESS_CLIENT_SECRET" \
     https://dev-portal.dioreo.app/
```

⚠️ **THE LOCAL INSTRUMENTS ARE UNAFFECTED AND THAT IS NOT LUCK** — `portalRealWalk` and the rest drive `http://127.0.0.1:8787` directly, so they never cross Cloudflare. Only something addressing the public hostname needs the headers.

🔴 **THE SERVICE-TOKEN SECRET WAS RETURNED ONCE AND CANNOT BE READ BACK.** It is in `.env` and nowhere else; losing it means creating a new token and updating the policy. It expires **2027-09-05**.

**To remove the gate entirely** — the portal's own Discord OAuth still guards everything, so this is a downgrade in defence rather than an opening:

```bash
# app "Dioreo dev portal" on account 74780789a06110c70565abfc71a894d6
curl -X DELETE -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  https://api.cloudflare.com/client/v4/accounts/74780789a06110c70565abfc71a894d6/access/apps/ebe6d549-6c9e-48ba-bf19-4afe0f599714
```

⚠️ **Verified when it was built, including the half that could have been vacuous**: anonymous → **302** to the Access login · service token → **200** and the portal's own title · **a WRONG secret → 302**, which is what makes the 200 evidence rather than a check that passes no matter what.

⚠️ **A SLEEPING MAC IS A 502, AND IT IS NOT A PORTAL BUG.** The origin is this machine, so the hostname answers only while the Mac is awake with both agents running. Cloudflare returns its own error page — **502/1033 means the tunnel reached nothing, not that the portal is broken**, and the first thing to check is whether the Mac was asleep rather than anything in `portal/`. Carried here from the deferred entry that predicted it, because a warning in a tracker is not at the point of failure.

⚠️ **`.env.dev` IS READ ONCE, AT START.** `KeepAlive` restarts the process on a crash, never on a file change, so rotating a dev secret leaves the running portal on the old value with nothing to indicate it. Same remedy as the line below.

⚠️ **The portal does NOT hot-reload.** `--watch` is the dev BOT's flag; this agent runs plain `node`, so a change under `portal/` needs `launchctl kickstart -k`. That is deliberate — a watcher restarting mid-request is worse than an explicit restart — but it is the thing most likely to make a change look like it did not land.
