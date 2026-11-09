import React from "react";
import { Platform, StyleSheet, View } from "react-native";

import SecurityLockScreen from "./SecurityLockScreen";
import { useSecurity } from "./SecurityProvider";

export default function SecurityGate({
  children,
}: {
  children: React.ReactNode;
}) {
  const { ready, isLocked, config } = useSecurity();

  // Wait until security settings are loaded.
  if (!ready) {
    return (
      <View
        style={styles.loadingContainer}
        accessibilityLabel="Loading security settings"
      />
    );
  }

  // Check whether app lock should be enforced.
  const shouldShowLock = Boolean(config.appLockEnabled) && Boolean(isLocked);

  // Do not render protected content while locked.
  if (shouldShowLock) {
    return (
      <View
        style={styles.lockScreen}
        accessibilityLabel="Application locked"
        accessibilityRole="none"
      >
        <SecurityLockScreen />
      </View>
    );
  }

  // Render the application when unlocked.
  return <View style={styles.container}>{children}</View>;
}

const isDesktop = Platform.OS === "web";

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: "100%",
    backgroundColor: "#F3F8F5",
  },

  loadingContainer: {
    flex: 1,
    width: "100%",
    backgroundColor: "#F3F8F5",
  },

  lockScreen: {
    flex: 1,
    width: "100%",
    minHeight: isDesktop ? ("100vh" as any) : undefined,
    backgroundColor: "#F3F8F5",
    justifyContent: "center",
    alignItems: "center",
  },
});
