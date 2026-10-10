# Reference CRS definitions (EPSG:28350)

These are real-world example files for **GDA94 / MGA zone 50 (EPSG:28350)**, not synthetic WKT fragments. Definitions are taken from [EPSG.io/28350](https://epsg.io/28350) (retrieved 2026-10-10).

| File | Source representation | Intended coverage |
| --- | --- | --- |
| `gda94-mga-zone50.prj` | [ESRI WKT1](https://epsg.io/28350.esriwkt) | Existing fixture; ESRI-specific names, capitalization and decimal spelling |
| `gda94-mga-zone50-ogc.wkt` | [OGC WKT1](https://epsg.io/28350.wkt) | `TOWGS84`, `AUTHORITY`, `AXIS`, projection parameters |
| `gda94-mga-zone50.wkt2` | [OGC WKT2:2019](https://epsg.io/28350.wkt2) | `CONVERSION`, nested `PARAMETER` units/IDs, `USAGE`, `BBOX` |
| `gda94-mga-zone50-proj4.prj` | [PROJ.4](https://epsg.io/28350.proj4) | Supported standalone PROJ parameter string in a `.prj` file (acceptance fixture for [#14](https://github.com/Chain-Frost/WKT_PRJ-formatter/issues/14)) |

The supported WKT fixtures are deliberately stored in their **source single-line form** to exercise the VS Code formatter. These files must not be interpreted as desired formatted output: the extension changes layout while preserving the original significant tokens, parameter values, order, keyword spelling, precision and bracket style. The style preference tracked in [#16](https://github.com/Chain-Frost/WKT_PRJ-formatter/issues/16) must remain lossless.

Formatting tests should be insensitive to a change from the current compact presentation to the proposed GDAL/pyproj-like layout. The PROJ.4 fixture is now formatted by its own token-preserving parser; it must never be silently interpreted as WKT.

These are **alternative representations of the same CRS**, not byte-equivalent or semantically interchangeable input strings. In particular, do not convert them from one dialect to another as part of formatting.
