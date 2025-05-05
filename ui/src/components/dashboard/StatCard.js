// ui/src/components/dashboard/StatCard.js
import React from 'react';

// Icon mapping (replace with actual icons if you have an icon library)
const icons = {
    server: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
        </svg>
    ),
    'shield-check': (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
    ),
    'lock-closed': (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
    ),
    puzzle: (
         <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 10-4 0v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-3a1 1 0 00-1-1H4a2 2 0 110-4h1a1 1 0 001-1V7a1 1 0 011-1h3a1 1 0 001-1V4z" />
         </svg>
     )
};

/**
 * Stat card component for displaying dashboard statistics
 *
 * @param {Object} props
 * @param {string} props.title - Card title
 * @param {string|number} props.value - Main statistic value
 * @param {string} [props.subtitle] - Optional subtitle
 * @param {string} [props.status] - Optional status (success, warning, danger, neutral)
 * @param {string} [props.icon] - Optional icon key from the 'icons' map
 * @returns {JSX.Element}
 */
const StatCard = ({ title, value, subtitle = null, status = null, icon = null }) => {
  // Determine border color based on status
  let statusClasses = '';
  let iconColor = 'text-gray-400 dark:text-gray-500'; // Default icon color

  if (status) {
    switch (status) {
      case 'success':
        statusClasses = 'border-l-4 border-green-500 dark:border-green-400';
        iconColor = 'text-green-500 dark:text-green-400';
        break;
      case 'warning':
        statusClasses = 'border-l-4 border-yellow-500 dark:border-yellow-400';
        iconColor = 'text-yellow-500 dark:text-yellow-400';
        break;
      case 'danger':
        statusClasses = 'border-l-4 border-red-500 dark:border-red-400';
        iconColor = 'text-red-500 dark:text-red-400';
        break;
      case 'neutral':
        statusClasses = 'border-l-4 border-gray-400 dark:border-gray-500';
        iconColor = 'text-gray-500 dark:text-gray-400';
        break;
      default:
        statusClasses = 'border-l-4 border-gray-300 dark:border-gray-600'; // Default border
    }
  } else {
      statusClasses = 'border-l-4 border-gray-300 dark:border-gray-600'; // Default border if no status
  }

  const CardIcon = icons[icon];

  return (
    <div className={`card flex items-start p-4 sm:p-6 ${statusClasses}`}>
      {CardIcon && (
        <div className={`flex-shrink-0 mr-4 p-2 bg-gray-100 dark:bg-gray-700 rounded-full ${iconColor}`}>
          {CardIcon}
        </div>
      )}
      <div className="flex-1">
        <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{title}</h3>
        <p className="mt-1 text-3xl font-semibold text-gray-900 dark:text-gray-100">{value}</p>
        {subtitle && (
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {subtitle}
          </p>
        )}
      </div>
    </div>
  );
};

export default StatCard;