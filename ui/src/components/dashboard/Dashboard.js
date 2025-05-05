// ui/src/components/dashboard/Dashboard.js
import React, { useEffect } from 'react';
import { useResources } from '../../contexts/ResourceContext';
import { useMiddlewares } from '../../contexts/MiddlewareContext';
import { useServices } from '../../contexts/ServiceContext'; // Import useServices
import { LoadingSpinner, ErrorMessage } from '../common';
import { MiddlewareUtils } from '../../services/api';
import StatCard from './StatCard';
import ResourceSummary from './ResourceSummary';
import { useApp } from '../../contexts/AppContext'; // Import useApp

/**
 * Dashboard component that shows system overview
 *
 * @param {Object} props
 * @param {function} props.navigateTo - Navigation function
 * @returns {JSX.Element}
 */
const Dashboard = ({ navigateTo }) => {
  const {
    resources,
    loading: resourcesLoading,
    error: resourcesError,
    fetchResources,
    setError: setResourcesError // Get setError
  } = useResources();

  const {
    middlewares,
    loading: middlewaresLoading,
    error: middlewaresError,
    fetchMiddlewares,
    setError: setMiddlewaresError // Get setError
  } = useMiddlewares();

  const {
    services,
    loading: servicesLoading,
    error: servicesError,
    loadServices,
    setError: setServicesError // Get setError
  } = useServices();

  const { activeDataSource } = useApp(); // Get active data source name

  // Refresh data when the dashboard is mounted or data source changes
  useEffect(() => {
    fetchResources();
    fetchMiddlewares();
    loadServices();
  }, [fetchResources, fetchMiddlewares, loadServices, activeDataSource]); // Add activeDataSource dependency


  const loading = resourcesLoading || middlewaresLoading || servicesLoading;
  const error = resourcesError || middlewaresError || servicesError;

  const clearError = () => {
    if (resourcesError) setResourcesError(null);
    if (middlewaresError) setMiddlewaresError(null);
    if (servicesError) setServicesError(null);
  };

  // Show loading state while fetching data
  if (loading && resources.length === 0 && middlewares.length === 0 && services.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12">
        <LoadingSpinner
          size="lg"
          message="Initializing Middleware Manager"
        />
      </div>
    );
  }

  // Show error state if there was an error fetching initial data
  if (error && resources.length === 0 && middlewares.length === 0 && services.length === 0) {
    return (
      <ErrorMessage
        message="Error Loading Dashboard"
        details={error} // Now just a string
        onRetry={() => {
          fetchResources();
          fetchMiddlewares();
          loadServices();
        }}
        onDismiss={clearError}
      />
    );
  }

  // Calculate statistics for dashboard
  const activeResources = resources.filter(r => r.status !== 'disabled');
  const disabledResourcesCount = resources.length - activeResources.length;
  const protectedResourcesCount = activeResources.filter(
    r => r.middlewares && MiddlewareUtils.parseMiddlewares(r.middlewares).length > 0
  ).length;
  const unprotectedResourcesCount = activeResources.length - protectedResourcesCount;
  const activeResourcesCount = activeResources.length;

  // Determine overall status based on unprotected resources
  let overallStatus = 'success';
  if (activeResourcesCount === 0) {
      overallStatus = 'neutral'; // Or 'info'
  } else if (protectedResourcesCount === 0) {
      overallStatus = 'danger';
  } else if (unprotectedResourcesCount > 0) {
      overallStatus = 'warning';
  }

  return (
    <div className="space-y-8"> {/* Add vertical spacing between sections */}
      <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Dashboard</h1>

      {/* Display inline error if data is already loaded */}
      {error && (
        <ErrorMessage
            message="An error occurred while fetching data"
            details={error}
            onDismiss={clearError}
        />
       )}

      {/* Stats Section */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Active Resources"
          value={activeResourcesCount}
          subtitle={disabledResourcesCount > 0 ? `${disabledResourcesCount} disabled` : 'All resources active'}
          icon="server"
        />
        <StatCard
          title="Middlewares"
          value={middlewares.length}
          icon="shield-check"
        />
         <StatCard
          title="Custom Services"
          value={services.length}
          icon="puzzle" // Example icon
        />
        <StatCard
          title="Protection Status"
          value={activeResourcesCount > 0 ? `${protectedResourcesCount} / ${activeResourcesCount}` : 'N/A'}
          subtitle="Protected / Active"
          status={overallStatus}
          icon="lock-closed"
        />
      </div>

      {/* Recent Resources Section */}
      <div className="card p-6"> {/* Use card class */}
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200">Recent Resources</h2>
          <button
            onClick={() => navigateTo('resources')}
            className="btn-link text-sm"
          >
            View All Resources
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="table min-w-full">
            <thead>
              <tr>
                <th>Host</th>
                <th>Status</th>
                <th>Middlewares</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {activeResources.slice(0, 5).map((resource) => (
                <ResourceSummary
                  key={resource.id}
                  resource={resource}
                  onView={() => navigateTo('resource-detail', resource.id)}
                  onDelete={fetchResources} // Refresh list on delete
                />
              ))}
              {activeResources.length === 0 && (
                <tr>
                  <td colSpan="4" className="py-4 text-center text-gray-500 dark:text-gray-400">
                    No active resources found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Alerts/Warnings Section */}
      <div className="space-y-4">
          {unprotectedResourcesCount > 0 && (
              <div className="p-4 rounded-md bg-yellow-50 dark:bg-yellow-900 border border-yellow-300 dark:border-yellow-700">
                <div className="flex">
                  <div className="flex-shrink-0">
                     {/* Warning Icon */}
                     <svg className="h-5 w-5 text-yellow-500 dark:text-yellow-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                       <path fillRule="evenodd" d="M8.485 3.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 3.495zM10 15.5a1 1 0 100-2 1 1 0 000 2zm-1.1-4.062l.25-4.5a.85.85 0 111.7 0l.25 4.5a.85.85 0 11-1.7 0z" clipRule="evenodd" />
                     </svg>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                      {unprotectedResourcesCount} active resource{unprotectedResourcesCount !== 1 ? 's are' : ' is'} not protected by any middleware.
                    </p>
                  </div>
                </div>
              </div>
            )}

          {disabledResourcesCount > 0 && (
            <div className="p-4 rounded-md bg-blue-50 dark:bg-blue-900 border border-blue-300 dark:border-blue-700">
              <div className="flex">
                <div className="flex-shrink-0">
                  {/* Info Icon */}
                   <svg className="h-5 w-5 text-blue-500 dark:text-blue-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                     <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2H9V9z" clipRule="evenodd" />
                   </svg>
                </div>
                <div className="ml-3 flex-1 md:flex md:justify-between">
                  <p className="text-sm text-blue-700 dark:text-blue-200">
                    {disabledResourcesCount} resource{disabledResourcesCount !== 1 ? 's are' : ' is'} currently disabled (not found in {activeDataSource}).
                  </p>
                  <p className="mt-3 text-sm md:mt-0 md:ml-6">
                    <button
                      onClick={() => navigateTo('resources')}
                      className="whitespace-nowrap font-medium text-blue-700 dark:text-blue-300 hover:text-blue-600 dark:hover:text-blue-200"
                    >
                      View Resources <span aria-hidden="true">&rarr;</span>
                    </button>
                  </p>
                </div>
              </div>
            </div>
          )}
      </div>
    </div>
  );
};

export default Dashboard;