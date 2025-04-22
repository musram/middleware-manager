import React from 'react';
import { AppProvider, useApp } from './contexts/AppContext';
import { ResourceProvider } from './contexts/ResourceContext';
import { MiddlewareProvider } from './contexts/MiddlewareContext';
import { Header } from './components/common';

// Import page components (these would be created as separate files)
import Dashboard from './components/dashboard/Dashboard';
import ResourcesList from './components/resources/ResourcesList';
import ResourceDetail from './components/resources/ResourceDetail';
import MiddlewaresList from './components/middlewares/MiddlewaresList';
import MiddlewareForm from './components/middlewares/MiddlewareForm';

/**
 * Main application component that renders the current page
 * based on the navigation state
 */
const MainContent = () => {
  const { page, resourceId, middlewareId, isEditing, navigateTo } = useApp();

  // Render the active page based on state
  const renderPage = () => {
    switch (page) {
      case 'dashboard':
        return <Dashboard navigateTo={navigateTo} />;
      case 'resources':
        return <ResourcesList navigateTo={navigateTo} />;
      case 'resource-detail':
        return <ResourceDetail id={resourceId} navigateTo={navigateTo} />;
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
      <Header 
        currentPage={page} 
        navigateTo={navigateTo} 
      />
      <main className="container mx-auto px-6 py-6">
        {renderPage()}
      </main>
    </div>
  );
};

/**
 * Application root component with all providers
 */
const App = () => {
  return (
    <AppProvider>
      <ResourceProvider>
        <MiddlewareProvider>
          <MainContent />
        </MiddlewareProvider>
      </ResourceProvider>
    </AppProvider>
  );
};

export default App;