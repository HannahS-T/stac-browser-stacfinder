import axios from 'axios';
import { BrowserError } from '../utils';
import CollectionQueryable from '../models/cql2/collectionQueryable';

class CollectionApiAdapter {
  constructor() {
    this.sortableFields = ['title', 'description', 'temporal_start', 'temporal_end'];
    this.queryablesCache = null;
  }

  getSortableFields() {
    return [...this.sortableFields];
  }

  getBaseUrl() {
    const config = window.STAC_BROWSER_CONFIG || {};
    return config.stacFinderApiUrl || '/api';
  }

  async fetchQueryables() {
    if (this.queryablesCache) return this.queryablesCache;
    try {
      const baseUrl = this.getBaseUrl();
      const response = await axios.get(baseUrl + '/collections/queryables');
      if (!response.data?.properties) throw new BrowserError('Invalid queryables response');
      let queryables = Object.entries(response.data.properties)
        .map(([id, schema]) => new CollectionQueryable(id, schema))
        .filter(q => q.supported);

      // ============================================================
      // TEMPORARY: Add timestamp fields and doi manually and filter out broken fields until backend updates
      // ============================================================

      // FILTER OUT BROKEN FIELDS
      // These fields exist in queryables.js but NOT in queryableMap.js
      const brokenFields = [
        'gsd_summary',       // Backend has type: 'jsonb' (commented out), not text_array
        'temporal_extent',   // Not in queryableMap, conceptually wrong (use temporal_start/end instead)
        'spatial_extent'     // Not filterable via CQL2 (use bbox parameter instead)
      ];
      queryables = queryables.filter(q => !brokenFields.includes(q.id));

      // Check if fields already exist (for future-proofing)
      const hasTemporalStart = queryables.some(q => q.id === 'temporal_start');
      const hasTemporalEnd = queryables.some(q => q.id === 'temporal_end');
      const hasDoi = queryables.some(q => q.id === 'doi');

      // Add temporal_start if not present
      if (!hasTemporalStart) {
        queryables.push(new CollectionQueryable('temporal_start', {
          type: 'string',
          format: 'date-time',
          title: 'Zeitbeginn',
          description: 'Startdatum der Collection (ISO 8601)'
        }));
      }

      // Add temporal_end if not present
      if (!hasTemporalEnd) {
        queryables.push(new CollectionQueryable('temporal_end', {
          type: 'string',
          format: 'date-time',
          title: 'Zeitende',
          description: 'Enddatum der Collection (ISO 8601)'
        }));
      }

      // Add doi field (text field) if not present
      if (!hasDoi) {
        queryables.push(new CollectionQueryable('doi', {
          type: 'string',
          title: 'DOI',
          description: 'Digital Object Identifier'
        }));
      }

      // ============================================================
      // TEMPORARY: Add timestamp fields and doi manually and filter out broken fields until backend updates
      // ============================================================

      // Cache result
      this.queryablesCache = queryables;
      return queryables;
    } catch (error) {
      throw new BrowserError('Failed to load queryables: ' + error.message);
    }
  }

  buildQueryParams(filters = {}, sort = null) {
    const params = {};
    // Add free-text search (q parameter)
    if (filters.q && typeof filters.q === 'string') params.q = filters.q.trim();
    
    // Add datetime filter
    if (filters.datetime) {
      // Helper to convert Date objects or parseable strings to ISO 8601 UTC
      const toIso = (val) => {
        if (val == null) return null;
        if (val instanceof Date) return val.toISOString();
        if (typeof val === 'string') {
          const parsed = Date.parse(val.trim());
          if (!Number.isNaN(parsed)) return new Date(parsed).toISOString();
          return val.trim();
        }
        return String(val);
      };
      if (Array.isArray(filters.datetime)) {
        const [start, end] = filters.datetime;
        if (!(start == null && end == null)) {
          const s = toIso(start);
          const e = toIso(end);
          if (s && e && s === e) params.datetime = s;
          else if (!s && e) params.datetime = '../' + e;
          else if (s && !e) params.datetime = s + '/..';
          else params.datetime = s + '/' + e;
        }
      } else if (typeof filters.datetime === 'string' && filters.datetime.trim()) {
        params.datetime = toIso(filters.datetime);
      }
    }

    // Add bbox filter
    if (filters.bbox && Array.isArray(filters.bbox) && filters.bbox.length === 4) {
      params.bbox = filters.bbox.join(',');
    }
    
    // Add CQL2 filter
    if (filters.cql2 && typeof filters.cql2 === 'string' && filters.cql2.trim()) {
      params.filter = filters.cql2.trim();
      params['filter-lang'] = 'cql2-text';
    }

    // Add sorting (sortby parameter)
    if (sort && typeof sort === 'string') {
      const fields = sort.split(',').map(s => s.replace(/^[+-]/, ''));
      const invalid = fields.find(f => !this.sortableFields.includes(f));
      if (invalid) throw new BrowserError('Invalid sort field: ' + invalid);
      params.sortby = sort;
    }
    return params;
  }

  buildFilteredLink(baseHref, filters = {}, sort = null) {
    const params = this.buildQueryParams(filters, sort);
    const url = new URL(baseHref, window.location.origin);
    Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
    return { href: url.toString(), rel: 'data', type: 'application/json' };
  }

  clearCache() {
    this.queryablesCache = null;
  }
}

export default new CollectionApiAdapter();
