# Changelog

Notable changes to the WKT / PRJ Formatter extension are recorded here. This document describes source changes; a versioned release will be published separately.

## Unreleased

### Changed
- **Formatting presentation changed intentionally (#16):** WKT1/WKT2 now use GDAL/pyproj-like hierarchical indentation, first-scalar-on-opening-line layout, no extra spaces after commas, and closing brackets on the last child line. No maximum line width is imposed and the obsolete `maxInlineLength` setting is removed. The former hybrid compact/expanded layout is not retained. This alters whitespace only, not CRS values or non-whitespace WKT tokens.
- The editor's indentation choice is respected (#9). Tab-width measurement is no longer needed because formatting does not impose any line-width limit.
- GitHub Actions uses a committed dependency lockfile with `npm ci` (#4), and validates Linux and Windows before uploading one VSIX (#7).
- Manual Actions workflow dispatch can build a downloadable VSIX without local Node.js or TypeScript (#3).

### Added
- Source Extension Host integration tests covering VS Code 1.85.0 and current stable, normal activation, provider and command formatting, undo, format-on-save and folding (#2).
- Installed-VSIX smoke tests on both Ubuntu and Windows; the public downloadable artifact is uploaded only if both pass (#5).
- Version-tagged release workflow, matching-version changelog validation, and release safety/retry documentation (#8).
- Original VS Code globe/bracket icon and README before-and-after WKT illustration in packaged-compatible PNG format (#13).
- Bracket-aware folding for nested WKT1/WKT2 elements (#11).
- TextMate tokenization regression tests for the packaged WKT grammar (#12).
- An independent formatter token-preservation oracle and boundary, newline and real-path regression tests (#6).
- Restricted Mode compatibility declaration and manual verification instructions (#10).
- Real-world EPSG:28350 WKT1/WKT2/PROJ4 test fixtures merged from #17.
