-- Business conflicts and missing trips are client errors, not retryable database
-- transaction failures. PT status codes are propagated by PostgREST without 5xx retries.
do $migration$
begin
 execute replace(replace(
   pg_get_functiondef('private.plan_itinerary(uuid,integer,text,jsonb)'::regprocedure),
   'errcode=''40001''', 'errcode=''PT409'''),
   'errcode=''P0002''', 'errcode=''PT404''');
end
$migration$;
