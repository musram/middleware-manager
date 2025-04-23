import React, { useEffect, useState } from 'react';
import { useResources } from '../../contexts/ResourceContext';
import { useMiddlewares } from '../../contexts/MiddlewareContext';
import { LoadingSpinner, ErrorMessage } from '../common';
import HTTPConfigModal from './config/HTTPConfigModal';
import TLSConfigModal from './config/TLSConfigModal';
import TCPConfigModal from './config/TCPConfigModal';
import HeadersConfigModal from './config/HeadersConfigModal';
import { MiddlewareUtils } from '../../services/api';

const ResourceDetail = ({ id, navigateTo }) => {
  const {
    selectedResource,
    loading: resourceLoading,
    error: resourceError,
    fetchResource,
    assignMiddleware,
    assignMultipleMiddlewares,
    removeMiddleware,
    updateResourceConfig,
    deleteResource
  } = useResources();
  
  const {
    middlewares,
    loading: middlewaresLoading,
    error: middlewaresError,
    fetchMiddlewares,
    formatMiddlewareDisplay
  } = useMiddlewares();
  
  // UI state
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState(null);
  const [selectedMiddlewares, setSelectedMiddlewares] = useState([]);
  const [priority, setPriority] = useState(100);
  const [routerPriority, setRouterPriority] = useState(100);
  
  // Configuration states
  const [entrypoints, setEntrypoints] = useState('');
  const [tlsDomains, setTLSDomains] = useState('');
  const [tcpEnabled, setTCPEnabled] = useState(false);
  const [tcpEntrypoints, setTCPEntrypoints] = useState('');
  const [tcpSNIRule, setTCPSNIRule] = useState('');
  const [customHeaders, setCustomHeaders] = useState({});
  const [headerKey, setHeaderKey] = useState('');
  const [headerValue, setHeaderValue] = useState('');
  
  // Load resource and middlewares data
  useEffect(() => {
    fetchResource(id);
    fetchMiddlewares();
  }, [id, fetchResource, fetchMiddlewares]);
  
  // Update local state when resource data is loaded
 // Update local state when resource data is loaded
 useEffect(() => {
  if (selectedResource) {
    setEntrypoints(selectedResource.entrypoints || 'websecure');
    setTLSDomains(selectedResource.tls_domains || '');
    setTCPEnabled(selectedResource.tcp_enabled === true);
    setTCPEntrypoints(selectedResource.tcp_entrypoints || 'tcp');
    setTCPSNIRule(selectedResource.tcp_sni_rule || '');
    setRouterPriority(selectedResource.router_priority || 100);
    
    // Parse custom headers
    if (selectedResource.custom_headers) {
      try {
        // Handle both string and object formats
        const headers = typeof selectedResource.custom_headers === 'string' 
          ? JSON.parse(selectedResource.custom_headers) 
          : selectedResource.custom_headers;
        
        setCustomHeaders(headers || {});
      } catch (e) {
        console.error("Error parsing custom headers:", e);
        setCustomHeaders({});
      }
    } else {
      setCustomHeaders({});
    }
    
    console.log("Updated resource configuration state:", {
      entrypoints: selectedResource.entrypoints,
      tlsDomains: selectedResource.tls_domains,
      tcpEnabled: selectedResource.tcp_enabled,
      tcpEntrypoints: selectedResource.tcp_entrypoints,
      tcpSNIRule: selectedResource.tcp_sni_rule,
      customHeaders: selectedResource.custom_headers,
      routerPriority: selectedResource.router_priority
    });
  }
}, [selectedResource]);
  
  // Handle loading state
  const loading = resourceLoading || middlewaresLoading;
  if (loading && !selectedResource) {
    return <LoadingSpinner message="Loading resource details..." />;
  }
  
  // Handle error state
  const error = resourceError || middlewaresError;
  if (error) {
    return (
      <ErrorMessage 
        message="Failed to load resource details" 
        details={error}
        onRetry={() => {
          fetchResource(id);
          fetchMiddlewares();
        }}
      />
    );
  }
  
  if (!selectedResource) {
    return (
      <ErrorMessage 
        message="Resource not found" 
        onRetry={() => navigateTo('resources')}
      />
    );
  }
  
  // Calculate list of assigned middlewares
  const assignedMiddlewares = MiddlewareUtils.parseMiddlewares(selectedResource.middlewares);
  
  // Filter to get available middlewares (not already assigned)
  const assignedIds = assignedMiddlewares.map(m => m.id);
  const availableMiddlewares = middlewares.filter(m => !assignedIds.includes(m.id));
  
  // Determine if resource is disabled
  const isDisabled = selectedResource.status === 'disabled';
  
  // Open configuration modal
  const openConfigModal = (type) => {
    setModalType(type);
    setShowModal(true);
  };
  
  // Handle middleware selection
  const handleMiddlewareSelection = (e) => {
    const options = e.target.options;
    const selected = Array.from(options)
      .filter((option) => option.selected)
      .map((option) => option.value);
    setSelectedMiddlewares(selected);
  };
  
  // Handle assigning multiple middlewares
  const handleAssignMiddleware = async (e) => {
    e.preventDefault();
    if (selectedMiddlewares.length === 0) {
      alert('Please select at least one middleware');
      return;
    }

    const middlewaresToAdd = selectedMiddlewares.map(middlewareId => ({
      middleware_id: middlewareId,
      priority: parseInt(priority, 10)
    }));

    await assignMultipleMiddlewares(id, middlewaresToAdd);
    setShowModal(false);
    setSelectedMiddlewares([]);
    setPriority(100);
  };
  
  // Handle middleware removal
  const handleRemoveMiddleware = async (middlewareId) => {
    if (!window.confirm('Are you sure you want to remove this middleware?'))
      return;
    
    await removeMiddleware(id, middlewareId);
  };
  
  // Handle router priority update
  const handleUpdateRouterPriority = async () => {
    await updateResourceConfig(id, 'priority', { router_priority: routerPriority });
  };
  
  // Handle resource deletion
  const handleDeleteResource = async () => {
    if (window.confirm(`Are you sure you want to delete the resource "${selectedResource.host}"? This cannot be undone.`)) {
      const success = await deleteResource(id);
      if (success) {
        navigateTo('resources');
      }
    }
  };
  
  // Add a custom header
  const addHeader = () => {
    if (!headerKey.trim()) {
      alert('Header key cannot be empty');
      return;
    }
    
    setCustomHeaders({
      ...customHeaders,
      [headerKey]: headerValue
    });
    
    setHeaderKey('');
    setHeaderValue('');
  };
  
  // Remove a custom header
  const removeHeader = (key) => {
    const newHeaders = {...customHeaders};
    delete newHeaders[key];
    setCustomHeaders(newHeaders);
  };
  
  // Render the appropriate config modal based on type
  const renderModal = () => {
    if (!showModal) return null;
    
    switch (modalType) {
      case 'http':
        return (
          <HTTPConfigModal 
            entrypoints={entrypoints} 
            setEntrypoints={setEntrypoints} 
            onSave={() => updateResourceConfig(id, 'http', { entrypoints })}
            onClose={() => setShowModal(false)}
          />
        );
      case 'tls':
        return (
          <TLSConfigModal 
            tlsDomains={tlsDomains} 
            setTLSDomains={setTLSDomains} 
            onSave={() => updateResourceConfig(id, 'tls', { tls_domains: tlsDomains })}
            onClose={() => setShowModal(false)}
          />
        );
      case 'tcp':
        return (
          <TCPConfigModal 
            tcpEnabled={tcpEnabled}
            setTCPEnabled={setTCPEnabled}
            tcpEntrypoints={tcpEntrypoints}
            setTCPEntrypoints={setTCPEntrypoints}
            tcpSNIRule={tcpSNIRule}
            setTCPSNIRule={setTCPSNIRule}
            resourceHost={selectedResource.host}
            onSave={() => updateResourceConfig(id, 'tcp', {
              tcp_enabled: tcpEnabled,
              tcp_entrypoints: tcpEntrypoints,
              tcp_sni_rule: tcpSNIRule
            })}
            onClose={() => setShowModal(false)}
          />
        );
      case 'headers':
        return (
          <HeadersConfigModal 
            customHeaders={customHeaders}
            setCustomHeaders={setCustomHeaders}
            headerKey={headerKey}
            setHeaderKey={setHeaderKey}
            headerValue={headerValue}
            setHeaderValue={setHeaderValue}
            addHeader={addHeader}
            removeHeader={removeHeader}
            onSave={() => updateResourceConfig(id, 'headers', { custom_headers: customHeaders })}
            onClose={() => setShowModal(false)}
          />
        );
      case 'middlewares':
        return (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-lg w-full max-w-md">
              <div className="flex justify-between items-center px-6 py-4 border-b">
                <h3 className="text-lg font-semibold">
                  Add Middlewares to {selectedResource.host}
                </h3>
                <button
                  onClick={() => setShowModal(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  ×
                </button>
              </div>
              <div className="px-6 py-4">
                {availableMiddlewares.length === 0 ? (
                  <div className="text-center py-4 text-gray-500">
                    <p>All middlewares have been assigned to this resource.</p>
                    <button
                      onClick={() => navigateTo('middleware-form')}
                      className="mt-2 inline-block px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                    >
                      Create New Middleware
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleAssignMiddleware}>
                    <div className="mb-4">
                      <label className="block text-gray-700 text-sm font-bold mb-2">
                        Select Middlewares
                      </label>
                      <select
                        multiple
                        value={selectedMiddlewares}
                        onChange={handleMiddlewareSelection}
                        className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                        size={5}
                      >
                        {availableMiddlewares.map((middleware) => (
                          <option key={middleware.id} value={middleware.id}>
                            {middleware.name} ({middleware.type})
                          </option>
                        ))}
                      </select>
                      <p className="text-xs text-gray-500 mt-1">
                        Hold Ctrl (or Cmd) to select multiple middlewares. All selected middlewares will be assigned with the same priority.
                      </p>
                    </div>
                    <div className="mb-4">
                      <label className="block text-gray-700 text-sm font-bold mb-2">
                        Priority
                      </label>
                      <input
                        type="number"
                        value={priority}
                        onChange={(e) => setPriority(e.target.value)}
                        className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                        min="1"
                        max="1000"
                        required
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Higher priority middlewares are applied first (1-1000)
                      </p>
                    </div>
                    <div className="flex justify-end space-x-3">
                      <button
                        type="button"
                        onClick={() => setShowModal(false)}
                        className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                        disabled={selectedMiddlewares.length === 0}
                      >
                        Add Middlewares
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          </div>
        );
      default:
        return null;
    }
  };
  
  return (
    <div>
      <div className="mb-6 flex items-center">
        <button
          onClick={() => navigateTo('resources')}
          className="mr-4 px-3 py-1 bg-gray-200 rounded hover:bg-gray-300"
        >
          Back
        </button>
        <h1 className="text-2xl font-bold">Resource: {selectedResource.host}</h1>
        {isDisabled && (
          <span className="ml-3 px-2 py-1 text-sm rounded-full bg-red-100 text-red-800">
            Removed from Pangolin
          </span>
        )}
      </div>
  
      {/* Disabled Resource Warning */}
      {isDisabled && (
        <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-6">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg
                className="h-5 w-5 text-red-400"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-700">
                This resource has been removed from Pangolin and is now disabled. Any changes to middleware will not take effect.
              </p>
              <div className="mt-2 flex space-x-4">
                <button
                  onClick={() => navigateTo('resources')}
                  className="text-sm text-red-700 underline"
                >
                  Return to resources list
                </button>
                <button
                  onClick={handleDeleteResource}
                  className="text-sm text-red-700 underline"
                >
                  Delete this resource
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
  
      {/* Resource Details */}
      <div className="bg-white p-6 rounded-lg shadow mb-6">
        <h2 className="text-xl font-semibold mb-4">Resource Details</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-gray-500">Host</p>
            <p className="font-medium flex items-center">
              {selectedResource.host}
              <a
                href={`https://${selectedResource.host}`}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-2 text-sm text-blue-600 hover:underline"
              >
                Visit
              </a>
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Service ID</p>
            <p className="font-medium">{selectedResource.service_id}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Status</p>
            <p>
              <span
                className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                  isDisabled
                    ? 'bg-red-100 text-red-800'
                    : assignedMiddlewares.length > 0
                    ? 'bg-green-100 text-green-800'
                    : 'bg-yellow-100 text-yellow-800'
                }`}
              >
                {isDisabled
                  ? 'Disabled'
                  : assignedMiddlewares.length > 0
                  ? 'Protected'
                  : 'Not Protected'}
              </span>
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Resource ID</p>
            <p className="font-medium">{selectedResource.id}</p>
          </div>
        </div>
      </div>
  
      {/* Router Configuration Section */}
      <div className="bg-white p-6 rounded-lg shadow mb-6">
        <h2 className="text-xl font-semibold mb-4">Router Configuration</h2>
        <div className="flex flex-wrap gap-4">
          <button
            onClick={() => openConfigModal('http')}
            disabled={isDisabled}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            HTTP Router Configuration
          </button>
          <button
            onClick={() => openConfigModal('tls')}
            disabled={isDisabled}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            TLS Certificate Domains
          </button>
          <button
            onClick={() => openConfigModal('tcp')}
            disabled={isDisabled}
            className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            TCP SNI Routing
          </button>
          <button
            onClick={() => openConfigModal('headers')}
            disabled={isDisabled}
            className="px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Custom Headers
          </button>
        </div>
  
        {/* Current Configuration Summary */}
        <div className="mt-4 p-4 bg-gray-50 rounded border">
          <h3 className="font-medium mb-2">Current Configuration</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-500">HTTP Entrypoints</p>
              <p className="font-medium">{entrypoints || 'websecure'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">TLS Certificate Domains</p>
              <p className="font-medium">{tlsDomains || 'None'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">TCP SNI Routing</p>
              <p className="font-medium">{tcpEnabled ? 'Enabled' : 'Disabled'}</p>
            </div>
            {tcpEnabled && (
              <>
                <div>
                  <p className="text-sm text-gray-500">TCP Entrypoints</p>
                  <p className="font-medium">{tcpEntrypoints || 'tcp'}</p>
                </div>
                {tcpSNIRule && (
                  <div className="col-span-2">
                    <p className="text-sm text-gray-500">TCP SNI Rule</p>
                    <p className="font-medium font-mono text-sm break-all">{tcpSNIRule}</p>
                  </div>
                )}
              </>
            )}
            {/* Custom Headers summary */}
            {Object.keys(customHeaders).length > 0 && (
              <div>
                <p className="text-sm text-gray-500">Custom Headers</p>
                <div className="font-medium">
                  {Object.entries(customHeaders).map(([key, value]) => (
                    <div key={key} className="text-sm">
                      <span className="font-mono">{key}</span>: <span className="font-mono">{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Router Priority Configuration */}
      <div className="bg-white p-6 rounded-lg shadow mb-6">
        <h2 className="text-xl font-semibold mb-4">Router Priority</h2>
        <div className="mb-4">
          <p className="text-gray-700">
            Set the priority of this router. When multiple routers match the same request, 
            the router with the highest priority (highest number) will be selected first.
          </p>
          <p className="text-sm text-gray-500 mt-2">
            Note: This is different from middleware priority, which controls the order middlewares 
            are applied within a router.
          </p>
        </div>
        
        <div className="flex items-center">
          <input
            type="number"
            value={routerPriority}
            onChange={(e) => setRouterPriority(parseInt(e.target.value) || 100)}
            className="w-24 px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            min="1"
            max="1000"
            disabled={isDisabled}
          />
          <button
            onClick={handleUpdateRouterPriority}
            className="ml-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={isDisabled}
          >
            Update Priority
          </button>
        </div>
      </div>
  
      {/* Middlewares Section */}
      <div className="bg-white p-6 rounded-lg shadow">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Attached Middlewares</h2>
          <button
            onClick={() => openConfigModal('middlewares')}
            disabled={isDisabled || availableMiddlewares.length === 0}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Add Middleware
          </button>
        </div>
        {assignedMiddlewares.length === 0 ? (
          <div className="text-center py-6 text-gray-500">
            <p>This resource does not have any middlewares applied to it.</p>
            <p>Add a middleware to enhance security or modify behavior.</p>
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Middleware
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Priority
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {assignedMiddlewares.map((middleware) => {
                const middlewareDetails = middlewares.find((m) => m.id === middleware.id) || {
                  id: middleware.id,
                  name: middleware.name,
                  type: 'unknown',
                };
  
                return (
                  <tr key={middleware.id}>
                    <td className="px-6 py-4">
                      {middlewareDetails && middlewares.length > 0
                        ? formatMiddlewareDisplay(middlewareDetails)
                        : middleware.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {middleware.priority}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <button
                        onClick={() => handleRemoveMiddleware(middleware.id)}
                        className="text-red-600 hover:text-red-900"
                        disabled={isDisabled}
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
  
      {/* Render active modal */}
      {renderModal()}
    </div>
  );
};

export default ResourceDetail;