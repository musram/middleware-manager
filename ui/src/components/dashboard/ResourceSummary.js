// ui/src/components/dashboard/ResourceSummary.js
import React from 'react';
import { useResources } from '../../contexts/ResourceContext';
import { MiddlewareUtils } from '../../services/api';

/**
 * ResourceSummary component for displaying a resource row in the dashboard
 *
 * @param {Object} props
 * @param {Object} props.resource - Resource data
 * @param {Function} props.onView - Function to handle viewing the resource
 * @param {Function} props.onDelete - Function to call after successful deletion
 * @returns {JSX.Element}
 */
const ResourceSummary = ({ resource, onView, onDelete }) => {
  const { deleteResource } = useResources();

  // Parse middlewares from the resource
  const middlewaresList = MiddlewareUtils.parseMiddlewares(resource.middlewares);
  const isProtected = middlewaresList.length > 0;
  const isDisabled = resource.status === 'disabled';

  /**
   * Handle resource deletion with confirmation
   */
  const handleDelete = async () => {
    if (
      window.confirm(
        `Are you sure you want to delete the resource "${resource.host}"? This cannot be undone.`
      )
    ) {
      const success = await deleteResource(resource.id);
      if (success && onDelete) {
        onDelete(); // Notify parent component about the deletion
      }
    }
  };

  return (
    <tr className={isDisabled ? 'bg-gray-100 dark:bg-gray-800 opacity-70' : 'hover:bg-gray-50 dark:hover:bg-gray-700'}>
      {/* Host */}
      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">
        {resource.host}
        {isDisabled && (
          <span className="ml-2 badge badge-error">Disabled</span>
        )}
      </td>

      {/* Status */}
      <td className="px-6 py-4 whitespace-nowrap">
        <span
          className={`badge ${
            isDisabled ? 'badge-neutral' : isProtected ? 'badge-success' : 'badge-warning'
          }`}
        >
          {isDisabled ? 'Disabled' : isProtected ? 'Protected' : 'Not Protected'}
        </span>
      </td>

      {/* Middlewares Count */}
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
        {middlewaresList.length > 0 ? middlewaresList.length : '0'}
      </td>

      {/* Actions */}
      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-3">
        <button
          onClick={onView}
          className="btn-link text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
        >
          {isDisabled ? 'View' : 'Manage'}
        </button>
        {isDisabled && (
          <button
            onClick={handleDelete}
            className="btn-link text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300"
          >
            Delete
          </button>
        )}
      </td>
    </tr>
  );
};

export default ResourceSummary;