import axios from 'axios';
import { BrowserError } from '../utils';
import { createSTAC } from '../models/stac';

/**
 * Adapter for the Collections API
 */

class CollectionApiAdapter {
  constructor() {
    // Relative URL - proxied to API
    this.baseUrl = '/collections'
    // Internal protocol 
    this.syntheticUrl = 'internal://collections';

    // Whitelisted fields supported by the API for sorting
    this.sortableFields = [
      'id',
      'title',
      'description',
      'license'
    ];
  }

  /**
   * Returns allowed sortable fields (API whitelist)
   */
  getSortableFields() {
    return [...this.sortableFields];
  }

  /**
   * Converts internal:// URLs to HTTP API URLs
   * @param {string} internalUrl - URL with internal:// protocol
   * @returns {string} - HTTP URL for API requests
   */
  toApiUrl(internalUrl) {
    if (!internalUrl) {
      return this.baseUrl;
    }

    // Already HTTP URL (fallback for safety)
    if (internalUrl.startsWith('http://') || internalUrl.startsWith('https://')) {
      return internalUrl;
    }

    // Convert internal:// to HTTP
    if (internalUrl.startsWith('internal://collections')) {
      // Extract path and query string after 'internal://collections'
      const pathAndQuery = internalUrl.replace('internal://collections', '');
      return `${this.baseUrl}${pathAndQuery}`;
    }

    // Fallback: return base URL
    return this.baseUrl;
  }

  /**
   * Converts HTTP API URLs to internal:// protocol URLs
   * @param {string} apiUrl - HTTP URL from API response
   * @returns {string} - URL with internal:// protocol for STAC Browser
   */
  toInternalUrl(apiUrl) {
    if (!apiUrl) {
      return this.syntheticUrl;
    }

    // Already internal:// (fallback for safety)
    if (apiUrl.startsWith('internal://')) {
      return apiUrl;
    }

    // Absolute URL: http://localhost:4000/collections → internal://collections
    if (apiUrl.startsWith(this.apiBaseUrl)) {
      const pathAndQuery = apiUrl.replace(this.apiBaseUrl, '');
      return `internal:/${pathAndQuery}`;
    }

    // Relative URL: /collections → internal://collections
    if (apiUrl.startsWith('/collections')) {
      return `internal:/${apiUrl}`;
    }

    // Fallback: return as-is
    return apiUrl;
  }

  /**
   * Builds the initial request URL with filters and sorting
   * @param {Object} filters - Filter parameters
   * @param {string|null} sort - Sort parameter
   * @returns {string} - Complete HTTP URL with query parameters
   */
  buildRequestUrl(filters = {}, sort = null) {
    const params = new URLSearchParams();

    // Add free-text search (q parameter)
    if (filters.q && typeof filters.q === 'string') {
      params.append('q', filters.q.trim());
    }

    // Add datetime filter
    if (filters.datetime) {
      // Helper to convert Date objects or parseable strings to ISO 8601 UTC
      const toIso = (val) => {
        if (val == null) return null;
        if (val instanceof Date) return val.toISOString();
        if (typeof val === 'string') {
          const trimmed = val.trim();
          const parsed = Date.parse(trimmed);
          if (!Number.isNaN(parsed)) return new Date(parsed).toISOString();
          return trimmed;
        }
        return String(val);
      };

      // Support either an array [start, end] or a single string
      if (Array.isArray(filters.datetime)) {
        const [start = null, end = null] = filters.datetime;
        // If both are null/undefined, don't add a filter
        if (!(start == null && end == null)) {
          const s = toIso(start);
          const e = toIso(end);

          if (s != null && e != null && s === e) {
            params.append('datetime', s);
      } else if (s == null && e != null) {
            params.append('datetime', `../${e}`);
          } else if (s != null && e == null) {
            params.append('datetime', `${s}/..`);
          } else {
            params.append('datetime', `${s}/${e}`);
          }
        }
      } else if (typeof filters.datetime === 'string' && filters.datetime.trim() !== '') {
        // single instant or ISO interval string
        params.append('datetime', toIso(filters.datetime));
      }
    }

    // Add other filters if present (placeholder for bbox etc.)

    // Add CQL2 filter 
    if (filters.cql2 && typeof filters.cql2 === 'string') {
      const trimmed = filters.cql2.trim();
      if (trimmed) {
        params.append('filter', trimmed);
        params.append('filter-lang', 'cql2-text');
      }
    }

    // Add sorting (sortby parameter)
    if (sort && typeof sort === 'string') {
      const fields = sort.split(',').map(s => s.replace(/^[+-]/, ''));
      const invalid = fields.find(f => !this.sortableFields.includes(f));
      if (invalid) {
        throw new BrowserError(`Invalid sort field: ${invalid}`);
      }
      params.append('sortby', sort);
    }
    // Build URL with query string
    return params.toString()
      ? `${this.baseUrl}?${params.toString()}`
      : this.baseUrl;
  }

