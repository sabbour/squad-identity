---
"@sabbour/squad-identity": patch
---

fix: guard publish step against premature version from changeset workspace mutation; align bundled SKILL.md with extension.mjs tool surface

**Pipeline fix:** The `changesets/action@v1` step runs `changeset version` locally when pending
changesets exist, rewriting `package.json` to the next version in the runner workspace. The
subsequent "Publish to npmjs" step was reading that mutated version and publishing an unreleased
tarball off a non-release commit. Added `steps.changesets.outputs.hasChangesets == 'false'`
guard so publishing only happens after the version-bump PR is merged. Also adds `--provenance`
to `npm publish` to explicitly opt into OIDC trusted publishing, and adds `continue-on-error`
to the GitHub Packages mirror step so a Packages 403 does not abort the entire release.

**SKILL.md alignment (Path A from forensic report):** The bundled `squad-identity/SKILL.md`
described a consolidated `squad_identity_setup` / `squad_identity_configure` API that does not
exist in `extensions/squad-identity/extension.mjs`. The extension still exports the v1.1.0 tool
surface (`squad_identity_status`, `squad_identity_update_charters`,
`squad_identity_update_copilot_instructions`, `squad_identity_setup_steps`,
`squad_identity_setup_all`). Updated SKILL.md to match the real extension, so agents get
accurate tool docs instead of calling non-existent tools.
