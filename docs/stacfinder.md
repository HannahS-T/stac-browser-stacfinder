# Advanced Collection Search

## Overview

The STAC Browser has been extended by [GeoStack Solutions](https://github.com/GeoStack-Solutions) with advanced collection search functionality as part of the [STACFinder](https://github.com/GeoStack-Solutions/stac-finder) project. The extension enables cross-catalog collection browsing through API integration.

### What Was Extended

The standard STAC Browser browses one catalog at a time. STACFinder adds **cross-catalog collection search**: a single interface to search and filter collections from all STAC Index catalogs, powered by a centralized backend that aggregates metadata via the Crawler.

---

## Getting Started

For detailed installation and setup instructions, please refer to the [STACFinder README](https://github.com/GeoStack-Solutions/stac-finder/blob/main/README.md).

### Quick Start Summary

**Prerequisites:**

1. Make sure [Docker](https://www.docker.com/) is installed and running
2. **Node.js** installed (only for local development)

**Development Setup:**

1. Clone the [STACFinder](https://github.com/GeoStack-Solutions/stac-finder) repository with STAC Browser as a submodule and open the project.
```bash
# Clone repository with submodules
git clone --recurse-submodules https://github.com/GeoStack-Solutions/stac-finder.git
```

2. Configure environment variables
   Create a central `.env` file in the project root with your configuration:

```bash
# Copy example file
cp .env.example .env

# Then edit .env and configure:
# - API_PORT: Port for the API service (default: 4000)
# - WEB_UI_PORT: Port for the Web UI (default: 8080)
# - DB credentials for your PostgreSQL database
```

3. Start Docker 

```bash
#First start (build container)
docker-compose up --build

# Stop
docker-compose down
```

4. Access the application (using ports from `.env`):
- Frontend (STAC Browser): `http://localhost:${WEB_UI_PORT}` (default: [http://localhost:8080](http://localhost:8080))
- API Backend: `http://localhost:${API_PORT}` (default: [http://localhost:4000](http://localhost:4000))
---

## Key Features

### 1. Free-Text Search (`q`)
- Search across collection titles, descriptions, keywords, license, and providers
- Multiple words are searched with OR logic
```
/collections?q=sentinel
/collections?q=sentinel atmosphere    # matches "sentinel" OR "atmosphere"
```

### 2. Temporal Filtering (`datetime`)
- Filter collections by their temporal extent using a date picker
- Collections with temporal extents **overlapping** this range will be included (not only fully contained)
- Start and end dates are optional - leave empty for open-ended queries
```
/collections?datetime=2020-01-01/2020-12-31
```

### 3. Spatial Filtering (`bbox`)
- Define a bounding box (bbox) on an interactive map to filter collections by their spatial extent
- Choose spatial relation: **intersects** (default), **contains**, **within**, or **overlaps**
- `intersects` uses the efficient `bbox` parameter, others use CQL2 spatial functions
```
/collections?bbox=7,51,8,52                                        # intersects (default)
/collections?filter=S_CONTAINS(spatial_extent,BBOX(7,51,8,52))     # collection covers bbox
```

### 4. Advanced Metadata Filtering (`filter`, `filter-lang`)
- Create complex queries using CQL2 (Common Query Language 2) expressions
- Filter by metadata fields like title, description, license, platform, constellation, keywords
```
/collections?filter=platform = 'Sentinel-2'&filter-lang=cql2-text
/collections?filter=keywords IN ('satellite','optical')&filter-lang=cql2-text
```

### 5. Sorting (`sortby`)
- Sort search results by different fields (title, description, temporal_start, temporal_end)
- `+` for ascending (default) or `-` for descending order
```
/collections?sortby=-title
```

### 6. Pagination (`limit`, `token`)
- Offset-based pagination with opaque tokens for efficient navigation
- API returns `first`, `prev`, `next`, `last` links with encoded tokens
- Optional `limit` parameter sets results per page (default: 9, max: 10000)
- Use `numberMatched` from response to see total count
```
# Request
GET /collections?limit=50

# Response
{
  "collections": [...],
  "numberMatched": 1234,
  "numberReturned": 50,
  "links": [
    { "rel": "self", "href": "/collections?limit=50" },
    { "rel": "next", "href": "/collections?limit=50&token=..." }
  ]
}
```

### 7. Results Display
- Scroll through the collection cards
- Each card shows a preview of the collection's metadata
- Click on any collection to view its full details
```
# View specific collection by ID
GET /collections/sentinel-2-l2a
```
---

## Filtering (CQL2)


### Queryables



Filterable fields are loaded dynamically from `/collections/queryables`. The UI adapts automatically to available fields and types.

| Field(s)                        | Type         | Operators                | Input type              |
|----------------------------------|-------------|--------------------------|--------------------------|
| title, description, doi          | Text         | =, ≠, ~                  | Free text                |
| keywords                        | Text-Array   | =, ≠, ∈                  | Free text and multi select |
| license, provider                | Enum         | =, ≠, ∈                  | Dropdown (DB-based)      |
| platform, constellation, processingLevel | Enum/Array | =, ≠, ∈            | Dropdown (DB-based)       |
| gsd                             | Number       | =, ≠, <, ≤, >, ≥         |  Number input  |
| temporal_start, temporal_end    | Timestamp    | <, >, ⇔                  | Date picker     |

**Legend:**
- = (equals), ≠ (not equals), ~ (contains/LIKE), ∈ (IN/contains one of), <, ≤, >, ≥, ⇔ (BETWEEN)
- Enum/array values are loaded dynamically from the database.

### Spatial Filtering

Spatial filtering uses the `bbox` parameter or CQL2 spatial functions:

| Method | Example | Description |
|--------|---------|-------------|
| `bbox` | `bbox=7,51,8,52` | Standard intersection filter (default) |
| `S_INTERSECTS` | `filter=S_INTERSECTS(spatial_extent,BBOX(...))` | Same as bbox |
| `S_CONTAINS` | `filter=S_CONTAINS(spatial_extent,BBOX(...))` | Collection covers search area |
| `S_WITHIN` | `filter=S_WITHIN(spatial_extent,BBOX(...))` | Collection inside search area |
| `S_OVERLAPS` | `filter=S_OVERLAPS(spatial_extent,BBOX(...))` | Partial overlap only |

---
## API Integration

### Endpoints

**Base URL:** `http://localhost:4000` (default or configured in .env)

| Endpoint | Description |
|----------|-------------|
| `GET /collections` | List collections (with filtering, sorting, pagination) |
| `GET /collections/{id}` | Single collection by ID |
| `GET /collections/queryables` | Filterable fields schema |
| `GET /collections/sortables` | Sortable fields schema |

### Collections Endpoint

**Parameters:**
- `q` - Free-text search
- `datetime` - Temporal filter (ISO 8601 interval)
- `bbox` - Spatial filter (minLon,minLat,maxLon,maxLat)
- `filter` - CQL2 expression
- `filter-lang` - `cql2-text` or `cql2-json`
- `sortby` - Sort fields (e.g., `-title`)
- `limit` - Results per page (default: 9, max: 10000)

### Frontend API Adapter

The frontend uses `CollectionApiAdapter.js` to communicate with the backend:

**Key Responsibilities:**
- Dynamically fetch and cache queryable and sortable fields from the API
- Build API-compatible query parameters for filtering, sorting, and pagination
- Construct filtered request URLs for the backend
- Handle API errors and invalid responses robustly

### Configuration

The STACFinder API URL is configured via `config.js` and `vue.config.js`, using environment variables from the root `.env` file. For Docker, the variable `SB_stacFinderApiUrl` is set 

---

## Architecture

### System Overview

```
┌─────────────────────────┐
│   STAC Browser          │ 
│   (Frontend)            │
└────────┬────────────────┘
         │ 
┌────────▼─────────────────────────────┐
│ CollectionApiAdapter + CQL2 Builder  │
└────────┬─────────────────────────────┘
         │ 
┌────────▼────────────────┐
│  STAC API (Backend)     │  
└────────┬────────────────┘
         │ 
┌────────▼────────────────┐
│ PostgreSQL + PostGIS    │  
└─────────────────────────┘
```

### Components

**Vue Components:**
- `StacFinderSearch.vue` - Main search view with filter panel, results, sorting and pagination
- `CollectionFilterPanel.vue` - Filter form with search, datetime, bbox, and CQL2 metadata filters
- `CollectionMetadataFilter.vue` - Dynamic CQL2 filter builder UI driven by queryables

**JavaScript Modules:**
- `CollectionApiAdapter.js` - API client for query building, queryables and sortables fetching
- `collectionCql.js` - CQL2-Text query builder for constructing filter expressions
- `collectionQueryable.js` - Queryable field definitions with type detection and operator mapping

**Vue Router:**
- `/stacfinder` → StacFinderSearch view (collection search with filters)

**State Management:**

Search filters, sort order, and results are stored in the global Vuex store (`stacFinderState`):

- Filter parameters, sorting, and results are kept in the store (`stacFinderState`)
- The state persists across navigation (e.g., when returning from a collection detail)
- No sessionStorage or query parameters are used; state is preserved within the SPA session


### Data Flow

```
1. User enters filters in CollectionFilterPanel
   
2. Filter Submission:
   → CollectionFilterPanel emits @submit
   → StacFinderSearch stores filters and hasSearched in the Vuex store
   → Calls API via CollectionApiAdapter

3. API Request:
   → CollectionApiAdapter.buildFilteredLink() builds URL
   → stacRequest() sends GET to /collections?q=...&filter=...

4. Response Handling:
   → Results are stored in the Vuex store (`stacFinderState.data`)
   → Collections are converted to browser paths via toBrowserPath()
   → Rendered as cards with pagination

5. Navigation:
   → User clicks collection → /external/http://localhost:4000/collections/{id}
   → STAC Browser handles collection like any external API
   → When navigating back, the search state is restored from the store
```

---
## Technology Stack

### STAC Browser (Frontend)

**Core:**
- Vue.js 2.7 + Vue Router 3.x + Vuex 3.x
- Axios 1.x - HTTP client
- Bootstrap-Vue 2.x - UI components

**Mapping & STAC:**
- OpenLayers 10.x + ol-stac 1.x
- stac-js 0.1.x, stac-node-validator 2.0

**Build:**
- Vue CLI 5.x + Webpack 5.x
- Babel 7.x, ESLint 8.x
- dotenv 17.x – Environment Variable Loader
  
### Backend
- Node.js 20.x + Express.js 4.x
- PostgreSQL 16 + PostGIS 3.4

## Related Documentation

- [STACFinder README](https://github.com/GeoStack-Solutions/stac-finder/blob/main/README.md)
- [STACFinder Documentation](https://github.com/GeoStack-Solutions/stac-finder/tree/main/docs)
- [STACFinder API Documentation](https://github.com/GeoStack-Solutions/stac-finder/tree/main/docs/api)

- [STAC Browser (Original)](https://github.com/radiantearth/stac-browser)
- [STAC Specification](https://github.com/radiantearth/stac-spec)
- [STAC API Specification](https://github.com/radiantearth/stac-api-spec)

 
**Last Updated:** February 2026  
**Maintainers:** GeoStack Solutions