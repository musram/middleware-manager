// ui/src/components/settings/DataSourceSettings.js
import React, { useState, useEffect, useCallback } from 'react'; // Added useCallback import
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
  const { fetchActiveDataSource } = useApp();

  const [saving, setSaving] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState({});
  const [editSource, setEditSource] = useState(null); // Name of the source being edited
  const [sourceForm, setSourceForm] = useState({
    type: 'pangolin',
    url: '',
    basicAuth: { username: '', password: '' }
  });

  // Define testConnection using useCallback
   const testConnection = useCallback(async (name, config) => {
     setConnectionStatus(prev => ({ ...prev, [name]: { testing: true } }));
     try {
         const testConfig = { ...config, url: config.url?.replace(/\/+$/, '') };
         const response = await fetch(`/api/datasource/${name}/test`, {
             method: 'POST',
             headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify(testConfig)
         });
         if (response.ok) {
             setConnectionStatus(prev => ({ ...prev, [name]: { success: true, message: 'Connection successful!' } }));
         } else {
             const data = await response.json();
             setConnectionStatus(prev => ({ ...prev, [name]: { error: true, message: `Connection failed: ${data.message || response.statusText}` } }));
         }
     } catch (err) {
         setConnectionStatus(prev => ({ ...prev, [name]: { error: true, message: `Test request failed: ${err.message}` } }));
     }
   }, []); // Empty dependency array as it doesn't depend on component state/props directly


  const handleSetActiveSource = async (sourceName) => {
    setSaving(true);
    setError(null);
    const success = await setActiveDataSource(sourceName);
    if (success) {
      await fetchActiveDataSource();
      await fetchDataSources();
      testAllConnections();
    }
    setSaving(false);
  };

  const handleUpdateDataSource = async (e) => {
    e.preventDefault();
    if (!editSource) return;
    setSaving(true);
    setError(null);

    const dataToUpdate = { ...sourceForm };
    if (dataToUpdate.basicAuth.password === '••••••••') {
       delete dataToUpdate.basicAuth.password;
    }

    const success = await updateDataSource(editSource, dataToUpdate);
    if (success) {
      setEditSource(null);
      await fetchDataSources();
      testConnection(editSource, sourceForm);
    }
    setSaving(false);
  };

  const handleEditSource = (name) => {
    const source = dataSources[name];
    setSourceForm({
      type: source.type || 'pangolin',
      url: source.url || '',
      basicAuth: {
        username: source.basic_auth?.username || '',
        password: source.basic_auth?.username ? '••••••••' : ''
      }
    });
    setEditSource(name);
    setError(null);
  };

   const handleInputChange = (e) => {
        const { name, value } = e.target;
        setSourceForm(prev => {
            const newState = { ...prev };
            if (name.startsWith('basicAuth.')) {
                const field = name.split('.')[1];
                newState.basicAuth = { ...newState.basicAuth, [field]: value };
                 if (field === 'password' && value === '••••••••') {
                     return prev; // Ignore placeholder typing
                 }
            } else {
                newState[name] = value;
            }
            return newState;
        });
    };

  const handleCancelEdit = () => {
    setEditSource(null);
    setError(null);
  };

  const renderConnectionStatus = (name) => {
    const status = connectionStatus[name];
    if (!status) return <span className="text-xs text-gray-400 dark:text-gray-500 italic ml-2">Untested</span>;
    if (status.testing) return <span className="text-xs text-gray-400 dark:text-gray-500 italic ml-2">Testing...</span>;
    if (status.success) return <span className="text-xs text-green-600 dark:text-green-400 ml-2">✓ Success</span>;
    if (status.error) return <span className="text-xs text-red-600 dark:text-red-400 ml-2" title={status.message}>✗ Failed</span>;
    return null;
  };

  // Define testAllConnections using useCallback
   const testAllConnections = useCallback(() => {
     Object.entries(dataSources).forEach(([name, source]) => {
       testConnection(name, source);
     });
   }, [dataSources, testConnection]); // Add testConnection to dependencies

  useEffect(() => {
    if (Object.keys(dataSources).length > 0) {
      testAllConnections();
    }
  }, [dataSources, testAllConnections]); // Add testAllConnections dependency


  const handleTestFormConnection = async () => {
    if (!editSource) return;
    testConnection(editSource, sourceForm); // Use the main testConnection function
  };


  if (loading && Object.keys(dataSources).length === 0) {
    return <LoadingSpinner message="Loading settings..." />;
  }

  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg w-full h-full overflow-y-auto">
        <div className="flex justify-between items-center mb-6 border-b pb-4 dark:border-gray-700">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Data Source Settings</h2>
            <button onClick={onClose} className="modal-close-button" aria-label="Close Settings">&times;</button>
        </div>

        {error && (
            <ErrorMessage message={error} onDismiss={() => setError(null)} />
        )}

        {/* Active Source Section */}
        <div className="mb-8 p-4 bg-gray-50 dark:bg-gray-700 rounded-md border dark:border-gray-600">
            <h3 className="text-lg font-semibold mb-3 text-gray-800 dark:text-gray-200">Active Data Source</h3>
            <div className="flex items-center mb-3">
                <span className="font-medium mr-2 text-gray-700 dark:text-gray-300">Current:</span>
                <span className="badge badge-info bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 capitalize">
                    {activeSource || 'None'}
                </span>
            </div>
            <div>
                <h4 className="text-sm font-medium mb-2 text-gray-600 dark:text-gray-400">Switch Active Source:</h4>
                <div className="flex flex-wrap gap-2">
                    {Object.keys(dataSources).map(name => (
                        <button
                            key={name}
                            onClick={() => handleSetActiveSource(name)}
                            disabled={activeSource === name || saving}
                            className={`btn text-sm ${activeSource === name ? 'btn-primary cursor-default' : 'btn-secondary'}`}
                        >
                            {name}
                        </button>
                    ))}
                </div>
            </div>
        </div>

        {/* Configured Sources List/Edit Section */}
        <div>
            <h3 className="text-lg font-semibold mb-4 text-gray-800 dark:text-gray-200">Configured Sources</h3>
            {Object.keys(dataSources).length === 0 ? (
                <p className="text-gray-500 dark:text-gray-400">No data sources found. Check configuration.</p>
            ) : (
                <div className="space-y-4">
                    {Object.entries(dataSources).map(([name, source]) => (
                        <div key={name} className="border dark:border-gray-600 rounded p-4 transition-shadow hover:shadow-md dark:hover:shadow-gray-700/50">
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-3">
                                <div className="mb-2 sm:mb-0">
                                    <h4 className="font-semibold text-gray-900 dark:text-gray-100 flex items-center">
                                        {name} {renderConnectionStatus(name)}
                                    </h4>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">Type: {source.type} | URL: {source.url}</p>
                                    {source.basic_auth?.username && (
                                        <p className="text-xs text-gray-500 dark:text-gray-400">Auth User: {source.basic_auth.username}</p>
                                    )}
                                </div>
                                <div className="flex-shrink-0 flex space-x-2">
                                     <button onClick={() => testConnection(name, source)} className="btn btn-secondary text-xs bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 hover:bg-green-200 dark:hover:bg-green-800 border-green-200 dark:border-green-700" disabled={saving}>Test</button>
                                    <button onClick={() => handleEditSource(name)} className="btn btn-secondary text-xs" disabled={editSource === name || saving}>Edit</button>
                                </div>
                            </div>

                            {/* Edit Form */}
                            {editSource === name && (
                                <form onSubmit={handleUpdateDataSource} className="mt-4 border-t dark:border-gray-700 pt-4 space-y-4">
                                    <div>
                                        <label className="form-label text-xs">Type</label>
                                        <select name="type" value={sourceForm.type} onChange={handleInputChange} className="form-input text-sm" disabled={saving}>
                                            <option value="pangolin">Pangolin API</option>
                                            <option value="traefik">Traefik API</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="form-label text-xs">URL</label>
                                        <input type="url" name="url" value={sourceForm.url} onChange={handleInputChange} className="form-input text-sm" placeholder={sourceForm.type === 'pangolin' ? 'http://pangolin:3001/api/v1' : 'http://traefik:8080'} required disabled={saving} />
                                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Include scheme (http/https). For Docker, use container names (e.g., http://traefik:8080).</p>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div>
                                            <label className="form-label text-xs">Basic Auth Username <span className="italic">(optional)</span></label>
                                            <input type="text" name="basicAuth.username" value={sourceForm.basicAuth.username} onChange={handleInputChange} className="form-input text-sm" placeholder="Username" disabled={saving} />
                                        </div>
                                        <div>
                                            <label className="form-label text-xs">Basic Auth Password <span className="italic">(optional)</span></label>
                                            <input type="password" name="basicAuth.password" value={sourceForm.basicAuth.password} onChange={handleInputChange} className="form-input text-sm" placeholder="Leave unchanged or enter new" disabled={saving} />
                                        </div>
                                    </div>
                                    <div className="flex flex-col sm:flex-row justify-end space-y-2 sm:space-y-0 sm:space-x-3">
                                        <button type="button" onClick={handleCancelEdit} className="btn btn-secondary text-sm" disabled={saving}>Cancel</button>
                                        <button type="button" onClick={handleTestFormConnection} className="btn btn-secondary text-sm bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 hover:bg-green-200 dark:hover:bg-green-800 border-green-200 dark:border-green-700" disabled={saving || !sourceForm.url}>Test Current Values</button>
                                        <button type="submit" className="btn btn-primary text-sm" disabled={saving}>
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

         {/* Troubleshooting Info */}
         <div className="mt-8 p-4 bg-blue-50 dark:bg-blue-900 border-l-4 border-blue-400 dark:border-blue-600 text-blue-700 dark:text-blue-200 text-xs">
             <h4 className="font-semibold mb-1">Troubleshooting Tips</h4>
             <ul className="list-disc ml-4 space-y-1">
                 <li>Ensure API URLs are correct (e.g., <code className="text-xs font-mono bg-blue-100 dark:bg-blue-800 px-1 rounded">http://traefik:8080</code>, <code className="text-xs font-mono bg-blue-100 dark:bg-blue-800 px-1 rounded">http://pangolin:3001/api/v1</code>).</li>
                 <li>Verify container names and network connectivity in Docker.</li>
                 <li>Check if the Traefik API is enabled (<code className="text-xs font-mono bg-blue-100 dark:bg-blue-800 px-1 rounded">--api.insecure=true</code>).</li>
                 <li>Confirm Basic Auth credentials if used.</li>
             </ul>
         </div>
    </div>
  );
};

export default DataSourceSettings;