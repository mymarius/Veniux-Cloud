// Keeps the cached user (sidebar, dashboard) in sync after a profile change.
export function updateStoredUser(patch) {
  try {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    localStorage.setItem('user', JSON.stringify({ ...user, ...patch }));
  } catch { /* storage unavailable: the next /auth/me refresh fills it in */ }
  window.dispatchEvent(new CustomEvent('veniux:user-updated'));
}

// Center-crops and downsizes an image file to a small JPEG data URL for upload.
export function resizeAvatar(file, size = 256) {
  return new Promise((resolve, reject) => {
    if (!/^image\/(png|jpeg|webp)$/.test(file.type)) return reject(new Error('PNG, JPEG veya WebP bir görsel seçin.'));
    if (file.size > 10 * 1024 * 1024) return reject(new Error('Görsel 10 MB’tan küçük olmalı.'));
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const side = Math.min(img.naturalWidth, img.naturalHeight);
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = size;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, size, size);
      ctx.drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, size, size);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Görsel okunamadı.')); };
    img.src = url;
  });
}
