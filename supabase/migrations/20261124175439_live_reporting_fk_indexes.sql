-- Cover the new report/reaction user foreign keys without changing row access.
create index if not exists chat_live_reports_user_id_idx
  on chat_live.reports(user_id);

create index if not exists community_live_reactions_user_id_idx
  on community_live.reactions(user_id);
