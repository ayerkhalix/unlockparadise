# Database security verification

`npm run test:backend` applies the actual SQL migrations to embedded PostgreSQL and tests anonymous, Explorer, Explorer+, expired, revoked, administrator AAL1/AAL2, user ownership, privilege escalation, storage policies, payments and transactional admin mutations.

The embedded harness supplies minimal Supabase Auth/Storage schemas and JWT helper functions. It does not emulate GoTrue, PostgREST, Storage HTTP or provider APIs. Hosted acceptance tests remain mandatory. Use an isolated Supabase project with synthetic accounts, then run `npm run test:staging` to verify configuration and access through the real HTTP services. No customer migration is required for these tests.
