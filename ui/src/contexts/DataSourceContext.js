import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';

// Create the context
const DataSourceContext = createContext();

/**
 * DataSource provider component
 * Manages data source state and API interactions
 * 
 * @param {Object} props
 * @param {ReactNode} props.children - Child components
 * @returns {JSX.Element}
 */
export const DataSourceProvider = ({ children }) => {
  const [dataSources, setDataSources] = useState({});
  const [activeSource, setActiveSource] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  /**
   * Fetch all data sources
   */
  const fetchDataSources = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/datasource');
      
      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`);
      }
      
      const data = await response.json();
      setDataSources(data.sources || {});
      setActiveSource(data.active_source || '');
      
    } catch (err) {
      setError('Failed to load data sources');
      console.error('Error fetching data sources:', err);
    } finally {
      setLoading(false);
    }
  }, []);
  
  /**
   * Fetch active data source
   */
  const fetchActiveDataSource = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/datasource/active');
      
      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`);
      }
      
      const data = await response.json();
      setActiveSource(data.name || '');
      
    } catch (err) {
      setError('Failed to load active data source');
      console.error('Error fetching active data source:', err);
    } finally {
      setLoading(false);
    }
  }, []);
  
  /**
   * Set the active data source
   * 
   * @param {string} name - Data source name
   * @returns {Promise<boolean>} Success status
   */
  const setActiveDataSource = useCallback(async (name) => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/datasource/active', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`);
      }
      
      // Update local state
      setActiveSource(name);
      
      return true;
    } catch (err) {
      setError(`Failed to set active data source: ${err.message}`);
      console.error('Error setting active data source:', err);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);
  
  /**
   * Update a data source configuration
   * 
   * @param {string} name - Data source name
   * @param {Object} config - Data source configuration
   * @returns {Promise<boolean>} Success status
   */
  const updateDataSource = useCallback(async (name, config) => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(`/api/datasource/${name}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`);
      }
      
      // Update local data sources list
      await fetchDataSources();
      
      return true;
    } catch (err) {
      setError(`Failed to update data source: ${err.message}`);
      console.error('Error updating data source:', err);
      return false;
    } finally {
      setLoading(false);
    }
  }, [fetchDataSources]);
  
  // Fetch data sources on initial mount
  useEffect(() => {
    fetchDataSources();
  }, [fetchDataSources]);
  
  // Create context value object
  const value = {
    dataSources,
    activeSource,
    loading,
    error,
    fetchDataSources,
    fetchActiveDataSource,
    setActiveDataSource,
    updateDataSource,
    setError, // Expose setError for components to clear errors
  };
  
  return (
    <DataSourceContext.Provider value={value}>
      {children}
    </DataSourceContext.Provider>
  );
};

/**
 * Custom hook to use the data source context
 * 
 * @returns {Object} Data source context value
 */
export const useDataSource = () => {
  const context = useContext(DataSourceContext);
  if (context === undefined) {
    throw new Error('useDataSource must be used within a DataSourceProvider');
  }
  return context;
};