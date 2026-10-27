begin;
alter table public.media_files add column if not exists width integer check(width > 0);
alter table public.media_files add column if not exists height integer check(height > 0);

-- Only the server may manage upload jobs. Every API call also checks staff and ownership.
create table public.media_upload_jobs (
 id uuid primary key, owner_id uuid not null references auth.users(id),
 media_id uuid not null default gen_random_uuid(),
 bucket text not null check(bucket in ('destination-public','destination-private')),
 source_path text not null unique, source_mime text not null,
 source_bytes bigint not null check(source_bytes between 1 and 20971520),
 source_checksum text not null check(source_checksum ~ '^[a-f0-9]{64}$'),
 alt text not null default '', recipe text not null default 'webp-v1',
 state text not null default 'prepared' check(state in ('prepared','processing','ready','failed')),
 lease uuid, error text, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(owner_id,source_checksum,bucket,recipe)
);
alter table public.media_upload_jobs enable row level security;
revoke all on public.media_upload_jobs from public,anon,authenticated;
grant all on public.media_upload_jobs to service_role;

create function public.complete_media_upload(job_id uuid, lease_id uuid, master jsonb, files jsonb)
returns uuid language plpgsql security invoker set search_path='' as $$
declare j public.media_upload_jobs; f jsonb;
begin
 select * into j from public.media_upload_jobs where id=job_id for update;
 if j.id is null or j.state<>'processing' or j.lease is distinct from lease_id then raise exception 'Upload lease changed' using errcode='40001'; end if;
 if jsonb_typeof(files)<>'array' or jsonb_array_length(files) not between 2 and 8 then raise exception 'Invalid upload files'; end if;
 insert into public.media(id,bucket,object_path,mime_type,byte_size,checksum,width,height,alt,status,metadata)
 values(j.media_id,j.bucket,master->>'object_path',master->>'mime_type',(master->>'byte_size')::bigint,master->>'checksum',
 (master->>'width')::int,(master->>'height')::int,j.alt,'ready',jsonb_build_object('recipe',j.recipe,'upload_job',j.id));
 for f in select value from jsonb_array_elements(files) loop
  if f->>'bucket' not in (j.bucket,'media-archive') then raise exception 'Invalid file bucket'; end if;
  if f->>'bucket'='media-archive' and (f->>'object_path'<>j.source_path or f->>'checksum'<>j.source_checksum or (f->>'byte_size')::bigint<>j.source_bytes) then raise exception 'Original mismatch'; end if;
  insert into public.media_files(media_id,variant,bucket,object_path,original_path,mime_type,byte_size,checksum,status,width,height)
  values(j.media_id,f->>'variant',f->>'bucket',f->>'object_path',f->>'object_path',f->>'mime_type',(f->>'byte_size')::bigint,f->>'checksum','ready',(f->>'width')::int,(f->>'height')::int);
 end loop;
 update public.media_upload_jobs set state='ready',lease=null,error=null,updated_at=now() where id=j.id;
 return j.media_id;
end $$;
revoke all on function public.complete_media_upload(uuid,uuid,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.complete_media_upload(uuid,uuid,jsonb,jsonb) to service_role;
commit;
