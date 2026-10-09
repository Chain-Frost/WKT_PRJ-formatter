# WKT / PRJ Formatter

A VS Code extension to make GIS coordinate reference system definitions readable without changing their values.

![WKT / PRJ Formatter before-and-after illustration: a single-line GDA94 projected CRS shown as a hierarchical GDAL-style WKT tree, preserving the definition's tokens.](assets/wkt-before-after.svg)

## Supported formats

- **WKT1**: OGC/ESRI projection definitions, including `PROJCS`, `GEOGCS`, `DATUM`, `SPHEROID`, `PROJECTION`, and `PARAMETER`.
- **WKT2**: modern CRS definitions such as `PROJCRS`, `GEOGCRS`, `BASEGEOGCRS`, `BOUNDCRS`, `CONVERSION`, `METHOD`, `CS`, `AXIS`, `ORDER`, and `ID`. Other valid nested WKT elements are also handled structurally.
- Files: `.prj`, `.wkt`, `.wkt2`.
- **Not supported:** PROJ.4 parameter lists (`+proj=...`). They are left unchanged, as are malformed WKT files.

## Real-world EPSG:28350 example files

The [reference fixtures](fixtures/README.md) include published GDA94 / MGA zone 50 definitions from [EPSG.io](https://epsg.io/28350): **ESRI WKT1** (`.prj`), **OGC WKT1** (`.wkt`), and **WKT2:2019** (`.wkt2`). Open one in VS Code and run **Format Document** to see the presentation without altering the CRS tokens.

The separate PROJ.4-in-`.prj` fixture documents the currently unsupported case for [#14](https://github.com/Chain-Frost/WKT_PRJ-formatter/issues/14); it must remain unchanged until that support lands. The lossless hierarchical GDAL/pyproj-style presentation is implemented under [#16](https://github.com/Chain-Frost/WKT_PRJ-formatter/issues/16).

## Usage

1. Open a WKT `.prj` / `.wkt` / `.wkt2` file in VS Code.
2. Use **Format Document** (Windows/Linux `Shift+Alt+F`) or the Command Palette action **WKT / PRJ: Format WKT / PRJ**.
3. To format on save, enable the standard VS Code `editor.formatOnSave` setting for the `wkt` language.

Example VS Code settings:

```json
{
  "[wkt]": {
    "editor.defaultFormatter": "Chain-Frost.wkt-prj-formatter",
    "editor.formatOnSave": true
  }
}
```

**Formatting style:** GDAL/pyproj-like hierarchical WKT is the sole presentation. The first scalar remains on the opening line, nested child elements start new lines at one indentation level deeper, and the closing delimiter joins the last child line. Other scalar values stay inline with no inserted spaces (for example, `PARAMETER["false_easting",500000]`). **There is no maximum line length** and no `maxInlineLength` setting: long scalar values and leaf elements remain on one line. This layout preserves all WKT tokens, numeric precision, case, and bracket types. The old hybrid presentation has intentionally been replaced; this is a whitespace-only change, not a CRS conversion.

The formatter respects the active VS Code editor's indentation setting (including tabs). Standalone `formatWkt()` defaults to four spaces. LF/CRLF line endings, UTF-8 BOM, terminal newline, doubled quotes and literal backslashes are preserved. Formatting is idempotent.

The extension supports **Restricted Mode (untrusted workspaces)**. It only formats open document text and does not execute project code or external programs. To check manually, open a fresh folder in VS Code, choose **Don't Trust** at the trust prompt (or use **Workspaces: Manage Workspace Trust** to set the folder as untrusted), confirm the window indicates Restricted Mode, then open a `.prj` file and test both **Format Document** and **WKT / PRJ: Format WKT / PRJ**. Both actions should format WKT without requiring trust. This check is manual until an Extension Host integration harness is available.

### Example WKT1

Input:

```text
PROJCS["GDA_1994_MGA_Zone_50",GEOGCS["GCS_GDA_1994",DATUM["D_GDA_1994",SPHEROID["GRS_1980",6378137.0,298.257222101]],PRIMEM["Greenwich",0.0],UNIT["Degree",0.0174532925199433]],PROJECTION["Transverse_Mercator"],PARAMETER["False_Easting",500000.0],UNIT["Meter",1.0]]
```

Formatted (GDAL/pyproj-style, four spaces):

```text
PROJCS["GDA_1994_MGA_Zone_50",
    GEOGCS["GCS_GDA_1994",
        DATUM["D_GDA_1994",
            SPHEROID["GRS_1980",6378137.0,298.257222101]],
        PRIMEM["Greenwich",0.0],
        UNIT["Degree",0.0174532925199433]],
    PROJECTION["Transverse_Mercator"],
    PARAMETER["False_Easting",500000.0],
    UNIT["Meter",1.0]]
```

## Editor support

- **Syntax highlighting:** The shipped TextMate grammar recognizes WKT elements, strings, numerical constants, directions and punctuation. A GUI-free test harness runs the actual grammar using `vscode-textmate` and `vscode-oniguruma` (`npm test`). The test dependencies are excluded from the VSIX. For visual theme QA, inspect a multiline WKT1 and WKT2 file with **Default Dark Modern** and **Default Light Modern** in VS Code; check both bracket contrast and quoted-string legibility.
- **Bracket-aware folding:** VS Code's built-in indentation folding can leave an aligned closing `]` or `)` visible below a collapsed element. This extension's folding provider includes the complete multiline bracket/parenthesis node. Single-line elements do not fold; delimiters inside quoted strings (including doubled quotes or literal backslashes) are ignored. Malformed input is handled without editing the document. Folding is available on `.prj`, `.wkt` and `.wkt2` files. Use the gutter chevrons next to nested elements to verify this visually.

## Development

Requires Node.js 22 and VS Code 1.85 or later.

```sh
npm ci --no-audit --no-fund
npm run check
npm run test:integration
npm run package:vsix
npm run test:packaged -- ./wkt-prj-formatter-0.1.0.vsix
```

Use Node.js 22 and the committed `package-lock.json` for repeatable builds. `npm ci` deliberately fails if the manifest and lockfile disagree, rather than updating dependencies silently. To update dependencies intentionally, run `npm install` (or `npm update`) and commit the resulting `package-lock.json` alongside `package.json`. Then rerun `npm ci` from a clean checkout.

Press **F5** to launch an Extension Development Host. `npm test` runs the GUI-free formatter/unit suites, including the independent token oracle, exact GDAL-style formatting, deep nesting, Unicode and CRLF/path cases. `npm run test:integration` downloads and exercises VS Code **1.85.0 and current stable** in an isolated test workspace/profile, covering real language activation, provider formatting, explicit command/undo, folding and format-on-save. `npm run test:packaged -- ./wkt-prj-formatter-0.1.0.vsix` installs the **exact built VSIX** in a separate isolated extensions directory, without loading the source extension. The versioned example filename follows the current `package.json` version. Both GUI suites need a VS Code desktop runtime (and `xvfb-run -a` on headless Linux).

CI uses `npm ci` and runs source tests on Ubuntu and Windows. Only after both pass does it package one candidate VSIX. Then it installs and smoke-tests that exact artifact on both platforms. **The downloadable `wkt-prj-formatter-vsix` artifact is uploaded only after those smoke tests pass.**

### Build and install from GitHub Actions

After this workflow has been merged into the default branch, open **GitHub → Actions → CI → Run workflow** and choose the branch/ref. Manual dispatch executes the same checks and packaging as ordinary pushes and PRs. `Run workflow` appears only when the workflow with `workflow_dispatch` exists on the default branch.

When the run succeeds, open its **Artifacts** section, download **`wkt-prj-formatter-vsix`**, and extract the ZIP containing the `.vsix`. In VS Code choose **Extensions → … → Install from VSIX**, select the extracted file and reload if prompted.

No Node.js, TypeScript, or Docker is needed on the machine **installing** this prebuilt extension. Build dependencies (including the project-local TypeScript compiler) are installed by the GitHub runner.

## Design constraints

The formatter only changes layout/whitespace *between* WKT tokens; it does not wrap WKT based on a target line width. It does not convert WKT1 to WKT2, change datum parameters, normalise numeric precision, validate CRS geodetic semantics, or interpret PROJ.4 strings. On invalid input the standard formatting provider makes no edit; the explicit command explains the parsing error.

MIT licensed.
