// Reveal the text only when the browser actually starts playing the audio.
export function playWithReveal(audio, reveal) {
  return new Promise((resolve, reject) => {
    let revealed = false;
    audio.onplaying = () => { if (!revealed) { revealed = true; reveal?.(); } };
    const finish = error => {
      audio.onplaying = null; audio.onended = null; audio.onerror = null;
      if (error) reject(error); else resolve();
    };
    audio.onended = () => finish();
    audio.onerror = () => finish(new Error('Ses oynatılamadı.'));
    Promise.resolve(audio.play()).catch(finish);
  });
}
