// ui/src/components/common/Header.js
import React, { useState } from 'react';
import DarkModeToggle from './DarkModeToggle';
import { useApp } from '../../contexts/AppContext'; // Use AppContext to get state

/**
 * Main navigation header component
 * Includes navigation for Dashboard, Resources, Middlewares, Services, and Settings.
 *
 * @param {Object} props
 * @param {string} props.currentPage - Current active page ID (e.g., 'dashboard', 'services')
 * @param {function} props.navigateTo - Function from AppContext to navigate between pages
 * @param {boolean} props.isDarkMode - Current dark mode state from AppContext
 * @param {function} props.setIsDarkMode - Function from AppContext to toggle dark mode
 * @param {function} props.openSettings - Function from AppContext to open the settings modal
 * @returns {JSX.Element}
 */
const Header = ({
  currentPage,
  navigateTo,
  isDarkMode,
  setIsDarkMode,
  openSettings
}) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { activeDataSource } = useApp(); // Get active data source

  // Helper function to determine button classes based on current page
  const getNavLinkClasses = (pageId) => {
    const activePages = Array.isArray(pageId) ? pageId : [pageId];
    const isActive = activePages.includes(currentPage);
    const baseDesktop = "px-3 py-2 rounded-md text-sm font-medium transition-colors duration-150";
    const baseMobile = "block px-3 py-2 rounded-md text-base font-medium transition-colors duration-150";
    const activeClass = "bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white";
    const inactiveClass = "text-gray-500 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white";

    return {
      desktop: `${baseDesktop} ${isActive ? activeClass : inactiveClass}`,
      mobile: `${baseMobile} ${isActive ? activeClass : inactiveClass}`
    };
  };

  // Navigation links structure
  const navLinks = [
    { id: 'dashboard', label: 'Dashboard', pages: ['dashboard'] },
    { id: 'resources', label: 'Resources', pages: ['resources', 'resource-detail'] },
    { id: 'middlewares', label: 'Middlewares', pages: ['middlewares', 'middleware-form'] },
    { id: 'services', label: 'Services', pages: ['services', 'service-form'] },
  ];

  return (
    <nav className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          {/* Logo/Title Section */}
          <div className="flex-shrink-0 flex items-center">
            {/* Optional SVG logo */}
            <span className="text-xl font-semibold text-gray-800 dark:text-gray-100">
              Middleware Manager
            </span>
             {/* Active Data Source Indicator */}
             <span className="ml-4 px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 text-xs font-medium capitalize">
               {activeDataSource} Mode
             </span>
          </div>

          {/* Desktop Navigation & Controls */}
          <div className="hidden md:flex md:items-center md:space-x-4">
            {navLinks.map(link => (
              <button
                key={link.id}
                onClick={() => navigateTo(link.id)}
                className={getNavLinkClasses(link.pages).desktop}
              >
                {link.label}
              </button>
            ))}

            {/* Settings Button */}
            <button
              onClick={openSettings}
              className="group flex items-center px-3 py-2 text-sm font-medium rounded-md text-gray-500 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white transition-colors duration-150"
              aria-label="Settings"
              title="Data Source Settings"
            >
              {/* Settings Icon */}
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1 text-gray-400 dark:text-gray-500 group-hover:text-gray-500 dark:group-hover:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Settings
            </button>

            {/* Dark Mode Toggle */}
            <DarkModeToggle isDark={isDarkMode} setIsDark={setIsDarkMode} />
          </div>

          {/* Mobile Menu Button */}
          <div className="md:hidden flex items-center">
             {/* Dark Mode Toggle for Mobile */}
             <div className="mr-2">
                 <DarkModeToggle isDark={isDarkMode} setIsDark={setIsDarkMode} />
             </div>
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="inline-flex items-center justify-center p-2 rounded-md text-gray-400 dark:text-gray-500 hover:text-gray-500 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500 dark:focus:ring-orange-500"
              aria-controls="mobile-menu"
              aria-expanded={isMobileMenuOpen}
            >
              <span className="sr-only">Open main menu</span>
              {/* Hamburger Icon */}
              {!isMobileMenuOpen ? (
                <svg className="block h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              ) : (
                // Close Icon
                <svg className="block h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      <div className={`${isMobileMenuOpen ? 'block' : 'hidden'} md:hidden border-t border-gray-200 dark:border-gray-700`} id="mobile-menu">
        <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
          {navLinks.map(link => (
            <button
              key={link.id}
              onClick={() => { navigateTo(link.id); setIsMobileMenuOpen(false); }} // Close menu on navigate
              className={`${getNavLinkClasses(link.pages).mobile} w-full text-left`} // Ensure full width and left alignment
            >
              {link.label}
            </button>
          ))}
          {/* Settings Mobile Button */}
          <button
            onClick={() => { openSettings(); setIsMobileMenuOpen(false); }}
            className="flex w-full text-left items-center px-3 py-2 rounded-md text-base font-medium text-gray-500 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Settings
          </button>
        </div>
      </div>
    </nav>
  );
};

export default Header;