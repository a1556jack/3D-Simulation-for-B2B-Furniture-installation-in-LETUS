# Geographic sources and limits

Retrieved 2026-11-09 from the public, independently published regional archives in [PLAYX1/playx-raven-maps](https://github.com/PLAYX1/playx-raven-maps/tree/a30620ace8a174a0d7474c4785f564f22cdac064), commit `a30620ace8a174a0d7474c4785f564f22cdac064`.

The original dataset is OpenStreetMap / Natural Earth processed by Protomaps Basemap 4.15.2. The redistributor identifies the map data as ODbL. Attribution remains visible in every map. The derived search index retains the same database attribution and ODbL terms. The source database, processing scripts and exact checksums are provided in `public/data/map-sources.json`, `scripts/prepare-maps.mjs`, and `scripts/index-maps.mjs`.

| Archive | Bounds (west,south,east,north) | Max zoom | Bytes |
|---|---|---|---|
| 수도권 | 126.3,36.8,127.9,38.0 | 14 | 74,247,210 |
| 강원 | 127.4,37.0,129.6,38.7 | 13 | 22,675,269 |
| 충청 | 125.9,35.8,128.4,37.2 | 13 | 44,561,008 |

These rectangles do not cover every part of each administrative province. Some northern Gyeonggi and islands fall outside the archive extent. MVT tile edges can contain overlapping geometry. The app chooses one archive at the viewport center; the search index identifies vicinity candidates, never parcel-level exact matches. There are 140,071 index entries extracted from 10,038 tiles, including duplicates across adjacent regions/tiles. They are not 140,071 unique verified addresses.

The pilot address `경기도 용인시 처인구 양지읍 남평로 111-73, 9층` was not matched to an exact building number. The initial view `[127.299745,37.228360]` is an actual Nampeong-ro road-vicinity centroid from the source index. It is not the job's verified coordinates. The requested floor cannot establish building height or elevator service.

Building heights are map attributes, possibly derived/generalized by the source, not surveyed clearances. Missing heights are optionally rendered at an explicitly labeled 6m for visual context. Source and assumed heights never flow into clearance checks. Footprints can be dissolved multipolygons and clipped/generalized at z13/z14; no building dimensions are extracted from them. This is a flat-ground geographic visualization, not a photogrammetric mesh, terrain model, indoor model, collision simulation, or a completed operating work-order system.

Ramps, parking clearances, elevator specs, actual truck/forklift models and structural limits are still missing. Public API integrations are not completed. No account, key or approval was fabricated. Height comparison is only a manual arithmetic check for one entered clearance; other checks remain unknown.

MapLibre GL JS is BSD-3-Clause; its worker license is copied by setup. PMTiles code is BSD-3-Clause. Noto Sans is SIL Open Font License 1.1; the license is included beside the font and embedded in the portable HTML. The application source adds no restriction to the original map database license. Copyright/ODbL: https://www.openstreetmap.org/copyright and https://opendatacommons.org/licenses/odbl/1-0/ .

The normal static build serves all downloaded data from the same origin. The portable HTML includes UI, search index, font and worker but streams only required PMTiles ranges directly from the immutable public GitHub archive URLs. It needs internet. GitHub raw is not a production map CDN and may rate limit; host the static export with its local maps for sustained usage.
