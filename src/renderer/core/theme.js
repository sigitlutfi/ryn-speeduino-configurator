export const ACCENT_COLORS = {
  cyan: { main: '#00d4ff', glow: 'rgba(0, 212, 255, 0.4)' },
  red: { main: '#ff003c', glow: 'rgba(255, 0, 60, 0.4)' },
  green: { main: '#00ffb4', glow: 'rgba(0, 255, 180, 0.4)' },
  purple: { main: '#d672ff', glow: 'rgba(214, 114, 255, 0.4)' },
  orange: { main: '#ff6600', glow: 'rgba(255, 102, 0, 0.4)' },
};

export const getAccent = (id) => ACCENT_COLORS[id] || ACCENT_COLORS.cyan;
