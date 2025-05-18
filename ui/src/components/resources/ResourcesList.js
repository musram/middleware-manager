// ui/src/components/resources/ResourcesList.js
import React, { useEffect, useState } from 'react';
import { useResources } from '../../contexts/ResourceContext'; // Corrected path if necessary
import { LoadingSpinner, ErrorMessage, ConfirmationModal } from '../common'; // Ensure ConfirmationModal is imported
import { MiddlewareUtils } from '../../services/api';

const ResourcesList = ({ navigateTo }) => {
  const {
    resources,
    loading,
    error,
    fetchResources,
    deleteResource,
    setError
  } = useResources();

  const [searchTerm, setSearchTerm] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [resourceToDelete, setResourceToDelete] = useState(null);

  useEffect(() => {
    fetchResources();
  }, [fetchResources]);

  const confirmDelete = (resource) => {
    setResourceToDelete(resource);
    setShowDeleteModal(true);
    if (setError) setError(null);
  };

  const handleDeleteConfirmed = async () => {
    if (!resourceToDelete) return;
    const success = await deleteResource(resourceToDelete.id);
    if (success) {
      setShowDeleteModal(false);
      setResourceToDelete(null);
    }
    // Error is handled by context
  };

  const cancelDelete = () => {
    setShowDeleteModal(false);
    setResourceToDelete(null);
    if (setError) setError(null);
  };

  // Create a guarded version of resources
  const safeResources = resources || [];

  const filteredResources = safeResources.filter((resource) =>
    resource && resource.host && typeof resource.host === 'string' && // Add checks for resource and resource.host
    resource.host.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Use safeResources for the loading check as well
  if (loading && safeResources.length === 0) {
    return <LoadingSpinner message="Loading resources..." />;
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6 text-gray-900 dark:text-gray-100">Resources</h1> {/* Ensure text color for dark mode */}

      {error && !showDeleteModal && (
        <ErrorMessage
          message={error} // Display the actual error message from context
          // details={error.details || "Could not fetch the list of resources."} // Optional: provide more details
          onRetry={fetchResources}
          onDismiss={() => setError && setError(null)}
        />
      )}

      <div className="mb-6 flex flex-col sm:flex-row justify-between items-center gap-4">
        <div className="relative w-full sm:w-64">
         <label htmlFor="resource-search-list" className="sr-only">Search Resources</label>
          <input
            id="resource-search-list"
            type="text"
            placeholder="Search resources by host..."
            className="form-input w-full" // Use form-input for consistent styling
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
         <div className="flex space-x-3 w-full sm:w-auto">
            <button
              onClick={fetchResources}
              className="btn btn-secondary flex-1 sm:flex-none" // Use btn classes
              disabled={loading}
            >
              {loading ? 'Refreshing...' : 'Refresh'}
            </button>
            {/* If there was a create resource button, it would go here */}
         </div>
      </div>

      <div className="card overflow-hidden"> {/* Use card class */}
        <div className="overflow-x-auto">
          <table className="table min-w-full"> {/* Use table class */}
            <thead>
              <tr>
                {/* Apply dark mode text color to headers */}
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Host
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Middlewares
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {filteredResources.map((resource) => {
                // Ensure r.middlewares is a string before parsing
                const middlewaresList = resource.middlewares && typeof resource.middlewares === 'string'
                                        ? MiddlewareUtils.parseMiddlewares(resource.middlewares)
                                        : [];
                const isProtected = middlewaresList.length > 0;
                const isDisabled = resource.status === 'disabled';

                return (
                  <tr
                    key={resource.id}
                    className={`${isDisabled ? 'bg-gray-100 dark:bg-gray-700 opacity-70' : 'hover:bg-gray-50 dark:hover:bg-gray-600'}`}
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">
                      {resource.host}
                      {isDisabled && (
                        <span className="ml-2 badge badge-error">
                           Disabled
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`badge ${
                          isDisabled
                            ? 'badge-neutral' // More appropriate for disabled
                            : isProtected
                            ? 'badge-success'
                            : 'badge-warning'
                        }`}
                      >
                        {isDisabled
                          ? 'Disabled'
                          : isProtected
                          ? 'Protected'
                          : 'Not Protected'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                      {middlewaresList.length > 0
                        ? middlewaresList.length
                        : '0'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2"> {/* Use space-x-2 for btn links */}
                      <button
                        onClick={() => navigateTo('resource-detail', resource.id)}
                        className="btn-link text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
                      >
                        {isDisabled ? 'View' : 'Manage'}
                      </button>
                      {isDisabled && (
                        <button
                          onClick={() => confirmDelete(resource)}
                          className="btn-link text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300"
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
                    className="px-6 py-4 text-center text-gray-500 dark:text-gray-400"
                  >
                    {safeResources.length === 0 ? "No resources found." : "No resources match your search."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ConfirmationModal
        show={showDeleteModal && !!resourceToDelete}
        title="Confirm Deletion"
        message={`Are you sure you want to delete the resource "${resourceToDelete?.host}"?`}
        details={resourceToDelete?.status === 'disabled' ? "This action cannot be undone." : "Resource must be disabled first. This action cannot be undone."}
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={handleDeleteConfirmed}
        onCancel={cancelDelete}
      />
    </div>
  );
};

export default ResourcesList;