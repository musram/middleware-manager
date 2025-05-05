// ui/src/components/resources/config/HTTPConfigModal.js
import React, { useState, useEffect } from 'react';

/**
 * HTTP Configuration Modal for managing resource entrypoints
 * @param {Object} props
 * @param {string} props.entrypoints - Current entrypoints string
 * @param {Function} props.setEntrypoints - Function to update entrypoints in parent state (optional, for live updates)
 * @param {Function} props.onSave - Save handler function (receives { entrypoints: string })
 * @param {Function} props.onClose - Close modal handler
 * @param {boolean} props.isDisabled - Whether the resource is disabled
 */
const HTTPConfigModal = ({
  entrypoints: initialEntrypoints,
  setEntrypoints: setParentEntrypoints, // Optional parent state setter
  onSave,
  onClose,
  isDisabled // Receive disabled state
}) => {
  const [localEntrypoints, setLocalEntrypoints] = useState(initialEntrypoints || 'websecure');
  const [saving, setSaving] = useState(false);

  // Sync local state if initial prop changes
  useEffect(() => {
    setLocalEntrypoints(initialEntrypoints || 'websecure');
  }, [initialEntrypoints]);

  const handleInputChange = (e) => {
    setLocalEntrypoints(e.target.value);
    // Optionally update parent state live
    if (setParentEntrypoints) {
      setParentEntrypoints(e.target.value);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isDisabled) return; // Prevent saving if disabled

    setSaving(true);
    try {
      await onSave({ entrypoints: localEntrypoints || 'websecure' }); // Ensure default if empty
      onClose(); // Close only on successful save
    } catch (err) {
      alert('Failed to update HTTP configuration');
      console.error('HTTP config update error:', err);
      // Keep modal open on error
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <h3 className="modal-title">HTTP Router Configuration</h3>
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
          <div className="modal-body">
            {isDisabled && (
              <div className="mb-4 p-3 text-sm text-red-700 bg-red-100 dark:bg-red-900 dark:text-red-200 border border-red-300 dark:border-red-600 rounded-md">
                  Configuration cannot be changed while the resource is disabled.
              </div>
            )}
            <div className="mb-4">
              <label htmlFor="http-entrypoints" className="form-label">
                HTTP Entry Points (comma-separated)
              </label>
              <input
                id="http-entrypoints"
                type="text"
                value={localEntrypoints}
                onChange={handleInputChange}
                className="form-input"
                placeholder="websecure,metrics"
                required
                disabled={saving || isDisabled} // Disable input if saving or resource is disabled
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Standard: websecure (HTTPS), web (HTTP). Default: websecure.
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                <strong>Note:</strong> Must match entrypoints defined in Traefik static configuration.
              </p>
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
              className="btn btn-primary"
              disabled={saving || isDisabled} // Disable save button if saving or resource is disabled
            >
              {saving ? 'Saving...' : 'Save Configuration'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default HTTPConfigModal;