import axios from 'axios';
import { BrowserError } from '../utils';
import { createSTAC, processSTAC } from '../models/stac';

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
   * @param {number|null} limit - Optional limit for pagination (default: 10)
   * @param {string|null} token - Optional pagination token for next/prev page
   */
  async fetchCollections(filters = {}, sort = null, limit = null, token = null) {
    try {
      // Build query parameters
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

      // Add pagination parameters
      if (limit && typeof limit === 'number' && limit > 0) {
        params.append('limit', limit.toString());
      }
      
      if (token && typeof token === 'string') {
        params.append('token', token);
      }

      // Build URL with query string
      const url = params.toString() ? `${this.baseUrl}?${params.toString()}` : this.baseUrl;

      const response = await axios.get(url);

      if (!response.data?.collections || !Array.isArray(response.data.collections)) {
        throw new BrowserError('Invalid API response');
      }

      return {
        collections: response.data.collections,
        totalCount: response.data.numberMatched || response.data.collections.length,
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
   * Transforms a collection into STAC Collection format
   */
  transformToStac(collection, index = 0) {
    const collectionId = collection.id || `collection-${index}`;
    const collectionUrl = `${this.syntheticUrl}/${collectionId}`;

    const stacCollection = {
      type: 'Collection',
      stac_version: '1.0.0',
      id: collectionId,
      title: collection.title || collectionId,
      description: collection.description || '',
      license: collection.license || 'proprietary',
      extent: collection.extent || {
        spatial: { bbox: [[]] },
        temporal: { interval: [[null, null]] }
      },
      links: [
        { rel: 'self', href: collectionUrl, type: 'application/json' },
        { rel: 'root', href: this.syntheticUrl, type: 'application/json' }
      ],
      ...collection
    };

    return createSTAC(stacCollection, collectionUrl, `/collections/${collectionId}`);
  }

  /**
   * Creates a catalog for the collections list
   * @param {Array} collections - Array of STAC collections
   * @param {number} totalCount - Total number of collections (numberMatched)
   * @param {Object} filters - Active filters (q, sortby etc.)
   * @param {string|null} sort - Sort parameter
   * @param {Array} links - Pagination links from API response
   */
  createCatalog(collections, totalCount, filters = {}, sort = null, links = []) {
    const catalogData = {
      type: 'Catalog',
      id: 'collections',
      title: 'Collections',
      stac_version: '1.0.0',
      links: [
        { rel: 'self', href: this.syntheticUrl, type: 'application/json' },
        ...links // Include API pagination links
      ]
    };

    const catalog = createSTAC(catalogData, this.syntheticUrl, '/collections');
    catalog._apiCollections = collections;
    catalog._totalCount = totalCount;
    catalog._filters = filters;
    catalog._sort = sort;
    catalog._paginationLinks = links; // Store pagination links

    return catalog;
  }
}

export default new CollectionApiAdapter();
