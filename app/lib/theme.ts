export const colors = {
  bg: "#F5F4F0",
  ink: "#1D1D1B",
  muted: "#6B6B63",
  faint: "#9A9A90",
  line: "#1D1D1B",
  wash: "#EDEBE4",
  gold: "#E8B62C",
  goldSoft: "#F8E7B0",
  dark: "#1D1D1B",
  grayBtn: "#4A4A46",
  danger: "#B42318",
  ready: "#2F6B3C",
  white: "#FFFFFF",
  overlay: "rgba(29,29,27,0.48)",
};

export const space = {
  xs: 6,
  sm: 10,
  md: 16,
  lg: 24,
  xl: 40,
};

export const type = {
  kicker: {
    fontSize: 11,
    letterSpacing: 2.2,
    fontWeight: "700" as const,
    textTransform: "uppercase" as const,
  },
  title: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "800" as const,
    letterSpacing: 0.4,
  },
  section: {
    fontSize: 18,
    fontWeight: "800" as const,
    letterSpacing: 0.6,
    textTransform: "uppercase" as const,
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "400" as const,
  },
  small: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "400" as const,
  },
};

export const shadow = {
  card: {
    shadowColor: "#1D1D1B",
    shadowOpacity: 1,
    shadowRadius: 0,
    shadowOffset: { width: 4, height: 4 },
    elevation: 0,
  },
  hard: {
    shadowColor: "#1D1D1B",
    shadowOpacity: 1,
    shadowRadius: 0,
    shadowOffset: { width: 6, height: 6 },
    elevation: 0,
  },
};

export const radius = 2;
