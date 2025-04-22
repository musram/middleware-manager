import React, { useState } from 'react';

/**
 * TCP Configuration Modal for TCP SNI routing
 */
const TCPConfigModal = ({ resource, onSave, onClose }) => {
  const [tcpEnabled, setTCPEnabled] = useState(resource.tcp_enabled || false);
  const [tcpEntrypoints, setTCPEntrypoints] = useState(resource.tcp_entrypoints || 'tcp');
  const [tcpSNIRule, setTCPSNIRule] = useState(resource.tcp_sni_rule || '');

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      await onSave({
        tcp_enabled: tcpEnabled,
        tcp_entrypoints: tcpEntrypoints,
        tcp_sni_rule: tcpSNIRule
      });
      onClose();
    } catch (err) {
      alert('Failed to update TCP configuration');
      console.error('TCP config update error:', err);
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
                  checked={tcpEnabled}
                  onChange={(e) => setTCPEnabled(e.target.checked)}
                  className="mr-2"
                />
                Enable TCP SNI Routing
              </label>
              <p className="text-xs text-gray-500 mt-1">
                Creates a separate TCP router with SNI matching rules
              </p>
            </div>
            
            {tcpEnabled && (
              <>
                <div className="mb-4">
                  <label className="block text-gray-700 text-sm font-bold mb-2">
                    TCP Entry Points (comma-separated)
                  </label>
                  <input
                    type="text"
                    value={tcpEntrypoints}
                    onChange={(e) => setTCPEntrypoints(e.target.value)}
                    className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="tcp"
                    required
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
                    value={tcpSNIRule}
                    onChange={(e) => setTCPSNIRule(e.target.value)}
                    className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder={`HostSNI(\`${resource.host}\`)`}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    SNI rule using HostSNI or HostSNIRegexp matchers
                  </p>
                  <p className="text-xs text-gray-500 mt-1">Examples:</p>
                  <ul className="text-xs text-gray-500 mt-1 list-disc pl-5">
                    <li>Match specific domain: <code>{`HostSNI(\`${resource.host}\`)`}</code></li>
                    <li>Match with wildcard: <code>{`HostSNIRegexp(\`^.+\\.example\\.com$\`)`}</code></li>
                  </ul>
                  <p className="text-xs text-gray-500 mt-1">
                    If empty, defaults to <code>{`HostSNI(\`${resource.host}\`)`}</code>
                  </p>
                </div>
              </>
            )}
            
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
                className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
              >
                Save TCP Configuration
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default TCPConfigModal;