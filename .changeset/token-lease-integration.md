---
"@sabbour/squad-identity": minor
---

`squad_identity_resolve_token` now returns a confirmation message with lease metadata instead of the raw token. The token is stored in the lease system and auto-resolved by other squad extensions internally. `squad_identity_attest_write` no longer requires a `token` parameter — it auto-resolves from `roleSlug`.
