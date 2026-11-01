# Review and note refinements

- Reviews retain the traveler identity title and remove the interest chips.
- Only the author gets the three-dot menu at the card's top right. Edit uses the existing review form in a shared modal; Delete retains confirmation. The heart remains on the right.
- Review edits validate ownership, the timestamp precondition, content bounds, destination access and the existing review-writing gate. Revisions follow moderation settings. A database guard prevents author-controlled approval, identity or creation-date changes while preserving staff moderation.
- Notes appear as plain text below the destination category with a pencil and Edit note control. Empty notes show Add note. The existing overall Save changes flow commits notes and times; closing the editor keeps the draft.

The additive migration is 20261101143808_review_owner_editing.sql. It was applied to the pinned staging project in a transaction, with prior review policies backed up locally. Its guard is security invoker and is not directly executable by anonymous or authenticated API callers. No existing review was rewritten by the migration.

Verification: all 145 backend tests, production build and ESLint pass. Four Chrome desktop/phone workflows and two Safari/WebKit phone workflows pass, including owner-only access, menu Escape behavior, editing, preserved failed drafts, stale/foreign rejection and confirmed deletion. The existing batch-save/retry/Explore/Undo regression also passes on Chrome phone. Browser-created reviews and itinerary fixtures are removed after exact title checks. Broader Premium static audits were unavailable in the preceding pass; no complete static/security-advisor scan is claimed. Evidence is in ignored artifacts/review-options.
