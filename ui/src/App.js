import React, { useState, useEffect } from 'react';

// --- API Service ---
const API_URL = '/api';

const api = {
  // Resources
  getResources: () => fetch(`${API_URL}/resources`).then(res => res.json()),
  getResource: (id) => fetch(`${API_URL}/resources/${id}`).then(res => res.json()),
  deleteResource: (id) => fetch(`${API_URL}/resources/${id}`, {
    method: 'DELETE'
  }).then(res => res.json()),
  assignMiddleware: (resourceId, data) => fetch(`${API_URL}/resources/${resourceId}/middlewares`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  }).then(res => res.json()),
  assignMultipleMiddlewares: (resourceId, data) => fetch(`${API_URL}/resources/${resourceId}/middlewares/bulk`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  }).then(res => res.json()),
  removeMiddleware: (resourceId, middlewareId) => fetch(`${API_URL}/resources/${resourceId}/middlewares/${middlewareId}`, {
    method: 'DELETE'
  }).then(res => res.json()),

  // Middlewares
  getMiddlewares: () => fetch(`${API_URL}/middlewares`).then(res => res.json()),
  getMiddleware: (id) => fetch(`${API_URL}/middlewares/${id}`).then(res => res.json()),
  createMiddleware: (data) => fetch(`${API_URL}/middlewares`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  }).then(res => res.json()),
  updateMiddleware: (id, data) => fetch(`${API_URL}/middlewares/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  }).then(res => res.json()),
  deleteMiddleware: (id) => fetch(`${API_URL}/middlewares/${id}`, {
    method: 'DELETE'
  }).then(res => res.json())
};

// --- Helper Functions ---
const parseMiddlewares = (middlewaresStr) => {
  if (!middlewaresStr) return [];
  
  return middlewaresStr.split(',')
    .filter(Boolean)
    .map(item => {
      const [id, name, priority] = item.split(':');
      return { id, name, priority: parseInt(priority) || 100 };
    });
};

// Helper function to format middleware chains for display
const formatMiddlewareDisplay = (middleware, allMiddlewares) => {
  // Check if this is a chain middleware
  const isChain = middleware.type === 'chain';
  
  // Get the config object
  let configObj = middleware.config;
  if (typeof configObj === 'string') {
    try {
      configObj = JSON.parse(configObj);
    } catch (e) {
      console.error('Error parsing middleware config:', e);
      configObj = {};
    }
  }
  
  return (
    <div className="py-2">
      <div className="flex items-center">
        <span className="font-medium">{middleware.name}</span>
        <span className="px-2 py-1 ml-2 text-xs rounded-full bg-blue-100 text-blue-800">
          {middleware.type}
        </span>
        {isChain && <span className="ml-2 text-gray-500 text-sm">(Middleware Chain)</span>}
      </div>
      
      {/* Display chained middlewares if this is a chain */}
      {isChain && configObj.middlewares && configObj.middlewares.length > 0 && (
        <div className="ml-4 mt-1 border-l-2 border-gray-200 pl-3">
          <div className="text-sm text-gray-600 mb-1">Chain contains:</div>
          <ul className="space-y-1">
            {configObj.middlewares.map((id, index) => {
              const chainedMiddleware = allMiddlewares.find(m => m.id === id);
              return (
                <li key={index} className="text-sm">
                  {index + 1}. {chainedMiddleware 
                    ? <span className="font-medium">{chainedMiddleware.name} <span className="text-xs text-gray-500">({chainedMiddleware.type})</span></span> 
                    : <span>{id} <span className="text-xs text-gray-500">(unknown middleware)</span></span>}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
};

// Main App Component
const App = () => {
  const [page, setPage] = useState('dashboard');
  const [resourceId, setResourceId] = useState(null);
  const [middlewareId, setMiddlewareId] = useState(null);
  const [isEditing, setIsEditing] = useState(false);

  // Navigation functions
  const navigateTo = (pageId, id = null) => {
    setPage(pageId);
    if (pageId === 'resource-detail') {
      setResourceId(id);
    } else if (pageId === 'middleware-form') {
      setMiddlewareId(id);
      setIsEditing(!!id);
    }
  };

  // Render the active page
  const renderPage = () => {
    switch(page) {
      case 'dashboard':
        return <Dashboard navigateTo={navigateTo} />;
      case 'resources':
        return <ResourcesList navigateTo={navigateTo} />;
      case 'resource-detail':
        return <ResourceDetail 
          id={resourceId} 
          navigateTo={navigateTo} 
        />;
      case 'middlewares':
        return <MiddlewaresList navigateTo={navigateTo} />;
      case 'middleware-form':
        return <MiddlewareForm 
          id={middlewareId} 
          isEditing={isEditing}
          navigateTo={navigateTo} 
        />;
      default:
        return <Dashboard navigateTo={navigateTo} />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <nav className="bg-white shadow-sm">
        <div className="container mx-auto px-6 py-3">
          <div className="flex justify-between items-center">
            <div className="text-xl font-semibold text-gray-700">Pangolin Middleware Manager</div>
            <div className="space-x-4">
              <button 
                onClick={() => navigateTo('dashboard')}
                className={`px-3 py-2 rounded hover:bg-gray-100 ${page === 'dashboard' ? 'bg-gray-100' : ''}`}
              >
                Dashboard
              </button>
              <button 
                onClick={() => navigateTo('resources')}
                className={`px-3 py-2 rounded hover:bg-gray-100 ${page === 'resources' || page === 'resource-detail' ? 'bg-gray-100' : ''}`}
              >
                Resources
              </button>
              <button 
                onClick={() => navigateTo('middlewares')}
                className={`px-3 py-2 rounded hover:bg-gray-100 ${page === 'middlewares' || page === 'middleware-form' ? 'bg-gray-100' : ''}`}
              >
                Middlewares
              </button>
            </div>
          </div>
        </div>
      </nav>
      <main className="container mx-auto px-6 py-6">
        {renderPage()}
      </main>
    </div>
  );
};

// Dashboard Component
const Dashboard = ({ navigateTo }) => {
  const [resources, setResources] = useState([]);
  const [middlewares, setMiddlewares] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [resourcesData, middlewaresData] = await Promise.all([
          api.getResources(),
          api.getMiddlewares()
        ]);
        setResources(resourcesData);
        setMiddlewares(middlewaresData);
        setError(null);
      } catch (err) {
        setError('Failed to load dashboard data');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return <div className="flex justify-center p-12">Loading...</div>;
  }

  if (error) {
    return <div className="bg-red-100 text-red-700 p-4 rounded">{error}</div>;
  }

  // Calculate stats
  const protectedResources = resources.filter(r => r.status !== 'disabled' && r.middlewares && r.middlewares.length > 0).length;
  const activeResources = resources.filter(r => r.status !== 'disabled').length;
  const disabledResources = resources.filter(r => r.status === 'disabled').length;
  const unprotectedResources = activeResources - protectedResources;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>
      
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-2">Resources</h3>
          <p className="text-3xl font-bold">{activeResources}</p>
          {disabledResources > 0 && (
            <p className="text-sm text-gray-500 mt-1">
              {disabledResources} disabled resources
            </p>
          )}
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-2">Middlewares</h3>
          <p className="text-3xl font-bold">{middlewares.length}</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-2">Protected Resources</h3>
          <p className="text-3xl font-bold">{protectedResources} / {activeResources}</p>
        </div>
      </div>
      
      {/* Recent Resources */}
      <div className="bg-white p-6 rounded-lg shadow mb-8">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Recent Resources</h2>
          <button 
            onClick={() => navigateTo('resources')}
            className="text-blue-600 hover:underline"
          >
            View All
          </button>
        </div>
        
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="bg-gray-50">
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Host</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Middlewares</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {resources.slice(0, 5).map(resource => {
                const middlewaresList = parseMiddlewares(resource.middlewares);
                const isProtected = middlewaresList.length > 0;
                const isDisabled = resource.status === 'disabled';
                
                return (
                  <tr key={resource.id} className={isDisabled ? 'bg-gray-100' : ''}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {resource.host}
                      {isDisabled && (
                        <span className="ml-2 px-2 py-1 text-xs rounded-full bg-red-100 text-red-800">
                          Removed from Pangolin
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        isDisabled ? 'bg-gray-100 text-gray-800' :
                        isProtected ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {isDisabled ? 'Disabled' : isProtected ? 'Protected' : 'Not Protected'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">{middlewaresList.length > 0 ? middlewaresList.length : 'None'}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <button 
                        onClick={() => navigateTo('resource-detail', resource.id)}
                        className="text-blue-600 hover:text-blue-900 mr-3"
                      >
                        {isDisabled ? 'View' : 'Manage'}
                      </button>
                      {isDisabled && (
                        <button 
                          onClick={() => {
                            if (window.confirm(`Are you sure you want to delete the resource "${resource.host}"? This cannot be undone.`)) {
                              api.deleteResource(resource.id)
                                .then(() => {
                                  // Refresh dashboard data
                                  setResources(resources.filter(r => r.id !== resource.id));
                                })
                                .catch(error => {
                                  console.error('Error deleting resource:', error);
                                  alert('Failed to delete resource');
                                });
                            }
                          }}
                          className="text-red-600 hover:text-red-900"
                        >
                          Delete
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {resources.length === 0 && (
                <tr>
                  <td colSpan="4" className="px-6 py-4 text-center text-gray-500">No resources found</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      
      {/* Warning for unprotected resources */}
      {unprotectedResources > 0 && (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-8">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-yellow-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-yellow-700">
                You have {unprotectedResources} active resources that are not protected with any middleware.
              </p>
            </div>
          </div>
        </div>
      )}
      
      {/* Warning for disabled resources */}
      {disabledResources > 0 && (
        <div className="bg-blue-50 border-l-4 border-blue-400 p-4 mb-8">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-blue-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2h-1V9a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-blue-700">
                You have {disabledResources} disabled resources that were removed from Pangolin. <a className="underline" onClick={() => navigateTo('resources')}>View all resources</a> to delete them.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Resources List Component
const ResourcesList = ({ navigateTo }) => {
  const [resources, setResources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchResources = async () => {
    try {
      setLoading(true);
      const data = await api.getResources();
      setResources(data);
      setError(null);
    } catch (err) {
      setError('Failed to load resources');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchResources();
  }, []);

  const handleDeleteResource = async (id, host) => {
    // eslint-disable-next-line no-restricted-globals
    if (!confirm(`Are you sure you want to delete the resource "${host}"? This cannot be undone.`)) {
      return;
    }
    
    try {
      await api.deleteResource(id);
      alert('Resource deleted successfully');
      fetchResources();
    } catch (err) {
      alert(`Failed to delete resource: ${err.message || 'Unknown error'}`);
      console.error(err);
    }
  };

  const filteredResources = resources.filter(resource => 
    resource.host.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Resources</h1>
      
      <div className="mb-6 flex justify-between">
        <div className="relative w-64">
          <input
            type="text"
            placeholder="Search resources..."
            className="w-full px-4 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <button 
          onClick={fetchResources} 
          className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
          disabled={loading}
        >
          Refresh
        </button>
      </div>
      
      {loading && !resources.length ? (
        <div className="flex justify-center p-12">Loading...</div>
      ) : error ? (
        <div className="bg-red-100 text-red-700 p-4 rounded">{error}</div>
      ) : (
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Host</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Middlewares</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredResources.map(resource => {
                const middlewaresList = parseMiddlewares(resource.middlewares);
                const isProtected = middlewaresList.length > 0;
                const isDisabled = resource.status === 'disabled';
                
                return (
                  <tr key={resource.id} className={isDisabled ? 'bg-gray-100' : ''}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {resource.host}
                      {isDisabled && (
                        <span className="ml-2 px-2 py-1 text-xs rounded-full bg-red-100 text-red-800">
                          Removed from Pangolin
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        isDisabled ? 'bg-gray-100 text-gray-800' :
                        isProtected ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {isDisabled ? 'Disabled' : isProtected ? 'Protected' : 'Not Protected'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">{middlewaresList.length > 0 ? middlewaresList.length : 'None'}</td>
                    <td className="px-6 py-4 whitespace-nowrap flex space-x-2">
                      <button 
                        onClick={() => navigateTo('resource-detail', resource.id)}
                        className="text-blue-600 hover:text-blue-900"
                      >
                        {isDisabled ? 'View' : 'Manage'}
                      </button>
                      {isDisabled && (
                        <button 
                          onClick={() => handleDeleteResource(resource.id, resource.host)}
                          className="text-red-600 hover:text-red-900 ml-3"
                        >
                          Delete
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {filteredResources.length === 0 && (
                <tr>
                  <td colSpan="4" className="px-6 py-4 text-center text-gray-500">No resources found</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

// Resource Detail Component
const ResourceDetail = ({ id, navigateTo }) => {
  const [resource, setResource] = useState(null);
  const [middlewares, setMiddlewares] = useState([]);
  const [assignedMiddlewares, setAssignedMiddlewares] = useState([]);
  const [availableMiddlewares, setAvailableMiddlewares] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [selectedMiddlewares, setSelectedMiddlewares] = useState([]);
  const [priority, setPriority] = useState(100);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [resourceData, middlewaresData] = await Promise.all([
        api.getResource(id),
        api.getMiddlewares()
      ]);
      
      setResource(resourceData);
      setMiddlewares(middlewaresData);
      
      // Parse assigned middlewares
      const middlewaresList = parseMiddlewares(resourceData.middlewares);
      setAssignedMiddlewares(middlewaresList);
      
      // Filter available middlewares
      const assignedIds = middlewaresList.map(m => m.id);
      setAvailableMiddlewares(middlewaresData.filter(m => !assignedIds.includes(m.id)));
      
      setError(null);
    } catch (err) {
      setError('Failed to load resource details');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [id]);

  const handleMiddlewareSelection = (e) => {
    const options = e.target.options;
    const selected = [];
    for (let i = 0; i < options.length; i++) {
      if (options[i].selected) {
        selected.push(options[i].value);
      }
    }
    setSelectedMiddlewares(selected);
  };

  const handleAssignMiddleware = async (e) => {
    e.preventDefault();
    if (selectedMiddlewares.length === 0) {
      alert('Please select at least one middleware');
      return;
    }
    
    try {
      const middlewaresToAdd = selectedMiddlewares.map(middlewareId => ({
        middleware_id: middlewareId,
        priority: parseInt(priority)
      }));
      
      await api.assignMultipleMiddlewares(id, {
        middlewares: middlewaresToAdd
      });
      
      setShowModal(false);
      setSelectedMiddlewares([]);
      setPriority(100);
      
      // Refresh data
      fetchData();
    } catch (err) {
      alert('Failed to assign middlewares');
      console.error(err);
    }
  };

  const handleRemoveMiddleware = async (middlewareId) => {
    // eslint-disable-next-line no-restricted-globals
    if (!confirm('Are you sure you want to remove this middleware?')) return;
    
    try {
      await api.removeMiddleware(id, middlewareId);
      fetchData();
    } catch (err) {
      alert('Failed to remove middleware');
      console.error(err);
    }
  };

  if (loading) {
    return <div className="flex justify-center p-12">Loading...</div>;
  }

  if (error) {
    return (
      <div className="bg-red-100 text-red-700 p-4 rounded">
        {error}
        <button 
          className="ml-4 text-blue-600 hover:underline"
          onClick={() => navigateTo('resources')}
        >
          Back to Resources
        </button>
      </div>
    );
  }

  if (!resource) {
    return (
      <div className="bg-red-100 text-red-700 p-4 rounded">
        Resource not found
        <button 
          className="ml-4 text-blue-600 hover:underline"
          onClick={() => navigateTo('resources')}
        >
          Back to Resources
        </button>
      </div>
    );
  }

  const isDisabled = resource.status === 'disabled';

  return (
    <div>
      <div className="mb-6 flex items-center">
        <button 
          onClick={() => navigateTo('resources')}
          className="mr-4 px-3 py-1 bg-gray-200 rounded hover:bg-gray-300"
        >
          Back
        </button>
        <h1 className="text-2xl font-bold">Resource: {resource.host}</h1>
        {isDisabled && (
          <span className="ml-3 px-2 py-1 text-sm rounded-full bg-red-100 text-red-800">
            Removed from Pangolin
          </span>
        )}
      </div>
      
      {/* Warning for disabled resources */}
      {isDisabled && (
        <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-6">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
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
                  onClick={() => {
                    if (window.confirm(`Are you sure you want to delete the resource "${resource.host}"? This cannot be undone.`)) {
                      api.deleteResource(id)
                        .then(() => {
                          alert('Resource deleted successfully');
                          navigateTo('resources');
                        })
                        .catch(error => {
                          console.error('Error deleting resource:', error);
                          alert('Failed to delete resource');
                        });
                    }
                  }}
                  className="text-sm text-red-700 underline"
                >
                  Delete this resource
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Resource details */}
      <div className="bg-white p-6 rounded-lg shadow mb-6">
        <h2 className="text-xl font-semibold mb-4">Resource Details</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-gray-500">Host</p>
            <p className="font-medium flex items-center">
              {resource.host}
              <a 
                href={`https://${resource.host}`} 
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
            <p className="font-medium">{resource.service_id}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Status</p>
            <p>
              <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                isDisabled ? 'bg-red-100 text-red-800' :
                assignedMiddlewares.length > 0 ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
              }`}>
                {isDisabled ? 'Disabled' : assignedMiddlewares.length > 0 ? 'Protected' : 'Not Protected'}
              </span>
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Resource ID</p>
            <p className="font-medium">{resource.id}</p>
          </div>
        </div>
      </div>
      
      {/* Middlewares section */}
      <div className="bg-white p-6 rounded-lg shadow">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Attached Middlewares</h2>
          <button
            onClick={() => setShowModal(true)}
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
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Middleware</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Priority</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {assignedMiddlewares.map(middleware => {
                const middlewareDetails = middlewares.find(m => m.id === middleware.id) || {
                  id: middleware.id,
                  name: middleware.name,
                  type: 'unknown'
                };
                
                return (
                  <tr key={middleware.id}>
                    <td className="px-6 py-4">
                      {formatMiddlewareDisplay(middlewareDetails, middlewares)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">{middleware.priority}</td>
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
      
      {/* Add middleware modal */}
      {showModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-md">
            <div className="flex justify-between items-center px-6 py-4 border-b">
              <h3 className="text-lg font-semibold">Add Middlewares to {resource.host}</h3>
              <button 
                onClick={() => setShowModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                &times;
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
                      {availableMiddlewares.map(middleware => (
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
      )}
    </div>
  );
};

// Middlewares List Component
const MiddlewaresList = ({ navigateTo }) => {
  const [middlewares, setMiddlewares] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchMiddlewares = async () => {
    try {
      setLoading(true);
      const data = await api.getMiddlewares();
      setMiddlewares(data);
      setError(null);
    } catch (err) {
      setError('Failed to load middlewares');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMiddlewares();
  }, []);

  const handleDeleteMiddleware = async (id, name) => {
    // eslint-disable-next-line no-restricted-globals
    if (!confirm(`Are you sure you want to delete the middleware "${name}"?`)) {
      return;
    }
    
    try {
      await api.deleteMiddleware(id);
      fetchMiddlewares();
    } catch (err) {
      alert('Failed to delete middleware');
      console.error(err);
    }
  };

  const filteredMiddlewares = middlewares.filter(middleware =>
    middleware.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    middleware.type.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Middlewares</h1>
      
      <div className="mb-6 flex justify-between">
        <div className="relative w-64">
          <input
            type="text"
            placeholder="Search middlewares..."
            className="w-full px-4 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="space-x-3">
          <button 
            onClick={fetchMiddlewares} 
            className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
            disabled={loading}
          >
            Refresh
          </button>
          <button 
            onClick={() => navigateTo('middleware-form')}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Create Middleware
          </button>
        </div>
      </div>
      
      {loading && !middlewares.length ? (
        <div className="flex justify-center p-12">Loading...</div>
      ) : error ? (
        <div className="bg-red-100 text-red-700 p-4 rounded">{error}</div>
      ) : (
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredMiddlewares.map(middleware => (
                <tr key={middleware.id}>
                  <td className="px-6 py-4 whitespace-nowrap">{middleware.name}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                      {middleware.type}
                    </span>
                    {middleware.type === 'chain' && (
                      <span className="ml-2 text-xs text-gray-500">(Middleware Chain)</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <button
                      onClick={() => navigateTo('middleware-form', middleware.id)}
                      className="text-blue-600 hover:text-blue-900 mr-3"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteMiddleware(middleware.id, middleware.name)}
                      className="text-red-600 hover:text-red-900"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {filteredMiddlewares.length === 0 && (
                <tr>
                  <td colSpan="3" className="px-6 py-4 text-center text-gray-500">No middlewares found</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

// Middleware Form Component
const MiddlewareForm = ({ id, isEditing, navigateTo }) => {
  const [name, setName] = useState('');
  const [type, setType] = useState('forwardAuth');
  const [config, setConfig] = useState('{}');
  const [loading, setLoading] = useState(id ? true : false);
  const [error, setError] = useState(null);
  const [jsonError, setJsonError] = useState(null);
  const [availableMiddlewares, setAvailableMiddlewares] = useState([]);
  const [selectedMiddlewares, setSelectedMiddlewares] = useState([]);

  // Middleware types
  const middlewareTypes = [
    { value: 'basicAuth', label: 'Basic Authentication' },
    { value: 'forwardAuth', label: 'Forward Authentication' },
    { value: 'ipWhiteList', label: 'IP Whitelist' },
    { value: 'rateLimit', label: 'Rate Limiting' },
    { value: 'headers', label: 'Headers' },
    { value: 'stripPrefix', label: 'Strip Prefix' },
    { value: 'addPrefix', label: 'Add Prefix' },
    { value: 'redirectRegex', label: 'Redirect Regex' },
    { value: 'redirectScheme', label: 'Redirect Scheme' },
    { value: 'chain', label: 'Middleware Chain' },
    { value: 'replacepathregex', label: 'RegEx Path Replacement' },
    { value: 'plugin', label: 'Traefik Plugin' },
  ];

  // Templates for different middleware types
  const templates = {
    forwardAuth: {
      address: "http://auth-service:9000/verify",
      trustForwardHeader: true,
      authResponseHeaders: ["X-Remote-User", "X-Remote-Email", "X-Remote-Groups"]
    },
    basicAuth: {
      users: ["admin:$apr1$H6uskkkW$IgXLP6ewTrSuBkTrqE8wj/"]
    },
    ipWhiteList: {
      sourceRange: ["127.0.0.1/32", "192.168.1.0/24"]
    },
    rateLimit: {
      average: 100,
      burst: 50
    },
    headers: {
      accessControlAllowMethods: ["GET", "OPTIONS", "PUT"],
      browserXssFilter: true,
      contentTypeNosniff: true,
      customFrameOptionsValue: "SAMEORIGIN",
      customResponseHeaders: {
        "X-Robots-Tag": "none,noarchive,nosnippet,notranslate,noimageindex",
        "server": ""
      }
    },
    chain: {
      middlewares: []
    },
    replacepathregex: {
      regex: "^/path/to/replace",
      replacement: "/new/path"
    },
    redirectRegex: {
      regex: "^/path/to/redirect",
      replacement: "/new/path",
      permanent: false
    },
    plugin: {
      // Empty template to be filled when selecting a specific plugin
    },
    
    // Specific plugin templates - will be set when user chooses a plugin type
    geoblock: {
      geoblock: {
        silentStartUp: false,
        allowLocalRequests: false,
        logLocalRequests: false,
        logAllowedRequests: false,
        logApiRequests: false,
        api: "https://get.geojs.io/v1/ip/country/{ip}",
        apiTimeoutMs: 750,
        cacheSize: 15,
        forceMonthlyUpdate: false,
        allowUnknownCountries: false,
        unknownCountryApiResponse: "nil",
        blackListMode: false,
        addCountryHeader: false,
        countries: ["DE"]
      }
    },
    
    crowdsec: {
      crowdsec: {
        enabled: true,
        logLevel: "INFO",
        updateIntervalSeconds: 15,
        updateMaxFailure: 0,
        defaultDecisionSeconds: 15,
        httpTimeoutSeconds: 10,
        crowdsecMode: "live",
        crowdsecAppsecEnabled: true,
        crowdsecAppsecHost: "crowdsec:7422",
        crowdsecAppsecFailureBlock: true,
        crowdsecAppsecUnreachableBlock: true,
        crowdsecAppsecBodyLimit: 10485760,
        crowdsecLapiKey: "PUT_YOUR_BOUNCER_KEY_HERE_OR_IT_WILL_NOT_WORK",
        crowdsecLapiHost: "crowdsec:8080",
        crowdsecLapiScheme: "http",
        forwardedHeadersTrustedIPs: ["0.0.0.0/0"],
        clientTrustedIPs: [
          "10.0.0.0/8",
          "172.16.0.0/12",
          "192.168.0.0/16",
          "100.89.137.0/20"
        ]
      }
    }
  };

  // Fetch middleware data when editing
  useEffect(() => {
    if (id) {
      // Fetch middleware for editing
      api.getMiddleware(id)
        .then(data => {
          setName(data.name);
          setType(data.type);
          
          // Handle config depending on how it's returned from the API
          let configData = data.config;
          if (typeof configData === 'string') {
            try {
              configData = JSON.parse(configData);
            } catch (e) {
              console.error('Error parsing config JSON:', e);
            }
          }
          
          setConfig(JSON.stringify(configData, null, 2));
          setLoading(false);
        })
        .catch(err => {
          setError('Failed to load middleware');
          setLoading(false);
          console.error(err);
        });
    } else {
      // Set default template for new middleware
      setConfig(JSON.stringify(templates[type] || {}, null, 2));
    }
  }, [id]);

  // Update template when type changes (for new middleware)
  useEffect(() => {
    if (!id) {
      setConfig(JSON.stringify(templates[type] || {}, null, 2));
    }
  }, [type, id]);
  
  // Fetch available middlewares for chain type
  useEffect(() => {
    if (type === 'chain') {
      api.getMiddlewares()
        .then(data => {
          // Filter out the current middleware if editing
          const filtered = id ? data.filter(m => m.id !== id) : data;
          setAvailableMiddlewares(filtered);
          
          // If editing, parse selected middlewares from config
          if (id && config) {
            try {
              const configObj = JSON.parse(config);
              if (configObj.middlewares) {
                setSelectedMiddlewares(configObj.middlewares);
              }
            } catch (e) {
              console.error('Error parsing chain config:', e);
            }
          }
        })
        .catch(err => {
          console.error('Failed to fetch middlewares for chain:', err);
        });
    }
  }, [type, id, config]);

  // Update chain config when selectedMiddlewares changes
  useEffect(() => {
    if (type === 'chain') {
      const chainConfig = {
        middlewares: selectedMiddlewares
      };
      setConfig(JSON.stringify(chainConfig, null, 2));
    }
  }, [selectedMiddlewares, type]);

  // Validate JSON
  const validateJson = (json) => {
    try {
      JSON.parse(json);
      setJsonError(null);
      return true;
    } catch (err) {
      setJsonError(err.message);
      return false;
    }
  };

  const handleConfigChange = (e) => {
    const newConfig = e.target.value;
    setConfig(newConfig);
    validateJson(newConfig);
    
    // If it's a chain type, update selected middlewares
    if (type === 'chain') {
      try {
        const configObj = JSON.parse(newConfig);
        if (configObj.middlewares) {
          setSelectedMiddlewares(configObj.middlewares);
        }
      } catch (e) {
        // Don't update selectedMiddlewares if JSON is invalid
      }
    }
  };
  
  // Handle middleware selection for chain
  const handleMiddlewareSelection = (e) => {
    const options = e.target.options;
    const selected = [];
    for (let i = 0; i < options.length; i++) {
      if (options[i].selected) {
        selected.push(options[i].value);
      }
    }
    setSelectedMiddlewares(selected);
  };

  // Helper text for middleware types
  const getTypeHelperText = () => {
    switch (type) {
// In the getTypeHelperText function in MiddlewareForm
case 'plugin':
  return (
    <div className="text-xs text-gray-500 mt-1">
      <p>Configure a Traefik plugin middleware.</p>
      <div className="mt-2">
        <h4 className="font-semibold">GeoBlock Configuration</h4>
        <ul className="list-disc pl-5">
          <li><strong>blackListMode</strong>: When false, countries list is a whitelist; when true, it's a blacklist</li>
          <li><strong>countries</strong>: Array of two-letter ISO country codes</li>
          <li><strong>allowLocalRequests</strong>: When true, allows requests from private IP ranges</li>
          <li><strong>api</strong>: Geolocation API endpoint for IP lookups</li>
        </ul>
      </div>
      
      <div className="mt-2">
        <h4 className="font-semibold">CrowdSec Configuration</h4>
        <ul className="list-disc pl-5">
          <li><strong>crowdsecLapiKey</strong>: Your CrowdSec bouncer API key</li>
          <li><strong>crowdsecLapiHost</strong>: CrowdSec service address (e.g., "crowdsec:8080")</li>
          <li><strong>forwardedHeadersTrustedIPs</strong>: IP ranges to trust for forwarded headers</li>
          <li><strong>clientTrustedIPs</strong>: IP ranges to exempt from CrowdSec checks</li>
        </ul>
      </div>
      
      <p className="mt-2 italic">Note: Plugins must be installed on your Traefik instances for this configuration to work.</p>
    </div>
  );
      case 'replacepathregex':
        return (
          <div className="text-xs text-gray-500 mt-1">
            <p>The RegEx Path Replacement middleware rewrites the URL path based on regex match.</p>
            <p>Common use cases:</p>
            <ul className="list-disc pl-5 mt-1">
              <li>WebDAV redirects: <code>^/.well-known/ca(l|rd)dav</code> → <code>/remote.php/dav/</code></li>
              <li>Hiding paths: <code>^/api/internal/(.*)</code> → <code>/api/public/$1</code></li>
            </ul>
          </div>
        );
      case 'chain':
        return (
          <div className="text-xs text-gray-500 mt-1">
            <p>The Chain middleware allows you to combine multiple middlewares together.</p>
            <p>Order matters - middlewares are processed from top to bottom.</p>
          </div>
        );
      default:
        return null;
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!name.trim()) {
      alert('Please enter a name');
      return;
    }
    
    if (!validateJson(config)) {
      alert('Invalid JSON configuration');
      return;
    }
    
    try {
      const configObj = JSON.parse(config);
      
      if (id) {
        // Update existing middleware
        await api.updateMiddleware(id, {
          name,
          type,
          config: configObj
        });
        alert('Middleware updated successfully');
      } else {
        // Create new middleware
        await api.createMiddleware({
          name,
          type,
          config: configObj
        });
        alert('Middleware created successfully');
      }
      
      navigateTo('middlewares');
    } catch (err) {
      alert('Failed to save middleware');
      console.error(err);
    }
  };

  if (loading) {
    return <div className="flex justify-center p-12">Loading...</div>;
  }

  if (error) {
    return (
      <div className="bg-red-100 text-red-700 p-4 rounded">
        {error}
        <button 
          className="ml-4 text-blue-600 hover:underline"
          onClick={() => navigateTo('middlewares')}
        >
          Back to Middlewares
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-center">
        <button 
          onClick={() => navigateTo('middlewares')}
          className="mr-4 px-3 py-1 bg-gray-200 rounded hover:bg-gray-300"
        >
          Back
        </button>
        <h1 className="text-2xl font-bold">{id ? `Edit Middleware: ${name}` : 'Create New Middleware'}</h1>
      </div>
      
      <div className="bg-white p-6 rounded-lg shadow">
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-bold mb-2">
              Middleware Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., Authelia Authentication"
              required
            />
          </div>
          
          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-bold mb-2">
              Middleware Type
            </label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
              disabled={!!id} // Disable changing type when editing
            >
              {middlewareTypes.map(type => (
                <option key={type.value} value={type.value}>{type.label}</option>
              ))}
            </select>
            {getTypeHelperText()}
          </div>
{/* Add this after the middleware type selector in the MiddlewareForm component */}
{type === 'plugin' && (
  <div className="mb-4">
    <label className="block text-gray-700 text-sm font-bold mb-2">
      Plugin Type
    </label>
    <select
      onChange={(e) => {
        const pluginType = e.target.value;
        if (pluginType === 'geoblock') {
          setConfig(JSON.stringify(templates.geoblock, null, 2));
        } else if (pluginType === 'crowdsec') {
          setConfig(JSON.stringify(templates.crowdsec, null, 2));
        }
      }}
      className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
    >
      <option value="">-- Select a plugin --</option>
      <option value="geoblock">GeoBlock - Geographic Access Control</option>
      <option value="crowdsec">CrowdSec - Threat Protection</option>
    </select>
    <p className="text-xs text-gray-500 mt-1">
      Select a plugin type to load its configuration template.
    </p>
  </div>
)}
          {/* Chain specific UI */}
          {type === 'chain' && (
            <div className="mb-4">
              <label className="block text-gray-700 text-sm font-bold mb-2">
                Select Middlewares for Chain
              </label>
              <select
                multiple
                value={selectedMiddlewares}
                onChange={handleMiddlewareSelection}
                className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                size={5}
              >
                {availableMiddlewares.map(middleware => (
                  <option key={middleware.id} value={middleware.id}>
                    {middleware.name} ({middleware.type})
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Hold Ctrl (or Cmd) to select multiple middlewares. Order matters - middlewares are applied from top to bottom.
              </p>
            </div>
          )}
          
          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-bold mb-2">
              Configuration (JSON)
            </label>
            <textarea
              value={config}
              onChange={handleConfigChange}
              className={`w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono h-64 ${jsonError ? 'border-red-500' : ''}`}
              spellCheck="false"
            ></textarea>
            {jsonError && (
              <p className="text-red-500 text-xs mt-1">
                JSON Error: {jsonError}
              </p>
            )}
          </div>
          
          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={() => navigateTo('middlewares')}
              className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              disabled={!!jsonError}
            >
              {id ? 'Update Middleware' : 'Create Middleware'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default App;