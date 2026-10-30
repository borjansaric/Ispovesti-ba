-- Apply only in the approved launch operation, after the isolated backend is verified.
begin;
do $approval$ begin if current_setting('ispovesti.launch_approval',true) is distinct from 'production-launch-v1' then raise exception 'Nedostaje odobrenje za glavni sajt.';end if;end $approval$;
select cron.schedule('community-live-publish-hourly','* * * * *','select community_live.publish_one();');
update community_live.publisher set paused=false,last_published_at=clock_timestamp(),started_at=clock_timestamp() where singleton;
commit;
