# Releasing the WKT / PRJ Formatter

Versioned GitHub Releases are created **only** for pushed tags matching `vMAJOR.MINOR.PATCH` (for example `v0.2.0`). Regular pushes, pull requests and manual CI runs only produce temporary Actions artifacts, not Releases. There is no Marketplace upload.

## Prepare the release

1. Merge reviewed work with green CI into `main` before tagging. Do **not** tag an unmerged feature branch.
2. Intentionally update `package.json` and `package-lock.json` to the same new semantic version. Run `npm install --package-lock-only --ignore-scripts`, then `npm ci`, `npm run check` and `npm run test:integration`.
3. Move the release's entries from `CHANGELOG.md`'s Unreleased section to a dedicated heading exactly `## [MAJOR.MINOR.PATCH] - YYYY-MM-DD` or `## [MAJOR.MINOR.PATCH]`. Preserve the Unreleased section for future changes.
4. Commit the version and changelog changes to `main`. Create an annotated tag `vMAJOR.MINOR.PATCH` pointing to that commit and push the tag.

The release workflow refuses a tag that does not match `package.json`'s version or lacks the required `## [MAJOR.MINOR.PATCH]` heading prefix in the changelog. The release job alone has `contents: write`; other jobs are read-only.

## Validation and download

The release workflow validates source on Ubuntu and Windows with Node.js 22 and the committed lockfile. It runs lint, compilation, Node unit tests and Extension Host tests against the minimum supported VS Code and current stable. The package job builds a **single version-named VSIX** after both platforms pass, checks key packaged assets and uploads it as an Actions artifact. The publish job downloads that very artifact; it does not rebuild the release file.

After a successful run, open GitHub **Releases** and download `wkt-prj-formatter-MAJOR.MINOR.PATCH.vsix`. In VS Code open **Extensions → ... → Install from VSIX**, select the downloaded asset and reload VS Code if prompted.

## Retry-safe workflow artifacts

The candidate artifact uses the stable name `wkt-prj-formatter-release`. The package job sets `overwrite: true` when uploading this GitHub Actions artifact: **Re-run all jobs** rebuilds the validated VSIX and replaces the previous attempt's artifact without failing on an immutable duplicate name. **Re-run failed jobs** can reuse the already validated artifact when the package job succeeded previously. The Linux and Windows smoke jobs and release publisher download the same artifact by its stable name.

Overwriting the intermediate GitHub Actions artifact is distinct from overwriting a public GitHub Release. The publisher still refuses to overwrite an existing GitHub Release or its attached assets.


## Recovering from failed releases

If failure occurs before GitHub Release creation, fix the source problem in a new commit and use a **new appropriate version/tag**, or rerun the failed tag workflow after verifying no code/tag mismatch. Avoid retargeting tags that have already been distributed.

If the publish job fails after a partial release has been created, examine the release and asset list manually. The workflow deliberately refuses to overwrite an existing Release or unrelated assets. Delete only an explicitly identified incomplete release for **that exact tag**, once you have confirmed it is safe, then rerun the tag workflow. Never use `--clobber` to overwrite arbitrary assets automatically.
