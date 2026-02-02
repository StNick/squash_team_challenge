/// <reference types="vite/client" />
import type { ReactNode } from "react";
import {
  Outlet,
  createRootRoute,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import appCss from "~/styles.css?url";
import { DevBanner, isDev } from "~/components/ui/DevBanner";
import { ThemeProvider, themeScript } from "~/lib/theme";

export const Route = createRootRoute({
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
  return (
    <RootDocument>
      <ThemeProvider>
        <Outlet />
      </ThemeProvider>
    </RootDocument>
  );
}

function RootDocument({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
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
