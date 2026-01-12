import axios from 'axios';
import { BrowserError } from '../utils';
import { createSTAC } from '../models/stac';

/**
 * Minimal adapter for the Collections API
 */

class CollectionApiAdapter {
  constructor() {
    this.baseUrl = '/collections';
    this.syntheticUrl = 'internal://collections';

    // Whitelisted fields supported by the API for sorting
    // Must match backend validation exactly
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
   * Fetches all collections
   * @param {Object} filters - Optional filters for the collections (e.g. q, bbox, datetime)
   * @param {string|null} sort - Optional sort parameter (e.g. "+title", "-id") passed separately
   * @param {string|null} paginationUrl - Optional direct pagination URL from API links (preferred)
   */
  async fetchCollections(filters = {}, sort = null, paginationUrl = null) {
    try {
      let url;

      // If a direct pagination URL is provided, use it as-is 
      if (paginationUrl && typeof paginationUrl === 'string') {
        url = paginationUrl;
      } else {
        // Build query parameters for initial request
        const params = new URLSearchParams();

        // Add free-text search (q parameter)
        if (filters.q && typeof filters.q === 'string') {
          params.append('q', filters.q.trim());
        }

        // Add other filters if present (placeholder for bbox, datetime, etc.)

        // Add sorting (sortby parameter) if provided separately
        if (sort && typeof sort === 'string') {
          const fields = sort.split(',').map(s => s.replace(/^[+-]/, ''));
          const invalid = fields.find(f => !this.sortableFields.includes(f));
          if (invalid) {
            throw new BrowserError(`Invalid sort field: ${invalid}`);
          }
          params.append('sortby', sort);
        }

        // Build URL with query string
        url = params.toString() ? `${this.baseUrl}?${params.toString()}` : this.baseUrl;
      }

      const response = await axios.get(url);

      if (!response.data?.collections || !Array.isArray(response.data.collections)) {
        throw new BrowserError('Invalid API response');
      }

      return {
        collections: response.data.collections,
        links: response.data.links || []
      };
    } catch (error) {
      throw new BrowserError(`API Error: ${error.message}`);
    }
  }

  /**
   * Fetches a single collection by ID
   */
  async fetchCollection(id) {
    try {
      const response = await axios.get(`${this.baseUrl}/${id}`);

      if (!response.data) {
        throw new BrowserError('Collection not found');
      }

      return response.data;
    } catch (error) {
      throw new BrowserError(`API Error: ${error.message}`);
    }
  }

/**
 * Prepares a STAC Collection from the API for use in the browser
 * Does not modify the API data; only adds internal browser metadata (href, path)
 */
  wrapCollection(collection) {
  const collectionUrl = `${this.syntheticUrl}/${collection.id}`;

  return createSTAC(
    collection,
    collectionUrl,               
    `/collections/${collection.id }` 
  );
}

  /**
   * Build URL for the first page (without token parameter)
   * @param {Object} filters - Active filters (q, datetime, bbox)
   * @param {string|null} sort - Sort parameter
   * @param {number} pageSize - Page size used for pagination
   * @returns {string} URL for first page
   */
  _buildFirstPageUrl(filters = {}, sort = null, pageSize) {
    const params = new URLSearchParams();

    if (filters.q) params.append('q', filters.q);
    if (filters.datetime) params.append('datetime', filters.datetime);
    if (filters.bbox) params.append('bbox', filters.bbox);
    if (sort) params.append('sortby', sort);
    if (pageSize) params.append('limit', pageSize);

    return params.toString()
      ? `${this.baseUrl}?${params.toString()}`
      : this.baseUrl;
  }

  /**
   * Creates a catalog for the collections list
   * @param {Array} collections - Array of STAC collections
   * @param {Object} filters - Active filters (q, datetime etc.)
   * @param {string|null} sort - Sort parameter
   * @param {Array} links - Pagination links from API response
   * @param {number} offset - Current offset in the result set (default: 0)
    * @param {number|null} pageSize - Page size used for pagination
   */
  createCatalog(collections, filters = {}, sort = null, links = [], offset = 0, pageSize = null) {
    const catalogData = {
      type: 'Catalog',
      id: 'collections',
      title: 'Collections',
      stac_version: '1.0.0',
      links: [
        { rel: 'self', href: this.syntheticUrl, type: 'application/json' },
        ...links
      ]
    };

    const catalog = createSTAC(catalogData, this.syntheticUrl, '/collections');
    catalog._apiCollections = collections;
    catalog._filters = filters;
    catalog._sort = sort;
    catalog._offset = offset;

    // Generate pagination links
    const paginationLinks = [...links];

    // Add first link only if we know the page size
    if (pageSize && !paginationLinks.some(l => l.rel === 'first')) {
      paginationLinks.push({
        rel: 'first',
        href: this._buildFirstPageUrl(filters, sort, pageSize),
        type: 'application/json'
      });
    }

    catalog._paginationLinks = paginationLinks;

    return catalog;
  }
}

export default new CollectionApiAdapter();