import { useContext, useEffect } from "react";
import { useTheme } from "styled-components";

import Theme from "./interface";
import { MutThemeContext, THEME_KEY } from "./Provider";

const useSetTheme = (theme: Theme) => {
  const { setTheme } = useContext(MutThemeContext);
  const currentTheme = useTheme() as Theme;

  useEffect(() => {
    if (!theme || theme.name === currentTheme.name) return;
    setTheme(theme);
    localStorage.setItem(THEME_KEY, theme.name);
  }, [theme, currentTheme.name, setTheme]);
};

export default useSetTheme;
