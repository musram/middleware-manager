// ui/src/contexts/PluginContext.js
import React, { createContext, useState, useContext, useCallback, useEffect } from 'react';
import { LoadingSpinner, ErrorMessage as GlobalErrorMessage } from '../components/common'; // Renamed to avoid conflict

const API_URL = '/api/plugins';

// Create the context
const PluginContext = createContext();

export const PluginProvider = ({ children }) => {
  const [plugins, setPlugins] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [traefikConfigPath, setTraefikConfigPath] = useState('');
  const [fetchingPath, setFetchingPath] = useState(true);

  const fetchPlugins = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(API_URL);
      if (!response.ok) {
        const errData = await response.json().catch(() => ({ message: `HTTP error ${response.status}` }));
        throw new Error(errData.message);
      }
      const data = await response.json();
      setPlugins(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to fetch plugins:', err);
      setError(`Failed to load plugins: ${err.message}`);
      setPlugins([]); // Ensure plugins is an array on error
    } finally {
      setLoading(false);
    }
  }, []);

  const installPlugin = useCallback(async (pluginData) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_URL}/install`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pluginData),
      });
      if (!response.ok) {
        const errData = await response.json().catch(() => ({ message: `HTTP error ${response.status}` }));
        throw new Error(errData.message);
      }
      const result = await response.json();
      // Optionally, refresh plugins or handle success (e.g., show a message)
      alert(result.message || 'Plugin installation initiated successfully!');
      return true;
    } catch (err) {
      console.error('Failed to install plugin:', err);
      setError(`Failed to install plugin: ${err.message}`);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchTraefikConfigPath = useCallback(async () => {
    setFetchingPath(true);
    setError(null);
    try {
      const response = await fetch(`${API_URL}/configpath`);
      if (!response.ok) {
        const errData = await response.json().catch(() => ({ message: `HTTP error ${response.status}` }));
        throw new Error(errData.message);
      }
      const data = await response.json();
      setTraefikConfigPath(data.path || '');
    } catch (err) {
      console.error('Failed to fetch Traefik config path:', err);
      setError(`Failed to load Traefik config path: ${err.message}`);
      setTraefikConfigPath('');
    } finally {
      setFetchingPath(false);
    }
  }, []);

  const updateTraefikConfigPath = useCallback(async (newPath) => {
    setLoading(true); // Use general loading for this action
    setError(null);
    try {
      const response = await fetch(`${API_URL}/configpath`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: newPath }),
      });
      if (!response.ok) {
        const errData = await response.json().catch(() => ({ message: `HTTP error ${response.status}` }));
        throw new Error(errData.message);
      }
      const data = await response.json();
      setTraefikConfigPath(data.path || ''); // Update local state with the path confirmed by backend
      alert(data.message || 'Traefik config path updated successfully!');
      return true;
    } catch (err) {
      console.error('Failed to update Traefik config path:', err);
      setError(`Failed to update Traefik config path: ${err.message}`);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);


  useEffect(() => {
    fetchPlugins();
    fetchTraefikConfigPath();
  }, [fetchPlugins, fetchTraefikConfigPath]);

  const value = {
    plugins,
    loading,
    error,
    fetchPlugins,
    installPlugin,
    traefikConfigPath,
    fetchingPath,
    fetchTraefikConfigPath,
    updateTraefikConfigPath,
    setError, // Expose setError
  };

  return (
    <PluginContext.Provider value={value}>
      {children}
    </PluginContext.Provider>
  );
};

export const usePlugins = () => {
  const context = useContext(PluginContext);
  if (context === undefined) {
    throw new Error('usePlugins must be used within a PluginProvider');
  }
  return context;
};