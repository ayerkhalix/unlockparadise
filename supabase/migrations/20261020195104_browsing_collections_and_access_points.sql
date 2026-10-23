begin;
create table public.merch_brands (
 id uuid primary key default gen_random_uuid(),
 name text not null check(length(btrim(name)) between 1 and 100),
 slug text not null unique check(slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
 created_at timestamptz not null default now()
);
create unique index merch_brand_name on public.merch_brands(lower(name));
create table public.merch_collections (
 id uuid primary key default gen_random_uuid(),
 brand_id uuid not null references public.merch_brands(id) on delete restrict,
 name text not null check(length(btrim(name)) between 1 and 100),
 slug text not null check(slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
 created_at timestamptz not null default now(),
 unique(brand_id,slug), unique(id,brand_id)
);
create unique index merch_collection_name on public.merch_collections(brand_id,lower(name));
create table public.merch_options (
 id uuid primary key default gen_random_uuid(),
 kind text not null check(kind in ('category','color','size')),
 name text not null check(length(btrim(name)) between 1 and 80),
 unique(kind,name)
);
insert into public.merch_brands(id,name,slug) values('00000000-0000-4000-8000-000000000b01','Unlock Paradise','unlock-paradise');
insert into public.merch_collections(id,brand_id,name,slug) values('00000000-0000-4000-8000-000000000c01','00000000-0000-4000-8000-000000000b01','Unlock Paradise Collection','unlock-paradise-collection');
insert into public.merch_options(kind,name)
select 'category',category from public.merch_products union select 'color',content->>'color' from public.merch_products where coalesce(content->>'color','')<>''
on conflict do nothing;
insert into public.merch_options(kind,name) values
 ('category','Tees'),('category','Hoodies'),('category','Headwear'),('category','Bags'),
 ('color','Navy'),('color','Sand'),('color','Natural'),('color','Black'),('color','White'),('color','Green'),('color','Blue'),('color','Gray'),('color','Red'),('color','Multicolor'),
 ('size','One Size'),('size','XS'),('size','S'),('size','M'),('size','L'),('size','XL'),('size','XXL'),('size','3XL') on conflict do nothing;
alter table public.merch_products
 add column brand_id uuid not null default '00000000-0000-4000-8000-000000000b01' references public.merch_brands(id),
 add column collection_id uuid not null default '00000000-0000-4000-8000-000000000c01' references public.merch_collections(id),
 add constraint product_collection_brand foreign key(collection_id,brand_id) references public.merch_collections(id,brand_id);
create index merch_product_brand on public.merch_products(brand_id);
create index merch_product_collection_brand on public.merch_products(collection_id,brand_id);
alter table public.merch_brands enable row level security;
alter table public.merch_collections enable row level security;
alter table public.merch_options enable row level security;
grant select on public.merch_brands,public.merch_collections,public.merch_options to anon,authenticated;
grant insert on public.merch_brands,public.merch_collections,public.merch_options to authenticated;
grant all on public.merch_brands,public.merch_collections,public.merch_options to service_role;
create policy brand_read on public.merch_brands for select using(true);
create policy collection_read on public.merch_collections for select using(true);
create policy option_read on public.merch_options for select using(true);
create policy brand_create on public.merch_brands for insert to authenticated with check((select private.is_admin()));
create policy collection_create on public.merch_collections for insert to authenticated with check((select private.is_admin()));
create policy option_create on public.merch_options for insert to authenticated with check((select private.is_admin()));

alter function private.admin_save_product(integer,integer,jsonb) rename to admin_save_product_before_collections;
revoke all on function private.admin_save_product_before_collections(integer,integer,jsonb) from public,anon,authenticated;
create function private.admin_save_product(pid integer,expected_version integer,body jsonb) returns integer language plpgsql security definer set search_path='' as $$
declare result_id integer; bid uuid; cid uuid;
begin
 if not private.is_admin() then raise insufficient_privilege; end if;
 -- The original function still owns locking, conflict checks and variant integrity.
 result_id=private.admin_save_product_before_collections(pid,expected_version,body);
 select coalesce((body->>'brand_id')::uuid,p.brand_id),coalesce((body->>'collection_id')::uuid,p.collection_id) into bid,cid from public.merch_products p where p.id=result_id;
 if not exists(select 1 from public.merch_collections where id=cid and brand_id=bid) then raise exception 'Choose a collection belonging to this brand' using errcode='22023'; end if;
 update public.merch_products set brand_id=bid,collection_id=cid where id=result_id and (brand_id<>bid or collection_id<>cid);
 return result_id;
end $$;
revoke all on function private.admin_save_product(integer,integer,jsonb) from public,anon;
grant execute on function private.admin_save_product(integer,integer,jsonb) to authenticated;

create function private.valid_access_points(points jsonb) returns boolean language plpgsql immutable set search_path='' as $$
declare p jsonb;
begin
 if jsonb_typeof(points) is distinct from 'array' or jsonb_array_length(points)>12 then return false; end if;
 for p in select value from jsonb_array_elements(points) loop
  if jsonb_typeof(p) is distinct from 'object' or
     jsonb_typeof(p->'name') is distinct from 'string' or length(btrim(p->>'name')) not between 1 and 120 or
     coalesce(p->>'type','') not in ('Boat departure','Drop-off','Trailhead','Parking') or
     jsonb_typeof(p->'latitude') is distinct from 'number' or (p->>'latitude')::numeric not between -90 and 90 or
     jsonb_typeof(p->'longitude') is distinct from 'number' or (p->>'longitude')::numeric not between -180 and 180 or
     jsonb_typeof(p->'directions') is distinct from 'string' or length(p->>'directions')>1000 or
     (select count(*) from jsonb_object_keys(p))<>5 then return false; end if;
 end loop;
 return true;
exception when others then return false;
end $$;
revoke all on function private.valid_access_points(jsonb) from public;
grant execute on function private.valid_access_points(jsonb) to authenticated,service_role;
alter table public.place_details add column access_points jsonb not null default '[]' check(private.valid_access_points(access_points));
alter function private.admin_save_place(uuid,jsonb) rename to admin_save_place_before_access_points;
revoke all on function private.admin_save_place_before_access_points(uuid,jsonb) from public,anon,authenticated;
create function private.admin_save_place(pid uuid,body jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare result_id uuid;
begin
 if not private.is_staff() then raise insufficient_privilege; end if;
 result_id=private.admin_save_place_before_access_points(pid,body);
 if body ? 'access_points' then
  update public.place_details set access_points=body->'access_points' where place_id=result_id;
 end if;
 return result_id;
end $$;
revoke all on function private.admin_save_place(uuid,jsonb) from public,anon;
grant execute on function private.admin_save_place(uuid,jsonb) to authenticated;
commit;
