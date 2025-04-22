import React from 'react';
import DarkModeToggle from './DarkModeToggle';

/**
 * Main navigation header component
 * 
 * @param {Object} props
 * @param {string} props.currentPage - Current active page
 * @param {function} props.navigateTo - Function to navigate to a different page
 * @param {boolean} props.isDarkMode - Current dark mode state
 * @param {function} props.setIsDarkMode - Function to toggle dark mode
 * @returns {JSX.Element}
 */
const Header = ({ currentPage, navigateTo, isDarkMode, setIsDarkMode }) => {
  return (
    <nav className="bg-white shadow-sm">
      <div className="container mx-auto px-6 py-3">
        <div className="flex justify-between items-center">
          <div className="text-xl font-semibold text-gray-700">
            Pangolin Middleware Manager
          </div>
          <div className="flex items-center">
            <div className="space-x-4">
              <button
                onClick={() => navigateTo('dashboard')}
                className={`px-3 py-2 rounded hover:bg-gray-100 ${
                  currentPage === 'dashboard' ? 'bg-gray-100' : ''
                }`}
              >
                Dashboard
              </button>
              <button
                onClick={() => navigateTo('resources')}
                className={`px-3 py-2 rounded hover:bg-gray-100 ${
                  currentPage === 'resources' || currentPage === 'resource-detail'
                    ? 'bg-gray-100'
                    : ''
                }`}
              >
                Resources
              </button>
              <button
                onClick={() => navigateTo('middlewares')}
                className={`px-3 py-2 rounded hover:bg-gray-100 ${
                  currentPage === 'middlewares' || currentPage === 'middleware-form'
                    ? 'bg-gray-100'
                    : ''
                }`}
              >
                Middlewares
              </button>
            </div>
            <DarkModeToggle isDark={isDarkMode} setIsDark={setIsDarkMode} />
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Header;