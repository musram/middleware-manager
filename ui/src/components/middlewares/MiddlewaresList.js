import React, { useEffect, useState } from 'react';
import { useMiddlewares } from '../../contexts/MiddlewareContext';
import { LoadingSpinner, ErrorMessage } from '../common';

const MiddlewaresList = ({ navigateTo }) => {
  const {
    middlewares,
    loading,
    error,
    fetchMiddlewares,
    deleteMiddleware
  } = useMiddlewares();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [middlewareToDelete, setMiddlewareToDelete] = useState(null);

  useEffect(() => {
    fetchMiddlewares();
  }, [fetchMiddlewares]);

  const confirmDelete = (middleware) => {
    setMiddlewareToDelete(middleware);
    setShowDeleteModal(true);
  };

  const handleDeleteMiddleware = async () => {
    if (!middlewareToDelete) return;
    
    try {
      await deleteMiddleware(middlewareToDelete.id);
      setShowDeleteModal(false);
      setMiddlewareToDelete(null);
    } catch (err) {
      alert('Failed to delete middleware');
      console.error('Delete middleware error:', err);
    }
  };

  const cancelDelete = () => {
    setShowDeleteModal(false);
    setMiddlewareToDelete(null);
  };

  const filteredMiddlewares = middlewares.filter(
    (middleware) =>
      middleware.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      middleware.type.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading && !middlewares.length) {
    return <LoadingSpinner message="Loading middlewares..." />;
  }

  if (error) {
    return (
      <ErrorMessage 
        message="Failed to load middlewares" 
        details={error}
        onRetry={fetchMiddlewares}
      />
    );
  }

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
      
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Type
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredMiddlewares.map((middleware) => (
              <tr key={middleware.id}>
                <td className="px-6 py-4 whitespace-nowrap">
                  {middleware.name}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                    {middleware.type}
                    {middleware.type === 'chain' && " (Middleware Chain)"}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex justify-end space-x-2">
                    <button
                      onClick={() => navigateTo('middleware-form', middleware.id)}
                      className="text-blue-600 hover:text-blue-900 mr-3"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => confirmDelete(middleware)}
                      className="text-red-600 hover:text-red-900"
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

      {/* Delete Confirmation Modal */}
      {showDeleteModal && middlewareToDelete && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-md">
            <div className="px-6 py-4 border-b">
              <h3 className="text-lg font-semibold text-red-600">Confirm Deletion</h3>
            </div>
            <div className="px-6 py-4">
              <p className="mb-4">
                Are you sure you want to delete the middleware "{middlewareToDelete.name}"?
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

export default MiddlewaresList;