// ui/src/components/resources/config/TLSConfigModal.js
import React, { useState, useEffect } from 'react';

/**
 * TLS Configuration Modal for managing certificate domains
 * @param {Object} props
 * @param {Object} props.resource - Resource data (used for hostname display)
 * @param {string} props.tlsDomains - Current TLS domains string
 * @param {Function} props.setTLSDomains - Function to update TLS domains in parent (optional)
 * @param {Function} props.onSave - Save handler function (receives { tls_domains: string })
 * @param {Function} props.onClose - Close modal handler
 * @param {boolean} props.isDisabled - Whether the resource is disabled
 */
const TLSConfigModal = ({
  resource,
  tlsDomains: initialTlsDomains,
  setTLSDomains: setParentTLSDomains, // Optional parent state setter
  onSave,
  onClose,
  isDisabled // Receive disabled state
}) => {
  const [localTlsDomains, setLocalTlsDomains] = useState(initialTlsDomains || '');
  const [saving, setSaving] = useState(false);

  // Sync local state if initial prop changes
  useEffect(() => {
    setLocalTlsDomains(initialTlsDomains || '');
  }, [initialTlsDomains]);

  const handleInputChange = (e) => {
    setLocalTlsDomains(e.target.value);
    if (setParentTLSDomains) {
      setParentTLSDomains(e.target.value);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
     if (isDisabled) return; // Prevent saving if disabled

    setSaving(true);
    try {
      await onSave({ tls_domains: localTlsDomains });
      onClose(); // Close only on successful save
    } catch (err) {
      alert('Failed to update TLS certificate domains');
      console.error('TLS config update error:', err);
      // Keep modal open on error
    } finally {
      setSaving(false);
    }
  };

  // Get the host from resource or fallback
  const hostName = resource?.host || 'this domain';

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <h3 className="modal-title">TLS Certificate Domains</h3>
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
              <label htmlFor="tls-domains" className="form-label">
                Additional Certificate Domains (SANs)
              </label>
              <input
                id="tls-domains"
                type="text"
                value={localTlsDomains}
                onChange={handleInputChange}
                className="form-input"
                placeholder="e.g., www.example.com, othersite.com"
                disabled={saving || isDisabled}
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Comma-separated list of extra domains for the TLS certificate.
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                The main domain (<code className="text-xs font-mono bg-gray-100 dark:bg-gray-700 px-1 rounded">{hostName}</code>) is included automatically.
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
              className="btn btn-primary bg-green-600 hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600 border-green-600 dark:border-green-500" // Specific styling for TLS
              disabled={saving || isDisabled}
            >
              {saving ? 'Saving...' : 'Save Certificate Domains'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TLSConfigModal;