// Dynamic chart theme based on current background
export const getChartTheme = () => {
  const isDark = document.documentElement.classList.contains('dark') || 
                 document.documentElement.classList.contains('theme-dark');
  
  return {
    axis: {
      stroke: isDark ? 'rgba(255,255,255,0.28)' : 'rgba(0,0,0,0.28)',
      tick: { 
        fill: isDark ? 'rgba(255,255,255,0.65)' : 'rgba(0,0,0,0.65)', 
        fontSize: 12 
      },
    },
    grid: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
    tooltip: {
      backgroundColor: isDark ? 'rgba(24,24,24,0.96)' : 'rgba(255,255,255,0.96)',
      border: isDark ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(0,0,0,0.06)',
      color: isDark ? '#fff' : '#000',
    }
  };
};

// Legacy exports for backward compatibility
export const darkAxis = {
  stroke: 'rgba(255,255,255,0.28)',
  tick: { fill: 'rgba(255,255,255,0.65)', fontSize: 12 },
};
export const gridStroke = 'rgba(255,255,255,0.08)';
export const tooltipStyle = {
  backgroundColor: 'rgba(24,24,24,0.96)',
  border: '1px solid rgba(255,255,255,0.06)',
  color: '#fff',
};