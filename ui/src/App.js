// ui/src/App.js
import React from 'react';
import { AppProvider, useApp } from './contexts/AppContext';
import { ResourceProvider } from './contexts/ResourceContext';
import { MiddlewareProvider } from './contexts/MiddlewareContext';
import { DataSourceProvider } from './contexts/DataSourceContext';
import { ServiceProvider } from './contexts/ServiceContext';
import { PluginProvider } from './contexts/PluginContext';
import { Header } from './components/common';

// Import page components
import Dashboard from './components/dashboard/Dashboard';
import ResourcesList from './components/resources/ResourcesList';
import ResourceDetail from './components/resources/ResourceDetail';
import MiddlewaresList from './components/middlewares/MiddlewaresList';
import MiddlewareForm from './components/middlewares/MiddlewareForm';
import ServicesList from './components/services/ServicesList';
import ServiceForm from './components/services/ServiceForm';
import DataSourceSettings from './components/settings/DataSourceSettings';
import PluginHub from './components/plugins/PluginHub'; // Import PluginHub component

/**
 * Main application component that renders the current page
 * based on the navigation state
 */
const MainContent = () => {
  const {
    page,
    resourceId,
    middlewareId,
    serviceId,
    isEditing,
    navigateTo,
    isDarkMode, // Still needed for Header toggle state
    setIsDarkMode, // Still needed for Header toggle state
    showSettings,
    setShowSettings
  } = useApp();

  // Render the active page based on state
  const renderPage = () => {
    // Render settings panel overlay if active
    if (showSettings) {
      return (
      // Using Tailwind classes for the overlay directly
      <div className="fixed inset-0 bg-black bg-opacity-60 dark:bg-opacity-80 flex items-center justify-center z-50 p-4 overflow-y-auto">
        {/* Removed max-h-screen, relying on modal's internal scroll */}
        <div className="w-full max-w-3xl">
          {/* DataSourceSettings now acts as the modal content */}
          <DataSourceSettings onClose={() => setShowSettings(false)} />
        </div>
      </div>
      );
    }

    // Otherwise, render the current page
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
        case 'services':
        return <ServicesList navigateTo={navigateTo} />;
      case 'service-form':
        return (
          <ServiceForm
            // id={serviceId} // ID and isEditing are now read from context in ServiceForm
            navigateTo={navigateTo}
          />
        );
        case 'plugin-hub': // Add case for Plugin Hub
        return <PluginHub navigateTo={navigateTo} />;
      default:
        return <Dashboard navigateTo={navigateTo} />;
    }
  };

  return (
    // Body background is now controlled by CSS variables via the <html> class
    // This div provides min-height and potential future layout structure
    <div className="min-h-screen flex flex-col">
      <Header
        currentPage={page}
        navigateTo={navigateTo}
        isDarkMode={isDarkMode}
        setIsDarkMode={setIsDarkMode}
        openSettings={() => setShowSettings(true)}
      />
      {/* Main content area */}
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 flex-grow">
        {renderPage()}
      </main>
      {/* Footer can be added here */}
    </div>
  );
};

/**
 * Application root component with all providers
 */
const App = () => {
  return (
    <AppProvider>
      <DataSourceProvider>
        <ResourceProvider>
          <MiddlewareProvider>
            <ServiceProvider>
            <PluginProvider> {/* Add PluginProvider */}
              <MainContent />
            </PluginProvider>
            </ServiceProvider>
          </MiddlewareProvider>
        </ResourceProvider>
      </DataSourceProvider>
    </AppProvider>
  );
};

export default App;