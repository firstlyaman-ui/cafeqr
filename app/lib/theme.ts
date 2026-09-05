export const colors = {
  bg: "#F7F6F2",
  ink: "#1D1D1B",
  muted: "#6B6B63",
  faint: "#9A9A90",
  line: "#E2E0D8",
  wash: "#EDEBE4",
  gold: "#E8B62C",
  goldSoft: "#F8E7B0",
  dark: "#1D1D1B",
  grayBtn: "#4A4A46",
  danger: "#B42318",
  ready: "#2F6B3C",
  white: "#FFFFFF",
  overlay: "rgba(29,29,27,0.42)",
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

/** Soft elevation — Square/Toast-like, not hard brutalist offset */
export const shadow = {
  card: {
    shadowColor: "#1D1D1B",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  hard: {
    shadowColor: "#1D1D1B",
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
};

export const radius = 10;
export const borderWidth = 1;
