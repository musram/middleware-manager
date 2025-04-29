/**
 * API service layer for the Middleware Manager
 * Centralizes all API calls and error handling
 */

const API_URL = '/api';

/**
 * Generic request handler with error handling
 * @param {string} url - API endpoint
 * @param {Object} options - Fetch options
 * @returns {Promise<any>} - Response data
 */
const request = async (url, options = {}) => {
  try {
    const response = await fetch(url, options);
    
    // If the response is not ok, throw an error
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const error = new Error(errorData.message || `HTTP error ${response.status}`);
      error.status = response.status;
      error.data = errorData;
      throw error;
    }
    
    // Parse JSON response
    return await response.json();
  } catch (error) {
    console.error(`API error: ${error.message}`, error);
    throw error;
  }
};

/**
 * Resource-related API calls
 */
export const ResourceService = {
  /**
   * Get all resources
   * @returns {Promise<Array>} - List of resources
   */
  getResources: () => request(`${API_URL}/resources`),
  
  /**
   * Get a specific resource by ID
   * @param {string} id - Resource ID
   * @returns {Promise<Object>} - Resource data
   */
  getResource: (id) => request(`${API_URL}/resources/${id}`),
  
  /**
   * Delete a resource
   * @param {string} id - Resource ID
   * @returns {Promise<Object>} - Response message
   */
  deleteResource: (id) => request(`${API_URL}/resources/${id}`, { method: 'DELETE' }),
  
  /**
   * Assign a middleware to a resource
   * @param {string} resourceId - Resource ID
   * @param {Object} data - Middleware assignment data
   * @returns {Promise<Object>} - Response data
   */
  assignMiddleware: (resourceId, data) => request(
    `${API_URL}/resources/${resourceId}/middlewares`, 
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }
  ),
  
  /**
   * Assign multiple middlewares to a resource
   * @param {string} resourceId - Resource ID
   * @param {Object} data - Multiple middleware assignment data
   * @returns {Promise<Object>} - Response data
   */
  assignMultipleMiddlewares: (resourceId, data) => request(
    `${API_URL}/resources/${resourceId}/middlewares/bulk`, 
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }
  ),
  
  /**
   * Remove a middleware from a resource
   * @param {string} resourceId - Resource ID
   * @param {string} middlewareId - Middleware ID
   * @returns {Promise<Object>} - Response message
   */
  removeMiddleware: (resourceId, middlewareId) => request(
    `${API_URL}/resources/${resourceId}/middlewares/${middlewareId}`, 
    { method: 'DELETE' }
  ),
  
  /**
   * Update HTTP configuration
   * @param {string} resourceId - Resource ID
   * @param {Object} data - HTTP configuration data
   * @returns {Promise<Object>} - Response data
   */
  updateHTTPConfig: (resourceId, data) => request(
    `${API_URL}/resources/${resourceId}/config/http`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }
  ),
  
  /**
   * Update TLS configuration
   * @param {string} resourceId - Resource ID
   * @param {Object} data - TLS configuration data
   * @returns {Promise<Object>} - Response data
   */
  updateTLSConfig: (resourceId, data) => request(
    `${API_URL}/resources/${resourceId}/config/tls`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }
  ),
  
  /**
   * Update TCP configuration
   * @param {string} resourceId - Resource ID
   * @param {Object} data - TCP configuration data
   * @returns {Promise<Object>} - Response data
   */
  updateTCPConfig: (resourceId, data) => request(
    `${API_URL}/resources/${resourceId}/config/tcp`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }
  ),
  
  /**
   * Update headers configuration
   * @param {string} resourceId - Resource ID
   * @param {Object} data - Headers configuration data
   * @returns {Promise<Object>} - Response data
   */
  updateHeadersConfig: (resourceId, data) => request(
    `${API_URL}/resources/${resourceId}/config/headers`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }
  ),
  
  /**
   * Update router priority
   * @param {string} resourceId - Resource ID
   * @param {Object} data - Router priority data
   * @returns {Promise<Object>} - Response data
   */
  updateRouterPriority: (resourceId, data) => request(
    `${API_URL}/resources/${resourceId}/config/priority`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }
  )
};

/**
 * Middleware-related API calls
 */
