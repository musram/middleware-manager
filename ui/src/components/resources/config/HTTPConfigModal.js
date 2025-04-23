import React, { useState, useEffect } from 'react';

/**
 * HTTP Configuration Modal for managing resource entrypoints
 * @param {Object} props
 * @param {Object} props.resource - Resource data
 * @param {string} props.entrypoints - Current entrypoints string
 * @param {Function} props.setEntrypoints - Function to update entrypoints
 * @param {Function} props.onSave - Save handler function
 * @param {Function} props.onClose - Close modal handler
 */
const HTTPConfigModal = ({ resource, entrypoints, setEntrypoints, onSave, onClose }) => {
  const [localEntrypoints, setLocalEntrypoints] = useState(entrypoints || 'websecure');
  const [saving, setSaving] = useState(false);
  
  // Initialize from props when they change
  useEffect(() => {
    if (entrypoints) {
      setLocalEntrypoints(entrypoints);
    }
  }, [entrypoints]);
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      setSaving(true);
      // Update parent state first
      setEntrypoints(localEntrypoints);
      // Then save
      await onSave({ entrypoints: localEntrypoints });
      onClose();
    } catch (err) {
      alert('Failed to update HTTP configuration');
      console.error('HTTP config update error:', err);
    } finally {
      setSaving(false);
    }
  };
  
  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-md">
        <div className="flex justify-between items-center px-6 py-4 border-b">
          <h3 className="text-lg font-semibold">HTTP Router Configuration</h3>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
            disabled={saving}
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <div className="px-6 py-4">
          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <label className="block text-gray-700 text-sm font-bold mb-2">
                HTTP Entry Points (comma-separated)
              </label>
              <input
                type="text"
                value={localEntrypoints}
                onChange={(e) => setLocalEntrypoints(e.target.value)}
                className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="websecure,metrics,api"
                required
                disabled={saving}
              />
              <p className="text-xs text-gray-500 mt-1">
                Standard entrypoints: websecure (HTTPS), web (HTTP). Default: websecure
              </p>
              <p className="text-xs text-gray-500 mt-1">
                <strong>Note:</strong> Entrypoints must be defined in your Traefik static configuration file
              </p>
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
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                disabled={saving}
              >
                {saving ? 'Saving...' : 'Save Configuration'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default HTTPConfigModal;