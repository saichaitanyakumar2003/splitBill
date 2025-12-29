export const theme = {
  colors: {
    // Vibrant orange theme with light accents
    background: '#FF6B35',           // Vibrant orange
    backgroundDark: '#E85A2A',       // Darker orange
    backgroundGradientStart: '#FF8C5A',
    backgroundGradientEnd: '#FF5722',
    
    surface: 'rgba(255, 255, 255, 0.15)',
    surfaceElevated: 'rgba(255, 255, 255, 0.22)',
    surfaceSolid: '#FFFFFF',
    
    primary: '#FFFFFF',              // White as primary action color
    primaryMuted: 'rgba(255, 255, 255, 0.85)',
    accent: '#1A1A1A',               // Dark accent for contrast
    accentSecondary: '#FFD93D',      // Gold highlights
    
    text: '#FFFFFF',
    textDark: '#1A1A1A',
    textSecondary: 'rgba(255, 255, 255, 0.75)',
    textMuted: 'rgba(255, 255, 255, 0.5)',
    
    border: 'rgba(255, 255, 255, 0.2)',
    borderLight: 'rgba(255, 255, 255, 0.3)',
    
    success: '#4ADE80',
    error: '#FF4757',
    warning: '#FFD93D',
    
    // Card backgrounds
    cardBg: '#FFFFFF',
    cardText: '#1A1A1A',
    cardTextSecondary: '#666666',
  },
  
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
  },
  
  borderRadius: {
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    xxl: 32,
    full: 9999,
  },
  
  shadows: {
    sm: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 2,
    },
    md: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 8,
      elevation: 4,
    },
    lg: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.2,
      shadowRadius: 16,
      elevation: 8,
    },
  },
};
