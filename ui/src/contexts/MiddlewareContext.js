import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { MiddlewareService, MiddlewareUtils } from '../services/api';

// Create the context
const MiddlewareContext = createContext();

/**
 * Middleware provider component
 * Manages middleware state and provides data to child components
 * 
 * @param {Object} props
 * @param {ReactNode} props.children - Child components
 * @returns {JSX.Element}
 */
export const MiddlewareProvider = ({ children }) => {
  const [middlewares, setMiddlewares] = useState([]);
  const [selectedMiddleware, setSelectedMiddleware] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  /**
   * Fetch all middlewares
   */
  const fetchMiddlewares = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await MiddlewareService.getMiddlewares();
      setMiddlewares(data);
    } catch (err) {
      setError('Failed to load middlewares');
      console.error('Error fetching middlewares:', err);
    } finally {
      setLoading(false);
    }
  }, []);
  
  /**
   * Fetch a specific middleware by ID
   * 
   * @param {string} id - Middleware ID
   */
  const fetchMiddleware = useCallback(async (id) => {
    if (!id) return;
    
    try {
      setLoading(true);
      setError(null);
      const data = await MiddlewareService.getMiddleware(id);
      setSelectedMiddleware(data);
    } catch (err) {
      setError(`Failed to load middleware: ${err.message}`);
      console.error(`Error fetching middleware ${id}:`, err);
    } finally {
      setLoading(false);
    }
  }, []);
  
  /**
   * Create a new middleware
   * 
   * @param {Object} middlewareData - Middleware data
   * @returns {Promise<Object|null>} - Created middleware or null on error
   */
  const createMiddleware = useCallback(async (middlewareData) => {
    try {
      setLoading(true);
      setError(null);
      
      const newMiddleware = await MiddlewareService.createMiddleware(middlewareData);
      
      // Update middlewares list
      setMiddlewares(prevMiddlewares => [
        ...prevMiddlewares,
        newMiddleware
      ]);
      
      return newMiddleware;
    } catch (err) {
      setError(`Failed to create middleware: ${err.message}`);
      console.error('Error creating middleware:', err);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);
  
  /**
   * Update an existing middleware
   * 
   * @param {string} id - Middleware ID
   * @param {Object} middlewareData - Updated middleware data
   * @returns {Promise<Object|null>} - Updated middleware or null on error
   */
  const updateMiddleware = useCallback(async (id, middlewareData) => {
    try {
      setLoading(true);
      setError(null);
      
      const updatedMiddleware = await MiddlewareService.updateMiddleware(id, middlewareData);
      
      // Update middlewares list
      setMiddlewares(prevMiddlewares => 
        prevMiddlewares.map(middleware => 
          middleware.id === id ? updatedMiddleware : middleware
        )
      );
      
      // Update selected middleware if relevant
      if (selectedMiddleware && selectedMiddleware.id === id) {
        setSelectedMiddleware(updatedMiddleware);
      }
      
      return updatedMiddleware;
    } catch (err) {
      setError(`Failed to update middleware: ${err.message}`);
      console.error(`Error updating middleware ${id}:`, err);
      return null;
    } finally {
      setLoading(false);
    }
  }, [selectedMiddleware]);
  
  /**
   * Delete a middleware
   * 
   * @param {string} id - Middleware ID
   * @returns {Promise<boolean>} - Success status
   */
  const deleteMiddleware = useCallback(async (id) => {
    try {
      setLoading(true);
      setError(null);
      
      await MiddlewareService.deleteMiddleware(id);
      
      // Update middlewares list
      setMiddlewares(prevMiddlewares => 
        prevMiddlewares.filter(middleware => middleware.id !== id)
      );
      
      // Clear selected middleware if relevant
      if (selectedMiddleware && selectedMiddleware.id === id) {
        setSelectedMiddleware(null);
      }
      
      return true;
    } catch (err) {
      setError(`Failed to delete middleware: ${err.message}`);
      console.error(`Error deleting middleware ${id}:`, err);
      return false;
    } finally {
      setLoading(false);
    }
  }, [selectedMiddleware]);
  
  /**
   * Get a configuration template for middleware type
   * 
   * @param {string} type - Middleware type
   * @returns {string} - JSON template string
   */
  const getConfigTemplate = useCallback((type) => {
    return MiddlewareUtils.getConfigTemplate(type);
  }, []);
  
  /**
   * Format middleware display for UI
   * 
   * @param {Object} middleware - Middleware object
   * @returns {JSX.Element} - Formatted middleware display
   */
  const formatMiddlewareDisplay = useCallback((middleware) => {
    // Determine if middleware is a chain type
    const isChain = middleware.type === 'chain';

    // Parse config safely
    let configObj = middleware.config;
    if (typeof configObj === 'string') {
      try {
        configObj = JSON.parse(configObj);
      } catch (error) {
        console.error('Error parsing middleware config:', error);
        configObj = {};
      }
    }

    return (
      <div className="py-2">
        <div className="flex items-center">
          <span className="font-medium">{middleware.name}</span>
          <span className="px-2 py-1 ml-2 text-xs rounded-full bg-blue-100 text-white-800">
            {middleware.type}
          </span>
          {isChain && (
            <span className="ml-2 text-gray-500 text-sm">
              (Middleware Chain)
            </span>
          )}
        </div>
        {/* Display chained middlewares for chain type */}
        {isChain && configObj.middlewares && configObj.middlewares.length > 0 && (
          <div className="ml-4 mt-1 border-l-2 border-gray-200 pl-3">
            <div className="text-sm text-gray-600 mb-1">Chain contains:</div>
            <ul className="space-y-1">
              {configObj.middlewares.map((id, index) => {
                const chainedMiddleware = middlewares.find((m) => m.id === id);
                return (
                  <li key={index} className="text-sm">
                    {index + 1}.{' '}
                    {chainedMiddleware ? (
                      <span className="font-medium">
                        {chainedMiddleware.name}{' '}
                        <span className="text-xs text-gray-500">
                          ({chainedMiddleware.type})
                        </span>
                      </span>
                    ) : (
                      <span>
                        {id}{' '}
                        <span className="text-xs text-gray-500">
                          (unknown middleware)
                        </span>
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    );
  }, [middlewares]);
  
  // Fetch middlewares on initial mount
  useEffect(() => {
    fetchMiddlewares();
  }, [fetchMiddlewares]);
  
  // Create context value object
  const value = {
    middlewares,
    selectedMiddleware,
    loading,
    error,
    fetchMiddlewares,
    fetchMiddleware,
    createMiddleware,
    updateMiddleware,
    deleteMiddleware,
    getConfigTemplate,
    formatMiddlewareDisplay,
    setError, // Expose setError for components to clear errors
  };
  
  return (
    <MiddlewareContext.Provider value={value}>
      {children}
    </MiddlewareContext.Provider>
  );
};

/**
 * Custom hook to use the middleware context
 * 
 * @returns {Object} Middleware context value
 */
export const useMiddlewares = () => {
  const context = useContext(MiddlewareContext);
  if (context === undefined) {
    throw new Error('useMiddlewares must be used within a MiddlewareProvider');
  }
  return context;
};