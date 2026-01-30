# Advanced Collection Search

## Overview

The STAC Browser has been extended by [GeoStack Solutions](https://github.com/GeoStack-Solutions) with advanced collection search functionality as part of the [STACFinder](https://github.com/GeoStack-Solutions/stac-finder) project. The extension enables cross-catalog collection browsing through a API integration. The enhanced STAC Browser allows users to search, filter, and browse STAC Collections from multiple catalogs stored in a PostgreSQL/PostGIS database.

### What Was Extended

The standard STAC Browser was designed to browse individual STAC Catalogs via their static JSON files or STAC API endpoints. STACFinder adds:

- **Cross-Catalog Search**: Browse collections from multiple STAC Index catalogs through a single interface
- **External API Integration**: Connects to a STAC API backend that aggregates collections from multiple STAC catalogs and APIs
- **Advanced Filtering**: CQL2-based filtering, free-text search, temporal and spatial filters
- **Modified UI Components**: Filter panels, queryables-driven filter builder, enhanced pagination and sorting
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

### 1. Free-Text Search(`q`)
- Users can search for collections using keywords that match collection titles, descriptions, and keywords
```
/collections?q=sentinel
```

### 2. Temporal Filtering (`datetime`)
- Filter collections by their temporal extent using an date picker
- Collections with temporal extents overlapping this range will be included
```
/collections?datetime=2020-01-01/2020-12-31
```

### 3. Spatial Filtering (`bbox`)
- Define a bounding box (bbox) on an interactive map to filter collections by their spatial extent
- Collections with spatial extents intersecting this bbox will be included
```
/collections?bbox=-180,-90,180,90
```

### 4. Advanced Metadata Filtering (`filter`, `filter-lang`)
- Create complex queries using CQL2 (Common Query Language 2) expressions
- Filter by metadata fields like keywords, license, platform, constellation
```
/collections?filter=keywords IN ('satellite','optical')&filter-lang=cql2-text
```

### 5. Sorting (`sortby`)
- Sort search results by different fields (title, description, temporal_start, temporal_end)
- `+` for ascending (default) or `-` for descending order
```
/collections?sortby=-title,+id
```

### 6. Pagination (`limit`)
- Token-based pagination for efficient navigation through large result sets
- API returns `next`/`prev` links in response - tokens are opaque and handled automatically
- Optional `limit` parameter sets results per page (default: 9, max: 10000)
```
# Request
GET /collections?limit=50

# Response
  "collections": [...],
  "links": [
    { "rel": "self", "href": "/collections?limit=50" },
    { "rel": "next", "href": "/collections?limit=50&token=xyz" }
  ]
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

Filterable fields discoverable via `/collections/queryables` endpoint. Frontend automatically generates filter UI based on field types and supported operators.

### Operators:
- Text fields: `=`, `!=`, `LIKE` (case-insensitive pattern matching)
- Array fields: `IN` (match any value in array)
- Timestamps: `<`, `>`, `BETWEEN`
- Spatial: `S_INTERSECTS`, `S_CONTAINS`, `S_OVERLAPS`, `S_WITHIN`
- Logical: `AND`, `OR`, `NOT`, `()`

### Queryable Fields

| Field | Type | Operators 
|-------|------|-----------
| `title`, `description`, `license`, `doi` | text | `=`, `!=`, `LIKE` | 
| `keywords`, `platform_summary`, `constellation_summary` | text_array | `IN` | 
| `temporal_start`, `temporal_end` | timestamp | `<`, `>`, `BETWEEN` |
| `spatial_extent` | geometry | `S_INTERSECTS`, `S_CONTAINS`, `S_OVERLAPS`, `S_WITHIN` |

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
- URL conversion between `internal://collections` and HTTP URLs
- Query parameter building 
- Response parsing and STAC wrapping
- Queryables caching
- Error handling

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

### Added Components

**Vue Components:**
- `CollectionFilterPanel.vue` - Main filter panel container with search, datetime, bbox, and CQL2 filters
- `CollectionMetadataFilter.vue` - Dynamic CQL2 filter builder UI driven by queryables
- `Collections.vue` - Collections list view with sorting controls

**JavaScript Modules:**
- `CollectionApiAdapter.js` - API client handling URL conversion, request building, and response parsing
- `collectionCql.js` - CQL2-Text query builder for constructing filter expressions
- `collectionQueryable.js` - Queryable field definitions with type detection and operator mapping

**Vue Router (Extended):**
- `/collections` → Collections list view
- `/collections/:id` → Single collection detail view

**Vuex Store (Added):**
- **State**: `collectionsFilters`, `collectionsSort`, `collectionsPaginationUrl`
- **Actions**: `loadExternalCollections`, `loadExternalCollection`
- **Mutations**: `setExternalCollections`, `setExternalCollection`, `setCollectionsFilters`, `setCollectionsSort`, `setCollectionsPaginationUrl`
- **Getters**: `collectionSortableFields`

### Data Flow

**Standard Workflow:** User searches for collections and views details

```
1. Application Start:
   → SelectDataSource.vue displays CollectionFilterPanel
   → User enters filters (q, datetime, bbox, CQL2 metadata)
   
2. Filter Submission:
   → CollectionFilterPanel emits @submit with filters
   → SelectDataSource.browseCollections() receives filters
   → Calls store.dispatch('loadExternalCollections', { filters })
   → Navigates to /collections

3. Data Loading (Vuex Store):
   → loadExternalCollections() stores filters in state
   → Calls CollectionApiAdapter.fetchCollections()
   → Adapter builds URL and sends Axios GET request

4. Backend Processing:
   → API receives /collections?q=...&filter=...&sortby=...
   → PostgreSQL executes query with filters
   → Returns collections + pagination links

5. Response Processing:
   → Adapter converts pagination links (HTTP → internal://)
   → Wraps collections as STAC format
   → Creates synthetic catalog and stores in Vuex

6. Rendering:
   → Router matches /collections → Browse.vue
   → BrowseMixin detects internal:// URL
   → Browse renders Collections.vue
   → Collections displays Catalogs component with cards

7. Detail View:
   → User clicks collection card
   → Navigate to /collections/{id}
   → loadExternalCollection() fetches single collection
   → Catalog.vue renders full metadata
```

### URL Schema

Three-layer URL system for routing and API communication:

| Layer | Example | Purpose |
|-------|---------|---------|
| **Browser URLs** | `/collections?q=sentinel` | User-facing URLs (Vue Router) |
| **Internal URLs** | `internal://collections?q=sentinel` | State management (Vuex, detected by BrowseMixin) |
| **API URLs** | `/collections?q=sentinel` | HTTP requests to backend (Axios) |

**Purpose:** The `internal://` protocol distinguishes collections API requests from regular STAC catalog browsing. `CollectionApiAdapter` converts between internal and API URLs automatically.

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