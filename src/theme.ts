export type ThemeMode = 'light' | 'dark' | 'system';
export type Scheme = 'light' | 'dark';

export type Palette = {
  background: string;
  surface: string;
  surfaceMuted: string;
  text: string;
  textSecondary: string;
  border: string;
  accent: string;
  accentContrast: string;
  danger: string;
  success: string;
};

export const lightPalette: Palette = {
  background: '#F6F7FB',
  surface: '#FFFFFF',
  surfaceMuted: '#F0F1F6',
  text: '#1F2128',
  textSecondary: '#8A8F9C',
  border: '#E8E9F0',
  accent: '#6C63FF',
  accentContrast: '#FFFFFF',
  danger: '#E5484D',
  success: '#30A46C',
};

export const darkPalette: Palette = {
  background: '#0F1014',
  surface: '#1A1C22',
  surfaceMuted: '#23262E',
  text: '#ECECF1',
  textSecondary: '#9AA0AA',
  border: '#2A2D36',
  accent: '#8B83FF',
  accentContrast: '#FFFFFF',
  danger: '#FF6B6E',
  success: '#46C98E',
};

export function effectiveScheme(mode: ThemeMode, system: Scheme | null | undefined): Scheme {
  return mode === 'system' ? (system ?? 'light') : mode;
}

export function resolvePalette(mode: ThemeMode, system: Scheme | null | undefined): Palette {
  return effectiveScheme(mode, system) === 'dark' ? darkPalette : lightPalette;
}

export const THEME_CYCLE: ThemeMode[] = ['light', 'dark', 'system'];

export function themeModeLabel(mode: ThemeMode): string {
  if (mode === 'light') return '浅色';
  if (mode === 'dark') return '深色';
  return '跟随系统';
}
