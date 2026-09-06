import { Alert, Platform } from "react-native";

/** One-shot Are you sure? — web uses window.confirm; native uses Alert. */
export function confirmOnce(title: string, message = "Are you sure?", onYes: () => void): void {
  if (Platform.OS === "web" && typeof window !== "undefined") {
    if (window.confirm(message)) onYes();
    return;
  }
  Alert.alert(title, message, [
    { text: "Cancel", style: "cancel" },
    { text: "Yes", onPress: onYes },
  ]);
}
