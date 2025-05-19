// ui/src/components/services/ServiceForm.js
import React, { useState, useEffect, useContext } from 'react';
import { ServiceContext, useApp } from '../../contexts'; // Import useApp
import { ServiceUtils } from '../../services/api'; // Import enhanced utils
import { LoadingSpinner, ErrorMessage } from '../common';

const ServiceForm = ({ navigateTo }) => {
    const { serviceId, isEditing } = useApp(); // Get ID and editing state from AppContext
    const {
        addService,
        editService,
        fetchService,
        error: contextError, // Use context error
        setError: setContextError // Use context setError
    } = useContext(ServiceContext);

    // Form state
    const [formData, setFormData] = useState({
        name: '',
        type: 'loadBalancer',
        config: {}
    });
    const [configText, setConfigText] = useState('');
    const [formLoading, setFormLoading] = useState(false);
    const [formError, setFormError] = useState(null);
    const [protocol, setProtocol] = useState('http');
    const [showHelp, setShowHelp] = useState(false);

    // Use context error if present, otherwise use local form error
    const displayError = contextError || formError;
    const clearError = () => {
        setFormError(null);
        if (contextError) setContextError(null);
    };

    // Get type info for the current selection
    const typeInfo = ServiceUtils.getServiceTypeInfo(formData.type);

    // Fetch service details if editing
    useEffect(() => {
        const loadServiceData = async () => {
            if (isEditing && serviceId) {
                setFormLoading(true);
                clearError();
                const serviceData = await fetchService(serviceId);
                if (serviceData) {
                    const configJson = typeof serviceData.config === 'string'
                        ? serviceData.config // Assume it's already formatted if string
                        : JSON.stringify(serviceData.config || {}, null, 2);

                    setFormData({
                        name: serviceData.name,
                        type: serviceData.type,
                        config: typeof serviceData.config === 'object' ? serviceData.config : {}
                    });
                    setConfigText(configJson);
                    // Determine protocol based on config (best guess for edit mode)
                    if (configJson.includes('"address":')) {
                       if (configJson.includes(':53') || configJson.includes('"udp"')) {
                            setProtocol('udp');
                       } else {
                           setProtocol('tcp');
                       }
                    } else {
                        setProtocol('http');
                    }
                } else {
                    setFormError(`Service with ID ${serviceId} not found or failed to load.`);
                }
                setFormLoading(false);
            } else {
                // Reset form for creation and set default template
                const defaultType = 'loadBalancer';
                setFormData({ name: '', type: defaultType, config: {} });
                setConfigText(ServiceUtils.getConfigTemplate(defaultType));
                setProtocol('http'); // Default to HTTP for new service
                clearError(); // Clear any previous errors
            }
        };

        loadServiceData();
    }, [serviceId, isEditing, fetchService, setContextError]); // Add setContextError dependency

    // Update config template when type changes
    const handleTypeChange = (e) => {
        const newType = e.target.value;
        setFormData(prev => ({ ...prev, type: newType }));
        // Reset protocol to HTTP when type changes, unless it's loadBalancer
        const currentProtocol = (newType === 'loadBalancer' && protocol !== 'http') ? protocol : 'http';
        setConfigText(
            (currentProtocol !== 'http' && newType === 'loadBalancer')
            ? ServiceUtils.getProtocolTemplate(currentProtocol)
            : ServiceUtils.getConfigTemplate(newType)
        );
        setProtocol(currentProtocol);
        clearError();
    };

    // Update config template when protocol changes (only for loadBalancer)
    const handleProtocolChange = (e) => {
        const newProtocol = e.target.value;
        setProtocol(newProtocol);

        if (formData.type === 'loadBalancer') {
            setConfigText(
                newProtocol === 'http'
                ? ServiceUtils.getConfigTemplate(formData.type) // Use HTTP LB template
                : ServiceUtils.getProtocolTemplate(newProtocol) // Use TCP/UDP template
            );
        }
        clearError();
    };


    // Handle form submission
    const handleSubmit = async (e) => {
        e.preventDefault();
        setFormLoading(true);
        clearError(); // Clear previous errors

        let configObj;
        try {
            // Validate and parse the JSON from the textarea
            configObj = JSON.parse(configText);
        } catch (err) {
            setFormError('Invalid JSON configuration: ' + err.message);
            setFormLoading(false);
            return;
        }

        // Prepare the data to be sent
        const serviceData = {
            name: formData.name,
            type: formData.type,
            config: configObj
        };

        try {
            if (isEditing) {
                await editService(serviceId, serviceData);
            } else {
                await addService(serviceData);
            }
            navigateTo('services'); // Navigate back to list on success
        } catch (err) {
            // Error should already be set in context by addService/editService
            // Log it just in case
            console.error(`Form submission error:`, err);
            // No need to setFormError here as context error will be displayed
        } finally {
            setFormLoading(false);
        }
    };

    // Format a JSON string
    const formatJson = () => {
        try {
            const formatted = JSON.stringify(JSON.parse(configText), null, 2);
            setConfigText(formatted);
            clearError(); // Clear error if formatting succeeds
        } catch (err) {
            setFormError('Invalid JSON: ' + err.message);
        }
    };

    // Show loading spinner only when fetching data for edit mode
    if (formLoading && isEditing) {
        return <LoadingSpinner message="Loading service data..." />;
    }

    return (
        <div>
            <div className="mb-6 flex items-center">
                <button
                    onClick={() => navigateTo('services')}
                    className="mr-4 px-3 py-1 bg-gray-200 rounded hover:bg-gray-300"
                    aria-label="Back to services list"
                >
                    &larr; Back
                </button>
                <h1 className="text-2xl font-bold">
                    {isEditing ? 'Edit Service' : 'Create New Service'}
                    {isEditing && formData.name && ` - ${formData.name}`}
                </h1>
            </div>

            {displayError && (
                <ErrorMessage
                    message={displayError}
                    onDismiss={clearError}
                />
            )}

            <div className="bg-white p-6 rounded-lg shadow">
                <form onSubmit={handleSubmit}>
                    {/* Service Name Input */}
                    <div className="mb-4">
                        <label htmlFor="serviceName" className="block text-gray-700 text-sm font-bold mb-2">
                            Service Name
                        </label>
                        <input
                            id="serviceName"
                            type="text"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="e.g., my-backend-service"
                            required
                            disabled={formLoading}
                        />
                        <p className="text-xs text-gray-500 mt-1">
                            This name will be used to reference the service (e.g., my-backend-service@file).
                        </p>
                    </div>

                    {/* Protocol Selection (only for LoadBalancer type) */}
                    {formData.type === 'loadBalancer' && (
                        <div className="mb-4">
                            <label className="block text-gray-700 text-sm font-bold mb-2">
                                Backend Protocol
                            </label>
                            <div className="flex space-x-4">
                                <label className="inline-flex items-center">
                                    <input
                                        type="radio"
                                        name="protocol"
                                        value="http"
                                        checked={protocol === 'http'}
                                        onChange={handleProtocolChange}
                                        className="mr-1"
                                        disabled={formLoading || isEditing} // Disable if editing
                                    />
                                    HTTP
                                </label>
                                <label className="inline-flex items-center">
                                    <input
                                        type="radio"
                                        name="protocol"
                                        value="tcp"
                                        checked={protocol === 'tcp'}
                                        onChange={handleProtocolChange}
                                        className="mr-1"
                                        disabled={formLoading || isEditing} // Disable if editing
                                    />
                                    TCP
                                </label>
                                <label className="inline-flex items-center">
                                    <input
                                        type="radio"
                                        name="protocol"
                                        value="udp"
                                        checked={protocol === 'udp'}
                                        onChange={handleProtocolChange}
                                        className="mr-1"
                                        disabled={formLoading || isEditing} // Disable if editing
                                    />
                                    UDP
                                </label>
                            </div>
                             {isEditing && (
                                <p className="text-xs text-gray-500 mt-1">
                                    Protocol cannot be changed after creation for LoadBalancer services.
                                </p>
                            )}
                        </div>
                    )}

                    {/* Service Type Selector */}
                    <div className="mb-4">
                        <label htmlFor="serviceType" className="block text-gray-700 text-sm font-bold mb-2">
                            Service Type
                        </label>
                        <select
                            id="serviceType"
                            value={formData.type}
                            onChange={handleTypeChange}
                            className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                            required
                            disabled={isEditing || formLoading} // Disable type change if editing
                        >
                            <option value="loadBalancer">Load Balancer</option>
                            <option value="weighted">Weighted</option>
                            <option value="mirroring">Mirroring</option>
                            <option value="failover">Failover</option>
                        </select>
                        {isEditing && (
                            <p className="text-xs text-gray-500 mt-1">
                                Service type cannot be changed after creation.
                            </p>
                        )}
                    </div>

                    {/* Help section toggle */}
                    <div className="mb-2">
                        <button
                            type="button"
                            onClick={() => setShowHelp(!showHelp)}
                            className="text-blue-600 hover:text-blue-800 text-sm flex items-center"
                            aria-expanded={showHelp}
                        >
                            {showHelp ? 'Hide' : 'Show'} configuration help
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                viewBox="0 0 20 20"
                                fill="currentColor"
                                className={`w-4 h-4 ml-1 transform transition-transform ${showHelp ? 'rotate-180' : ''}`}
                            >
                                <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                            </svg>
                        </button>
                    </div>

                    {/* Help section content */}
                    {showHelp && (
                        <div className="mb-4 bg-blue-50 p-4 rounded border border-blue-200 text-sm transition-opacity duration-300 ease-in-out">
                            <h3 className="font-bold text-blue-800 mb-2">{formData.type} Service Configuration</h3>
                            <p className="mb-2">{typeInfo.description}</p>

                            {formData.type === 'loadBalancer' && (
                                <>
                                    <h4 className="font-semibold mt-2">Server Format:</h4>
                                    <p className="font-mono text-xs bg-blue-100 p-1 rounded mb-2">
                                        {typeInfo.serverFormat}
                                    </p>
                                    <h4 className="font-semibold">Common Options:</h4>
                                    <ul className="list-disc ml-5 text-xs space-y-1">
                                        {typeInfo.commonOptions.map((option, i) => (
                                            <li key={i}>{option}</li>
                                        ))}
                                    </ul>
                                </>
                            )}

                            {(formData.type === 'weighted' || formData.type === 'mirroring' || formData.type === 'failover') && (
                                <>
                                    <h4 className="font-semibold mt-2">Format:</h4>
                                    <p className="mb-1">{typeInfo.format}</p>
                                    {typeInfo.serviceNames && <p className="text-amber-700">Important: {typeInfo.serviceNames}</p>}
                                    {typeInfo.notes && <p>Note: {typeInfo.notes}</p>}
                                </>
                            )}

                            <div className="mt-2 text-xs text-blue-700">
                                Refer to <a href="https://doc.traefik.io/traefik/routing/services/" target="_blank" rel="noopener noreferrer" className="underline">Traefik documentation</a> for complete details.
                            </div>
                        </div>
                    )}

                    {/* Configuration Text Area */}
                    <div className="mb-6">
                        <div className="flex justify-between items-center mb-2">
                            <label htmlFor="serviceConfig" className="block text-gray-700 text-sm font-bold">
                                Configuration (JSON)
                            </label>
                            <button
                                type="button"
                                onClick={formatJson}
                                className="text-xs text-blue-600 hover:text-blue-800"
                            >
                                Format JSON
                            </button>
                        </div>
                        <textarea
                            id="serviceConfig"
                            value={configText}
                            onChange={(e) => { setConfigText(e.target.value); clearError(); }}
                            className="w-full px-3 py-2 border font-mono h-64 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
                            placeholder={`Enter valid JSON configuration for a '${formData.type}' service`}
                            required
                            disabled={formLoading}
                            spellCheck="false"
                        />

                        {/* Protocol-specific notes */}
                        {formData.type === 'loadBalancer' && protocol !== 'http' && (
                            <p className="text-xs text-amber-700 mt-1">
                                <strong>Note for {protocol.toUpperCase()} services:</strong> Use <code className="bg-gray-200 px-1 rounded">address</code> instead of <code className="bg-gray-200 px-1 rounded">url</code> for servers.
                            </p>
                        )}

                        {/* Connection warnings for other service types */}
                        {(formData.type === 'weighted' || formData.type === 'mirroring' || formData.type === 'failover') && (
                          <p className="text-xs text-amber-700 mt-1">
                              <strong>Important:</strong> Service names (e.g., "my-other-service@file") must reference existing services. Use the "@file" suffix for services created within this Middleware Manager. Ensure referenced services exist before saving.
                          </p>
                        )}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex justify-end space-x-3">
                        <button
                            type="button"
                            onClick={() => navigateTo('services')}
                            className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 disabled:opacity-50"
                            disabled={formLoading}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                            disabled={formLoading}
                        >
                            {formLoading ? 'Saving...' : isEditing ? 'Update Service' : 'Create Service'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ServiceForm;