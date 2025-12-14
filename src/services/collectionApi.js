import axios from 'axios';

// Axios instance for collection API calls
const api = axios.create({
  baseURL: '/collections' // relative URL for Prod, proxied in Dev
});

/**
 * Fetch collections with optional query parameters
 * @param {object} params - Query-Parameter: limit, sortby, bbox, datetime, filter
 */
export async function fetchCollections(params = {}) {
  const response = await api.get('/', { params });
  return response.data;
}

/**
 * Fetch metadata describing available queryable fields
 */
export async function fetchQueryables() {
  const response = await api.get('/queryables');
  return response.data;
}