# Authoritative CRS syntax and parameter references

This extension formats text only. It does not validate coordinate reference system
semantics, look up coordinate transformations, reconcile datums, or convert dialects.
Syntax specifications are distinct from the source of any particular CRS definition.

| Topic | Primary authority | Reference and interpretation |
| --- | --- | --- |
| WKT2 representation and grammar | Open Geospatial Consortium (OGC); aligned with ISO 19162 | [OGC WKT-CRS](https://www.ogc.org/standards/wkt-crs/) and [OGC 18-010r11](https://docs.ogc.org/is/18-010r11/18-010r11.html). WKT2 syntax, keywords and CRS constructs. |
| Earlier WKT1 | OGC WKT-CRS historical specifications | [OGC WKT-CRS versions](https://www.ogc.org/standards/wkt-crs/). WKT1 has implementation-specific variants. |
| Underlying CRS and coordinate operations | ISO 19111 / OGC Abstract Specification Topic 2 | [OGC standards](https://www.ogc.org/standards/). CRS data model, not a formatting style guide. |
| PROJ parameter syntax and named operations | PROJ project maintainers | [PROJ quick start](https://proj.org/en/stable/usage/quickstart.html), [projection parameters](https://proj.org/en/stable/usage/projections.html) and [pipeline operator](https://proj.org/en/stable/operations/pipeline.html). Separate from WKT grammar. |
| EPSG codes, geodetic parameters and reference definitions | IOGP Geomatics Committee / EPSG Geodetic Parameter Dataset | [EPSG registry](https://epsg.org/) and [EPSG Guidance Notes](https://epsg.org/guidance-notes.html). Does not prescribe a pretty-print style. |
| Esri WKT and .prj conventions | Esri | [ArcGIS Pro projection-file options](https://doc.esri.com/en/arcgis-pro/latest/help/mapping/properties/specify-a-coordinate-system.html). Esri WKT and WKT2 are distinct variants. |
| Example EPSG:28350 serializations | EPSG.io (fixture source; not standards authority) | [EPSG:28350](https://epsg.io/28350) and [fixtures](../fixtures/README.md). |

## Lossless formatting policy

- WKT: Parse nested WKT elements to place child nodes on new indented lines.
  Preserve quoted strings, spelling, WKT dialect, numbers, argument order,
  bracket types and all embedded scalar text.
- PROJ strings: Accept a standalone whitespace-delimited sequence of +name
  or +name=value parameters containing a +proj=value token. Each complete
  parameter is placed on its own line. Never sort, deduplicate, convert,
  round or rewrite values. Both single- and double-quoted values and
  backslash-escaped spaces are retained byte-for-byte.
  Quoted values begin with a quote immediately after the equals sign;
  apostrophes and double-quote marks within unquoted PROJ degree-minute-second
  (DMS) angle notation are literal scalar characters, not quote delimiters.
  See the [PROJ angle/units rules](https://proj.org/en/stable/usage/projections.html#units).
- PROJ pipelines: +proj=pipeline must be the first parameter and contain
  at least one +step. Each +step begins a nonempty group. Indent step parameters;
  leave parameters before the first +step global and preserve every step boundary
  and every original parameter in order. This is formatting, not execution.
- All formats: Preserve BOM presence, newline convention, presence or absence
  of a final newline, and idempotence. The editor indentation setting controls
  WKT child elements and PROJ step contents.
- Unsupported PROJ subset: Multiline quoted values, trailing backslashes,
  malformed quotations, bare tokens, bare comments and other non-parameter
  syntaxes are rejected without changing the document. The explicit command
  provides an explanation. The provider makes no edit.

The OGC develops WKT standards, whereas the PROJ project maintains PROJ-string
conventions. EPSG/IOGP curates reference-system and operation parameters, not
their visual layout. An Esri PRJ file is not proof of a particular WKT dialect:
detect the file's actual text rather than assuming that its extension defines
its syntax.