export const MiddlewareService = {
  /**
   * Get all middlewares
   * @returns {Promise<Array>} - List of middlewares
   */
  getMiddlewares: () => request(`${API_URL}/middlewares`),
  
  /**
   * Get a specific middleware by ID
   * @param {string} id - Middleware ID
   * @returns {Promise<Object>} - Middleware data
   */
  getMiddleware: (id) => request(`${API_URL}/middlewares/${id}`),
  
  /**
   * Create a new middleware
   * @param {Object} data - Middleware data
   * @returns {Promise<Object>} - Created middleware
   */
  createMiddleware: (data) => request(
    `${API_URL}/middlewares`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }
  ),
  
  /**
   * Update a middleware
   * @param {string} id - Middleware ID
   * @param {Object} data - Updated middleware data
   * @returns {Promise<Object>} - Updated middleware
   */
  updateMiddleware: (id, data) => request(
    `${API_URL}/middlewares/${id}`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }
  ),
  
  /**
   * Delete a middleware
   * @param {string} id - Middleware ID
   * @returns {Promise<Object>} - Response message
   */
  deleteMiddleware: (id) => request(
    `${API_URL}/middlewares/${id}`,
    { method: 'DELETE' }
  )
};

/**
 * Utility functions for middleware management
 */
export const MiddlewareUtils = {
  /**
   * Parses middleware string into an array of middleware objects
   * @param {string} middlewaresStr - Comma-separated middleware string
   * @returns {Array} - Array of middleware objects
   */
  parseMiddlewares: (middlewaresStr) => {
    // Handle empty or invalid input
    if (!middlewaresStr || typeof middlewaresStr !== 'string') return [];

    return middlewaresStr
      .split(',')
      .filter(Boolean)
      .map((item) => {
        const [id, name, priority] = item.split(':');
        return {
          id,
          name,
          priority: parseInt(priority, 10) || 100, // Default priority if invalid
        };
      });
  },
  
  /**
   * Gets template config for middleware type
   * @param {string} type - Middleware type
   * @returns {string} - JSON template
   */
  getConfigTemplate: (type) => {
    const templates = {
      basicAuth: '{\n  "users": [\n    "admin:$apr1$H6uskkkW$IgXLP6ewTrSuBkTrqE8wj/"\n  ]\n}',
      digestAuth: '{\n  "users": [\n    "test:traefik:a2688e031edb4be6a3797f3882655c05"\n  ]\n}',
      forwardAuth: '{\n  "address": "http://auth-service:9090/auth",\n  "trustForwardHeader": true,\n  "authResponseHeaders": [\n    "X-Auth-User",\n    "X-Auth-Roles"\n  ]\n}',
      ipWhiteList: '{\n  "sourceRange": [\n    "127.0.0.1/32",\n    "192.168.1.0/24"\n  ]\n}',
      ipAllowList: '{\n  "sourceRange": [\n    "127.0.0.1/32",\n    "192.168.1.0/24"\n  ]\n}',
      rateLimit: '{\n  "average": 100,\n  "burst": 50\n}',
      headers: '{\n  "browserXssFilter": true,\n  "contentTypeNosniff": true,\n  "customFrameOptionsValue": "SAMEORIGIN",\n  "forceSTSHeader": true,\n  "stsIncludeSubdomains": true,\n  "stsSeconds": 63072000,\n  "customResponseHeaders": {\n    "X-Custom-Header": "value",\n    "Server": ""\n  }\n}',
      stripPrefix: '{\n  "prefixes": [\n    "/api"\n  ],\n  "forceSlash": true\n}',
      addPrefix: '{\n  "prefix": "/api"\n}',
      redirectRegex: '{\n  "regex": "^http://(.*)$",\n  "replacement": "https://${1}",\n  "permanent": true\n}',
      redirectScheme: '{\n  "scheme": "https",\n  "permanent": true,\n  "port": "443"\n}',
      chain: '{\n  "middlewares": []\n}',
      replacePath: '{\n  "path": "/newpath"\n}',
      replacePathRegex: '{\n  "regex": "^/api/(.*)",\n  "replacement": "/bar/$1"\n}',
      stripPrefixRegex: '{\n  "regex": [\n    "^/api/v\\\\d+/"\n  ]\n}',
      plugin: '{\n  "plugin-name": {\n    "option1": "value1",\n    "option2": "value2"\n  }\n}'
    };
    
    return templates[type] || '{}';
  }
};