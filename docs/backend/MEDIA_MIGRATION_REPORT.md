# Media migration report

Status: **all attachment/variant metadata imported and reconciled; full file upload DEFERRED by user**. Remote Storage objects: **0**. Positive authenticated sample uploads are BLOCKED until the server key/synthetic identities exist.

The source contains 3,431 attachment records and 20,124 WordPress size variants/originals: 23,555 file entries, not 23,555 independent photographs. All files exist and checksums/signatures were validated. There are 1,488 stale HEIC declarations whose served files are converted JPEGs; source declarations are preserved separately. Raw HEIC originals remain private archive material.

| Inventory | Bytes |
|---|---:|
| Current attachment/variant layout | 14,911,968,090 |
| Distinct SHA-256 contents (22,786) | 14,607,877,838 |
| Duplicate-content bytes | 304,090,252 |
| destination-public (2,259 entries) | 779,283,366 |
| destination-private (19,294 entries) | 6,277,284,206 |
| media-archive (2,002 entries) | 7,855,400,518 |

Actual layout: 14.91 decimal GB / 13.89 GiB. Unique content: 14.61 GB / 13.60 GiB. The manifest's SHA-256 values and matching lengths establish duplicate groups. The existing object layout preserves attachment/variant paths; it does not silently merge relationships or promise physical deduplication. Both the full layout and deduplicated estimate are reported.

As checked on 2026-10-18, [Supabase's Storage usage documentation](https://supabase.com/docs/guides/platform/manage-your-usage/storage-size) lists 1 GB included on Free and 100 GB on Pro. This set exceeds Free and fits within Pro's included Storage size before other project usage and future growth. Storage size is separate from egress, compute and database quotas. No plan upgrade or bulk upload was performed.

## Delivery before full Storage migration

Attachment IDs, original relative paths, dimensions, alt text, gallery positions, MIME corrections and original metadata are preserved in the development database. Primary rows use `legacy`; variant rows remain `pending`. Neither status claims that a cloud object exists. `ready` remains reserved for verified uploaded objects.

`LEGACY_PUBLIC_MEDIA_BASE_URL` selects the read-only public origin; the current value is `https://unlockparadise.ph/wp-content/uploads/`. Public covers, public teasers and taxonomy imagery resolve through session-scoped metadata reads and retain `large`/`medium_large` variants where used by the source. Only source-classified public media can redirect to that origin.

Private media never redirects to WordPress. Every request first selects metadata using the current user's session and RLS. With `next dev`, staging mode, `LEGACY_PRIVATE_MEDIA_MODE=local` and an explicit `LEGACY_PRIVATE_MEDIA_ROOT`, the server validates the path, realpath boundary and SHA-256 before serving bytes with private/no-store headers. Deployed staging defaults to `unavailable` and serves an authorized placeholder; it has no dependency on the developer's filesystem. Unauthorized requests return 404. No premium access is bypassed.

Five previously copied private images are outside generated public storage; public branding remains public. Original files under reference/ were not edited or moved.

## Future upload commands ? prepared, not executed

```powershell
npm run migration:storage-estimate
npm run migration:media -- --offset=0 --limit=100 --concurrency=4
# FUTURE ONLY, after separate approval and sufficient capacity:
npm run migration:media -- --apply --allow-bulk-media --offset=0 --limit=100 --concurrency=4
npm run migration:reconcile -- --metadata-only
```

Dry-run is the default. More than five uploads require `--allow-bulk-media`; this flag is not authorization to run it now. The uploader pins the staging project, checks local SHA-256/MIME, verifies existing remote content before skipping, never overwrites differing remote bytes, retries safely, caps concurrency at eight and records processed/next offsets and failures. Resume using the recorded offset or replay the same batch idempotently. It downloads and verifies uploaded bytes before marking metadata ready. Full reconciliation still requires all intended objects; metadata-only reconciliation does not claim Storage completion.

Development acceptance uses newly generated tiny synthetic PNGs, not a subset of customer images. Anonymous upload rejection passed against hosted Storage. Positive authenticated public/private uploads, downloads, signed URLs and cleanup remain blocked by the missing server credential.
