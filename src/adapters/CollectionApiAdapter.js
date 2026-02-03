import axios from 'axios';
import { BrowserError } from '../utils';
import CollectionQueryable from '../models/cql2/collectionQueryable';

class CollectionApiAdapter {
  constructor() {
    this.cachedApiUrl = null;
    this.queryablesCache = null;
    this.sortablesCache = null;
  }

  /**
   * Fetch sortables from the API
   * @param {string} apiUrl - Base URL of the STACFinder API
   * @returns {Promise<Array<{id: string, title: string}>>}
   */
  async fetchSortables(apiUrl) {
    if (!apiUrl) throw new BrowserError('API URL is required');
    
    if (this.sortablesCache && this.cachedApiUrl === apiUrl) {
      return this.sortablesCache;
    }

    const response = await axios.get(`${apiUrl}/collections/sortables`);
    if (!response.data?.properties) {
      throw new BrowserError('Invalid sortables response');
    }

    this.sortablesCache = Object.entries(response.data.properties).map(([id, schema]) => ({
      id,
      title: schema.title || id
    }));
    this.cachedApiUrl = apiUrl;
    return this.sortablesCache;
  }

  /**
   * Fetch queryables from the API
   * @param {string} apiUrl - Base URL of the STACFinder API
   * @returns {Promise<CollectionQueryable[]>}
   */
  async fetchQueryables(apiUrl) {
    if (!apiUrl) throw new BrowserError('API URL is required');
    
    if (this.queryablesCache && this.cachedApiUrl === apiUrl) {
      return this.queryablesCache;
    }

    const response = await axios.get(`${apiUrl}/collections/queryables`);
    if (!response.data?.properties) {
      throw new BrowserError('Invalid queryables response');
    }

    this.queryablesCache = Object.entries(response.data.properties)
      .map(([id, schema]) => new CollectionQueryable(id, schema))
      .filter(q => q.supported);
    this.cachedApiUrl = apiUrl;
    return this.queryablesCache;
  }


  /**
   * Build query parameters for collection search requests
   * @param {Object} filters - Filter options for the query
   * @param {string} [filters.q] - Free-text search query
   * @param {Array|string} [filters.datetime] - Datetime filter (array with [start, end] or ISO string)
   * @param {number[]} [filters.bbox] - Bounding box as [west, south, east, north]
   * @param {string} [filters.cql2] - CQL2 filter expression
   * @param {number} [filters.limit] - Maximum number of results per page
   * @param {string|null} sort - Sort parameter string
   * @returns {Object} Query parameters object ready for URL construction
   */
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

    // Add sorting
    if (sort) {
      params.sortby = sort;
    }

    // Add limit (items per page)
    if (filters.limit && typeof filters.limit === 'number' && filters.limit > 0) {
      params.limit = filters.limit;
    }

    return params;
  }

  /**
   * Build a filtered link object for collection data requests
   * @param {string} baseHref - Base URL for the collection endpoint
   * @param {Object} [filters={}] - Filter options (see buildQueryParams for details)
   * @param {string|null} [sort=null] - Sort parameter string
   * @returns {{href: string, rel: string, type: string}} Link object with href, rel, and type properties
   */
  buildFilteredLink(baseHref, filters = {}, sort = null) {
    const params = this.buildQueryParams(filters, sort);
    const url = new URL(baseHref, window.location.origin);
    Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
    return { href: url.toString(), rel: 'data', type: 'application/json' };
  }

  /**
   * Clear all cached data including queryables, sortables, and the cached API URL
   * @returns {void}
   */
  clearCache() {
    this.cachedApiUrl = null;
    this.queryablesCache = null;
    this.sortablesCache = null;
  }
}

export default new CollectionApiAdapter();
