import React, { useState, useEffect } from 'react';

/**
 * TLS Configuration Modal for managing certificate domains
 * @param {Object} props
 * @param {Object} props.resource - Resource data
 * @param {string} props.tlsDomains - Current TLS domains string
 * @param {Function} props.setTLSDomains - Function to update TLS domains
 * @param {Function} props.onSave - Save handler function
 * @param {Function} props.onClose - Close modal handler
 */
const TLSConfigModal = ({ resource, tlsDomains, setTLSDomains, onSave, onClose }) => {
  const [localTlsDomains, setLocalTlsDomains] = useState(tlsDomains || '');
  const [saving, setSaving] = useState(false);
  
  // Initialize from props when they change
  useEffect(() => {
    setLocalTlsDomains(tlsDomains || '');
  }, [tlsDomains]);
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      setSaving(true);
      // Update parent state first
      setTLSDomains(localTlsDomains);
      // Then save
      await onSave({ tls_domains: localTlsDomains });
      onClose();
    } catch (err) {
      alert('Failed to update TLS certificate domains');
      console.error('TLS config update error:', err);
    } finally {
      setSaving(false);
    }
  };
  
  // Get the host from resource or fallback
  const hostName = resource && resource.host ? resource.host : 'this domain';
  
  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-md">
        <div className="flex justify-between items-center px-6 py-4 border-b">
          <h3 className="text-lg font-semibold">TLS Certificate Domains</h3>
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
                Additional Certificate Domains (comma-separated)
              </label>
              <input
                type="text"
                value={localTlsDomains}
                onChange={(e) => setLocalTlsDomains(e.target.value)}
                className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="example.com,*.example.com"
                disabled={saving}
              />
              <p className="text-xs text-gray-500 mt-1">
                Extra domains to include in the TLS certificate (Subject Alternative Names)
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Main domain ({hostName}) will be automatically included
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
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                disabled={saving}
              >
                {saving ? 'Saving...' : 'Save Certificate Domains'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default TLSConfigModal;