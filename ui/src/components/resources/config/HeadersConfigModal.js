import React, { useState, useEffect } from 'react';

/**
 * HeadersConfigModal - A modal for configuring custom headers for a resource
 * 
 * @param {Object} props
 * @param {Object} props.resource - The resource being configured
 * @param {Object} props.customHeaders - Current custom headers
 * @param {Function} props.setCustomHeaders - Function to update custom headers
 * @param {string} props.headerKey - Current header key in the form
 * @param {Function} props.setHeaderKey - Function to update header key
 * @param {string} props.headerValue - Current header value in the form
 * @param {Function} props.setHeaderValue - Function to update header value
 * @param {Function} props.addHeader - Function to add a header
 * @param {Function} props.removeHeader - Function to remove a header
 * @param {Function} props.onSave - Function to save the changes
 * @param {Function} props.onClose - Function to close the modal
 */
const HeadersConfigModal = ({ 
  resource, 
  customHeaders = {}, 
  setCustomHeaders, 
  headerKey,
  setHeaderKey,
  headerValue,
  setHeaderValue,
  addHeader,
  removeHeader,
  onSave, 
  onClose 
}) => {
  const [localCustomHeaders, setLocalCustomHeaders] = useState({});
  const [localHeaderKey, setLocalHeaderKey] = useState('');
  const [localHeaderValue, setLocalHeaderValue] = useState('');
  const [saving, setSaving] = useState(false);
  
  // Initialize local state from props
  useEffect(() => {
    // Ensure we have an object even if customHeaders is null/undefined
    const headers = customHeaders || {};
    setLocalCustomHeaders(headers);
    
    // Initialize form fields if passed
    if (headerKey !== undefined) setLocalHeaderKey(headerKey);
    if (headerValue !== undefined) setLocalHeaderValue(headerValue);
    
    console.log("HeadersConfigModal initialized with:", headers);
  }, [customHeaders, headerKey, headerValue]);

  // Local function to add a header
  const handleAddHeader = () => {
    if (!localHeaderKey.trim()) {
      alert('Header key cannot be empty');
      return;
    }
    
    const updatedHeaders = {
      ...localCustomHeaders,
      [localHeaderKey]: localHeaderValue
    };
    
    setLocalCustomHeaders(updatedHeaders);
    
    // If parent component provided these functions, call them
    if (setCustomHeaders) setCustomHeaders(updatedHeaders);
    if (addHeader) addHeader();
    
    // Reset form
    setLocalHeaderKey('');
    setLocalHeaderValue('');
    
    // Update parent component state if no addHeader function was provided
    if (!addHeader && setHeaderKey) setHeaderKey('');
    if (!addHeader && setHeaderValue) setHeaderValue('');
  };

  // Local function to remove a header
  const handleRemoveHeader = (key) => {
    const updatedHeaders = {...localCustomHeaders};
    delete updatedHeaders[key];
    
    setLocalCustomHeaders(updatedHeaders);
    
    // If parent component provided these functions, call them
    if (setCustomHeaders) setCustomHeaders(updatedHeaders);
    if (removeHeader) removeHeader(key);
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      setSaving(true);
      
      // Make sure parent component state is updated
      if (setCustomHeaders) setCustomHeaders(localCustomHeaders);
      
      // Call the save function
      await onSave({ custom_headers: localCustomHeaders });
      
      // Close the modal on success
      onClose();
    } catch (err) {
      alert('Failed to update custom headers');
      console.error('Update headers error:', err);
    } finally {
      setSaving(false);
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
            disabled={saving}
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
              {Object.keys(localCustomHeaders).length > 0 ? (
                <div className="mb-4 border rounded p-3">
                  <h4 className="text-sm font-semibold mb-2">Current Headers</h4>
                  <ul className="space-y-2">
                    {Object.entries(localCustomHeaders).map(([key, value]) => (
                      <li key={key} className="flex justify-between items-center">
                        <div>
                          <span className="font-medium">{key}:</span> {value}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveHeader(key)}
                          className="text-red-600 hover:text-red-800"
                          disabled={saving}
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
                      value={setHeaderKey ? headerKey : localHeaderKey}
                      onChange={(e) => {
                        if (setHeaderKey) setHeaderKey(e.target.value);
                        setLocalHeaderKey(e.target.value);
                      }}
                      placeholder="Header name"
                      className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                      disabled={saving}
                    />
                  </div>
                  <div className="col-span-2">
                    <input
                      type="text"
                      value={setHeaderValue ? headerValue : localHeaderValue}
                      onChange={(e) => {
                        if (setHeaderValue) setHeaderValue(e.target.value);
                        setLocalHeaderValue(e.target.value);
                      }}
                      placeholder="Header value"
                      className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                      disabled={saving}
                    />
                  </div>
                  <div className="col-span-1">
                    <button
                      type="button"
                      onClick={addHeader || handleAddHeader}
                      className="w-full px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                      disabled={saving || !(setHeaderKey ? headerKey : localHeaderKey).trim()}
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
                disabled={saving}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700"
                disabled={saving}
              >
                {saving ? 'Saving...' : 'Save Headers'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default HeadersConfigModal;