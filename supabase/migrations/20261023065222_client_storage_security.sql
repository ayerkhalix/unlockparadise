begin;

-- Public Storage URLs bypass object RLS. Move every public image linked to a
-- protected destination (including all its sizes) into the private bucket before
-- uploading. Metadata IDs and object paths stay unchanged.
update public.media m set bucket='destination-private'
where m.bucket='destination-public' and exists (
 select 1 from public.place_media pm join public.places p on p.id=pm.place_id
 where pm.media_id=m.id and p.vip_content
);
update public.media_files f set bucket='destination-private'
where f.bucket='destination-public' and exists (
 select 1 from public.place_media pm join public.places p on p.id=pm.place_id
 where pm.media_id=f.media_id and p.vip_content
);

-- A private size variant needs the same parent-media permission as the original.
-- Original archives remain staff-only under the separate archive policy.
alter policy destination_storage_read on storage.objects using (
 bucket_id='destination-public' or (
  bucket_id in ('destination-private','profile-private') and (
   exists(select 1 from public.media m where m.bucket=objects.bucket_id
    and m.object_path=objects.name and private.media_visible(m.id))
   or exists(select 1 from public.media_files f where f.bucket=objects.bucket_id
    and f.object_path=objects.name and private.media_visible(f.media_id))
  )
 )
);

commit;
