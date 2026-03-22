export type ThemeType = 'modern' | 'minimal' | 'executive';

export interface TextStyle {
  fontSize: number;
  fontFamily: string;
  fontStyle: 'normal' | 'bold' | 'italic' | 'italic bold';
  lineHeight: number;
  textTransform?: 'uppercase' | 'none';
  fill: string;
}

export interface TypographySystem {
  name: TextStyle;
  heading: TextStyle;
  role: TextStyle;
  companyDuration: TextStyle;
  body: TextStyle;
  bullet: TextStyle;
}

const baseColors = {
  primary: '#111827',
  secondary: '#4B5563',
  accent: '#000000',
};

export const typographyThemes: Record<ThemeType, TypographySystem> = {
  minimal: {
    name: { fontSize: 22, fontFamily: 'Inter', fontStyle: 'bold', lineHeight: 1.2, fill: baseColors.primary },
    heading: { fontSize: 13, fontFamily: 'Inter', fontStyle: 'bold', lineHeight: 1.4, textTransform: 'uppercase', fill: baseColors.primary },
    role: { fontSize: 12, fontFamily: 'Inter', fontStyle: 'bold', lineHeight: 1.4, fill: baseColors.primary },
    companyDuration: { fontSize: 11, fontFamily: 'Inter', fontStyle: 'normal', lineHeight: 1.4, fill: baseColors.secondary },
    body: { fontSize: 10.5, fontFamily: 'Inter', fontStyle: 'normal', lineHeight: 1.5, fill: baseColors.secondary },
    bullet: { fontSize: 10.5, fontFamily: 'Inter', fontStyle: 'normal', lineHeight: 1.5, fill: baseColors.secondary },
  },
  modern: {
    name: { fontSize: 22, fontFamily: 'Roboto', fontStyle: 'bold', lineHeight: 1.2, fill: baseColors.accent },
    heading: { fontSize: 14, fontFamily: 'Roboto', fontStyle: 'bold', lineHeight: 1.4, textTransform: 'uppercase', fill: baseColors.accent },
    role: { fontSize: 12, fontFamily: 'Roboto', fontStyle: 'bold', lineHeight: 1.4, fill: baseColors.primary },
    companyDuration: { fontSize: 11, fontFamily: 'Roboto', fontStyle: 'normal', lineHeight: 1.4, fill: baseColors.secondary },
    body: { fontSize: 11, fontFamily: 'Roboto', fontStyle: 'normal', lineHeight: 1.5, fill: baseColors.secondary },
    bullet: { fontSize: 11, fontFamily: 'Roboto', fontStyle: 'normal', lineHeight: 1.5, fill: baseColors.secondary },
  },
  executive: {
    name: { fontSize: 22, fontFamily: 'Merriweather', fontStyle: 'bold', lineHeight: 1.2, fill: baseColors.primary },
    heading: { fontSize: 13, fontFamily: 'Merriweather', fontStyle: 'bold', lineHeight: 1.4, textTransform: 'uppercase', fill: baseColors.primary },
    role: { fontSize: 12, fontFamily: 'Inter', fontStyle: 'bold', lineHeight: 1.4, fill: baseColors.primary },
    companyDuration: { fontSize: 11, fontFamily: 'Inter', fontStyle: 'normal', lineHeight: 1.4, fill: baseColors.secondary },
    body: { fontSize: 11, fontFamily: 'Inter', fontStyle: 'normal', lineHeight: 1.5, fill: baseColors.secondary },
    bullet: { fontSize: 11, fontFamily: 'Inter', fontStyle: 'normal', lineHeight: 1.5, fill: baseColors.secondary },
  }
};
