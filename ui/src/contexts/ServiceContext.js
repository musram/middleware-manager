// ui/src/contexts/ServiceContext.js
// Using the version from the previous response - no changes needed here.
import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { ServiceService } from '../services/api'; // Uses updated ServiceService


export const ServiceContext = createContext();

export const ServiceProvider = ({ children }) => {
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadServices = useCallback(async () => {
    setLoading(true);
    try {
      const data = await ServiceService.getServices();
      setServices(data);
      setError(null);
    } catch (err) {
      const errorMsg = `Failed to load services: ${err.message}`;
      setError(errorMsg);
      console.error('Error loading services:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadServices();
  }, [loadServices]);

  const addService = async (serviceData) => {
    try {
      setError(null);
      const newService = await ServiceService.createService(serviceData);
      setServices(prev => [...prev, newService]);
      return newService;
    } catch (err) {
      const errorMsg = `Failed to create service: ${err.message}`;
      setError(errorMsg);
      console.error('Error creating service:', err);
      throw err;
    }
  };

  const editService = async (id, serviceData) => {
    try {
      setError(null);
      const updatedService = await ServiceService.updateService(id, serviceData);
      setServices(prev => prev.map(s => (s.id === id ? updatedService : s)));
      return updatedService;
    } catch (err) {
      const errorMsg = `Failed to update service: ${err.message}`;
      setError(errorMsg);
      console.error(`Error updating service ${id}:`, err);
      throw err;
    }
  };

  const removeService = async (id) => {
    try {
      setError(null);
      await ServiceService.deleteService(id);
      setServices(prev => prev.filter(s => s.id !== id));
      return true;
    } catch (err) {
      const errorMsg = `Failed to delete service: ${err.message}`;
      setError(errorMsg);
      console.error(`Error deleting service ${id}:`, err);
      throw err;
    }
  };

  const fetchService = useCallback(async (id) => {
      if (!id) return null;
      setLoading(true); // Set loading when fetching single service
      try {
          setError(null);
          const data = await ServiceService.getService(id);
          return data;
      } catch (err) {
          const errorMsg = `Failed to load service details: ${err.message}`;
          setError(errorMsg);
          console.error(`Error fetching service ${id}:`, err);
          return null;
      } finally {
          setLoading(false);
      }
  }, []);


  const value = {
    services,
    loading,
    error,
    loadServices,
    addService,
    editService,
    removeService,
    fetchService, // Keep this helper
    setError,
    // No getConfigTemplate needed directly in context per the draft style
  };

  return (
    <ServiceContext.Provider value={value}>
      {children}
    </ServiceContext.Provider>
  );
};

export const useServices = () => {
  const context = useContext(ServiceContext);
  if (context === undefined) {
    throw new Error('useServices must be used within a ServiceProvider');
  }
  return context;
};