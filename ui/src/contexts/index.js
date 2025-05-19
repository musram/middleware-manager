/**
 * Context providers export file
 * This file exports all context providers and hooks to simplify imports
 */

export { AppProvider, useApp } from './AppContext';
export { ResourceProvider, useResources } from './ResourceContext';
export { MiddlewareProvider, useMiddlewares } from './MiddlewareContext';
// Export ServiceContext along with the provider and hook
export { ServiceContext, ServiceProvider, useServices } from './ServiceContext'; // <-- Modified line
export { DataSourceProvider, useDataSource } from './DataSourceContext';
export { PluginProvider, usePlugins } from './PluginContext'; // Add this line