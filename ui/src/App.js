import React, { useState, useEffect } from 'react';

// Dark mode icons as inline SVG
const MoonIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="dark-mode-icon">
    <path fillRule="evenodd" d="M9.528 1.718a.75.75 0 01.162.819A8.97 8.97 0 009 6a9 9 0 009 9 8.97 8.97 0 003.463-.69.75.75 0 01.981.98 10.503 10.503 0 01-9.694 6.46c-5.799 0-10.5-4.701-10.5-10.5 0-4.368 2.667-8.112 6.46-9.694a.75.75 0 01.818.162z" clipRule="evenodd" />
  </svg>
);

const SunIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="light-mode-icon">
    <path d="M12 2.25a.75.75 0 01.75.75v2.25a.75.75 0 01-1.5 0V3a.75.75 0 01.75-.75zM7.5 12a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM18.894 6.166a.75.75 0 00-1.06-1.06l-1.591 1.59a.75.75 0 101.06 1.061l1.591-1.59zM21.75 12a.75.75 0 01-.75.75h-2.25a.75.75 0 010-1.5H21a.75.75 0 01.75.75zM17.834 18.894a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 10-1.061 1.06l1.59 1.591zM12 18a.75.75 0 01.75.75V21a.75.75 0 01-1.5 0v-2.25A.75.75 0 0112 18zM7.758 17.303a.75.75 0 00-1.061-1.06l-1.591 1.59a.75.75 0 001.06 1.061l1.591-1.59zM6 12a.75.75 0 01-.75.75H3a.75.75 0 010-1.5h2.25A.75.75 0 016 12zM6.697 7.757a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 00-1.061 1.06l1.59 1.591z" />
  </svg>
);

// Dark mode initializer
const initializeDarkMode = () => {
  // Check for saved preference or use system preference
  const savedTheme = localStorage.getItem('theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  
  if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
    document.documentElement.classList.add('dark-mode');
    return true;
  }
  
  return false;
};

// Dark mode toggle functionality
const toggleDarkMode = (isDark, setIsDark) => {
  if (isDark) {
    document.documentElement.classList.remove('dark-mode');
    localStorage.setItem('theme', 'light');
    setIsDark(false);
  } else {
    document.documentElement.classList.add('dark-mode');
    localStorage.setItem('theme', 'dark');
    setIsDark(true);
  }
};

// Dark mode toggle component
const DarkModeToggle = ({ isDark, setIsDark }) => {
  return (
    <button 
      onClick={() => toggleDarkMode(isDark, setIsDark)}
      className="dark-mode-toggle ml-4"
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
    >
      {isDark ? <SunIcon /> : <MoonIcon />}
    </button>
  );
};

// --- API Service Configuration ---
const API_URL = '/api';

