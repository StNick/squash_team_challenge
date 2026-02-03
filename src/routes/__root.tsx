/// <reference types="vite/client" />
import type { ReactNode } from "react";
import {
  Outlet,
  createRootRouteWithContext,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import appCss from "~/styles.css?url";
import { DevBanner, isDev } from "~/components/ui/DevBanner";
import { ThemeProvider, themeScript, getThemeCookie } from "~/lib/theme";

type Theme = "light" | "dark" | "system";

interface RouterContext {
  theme: Theme;
}

export const Route = createRootRouteWithContext<RouterContext>()({
  beforeLoad: async () => {
    // Get theme from cookie server-side
    const theme = await getThemeCookie();
    return { theme };
  },
  head: () => ({
    meta: [
      {
        charSet: "utf-8",
      },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1",
      },
      {
        title: "Squash Team Challenge",
      },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
    ],
    scripts: [
      {
        // Prevent flash of wrong theme on page load
        children: themeScript,
      },
    ],
  }),
  component: RootComponent,
});

function RootComponent() {
  const { theme } = Route.useRouteContext();

  return (
    <RootDocument theme={theme}>
      <ThemeProvider initialTheme={theme}>
        <Outlet />
      </ThemeProvider>
    </RootDocument>
  );
}

function RootDocument({ children, theme }: Readonly<{ children: ReactNode; theme: Theme }>) {
  // Compute the resolved theme for SSR
  // On server, we can't check system preference, so we default to light for "system"
  const resolvedTheme = theme === "light" ? "light" : theme === "dark" ? "dark" : "";

  return (
    <html lang="en" className={resolvedTheme} suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body className={`min-h-screen bg-gray-50 dark:bg-gray-900 ${isDev() ? "pt-7" : ""}`}>
        <DevBanner />
        {children}
        <Scripts />
      </body>
    </html>
  );
}
