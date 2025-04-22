import React, { useState, useEffect } from 'react';

/**
 * HeadersConfigModal - A modal for configuring custom headers for a resource
 * 
 * @param {Object} props
 * @param {Object} props.resource - The resource being configured
 * @param {Function} props.onSave - Function to call with updated headers data
 * @param {Function} props.onClose - Function to close the modal
 */
const HeadersConfigModal = ({ resource, onSave, onClose }) => {
  const [customHeaders, setCustomHeaders] = useState({});
  const [headerKey, setHeaderKey] = useState('');
  const [headerValue, setHeaderValue] = useState('');

  // Initialize custom headers from resource data
  useEffect(() => {
    if (resource && resource.custom_headers) {
      try {
        const parsedHeaders = 
          typeof resource.custom_headers === 'string' 
            ? JSON.parse(resource.custom_headers) 
            : resource.custom_headers;
        
        setCustomHeaders(parsedHeaders || {});
      } catch (e) {
        console.error("Error parsing custom headers:", e);
        setCustomHeaders({});
      }
    } else {
      setCustomHeaders({});
    }
  }, [resource]);

  // Function to add new header
  const addHeader = () => {
    if (!headerKey.trim()) {
      alert('Header key cannot be empty');
      return;
    }
    
    setCustomHeaders({
      ...customHeaders,
      [headerKey]: headerValue
    });
    
    setHeaderKey('');
    setHeaderValue('');
  };

  // Function to remove header
  const removeHeader = (key) => {
    const newHeaders = {...customHeaders};
    delete newHeaders[key];
    setCustomHeaders(newHeaders);
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      await onSave({ custom_headers: customHeaders });
      onClose();
    } catch (err) {
      alert('Failed to update custom headers');
      console.error('Update headers error:', err);
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-md">
        <div className="flex justify-between items-center px-6 py-4 border-b">
          <h3 className="text-lg font-semibold">Custom Headers Configuration</h3>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            ×
          </button>
        </div>
        <div className="px-6 py-4">
          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <label className="block text-gray-700 text-sm font-bold mb-2">
                Custom Request Headers
              </label>
              
              {/* Current headers list */}
              {Object.keys(customHeaders).length > 0 ? (
                <div className="mb-4 border rounded p-3">
                  <h4 className="text-sm font-semibold mb-2">Current Headers</h4>
                  <ul className="space-y-2">
                    {Object.entries(customHeaders).map(([key, value]) => (
                      <li key={key} className="flex justify-between items-center">
                        <div>
                          <span className="font-medium">{key}:</span> {value}
                        </div>
                        <button
                          type="button"
                          onClick={() => removeHeader(key)}
                          className="text-red-600 hover:text-red-800"
                        >
                          Remove
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="text-sm text-gray-500 mb-4">No custom headers configured.</p>
              )}
              
              {/* Add new header */}
              <div className="border rounded p-3">
                <h4 className="text-sm font-semibold mb-2">Add New Header</h4>
                <div className="grid grid-cols-5 gap-2 mb-2">
                  <div className="col-span-2">
                    <input
                      type="text"
                      value={headerKey}
                      onChange={(e) => setHeaderKey(e.target.value)}
                      placeholder="Header name"
                      className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="col-span-2">
                    <input
                      type="text"
                      value={headerValue}
                      onChange={(e) => setHeaderValue(e.target.value)}
                      placeholder="Header value"
                      className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="col-span-1">
                    <button
                      type="button"
                      onClick={addHeader}
                      className="w-full px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                    >
                      Add
                    </button>
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Common examples: Host, X-Forwarded-Host
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  <strong>Host</strong>: To modify the hostname sent to the backend service
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  <strong>X-Forwarded-Host</strong>: To pass the original hostname to the backend
                </p>
              </div>
            </div>
            
            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700"
              >
                Save Headers
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default HeadersConfigModal;