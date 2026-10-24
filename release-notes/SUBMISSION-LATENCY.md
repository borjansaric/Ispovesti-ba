# Test submission latency — 2026-10-24

Scope: `/test/`, isolated `community_test` only. Root index remains blob `9f83f627a4917953a70b4efe9c01a05a5c130372`.

Measured before: SQL comments read 7.028 ms, full comment submit dispatcher (transaction rolled back) 18.972 ms. After idempotency migration: 19.364 ms. Live function logs across mixed actions: Frankfurt successful POST median 252 ms / p95 622 ms; US median 784 ms / p95 1188 ms. These are function execution times, not end-to-end mobile submit times or submit-only samples.

A negative-token probe measured Auth, authoritative settings lookup and Siteverify independently with numeric-only `Server-Timing`. Negative-token Siteverify is not a successful challenge latency measurement. Remote test-host wall time includes substantial network overhead and cannot represent the owner's Android connection.

The old client runs the challenge after pressing Send, even when invisible. The new client starts one action-bound challenge per active form on focus/input, joins an existing pending challenge, reuses a fresh unused token, and renews after 240 seconds. It never reuses a consumed token. Public settings cache expires after 60 seconds; the server still checks the authoritative config every submit and Siteverify hostname/action/time/replay on every attempt. API calls target the DB's Frankfurt region; preflight is reusable for 600 seconds. Auth sessions are prepared concurrently with typing. No Auth bypass or cached authorization.

The saved server receipt is rendered without fetching all comments. A reply opens its branch immediately after server confirmation. Session, browser CAPTCHA wait, submit round trip, rendering and total durations are available as bounded User Timing measures; the last completed form stores numeric durations in `data-submission-timing`. The gateway exposes numeric-only Server-Timing, never tokens, text, email or credentials.

Client single-flight guard blocks simultaneous form submissions. UUID request ID stays stable for an unchanged draft after uncertain failure, changes for a changed draft/new deliberate submission. Private RLS-denied submission_receipts binds UUID to verified author and payload; atomic transaction and advisory lock return the original committed result on retry, reject conflicting payloads and removed content. CAPTCHA verification remains mandatory before receipt replay. Intentional duplicate text still requires the existing explicit confirmation and a new UUID.

Verification: 63 passing local tests and GitHub CI, including token preparation/expiry/failure/action isolation, replay/conflict/ownership/removed-content/ACL and CAPTCHA-negative cases. UI-only browser fixture tests the same app at 390×844 without writing any server data. Real Cloudflare in the cloud browser asks for manual human confirmation, so no successful real-token end-to-end time is claimed. The 1–2 second target must be measured on a normal visitor connection; it is not guaranteed.

Migration adds one private test-only table and replaces the test-only dispatcher. Existing content hash and legacy row counts unchanged. No legacy permissions, tables, functions, homepage or CAPTCHA protection altered. Existing database backup plus before-change GitHub backup branch retained.
