import React, { useEffect } from 'react';
import { useResources } from '../../contexts/ResourceContext';
import { useMiddlewares } from '../../contexts/MiddlewareContext';
import { LoadingSpinner, ErrorMessage } from '../common';
import { MiddlewareUtils } from '../../services/api';
import StatCard from './StatCard';
import ResourceSummary from './ResourceSummary';

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
    fetchResources
  } = useResources();
  
  const { 
    middlewares, 
    loading: middlewaresLoading,
    error: middlewaresError, 
    fetchMiddlewares
  } = useMiddlewares();

  // Refresh data when the dashboard is mounted
  useEffect(() => {
    fetchResources();
    fetchMiddlewares();
  }, [fetchResources, fetchMiddlewares]);

  // Show loading state while fetching data
  if (resourcesLoading || middlewaresLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-12">
        <LoadingSpinner 
          size="lg" 
          message="Initializing Middleware Manager"
        />
      </div>
    );
  }

  // Show error state if there was an error
  if (resourcesError || middlewaresError) {
    return (
      <ErrorMessage 
        message="Error Loading Dashboard" 
        details={resourcesError || middlewaresError}
        onRetry={() => {
          fetchResources();
          fetchMiddlewares();
        }}
      />
    );
  }

  // Calculate statistics for dashboard
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
        <StatCard
          title="Resources"
          value={activeResources}
          subtitle={disabledResources > 0 ? `${disabledResources} disabled resources` : null}
        />
        <StatCard
          title="Middlewares"
          value={middlewares.length}
        />
        <StatCard
          title="Protected Resources"
          value={`${protectedResources} / ${activeResources}`}
          status={
            protectedResources === 0 ? 'danger' : 
            protectedResources < activeResources ? 'warning' : 'success'
          }
        />
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
              {resources.slice(0, 5).map((resource) => (
                <ResourceSummary 
                  key={resource.id}
                  resource={resource}
                  onView={() => navigateTo('resource-detail', resource.id)}
                  onDelete={fetchResources}
                />
              ))}
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
                <button
                  className="underline"
                  onClick={() => navigateTo('resources')}
                >
                  View all resources
                </button>{' '}
                to delete them.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;