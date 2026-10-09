# Changelog

Notable changes to the WKT / PRJ Formatter extension are recorded here. This document describes source changes; a versioned release will be published separately.

## Unreleased

### Changed
- **Formatting presentation changed intentionally (#16):** WKT1/WKT2 now use GDAL/pyproj-like hierarchical indentation, first-scalar-on-opening-line layout and closing brackets on the last child line. The former hybrid compact/expanded layout is not retained. This alters whitespace only, not CRS values or non-whitespace WKT tokens.
- The editor's tab size now controls visual line-width calculations while tabs remain tab characters (#9).
- GitHub Actions uses a committed dependency lockfile with `npm ci` (#4), and validates Linux and Windows before uploading one VSIX (#7).
- Manual Actions workflow dispatch can build a downloadable VSIX without local Node.js or TypeScript (#3).

### Added
- Bracket-aware folding for nested WKT1/WKT2 elements (#11).
- TextMate tokenization regression tests for the packaged WKT grammar (#12).
- An independent formatter token-preservation oracle and boundary, newline and real-path regression tests (#6).
- Restricted Mode compatibility declaration and manual verification instructions (#10).
- Real-world EPSG:28350 WKT1/WKT2/PROJ4 test fixtures merged from #17.
