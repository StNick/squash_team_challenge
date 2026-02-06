import { useState, useEffect } from "react";

export type Orientation = "portrait" | "landscape";

export function useOrientation(): Orientation {
  const [orientation, setOrientation] = useState<Orientation>(() => {
    if (typeof window === "undefined") return "portrait";
    return window.matchMedia("(orientation: landscape)").matches
      ? "landscape"
      : "portrait";
  });

  useEffect(() => {
    const mediaQuery = window.matchMedia("(orientation: landscape)");

    const handleChange = (e: MediaQueryListEvent) => {
      setOrientation(e.matches ? "landscape" : "portrait");
    };

    // Modern browsers
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener("change", handleChange);
      return () => mediaQuery.removeEventListener("change", handleChange);
    }

    // Fallback for older browsers
    mediaQuery.addListener(handleChange);
    return () => mediaQuery.removeListener(handleChange);
  }, []);

  return orientation;
}
