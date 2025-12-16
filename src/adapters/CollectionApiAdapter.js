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
   */
  async fetchCollections() {
    try {
      const response = await axios.get(this.baseUrl);
      
      if (!response.data?.collections || !Array.isArray(response.data.collections)) {
        throw new BrowserError('Invalid API response');
      }

      return {
        collections: response.data.collections,
        totalCount: response.data.numberMatched || response.data.collections.length
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
   */
  createCatalog(collections, totalCount) {
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
    
    return catalog;
  }
}

export default new CollectionApiAdapter();




