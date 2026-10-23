# Interest analytics

No connected PostHog tool was exposed for this task; the implementation uses a provider-independent first-party store. Optional collection is off by default. Privacy preferences can allow or withdraw it; browser Do Not Track / Global Privacy Control and automated browsing disable client collection. Admin/preview pages are excluded.

| Event                                       | Trigger                                                        |
| ------------------------------------------- | -------------------------------------------------------------- |
| place_viewed                                | A permitted Place detail mounts after consent                  |
| place_saved / place_removed_from_bucketlist | Successful persisted Bucketlist action                         |
| place_added_to_itinerary                    | Successful planner or cross-site picker addition               |
| itinerary_created                           | Successful new-trip persistence                                |
| product_viewed                              | Published product detail after consent                         |
| product_added_to_bag                        | Successful local bag addition; never a sale                    |
| checkout_started / order_paid               | Reserved; public merch checkout is closed; not client-ingested |

The endpoint validates a fixed schema, consent flag, published entity and applicable persisted member state. It requires same-origin mutation requests, limits request size and rate, assigns server timestamps, and accepts no arbitrary payload, credentials, account identity, notes, precise location or client date. Session identifiers are random per browser tab session. Client-reported interest is not trusted payment evidence.

Event IDs deduplicate retries. View uniqueness is `(session, event, entity, Manila date)`. Other successful actions count events, so repeated legitimate actions remain distinct. Aggregation is Owner AAL2 only, uses inclusive Asia/Manila date boundaries and at most 93 days. It separates total events from anonymous sessions (not unique people), measured actions from current collection snapshots, and category views from unique Place totals because categories can overlap. Empty periods state that measurement has begun; historical traffic is not invented.

Daily 03:00 Asia/Manila cleanup removes events older than 90 days. No third-party analytics service or paid infrastructure was created. Automated test ingestion is confined to uniquely identified synthetic staging sessions and cleaned after assertions.
