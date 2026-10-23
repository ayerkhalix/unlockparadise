# Admin permissions

All studio roles require a verified Supabase AAL2 session. Database role rows are authoritative; user-editable metadata never grants privileges. The established `admin` role is presented as Owner.

| Capability                                                          | Owner               | Content editor | Order manager | Explorer / Explorer+ / anonymous |
| ------------------------------------------------------------------- | ------------------- | -------------- | ------------- | -------------------------------- |
| Places, taxonomy, media, recommendations, moderation                | Yes                 | Yes            | No            | No                               |
| Merchandise, variants, prices, stock                                | Yes                 | No             | No            | No                               |
| Orders, fulfillment, limited CSV                                    | Yes                 | No             | Yes           | No                               |
| Financial payment confirmation / refunds                            | Trusted server only | No             | No            | No                               |
| Analytics, members, entitlements, site settings, full audit history | Yes                 | No             | No            | No                               |
| Public published merchandise                                        | Yes                 | Yes            | Yes           | Yes                              |

The order-manager role is justified by separating fulfillment from content, financial configuration and administrator access. Roles are deliberately not combined into a complex capability builder. An owner confirms role/entitlement changes; the database prevents removal of the last owner. Content editors can read moderation history only through a scoped, permission-checked review RPC.

The Proxy performs a lightweight sign-in entry check. Layout/page guards and every API independently verify identity and capabilities. RLS/RPC grants remain the final boundary. Public viewer-access predicates return only the caller's own validated capability flags; they do not reveal role assignments for another user.
