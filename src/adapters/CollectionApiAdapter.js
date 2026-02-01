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
