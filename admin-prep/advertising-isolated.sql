-- ISOLATED REVIEW/TEST ONLY. No existing project, schema or data is a target.
begin;
create schema admin_ad_probe;
revoke all on schema admin_ad_probe from public,anon,authenticated;
grant usage on schema admin_ad_probe to service_role;
create table admin_ad_probe.advertisers (
 id uuid primary key, name text not null check(length(trim(name)) between 1 and 120)
);
create table admin_ad_probe.bookings (
 id uuid primary key, advertiser_id uuid not null references admin_ad_probe.advertisers(id),
 month date not null check(extract(day from month)=1), slot smallint not null check(slot between 0 and 33),
 price_fening integer not null default 10000 check(price_fening>=0),
 payment_status text not null default 'unpaid' check(payment_status in ('unpaid','paid')),
 unique(month,slot)
);
create table admin_ad_probe.impressions_daily (
 booking_id uuid not null references admin_ad_probe.bookings(id), day date not null,
 impressions bigint not null default 0 check(impressions>=0), primary key(booking_id,day)
);
create table admin_ad_probe.impression_receipts (
 booking_id uuid not null references admin_ad_probe.bookings(id),day date not null,view_id uuid not null,
 primary key(booking_id,day,view_id)
);
alter table admin_ad_probe.advertisers enable row level security;
alter table admin_ad_probe.bookings enable row level security;
alter table admin_ad_probe.impressions_daily enable row level security;
alter table admin_ad_probe.impression_receipts enable row level security;
revoke all on all tables in schema admin_ad_probe from public,anon,authenticated;
grant all on all tables in schema admin_ad_probe to service_role;
commit;
