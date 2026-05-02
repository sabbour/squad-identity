---
"@sabbour/squad-identity": minor
---

Improve upgrade and doctor experience:

- `upgrade` now displays a clear `from → to` version transition and detects no-op upgrades (already on latest).
- Managed identity block in `.github/copilot-instructions.md` is now stamped with the installed version, enabling drift detection.
- `doctor` expanded to verify all injected artifacts: copilot-instructions identity block, per-agent charter `ROLE_SLUG` injection, and per-agent skill pointer (warn-only — never hard-fails on a missing optional injection).
