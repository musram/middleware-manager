// ui/src/components/resources/config/HeadersConfigModal.js
import React, { useState, useEffect } from 'react';

/**
 * HeadersConfigModal - A modal for configuring custom headers for a resource
 *
 * @param {Object} props
 * @param {Object} props.customHeaders - Current custom headers object
 * @param {Function} props.setCustomHeaders - Function to update headers in parent state (optional)
 * @param {Function} props.onSave - Function to save the changes (receives { custom_headers: object })
 * @param {Function} props.onClose - Function to close the modal
 * @param {boolean} props.isDisabled - Whether the resource is disabled
 */
const HeadersConfigModal = ({
  customHeaders: initialCustomHeaders = {},
  setCustomHeaders: setParentCustomHeaders, // Optional parent setter
  onSave,
  onClose,
  isDisabled // Receive disabled state
}) => {
  // Ensure initial state is always an object
  const [localCustomHeaders, setLocalCustomHeaders] = useState(initialCustomHeaders || {});
  const [headerKey, setHeaderKey] = useState('');
  const [headerValue, setHeaderValue] = useState('');
  const [saving, setSaving] = useState(false);

  // Sync local state if initial prop changes
  useEffect(() => {
    setLocalCustomHeaders(initialCustomHeaders || {});
  }, [initialCustomHeaders]);

  const handleAddHeader = (e) => {
    e.preventDefault(); // Prevent potential form submission if wrapped in form later
    if (!headerKey.trim()) {
      alert('Header name cannot be empty.');
      return;
    }
    const keyToAdd = headerKey.trim();
    const newHeaders = { ...localCustomHeaders, [keyToAdd]: headerValue };
    setLocalCustomHeaders(newHeaders);
    if (setParentCustomHeaders) {
      setParentCustomHeaders(newHeaders); // Update parent if function provided
    }
    // Reset form
    setHeaderKey('');
    setHeaderValue('');
  };

  const handleRemoveHeader = (keyToRemove) => {
    const { [keyToRemove]: _, ...remainingHeaders } = localCustomHeaders; // Exclude the key
    setLocalCustomHeaders(remainingHeaders);
    if (setParentCustomHeaders) {
      setParentCustomHeaders(remainingHeaders); // Update parent if function provided
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
     if (isDisabled) return; // Prevent saving if disabled

    setSaving(true);
    try {
      await onSave({ custom_headers: localCustomHeaders });
      onClose(); // Close only on successful save
    } catch (err) {
      alert('Failed to update custom headers');
      console.error('Update headers error:', err);
      // Keep modal open on error
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content max-w-xl"> {/* Increased max-width */}
        <div className="modal-header">
          <h3 className="modal-title">Custom Request Headers Configuration</h3>
          <button
            onClick={onClose}
            className="modal-close-button"
            disabled={saving}
            aria-label="Close"
          >
            &times;
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body space-y-6"> {/* Increased spacing */}
            {isDisabled && (
                <div className="mb-4 p-3 text-sm text-red-700 bg-red-100 dark:bg-red-900 dark:text-red-200 border border-red-300 dark:border-red-600 rounded-md">
                    Configuration cannot be changed while the resource is disabled.
                </div>
             )}
            <div>
              <label className="form-label">
                Custom Request Headers
              </label>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                Add or modify headers sent to the backend service. Common use: setting the <code className="text-xs font-mono bg-gray-100 dark:bg-gray-700 px-1 rounded">Host</code> header.
              </p>

              {/* Current headers list */}
              {Object.keys(localCustomHeaders).length > 0 ? (
                <div className="mb-4 border dark:border-gray-600 rounded p-3 max-h-48 overflow-y-auto">
                  <h4 className="text-sm font-semibold mb-2 text-gray-700 dark:text-gray-300">Current Headers:</h4>
                  <ul className="space-y-2">
                    {Object.entries(localCustomHeaders).map(([key, value]) => (
                      <li key={key} className="flex justify-between items-center text-sm border-b border-dashed dark:border-gray-700 pb-1 last:border-b-0">
                        <div className="font-mono text-gray-800 dark:text-gray-200 break-all">
                          <span className="font-medium">{key}:</span> {value || <span className="italic text-gray-400">(empty)</span>}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveHeader(key)}
                          className="ml-4 text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 text-xs"
                          disabled={saving || isDisabled}
                          aria-label={`Remove header ${key}`}
                        >
                          Remove
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 italic">No custom headers configured.</p>
              )}

              {/* Add new header form */}
              <div className="border dark:border-gray-600 rounded p-3 bg-gray-50 dark:bg-gray-800">
                <h4 className="text-sm font-semibold mb-2 text-gray-700 dark:text-gray-300">Add / Update Header</h4>
                <div className="flex items-center gap-2 mb-2">
                  <input
                    type="text"
                    value={headerKey}
                    onChange={(e) => setHeaderKey(e.target.value)}
                    placeholder="Header Name (e.g., Host)"
                    className="form-input flex-1"
                    disabled={saving || isDisabled}
                    aria-label="Header Name"
                  />
                  <input
                    type="text"
                    value={headerValue}
                    onChange={(e) => setHeaderValue(e.target.value)}
                    placeholder="Header Value"
                    className="form-input flex-1"
                    disabled={saving || isDisabled}
                    aria-label="Header Value"
                  />
                  <button
                    type="button"
                    onClick={handleAddHeader}
                    className="btn btn-secondary px-3 py-2 text-sm" // Smaller padding
                    disabled={saving || !headerKey.trim() || isDisabled}
                    aria-label="Add or Update Header"
                  >
                    Set
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary"
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary bg-yellow-600 hover:bg-yellow-700 dark:bg-yellow-500 dark:hover:bg-yellow-600 border-yellow-600 dark:border-yellow-500" // Specific styling for Headers
              disabled={saving || isDisabled}
            >
              {saving ? 'Saving...' : 'Save Headers'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default HeadersConfigModal;