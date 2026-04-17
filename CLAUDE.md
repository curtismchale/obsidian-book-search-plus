# Claude Code Instructions — Book Search Plus

This file captures standing instructions for working on this plugin. Commit it with any changes so the rules persist across sessions.

## About this repo

This is a personal fork of [obsidian-book-search-plugin](https://github.com/anpigon/obsidian-book-search-plugin) by anpigon. The upstream plugin has not been updated since October 2024. This fork exists to apply fixes and improvements not available upstream.

Plugin id: `book-search-plus`
Plugin name: Book Search Plus

## Development environment

Use `shell.nix` — do not assume Node or pnpm are installed globally.

```
nix-shell --run "node esbuild.config.mjs production"
```

Node 20 + pnpm 9 are provided by the shell.

## Build

- Minification is **disabled** — the production build is always readable.
- Sourcemaps are **always on**.
- `main.js` is tracked in git (removed from `.gitignore`) so the plugin can be installed directly from the repo.

## Workflow for fixing an issue

1. Fix the code in `src/`.
2. Rebuild: `nix-shell --run "node esbuild.config.mjs production"`
3. Deploy to vault: `cp main.js /home/curtismchale/Documents/main/.obsidian/plugins/book-search-plus/main.js`
4. Update `CHANGELOG.md` with a new fork version entry (see versioning below).
5. Commit with a message that includes `Fixes #N` to auto-close the issue.
6. Push.
7. Comment on the issue in this repo that it is fixed, citing the commit hash.
8. Comment on the corresponding upstream issue (anpigon/obsidian-book-search-plugin) linking to the fix in this repo.

## CHANGELOG versioning

Use the scheme `0.7.5-fork.N` where N increments with each release. Add a new entry at the top of `CHANGELOG.md` above the previous fork entry. Include relevant sections: `Bug Fixes`, `Features`, `Build`, `Documentation`.

**Every commit that changes behaviour or docs must include a CHANGELOG entry. Do not skip this.**

## Issue labels

Two label dimensions are used:

**Difficulty**
- `difficulty: easy` — isolated, clear cause, likely a small fix
- `difficulty: medium` — needs investigation before fixing
- `difficulty: hard` — architectural change, significant effort

**Impact**
- `impact: breaking` — core workflow fails or data is corrupted
- `impact: cosmetic` — UX or visual issue, plugin still works

Also use the standard GitHub labels `bug`, `enhancement`, `documentation` as appropriate.

## When creating issues from upstream

- Link to the original issue in anpigon/obsidian-book-search-plugin.
- Include the original bug report verbatim or summarised.
- Apply appropriate difficulty and impact labels.

## When an upstream issue is fixed here

- Comment on the upstream issue linking to the fix commit in this repo.
- Close the corresponding issue in this repo (the `Fixes #N` commit message does this automatically).

## Support

Support links point to GitHub Sponsors only — no Buy Me a Coffee or other third-party platforms.

## AI disclosure

Some work on this fork is assisted by Claude Code. This is noted in the README and should remain there.
