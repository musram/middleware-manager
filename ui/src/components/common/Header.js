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
 * @param {function} props.openSettings - Function to open data source settings
 * @returns {JSX.Element}
 */
const Header = ({ 
  currentPage, 
  navigateTo, 
  isDarkMode, 
  setIsDarkMode,
  openSettings
}) => {
  return (
    <nav className="bg-white shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex-shrink-0 flex items-center">
            <span className="text-xl font-medium text-gray-800">
              Pangolin Middleware Manager
            </span>
          </div>
          
          <div className="flex items-center">
            <div className="hidden md:ml-6 md:flex md:space-x-6">
              <button
                onClick={() => navigateTo('dashboard')}
                className={`px-3 py-2 rounded-md text-sm font-medium ${
                  currentPage === 'dashboard' 
                    ? 'bg-gray-100 text-gray-900' 
                    : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                Dashboard
              </button>
              
              <button
                onClick={() => navigateTo('resources')}
                className={`px-3 py-2 rounded-md text-sm font-medium ${
                  currentPage === 'resources' || currentPage === 'resource-detail'
                    ? 'bg-gray-100 text-gray-900' 
                    : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                Resources
              </button>
              
              <button
                onClick={() => navigateTo('middlewares')}
                className={`px-3 py-2 rounded-md text-sm font-medium ${
                  currentPage === 'middlewares' || currentPage === 'middleware-form'
                    ? 'bg-gray-100 text-gray-900' 
                    : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                Middlewares
              </button>
              
              <button
                onClick={openSettings}
                className="group flex items-center px-3 py-2 text-sm font-medium rounded-md text-gray-700 hover:bg-gray-50 hover:text-gray-900"
                aria-label="Settings"
                title="Data Source Settings"
              >
                <svg 
                  xmlns="http://www.w3.org/2000/svg" 
                  className="h-5 w-5 mr-1" 
                  fill="none" 
                  viewBox="0 0 24 24" 
                  stroke="currentColor"
                >
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth={2} 
                    d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" 
                  />
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth={2} 
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" 
                  />
                </svg>
                Settings
              </button>
            </div>
            
            <div className="ml-4 flex items-center">
              <DarkModeToggle isDark={isDarkMode} setIsDark={setIsDarkMode} />
            </div>
          </div>
        </div>
      </div>
      
      {/* Mobile menu, show/hide based on menu state */}
      <div className="md:hidden">
        <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
          <button
            onClick={() => navigateTo('dashboard')}
            className={`block px-3 py-2 rounded-md text-base font-medium ${
              currentPage === 'dashboard' 
                ? 'bg-gray-100 text-gray-900' 
                : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
            }`}
          >
            Dashboard
          </button>
          
          <button
            onClick={() => navigateTo('resources')}
            className={`block px-3 py-2 rounded-md text-base font-medium ${
              currentPage === 'resources' || currentPage === 'resource-detail'
                ? 'bg-gray-100 text-gray-900' 
                : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
            }`}
          >
            Resources
          </button>
          
          <button
            onClick={() => navigateTo('middlewares')}
            className={`block px-3 py-2 rounded-md text-base font-medium ${
              currentPage === 'middlewares' || currentPage === 'middleware-form'
                ? 'bg-gray-100 text-gray-900' 
                : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
            }`}
          >
            Middlewares
          </button>
          
          <button
            onClick={openSettings}
            className="flex items-center px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:bg-gray-50 hover:text-gray-900"
          >
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              className="h-5 w-5 mr-2" 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" 
              />
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" 
              />
            </svg>
            Settings
          </button>
        </div>
      </div>
    </nav>
  );
};

export default Header;