-- ISOLATED TEST ONLY. No production project or data is a target.
-- Retention and legal basis are intentionally not selected for production.
begin;
create schema admin_metrics_probe;
revoke all on schema admin_metrics_probe from public,anon,authenticated;
grant usage on schema admin_metrics_probe to service_role;
create table admin_metrics_probe.events (
 id bigint generated always as identity primary key,
 section text not null check(section in ('site','chat')),
 event_type text not null check(event_type in ('visit','view','heartbeat','message')),
 visitor text not null check(length(visitor) between 1 and 128),
 occurred_at timestamptz not null default clock_timestamp()
);
create index metrics_probe_section_time on admin_metrics_probe.events(section,occurred_at);
alter table admin_metrics_probe.events enable row level security;
revoke all on admin_metrics_probe.events from public,anon,authenticated;
grant all on admin_metrics_probe.events to service_role;
grant usage,select on all sequences in schema admin_metrics_probe to service_role;
commit;
