import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAppearanceChange, readAppearance, resolveMode, saveAppearance } from '../lib/appearance';

const ThemeContext = createContext();

// Exposes the saved appearance preferences; changes apply to <html> immediately.
export function ThemeProvider({ children }) {
  const [prefs, setPrefs] = useState(readAppearance);

  useEffect(() => onAppearanceChange(setPrefs), []);

  const update = patch => setPrefs(saveAppearance(patch));
  const theme = resolveMode(prefs.mode);
  const toggleTheme = () => update({ mode: theme === 'dark' ? 'light' : 'dark' });

  return (
    <ThemeContext.Provider value={{ theme, prefs, update, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
