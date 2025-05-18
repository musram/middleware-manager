// ui/src/components/plugins/PluginCard.js
import React, { useState } from 'react';
import { usePlugins } from '../../contexts/PluginContext';

const PluginCard = ({ plugin }) => {
  const { installPlugin, loading: contextLoading, error: contextError, setError: setContextError } = usePlugins();
  const [installing, setInstalling] = useState(false);
  const [version, setVersion] = useState(plugin.version || ''); // Allow version override

  const handleInstall = async () => {
    setInstalling(true);
    setContextError(null); // Clear previous errors
    const success = await installPlugin({
      moduleName: plugin.import,
      version: version || undefined, // Send version only if specified
    });
    if (!success) {
      // Error is set in context, alert is for immediate feedback
      alert(`Error installing plugin: ${contextError || 'See console for details.'}`);
    }
    setInstalling(false);
  };

  // Fallback icon if iconPath is problematic
  const defaultIcon = (
    <svg xmlns="[http://www.w3.org/2000/svg](http://www.w3.org/2000/svg)" className="h-12 w-12 text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
    </svg>
  );

  return (
    <div className="card flex flex-col justify-between p-5 transform transition-all duration-300 hover:shadow-xl hover:-translate-y-1">
      <div>
        <div className="flex items-start justify-between mb-3">
          <div className="flex-shrink-0 mr-4">
            {plugin.iconPath ? (
              <img
                src={plugin.iconPath.startsWith('http') ? plugin.iconPath : `https://plugins.traefik.io/assets/${plugin.import.replace('github.com/', '')}/${plugin.iconPath.replace('.assets/', '')}`}
                alt={`${plugin.displayName} icon`}
                className="w-12 h-12 object-contain rounded"
                onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'block'; }}
              />
            ) : null}
            <div style={{ display: plugin.iconPath ? 'none' : 'block' }}>{defaultIcon}</div>
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{plugin.displayName}</h3>
            {plugin.author && <p className="text-xs text-gray-500 dark:text-gray-400">by {plugin.author}</p>}
          </div>
          {plugin.stars !== undefined && (
            <div className="flex items-center text-xs text-yellow-500 dark:text-yellow-400">
              <svg xmlns="[http://www.w3.org/2000/svg](http://www.w3.org/2000/svg)" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
              {plugin.stars}
            </div>
          )}
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-300 mb-4 leading-relaxed" style={{ minHeight: '3.5em' }}>
          {plugin.summary || 'No summary available.'}
        </p>
        {plugin.testedWith && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Tested with: {plugin.testedWith}</p>
        )}
        {plugin.import && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-3 font-mono break-all">
            {plugin.import}
          </p>
        )}
      </div>

      <div className="mt-auto space-y-3">
         <div className="flex items-center space-x-2">
            <label htmlFor={`version-${plugin.import}`} className="text-xs text-gray-600 dark:text-gray-400 whitespace-nowrap">Version:</label>
            <input
              id={`version-${plugin.import}`}
              type="text"
              value={version}
              onChange={(e) => setVersion(e.target.value)}
              placeholder="latest (e.g., v1.2.0)"
              className="form-input text-xs py-1 flex-grow"
              disabled={installing || contextLoading}
            />
        </div>
        <div className="flex flex-col sm:flex-row sm:space-x-2 space-y-2 sm:space-y-0">
          {plugin.homepage && (
            <a
              href={plugin.homepage}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-secondary text-xs py-2 flex-1 text-center" // Ensure full width on small screens
            >
              View on GitHub
            </a>
          )}
          <button
            onClick={handleInstall}
            disabled={installing || contextLoading || !plugin.import}
            className="btn btn-primary text-xs py-2 flex-1" // Ensure full width on small screens
          >
            {installing ? 'Installing...' : 'Install Plugin'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PluginCard;