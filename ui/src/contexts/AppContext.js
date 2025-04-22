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
  const [isEditing, setIsEditing] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);

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

  /**
   * Navigate to a different page
   * 
   * @param {string} pageId - Page identifier
   * @param {string|null} id - Optional resource or middleware ID
   */
  const navigateTo = (pageId, id = null) => {
    setPage(pageId);
    
    if (pageId === 'resource-detail') {
      setResourceId(id);
      setMiddlewareId(null);
      setIsEditing(false);
    } else if (pageId === 'middleware-form') {
      setMiddlewareId(id);
      setResourceId(null);
      setIsEditing(!!id);
    } else {
      // Reset IDs for other pages
      setResourceId(null);
      setMiddlewareId(null);
      setIsEditing(false);
    }
  };

  // Create context value object
  const value = {
    page,
    resourceId,
    middlewareId,
    isEditing,
    isDarkMode,
    setIsDarkMode,
    navigateTo
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