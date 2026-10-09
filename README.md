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

Respects the active editor's indentation width or tabs. Preserves existing LF/CRLF newline style, any UTF-8 BOM, optional final newline, quote escaping, keyword spelling, number precision and nested bracket style. Formatting is idempotent.

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
npm install
npm run check
npm run package:vsix
```

Press **F5** to launch an Extension Development Host. `npm test` runs parser/formatter unit tests without a GUI. CI checks compilation, ESLint, unit tests and VSIX packaging.

To install without building locally, download the `wkt-prj-formatter-vsix` artifact from a successful GitHub Actions CI run, extract the `.vsix`, then select **Extensions → ... → Install from VSIX** in VS Code.

## Design constraints

The formatter only changes layout/whitespace *between* WKT tokens. It does not convert WKT1 to WKT2, change datum parameters, normalise numeric precision, validate CRS geodetic semantics, or interpret PROJ.4 strings. On invalid input the standard formatting provider makes no edit; the explicit command explains the parsing error.

MIT licensed.
