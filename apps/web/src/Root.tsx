import { App } from "./App.js";

/**
 * The tree main.tsx mounts, kept separate so tests render exactly what users get.
 *
 * Deliberately not wrapped in React StrictMode: @atlaskit/portal appends its
 * container during render and removes it in an effect cleanup, so StrictMode's
 * development-only effect replay detaches the container and every modal
 * (including the rejection dialog) renders into a node that is not on the page.
 */
export function Root() {
  return <App />;
}
