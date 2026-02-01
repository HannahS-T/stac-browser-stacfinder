# Advanced Collection Search

## Overview

The STAC Browser has been extended by [GeoStack Solutions](https://github.com/GeoStack-Solutions) with advanced collection search functionality as part of the [STACFinder](https://github.com/GeoStack-Solutions/stac-finder) project. The extension enables cross-catalog collection browsing through API integration.

### What Was Extended

The standard STAC Browser was designed to browse individual STAC Catalogs via their static JSON files or STAC API endpoints. STACFinder adds:

- **Cross-Catalog Search**: Browse collections from multiple STAC Index catalogs through a single interface
- **External API Integration**: Connects to a STAC API backend that aggregates collections from multiple STAC catalogs
- **Advanced Filtering**: CQL2-based filtering, free-text search, temporal and spatial filters
- **URL-based State**: Filter parameters in URL for bookmarking and sharing
- **Session Persistence**: Metadata filters and pagination preserved during navigation
---

## Getting Started

For detailed installation and setup instructions, please refer to the [STACFinder README](https://github.com/GeoStack-Solutions/stac-finder/blob/main/README.md).

### Quick Start Summary

**Prerequisites:**

1. **Git** installed
2. Make sure [Docker](https://www.docker.com/) is installed and running

**Development Setup:**

1. Clone the [STACFinder](https://github.com/GeoStack-Solutions/stac-finder) repository with STAC Browser as a submodule and open the project.
```bash
# Clone repository with submodules
git clone --recurse-submodules https://github.com/GeoStack-Solutions/stac-finder.git
```

2. Configure environment variables  
   Database credentials must be configured in two separate `.env` files. Copy the example files and add your passwords:

```bash
# API Service
# Copy example file
cp api/.env.example api/.env

# Then edit api/.env and set password:
# DB_PASS=YourSecurePassword
```

```bash
# Crawler Service
# Copy example file
cp crawler/.env.example crawler/.env

# Then edit crawler/.env and set password:
# DB_PASS=YourSecurePassword
```

3. Start Docker 

```bash
#First start (build container)
docker-compose up --build

# Stop
docker-compose down
```

4. Access the application
- Web UI (STAC Browser): [http://localhost:8080](http://localhost:8080)
- API Backend: [http://localhost:4000](http://localhost:4000)

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
/collections?sortby=-title,+id
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

Filterable fields from `/collections/queryables` endpoint. The frontend generates filter UI automatically.

| Field | Type | Description |
|-------|------|-------------|
| `title`, `description`, `doi` | text | Free text with `=`, `!=`, `LIKE` |
| `license` | enum | License identifier (dynamic values from DB) |
| `platform`, `constellation`, `processingLevel` | enum | Array-backed fields (dynamic values from DB) |
| `provider` | enum | Provider name from JSONB (dynamic values from DB) |
| `keywords` | text | Keyword search |
| `gsd` | number | Ground sample distance |
| `temporal_start`, `temporal_end` | timestamp | Temporal extent boundaries |

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

**Base URL:** `http://localhost:4000`

| Endpoint | Description |
|----------|-------------|
| `GET /collections` | List collections (with filtering, sorting, pagination) |
| `GET /collections/{id}` | Single collection by ID |
| `GET /collections/queryables` | Filterable fields schema |

### Collections Endpoint

**Parameters:**
- `q` - Free-text search
- `datetime` - Temporal filter (ISO 8601 interval)
- `bbox` - Spatial filter (minLon,minLat,maxLon,maxLat)
- `filter` - CQL2 expression
- `filter-lang` - `cql2-text` or `cql2-json`
- `sortby` - Sort fields (e.g., `-title,+id`)
- `limit` - Results per page (default: 9, max: 10000)

### Frontend API Adapter

The frontend uses `CollectionApiAdapter.js` to communicate with the backend:

**Key Responsibilities:**
- Query parameter building for filters and sorting
- Queryables fetching and caching
- Error handling

### Configuration

In `config.js`:

| Setting | Purpose | Default |
|---------|---------|---------|
| `stacFinderApiUrl` | API base URL (proxied via vue.config.js) | `/api` |


---

## Architecture

### System Overview

```
┌─────────────────────────┐
│   STAC Browser          │  Port 8080
│   (Frontend)            │
└────────┬────────────────┘
         │ 
┌────────▼─────────────────────────────┐
│ CollectionApiAdapter + CQL2 Builder  │
└────────┬─────────────────────────────┘
         │ 
┌────────▼────────────────┐
│  STAC API (Backend)     │  Port 4000
└────────┬────────────────┘
         │ 
┌────────▼────────────────┐
│ PostgreSQL + PostGIS    │  Port 5432
└─────────────────────────┘
```

### Components

**Vue Components:**
- `StacFinderSearch.vue` - Main search view with filter panel, results, sorting and pagination
- `CollectionFilterPanel.vue` - Filter form with search, datetime, bbox, and CQL2 metadata filters
- `CollectionMetadataFilter.vue` - Dynamic CQL2 filter builder UI driven by queryables

**JavaScript Modules:**
- `CollectionApiAdapter.js` - API client for query building and queryables fetching
- `collectionCql.js` - CQL2-Text query builder for constructing filter expressions
- `collectionQueryable.js` - Queryable field definitions with type detection and operator mapping

**Vue Router:**
- `/stacfinder` → StacFinderSearch view (collection search with filters)
- `/` → Standard STAC Browser catalog view

**Vuex Store:**
- `collectionsSearchData` - Cache for search results (enables back navigation with pagination)

### State Management

The search state is managed across three layers:

| Data | Storage | Survives Reload | Survives Back-Nav |
|------|---------|-----------------|-------------------|
| Simple filters (q, bbox, datetime, sort) | **URL** | ✅ | ✅ | 
| Metadata filters (CQL2) | **sessionStorage** | ✅ | ✅ |
| Pagination + Results | **Vuex Cache** | ❌ | ✅ | 

**URL Format:**
```
/stacfinder?q=sentinel&bbox=7,51,8,52&datetime=2024-01-01/..&sort=-title
```

### Data Flow

```
1. User enters filters in CollectionFilterPanel
   
2. Filter Submission:
   → CollectionFilterPanel emits @submit with filters
   → StacFinderSearch.searchCollections() receives filters
   → Updates URL with simple filters
   → Saves metadata filters to sessionStorage
   → Calls API via CollectionApiAdapter

3. API Request:
   → CollectionApiAdapter.buildFilteredLink() constructs URL
   → stacRequest() sends GET to /collections?q=...&filter=...

4. Response Handling:
   → Results cached in Vuex (collectionsSearchData)
   → Collections rendered as cards with pagination

5. Navigation:
   → User clicks collection → navigates to detail view
   → Back button → Vuex cache restores results + pagination
   → Reload (F5) → URL params + sessionStorage restore filters
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

 
**Last Updated:** January 2026  
**Maintainers:** GeoStack Solutions