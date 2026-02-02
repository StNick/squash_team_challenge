/**
 * Development environment banner - displays a warning banner when NODE_ENV !== 'production'
 * Fixed at top of viewport to always be visible
 */
export function DevBanner() {
  // Only show in development - this is checked at build time
  if (import.meta.env.PROD) {
    return null;
  }

  return (
    <div className="dev-banner fixed top-0 left-0 right-0 z-50 bg-orange-500 text-black text-center py-1 text-sm font-semibold">
      DEVELOPMENT ENVIRONMENT
    </div>
  );
}

/**
 * Returns true if running in development mode
 * Use to conditionally apply styles for dev banner spacing
 */
export function isDev(): boolean {
  return !import.meta.env.PROD;
}
