# Supabase integration report

Date: 2026-10-18, Asia/Manila. Status: **database/public integration PASSED; authenticated acceptance BLOCKED**.

The user confirmed project `iitblbdqztuxdzpaetie` as the isolated Unlock Paradise development target. It is ACTIVE_HEALTHY in `ap-south-1`, PostgreSQL 17.11. Before mutations it had zero application tables, migrations, Auth users, buckets and Storage objects. No second project was created.

The connector applied and verified these migrations. Local filenames now use the exact recorded remote versions; the original six migration bodies were preserved.

| Version | Name |
|---|---|
| 20261018151649 | core |
| 20261018151650 | admin_payments_storage |
| 20261018151652 | admin_operations |
| 20261018151654 | queries |
| 20261018151655 | hardening |
| 20261018151700 | workflow_guards |
| 20261018152116 | staging_media_and_grants |
| 20261018153642 | public_teasers_and_indexes |
| 20261018154357 | private_rpc_implementations |

All 27 domain tables have RLS, with 51 public/Storage policies. Hosted default function ACLs differed from the embedded harness: anonymous execute grants on guarded member/admin RPCs were explicitly revoked. Privileged implementations now live in the unexposed private schema behind invoker wrappers. The final hosted security advisor returned zero findings. Foreign-key indexes and row-independent policy lookups were improved. Remaining performance notices concern overlapping staff/read policies, unused indexes in a new development database and the nullable-XOR taxonomy association table's lack of a primary key; its relationship uniqueness constraints remain enforced.

The existing manifest pipeline supplied 179 connector SQL batches, importing 28,041 rows across 12 tables. This adapter transports the existing mappings; it does not re-parse WordPress or create competing mappings. Each batch is transactional and replayable. Completion was accepted only after all table counts and normalized content digests matched the embedded expected database. Representative area, Place and image-association batches were then replayed on the hosted database; all 12 table digests remained unchanged. UTC normalization avoids timestamp-rendering differences; only generated `created_at`/`updated_at` fields are excluded from digest checks. Imported publication dates, coordinates, flags, text, metadata, slugs, IDs, paths and checksums are included. A Windows SQL writer newline issue was also corrected without changing source files.

`.env.local` contains the connected URL, publishable key and pinned reference. Its server secret remains empty; no secret was retrieved, printed or committed. `UPD_DATA_MODE=supabase` uses live queries and never falls back on query failure. Fixtures are permitted outside production only; production requires backend configuration. Database failures log a safe category/code without query bodies or account data.

The current development database occupies approximately 34.4 MB. It has 383 production Places, 3,431 legacy attachment rows and 20,124 variant/original metadata rows. Auth users and Storage objects remain zero. No customer account migration, legacy media upload, customer mail, provider checkout, production deployment or WordPress mutation was performed.

To continue authenticated acceptance, configure the development project's `SUPABASE_SECRET_KEY` locally, then run:

```powershell
npm run staging:fixtures -- --apply
npm run dev
npm run test:staging
npm run test:staging:authenticated
```

The fixture command creates four synthetic `.invalid` identities without email delivery, trusted active/expired test grants and a trusted administrator role. Its credentials and later TOTP material stay in ignored `artifacts/staging-private/`. This runner is prepared, but its authenticated flows have not executed while the key is absent. Email verification/reset delivery also require approved SMTP/test inbox configuration; PayMongo requires test credentials and webhook reachability.

Remaining performance advisor references (security findings are zero):

- [no_primary_key (1)](https://supabase.com/docs/guides/database/database-linter?lint=0004_no_primary_key)
- [unused_index (25)](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index)
- [multiple_permissive_policies (17)](https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies)
