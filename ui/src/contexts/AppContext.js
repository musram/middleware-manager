import React, { createContext, useState, useContext, useEffect } from 'react';

// Create the context
const AppContext = createContext();

/**
 * App provider component
 * Manages global application state
 *
 * @param {Object} props
 * @param {ReactNode} props.children - Child components
 * @returns {JSX.Element}
 */
export const AppProvider = ({ children }) => {
  const [page, setPage] = useState('dashboard');
  const [resourceId, setResourceId] = useState(null);
  const [middlewareId, setMiddlewareId] = useState(null);
  const [serviceId, setServiceId] = useState(null); // Add serviceId state
  const [isEditing, setIsEditing] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [activeDataSource, setActiveDataSource] = useState('pangolin');

  // Initialize dark mode on mount
  useEffect(() => {
    // Check for saved preference or use system preference
    const savedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

    const shouldUseDarkMode = savedTheme === 'dark' || (!savedTheme && prefersDark);

    if (shouldUseDarkMode) {
      document.documentElement.classList.add('dark-mode');
      setIsDarkMode(true);
    } else {
      document.documentElement.classList.remove('dark-mode');
      setIsDarkMode(false);
    }
  }, []);

  // Fetch active data source on mount
  useEffect(() => {
    fetchActiveDataSource();
  }, []);

  /**
   * Fetch the active data source from the API
   */
  const fetchActiveDataSource = async () => {
    try {
      const response = await fetch('/api/datasource/active');
      if (response.ok) {
        const data = await response.json();
        setActiveDataSource(data.name || 'pangolin');
      }
    } catch (error) {
      console.error('Failed to fetch active data source:', error);
      // Default to pangolin if there's an error
      setActiveDataSource('pangolin');
    }
  };

  /**
   * Navigate to a different page
   *
   * @param {string} pageId - Page identifier
   * @param {string|null} id - Optional resource, middleware, or service ID
   */
  const navigateTo = (pageId, id = null) => {
    setPage(pageId);

    if (pageId === 'resource-detail') {
      setResourceId(id);
      setMiddlewareId(null);
      setServiceId(null); // Reset serviceId
      setIsEditing(false);
    } else if (pageId === 'middleware-form') {
      setMiddlewareId(id);
      setResourceId(null);
      setServiceId(null); // Reset serviceId
      setIsEditing(!!id);
    } else if (pageId === 'service-form') { // Add case for service form
      setServiceId(id);
      setResourceId(null);
      setMiddlewareId(null);
      setIsEditing(!!id); // Set editing based on ID presence
    } else {
      // Reset IDs for other pages
      setResourceId(null);
      setMiddlewareId(null);
      setServiceId(null); // Reset serviceId
      setIsEditing(false);
    }
  };

  // Create context value object
  const value = {
    page,
    resourceId,
    middlewareId,
    serviceId, // Include serviceId
    isEditing,
    isDarkMode,
    showSettings,
    activeDataSource,
    setIsDarkMode,
    setShowSettings,
    setActiveDataSource,
    navigateTo,
    fetchActiveDataSource
  };

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );
};

/**
 * Custom hook to use the app context
 *
 * @returns {Object} App context value
 */
export const useApp = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};