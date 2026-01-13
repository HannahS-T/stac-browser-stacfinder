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
  }

  /**
   * Fetches all collections
   * @param {Object} filters - Optional filters for the collections
   */
  async fetchCollections(filters = {}) {
  try {
    // Build query parameters
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
    
    
    // Build URL with query string
    const url = params.toString() ? `${this.baseUrl}?${params.toString()}` : this.baseUrl;
    
    console.debug('CollectionApiAdapter.fetchCollections url:', url);
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
    const status = error.response?.status;
    const data = error.response?.data;
    const details = data ? (typeof data === 'object' ? JSON.stringify(data) : String(data)) : '';
    throw new BrowserError(`API Error: ${status ? status + ' ' : ''}${error.message}${details ? ' - ' + details : ''}`);
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
   */
  createCatalog(collections, totalCount, filters = {}) {
  const catalogData = {
    type: 'Catalog',
    id: 'collections',
    title: 'Collections',
    stac_version: '1.0.0',
    links: [
      { rel: 'self', href: this.syntheticUrl, type: 'application/json' }
    ]
  };

  const catalog = createSTAC(catalogData, this.syntheticUrl, '/collections');
  catalog._apiCollections = collections;
  catalog._totalCount = totalCount;
  catalog._filters = filters; // Store filters for reference
  
  return catalog;
}
}

export default new CollectionApiAdapter();