  /**
   * Fetches all collections
   * @param {Object} filters - Optional filters (q, bbox, datetime)
   * @param {string|null} sort - Optional sort parameter (e.g. "+title", "-id")
   * @param {string|null} paginationUrl - pagination URL 
   */
  async fetchCollections(filters = {}, sort = null, paginationUrl = null) {
    try {
      let requestUrl;

      if (paginationUrl && typeof paginationUrl === 'string') {
        // Convert internal:// to HTTP for API request
        requestUrl = this.toApiUrl(paginationUrl);
      } else {
        // Build initial request with filters
        requestUrl = this.buildRequestUrl(filters, sort);
      }

      const response = await axios.get(requestUrl);

      // Validate response structure
      if (!response.data?.collections || !Array.isArray(response.data.collections)) {
        throw new BrowserError('Invalid API response: missing collections array');
      }

      // Convert all pagination link HREFs to internal:// protocol
      const paginationLinks = (response.data.links || []).map(link => {
        if (!link.href) return link;

        return {
          ...link,
          href: this.toInternalUrl(link.href)
        };
      });

      return {
        collections: response.data.collections,
        paginationLinks: paginationLinks
      };

    } catch (error) {
      const status = error.response?.status;
      const data = error.response?.data;
      const details = data ? (typeof data === 'object' ? JSON.stringify(data) : String(data)) : '';

      throw new BrowserError(
        `API Error: ${status ? status + ' ' : ''}${error.message}${details ? ' - ' + details : ''}`
      );
    }
  }

  /**
   * Fetches a single collection by ID
   * @param {string} id - Collection ID
   */
  async fetchCollection(id) {
    try {
      const url = `${this.baseUrl}/${id}`;
      const response = await axios.get(url);

      if (!response.data) {
        throw new BrowserError('Collection not found');
      }

      return response.data;

    } catch (error) {
      throw new BrowserError(`API Error: ${error.message}`);
    }
  }

  /**
   * Prepares a STAC Collection for use in the browser
   * Adds internal browser metadata (href, path)
   */
  wrapCollection(collection) {
    const collectionUrl = `${this.syntheticUrl}/${collection.id}`;

    return createSTAC(
      collection,
      collectionUrl,
      `/collections/${collection.id}`
    );
  }

  /**
   * Creates a catalog for the collections list
   * @param {Array} collections - Array of STAC collections
   * @param {Object} filters - Active filters (q, datetime etc.)
   * @param {string|null} sort - Sort parameter
   * @param {Array} paginationLinks - Pagination links
   */
  createCatalog(collections, filters = {}, sort = null, paginationLinks = []) {
    const catalogData = {
      type: 'Catalog',
      id: 'collections',
      title: 'Collections',
      stac_version: '1.0.0',
      links: [
        { rel: 'self', href: this.syntheticUrl, type: 'application/json' },
        ...paginationLinks
      ]
    };

    const catalog = createSTAC(catalogData, this.syntheticUrl, '/collections');
    catalog._apiCollections = collections;
    catalog._filters = filters;
    catalog._sort = sort;
    catalog._paginationLinks = [...paginationLinks];

    return catalog;
  }
}

export default new CollectionApiAdapter();