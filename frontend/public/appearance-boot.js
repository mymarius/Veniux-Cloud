// Runs before first paint so a saved dark theme never flashes white (full logic: src/lib/appearance.js).
(function () {
  try {
    var prefs = JSON.parse(localStorage.getItem('veniux_appearance') || '{}') || {};
    var mode = prefs.mode === 'dark' || prefs.mode === 'system' ? prefs.mode : 'light';
    if (mode === 'system') mode = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    var root = document.documentElement;
    root.setAttribute('data-theme', mode);
    root.setAttribute('data-density', prefs.density === 'compact' ? 'compact' : 'comfortable');
    root.style.colorScheme = mode;
    root.setAttribute('data-text-size',['small','large'].includes(prefs.textSize)?prefs.textSize:'standard');
    root.setAttribute('data-corners',['sharp','balanced'].includes(prefs.corners)?prefs.corners:'soft');
    root.setAttribute('data-motion',prefs.motion==='off'?'off':'subtle');
  } catch (e) { /* storage unavailable: light defaults */ }
})();
