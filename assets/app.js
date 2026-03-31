(function () {
  var THEME_KEY = 'leggo-theme';

  function getStoredTheme() {
    var saved = localStorage.getItem(THEME_KEY);
    return saved === 'dark' || saved === 'light' ? saved : null;
  }

  function getSystemTheme() {
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light';
  }

  function getActiveTheme() {
    return document.documentElement.getAttribute('data-theme') || getStoredTheme() || getSystemTheme();
  }

  function updateThemeColorMeta(theme) {
    var meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) return;
    meta.setAttribute('content', theme === 'dark' ? '#121110' : '#1C1917');
  }

  function updateToggleLabels(theme) {
    var toggles = document.querySelectorAll('[data-theme-toggle]');
    toggles.forEach(function (button) {
      button.setAttribute('aria-label', theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
      button.setAttribute('aria-pressed', String(theme === 'dark'));
      button.textContent = theme === 'dark' ? 'Light mode' : 'Dark mode';
    });
  }

  function applyTheme(theme, persist) {
    var next = theme === 'dark' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', next);
    updateThemeColorMeta(next);
    updateToggleLabels(next);
    if (persist) {
      localStorage.setItem(THEME_KEY, next);
    }
  }

  function initThemeToggle() {
    var active = getActiveTheme();
    applyTheme(active, false);

    document.querySelectorAll('[data-theme-toggle]').forEach(function (button) {
      button.addEventListener('click', function () {
        var current = getActiveTheme();
        var next = current === 'dark' ? 'light' : 'dark';
        applyTheme(next, true);
      });
    });

    if (window.matchMedia) {
      var media = window.matchMedia('(prefers-color-scheme: dark)');
      media.addEventListener('change', function () {
        if (!getStoredTheme()) {
          applyTheme(media.matches ? 'dark' : 'light', false);
        }
      });
    }
  }

  window.LeggoTheme = {
    initThemeToggle: initThemeToggle,
    applyTheme: applyTheme
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initThemeToggle);
  } else {
    initThemeToggle();
  }
})();
