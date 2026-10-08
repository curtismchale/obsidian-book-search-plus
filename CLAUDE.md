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

## Testing

**Write tests first.** Before fixing a bug or adding a feature, write a failing test that describes the expected behaviour. Then write the code to make it pass.

Run tests with:
```
nix-shell --run "pnpm test"
```

Test files live alongside source files as `*.test.ts`. The full suite must pass before committing. Lint must also be clean: `nix-shell --run "pnpm run lint"` (prettier, eslint, tsc) — zero errors.

## Workflow for fixing an issue

0. Write planning notes in `/home/curtismchale/Documents/main/Projects/Obsidian Book Search Plus/` as `{N} - {Descriptive Title}.md` (issue number, no prefix), with a link to the issue at the top.
1. Write a failing test in the relevant `*.test.ts` file that captures the expected behaviour.
2. Fix the code in `src/` until the test passes.
3. Run the full suite to confirm no regressions: `nix-shell --run "pnpm test"`
4. Rebuild: `nix-shell --run "node esbuild.config.mjs production"`
5. Deploy to vault: `cp main.js /home/curtismchale/Documents/main/.obsidian/plugins/book-search-plus/main.js`
6. Update `CHANGELOG.md` with a new entry under the current unreleased version (see versioning below).
7. Commit with a message that includes `Fixes #N` to auto-close the issue. Run `git commit` inside `nix-shell` (e.g. `nix-shell --run "git commit -F msg.txt"`) — the husky pre-commit hook needs pnpm.
8. Push.

**Do not comment on GitHub issues** — neither in this repo nor upstream. The `Fixes #N` commit closes the issue. If a comment seems useful, draft it in the planning notes for the user to post.

## CHANGELOG versioning

Use semantic versioning (`1.0.0`, `1.0.1`, `1.1.0`, etc.). The current unreleased version accumulates entries under `## [X.Y.Z] (unreleased)` at the top of `CHANGELOG.md`. When tagging a release, replace `(unreleased)` with the date. Include relevant sections: `Bug Fixes`, `Features`, `Build`, `Tests`, `Documentation`.

## Releasing

1. Replace `(unreleased)` in the CHANGELOG heading with the date (`## [X.Y.Z] (YYYY-MM-DD)`).
2. Bump `version` in `manifest.json` and `package.json`, and add `"X.Y.Z": "<minAppVersion>"` to `versions.json`.
3. Rebuild `main.js`.
4. Commit as `Release X.Y.Z` and create an annotated tag `X.Y.Z` (no `v` prefix) with message `Release X.Y.Z`.
5. Push `main` and the tag. The tag triggers `.github/workflows/release.yml`, which attaches `main.js`, `manifest.json` and `styles.css` to the GitHub release.
6. Copy `main.js` and `manifest.json` to the vault plugin folder.

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

- Close the corresponding issue in this repo (the `Fixes #N` commit message does this automatically).
- Do not comment on the upstream issue.

## Support

Support links point to GitHub Sponsors only — no Buy Me a Coffee or other third-party platforms.

## AI disclosure

Some work on this fork is assisted by Claude Code. This is noted in the README and should remain there.
