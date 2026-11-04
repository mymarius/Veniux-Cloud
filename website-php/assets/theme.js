// Runs before CSS to avoid a flash of the opposite theme. Storage can be denied.
(()=>{let saved;try{saved=localStorage.getItem('veniux-site-theme');}catch{}const dark=saved==='dark'||(!saved&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.dataset.theme=dark?'dark':'light';})();
