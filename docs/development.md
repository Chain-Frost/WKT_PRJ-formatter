# Development and installation



The procedures below cover building, testing, packaging, and installing this extension. For stable versioned releases, see [release instructions](releases.md).



## Development

Requires Node.js 22 and VS Code 1.85 or later.

```sh
npm ci --no-audit --no-fund
npm run check
npm run test:integration
npm run package:vsix
npm run test:packaged -- path/to/wkt-prj-formatter-VERSION.vsix
```

Use Node.js 22 and the committed `package-lock.json` for repeatable builds. `npm ci` deliberately fails if the manifest and lockfile disagree, rather than updating dependencies silently. To update dependencies intentionally, run `npm install` (or `npm update`) and commit the resulting `package-lock.json` alongside `package.json`. Then rerun `npm ci` from a clean checkout.

Press **F5** to launch an Extension Development Host. `npm test` runs the GUI-free formatter/unit suites, including the independent token oracle, exact GDAL-style formatting, deep nesting, Unicode and CRLF/path cases. `npm run test:integration` downloads and exercises VS Code **1.85.0 and current stable** in an isolated test workspace/profile, covering real language activation, provider formatting, explicit command/undo, folding and format-on-save. `npm run test:packaged -- path/to/wkt-prj-formatter-VERSION.vsix` installs the **exact built VSIX** in a separate isolated extensions directory, without loading the source extension. The versioned example filename follows the current `package.json` version. Both GUI suites need a VS Code desktop runtime (and `xvfb-run -a` on headless Linux).

CI uses `npm ci` and runs source tests on Ubuntu and Windows. Only after both pass does it package one candidate VSIX. Then it installs and smoke-tests that exact artifact on both platforms. **The downloadable `wkt-prj-formatter-vsix` artifact is uploaded only after those smoke tests pass.**

### Build and install from GitHub Actions

After this workflow has been merged into the default branch, open **GitHub → Actions → CI → Run workflow** and choose the branch/ref. Manual dispatch executes the same checks and packaging as ordinary pushes and PRs. `Run workflow` appears only when the workflow with `workflow_dispatch` exists on the default branch.

When the run succeeds, open its **Artifacts** section, download **`wkt-prj-formatter-vsix`**, and extract the ZIP containing the `.vsix`. In VS Code choose **Extensions → … → Install from VSIX**, select the extracted file and reload if prompted.

For durable versioned downloads, see [GitHub Releases](https://github.com/Chain-Frost/WKT_PRJ-formatter/releases) and the [release procedure](releases.md). Changes are recorded in [CHANGELOG.md](../CHANGELOG.md). No GitHub Release is created by normal CI, PRs or manual VSIX builds.

No Node.js, TypeScript, or Docker is needed on the machine **installing** this prebuilt extension. Build dependencies (including the project-local TypeScript compiler) are installed by the GitHub runner.
