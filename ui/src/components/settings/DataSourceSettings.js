import React, { useState, useEffect } from 'react';
import { LoadingSpinner, ErrorMessage } from '../common';
import { useDataSource, useApp } from '../../contexts';

/**
 * DataSourceSettings component for managing API data sources
 * 
 * @param {Object} props
 * @param {function} props.onClose - Function to close settings panel
 * @returns {JSX.Element}
 */
const DataSourceSettings = ({ onClose }) => {
  // Get data source state from context
  const {
    dataSources,
    activeSource,
    loading,
    error,
    fetchDataSources,
    setActiveDataSource,
    updateDataSource,
    setError
  } = useDataSource();

  // Get app context to refresh the app state
  const { fetchActiveDataSource } = useApp();
  
  // State for UI
  const [saving, setSaving] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState({});
  
  // Form state for editing a data source
  const [editSource, setEditSource] = useState(null);
  const [sourceForm, setSourceForm] = useState({
    type: 'pangolin',
    url: '',
    basicAuth: {
      username: '',
      password: ''
    }
  });
  
  // Test connection handler with improved endpoints
  const testConnection = async (name, config) => {
    try {
      setConnectionStatus(prev => ({
        ...prev,
        [name]: { testing: true }
      }));
      
      // Modify the config to use the correct endpoints for testing
      const testConfig = {...config};
      
      // Use the endpoints we know work from the successful curl commands
      if (testConfig.type === 'pangolin') {
        // Use the working traefik-config endpoint instead of status
        testConfig.url = testConfig.url.replace(/\/+$/, ''); // Remove trailing slashes
        
        // Test request will be made to /api/datasource/{name}/test
        // We'll configure the backend test to use /traefik-config for testing Pangolin
      } else if (testConfig.type === 'traefik') {
        // Use the working /api/http/routers endpoint for Traefik
        testConfig.url = testConfig.url.replace(/\/+$/, ''); // Remove trailing slashes
        
        // Test request will use /api/http/routers for testing Traefik
      }
      
      // Make a POST request to test the connection
      const response = await fetch(`/api/datasource/${name}/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testConfig)
      });
      
      if (response.ok) {
        setConnectionStatus(prev => ({
          ...prev,
          [name]: { success: true, message: 'Connection successful!' }
        }));
      } else {
        const data = await response.json();
        setConnectionStatus(prev => ({
          ...prev,
          [name]: { 
            error: true, 
            message: `Connection failed: ${data.message || response.statusText}` 
          }
        }));
      }
    } catch (err) {
      setConnectionStatus(prev => ({
        ...prev,
        [name]: { 
          error: true, 
          message: `Connection test failed: ${err.message}` 
        }
      }));
    }
  };
  
  // Set active data source handler
  const handleSetActiveSource = async (sourceName) => {
    try {
      setSaving(true);
      
      const success = await setActiveDataSource(sourceName);
      
      if (success) {
        // Refresh the app state
        fetchActiveDataSource();
        
        // Show a success message
        alert(`Data source changed to ${sourceName}`);

        // Test connections again to update status
        testAllConnections();
      }
      
    } catch (err) {
      console.error('Error setting active data source:', err);
      setError(`Failed to set active data source: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };
  
  // Update a data source handler
  const handleUpdateDataSource = async (e) => {
    e.preventDefault();
    
    if (!editSource) return;
    
    try {
      setSaving(true);
      
      const success = await updateDataSource(editSource, sourceForm);
      
      if (success) {
        // Close the form
        setEditSource(null);
        
        // Show a success message
        alert(`Data source ${editSource} updated successfully`);
        
        // Refresh the list
        fetchDataSources();
        
        // Test this connection
        testConnection(editSource, sourceForm);
      }
      
    } catch (err) {
      console.error('Error updating data source:', err);
      setError(`Failed to update data source: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };
  
  // Edit a data source
  const handleEditSource = (name) => {
    const source = dataSources[name];
    setSourceForm({
      type: source.type || 'pangolin',
      url: source.url || '',
      basicAuth: {
        username: source.basic_auth?.username || '',
        password: '' // Don't populate password field for security
      }
    });
    setEditSource(name);
  };
  
  // Handle form input changes
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    
    if (name.startsWith('basicAuth.')) {
      // Handle nested basicAuth fields
      const field = name.split('.')[1];
      setSourceForm({
        ...sourceForm,
        basicAuth: {
          ...sourceForm.basicAuth,
          [field]: value
        }
      });
    } else {
      // Handle top-level fields
      setSourceForm({
        ...sourceForm,
        [name]: value
      });
    }
  };
  
  // Cancel editing
  const handleCancelEdit = () => {
    setEditSource(null);
    setSourceForm({
      type: 'pangolin',
      url: '',
      basicAuth: {
        username: '',
        password: ''
      }
    });
  };
  
  // Render the connection status for each data source
  const renderConnectionStatus = (name) => {
    const status = connectionStatus[name];
    
    if (!status) return null;
    
    if (status.testing) {
      return <div className="text-sm text-gray-500">Testing connection...</div>;
    }
    
    if (status.success) {
      return <div className="text-sm text-green-500">{status.message}</div>;
    }
    
    if (status.error) {
      return <div className="text-sm text-red-500">{status.message}</div>;
    }
    
    return null;
  };
  
  // Function to test all connections
  const testAllConnections = () => {
    Object.entries(dataSources).forEach(([name, source]) => {
      testConnection(name, source);
    });
  };
  
  // Test connections on mount
  useEffect(() => {
    if (Object.keys(dataSources).length > 0) {
      testAllConnections();
    }
  }, [dataSources]);
  
  // Test manual connection during editing
  const handleTestFormConnection = async () => {
    try {
      // Use the form data for the test
      const result = await fetch(`/api/datasource/${editSource}/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sourceForm)
      });
      
      if (result.ok) {
        alert('Connection test successful!');
      } else {
        const data = await result.json();
        alert(`Connection test failed: ${data.message || result.statusText}`);
      }
    } catch (err) {
      alert(`Connection test failed: ${err.message}`);
    }
  };
  
  if (loading && Object.keys(dataSources).length === 0) {
    return <LoadingSpinner message="Loading data source settings..." />;
  }
  
  return (
    <div className="bg-white p-4 md:p-6 rounded-lg shadow-lg overflow-y-auto max-h-[90vh]">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold">Data Source Settings</h2>
        <button
          onClick={onClose}
          className="text-gray-500 hover:text-gray-700"
        >
          ×
        </button>
      </div>
      
      {error && (
        <ErrorMessage 
          message={error} 
          onDismiss={() => setError(null)} 
        />
      )}
      
      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-3">Active Data Source</h3>
        <div className="flex items-center">
          <span className="font-medium mr-3">Current:</span>
          <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
            {activeSource}
          </span>
        </div>
        
        <div className="mt-4">
          <h4 className="font-medium mb-2">Change Active Source:</h4>
          <div className="flex flex-wrap gap-2">
            {Object.keys(dataSources).map(name => (
              <button
                key={name}
                onClick={() => handleSetActiveSource(name)}
                disabled={activeSource === name || saving}
                className={`px-4 py-2 rounded ${
                  activeSource === name
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-200 hover:bg-gray-300 text-gray-800'
                }`}
              >
                {name}
              </button>
            ))}
          </div>
        </div>
      </div>
      
      <div>
        <h3 className="text-lg font-semibold mb-3">Configured Sources</h3>
        
        {Object.keys(dataSources).length === 0 ? (
          <p className="text-gray-500">No data sources configured</p>
        ) : (
          <div className="space-y-4">
            {Object.entries(dataSources).map(([name, source]) => (
              <div key={name} className="border rounded p-4">
                <div className="flex flex-col sm:flex-row sm:justify-between">
                  <div>
                    <h4 className="font-medium">{name}</h4>
                    <p className="text-sm text-gray-600">Type: {source.type}</p>
                    <p className="text-sm text-gray-600">URL: {source.url}</p>
                    {source.basic_auth?.username && (
                      <p className="text-sm text-gray-600">
                        Basic Auth: {source.basic_auth.username}
                      </p>
                    )}
                    {renderConnectionStatus(name)}
                  </div>
                  <div className="mt-2 sm:mt-0">
                    <button
                      onClick={() => testConnection(name, source)}
                      className="mr-2 text-green-600 hover:text-green-800"
                      disabled={saving}
                    >
                      Test
                    </button>
                    <button
                      onClick={() => handleEditSource(name)}
                      className="text-blue-600 hover:text-blue-800"
                      disabled={editSource === name || saving}
                    >
                      Edit
                    </button>
                  </div>
                </div>
                
                {editSource === name && (
                  <form onSubmit={handleUpdateDataSource} className="mt-4 border-t pt-4">
                    <div className="mb-4">
                      <label className="block text-gray-700 text-sm font-bold mb-2">
                        Type
                      </label>
                      <select
                        name="type"
                        value={sourceForm.type}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                        disabled={saving}
                      >
                        <option value="pangolin">Pangolin API</option>
                        <option value="traefik">Traefik API</option>
                      </select>
                    </div>
                    <div className="mb-4">
                      <label className="block text-gray-700 text-sm font-bold mb-2">
                        URL
                      </label>
                      <input
                        type="text"
                        name="url"
                        value={sourceForm.url}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder={sourceForm.type === 'pangolin' 
                          ? 'http://pangolin:3001/api/v1' 
                          : 'http://traefik:8080'}
                        required
                        disabled={saving}
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        {sourceForm.type === 'pangolin' 
                          ? 'Pangolin API URL (e.g., http://pangolin:3001/api/v1)' 
                          : 'Traefik API URL (e.g., http://traefik:8080)'}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {sourceForm.type === 'traefik' && 
                          'Docker container access: Use http://traefik:8080 when both containers are on the same network'}
                      </p>
                    </div>
                    <div className="mb-4">
                      <label className="block text-gray-700 text-sm font-bold mb-2">
                        Basic Auth Username (optional)
                      </label>
                      <input
                        type="text"
                        name="basicAuth.username"
                        value={sourceForm.basicAuth.username}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Username"
                        disabled={saving}
                      />
                    </div>
                    <div className="mb-4">
                      <label className="block text-gray-700 text-sm font-bold mb-2">
                        Basic Auth Password (optional)
                      </label>
                      <input
                        type="password"
                        name="basicAuth.password"
                        value={sourceForm.basicAuth.password}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Password"
                        disabled={saving}
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Leave empty to keep the existing password
                      </p>
                    </div>
                    <div className="flex flex-col sm:flex-row justify-end space-y-2 sm:space-y-0 sm:space-x-3">
                      <button
                        type="button"
                        onClick={handleCancelEdit}
                        className="w-full sm:w-auto px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
                        disabled={saving}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleTestFormConnection}
                        className="w-full sm:w-auto px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                        disabled={saving || !sourceForm.url}
                      >
                        Test Connection
                      </button>
                      <button
                        type="submit"
                        className="w-full sm:w-auto px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                        disabled={saving}
                      >
                        {saving ? 'Saving...' : 'Save Changes'}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-6 p-4 bg-blue-50 border-l-4 border-blue-400 text-blue-700">
        <h4 className="font-semibold mb-1">Troubleshooting Connection Issues</h4>
        <ul className="list-disc ml-5 text-sm">
          <li>For Docker containers, use <code className="bg-blue-100 px-1 rounded">http://traefik:8080</code> instead of localhost</li>
          <li>For Pangolin, use <code className="bg-blue-100 px-1 rounded">http://pangolin:3001/api/v1</code></li>
          <li>Ensure container names match those in your docker-compose file</li>
          <li>Check if Traefik API is enabled with <code className="bg-blue-100 px-1 rounded">--api.insecure=true</code> flag</li>
          <li>Verify that both containers are on the same Docker network</li>
          <li>From command line, testing with curl commands can help identify issues</li>
        </ul>
      </div>
    </div>
  );
};

export default DataSourceSettings;