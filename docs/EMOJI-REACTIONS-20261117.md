# Emoji reactions — test implementation

This feature is isolated to the `community_test` schema and the `/test/` application.

## Behaviour
- Existing 👍 and 👎 votes remain separate from emoji reactions.
- Pressing either vote control records/updates the vote and opens the six-choice emoji picker: ❤️, 😂, 😢, 😮, 🤗, 😡.
- A user can hold one emoji reaction per content item. The unique key is (content_id, user_id).
- The emoji window starts with the user's first emoji choice, not with the 👍/👎 vote. One different emoji may be chosen during that ten-minute window; that single change locks the reaction immediately. If no change is used, the reaction locks automatically when ten minutes pass.
- The existing 👍/👎 vote lock remains a separate rule and is enforced independently by its own status.
- Emoji counts remain hidden until ten minutes have elapsed from the first emoji choice, even if the one permitted change caused the reaction to lock earlier.
- The long-press control is unlocked from the emoji reaction status, not the separate 👍/👎 vote status. It becomes available when the reaction is locked (after the one permitted change or after the ten-minute window expires).
- Aggregate counts remain hidden until the full ten minutes from the first emoji choice have elapsed; a long press before then explains that statistics are not yet available.
- Individual users' reactions are never exposed; only the current user's own selection and aggregate totals are returned.
- The same vote/reaction component is used by confessions, comments, and replies.

## Safety and isolation
- Server-side identity comes from the authenticated anonymous session, never from a client-supplied user ID.
- The table and RPC are in `community_test`; no `community_live` objects are referenced.
- The test Edge Function routes the authenticated actions through the existing server-side dispatcher.
- No production code or live schema is changed.

## Validation
- Applied the test-only migrations to Supabase project `roxajqagksffbsbzdrap`.
- SQL transaction checks confirmed that a new reaction is accepted during the window and aggregate statistics are returned after the ten-minute lock. Test transactions were rolled back.
- Browser rendering and end-to-end interaction still need a published test-preview run.
