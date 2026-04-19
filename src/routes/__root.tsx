/**
 * Root route — app shell. Renders only the outlet + site footer.
 * Top bar is rendered by each page so it can slot its own controls in.
 */
import { Outlet, createRootRoute } from "@tanstack/react-router";
import { SiteFooter } from "../components/SiteFooter";

export const Route = createRootRoute({
  component: RootComponent,
});

function RootComponent() {
  return (
    <div className="min-h-dvh flex flex-col bg-surface-alt">
      <Outlet />
      <SiteFooter />
    </div>
  );
}