// API service object containing all endpoint calls
const api = {
  // Resource-related API calls
  getResources: () =>
    fetch(`${API_URL}/resources`).then((res) => res.json()),
  getResource: (id) =>
    fetch(`${API_URL}/resources/${id}`).then((res) => res.json()),
  deleteResource: (id) =>
    fetch(`${API_URL}/resources/${id}`, {
      method: 'DELETE',
    }).then((res) => res.json()),
  assignMiddleware: (resourceId, data) =>
    fetch(`${API_URL}/resources/${resourceId}/middlewares`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then((res) => res.json()),
  assignMultipleMiddlewares: (resourceId, data) =>
    fetch(`${API_URL}/resources/${resourceId}/middlewares/bulk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then((res) => res.json()),
  removeMiddleware: (resourceId, middlewareId) =>
    fetch(`${API_URL}/resources/${resourceId}/middlewares/${middlewareId}`, {
      method: 'DELETE',
    }).then((res) => res.json()),
  
  // HTTP entrypoints config
updateHTTPConfig: (resourceId, data) =>
  fetch(`${API_URL}/resources/${resourceId}/config/http`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  }).then((res) => res.json()),
  
// TLS domains config  
updateTLSConfig: (resourceId, data) =>
  fetch(`${API_URL}/resources/${resourceId}/config/tls`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  }).then((res) => res.json()),
  
// TCP SNI config
updateTCPConfig: (resourceId, data) =>
  fetch(`${API_URL}/resources/${resourceId}/config/tcp`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  }).then((res) => res.json()),
  
  // Headers config
  updateHeadersConfig: (resourceId, data) =>
    fetch(`${API_URL}/resources/${resourceId}/config/headers`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then((res) => res.json()),

  // Middleware-related API calls
  getMiddlewares: () =>
    fetch(`${API_URL}/middlewares`).then((res) => res.json()),
  getMiddleware: (id) =>
    fetch(`${API_URL}/middlewares/${id}`).then((res) => res.json()),
  createMiddleware: (data) =>
    fetch(`${API_URL}/middlewares`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then((res) => res.json()),
  updateMiddleware: (id, data) =>
    fetch(`${API_URL}/middlewares/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then((res) => res.json()),
  deleteMiddleware: (id) =>
    fetch(`${API_URL}/middlewares/${id}`, {
      method: 'DELETE',
    }).then((res) => res.json()),
};

// --- Helper Functions ---

// Parses middleware string into an array of middleware objects
const parseMiddlewares = (middlewaresStr) => {
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
};

// Formats middleware display, including chain middleware details
const formatMiddlewareDisplay = (middleware, allMiddlewares) => {
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
        <span className="px-2 py-1 ml-2 text-xs rounded-full bg-blue-100 text-blue-800">
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
              const chainedMiddleware = allMiddlewares.find((m) => m.id === id);
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
};

// --- Main App Component ---
const App = () => {
  const [page, setPage] = useState('dashboard');
  const [resourceId, setResourceId] = useState(null);
  const [middlewareId, setMiddlewareId] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);

  // Initialize dark mode on component mount
  useEffect(() => {
    setIsDarkMode(initializeDarkMode());
  }, []);

  // Handles navigation between pages
  const navigateTo = (pageId, id = null) => {
    setPage(pageId);
    if (pageId === 'resource-detail') {
      setResourceId(id);
    } else if (pageId === 'middleware-form') {
      setMiddlewareId(id);
      setIsEditing(!!id);
    }
  };

  // Renders the active page based on state
  const renderPage = () => {
    switch (page) {
      case 'dashboard':
        return <Dashboard navigateTo={navigateTo} />;
      case 'resources':
        return <ResourcesList navigateTo={navigateTo} />;
      case 'resource-detail':
        return (
          <ResourceDetail id={resourceId} navigateTo={navigateTo} />
        );
      case 'middlewares':
        return <MiddlewaresList navigateTo={navigateTo} />;
      case 'middleware-form':
        return (
          <MiddlewareForm
            id={middlewareId}
            isEditing={isEditing}
            navigateTo={navigateTo}
          />
        );
      default:
        return <Dashboard navigateTo={navigateTo} />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <nav className="bg-white shadow-sm">
        <div className="container mx-auto px-6 py-3">
          <div className="flex justify-between items-center">
            <div className="text-xl font-semibold text-gray-700">
              Pangolin Middleware Manager
            </div>
            <div className="flex items-center">
              <div className="space-x-4">
                <button
                  onClick={() => navigateTo('dashboard')}
                  className={`px-3 py-2 rounded hover:bg-gray-100 ${
                    page === 'dashboard' ? 'bg-gray-100' : ''
                  }`}
                >
                  Dashboard
                </button>
                <button
                  onClick={() => navigateTo('resources')}
                  className={`px-3 py-2 rounded hover:bg-gray-100 ${
                    page === 'resources' || page === 'resource-detail'
                      ? 'bg-gray-100'
                      : ''
                  }`}
                >
                  Resources
                </button>
                <button
                  onClick={() => navigateTo('middlewares')}
                  className={`px-3 py-2 rounded hover:bg-gray-100 ${
                    page === 'middlewares' || page === 'middleware-form'
                      ? 'bg-gray-100'
                      : ''
                  }`}
                >
                  Middlewares
                </button>
              </div>
              <DarkModeToggle isDark={isDarkMode} setIsDark={setIsDarkMode} />
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

// --- Dashboard Component ---
const Dashboard = ({ navigateTo }) => {
  const [resources, setResources] = useState([]);
  const [middlewares, setMiddlewares] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);
  const [initializationPhase, setInitializationPhase] = useState('Starting system...');
  const maxRetries = 10; // Maximum number of retry attempts
  const retryDelay = 3000; // 3 seconds between retries

  // Fetch initial dashboard data
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        
        // Update initialization phase message based on retry count
        if (retryCount === 1) setInitializationPhase('Connecting to database...');
        if (retryCount === 2) setInitializationPhase('Checking for resources...');
        if (retryCount === 3) setInitializationPhase('Generating configurations...');
        if (retryCount > 3) setInitializationPhase('Waiting for background services to complete...');
        
        const [resourcesData, middlewaresData] = await Promise.all([
          api.getResources(),
          api.getMiddlewares(),
        ]);
        
        // Check if we got meaningful data
        const hasResources = resourcesData && Array.isArray(resourcesData) && resourcesData.length > 0;
        const hasMiddlewares = middlewaresData && Array.isArray(middlewaresData) && middlewaresData.length > 0;
        
        // If we have no data and haven't exceeded max retries, retry after delay
        if ((!hasResources && !hasMiddlewares) && retryCount < maxRetries) {
          setRetryCount(retryCount + 1);
          setTimeout(() => fetchData(), retryDelay);
          return;
        }
        
        setResources(resourcesData || []);
        setMiddlewares(middlewaresData || []);
        setError(null);
        setLoading(false);
      } catch (err) {
        console.error('Dashboard fetch error:', err);
        
        // If API call failed but we haven't exceeded max retries, retry after delay
        if (retryCount < maxRetries) {
          setRetryCount(retryCount + 1);
          setInitializationPhase(`Connection attempt ${retryCount + 1}/${maxRetries} failed. Retrying...`);
          setTimeout(() => fetchData(), retryDelay);
        } else {
          setError('Failed to load dashboard data after multiple attempts. The server might be unavailable.');
          setLoading(false);
        }
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12">
        <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
        <h2 className="text-xl font-semibold mb-2">Initializing Middleware Manager</h2>
        <p className="text-gray-600 mb-4">{initializationPhase}</p>
        {retryCount > 0 && (
          <div className="text-sm text-gray-500">
            <p>Attempt {retryCount} of {maxRetries}</p>
            <p className="mt-2">The initial startup may take a moment while background services initialize.</p>
          </div>
        )}
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-100 text-red-700 p-6 rounded-lg border border-red-300">
        <h2 className="text-xl font-semibold mb-2">Error Loading Dashboard</h2>
        <p className="mb-4">{error}</p>
        <button 
          onClick={() => window.location.reload()} 
          className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
        >
          Retry
        </button>
      </div>
    );
  }

  // Calculate statistics for dashboard display
  const protectedResources = resources.filter(
    (r) => r.status !== 'disabled' && r.middlewares && r.middlewares.length > 0
  ).length;
  const activeResources = resources.filter(
    (r) => r.status !== 'disabled'
  ).length;
  const disabledResources = resources.filter(
    (r) => r.status === 'disabled'
  ).length;
  const unprotectedResources = activeResources - protectedResources;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>

      {/* Stats Section */}
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
          <h3 className="text-lg font-semibold mb-2">
            Protected Resources
          </h3>
          <p className="text-3xl font-bold">
            {protectedResources} / {activeResources}
          </p>
        </div>
      </div>

      {/* Recent Resources Section */}
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
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Host
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Middlewares
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {resources.slice(0, 5).map((resource) => {
                const middlewaresList = parseMiddlewares(resource.middlewares);
                const isProtected = middlewaresList.length > 0;
                const isDisabled = resource.status === 'disabled';

                return (
                  <tr
                    key={resource.id}
                    className={isDisabled ? 'bg-gray-100' : ''}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      {resource.host}
                      {isDisabled && (
                        <span className="ml-2 px-2 py-1 text-xs rounded-full bg-red-100 text-red-800">
                          Removed from Pangolin
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          isDisabled
                            ? 'bg-gray-100 text-gray-800'
                            : isProtected
                            ? 'bg-green-100 text-green-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}
                      >
                        {isDisabled
                          ? 'Disabled'
                          : isProtected
                          ? 'Protected'
                          : 'Not Protected'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {middlewaresList.length > 0
                        ? middlewaresList.length
                        : 'None'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <button
                        onClick={() =>
                          navigateTo('resource-detail', resource.id)
                        }
                        className="text-blue-600 hover:text-blue-900 mr-3"
                      >
                        {isDisabled ? 'View' : 'Manage'}
                      </button>
                      {isDisabled && (
                        <button
                          onClick={() => {
                            if (
                              window.confirm(
                                `Are you sure you want to delete the resource "${resource.host}"? This cannot be undone.`
                              )
                            ) {
                              api
                                .deleteResource(resource.id)
                                .then(() => {
                                  setResources(
                                    resources.filter(
                                      (r) => r.id !== resource.id
                                    )
                                  );
                                })
                                .catch((error) => {
                                  console.error(
                                    'Error deleting resource:',
                                    error
                                  );
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
                  <td
                    colSpan="4"
                    className="px-6 py-4 text-center text-gray-500"
                  >
                    No resources found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Warning for Unprotected Resources */}
      {unprotectedResources > 0 && (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-8">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg
                className="h-5 w-5 text-yellow-400"
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
              <p className="text-sm text-yellow-700">
                You have {unprotectedResources} active resources that are not
                protected with any middleware.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Warning for Disabled Resources */}
      {disabledResources > 0 && (
        <div className="bg-blue-50 border-l-4 border-blue-400 p-4 mb-8">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg
                className="h-5 w-5 text-blue-400"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2h-1V9a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-blue-700">
                You have {disabledResources} disabled resources that were removed
                from Pangolin.{' '}
                <a
                  className="underline"
                  onClick={() => navigateTo('resources')}
                >
                  View all resources
                </a>{' '}
                to delete them.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// --- Resources List Component ---
const ResourcesList = ({ navigateTo }) => {
  const [resources, setResources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Fetch all resources
  const fetchResources = async () => {
    try {
      setLoading(true);
      const data = await api.getResources();
      setResources(data);
      setError(null);
    } catch (err) {
      setError('Failed to load resources');
      console.error('Resources fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchResources();
  }, []);

  // Handle resource deletion with confirmation
  const handleDeleteResource = async (id, host) => {
    if (
      !window.confirm(
        `Are you sure you want to delete the resource "${host}"? This cannot be undone.`
      )
    ) {
      return;
    }

    try {
      await api.deleteResource(id);
      alert('Resource deleted successfully');
      fetchResources();
    } catch (err) {
      alert(
        `Failed to delete resource: ${err.message || 'Unknown error'}`
      );
      console.error('Delete resource error:', err);
    }
  };

  // Filter resources based on search term
  const filteredResources = resources.filter((resource) =>
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
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Host
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Middlewares
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredResources.map((resource) => {
                const middlewaresList = parseMiddlewares(resource.middlewares);
                const isProtected = middlewaresList.length > 0;
                const isDisabled = resource.status === 'disabled';

                return (
                  <tr
                    key={resource.id}
                    className={isDisabled ? 'bg-gray-100' : ''}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      {resource.host}
                      {isDisabled && (
                        <span className="ml-2 px-2 py-1 text-xs rounded-full bg-red-100 text-red-800">
                          Removed from Pangolin
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          isDisabled
                            ? 'bg-gray-100 text-gray-800'
                            : isProtected
                            ? 'bg-green-100 text-green-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}
                      >
                        {isDisabled
                          ? 'Disabled'
                          : isProtected
                          ? 'Protected'
                          : 'Not Protected'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {middlewaresList.length > 0
                        ? middlewaresList.length
                        : 'None'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap flex space-x-2">
                      <button
                        onClick={() =>
                          navigateTo('resource-detail', resource.id)
                        }
                        className="text-blue-600 hover:text-blue-900"
                      >
                        {isDisabled ? 'View' : 'Manage'}
                      </button>
                      {isDisabled && (
                        <button
                          onClick={() =>
                            handleDeleteResource(resource.id, resource.host)
                          }
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
                  <td
                    colSpan="4"
                    className="px-6 py-4 text-center text-gray-500"
                  >
                    No resources found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

// --- Resource Detail Component ---
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
  // HTTP Router Configuration
  const [entrypoints, setEntrypoints] = useState('websecure');
  const [showHTTPConfigModal, setShowHTTPConfigModal] = useState(false);

  // TLS Certificate Domains Configuration
  const [tlsDomains, setTLSDomains] = useState('');
  const [showTLSConfigModal, setShowTLSConfigModal] = useState(false);

  // TCP SNI Router Configuration
  const [tcpEnabled, setTCPEnabled] = useState(false);
  const [tcpEntrypoints, setTCPEntrypoints] = useState('tcp');
  const [tcpSNIRule, setTCPSNIRule] = useState('');
  const [showTCPConfigModal, setShowTCPConfigModal] = useState(false);

  // new state variables for headers
  const [customHeaders, setCustomHeaders] = useState({});
  const [showHeadersConfigModal, setShowHeadersConfigModal] = useState(false);
  const [headerKey, setHeaderKey] = useState('');
  const [headerValue, setHeaderValue] = useState('');

  // Fetch resource and middleware data
  const fetchData = async () => {
    try {
      setLoading(true);
      const [resourceData, middlewaresData] = await Promise.all([
        api.getResource(id),
        api.getMiddlewares(),
      ]);

      setResource(resourceData);
      setMiddlewares(middlewaresData);
      // Set HTTP config
      setEntrypoints(resourceData.entrypoints || 'websecure');
      // Set TLS domains config
      setTLSDomains(resourceData.tls_domains || '');
      // Set TCP config
      setTCPEnabled(resourceData.tcp_enabled || false);
      setTCPEntrypoints(resourceData.tcp_entrypoints || 'tcp');
      setTCPSNIRule(resourceData.tcp_sni_rule || '');

      // Add this code here for custom headers parsing
    if (resourceData.custom_headers) {
      try {
        setCustomHeaders(JSON.parse(resourceData.custom_headers));
      } catch (e) {
        console.error("Error parsing custom headers:", e);
        setCustomHeaders({});
      }
    } else {
      setCustomHeaders({});
    }

      // Parse assigned middlewares
      const middlewaresList = parseMiddlewares(resourceData.middlewares);
      setAssignedMiddlewares(middlewaresList);

      // Filter out already assigned middlewares
      const assignedIds = middlewaresList.map((m) => m.id);
      setAvailableMiddlewares(
        middlewaresData.filter((m) => !assignedIds.includes(m.id))
      );

      setError(null);
    } catch (err) {
      setError('Failed to load resource details');
      console.error('Resource detail fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [id]);
  const handleUpdateHTTPConfig = async (e) => {
    e.preventDefault();
    
    try {
      await api.updateHTTPConfig(id, { entrypoints });
      setShowHTTPConfigModal(false);
      fetchData();
      alert('HTTP router configuration updated successfully');
    } catch (err) {
      alert('Failed to update HTTP router configuration');
      console.error('Update HTTP config error:', err);
    }
  };
  
  const handleUpdateTLSConfig = async (e) => {
    e.preventDefault();
    
    try {
      await api.updateTLSConfig(id, { tls_domains: tlsDomains });
      setShowTLSConfigModal(false);
      fetchData();
      alert('TLS certificate domains updated successfully');
    } catch (err) {
      alert('Failed to update TLS certificate domains');
      console.error('Update TLS config error:', err);
    }
    try {
      await api.updateHeadersConfig(id, { custom_headers: customHeaders });
      setShowHeadersConfigModal(false);
      fetchData();
      alert('Custom headers updated successfully');
    } catch (err) {
      alert('Failed to update custom headers');
      console.error('Update headers config error:', err);
    }
  };
  
  const handleUpdateTCPConfig = async (e) => {
    e.preventDefault();
    
    try {
      await api.updateTCPConfig(id, {
        tcp_enabled: tcpEnabled,
        tcp_entrypoints: tcpEntrypoints,
        tcp_sni_rule: tcpSNIRule
      });
      setShowTCPConfigModal(false);
      fetchData();
      alert('TCP SNI router configuration updated successfully');
    } catch (err) {
      alert('Failed to update TCP SNI router configuration');
      console.error('Update TCP config error:', err);
    }
  };
  const handleUpdateHeadersConfig = async (e) => {
    e.preventDefault();
    
    try {
      await api.updateHeadersConfig(id, { custom_headers: customHeaders });
      setShowHeadersConfigModal(false);
      fetchData();
      alert('Custom headers updated successfully');
    } catch (err) {
      alert('Failed to update custom headers');
      console.error('Update headers config error:', err);
    }
  };
  // Function to add new header
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

// Function to remove header
const removeHeader = (key) => {
  const newHeaders = {...customHeaders};
  delete newHeaders[key];
  setCustomHeaders(newHeaders);
};

  // Handle multiple middleware selection
  const handleMiddlewareSelection = (e) => {
    const options = e.target.options;
    const selected = Array.from(options)
      .filter((option) => option.selected)
      .map((option) => option.value);
    setSelectedMiddlewares(selected);
  };

  // Assign selected middlewares to resource
  const handleAssignMiddleware = async (e) => {
    e.preventDefault();
    if (selectedMiddlewares.length === 0) {
      alert('Please select at least one middleware');
      return;
    }

    try {
      const middlewaresToAdd = selectedMiddlewares.map((middlewareId) => ({
        middleware_id: middlewareId,
        priority: parseInt(priority, 10),
      }));

      await api.assignMultipleMiddlewares(id, {
        middlewares: middlewaresToAdd,
      });

      setShowModal(false);
      setSelectedMiddlewares([]);
      setPriority(100);
      fetchData();
    } catch (err) {
      alert('Failed to assign middlewares');
      console.error('Assign middleware error:', err);
    }
  };

  // Remove a middleware from resource
  const handleRemoveMiddleware = async (middlewareId) => {
    if (
      !window.confirm('Are you sure you want to remove this middleware?')
    )
      return;

    try {
      await api.removeMiddleware(id, middlewareId);
      fetchData();
    } catch (err) {
      alert('Failed to remove middleware');
      console.error('Remove middleware error:', err);
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
                  onClick={() => {
                    if (
                      window.confirm(
                        `Are you sure you want to delete the resource "${resource.host}"? This cannot be undone.`
                      )
                    ) {
                      api
                        .deleteResource(id)
                        .then(() => {
                          alert('Resource deleted successfully');
                          navigateTo('resources');
                        })
                        .catch((error) => {
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
  
      {/* Resource Details */}
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
            <p className="font-medium">{resource.id}</p>
          </div>
        </div>
      </div>
  
      {/* Router Configuration Section */}
      <div className="bg-white p-6 rounded-lg shadow mb-6">
        <h2 className="text-xl font-semibold mb-4">Router Configuration</h2>
        <div className="flex flex-wrap gap-4">
          <button
            onClick={() => setShowHTTPConfigModal(true)}
            disabled={isDisabled}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            HTTP Router Configuration
          </button>
          <button
            onClick={() => setShowTLSConfigModal(true)}
            disabled={isDisabled}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            TLS Certificate Domains
          </button>
          <button
            onClick={() => setShowTCPConfigModal(true)}
            disabled={isDisabled}
            className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            TCP SNI Routing
          </button>

          {/* Add the Custom Headers button here */}
          <button
            onClick={() => setShowHeadersConfigModal(true)}
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
            {/* Add Custom Headers summary here */}
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
  
      {/* Middlewares Section */}
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
                const middlewareDetails =
                  middlewares.find((m) => m.id === middleware.id) || {
                    id: middleware.id,
                    name: middleware.name,
                    type: 'unknown',
                  };
  
                return (
                  <tr key={middleware.id}>
                    <td className="px-6 py-4">
                      {formatMiddlewareDisplay(middlewareDetails, middlewares)}
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
  
      {/* Add Middleware Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-md">
            <div className="flex justify-between items-center px-6 py-4 border-b">
              <h3 className="text-lg font-semibold">
                Add Middlewares to {resource.host}
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
      )}
  
      {/* HTTP Config Modal */}
      {showHTTPConfigModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-md">
            <div className="flex justify-between items-center px-6 py-4 border-b">
              <h3 className="text-lg font-semibold">HTTP Router Configuration</h3>
              <button
                onClick={() => setShowHTTPConfigModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                ×
              </button>
            </div>
            <div className="px-6 py-4">
              <form onSubmit={handleUpdateHTTPConfig}>
                <div className="mb-4">
                  <label className="block text-gray-700 text-sm font-bold mb-2">
                    HTTP Entry Points (comma-separated)
                  </label>
                  <input
                    type="text"
                    value={entrypoints}
                    onChange={(e) => setEntrypoints(e.target.value)}
                    className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="websecure,metrics,api"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Standard entrypoints: websecure (HTTPS), web (HTTP). Default: websecure
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    <strong>Note:</strong> Entrypoints must be defined in your Traefik static configuration file
                  </p>
                </div>
                <div className="flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => setShowHTTPConfigModal(false)}
                    className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    Save Configuration
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
  
      {/* TLS Certificate Domains Modal */}
      {showTLSConfigModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-md">
            <div className="flex justify-between items-center px-6 py-4 border-b">
              <h3 className="text-lg font-semibold">TLS Certificate Domains</h3>
              <button
                onClick={() => setShowTLSConfigModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                ×
              </button>
            </div>
            <div className="px-6 py-4">
              <form onSubmit={handleUpdateTLSConfig}>
                <div className="mb-4">
                  <label className="block text-gray-700 text-sm font-bold mb-2">
                    Additional Certificate Domains (comma-separated)
                  </label>
                  <input
                    type="text"
                    value={tlsDomains}
                    onChange={(e) => setTLSDomains(e.target.value)}
                    className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="example.com,*.example.com"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Extra domains to include in the TLS certificate (Subject Alternative Names)
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Main domain ({resource.host}) will be automatically included
                  </p>
                </div>
                <div className="flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => setShowTLSConfigModal(false)}
                    className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                  >
                    Save Certificate Domains
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
  
      {/* TCP SNI Routing Modal */}
      {showTCPConfigModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-md">
            <div className="flex justify-between items-center px-6 py-4 border-b">
              <h3 className="text-lg font-semibold">TCP SNI Routing Configuration</h3>
              <button
                onClick={() => setShowTCPConfigModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                ×
              </button>
            </div>
            <div className="px-6 py-4">
              <form onSubmit={handleUpdateTCPConfig}>
                <div className="mb-4">
                  <label className="block text-gray-700 text-sm font-bold mb-2 flex items-center">
                    <input
                      type="checkbox"
                      checked={tcpEnabled}
                      onChange={(e) => setTCPEnabled(e.target.checked)}
                      className="mr-2"
                    />
                    Enable TCP SNI Routing
                  </label>
                  <p className="text-xs text-gray-500 mt-1">
                    Creates a separate TCP router with SNI matching rules
                  </p>
                </div>
                {tcpEnabled && (
                  <>
                    <div className="mb-4">
                      <label className="block text-gray-700 text-sm font-bold mb-2">
                        TCP Entry Points (comma-separated)
                      </label>
                      <input
                        type="text"
                        value={tcpEntrypoints}
                        onChange={(e) => setTCPEntrypoints(e.target.value)}
                        className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="tcp"
                        required
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Standard TCP entrypoint: tcp. Default: tcp
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        <strong>Note:</strong> Entrypoints must be defined in your Traefik static configuration file
                      </p>
                    </div>
                    <div className="mb-4">
                      <label className="block text-gray-700 text-sm font-bold mb-2">
                        TCP SNI Matching Rule
                      </label>
                      <input
                        type="text"
                        value={tcpSNIRule}
                        onChange={(e) => setTCPSNIRule(e.target.value)}
                        className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder={`HostSNI(\`${resource.host}\`)`}
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        SNI rule using HostSNI or HostSNIRegexp matchers
                      </p>
                      <p className="text-xs text-gray-500 mt-1">Examples:</p>
                      <ul className="text-xs text-gray-500 mt-1 list-disc pl-5">
                        <li>Match specific domain: <code>{`HostSNI(\`${resource.host}\`)`}</code></li>
                        <li>Match with wildcard: <code>{`HostSNIRegexp(\`^.+\\.example\\.com$\`)`}</code></li>
                        <li>Complex rule: <code>{`HostSNI(\`${resource.host}\`) || (HostSNI(\`other.example.com\`) && !ALPN(\`h2\`))`}</code></li>
                      </ul>
                      <p className="text-xs text-gray-500 mt-1">
                        If empty, defaults to <code>{`HostSNI(\`${resource.host}\`)`}</code>
                      </p>
                    </div>
                  </>
                )}
                <div className="flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => setShowTCPConfigModal(false)}
                    className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
                  >
                    Save TCP Configuration
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
      {/* Add Custom Headers Modal here */}
{showHeadersConfigModal && (
  <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
    <div className="bg-white rounded-lg shadow-lg w-full max-w-md">
      <div className="flex justify-between items-center px-6 py-4 border-b">
        <h3 className="text-lg font-semibold">Custom Headers Configuration</h3>
        <button
          onClick={() => setShowHeadersConfigModal(false)}
          className="text-gray-500 hover:text-gray-700"
        >
          ×
        </button>
      </div>
      <div className="px-6 py-4">
        <form onSubmit={handleUpdateHeadersConfig}>
          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-bold mb-2">
              Custom Request Headers
            </label>
            
            {/* Current headers list */}
            {Object.keys(customHeaders).length > 0 ? (
              <div className="mb-4 border rounded p-3">
                <h4 className="text-sm font-semibold mb-2">Current Headers</h4>
                <ul className="space-y-2">
                  {Object.entries(customHeaders).map(([key, value]) => (
                    <li key={key} className="flex justify-between items-center">
                      <div>
                        <span className="font-medium">{key}:</span> {value}
                      </div>
                      <button
                        type="button"
                        onClick={() => removeHeader(key)}
                        className="text-red-600 hover:text-red-800"
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="text-sm text-gray-500 mb-4">No custom headers configured.</p>
            )}
            
            {/* Add new header */}
            <div className="border rounded p-3">
              <h4 className="text-sm font-semibold mb-2">Add New Header</h4>
              <div className="grid grid-cols-5 gap-2 mb-2">
                <div className="col-span-2">
                  <input
                    type="text"
                    value={headerKey}
                    onChange={(e) => setHeaderKey(e.target.value)}
                    placeholder="Header name"
                    className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="col-span-2">
                  <input
                    type="text"
                    value={headerValue}
                    onChange={(e) => setHeaderValue(e.target.value)}
                    placeholder="Header value"
                    className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="col-span-1">
                  <button
                    type="button"
                    onClick={addHeader}
                    className="w-full px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    Add
                  </button>
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Common examples: Host, X-Forwarded-Host
              </p>
              <p className="text-xs text-gray-500 mt-1">
                <strong>Host</strong>: To modify the hostname sent to the backend service
              </p>
              <p className="text-xs text-gray-500 mt-1">
                <strong>X-Forwarded-Host</strong>: To pass the original hostname to the backend
              </p>
            </div>
          </div>
          
          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={() => setShowHeadersConfigModal(false)}
              className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700"
            >
              Save Headers
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
)}
    </div>
  );
};

// --- Middlewares List Component ---
const MiddlewaresList = ({ navigateTo }) => {
  const [middlewares, setMiddlewares] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [middlewareToDelete, setMiddlewareToDelete] = useState(null);

  // Fetch all middlewares
  const fetchMiddlewares = async () => {
    try {
      setLoading(true);
      const data = await api.getMiddlewares();
      setMiddlewares(data);
      setError(null);
    } catch (err) {
      setError('Failed to load middlewares');
      console.error('Middlewares fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMiddlewares();
  }, []);

  // Open confirmation modal before deleting
  const confirmDelete = (middleware) => {
    setMiddlewareToDelete(middleware);
    setShowDeleteModal(true);
  };

  // Handle middleware deletion after confirmation
  const handleDeleteMiddleware = async () => {
    if (!middlewareToDelete) return;
    
    try {
      await api.deleteMiddleware(middlewareToDelete.id);
      setShowDeleteModal(false);
      setMiddlewareToDelete(null);
      await fetchMiddlewares();
    } catch (err) {
      alert('Failed to delete middleware');
      console.error('Delete middleware error:', err);
    }
  };

  // Cancel deletion
  const cancelDelete = () => {
    setShowDeleteModal(false);
    setMiddlewareToDelete(null);
  };

  // Filter middlewares based on search term
  const filteredMiddlewares = middlewares.filter(
    (middleware) =>
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
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/3">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/3">
                  Type
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-1/3">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredMiddlewares.map((middleware) => (
                <tr key={middleware.id}>
                  <td className="px-6 py-4 whitespace-nowrap font-medium">
                    {middleware.name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                      {middleware.type}
                      {middleware.type === 'chain' && " (Middleware Chain)"}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <div className="flex justify-end space-x-2">
                      <button
                        onClick={() => navigateTo('middleware-form', middleware.id)}
                        className="bg-blue-500 text-white px-4 py-2 rounded"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => confirmDelete(middleware)}
                        className="bg-red-500 text-white px-4 py-2 rounded"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredMiddlewares.length === 0 && (
                <tr>
                  <td
                    colSpan="3"
                    className="px-6 py-4 text-center text-gray-500"
                  >
                    No middlewares found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-md">
            <div className="px-6 py-4 border-b">
              <h3 className="text-lg font-semibold text-red-600">Confirm Deletion</h3>
            </div>
            <div className="px-6 py-4">
              <p className="mb-4">
                Are you sure you want to delete the middleware "{middlewareToDelete?.name}"?
              </p>
              <p className="text-sm text-gray-500 mb-4">
                This action cannot be undone and may affect any resources currently using this middleware.
              </p>
              <div className="flex justify-end space-x-3">
                <button
                  onClick={cancelDelete}
                  className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteMiddleware}
                  className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// --- Middleware Form Component ---
const MiddlewareForm = ({ id, isEditing, navigateTo }) => {
  const [middleware, setMiddleware] = useState({
    name: '',
    type: 'basicAuth',
    config: {}
  });
  const [configText, setConfigText] = useState('{\n  "users": [\n    "admin:$apr1$H6uskkkW$IgXLP6ewTrSuBkTrqE8wj/"\n  ]\n}');
  const [loading, setLoading] = useState(isEditing);
  const [error, setError] = useState(null);
  
  // Available middleware types
  const middlewareTypes = [
    { value: 'basicAuth', label: 'Basic Authentication' },
    { value: 'forwardAuth', label: 'Forward Authentication' },
    { value: 'ipWhiteList', label: 'IP Whitelist' },
    { value: 'rateLimit', label: 'Rate Limiting' },
    { value: 'headers', label: 'HTTP Headers' },
    { value: 'stripPrefix', label: 'Strip Prefix' },
    { value: 'addPrefix', label: 'Add Prefix' },
    { value: 'redirectRegex', label: 'Redirect Regex' },
    { value: 'redirectScheme', label: 'Redirect Scheme' },
    { value: 'chain', label: 'Middleware Chain' },
    { value: 'replacepathregex', label: 'Replace Path Regex' },
    { value: 'plugin', label: 'Traefik Plugin' }
  ];

  // Template configs for different middleware types
  const configTemplates = {
    basicAuth: '{\n  "users": [\n    "admin:$apr1$H6uskkkW$IgXLP6ewTrSuBkTrqE8wj/"\n  ]\n}',
    forwardAuth: '{\n  "address": "http://auth-service:9090/auth",\n  "trustForwardHeader": true,\n  "authResponseHeaders": [\n    "X-Auth-User",\n    "X-Auth-Roles"\n  ]\n}',
    ipWhiteList: '{\n  "sourceRange": [\n    "127.0.0.1/32",\n    "192.168.1.0/24"\n  ]\n}',
    rateLimit: '{\n  "average": 100,\n  "burst": 50\n}',
    headers: '{\n  "browserXssFilter": true,\n  "contentTypeNosniff": true,\n  "customFrameOptionsValue": "SAMEORIGIN",\n  "forceSTSHeader": true,\n  "stsIncludeSubdomains": true,\n  "stsSeconds": 63072000\n}',
    stripPrefix: '{\n  "prefixes": [\n    "/api"\n  ]\n}',
    addPrefix: '{\n  "prefix": "/api"\n}',
    redirectRegex: '{\n  "regex": "^http://(.*)$",\n  "replacement": "https://${1}"\n}',
    redirectScheme: '{\n  "scheme": "https",\n  "permanent": true\n}',
    chain: '{\n  "middlewares": [\n    "basic-auth@file",\n    "rate-limit@file"\n  ]\n}',
    replacepathregex: '{\n  "regex": "^/api/(.*)",\n  "replacement": "/$1"\n}',
    plugin: '{\n  "plugin-name": {\n    "option1": "value1",\n    "option2": "value2"\n  }\n}'
  };

  // Fetch middleware details if editing
  useEffect(() => {
    if (isEditing && id) {
      const fetchMiddleware = async () => {
        try {
          setLoading(true);
          const data = await api.getMiddleware(id);
          setMiddleware({
            name: data.name,
            type: data.type,
            config: data.config
          });
          
          // Format config as JSON string
          const configJson = typeof data.config === 'string' 
            ? data.config 
            : JSON.stringify(data.config, null, 2);
          
          setConfigText(configJson);
          setError(null);
        } catch (err) {
          setError('Failed to load middleware details');
          console.error('Middleware fetch error:', err);
        } finally {
          setLoading(false);
        }
      };

      fetchMiddleware();
    }
  }, [id, isEditing]);

  // Update config template when type changes
  const handleTypeChange = (e) => {
    const newType = e.target.value;
    setMiddleware({ ...middleware, type: newType });
    setConfigText(configTemplates[newType] || '{}');
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      // Parse config JSON
      let configObj;
      try {
        configObj = JSON.parse(configText);
      } catch (err) {
        alert('Invalid JSON configuration. Please check the format.');
        return;
      }
      
      const middlewareData = {
        name: middleware.name,
        type: middleware.type,
        config: configObj
      };
      
      setLoading(true);
      
      if (isEditing) {
        await api.updateMiddleware(id, middlewareData);
        alert('Middleware updated successfully');
      } else {
        await api.createMiddleware(middlewareData);
        alert('Middleware created successfully');
      }
      
      navigateTo('middlewares');
    } catch (err) {
      setError(`Failed to ${isEditing ? 'update' : 'create'} middleware`);
      console.error('Middleware form error:', err);
      alert(`Error: ${err.message || 'Unknown error occurred'}`);
    } finally {
      setLoading(false);
    }
  };

  if (loading && isEditing) {
    return <div className="flex justify-center p-12">Loading...</div>;
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
        <h1 className="text-2xl font-bold">
          {isEditing ? 'Edit Middleware' : 'Create Middleware'}
        </h1>
      </div>

      {error && (
        <div className="bg-red-100 text-red-700 p-4 rounded mb-6">{error}</div>
      )}

      <div className="bg-white p-6 rounded-lg shadow">
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-bold mb-2">
              Middleware Name
            </label>
            <input
              type="text"
              value={middleware.name}
              onChange={(e) => setMiddleware({ ...middleware, name: e.target.value })}
              className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., production-authentication"
              required
            />
          </div>

          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-bold mb-2">
              Middleware Type
            </label>
            <select
              value={middleware.type}
              onChange={handleTypeChange}
              className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            >
              {middlewareTypes.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>

          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-bold mb-2">
              Configuration (JSON)
            </label>
            <textarea
              value={configText}
              onChange={(e) => setConfigText(e.target.value)}
              className="w-full px-3 py-2 border font-mono h-64 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter JSON configuration"
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              Configuration must be valid JSON for the selected middleware type
            </p>
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
              disabled={loading}
            >
              {loading ? 'Saving...' : isEditing ? 'Update Middleware' : 'Create Middleware'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default App;