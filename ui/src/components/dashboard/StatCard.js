import React from 'react';

/**
 * Stat card component for displaying dashboard statistics
 * 
 * @param {Object} props
 * @param {string} props.title - Card title
 * @param {string|number} props.value - Main statistic value
 * @param {string} [props.subtitle] - Optional subtitle
 * @param {string} [props.status] - Optional status (success, warning, danger)
 * @returns {JSX.Element}
 */
const StatCard = ({ title, value, subtitle = null, status = null }) => {
  // Determine background color based on status
  let bgColor = '';
  
  if (status) {
    switch (status) {
      case 'success':
        bgColor = 'bg-green-50 border-green-500';
        break;
      case 'warning':
        bgColor = 'bg-yellow-50 border-yellow-500';
        break;
      case 'danger':
        bgColor = 'bg-red-50 border-red-500';
        break;
      default:
        bgColor = '';
    }
  }
  
  return (
    <div className={`bg-white p-6 rounded-lg shadow ${bgColor ? `${bgColor} border-l-4` : ''}`}>
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      <p className="text-3xl font-bold">{value}</p>
      {subtitle && (
        <p className="text-sm text-gray-500 mt-1">
          {subtitle}
        </p>
      )}
    </div>
  );
};

export default StatCard;