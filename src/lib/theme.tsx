import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from "react";
import { createServerFn } from "@tanstack/react-start";
import { setCookie, getCookie } from "@tanstack/react-start/server";
import { THEME_COOKIE_NAME } from "./constants";

type Theme = "light" | "dark" | "system";

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  resolvedTheme: "light" | "dark";
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

function getSystemTheme(): "light" | "dark" {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

// Server function to get theme from cookie
export const getThemeCookie = createServerFn({ method: "GET" }).handler(
  async () => {
    const theme = getCookie(THEME_COOKIE_NAME);
    if (theme && ["light", "dark", "system"].includes(theme)) {
      return theme as Theme;
    }
    return "system" as Theme;
  }
);

// Server function to set theme cookie
export const setThemeCookie = createServerFn({ method: "POST" })
  .inputValidator((data: { theme: Theme }) => data)
  .handler(async ({ data }) => {
    const useSecureCookie =
      process.env.COOKIE_SECURE !== "false" &&
      process.env.NODE_ENV === "production";

    setCookie(THEME_COOKIE_NAME, data.theme, {
      httpOnly: false, // Allow inline script to read it
      secure: useSecureCookie,
      sameSite: "lax",
      maxAge: 365 * 24 * 60 * 60, // 1 year
      path: "/",
    });

    return { success: true };
  });

interface ThemeProviderProps {
  children: ReactNode;
  initialTheme?: Theme;
}

export function ThemeProvider({ children, initialTheme }: ThemeProviderProps) {
  const [theme, setThemeState] = useState<Theme>(initialTheme ?? "system");
  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">(
    initialTheme === "system" || !initialTheme ? "light" : initialTheme === "dark" ? "dark" : "light"
  );

  // Update resolved theme and apply to document
  useEffect(() => {
    const resolved = theme === "system" ? getSystemTheme() : theme;
    setResolvedTheme(resolved);

    const root = document.documentElement;
    root.classList.remove("light", "dark");
    root.classList.add(resolved);
  }, [theme]);

  // Listen for system theme changes
  useEffect(() => {
    if (theme !== "system") return;

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) => {
      setResolvedTheme(e.matches ? "dark" : "light");
      document.documentElement.classList.remove("light", "dark");
      document.documentElement.classList.add(e.matches ? "dark" : "light");
    };

    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, [theme]);

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    // Set cookie via server function (fire and forget)
    setThemeCookie({ data: { theme: newTheme } });
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, resolvedTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}

/**
 * Inline script to prevent flash of wrong theme on page load.
 * This should be included in the <head> before any content renders.
 * Reads from cookie instead of localStorage.
 */
export const themeScript = `
(function() {
  try {
    var cookies = document.cookie.split(';').reduce(function(acc, c) {
      var parts = c.trim().split('=');
      if (parts.length === 2) acc[parts[0]] = parts[1];
      return acc;
    }, {});
    var stored = cookies['${THEME_COOKIE_NAME}'];
    var theme = stored || 'system';
    var resolved = theme;
    if (theme === 'system') {
      resolved = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    document.documentElement.classList.add(resolved);
  } catch (e) {}
})();
`;
