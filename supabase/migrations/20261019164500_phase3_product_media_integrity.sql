begin;

-- JSON gallery associations need the same lifetime protection as relational media.
create index products_media_references on public.merch_products using gin(images jsonb_path_ops);

create function private.lock_product_media() returns trigger language plpgsql security definer set search_path='' as $$
declare mid uuid; image public.media;
begin
 for mid in
  select distinct split_part(value->>'src','/',4)::uuid
  from jsonb_array_elements(new.images)
  where value->>'src' ~ '^/api/media/[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}/$'
  order by 1
 loop
  select * into image from public.media where id=mid for update;
  if image.id is null or image.bucket<>'destination-public' or image.status<>'ready' then
   raise exception 'Choose an available public product photo' using errcode='23514';
  end if;
 end loop;
 return new;
end $$;

create function private.protect_product_media() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_op='UPDATE' and new.status='ready' and new.bucket='destination-public' then return new; end if;
 if exists(select 1 from public.merch_products where images @> jsonb_build_array(jsonb_build_object('src','/api/media/'||old.id::text||'/'))) then
  raise exception 'Image is still associated with merchandise' using errcode='23503';
 end if;
 if tg_op='DELETE' then return old; end if;
 return new;
end $$;

-- Trigger-only helpers cannot be called as an elevated browser API.
revoke all on function private.lock_product_media(),private.protect_product_media() from public,anon,authenticated;
create trigger products_lock_media before insert or update of images on public.merch_products for each row execute function private.lock_product_media();
create trigger media_protect_products before delete or update of status,bucket on public.media for each row execute function private.protect_product_media();
commit;
