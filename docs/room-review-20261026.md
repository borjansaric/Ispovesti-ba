> Istorijski izvještaj. Za sadašnje stanje i granice provjere pogledaj CURRENT-SPEC-20261026.md i final-readiness-20261026.md.

# Test room review — 26 October 2026

Scope: only the existing /test/ frontend and chat-test-api. Main public files are preserved byte for byte. No paid SMS provider, billing, subscriptions or payment webhooks are enabled.

## Delivered

- Fullscreen black/gold room; X returns to stories. Avatar and text only; no displayed nicknames or timestamps. Own side is assigned on the server per package, retained across reloads and code device transfers.
- Latest messages at bottom, older pages load by scrolling upward. Server retains the existing rolling 1/7/31-hour access limits. Personal blocking, reports and administrator moderation remain available.
- Compact comment voting, private heart and right-aligned reply count/yellow triangle. Every zero-count arrow opens a reply form. A modal isolates the original comment and flat descendants; backdrop blurs/dims other content, close restores focus and scroll.
- Long privacy/rules text moved into a discreet menu. Personal hiding is distinguished from administrator bans. No claim of end-to-end encryption; access history is distinguished from retention.
- Recovery-key UI removed, existing backend recovery data and original function retained. Admin-only test codes use 96 random bits; only SHA-256 digests enter the database. Codes retain original package expiry, one active session, maximum three session transfers in 24 hours and per-user attempt limits. They grant chat access only and cannot grant Auth/admin privileges.
- Test codes are clearly marked as trials, generated in protected chat administration; no SMS is actually sent. Real provider integration must verify operator callbacks, deduplicate purchase IDs and deliver the code privately before paid activation is enabled.

## Verification

- Existing complete suite: 110 passed, zero failures.
- After discovering the real service role cannot read auth.users, a narrow private boolean predicate replaced direct Auth-table reading. No broad Auth-table grant was added. The affected room suite: 9 passed, zero failures (includes a new service-role regression).
- Real Supabase Auth: 15 successful checks — redemption, retry expiry, server-assigned side, send, idempotency, device transfer, old-session denial, profile continuity, rolling history, five denied administrative actions and comment metadata.
- Browser QA: desktop 1363x936 and mobile iframe 390x844; fullscreen fills both; no horizontal chat/thread overflow; composer remains at bottom; avatars have 0px border; flat replies and blur verified; reply sending/closing, personal blocking, upward pagination (100 to 111 local fixture messages) and own/opposite message sides verified.
- Original SQL prepare-test.sql unchanged: SHA-256 2ddd8682699d47be2ae0134fb499bdbaf83ac912dd1ba7a96806e18af6f23d62.
- Applied only additive room-access.sql and narrow room-auth-check.sql. Seven existing migrations were not rerun. The second file corrects an Auth ACL difference observed on the real server.

## Preservation and recovery

Before the additive extension, 28 database-local snapshots were created under chat_test.snapshot_20261026_*. They contain existing application rows, including private lists and administrator settings/proofs, and remain inaccessible to anon, authenticated and service_role. RLS is enabled. Do not expose, export publicly or delete these snapshots.

Every original row in all 28 tables was verified preserved after the extension. The older private ZIP backup remains intact. Git backup branch backup/before-chat-room-20261026 preserves the previous published version at 5ff4f2f470d9a54b9707bf8e1e333897c9864dc4.

Non-destructive application rollback: restore only /test/ files from that commit and redeploy the former chat-test-api gateway. Leave additive tables/functions/snapshots and all existing rows intact. Do not drop schemas or overwrite tables. Restoring individual data rows, if ever necessary, requires a reviewed selective restore plan.

## Test instructions

1. Open /test/ and use a comment's count/triangle, including zero, to view/write replies. Use the original count/triangle or Escape to return.
2. Open the existing menu and choose Anonimni chat. Existing active test packages continue working. X returns to stories; the top-right menu contains rules/privacy and personal unblock controls.
3. Sign in through the existing /test/admin.html using the unchanged administrator process, then open /test/chat-admin.html. Generate a trial access code for 24h, 7d or 30d; copy only the code, not the adjacent expiry text. Enter it in chat without any payment.
4. Reenter the same code in another browser/session to test continuity. The former session loses chat access; expiry does not move. Keep trial codes private. Existing grant/cosmetic/moderation controls remain protected.

Outstanding: commercial SMS provider, operator verification and delivery, agreed prices, production payment callback/reconciliation, final data-retention policy before a commercial launch. Main-site publication needs a separate explicit approval.
