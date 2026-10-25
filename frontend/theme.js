// Appearance preference: "light" (default), "dark", or "auto" (follow the phone).
// Saved per device. applyTheme sets data-theme on <html>, which App.jsx's CSS reads.
const KEY = "tb_theme";
export const THEMES = { light: "Light", dark: "Dark", auto: "Automatic" };

const media = typeof window !== "undefined" && window.matchMedia
  ? window.matchMedia("(prefers-color-scheme: dark)")
  : null;

export const getThemePref = () => {
  try {
    const v = localStorage.getItem(KEY);
    return v in THEMES ? v : "light";
  } catch {
    return "light";
  }
};

export const resolvedTheme = (pref = getThemePref()) =>
  pref === "auto" ? (media?.matches ? "dark" : "light") : pref;

export const applyTheme = (pref = getThemePref()) => {
  document.documentElement.dataset.theme = resolvedTheme(pref);
};

export const setThemePref = (pref) => {
  try { localStorage.setItem(KEY, pref); } catch { /* private mode: applies this session only */ }
  applyTheme(pref);
};

// In "auto", follow the phone switching between light and dark.
media?.addEventListener?.("change", () => {
  if (getThemePref() === "auto") applyTheme("auto");
});
