# Approved test-only voting change — 26 October 2026

Applied the unchanged, explicitly approved `supabase/one-vote-change-test.sql`.
SHA-256: `f8e140945f60dd524f6336fcbe9bad932f449ead0bb872d188b4c9b4f81ca2d8`.

## Isolation and preservation

- Main HTML uses `submit-content`, `vote-content9`, `private-user-lists`, with no reference to the community test API/schema. Its verified Git blob remains `9f83f627a4917953a70b4efe9c01a05a5c130372`.
- Main submit/vote Edge Functions use public legacy tables, not community_test.
- Only `community_test.votes`, a test trigger/function, the test-only `public.community_test_dispatch_base` and its test vote response are involved. No shared main-site tables were modified.
- Before execution, no active ten-minute vote windows existed and the extension/backup were absent. Existing migrations were not rerun.
- Recorded row counts and content digests for all 60 existing application tables, plus function digests. Immediately after migration all existing rows/digests matched (excluding only the newly added default column). The only existing function changed was the intended test base dispatcher. All chat functions remained identical.
- `community_test.votes_before_one_change_20261026` is a complete private copy of the previous votes, with RLS enabled and SELECT denied to anon, authenticated and service_role. Existing older backups remain intact.
- All Edge Function versions/source hashes remained unchanged. No frontend, main branch or Pages publication was performed for this SQL activation.

## Actual server verification

Nine real API checks passed with two genuine Supabase anonymous Auth sessions across an existing test confession, main comment and reply:

- Non-voters never receive likes/dislikes totals.
- For each content type, both +1 to -1 and -1 to +1 work exactly once within ten minutes.
- Repeating the original identical vote does not consume the change.
- Attempting to switch back leaves the first changed vote in place, with can_change=false. A fresh cards request retains the lock.
- Early totals remain absent, including after the first change.

Six new verification votes were added only to community_test. There are zero duplicate (content_id,user_id) vote pairs. Original backed-up votes retain their values and first_voted_at.

An additional real-database transaction used a temporary, uncommitted test confession and an eleven-minute-old test vote. It confirmed totals appear to its voter, a later vote cannot change it, a non-voter still cannot see totals, and the original first-vote timestamp is retained. The transaction was rolled back; no existing data was modified or deleted.

Existing global security-advisor warnings were unchanged. The additional RLS/no-policy informational entry is intentional deny-all protection for the private vote backup. No broad privileges or Auth settings were changed.
