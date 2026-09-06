---
kind: legal
status: live
published: true
---

# Privacy Policy — Dioreo

**Effective date:** on the Dioreo v3 release — this version is not yet in effect
**Version:** 1.14 (pending)
**Applies to:** the Dioreo Discord application (the "Bot") and this documentation website (the "Site")



## 0. The short version

We store **your Discord user ID** and **your display preferences** — timezone, visibility toggles, region, and colour settings. That's essentially it.

**We cannot read your messages.** The Bot doesn't have Discord's Message Content permission, so message text is technically inaccessible to us, not merely unused.

**Your data is stored in Canada.** No advertising, no ad-tech tracking, no cookies, no third-party analytics service, and no profiling — nothing is sold or shared for marketing, and nothing is ever used to personalise what you individually see. We *do* keep our own record of how the Bot is used — which commands are run, how fast they were, whether they worked — identified by a **keyed hash** rather than your Discord ID. That is described in full in §2.4b.

**This website stores exactly one thing on your device:** whether you chose light or dark mode. It never leaves your browser and identifies nobody — see §2.6.

You can have everything deleted by emailing **harkirat117@gmail.com** — see §9.

*This summary is for convenience. The sections below are the actual policy.*



## 1. Who is responsible for your data

The **data controller** is:

**Harkirat Mangat**, also known as **"dior"** or **"diorswrld"**, an individual based in Ontario, Canada. 📧 **harkirat117@gmail.com** 💬 **Discord:** [diorswrld](https://discord.com/users/1139845545754632283)

This is a hobby project run by one person. There is no company, no data protection officer (none is required — we do not carry out large-scale or systematic monitoring), and no privacy team. Email reaches a real person.

**The Bot was called Dior's Builds until 4 August 2026.** That was a change of name, nothing more. **The controller did not change** — it is the same individual named above, at the same address, and no data was sold, transferred, shared, or disclosed to anyone as a result. Nothing about what is stored, why it is stored, who receives it, or how long it is kept was affected. Under GDPR terms: there is no new controller, no new processor, no new recipient, and no new purpose. A request you sent to Dior's Builds is a request to Dioreo and is handled the same way.

### 1.1 EU representative

We have not appointed an EU representative under **GDPR Article 27**. We rely on the exemption in **Article 27(2)(a)**: our processing is occasional, does not include special-category or criminal-conviction data on any scale, involves only a user ID and display preferences, and is unlikely to result in a risk to the rights and freedoms of individuals.

If that assessment ever stops being accurate, we will appoint a representative and update this policy. EU and UK users can reach us directly at the address above, and we answer.



## 2. What we collect

### 2.1 Information stored about you

Everything below lives in a single `UserPreference` record keyed to your Discord user ID. **A record is only created once you actually use the Bot.**

| Data | What it is | Why we have it |
|---|---|---|
| **Discord user ID** | Your permanent numeric Discord ID | The key linking your preferences to you. Required. |
| **Timezone** | An IANA timezone you set (e.g. `America/Toronto`) | So `/timestamp` and countdowns show correct local times |
| **Timestamp style** | Your preferred timestamp format | Remembers your `/timestamp` choice |
| **Visibility settings** | Public or private replies, per feature group | Remembers whether you want replies others can see |
| **Region preference** | Your CP pricing region, and whether it's pinned | Shows the right prices without re-selecting |
| **Calendar filter** | Active-events-only vs all events | Remembers your `/calendar` toggle |
| **Accent colour style** | Which colour source you've chosen | Controls how your messages are coloured |
| **Cached colour values** | Hex codes and 6-swatch palettes derived from your Discord profile images | Avoids re-analysing your avatar on every command |
| **Colour source hashes** | The Discord asset hash a cached colour was computed from | Detects when you change your avatar so the cache refreshes |
| **Seen announcements** | The IDs of any bot-wide announcements you've already been shown | So an announcement is delivered to you once, not repeatedly |
| **CP currency preference** | Which storefront `/draw calculator` quotes prices from | Shows the right purchase recommendation for your currency without re-selecting |

**Is a Discord user ID personal data?** Yes — we treat it as such. It's a persistent unique identifier that can be linked back to you, which brings it within GDPR Art. 4(1) and PIPEDA's definition of personal information. We say so rather than arguing otherwise.

### 2.1a Settings that belong to a server, not to you

If you administer a Discord server, you can use `/admin` to decide where the Bot answers publicly and where it answers only to the person who asked. Those choices are stored in a separate `GuildSettings` record keyed to the **server's** ID, not to yours, and **a record is only created once an admin actually saves a rule.**

| Data | What it is | Why we have it |
|---|---|---|
| **Server ID** | The server's permanent numeric Discord ID | The key linking the rules to the server. Required. |
| **Channel and role IDs** | The channels and roles named in the rules an admin set | Without them a rule cannot say *where* or *for whom* it applies |
| **Command names** | Which of the Bot's commands are always answered privately there | Applies the admin's choice |
| **Last editor's Discord user ID** | The single ID of whoever most recently saved a change | So a server's other admins can see who changed a shared setting |

Only the last field is personal data, and it is the **only** thing in this record that identifies a person: the rest describes a server's configuration. It is overwritten each time the settings are saved, so it holds one ID rather than a history. **It is not linked to your `UserPreference` record, is never used to personalise anything, and is not shared with anyone** — it exists so that an admin who finds a rule they did not set can tell which of their colleagues set it. If you would rather it were not stored, §9 applies to it in the same way as to everything else.

**These settings never override your own.** A server rule can only make the Bot *quieter* — it can require that an answer be shown privately. It cannot make an answer public if you asked for a private one, and it cannot read or change any preference in §2.1.

### 2.1b Records about who administers the Bot, and what's been announced

Two more small records, neither of which most people ever appear in. Both are keyed to a Discord user ID and both exist to run the Bot's own admin tooling, not to build a profile of anyone using it.

| Data | What it is | Why we have it |
|---|---|---|
| **Admin allowlist entry** | The Discord user ID of someone the Bot's owner has granted admin access, which specific admin pages/commands they can use, an optional note, and the ID of whoever granted it | Lets the owner delegate parts of the Bot's data-management tools without a code change per person |
| **Announcement record** | Text written by the owner or a granted admin for a one-time bot-wide notice, when it was posted, who posted it, and when it expires | Lets the Bot tell every user about something once, without a message per person |
| **Change log entry** | A record of one action taken through the Bot's own admin data-entry tool (`/manage`) — which admin did it, what kind of action, which section of data, and a short human-readable description of what changed | Lets the owner see who changed what in the Bot's own data, for accountability over the Bot's content rather than over any user |

None of these three records is linked to your `UserPreference` record or used to personalise anything — the allowlist entry only exists for someone the owner has explicitly granted access to, the announcement record's only personal data is who wrote it, and the change log entry's only personal data is which admin performed a data-entry action. You can read all three schemas yourself: [`models/AdminUser.js`](../../models/AdminUser.js), [`models/Announcement.js`](../../models/Announcement.js), [`models/ChangeLog.js`](../../models/ChangeLog.js).

### 2.1c Records the web admin portal keeps

The Bot's owner and any admin granted access can sign into a browser-based management portal at `portal.dioreo.app`. **This portal is not reachable by ordinary users** — it is not linked from the public site, and signing in requires already holding admin access described in §2.1b. Two records back it, both created only once an admin actually uses the portal.

| Data | What it is | Why we have it |
|---|---|---|
| **Portal session** | A hashed session id, your Discord user ID, your Discord username and display name, your avatar image hash, when you signed in, when you were last active, and a short device/browser string (e.g. "Mozilla/5.0 ...") | Keeps you signed in for up to 12 hours, lets the owner see and end active sessions from the Access page, and shows your username and avatar in the portal's own header so you can see which account is signed in |
| **Staged change (Changeset)** | The Discord user ID of whoever staged it, which part of the portal it belongs to, the pending edits themselves, and their status (draft, staged, blocked, or committed) | Lets a multi-step edit be composed, previewed and committed as one action, and survive a session expiring before it's finished |

**The session id itself is never stored** — only a one-way hash of it. A database compromise cannot be turned into a working login. The device/browser string is a category of data this policy has not previously described; it identifies your browser and operating system, not you personally, and exists solely so the owner can distinguish one active session from another on the Access page (e.g. "which of my two logged-in sessions is this").

**Neither record is linked to your `UserPreference` record and neither is used to personalise anything.** They exist purely to run the portal's own login and staging mechanics for a small number of admins. If you would rather your portal session record were not stored, §9 applies to it in the same way as to everything else described in this policy. You can read both schemas yourself: [`models/PortalSession.js`](../../models/PortalSession.js) and [`models/Changeset.js`](../../models/Changeset.js).

### 2.2 About the colour data specifically

If you use the accent-colour or "View Colors" features, the Bot downloads your Discord **avatar, banner, avatar decoration, or nameplate image** and analyses it to extract dominant colours.

If you have set a **server profile** — Discord's per-server override for any of those images, or for your Display Name colours — the Bot uses that server's version while you are using it in that server, and your ordinary profile everywhere else. Discord includes your server profile in the data it sends with each command you run in a server. The colours derived from a server profile are cached separately from the ones derived from your ordinary profile, so both are kept rather than one replacing the other; nothing about how they are stored, why, or for how long differs between the two.

- **The images themselves are never stored.** Fetched, analysed in memory, discarded.
- **Only the resulting colour values are saved** — hex codes and palettes.
- **Display Name colours** are the two colours you picked in Discord's Nitro settings, stored as-is rather than extracted from an image.
- The stored "source" value is Discord's own asset hash, used purely to notice when you've changed your image.

### 2.3 Temporary data held in memory

Exists only in the server's memory while it runs, and is **lost on every restart or deploy** (typically hours to days):

- Anti-spam cooldown timestamps (your user ID → time of your last interaction)
- A short-lived cache of your Discord profile data
- A per-message colour choice, so a message keeps its colour when you click buttons

### 2.4 Operational logs and alerts

The Bot keeps an **alert log** of technical events — crashes, database problems, gateway disconnects, daily health checks — recording the alert level, a description, timestamps, process memory use, and uptime. Alerts are also posted to a **private Discord channel** that only the administrator can see, via a Discord webhook.

These concern the *bot's health*, not you. However, **an error captured in a crash report could incidentally contain a Discord user ID** if the failure happened while processing that person's command. This isn't deliberate, and these logs are never used to analyse users.

**Alert logs are automatically deleted after 30 days.**


### 2.4a Server logs (Google Cloud Logging)

The server the Bot runs on ships its console output to **Google Cloud Logging**, where it is retained for **30 days** and then automatically deleted. These are operational logs — startup and shutdown events, command routing, errors and stack traces, database connection state, and the running version and commit.

Since **16 August 2026** each log line also carries the context of whatever the Bot was doing when it was written: an interaction ID, which command was running, which part of the Bot handled it, which source file emitted the line, and a **keyed hash** standing in for the person whose command it was. This is deliberate and systematic rather than incidental, and it is what makes a fault traceable to the thing that caused it. **The keyed hash is the same one described in §2.4b, and the same limits apply**: it is not your Discord ID, it cannot be reversed into one without a secret key held outside the database, and it is never used to build a picture of any individual. These logs still purge on the same 30-day schedule.

As with alert logs, **an error or stack trace could additionally contain a raw Discord user ID** if the failure occurred while processing that person's command — an error object can carry one even though no log statement in the Bot writes one deliberately. These logs are readable only by the administrator, and are never used to analyse or profile users.

**Google Cloud Error Reporting** (enabled 6 August 2026) reads those same server logs and groups repeated errors together so the administrator can see that one fault occurred fifty times rather than scrolling fifty near-identical stack traces. It is a **view over the logs already described above** — the same data, in the same Google Cloud project, in the same region, processed by the same provider. It introduces **no new collection**: nothing is sent to it that was not already being logged, and no software from it runs inside the Bot. Error Reporting keeps its copy for **30 days**, the same period as the logs it reads.

### 2.4b Interaction records (how the Bot is used)

Since **16 August 2026** the Bot keeps a record of each interaction with it — each slash command, button press, dropdown choice and search. One record per interaction, held in the same MongoDB Atlas database §5 already names. This is our own first-party record; **no third-party analytics service, SDK or tracking technology is involved**, and none ever has been.

**Each record holds:** a **keyed hash** standing in for you (see below), the server ID if you were in a server, whether the Bot was installed to that server or to your own account, which command and subcommand you used, whether you arrived by slash command, button, dropdown, autocomplete or modal, how the interaction turned out (it worked, it errored, it timed out, a server rule made it private, a rapid double-click was ignored), how long the Bot took to answer, how long each external service it called took, the Bot's version and commit, and the time.

**Your identifier is a keyed hash, not your Discord ID.** Before anything is written, your Discord user ID is put through **HMAC-SHA256** with a secret key that lives only on the server and never in the database. What is stored is the 64-character result. The same person always produces the same hash, so we can tell that one person ran five commands, without the record containing anything that names them. Being honest about what this does and does not protect: it defeats someone who obtains the database alone, because there is nothing in it to reverse. It does **not** defeat someone holding both the database **and** the key, who could hash candidate IDs and match them. We do not consider that a reason to overstate it. The server ID is stored as-is, because a server is not a person.

**What it is for:** understanding which features are actually used, finding what is slow, and seeing what breaks and how often. **It is never used to personalise what you individually see, never used to build a profile of you, never used for advertising, and never shared.** The Bot behaves identically for everyone regardless of what these records say.

**Search text is included, and here is exactly what that means.** When you type into one of the Bot's own search fields — a weapon name in `/gunsmiths`, for instance — the text you typed is recorded, **once per search rather than once per keystroke**, lowercased and cut off at 100 characters. This is how we find out that people type `kilo` when the weapon is called `KILO 141` and nothing came back, which is the only way that gets fixed. A separate summary table counts how often each term was searched and how often it found nothing, and that table holds **no user identifier at all**, not even a hash.

⚠️ **This is not message content, and we will not blur that line.** Text you type into a slash command's own field is text you are deliberately sending to the Bot — that is how commands work, and Discord delivers it to us for that purpose. It has nothing to do with the Message Content permission the Bot does not hold: your ordinary messages, in servers or in DMs, remain technically inaccessible to us exactly as §3 says.

**Retention:** these records are kept indefinitely, alongside daily summaries. §7 says so plainly rather than implying otherwise. If you ask us to delete your data (§9), we hash your ID and delete every matching record.

The schemas are readable at [`models/AnalyticsEvent.js`](../../models/AnalyticsEvent.js) and [`models/SearchTerm.js`](../../models/SearchTerm.js). A third record, [`models/BootRecord.js`](../../models/BootRecord.js), is written once each time the Bot starts up and contains **nothing about any user at all** — a version, a commit, how many servers, and whether startup went cleanly.

### 2.5 If you use GitHub

Filing an issue or pull request on our GitHub repository means GitHub processes your data under [GitHub's Privacy Statement](https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement). That's GitHub's processing, not ours, and it is entirely separate from using the Bot.

**The repository's visibility may change at any time, without notice.** It may be public or private at any given moment, at the maintainer's discretion. If it is public, anything you post there is visible to anyone. **This policy, the Terms of Service, and the Bot's behaviour do not depend on that setting** — they apply identically either way, and these documents remain published at their permanent public URLs regardless.

### 2.6 This website, and the two things it stores on your device

These documents are served as a static website. It has no accounts, no forms, no analytics, no third-party scripts, and no server-side session of any kind — the hosting provider serves files and nothing else.

It stores **two** items in your browser's own storage, and neither one ever leaves it:

| Name | Where | Value | Purpose | Expires |
|---|---|---|---|---|
| `db-theme` | Local storage | `light` or `dark` | Remembers the appearance you picked, so the site does not reset to dark every time you open a page | Never — it stays until you clear it |
| `db-booted` | Session storage | `1` | Set on the What's New, Changelog and Devlog pages so their opening animation plays once per browsing session instead of on every page you open | When you close the tab |

Three things follow from that, and they are the whole of it:

- **Neither is a cookie.** Cookies are transmitted to the server with every request; local and session storage never leave your browser. The provider serving this site never receives either one, and neither do we.
- **Neither identifies anybody.** One holds one of two words, the other holds the digit `1`. They contain no identifier, are not combined with anything else, and cannot distinguish you from any other reader.
- **Only one of them is written because you asked.** `db-theme` is written when you press the light/dark switch and at no other time — never touch the switch and it is never written. `db-booted` is different, and we would rather say so plainly: it is written when you open What's New, the Changelog or the Devlog, without your asking, and its only purpose is to stop those pages replaying their opening animation each time you move between them. It holds no information about you and it is gone when you close the tab.

**Why there is no consent banner.** Consent rules for storing things on your device are technology-neutral — they cover local and session storage, not only cookies, so "it isn't a cookie" would not on its own be a defence. The exemption that applies is for storage strictly necessary to provide a service you have explicitly asked for. A display preference you set by pressing a switch is plainly that. `db-booted` rests on the same exemption for a different reason: it carries nothing about you, it exists only so that the pages you asked for behave sensibly on the second and third visit within one session, and it is discarded when that session ends. Neither item is used for analytics, advertising, measurement, or tracking of any kind, so no other basis is needed.

**To remove them:** clear site data for this domain in your browser settings, or use private browsing. `db-booted` also clears itself when you close the tab. Removing them costs you nothing but the appearance setting and one replayed animation.

**This section describes `dioreo.app` only.** The separate admin portal at `portal.dioreo.app` is a different application on a different subdomain, reachable only by the Bot's owner and granted admins, and it does set one cookie — a signed-in session, described in §2.1c. Nothing here about "no cookies" was ever meant to describe that portal, and we say so explicitly now that it exists, rather than let a general statement about the public Site read as broader than it is.

**Until you press the switch, no appearance preference is stored at all** — the Site simply follows whatever light or dark setting your operating system or browser is already using. That happens through an ordinary CSS media query: your browser applies one set of colours or the other while drawing the page. We are not told which it chose. There is no server-side component that could be told — these are static files.

The one place the Site reads that setting in code, it does so only to keep the switch's on/off state honest for screen readers, in your own browser. **It is never stored, never written to a log, never combined with anything else, and never sent anywhere.** We mention it because a colour-scheme preference is one of the signals that *can* be used to help fingerprint a browser when it is collected and transmitted, and we would rather state plainly that this one is not.



## 3. What we do NOT collect

| ❌ We do not have | Why |
|---|---|
| **Your messages** | The Bot runs with only the `Guilds` gateway intent. It does **not** have the Message Content intent, so Discord never sends us message text. A technical impossibility, not just a policy promise. |
| **Your DMs** | Same reason. |
| **Your email address** | Never requested, never received from Discord. |
| **Your real name** | Never requested. |
| **Your Discord username or display name** | Used momentarily to render a response, never written to the database. |
| **Your IP address** | Discord handles the Bot's connection; we never see it. Loading *this website* is a normal web request, so the host that serves it necessarily processes your IP the way any web server does — that is described in §5, and it never reaches us or our database. |
| **Payment information** | The Bot is free and has no payment feature. |
| **A list of your servers** | Not collected or stored. |
| **Third-party analytics or tracking data** | No analytics SDK, no tracking pixel, no ad network, no fingerprinting, no cross-site or cross-app tracking of any kind. The Bot's own first-party record of how it is used, identified by a keyed hash rather than your Discord ID, is described in §2.4b — it never leaves our own database and is never used to personalise anything. |
| **Cookies** | None, anywhere. The Bot runs inside Discord and has no web surface at all. This documentation website sets no cookies either; it stores a single light/dark preference in your browser, which is described in full in §2.6 and is never transmitted. |
| **Voice data, location, contacts, or biometrics** | Not applicable, not collected. |

We do **no** profiling of individuals, no behavioural advertising, and **no automated decision-making producing legal or similarly significant effects** (GDPR Art. 22). Nothing in §2.4b changes this: those records are read in aggregate to improve the Bot, and no output of them is ever applied back to an individual person.



## 4. Why we process it, and our legal basis

| Purpose | Legal basis (GDPR Art. 6) |
|---|---|
| Remembering your preferences | **Consent** — you chose to set them (Art. 6(1)(a)) |
| Making the Bot work when you invoke a command | **Contract** — the Terms of Service (Art. 6(1)(b)) |
| Keeping the Bot secure and stable (cooldowns, crash logs) | **Legitimate interests** — running a functioning, non-abused service (Art. 6(1)(f)) |
| Complying with legal obligations | **Legal obligation** (Art. 6(1)(c)) |

No **special category** data (Art. 9) is processed — no health, biometric, racial or ethnic origin, political, religious, or sexual-orientation data.

Under **PIPEDA**, our basis is your **implied consent**: you install the Bot and set a preference, and we store it for the obvious purpose of honouring it. You can withdraw consent at any time (§9).

> **A note on PIPEDA's scope.** PIPEDA applies to organisations collecting personal information "in the course of commercial activity." This Bot is free and non-commercial, so PIPEDA arguably doesn't bind us at all. **We comply with it regardless**, and don't rely on that argument to hold anything back.



## 5. Who your data is shared with

**We do not sell your data. We do not share it for advertising or cross-context behavioural advertising. We do not disclose it to data brokers.** We have never done so, and we have no plans to.

| Provider | What it handles | Where |
|---|---|---|
| **Discord Inc.** | The platform itself — your ID, your interactions | Per [Discord's Privacy Policy](https://discord.com/privacy) |
| **MongoDB Atlas** (MongoDB, Inc.) | **Stores your preference record, the per-server settings described in §2.1a, the operational alert log described in §2.4, the interaction records described in §2.4b, the admin allowlist / announcement / change log records described in §2.1b, and the portal session / staged-change records described in §2.1c** | **🇨🇦 Azure Canada Central (Toronto)** |
| **Google Cloud Platform** (Google LLC) | Hosts the server the Bot runs on | 🇺🇸 `us-east1` (South Carolina) |
| **Google Cloud Logging** (Google LLC) | Server logs, 30-day retention | 🇺🇸 United States |
| **Google Cloud Error Reporting** (Google LLC) | Groups repeated errors from those same server logs — no new data, 30-day retention | 🇺🇸 United States |
| **Google Cloud Vertex AI** (Google LLC) | Admin-only image extraction — **no end-user data** | 🇺🇸 United States |
| **Cloudinary Ltd.** | Hosts cached **game images** only | 🇺🇸 United States |
| **Cloudflare, Inc.** | Serves these legal documents as a public web page | Global edge network |

**About Cloudflare:** it hosts *this policy and the Terms of Service* so they are publicly readable, as Discord requires. It has no role in the Bot itself and never sees your Discord data. Like any web host, it processes standard request data — including your IP address — when you load these pages, under [Cloudflare's privacy policy](https://www.cloudflare.com/privacypolicy/). Reading this page is the only thing that involves them.

### 5.1 Three clarifications worth making

**Your stored personal data stays in Canada.** The `UserPreference` records — the only place your preferences live — are in an Atlas cluster hosted in **Azure Canada Central, Toronto**. Verified 2026-07-28 21:36 EDT by resolving the cluster's DNS records. The alert log described in §2.4 lives in the same cluster, for the same reason: it is a different collection, not a different provider or region.

**Cloudinary holds no personal data.** The images there are game screenshots and weapon artwork supplied by the administrator, plus rendered previews of Discord's own nameplate/decoration cosmetic designs — cached by WHICH DESIGN it is, never by who equipped it, so the same cached image serves every user who has that same design. Your avatar is never uploaded.

**No AI system processes your data.** The `/autobuild` command sends screenshots to a Gemini model for text extraction, but it is **restricted to the administrator's own Discord account**. No end-user data, image, or message is ever sent to any AI service.

Two details that matter here:

- We call **Google Cloud Vertex AI** (`aiplatform.googleapis.com`, project-scoped, service-account authenticated) — **not** the consumer Gemini API (`generativelanguage.googleapis.com`). The distinction is important: under the Google Cloud terms that govern Vertex AI, **Google does not use customer data submitted to Vertex AI to train its models.** The consumer Gemini API's free tier has materially weaker terms in this respect. We use the enterprise path.
- Separately, AI tools were used to help *write* this project's code and documentation — see [NOTICE](../../NOTICE) §6. That is development-time assistance, not runtime processing of your data.

### 5.2 If a provider mishandles your data

We choose our providers carefully and rely on their published privacy terms and data processing agreements. But we are one person, and **we have no ability to audit, inspect, or control what Discord, Google, MongoDB, or Cloudinary actually do inside their own systems.**

So, plainly:

- **Discord is an independent controller of its own data**, not our processor. What Discord collects about you through using Discord — far more than we ever see — is governed by [Discord's Privacy Policy](https://discord.com/privacy) and is Discord's responsibility, not ours.
- **Our other providers act as processors** on our instructions, under their own data processing agreements. We do not authorise any of them to use your data for their own purposes, and we have not agreed to any such use.
- **If a provider acts outside those terms**, that is their breach. To the fullest extent the law allows, we are not liable to you for it. Our liability to you in any event is limited by §15 of the [Terms of Service](TERMS.md).
- **What we will do:** if we learn a provider has mishandled your data, we will investigate, tell you where §8.1 requires it, notify the relevant regulator where required, and change provider where that's the right answer.

> **Being honest about a limit of this section.** If data protection law applies to us, we are the **controller**, and a controller carries responsibility for choosing and overseeing its processors that it cannot simply disclaim in a privacy notice. This section allocates *contractual* risk between you and us and tells you the truth about what we can and can't control. It does not, and cannot, override any obligation the law places on us, and we don't pretend otherwise.

### 5.3 Other disclosure

We may disclose information where legally required — a valid court order, subpoena, or law-enforcement request under Canadian law — or where necessary to investigate a security incident or protect someone's rights or safety. Given what we hold, such a request would yield very little. Where we are lawfully permitted to tell you about such a request, we will.

If the Bot were ever transferred to another operator, your data could transfer with it. We would give notice first, and you could delete your data beforehand.



## 6. International transfers

**Your stored preferences do not leave Canada.** They sit in Azure Canada Central.

Some *processing* happens elsewhere: the server that runs the Bot is in the United States (Google Cloud `us-east1`), so your data is handled in memory there while a command runs. Discord operates globally and handles your data under its own policy.

**If you are in the EEA, the UK, or Switzerland:** Canada holds a partial **adequacy decision** from the European Commission for organisations subject to PIPEDA, which means transfers to Canada are recognised as offering adequate protection. For the US-based processing, we rely on Google's transfer mechanisms — Standard Contractual Clauses and the EU–US Data Privacy Framework — as set out in the Google Cloud data processing terms.

Given the data involved is a user ID and colour preferences, the practical risk of these transfers is low.



## 7. How long we keep it

| Data | Retention |
|---|---|
| **Your preference record** | **Kept until you ask us to delete it** — see §9 |
| **Alert logs** | **30 days**, then automatically deleted |
| **`/manage` change log entries** (§2.1b) | **180 days**, or the newest 5,000 entries, whichever is reached first — then automatically deleted |
| **Web admin portal session** (§2.1c) | **12 hours**, then automatically deleted (Mongo TTL) |
| **Staged change (Changeset)** (§2.1c) | **Kept while in progress; an abandoned draft is automatically deleted after 30 days.** A committed set is not deleted by this rule — the resulting change is recorded exactly as any other `/manage` change log entry, above |
| **Interaction records** (§2.4b) | **Kept indefinitely**, together with daily summaries. Deleted on request — see §9 |
| **Search-term summary table** (§2.4b) | **Kept indefinitely.** It contains no user identifier of any kind, so there is nothing in it to delete on request |
| **Startup records** | **Kept indefinitely.** They contain nothing about any user |
| **Server logs (Google Cloud Logging)** | **30 days**, then automatically deleted |
| **Grouped errors (Google Cloud Error Reporting)** | **30 days**, then automatically deleted |
| **In-memory caches** | Until the next restart or deploy — hours to days |
| **Cloudinary game images** | Until the underlying content rolls out of the Bot's history |

### 7.1 An honest disclosure about deletion

**There is currently no automated deletion and no self-service delete command.**

Removing the Bot from your Discord account stops all future interaction, but does **not** by itself erase your stored preferences — they simply sit unused.

**Deletion is currently handled manually, on request, by email.** That is a legitimate and compliant route — the law requires that you be able to exercise the right, not that a button exist — but we consider the absence of self-service a shortcoming rather than a design choice. A `/settings` delete option and an automatic clean-up of long-dormant records are planned, and this policy will be updated when they ship.

`/settings` currently lets you **change** stored values, which overwrites them. It has no reset or delete.



## 8. Security

What actually protects your data:

- **Credentials** live in environment variables, never committed to the repository; the secrets file is permanently excluded from version control.
- **Database access** is restricted and authenticated.
- **All connections** to Discord, MongoDB, Cloudinary, and Google Cloud use TLS.
- **Administrative commands** are locked to a single hard-coded Discord ID — no one else can reach the management, alerting, or automation features.
- **Rate limiting and cooldowns** guard against abuse.
- **Only one bot instance** may run at a time, enforced by a database lock.

**The limits, stated plainly:** this is a personal project on a single small server. There is no formal information-security programme, no penetration testing, no SOC 2 audit, and no 24/7 monitoring. No system is perfectly secure, and we cannot guarantee absolute security.

The mitigating factor is that there is very little to lose — a public Discord ID and some colour preferences. No passwords, no emails, no payment details, no message content.

### 8.1 If there's a breach

If a breach creates a **real risk of significant harm**, we will:

1. Report it to the **Office of the Privacy Commissioner of Canada** as PIPEDA requires, and keep a record of it.
2. Notify affected users through the Bot or the project's public channels, without undue delay.
3. For EEA/UK users, notify the relevant supervisory authority within **72 hours** where GDPR requires it, and notify you directly where the risk is high.



## 9. Your rights and how to use them

**Whoever and wherever you are, you can ask us to do all of the following.** We apply the strongest standard to everyone rather than sorting users by jurisdiction.

| Right | What it means |
|---|---|
| 🔍 **Access** | Get a copy of everything stored about you |
| ✏️ **Correction** | Fix anything inaccurate |
| 🗑️ **Deletion** | Have your record erased entirely |
| 📦 **Portability** | Receive your data in a machine-readable format (JSON) |
| ⛔ **Object / restrict** | Object to legitimate-interests processing, or ask us to pause it |
| ↩️ **Withdraw consent** | At any time, without affecting past lawful processing |
| 🚫 **Non-discrimination** | We will not degrade the Bot for you for exercising a right |

### 9.1 How to make a request

**Email harkirat117@gmail.com** with the subject line **"Privacy Request"**, and include:

1. **Your Discord user ID** — the numeric one. In Discord: Settings → Advanced → enable Developer Mode, then right-click your own name and "Copy User ID".
2. **What you want** — access, correction, deletion, a copy of your data, or withdrawal of consent.

**That's the whole process.** There is no form, no account, and no fee.

### 9.2 Verifying it's really you

Because a Discord user ID is public, we need to know the request actually comes from the account holder before we act on it — otherwise anyone could delete someone else's settings.

**We will ask you to confirm the request from the Discord account in question**, normally by sending a direct message to the administrator (`dior`, also seen as `diorswrld`) from that account referencing your email. If we can't reasonably verify you, we may decline to act, and we'll tell you why (GDPR Art. 12(6)).

This step exists to protect you, not to obstruct you.

### 9.3 Timing

- We respond within **30 days**.
- Complex requests may be extended by up to a further **60 days**, and we'll tell you within the first 30 if that happens (GDPR Art. 12(3)).
- Requests are **free**. We may charge a reasonable fee for, or refuse, requests that are manifestly unfounded or excessive — particularly repetitive ones (GDPR Art. 12(5)). We'll explain if we ever do.

### 9.4 What deletion actually does

We delete your `UserPreference` record entirely. Your preferences revert to defaults, and the Bot behaves as though you'd never used it. Nothing is retained in a shadow copy.

Two honest caveats:

- **Interaction records** (§2.4b) are identified by a keyed hash rather than your Discord ID, so deleting them is not guesswork: we put your ID through the same hash and delete every record that matches. The search-term summary table and the startup records hold no user identifier at all, so there is nothing in either to delete.
- **Alert logs and server logs** may briefly contain an incidental user ID (§2.4, §2.4a). Both purge automatically within 30 days, so we do not routinely search them. Ask and we will.
- **Database backups** maintained by MongoDB Atlas may retain a copy until they age out on Atlas's own schedule. We cannot selectively edit a backup, which is a normal and accepted limitation.

### 9.5 Complaints

If you're unhappy with how we've handled your data, please tell us first — but you have every right to go straight to a regulator:

- **Canada:** [Office of the Privacy Commissioner of Canada](https://www.priv.gc.ca/) — 1-800-282-1376
- **EEA:** your national data protection authority ([list](https://edpb.europa.eu/about-edpb/board/members_en))
- **UK:** [Information Commissioner's Office](https://ico.org.uk/) — 0303 123 1113
- **Quebec:** [Commission d'accès à l'information](https://www.cai.gouv.qc.ca/)
- **California:** [California Privacy Protection Agency](https://cppa.ca.gov/)

### 9.6 A note on California

The CCPA/CPRA applies to "businesses" meeting thresholds — over $25M in annual revenue, personal information on 100,000+ consumers, or 50%+ of revenue from selling personal information. **We meet none of them**, so the CCPA does not apply to us as a matter of law.

We honour the equivalent rights anyway. For the record, in CCPA terms: the only category of personal information we collect is **identifiers** (a Discord user ID) plus user-set preferences; we collect it directly from your use of the Bot; we use it solely to operate the Bot; **we do not and have never sold or shared personal information**; and we do not collect sensitive personal information.



## 10. Children's privacy

The Bot is **not directed at children**. You must meet Discord's minimum age for your country — **13 in most places, and 14, 15, or 16 in parts of the EU and elsewhere**. See §3 of the [Terms of Service](TERMS.md).

We do not knowingly collect data from anyone below that age, and we have no mechanism to verify age beyond Discord's own — we rely on Discord's enforcement of its minimum age.

If you believe a child's data is stored, email **harkirat117@gmail.com** and we will delete it promptly and without requiring the verification steps in §9.2.

Because we never collect names, emails, photographs, or message content, the data we hold about any user — including a young one — is limited to a Discord ID and display preferences.



## 11. Third-party links and content

The Bot displays images and information sourced from third parties and may link elsewhere. **We are not responsible for the privacy practices of any third-party site or service.** Discord's own handling of your data is governed by [Discord's Privacy Policy](https://discord.com/privacy), which is worth reading — it covers far more data than we ever see.



## 12. Changes to this policy

We may update this policy. When we do:

- The **effective date and version** at the top change.
- The full change history is kept in the repository's git log.
- For **material** changes — new data collected, a new recipient, a new purpose — we will make reasonable efforts to give notice before they take effect, and will seek fresh consent where the law requires it.

Continued use after a change takes effect means you accept the updated policy. We will not apply a materially different use of already-collected data retroactively without your consent.

### 12.1 Revision history

Kept here as well as in git, because the repository's visibility can change and a change record you can't reach isn't a change record.

| Version | Effective | What changed |
|---|---|---|
| 1.13 *(pending)* | on the v3 release | **Not yet in effect.** The Bot now has a browser-based admin portal at `portal.dioreo.app`, reachable only by the owner and granted admins (§2.1c is new). It keeps a **portal session** (a hashed session id, your Discord user ID, sign-in/last-active timestamps, a device/browser string) so an admin stays signed in for up to 12 hours, and a **staged change (Changeset)** record so a multi-step edit can be composed and committed as one action. **No Discord token is ever retained** — sign-in uses Discord OAuth, and only your user ID is kept once the sign-in completes. The device/browser string is a new *category* of data for this policy; it identifies a browser, not a person, and exists so the owner can tell active sessions apart on the portal's Access page. §5's MongoDB Atlas row and §7's retention table now name both records: sessions expire automatically after 12 hours, abandoned staged changes after 30 days. **No new recipient** — both live in the same MongoDB Atlas database §5 already names. This portal is not linked from the public site and is unreachable without existing admin access described in §2.1b. The session was later found to also carry the signed-in admin's Discord **username, display name and avatar hash** — fields the OAuth sign-in already returns — shown in the portal's own header so an admin can see at a glance which account is signed in; §2.1c's table and Appendix A now name them, and this is still no new recipient.
| 1.12 *(pending)* | on the v3 release | **Not yet in effect**, and it takes effect alongside 1.11 rather than replacing it — both ship with Dioreo v3. The Bot now keeps **its own record of how it is used**: one entry per interaction, holding which command was run, how you triggered it, how it turned out, how long it took, and how long each external service it called took. New §2.4b describes it in full, §7 gives its retention (**indefinite**, which is a real change and is stated plainly rather than softened), Appendix A lists what an entry holds, and §5's MongoDB Atlas row names it. **This is a genuine expansion of what is collected**, so it is not described as a clarification. Three things bound it. First, **you are identified by a keyed hash, never by your Discord ID** — HMAC-SHA256 with a key held outside the database — and §2.4b states honestly what that does and does not protect against. Second, **no third party is involved**: no analytics SDK, no new recipient, nothing leaves the database §5 already names, and the "no analytics, no tracking, no profiling" statements in §0, §3 and Appendix C have been made **precise** rather than removed — no advertising, no ad-tech tracking, no third-party analytics service, and no profiling or personalisation of any individual, all of which remain true. Third, **it is never used to change what any individual sees**. Text you type into the Bot's **own search fields** is recorded (once per search, lowercased, capped at 100 characters) so that searches which find nothing can be fixed; §2.4b states explicitly that this is command input you send to the Bot and **not** message content, and the Message Content claim in §3 is unaffected and unchanged. In the same change the `RenderTiming` performance log described in 1.11 and §2.4 was **deleted outright** — its rows were migrated with the Discord ID **replaced by the same keyed hash** and the collection dropped, so this release **removes** a place a raw user ID was stored while adding one that never holds one. **No new recipient.** |
| 1.11 *(pending)* | on the v3 release | **Not yet in effect.** This entry describes a change that ships with Dioreo v3 and is dated on release rather than in advance. The Bot will read your **server profile** — Discord's per-server override for your avatar, banner, avatar decoration, nameplate or Display Name colours — when you use it in a server that you have set one for, instead of always using your ordinary profile. §2.2 describes this Which profile applies is decided by where you ran the command, not by a stored setting — nothing new is saved to record the choice. Appendix A names the eighteen new cached fields — `guildAvatarColorHex`/`guildAvatarColorSource` and the same pairing for banner, Display Name, decoration and nameplate, plus `guildAvatarPalette`/`guildAvatarPaletteSource` and the same pairing for banner, decoration and nameplate behind the "View Colors" panel's global/server switch. **No new *kind* of data is collected, and nothing new is shared or kept longer** — these hold exactly what the existing colour fields hold, a derived hex code and the Discord asset hash it came from, for images that are still never stored. They are separate fields rather than reused ones so that a colour derived from a server profile and one derived from your ordinary profile can both be kept instead of overwriting each other. Discord sends your server profile as part of each command you run in a server; the Bot requests nothing additional to obtain it.<br><br>The same release adds **`/admin`**, letting a server's own admins decide where the Bot answers publicly and where it answers only to the person who asked. New §2.1a describes the separate `GuildSettings` record this creates, and Appendix A lists it after the user inventory. It is keyed to a **server** ID rather than a user ID, and the only personal data in it is the Discord user ID of whoever last saved a change — one ID, overwritten on each save, never linked to your preference record and never used to personalise anything. §5's MongoDB Atlas row now names it. **No new recipient and no longer retention.** These settings can only make the Bot quieter: a server rule can require an answer be private, and can never make public an answer you asked to keep private.<br><br>§2.4 now also names **`RenderTiming`**, a small performance-diagnostic log kept while the "View Colors" feature is under active development — how long a render took, which page, and your Discord user ID and server ID, so a slow case can be traced. No colours, images, or appearance data. Unlike the alert log, it is not deleted automatically; it will be pruned by hand once the investigation it supports is finished.<br><br>The same release adds **`seenAnnouncementIds`** to your `UserPreference` record — the IDs of any bot-wide announcement you've already been shown, so a one-time notice from the Bot's owner is delivered to you once and never repeated. New §2.1b describes three further administrative records this release adds: an **admin allowlist** (`AdminUser`), letting the owner grant trusted people access to specific admin pages/commands without a code change; an **announcement record** (`Announcement`), holding the text of a bot-wide notice, when it was posted, who posted it, and when it expires; and a **change log entry** (`ChangeLog`), recording which admin performed a data-entry action through `/manage`, what kind of action, which section of data, and a short description — retained 180 days or the newest 5,000 entries, whichever comes first, same shape as the alert log §2.4 already describes. All three are keyed to a Discord user ID and none is linked to your `UserPreference` record or used to personalise anything — the allowlist only ever contains someone the owner explicitly granted, an announcement's only personal data is who wrote it, and a change log entry's only personal data is which admin performed the action. Appendix A lists all three after the user inventory. **No new recipient** — all three records live in the same MongoDB Atlas database §5 already names — **and no longer retention than what's already disclosed** — the change log entries are the one addition here that isn't kept indefinitely, at 180 days/5,000-row retention, disclosed in §7.<br><br>The same release adds **`/draw calculator`**, which stores one new preference on your `UserPreference` record: `cpCurrency`, which storefront's prices it quotes (e.g. `USD`, `CAD`), overridable per-invocation on the slash command. §2.1's table and Appendix A now name it. Every other input the calculator uses — pulls done, CP balance, target — lives entirely in the interaction itself and is never saved. **No new recipient and no longer retention** — it lives in the same `UserPreference` record every other preference on this page already describes. |
| 1.10 | 6 August 2026 | **Google Cloud Error Reporting** was enabled and is now named in §2.4a, §5's provider table and §7's retention table. It groups repeated errors out of the server logs §2.4a already described, so the administrator sees one fault with a count instead of fifty near-identical stack traces. **No change to what is collected, why, or how long it is kept** — it reads data that was already being logged, in the same Google Cloud project and region, under the same provider, for the same 30 days, and no software from it runs inside the Bot. It is disclosed because §5 names individual Google *services* rather than only the company, and a service that holds a copy of error data belongs in that list. |
| 1.9 | 5 August 2026 | §5's MongoDB Atlas row said it stores only "your preference record" — true of `UserPreference`, but MongoDB also backs the operational alert log §2.4 already discloses in prose. The row and §5.1 now say so and cross-reference §2.4; §2.4 itself is unchanged, because the alert log's contents and 30-day retention were already described accurately there. **No change to what is collected, why, or how long it is kept** — this closes a gap in *where the provider table said it lives*, not a change to what MongoDB stores. |
| 1.8 | 4 August 2026 | **The Bot was renamed from Dior's Builds to Dioreo.** §1 now records the former name and states plainly that the controller did not change. **Nothing else changed at all** — the same individual holds the same data, for the same purposes, on the same legal bases, shared with the same recipients, for the same retention periods. There is no new controller, processor, recipient or purpose, and Appendix A is identical to version 1.7. A request you sent under the old name is handled exactly as one sent under the new one. |
| 1.7 | 4 August 2026 | Corrected §2.6, which still described the Site as storing **one** item and stated that nothing is written unless you press the light/dark switch. Both had been untrue since `db-booted` was added in version 1.6: that item is written when you open What's New, the Changelog or the Devlog, without being asked for. The consent-banner reasoning was affected too — it argued the strictly-necessary exemption only for a preference you set by pressing a switch, which does not reach `db-booted` at all. Every statement in §2.6 now names which item it applies to, and the exemption is argued for `db-booted` explicitly. **No change to what is stored, why, who receives it, or how long it is kept** — the two items, their values and their lifetimes are exactly as listed in version 1.6. |
| 1.6 | 3 August 2026 | §2.6 and Appendix A began listing the Site's **second** browser-storage item, `db-booted` — a session-storage flag set on the What's New, Changelog and Devlog pages so their opening animation plays once per browsing session. It had been written since those pages launched while the policy described `db-theme` as the only key: the verification note had searched the generator, and the flag is written by a separate file, so it was never in scope. The note searches the built pages now. **No change to what is collected, why, who receives it, or how long it is kept** — the flag holds `1`, never reaches any server, and is discarded when the tab closes. |
| 1.5 | 1 August 2026 | Appendix A gained `decorationColorHex` and `nameplateColorHex`, which were stored but not listed, and began naming the four palette-source fields individually rather than abbreviating them. **No change to what is collected, why, who receives it, or how long it is kept** — these fields were already stored and already described by §2; the appendix was an incomplete transcription. A build check now compares the appendix against the live schema so it cannot drift again. |
| 1.4 | 1 August 2026 | Added Discord (`diorswrld`) as a second contact route in §1 and §13, alongside the canonical email. A Privacy Request under §9 must still come by email, so that it is on the record. |
| 1.3 | 1 August 2026 | Broadened the closing non-affiliation notice to name TiMi Studio Group, Tencent, and the rights holders of licensed in-game content, matching the notice the Site already carried. No change to any right or obligation. |
| 1.2 | 31 July 2026 | Brought this policy into line with the documentation website. Version 1.1 stated "there is no website" and that nothing similar to a cookie was set on your device; both became inaccurate once the site gained a light/dark switch that remembers your choice. Adds §2.6 describing that item in full — including how the Site behaves *before* you touch the switch, when it simply follows your operating system's light/dark setting and stores nothing at all — extends the scope line to cover the Site, and corrects the §3 and Appendix C entries. **No change to what the Bot collects, why, who receives it, or how long it is kept** — the stored fields in Appendix A are identical to versions 1.0 and 1.1. |
| 1.1 | 29 July 2026 | Noted the controller's `diorswrld` alias in §1, §9, and §13. **No change to what is collected, why, who receives it, or how long it is kept** — the stored fields in Appendix A are identical to version 1.0. |
| 1.0 | 28 July 2026 | First published version. |



## 13. Contact

**Harkirat Mangat ("dior", "diorswrld")** — Data Controller\
Ontario, Canada\
📧 **harkirat117@gmail.com**\
💬 **Discord:** [diorswrld](https://discord.com/users/1139845545754632283)

Email is the canonical contact and always reaches us; Discord is usually faster for a question. A **Privacy Request** under §9 must come by email, so that it is on the record and we can verify it against the account it concerns. We deliberately don't list a repository link here, because the repository's visibility can change (§2.5) and a contact point in a privacy policy must not be able to go dead.

For privacy requests, use the subject line **"Privacy Request"** and include your Discord user ID.



## Appendix A — Complete data inventory

Every field stored about a user. This mirrors the `UserPreference` schema, which you can read yourself at [`models/UserPreference.js`](../../models/UserPreference.js).

**Identity**
- `discordId` — your Discord user ID

**Preferences**
- `timezone`, `timestampStyle`
- `loadoutVisibility`, `seasonalVisibility`, `timestampVisibility`, `settingsVisibility`, `colorsVisibility`
- `defaultRegion`, `defaultRegionMode`
- `calendarEventFilter`
- `accentColorStyle`
- `cpCurrency`

**Cached colour values** (derived, not raw images)
- `avatarColorHex` / `avatarColorSource`
- `bannerColorHex` / `bannerColorSource`
- `displayNameColorHex` / `displayNameColorSource`
- `decorationColorHex` / `decorationColorSource`
- `nameplateColorHex` / `nameplateColorSource`
- `guildAvatarColorHex` / `guildAvatarColorSource`
- `guildBannerColorHex` / `guildBannerColorSource`
- `guildDisplayNameColorHex` / `guildDisplayNameColorSource`
- `guildDecorationColorHex` / `guildDecorationColorSource`
- `guildNameplateColorHex` / `guildNameplateColorSource`
- `avatarPalette` / `avatarPaletteSource`
- `bannerPalette` / `bannerPaletteSource`
- `decorationPalette` / `decorationPaletteSource`
- `nameplatePalette` / `nameplatePaletteSource`
- `guildAvatarPalette` / `guildAvatarPaletteSource`
- `guildBannerPalette` / `guildBannerPaletteSource`
- `guildDecorationPalette` / `guildDecorationPaletteSource`
- `guildNameplatePalette` / `guildNameplatePaletteSource`

**Announcements**
- `seenAnnouncementIds` — which bot-wide announcements you've already been shown

**That's the whole list.** It mirrors the schema in the source code rather than paraphrasing it, so it can be checked line-by-line against the software itself. If you have access to the repository you can verify it directly; if you don't, ask and we will show you the relevant file.

**Stored on your device, not on ours:** the documentation website additionally keeps a `db-theme` entry in your own browser's local storage, holding `light` or `dark`, and a `db-booted` entry in session storage on the record pages. They are listed here for completeness only — neither reaches our database or any server, and both are described in full in §2.6.

**Stored about a server, not about you:** where a server's admins have used `/admin`, a separate record described in §2.1a holds that server's own settings — its ID, the channel, role and command names its rules refer to, and the Discord user ID of whoever last saved a change. It is listed separately because it is keyed to a server rather than to a person, and only that last field identifies anyone. You can read the schema yourself at [`models/GuildSettings.js`](../../models/GuildSettings.js).

**Recorded about your use of the Bot, described in §2.4b — and identified by a keyed hash, not by you:** for each interaction, the hash, the server ID (if any), whether the Bot is installed to that server or to your account, the command and subcommand, how you triggered it, the outcome, how long it took, how long each external service it called took, any typed search text (lowercased, capped at 100 characters), and the Bot's version, commit and host. Listed separately from the inventory above because it is not keyed to you: the raw Discord ID is never written to it, so it cannot be looked up by user without first hashing an ID you already know. See [`models/AnalyticsEvent.js`](../../models/AnalyticsEvent.js). The accompanying search-term summary — [`models/SearchTerm.js`](../../models/SearchTerm.js) — holds only a term, which command and field it was typed into, and counts; it carries **no user identifier at all**. [`models/BootRecord.js`](../../models/BootRecord.js), written once per startup, holds nothing about any user.

**Administrative records, described in §2.1b:** an admin allowlist entry (the Discord user ID of someone the Bot's owner has granted admin access, which pages/commands they can use, an optional note, and who granted it), an announcement record (text, when it was posted, who posted it, when it expires), and a change log entry (which admin performed a data-entry action through `/manage`, what kind of action, which section of data, and a short description of the change — retained 180 days or the newest 5,000 entries, whichever comes first, then automatically deleted, same as the alert log in §2.4). All three are administrative tooling rather than something built from your own use of the Bot — see [`models/AdminUser.js`](../../models/AdminUser.js), [`models/Announcement.js`](../../models/Announcement.js), and [`models/ChangeLog.js`](../../models/ChangeLog.js).

**Web admin portal records, described in §2.1c:** a portal session (a hashed session id, your Discord user ID, your Discord username, display name and avatar hash, sign-in/last-active timestamps, and a device/browser string) and, if you have staged an edit and not yet committed or abandoned it, a changeset (your Discord user ID, which part of the portal it belongs to, and the pending edits). Both exist only for the small number of people with admin access, and neither is linked to your `UserPreference` record.



## Appendix B — Change history


**1.14 — 2026-08-31.** Added `colorsVisibility` to Appendix A. `/colors` gained its own response-visibility preference, detached from `/settings`, so the schema stores a fifth per-user visibility field. No new CATEGORY of data is collected — it is one more value of a kind already described in §2 — but the appendix claims to be a complete transcription of the schema, so an unlisted field made the published policy inaccurate about live data collection. Caught by `docs-audit`'s `privacy-inventory` check after the change had already merged from a sibling branch, which is the case that check exists for.

| Version | Date | Change |
|---|---|---|
| **1.13** *(pending)* | on the v3 release | **Not yet in effect.** A browser-based admin portal (`portal.dioreo.app`) was added, reachable only by the owner and granted admins. New §2.1c describes its two records — a **portal session** (hashed session id, Discord user ID, timestamps, device/browser string) and a **staged change (Changeset)**. Named in §5's MongoDB Atlas row and §7's retention table: sessions expire after 12 hours, abandoned staged changes after 30 days. **No Discord token is retained**, and the device/browser string is a new category of data, described in full in §2.1c. The session record was later found to also carry the admin's Discord username, display name and avatar hash, shown in the portal's own header. **No new recipient.**
| **1.12** *(pending)* | on the v3 release | **Not yet in effect**, and takes effect alongside 1.11. The Bot now keeps its own **interaction records** — one per command, button, dropdown or search — described in new §2.4b, listed in Appendix A, named in §5's MongoDB Atlas row, and given **indefinite** retention in §7. **A genuine expansion of what is collected, not a clarification.** You are identified by a **keyed hash (HMAC-SHA256)**, never by your Discord ID; **no third party is involved and there is no new recipient**; and it is **never used to personalise anything for any individual**. The "no analytics/tracking/profiling" statements in §0, §3 and Appendix C are made **precise** rather than removed. Typed search text is recorded once per search, lowercased and capped at 100 characters — this is command input, **not** message content, and §3's Message Content claim is untouched. The same change **deleted** the `RenderTiming` log, migrating its rows with the Discord ID replaced by the keyed hash: this release removes a store of raw user IDs while adding one that never holds them. |
| **1.11** *(pending)* | on the v3 release | **Not yet in effect.** The Bot will read your Discord **server profile** in servers you have set one for, so §2.2 describes it and Appendix A names the ten new cached colour fields. **No new kind of data, no new recipient, no longer retention** — they hold the same derived hex code and asset hash the existing colour fields hold, kept separately so a server-profile colour and an ordinary-profile colour do not overwrite one another. The same release adds `/admin`, so new §2.1a and Appendix A describe the separate `GuildSettings` record it creates — keyed to a **server** ID, its only personal data being the Discord user ID of whoever last saved a change. **No new recipient, no longer retention**, and a server rule can only make the Bot quieter, never louder than a user asked for. The same release adds an **admin allowlist**, **announcement**, and **change log** record — see the matching row in §12.1's revision history for the full description; the change log entries are retained 180 days/5,000 rows, the only one of the three not kept indefinitely. |
| **1.10** | 6 August 2026 | Google Cloud Error Reporting was enabled and is named in §2.4a, §5's provider table and §7's retention table. **No change to what is collected, why, or how long it is kept** — it groups errors already present in the server logs §2.4a described, in the same project and region, for the same 30 days. |
| **1.9** | 5 August 2026 | §5's MongoDB Atlas row and §5.1 now note that the same cluster also holds the operational alert log §2.4 already describes, not only `UserPreference`. **No change to what is collected, why, who receives it, or how long it is kept.** |
| **1.8** | 4 August 2026 | Renamed from Dior's Builds to Dioreo. §1 records the former name and confirms the controller is unchanged. **No change to what is stored, why, who receives it, or how long it is kept** — no new controller, processor, recipient or purpose, and Appendix A is identical to 1.7. |
| **1.7** | 4 August 2026 | §2.6 corrected: it still said the Site stored **one** item and that nothing is written unless you press the light/dark switch, neither of which had been true since `db-booted` arrived in 1.6, and the no-consent-banner argument reached only the switch. Each statement now names the item it applies to and the strictly-necessary basis is argued for both. **No change to what is stored, why, who receives it, or how long it is kept.** |
| **1.6** | 3 August 2026 | §2.6 and Appendix A now list the Site's **second** browser-storage item, `db-booted`, a session-storage flag set on the What's New, Changelog and Devlog pages so their opening animation plays once per browsing session. It has been written since those pages launched, while the policy said `db-theme` was the only key — the verification note had searched the GENERATOR and the flag is written by `scripts/lib/chronicle.js`, so it was never in scope. The note now searches the BUILT pages. **No change to what is collected, why, who receives it, or how long it is kept:** the flag holds `1`, never reaches any server, and is discarded when the tab closes. |
| **1.5** | 1 August 2026 | Appendix A now names `decorationColorHex` and `nameplateColorHex`, which were stored but not listed, and names the four `*PaletteSource` fields individually rather than as "(+ source hashes)". **No change to what is collected, why, who receives it, or how long it is kept** — these fields were already being stored and are already described by §2; the appendix was an incomplete transcription of them. A build check now compares the appendix against the live schema so it cannot drift again. |
| **1.4** | 1 August 2026 | Added Discord (diorswrld) as a second contact route in §1 and §13, alongside the canonical email. A Privacy Request under §9 must still come by email. |
| **1.3** | 1 August 2026 | Broadened the closing non-affiliation notice to name TiMi Studio Group, Tencent, and the rights holders of licensed in-game content, matching the notice the Site already carried. No change to any right or obligation. |
| **1.2** | 31 July 2026 | Documented the Site's single `db-theme` local-storage item (§2.6); corrected the "there is no website" statement in §3. |
| **1.1** | 29 July 2026 | Added the controller's `diorswrld` alias. |
| **1.0** | 28 July 2026 | Initial policy. |

Future revisions will be listed here. The complete drafting history is kept in the repository's git log.



## Appendix C — How each claim was verified

A privacy policy is a set of **enforceable representations**. Saying more than is true is worse than saying nothing. Every factual claim in this policy was checked against the running software rather than asserted, and this table records how.

| Claim | How it was verified |
|---|---|
| We cannot read your messages | The Discord client is constructed with `GatewayIntentBits.Guilds` only — no Message Content intent. Verified in `index.js`. |
| No third-party analytics, telemetry, or tracking | Searched the codebase for third-party analytics and error-reporting SDKs (Sentry, PostHog, Mixpanel, Google Analytics). **None present.** The Bot's own interaction records (§2.4b) are written to our own MongoDB Atlas database by `utils/eventStore.js` and reach no one else. |
| The interaction record never contains a raw Discord ID | An automated test (`scripts/eventStore.test.js`) serialises a finished record and **string-searches it** for the raw ID — not a field-by-field review, which would miss one carried inside a detail value or an embedded component identifier. It is wired into the project's test suite, and it was itself verified to fail when the protection is disabled. |
| The hash cannot be reversed from the database alone | `utils/requestContext.js` computes HMAC-SHA256 with `ANALYTICS_HMAC_KEY`, which is read from the server's environment and is never written to any collection. |
| The exact fields we store | Read directly from the `UserPreference` Mongoose schema. Appendix A is a transcription of it, not a summary. |
| Alert logs deleted after 30 days | `RETENTION_DAYS = 30` in `utils/alertStore.js`, with a matching `deleteMany` on `createdAt`. |
| Server logs deleted after 30 days | Google Cloud Logging default retention, as relied on by `scripts/vmstatus.sh`. |
| Your data is stored in Canada | Resolved the Atlas cluster's DNS records to `mtm-azure-**canatral**-…` — Azure Canada Central, Toronto. |
| Cloudinary stores in the US | Cloudinary's published documentation: standard accounts default to US storage; EU residency is an Enterprise option. |
| We use Vertex AI, not the consumer Gemini API | The request endpoint in `utils/visionExtract.js` is `aiplatform.googleapis.com`, project- and location-scoped — not `generativelanguage.googleapis.com`. |
| No AI receives end-user data | `/autobuild` is the only AI call site and is gated on the administrator's Discord ID. |
| Admin commands are locked to one account | `ALLOWED_ADMIN_ID` (declared in `utils/owner.js` as of the portal operation core) guards in `commands/manage.js`, `commands/autobuild.js`, and the central interaction router. |
| **There is no automated deletion** | Searched for every `deleteOne` / `deleteMany` / `findOneAndDelete` in the codebase. **None operates on `UserPreference`.** This is why §7.1 discloses a shortcoming instead of claiming a capability. |
| `/settings` has no reset or delete | Searched `commands/settings.js` for reset/restore-default handling. None exists — it only overwrites individual values. |
| No cookies | The Bot has no web surface. Cloudflare serves these documents; that is the only web interaction. Checked the generated site for `document.cookie` — no occurrences. |
| Two storage items on the Site | Searched the built pages, not just the generator, for `localStorage`, `sessionStorage` and `document.cookie`: `db-theme` (`light`/`dark`, written by `THEME_JS`/`THEME_BOOT` in `scripts/buildLegalPages.js`) and `db-booted` (`1`, written by `scripts/lib/chronicle.js` on the three record pages). No cookies are set. Nothing else is stored, and nothing is sent anywhere. |

**Where we could not verify something, we said so rather than guessing** — see the backup-retention caveat in §9.4 and the honest limits stated in §5.2, §7.1, and §8.

You are welcome to check any of this yourself, or to ask us to show you the relevant code.



*Dioreo is an unofficial fan project and is not affiliated with Activision Publishing, Inc., TiMi Studio Group, Tencent, Discord Inc., or with the rights holders of any content the game features under licence.*
