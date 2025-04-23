import React, { useState, useEffect } from 'react';

/**
 * TCP Configuration Modal for TCP SNI routing
 * @param {Object} props
 * @param {Object} props.resource - Resource data
 * @param {boolean} props.tcpEnabled - Whether TCP SNI routing is enabled
 * @param {Function} props.setTCPEnabled - Function to update TCP enabled status
 * @param {string} props.tcpEntrypoints - TCP entrypoints string
 * @param {Function} props.setTCPEntrypoints - Function to update TCP entrypoints
 * @param {string} props.tcpSNIRule - TCP SNI rule string
 * @param {Function} props.setTCPSNIRule - Function to update TCP SNI rule
 * @param {string} props.resourceHost - Host for the resource
 * @param {Function} props.onSave - Save handler function
 * @param {Function} props.onClose - Close modal handler
 */
const TCPConfigModal = ({ 
  resource, 
  tcpEnabled, 
  setTCPEnabled, 
  tcpEntrypoints, 
  setTCPEntrypoints, 
  tcpSNIRule, 
  setTCPSNIRule, 
  resourceHost, 
  onSave, 
  onClose 
}) => {
  const [localTcpEnabled, setLocalTcpEnabled] = useState(tcpEnabled === true);
  const [localTcpEntrypoints, setLocalTcpEntrypoints] = useState(tcpEntrypoints || 'tcp');
  const [localTcpSNIRule, setLocalTcpSNIRule] = useState(tcpSNIRule || '');
  const [saving, setSaving] = useState(false);
  
  // Host fallback if resourceHost is not provided
  const host = resourceHost || (resource && resource.host) || 'example.com';
  
  // Initialize from props when they change
  useEffect(() => {
    setLocalTcpEnabled(tcpEnabled === true);
    setLocalTcpEntrypoints(tcpEntrypoints || 'tcp');
    setLocalTcpSNIRule(tcpSNIRule || '');
  }, [tcpEnabled, tcpEntrypoints, tcpSNIRule]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      setSaving(true);
      
      // Update parent state first
      setTCPEnabled(localTcpEnabled);
      setTCPEntrypoints(localTcpEntrypoints);
      setTCPSNIRule(localTcpSNIRule);
      
      // Then save
      await onSave({
        tcp_enabled: localTcpEnabled,
        tcp_entrypoints: localTcpEntrypoints,
        tcp_sni_rule: localTcpSNIRule
      });
      
      onClose();
    } catch (err) {
      alert('Failed to update TCP configuration');
      console.error('TCP config update error:', err);
    } finally {
      setSaving(false);
    }
  };
  
  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-md">
        <div className="flex justify-between items-center px-6 py-4 border-b">
          <h3 className="text-lg font-semibold">TCP SNI Routing Configuration</h3>
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
              <label className="block text-gray-700 text-sm font-bold mb-2 flex items-center">
                <input
                  type="checkbox"
                  checked={localTcpEnabled}
                  onChange={(e) => setLocalTcpEnabled(e.target.checked)}
                  className="mr-2"
                  disabled={saving}
                />
                Enable TCP SNI Routing
              </label>
              <p className="text-xs text-gray-500 mt-1">
                Creates a separate TCP router with SNI matching rules
              </p>
            </div>
            
            {localTcpEnabled && (
              <>
                <div className="mb-4">
                  <label className="block text-gray-700 text-sm font-bold mb-2">
                    TCP Entry Points (comma-separated)
                  </label>
                  <input
                    type="text"
                    value={localTcpEntrypoints}
                    onChange={(e) => setLocalTcpEntrypoints(e.target.value)}
                    className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="tcp"
                    required
                    disabled={saving}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Standard TCP entrypoint: tcp. Default: tcp
                  </p>
                </div>
                <div className="mb-4">
                  <label className="block text-gray-700 text-sm font-bold mb-2">
                    TCP SNI Matching Rule
                  </label>
                  <input
                    type="text"
                    value={localTcpSNIRule}
                    onChange={(e) => setLocalTcpSNIRule(e.target.value)}
                    className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder={`HostSNI(\`${host}\`)`}
                    disabled={saving}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    SNI rule using HostSNI or HostSNIRegexp matchers
                  </p>
                  <p className="text-xs text-gray-500 mt-1">Examples:</p>
                  <ul className="text-xs text-gray-500 mt-1 list-disc pl-5">
                    <li>Match specific domain: <code>{`HostSNI(\`${host}\`)`}</code></li>
                    <li>Match with wildcard: <code>{`HostSNIRegexp(\`^.+\\.example\\.com$\`)`}</code></li>
                  </ul>
                  <p className="text-xs text-gray-500 mt-1">
                    If empty, defaults to <code>{`HostSNI(\`${host}\`)`}</code>
                  </p>
                </div>
              </>
            )}
            
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
                className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
                disabled={saving}
              >
                {saving ? 'Saving...' : 'Save TCP Configuration'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default TCPConfigModal;