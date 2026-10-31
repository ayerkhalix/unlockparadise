# Client document changes 1 November 2026

Implemented from the supplied change document and the owner's follow-up decisions:

- [x] White saved-place tab labels, with an underline on the active tab.
- [x] Membership choices at the front of checkout, before benefits and recent payment history on mobile.
- [x] Neutral payment wording and public fixture exclusions, retaining an honest preview-payment disclosure while sandboxed.
- [x] Review cards with author photo, stars, consented traveler identity, date, title and body; heart aligned at the far right in every pointer state.
- [x] Compact empty Portfolio and Bucketlist cards.
- [x] The About Vision image fades into the page at its upper edge.
- [x] Planner destination results appear only for a non-whitespace search and disappear on clearing.
- [x] A Notes/Add note button opposite the time opens the full-width note field; closing retains edits and the single Save changes action persists them.
- [x] Public profile pictures, explicitly requested by the owner. Current approved avatars are served as binary image responses from a narrowly scoped endpoint; pending, removed and unrelated media remain unavailable. The upload UI states that pictures are public.

Public fixture exclusions leave records intact and manageable in Admin. Existing avatar moderation, private storage buckets, account data, traveler-identity sharing, membership gates, one-time billing and Xendit staging restrictions remain in force. No live payment was created or enabled. No schema or storage-policy migration was needed.

Verification:

- Production build, TypeScript, ESLint and release-secret checks passed.
- All 143 backend tests passed. After neutral payment error-copy changes, 17 focused public-avatar and Xendit tests passed, including account/resource restrictions, storage failures and current-avatar association checks.
- Initial Chrome desktop/phone checks passed checkout, tab/empty state, Vision, notes disclosure and search clearing. The review test exposed a legacy focus/hover margin that moved the heart; the focused selector fix keeps its position stable.
- The confirmation round passed six Chrome desktop/phone journeys, including existing batch-save/retry/Explore/Undo regression coverage. Three Safari/WebKit phone journeys also passed.
- Real anonymous avatar delivery was checked through the website without a redirect or exposed storage location. The pending/removed/non-profile cases are covered in backend tests.
- Static Premium scans of four changed components and then two components stalled and were stopped. This is not a complete static-audit or connector security-advisor pass. Runtime evidence and screenshots are retained in ignored artifacts/client-document-review.

Browser fixture itineraries were removed after exact title checks. Review failure tests intercepted the mutation and did not alter the real review.
