import React from 'react';

/**
 * Loading spinner component with optional message
 * 
 * @param {Object} props
 * @param {string} props.message - Optional loading message
 * @param {string} props.size - Size of the spinner: "sm", "md", "lg" 
 * @returns {JSX.Element}
 */
const LoadingSpinner = ({ message = 'Loading...', size = 'md' }) => {
  // Determine spinner size based on prop
  const spinnerSizes = {
    sm: 'w-6 h-6 border-2',
    md: 'w-12 h-12 border-3',
    lg: 'w-16 h-16 border-4',
  };
  
  const spinnerSize = spinnerSizes[size] || spinnerSizes.md;
  
  return (
    <div className="flex flex-col items-center justify-center p-6">
      <div className={`${spinnerSize} border-blue-500 border-t-transparent rounded-full animate-spin mb-4`}></div>
      
      {message && (
        <p className="text-gray-600">{message}</p>
      )}
    </div>
  );
};

export default LoadingSpinner;