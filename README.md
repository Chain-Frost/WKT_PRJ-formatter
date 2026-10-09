# WKT / PRJ Formatter

A VS Code extension to make GIS coordinate reference system definitions readable without changing their values.

## Supported formats

- **WKT1**: OGC/ESRI projection definitions, including `PROJCS`, `GEOGCS`, `DATUM`, `SPHEROID`, `PROJECTION`, and `PARAMETER`.
- **WKT2**: modern CRS definitions such as `PROJCRS`, `GEOGCRS`, `BASEGEOGCRS`, `BOUNDCRS`, `CONVERSION`, `METHOD`, `CS`, `AXIS`, `ORDER`, and `ID`. Other valid nested WKT elements are also handled structurally.
- Files: `.prj`, `.wkt`, `.wkt2`.
- **Not supported:** PROJ.4 parameter lists (`+proj=...`). They are left unchanged, as are malformed WKT files.

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
  },
  "wktPrjFormatter.maxInlineLength": 100
}
```

Respects the active editor's indentation width or tabs. For tabs, visual line-width calculations use the editor's effective tab size (for example 2, 4, or 8); the tab characters themselves are preserved. Direct calls to `formatWkt()` default to a visual tab size of 4. Preserves existing LF/CRLF newline style, any UTF-8 BOM, optional final newline, doubled quote escaping (as specified by WKT), keyword spelling, number precision and nested bracket style. Formatting is idempotent.

The extension supports **Restricted Mode (untrusted workspaces)**. It only formats open document text and does not execute project code or external programs. To check manually, open a fresh folder in VS Code, choose **Don't Trust** at the trust prompt (or use **Workspaces: Manage Workspace Trust** to set the folder as untrusted), confirm the window indicates Restricted Mode, then open a `.prj` file and test both **Format Document** and **WKT / PRJ: Format WKT / PRJ**. Both actions should format WKT without requiring trust. This check is manual until an Extension Host integration harness is available.

### Example WKT1

Input:

```text
PROJCS["GDA_1994_MGA_Zone_50",GEOGCS["GCS_GDA_1994",DATUM["D_GDA_1994",SPHEROID["GRS_1980",6378137.0,298.257222101]],PRIMEM["Greenwich",0.0],UNIT["Degree",0.0174532925199433]],PROJECTION["Transverse_Mercator"],PARAMETER["False_Easting",500000.0],UNIT["Meter",1.0]]
```

Formatted:

```text
PROJCS[
  "GDA_1994_MGA_Zone_50",
  GEOGCS[
    "GCS_GDA_1994",
    DATUM["D_GDA_1994", SPHEROID["GRS_1980", 6378137.0, 298.257222101]],
    PRIMEM["Greenwich", 0.0],
    UNIT["Degree", 0.0174532925199433]
  ],
  PROJECTION["Transverse_Mercator"],
  PARAMETER["False_Easting", 500000.0],
  UNIT["Meter", 1.0]
]
```

## Development

Requires Node.js 22 and VS Code 1.85 or later.

```sh
npm install --no-audit --no-fund
npm run check
npm run package:vsix
```

Press **F5** to launch an Extension Development Host. `npm test` runs the GUI-free formatter/unit suites, including an independent token-preservation oracle, tab-size boundaries, deep nesting, Unicode, and CRLF/file-path tests. CI runs ESLint, compilation and tests on both `ubuntu-latest` and `windows-latest`. The Windows job exercises real Windows filesystem paths and CRLF fixtures. A single Ubuntu packaging job starts **only after both platforms pass**, runs validation again, and uploads one VSIX. VS Code Extension Host tests and packaged-install smoke tests remain future work.

### Build and install from GitHub Actions

After this workflow has been merged into the default branch, open **GitHub → Actions → CI → Run workflow** and choose the branch/ref. Manual dispatch executes the same checks and packaging as ordinary pushes and PRs. `Run workflow` appears only when the workflow with `workflow_dispatch` exists on the default branch.

When the run succeeds, open its **Artifacts** section, download **`wkt-prj-formatter-vsix`**, and extract the ZIP containing the `.vsix`. In VS Code choose **Extensions → … → Install from VSIX**, select the extracted file and reload if prompted.

No Node.js, TypeScript, or Docker is needed on the machine **installing** this prebuilt extension. Build dependencies (including the project-local TypeScript compiler) are installed by the GitHub runner.

## Design constraints

The formatter only changes layout/whitespace *between* WKT tokens. It does not convert WKT1 to WKT2, change datum parameters, normalise numeric precision, validate CRS geodetic semantics, or interpret PROJ.4 strings. On invalid input the standard formatting provider makes no edit; the explicit command explains the parsing error.

MIT licensed.
