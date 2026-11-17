# Emoji reactions — test implementation

This feature is isolated to the `community_test` schema and the `/test/` application.

## Behaviour
- Existing 👍 and 👎 votes remain separate from emoji reactions.
- Pressing either vote control records/updates the vote and opens the six-choice emoji picker: ❤️, 😂, 😢, 😮, 🤗, 😡.
- A user can hold one emoji reaction per content item. The unique key is (content_id, user_id), so the reaction can be changed during the same ten-minute vote window.
- The ten-minute window starts with the user's first vote for that item. After it expires, the vote and emoji reaction are locked.
- Emoji counts are not returned before the vote lock expires.
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
