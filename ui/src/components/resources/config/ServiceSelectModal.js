// ui/src/components/resources/config/ServiceSelectModal.js
import React, { useState } from 'react';

/**
 * Modal for selecting a service to assign to a resource
 *
 * @param {Object} props
 * @param {Array} props.services - List of available services
 * @param {string} props.currentServiceId - Currently assigned service ID (if any)
 * @param {Function} props.onSelect - Function called when a service is selected (receives serviceId)
 * @param {Function} props.onClose - Function to close the modal
 * @param {boolean} props.isDisabled - Whether the resource is disabled
 */
const ServiceSelectModal = ({
  services = [], // Default to empty array
  currentServiceId,
  onSelect,
  onClose,
  isDisabled // Receive disabled state
}) => {
  const [selectedServiceId, setSelectedServiceId] = useState(currentServiceId || '');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false); // State for submission loading

  // Filter services based on search term
  const filteredServices = services.filter(service =>
    (service?.name && service.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (service?.type && service.type.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (service?.id && service.id.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedServiceId || isDisabled) return; // Prevent selecting if disabled

    setLoading(true);
    try {
      await onSelect(selectedServiceId); // onSelect should handle API call and closing
    } catch (error) {
      // Error handling might be done in the parent component via onSelect promise
      console.error("Error during service selection:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      {/* Increased max-width and max-height */}
      <div className="modal-content max-w-2xl max-h-[80vh] flex flex-col">
        <div className="modal-header sticky top-0 bg-white dark:bg-gray-800 z-10">
          <h3 className="modal-title">Assign Custom Service</h3>
          <button
            onClick={onClose}
            className="modal-close-button"
            aria-label="Close"
          >
            &times;
          </button>
        </div>
        {/* Make modal body scrollable */}
        <div className="modal-body flex-grow overflow-y-auto">
          <form onSubmit={handleSubmit}>
            {isDisabled && (
              <div className="mb-4 p-3 text-sm text-red-700 bg-red-100 dark:bg-red-900 dark:text-red-200 border border-red-300 dark:border-red-600 rounded-md">
                Cannot change service assignment while the resource is disabled.
              </div>
            )}
            <div className="mb-4 sticky top-0 bg-white dark:bg-gray-800 pt-1 pb-2">
              <label htmlFor="service-search" className="sr-only">Search Services</label>
              <input
                id="service-search"
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="form-input"
                placeholder="Search by name, type, or ID..."
                disabled={isDisabled}
              />
            </div>

            {/* Service List */}
            <div className="mb-4 border dark:border-gray-600 rounded">
              {filteredServices.length === 0 ? (
                <div className="p-6 text-center text-gray-500 dark:text-gray-400">
                  {searchTerm
                    ? 'No services match your search.'
                    : 'No services available. You may need to create one first.'}
                </div>
              ) : (
                <div className="divide-y dark:divide-gray-700">
                  {filteredServices.map(service => (
                    <label
                      key={service.id}
                      className={`flex items-start p-4 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-150 ${
                        selectedServiceId === service.id ? 'bg-blue-50 dark:bg-blue-900' : ''
                      } ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}`} // Dim if disabled
                    >
                      <input
                        type="radio"
                        name="service"
                        value={service.id}
                        checked={selectedServiceId === service.id}
                        onChange={() => !isDisabled && setSelectedServiceId(service.id)} // Prevent change if disabled
                        className="mt-1 mr-3 flex-shrink-0 h-4 w-4 text-blue-600 dark:text-orange-400 border-gray-300 dark:border-gray-600 focus:ring-blue-500 dark:focus:ring-orange-500 bg-gray-100 dark:bg-gray-700"
                        disabled={isDisabled}
                      />
                      <div className="flex-grow">
                        <div className="font-medium text-gray-900 dark:text-gray-100">{service.name}</div>
                        <div className="text-xs font-mono text-gray-500 dark:text-gray-400">{service.id}</div>
                        <div className="mt-1">
                           {/* Use badge class */}
                          <span className="badge badge-info bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
                            {service.type}
                          </span>
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </form>
        </div>
         {/* Footer remains fixed */}
        <div className="modal-footer sticky bottom-0 bg-gray-50 dark:bg-gray-800 z-10">
          <button
            type="button"
            onClick={onClose}
            className="btn btn-secondary"
            disabled={loading}
          >
            Cancel
          </button>
          <button
            type="button" // Change to button, trigger submit via form's onSubmit
            onClick={handleSubmit} // Call submit handler on click
            className="btn btn-primary bg-purple-600 hover:bg-purple-700 dark:bg-purple-500 dark:hover:bg-purple-600 border-purple-600 dark:border-purple-500" // Specific styling for service
            disabled={!selectedServiceId || loading || isDisabled}
          >
            {loading ? 'Assigning...' : 'Assign Service'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ServiceSelectModal;