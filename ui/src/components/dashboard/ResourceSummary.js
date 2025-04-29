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
      if (success) {
        // Notify parent component about the deletion
        if (onDelete) onDelete();
      }
    }
  };

  return (
    <tr className={isDisabled ? 'bg-gray-100' : ''}>
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
          onClick={onView}
          className="text-blue-600 hover:text-blue-900 mr-3"
        >
          {isDisabled ? 'View' : 'Manage'}
        </button>
        {isDisabled && (
          <button
            onClick={handleDelete}
            className="text-red-600 hover:text-red-900"
          >
            Delete
          </button>
        )}
      </td>
    </tr>
  );
};

export default ResourceSummary;