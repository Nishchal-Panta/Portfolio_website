/**
 * Theme bootstrap.
 *
 * Loaded synchronously from <head>, so it runs before the body is painted and
 * there is no flash of the wrong theme.
 *
 * This is a separate file rather than an inline <script> on purpose: it lets
 * the Content-Security-Policy stay a strict script-src 'self', with no
 * 'unsafe-inline' and no hash to keep in sync.
 */
(function () {
  var root = document.documentElement;
  try {
    var saved = null;
    try {
      saved = window.localStorage.getItem('theme');
    } catch (e) {
      /* private mode, or storage disabled: fall through to the system value */
    }
    var systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    var dark = saved ? saved === 'dark' : systemDark;
    root.setAttribute('data-theme', dark ? 'dark' : 'light');
    var metas = document.querySelectorAll('meta[name="theme-color"]');
    for (var i = 0; i < metas.length; i++) {
      if (metas[i].hasAttribute('media')) continue;
      metas[i].setAttribute('content', dark ? '#111214' : '#f6f4ef');
    }
  } catch (e) {
    root.setAttribute('data-theme', 'light');
  }
})();