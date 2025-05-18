// ui/src/components/resources/config/TCPConfigModal.js
import React, { useState, useEffect } from 'react';

/**
 * TCP Configuration Modal for TCP SNI routing
 * @param {Object} props
 * @param {Object} props.resource - Resource data
 * @param {boolean} props.tcpEnabled - Whether TCP SNI routing is enabled
 * @param {Function} props.setTCPEnabled - Function to update TCP enabled status in parent (optional)
 * @param {string} props.tcpEntrypoints - TCP entrypoints string
 * @param {Function} props.setTCPEntrypoints - Function to update TCP entrypoints in parent (optional)
 * @param {string} props.tcpSNIRule - TCP SNI rule string
 * @param {Function} props.setTCPSNIRule - Function to update TCP SNI rule in parent (optional)
 * @param {string} props.resourceHost - Host for the resource
 * @param {Function} props.onSave - Save handler function (receives { tcp_enabled, tcp_entrypoints, tcp_sni_rule })
 * @param {Function} props.onClose - Close modal handler
 * @param {boolean} props.isDisabled - Whether the resource is disabled
 */
const TCPConfigModal = ({
  resource,
  tcpEnabled: initialTcpEnabled,
  setTCPEnabled: setParentTCPEnabled, // Optional parent setters
  tcpEntrypoints: initialTcpEntrypoints,
  setTCPEntrypoints: setParentTCPEntrypoints,
  tcpSNIRule: initialTcpSNIRule,
  setTCPSNIRule: setParentTCPSNIRule,
  resourceHost,
  onSave,
  onClose,
  isDisabled // Receive disabled state
}) => {
  const [localTcpEnabled, setLocalTcpEnabled] = useState(initialTcpEnabled === true);
  const [localTcpEntrypoints, setLocalTcpEntrypoints] = useState(initialTcpEntrypoints || 'tcp');
  const [localTcpSNIRule, setLocalTcpSNIRule] = useState(initialTcpSNIRule || '');
  const [saving, setSaving] = useState(false);

  // Host fallback
  const host = resourceHost || resource?.host || 'example.com';

  // Sync local state if initial props change
  useEffect(() => {
    setLocalTcpEnabled(initialTcpEnabled === true);
    setLocalTcpEntrypoints(initialTcpEntrypoints || 'tcp');
    setLocalTcpSNIRule(initialTcpSNIRule || '');
  }, [initialTcpEnabled, initialTcpEntrypoints, initialTcpSNIRule]);

  // Handlers to update local and optionally parent state
  const handleEnableChange = (e) => {
    const isChecked = e.target.checked;
    setLocalTcpEnabled(isChecked);
    if (setParentTCPEnabled) setParentTCPEnabled(isChecked);
    // Reset SNI rule if disabling TCP routing
    if (!isChecked) {
        setLocalTcpSNIRule('');
        if(setParentTCPSNIRule) setParentTCPSNIRule('');
    }
  };

  const handleEntrypointsChange = (e) => {
    const value = e.target.value;
    setLocalTcpEntrypoints(value);
    if (setParentTCPEntrypoints) setParentTCPEntrypoints(value);
  };

  const handleSNIRuleChange = (e) => {
    const value = e.target.value;
    setLocalTcpSNIRule(value);
    if (setParentTCPSNIRule) setParentTCPSNIRule(value);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
     if (isDisabled) return; // Prevent saving if disabled

    setSaving(true);
    try {
      await onSave({
        tcp_enabled: localTcpEnabled,
        tcp_entrypoints: localTcpEntrypoints || 'tcp', // Default if empty
        // Use HostSNI(`host`) as default only if TCP is enabled and rule is empty
        tcp_sni_rule: localTcpEnabled && localTcpSNIRule.trim() === '' ? `HostSNI(\`${host}\`)` : localTcpSNIRule,
      });
      onClose(); // Close only on successful save
    } catch (err) {
      alert('Failed to update TCP configuration');
      console.error('TCP config update error:', err);
      // Keep modal open on error
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <h3 className="modal-title">TCP SNI Routing Configuration</h3>
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
            {/* Enable TCP Routing Checkbox */}
            <div className="mb-6"> {/* Increased margin */}
              <label className="flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={localTcpEnabled}
                  onChange={handleEnableChange}
                  className="form-checkbox h-5 w-5 text-blue-600 dark:text-orange-400 rounded border-gray-300 dark:border-gray-600 focus:ring-blue-500 dark:focus:ring-orange-500 bg-gray-100 dark:bg-gray-700"
                  disabled={saving || isDisabled}
                />
                <span className="ml-3 text-sm font-medium text-gray-900 dark:text-gray-100">
                  Enable TCP SNI Routing
                </span>
              </label>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 pl-8"> {/* Indent help text */}
                Creates a separate TCP router with SNI matching rules.
              </p>
            </div>

            {/* Fields shown only when TCP is enabled */}
            {localTcpEnabled && (
              <div className="space-y-4">
                <div>
                  <label htmlFor="tcp-entrypoints" className="form-label">
                    TCP Entry Points (comma-separated)
                  </label>
                  <input
                    id="tcp-entrypoints"
                    type="text"
                    value={localTcpEntrypoints}
                    onChange={handleEntrypointsChange}
                    className="form-input"
                    placeholder="tcp, mysql"
                    required
                    disabled={saving || isDisabled}
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Standard TCP entrypoint: <code className="text-xs font-mono bg-gray-100 dark:bg-gray-700 px-1 rounded">tcp</code>. Default: tcp.
                  </p>
                   <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                       <strong>Note:</strong> Must match entrypoints defined in Traefik static configuration.
                   </p>
                </div>
                <div>
                  <label htmlFor="tcp-sni-rule" className="form-label">
                    TCP SNI Matching Rule
                  </label>
                  <input
                    id="tcp-sni-rule"
                    type="text"
                    value={localTcpSNIRule}
                    onChange={handleSNIRuleChange}
                    className="form-input"
                    placeholder={`HostSNI(\`${host}\`)`}
                    disabled={saving || isDisabled}
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Use <code className="text-xs font-mono bg-gray-100 dark:bg-gray-700 px-1 rounded">HostSNI</code> or <code className="text-xs font-mono bg-gray-100 dark:bg-gray-700 px-1 rounded">HostSNIRegexp</code>.
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    If empty, defaults to <code className="text-xs font-mono bg-gray-100 dark:bg-gray-700 px-1 rounded">{`HostSNI(\`${host}\`)`}</code>.
                  </p>
                   <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                       Example regex: <code className="text-xs font-mono bg-gray-100 dark:bg-gray-700 px-1 rounded">{`HostSNIRegexp(\`.*\`)`}</code> (matches any SNI).
                   </p>
                </div>
              </div>
            )}
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
              className="btn btn-primary bg-purple-600 hover:bg-purple-700 dark:bg-purple-500 dark:hover:bg-purple-600 border-purple-600 dark:border-purple-500" // Specific styling for TCP
              disabled={saving || isDisabled}
            >
              {saving ? 'Saving...' : 'Save TCP Configuration'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TCPConfigModal;