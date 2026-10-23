# Migration report

Status: **hosted development content import and reconciliation PASSED**. Authenticated acceptance remains blocked; bulk media migration is deferred.

Verified source: 28 tables, 21 accounts, 3,431 attachments, 384 published SQL Places, 383 published XML Places, 4 areas, 8 categories and 7 reviews. The ordinary WordPress comment is not a Place review.

Prepared: 383 Places/details, 380 area relations, 379 category relations, 2,928 cover/gallery relations, 8 category-thumbnail relations, 11 legacy redirects, 3,431 media records and 20,124 additional files. Missing taxonomy assignments remain absent; they are not invented.

Excluded Place: source ID **5693**, slug/title `title`. It is the only published SQL Place absent from the complete XML baseline. This matches the developer's confirmation of one manual test record. The source SQL, XML and live WordPress record remain untouched.

Source **3991** has an invalid coordinate pair. Raw fields are retained in restricted legacy metadata; normalized coordinates are null and the report flags it. No coordinate is guessed.

The actual generated SQL was applied twice to embedded PostgreSQL. Counts, separate premium flags, taxonomy links, gallery ordering, source IDs and sampled coordinate precision reconciled. The confirmed development project now contains the imported destination/attachment metadata. No Auth accounts or Storage objects were created. The 7 legacy reviews and account-owned data remain staged until identity migration approval.

Commands:

```powershell
npm run migration:audit
npm run migration:prepare -- --write
npm run migration:content                 # dry-run; prints only a checksum
npm run test:backend
```

After configuring an isolated project, review the generated private manifest and transactional SQL. Pin `MIGRATION_PROJECT_REF`, set `UPD_ENVIRONMENT=staging`, and only then use `npm run migration:content -- --apply`. The runner checks that the database target matches the pinned reference and suppresses database notices. Execute `npm run migration:reconcile` after upload.

Generated content/identity manifests and SQL live in ignored `artifacts/backend-private/`. Sanitized reports live in ignored `artifacts/`. References remain ignored and read only. They are excluded from deployment tracing; move original sensitive backups to separately access-controlled storage outside the application workspace as part of operator backup management, without changing the read-only source material during this task.

Delta content created after this backup must be reconciled from a fresh export before cutover. The importer deliberately stops if the 383-place initial baseline changes; it does not silently classify new customer content as a test.

## Hosted checkpoint

Project `iitblbdqztuxdzpaetie` was confirmed by the user before writes and was initially empty. Nine migrations were applied. The existing manifest supplied 179 connector batches, importing 28,041 rows. All 12 table counts/content digests match; only generated creation/update timestamps are excluded, and publication timestamps are normalized to UTC. Media remains `legacy`, not cloud-verified `ready`; variants remain pending. Source SQL SHA-256 is unchanged. See [Supabase integration](SUPABASE_INTEGRATION_REPORT.md) and ignored `artifacts/staging-content-reconciliation.json`. Use `migration:reconcile -- --metadata-only` to accept metadata separately from Storage after configuring the server key. Hosted imports do not require uploading the media library.
