import { Platform } from "react-native";

type Impact = "light" | "medium" | "heavy";
type Notify = "success" | "warning" | "error";

async function getHaptics() {
  if (Platform.OS === "web") return null;
  try {
    return await import("expo-haptics");
  } catch {
    return null;
  }
}

/** Soft tap — add-to-cart, chip select, stepper */
export async function hapticLight() {
  const H = await getHaptics();
  if (!H) return;
  try {
    await H.impactAsync(H.ImpactFeedbackStyle.Light);
  } catch {
    /* no-op */
  }
}

/** Stronger — place order, status advance, save */
export async function hapticMedium() {
  const H = await getHaptics();
  if (!H) return;
  try {
    await H.impactAsync(H.ImpactFeedbackStyle.Medium);
  } catch {
    /* no-op */
  }
}

export async function hapticHeavy() {
  const H = await getHaptics();
  if (!H) return;
  try {
    await H.impactAsync(H.ImpactFeedbackStyle.Heavy);
  } catch {
    /* no-op */
  }
}

export async function hapticSuccess() {
  const H = await getHaptics();
  if (!H) return;
  try {
    await H.notificationAsync(H.NotificationFeedbackType.Success);
  } catch {
    /* no-op */
  }
}

export async function hapticError() {
  const H = await getHaptics();
  if (!H) return;
  try {
    await H.notificationAsync(H.NotificationFeedbackType.Error);
  } catch {
    /* no-op */
  }
}

export async function hapticWarning() {
  const H = await getHaptics();
  if (!H) return;
  try {
    await H.notificationAsync(H.NotificationFeedbackType.Warning);
  } catch {
    /* no-op */
  }
}

export async function hapticImpact(style: Impact = "light") {
  if (style === "medium") return hapticMedium();
  if (style === "heavy") return hapticHeavy();
  return hapticLight();
}

export async function hapticNotify(kind: Notify = "success") {
  if (kind === "error") return hapticError();
  if (kind === "warning") return hapticWarning();
  return hapticSuccess();
}
