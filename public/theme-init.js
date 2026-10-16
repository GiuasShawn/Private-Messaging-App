// Theme bootstrap — runs before hydration to avoid a flash of the wrong theme.
//
// Dark is the default. A persisted light preference (harmless UI setting,
// localStorage key "messenger.ui.theme") or the OS preference selects light.
// Any failure falls back to dark. This file intentionally contains no user
// content and reads nothing beyond the theme key and the OS color-scheme.
(function () {
  var KEY = "messenger.ui.theme";
  var theme = "dark";
  try {
    var stored = window.localStorage.getItem(KEY);
    if (stored === "light" || stored === "dark") {
      theme = stored;
    } else if (window.matchMedia("(prefers-color-scheme: light)").matches) {
      theme = "light";
    }
  } catch (e) {
    // localStorage may be unavailable (private mode, blocked cookies).
  }
  document.documentElement.setAttribute("data-theme", theme);
})();
