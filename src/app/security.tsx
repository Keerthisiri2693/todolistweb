import { useSecurity } from "@/security/SecurityProvider";
import { Ionicons } from "@expo/vector-icons";
import * as LocalAuthentication from "expo-local-authentication";
import { useRouter } from "expo-router";
import React, { useMemo, useRef, useState } from "react";
import {
  Alert,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type PatternGridProps = {
  onComplete: (pattern: number[]) => void;
  disabled?: boolean;
  resetKey?: number;
};

const isWeb = Platform.OS === "web";

/** Use browser dialogs in Electron/Expo Web and native dialogs on Android/iOS. */
function showMessage(title: string, message: string) {
  if (isWeb && typeof window !== "undefined") {
    window.alert(`${title}\n\n${message}`);
    return;
  }
  Alert.alert(title, message);
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Please try again.";
}

function PatternGrid({
  onComplete,
  disabled = false,
  resetKey = 0,
}: PatternGridProps) {
  const { width: windowWidth } = useWindowDimensions();
  const gridSize = Math.max(220, Math.min(windowWidth - 72, 300));
  const dotRadius = 12;
  const hitRadius = 30;

  const [selected, setSelected] = useState<number[]>([]);
  const selectedRef = useRef<number[]>([]);
  const gridSizeRef = useRef(gridSize);
  const completedRef = useRef(false);
  const drawingRef = useRef(false);

  gridSizeRef.current = gridSize;

  const centers = useMemo(
    () =>
      Array.from({ length: 9 }, (_, index) => ({
        x: (index % 3) * (gridSize / 3) + gridSize / 6,
        y: Math.floor(index / 3) * (gridSize / 3) + gridSize / 6,
      })),
    [gridSize],
  );

  const clearPattern = () => {
    selectedRef.current = [];
    setSelected([]);
    completedRef.current = false;
    drawingRef.current = false;
  };

  React.useEffect(() => {
    clearPattern();
    // resetKey intentionally resets the drawing surface between confirmations.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);

  const addDotAt = (x: number, y: number) => {
    const size = gridSizeRef.current;
    const cell = size / 3;
    const col = Math.max(0, Math.min(2, Math.round((x - cell / 2) / cell)));
    const row = Math.max(0, Math.min(2, Math.round((y - cell / 2) / cell)));
    const index = row * 3 + col;
    const centerX = col * cell + cell / 2;
    const centerY = row * cell + cell / 2;

    if (Math.hypot(x - centerX, y - centerY) > hitRadius) return;
    if (selectedRef.current.includes(index)) return;

    // Include a skipped middle dot, as Android pattern locks do.
    const previous = selectedRef.current[selectedRef.current.length - 1];
    if (previous !== undefined) {
      const prevRow = Math.floor(previous / 3);
      const prevCol = previous % 3;
      const rowDiff = row - prevRow;
      const colDiff = col - prevCol;
      let middle: number | null = null;

      if (Math.abs(rowDiff) === 2 && colDiff === 0) {
        middle = ((prevRow + row) / 2) * 3 + col;
      } else if (Math.abs(colDiff) === 2 && rowDiff === 0) {
        middle = row * 3 + (prevCol + col) / 2;
      } else if (Math.abs(rowDiff) === 2 && Math.abs(colDiff) === 2) {
        middle = ((prevRow + row) / 2) * 3 + (prevCol + col) / 2;
      }

      if (middle !== null && !selectedRef.current.includes(middle)) {
        selectedRef.current = [...selectedRef.current, middle];
      }
    }

    selectedRef.current = [...selectedRef.current, index];
    setSelected([...selectedRef.current]);
  };

  const finishPattern = () => {
    if (disabled || completedRef.current || !drawingRef.current) return;
    drawingRef.current = false;
    completedRef.current = true;

    const result = [...selectedRef.current];
    if (result.length >= 4) {
      onComplete(result);
    } else {
      clearPattern();
      showMessage(
        "Pattern too short",
        "Connect at least 4 dots to create a pattern.",
      );
    }
  };

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => !disabled,
        onMoveShouldSetPanResponder: () => !disabled,
        onPanResponderGrant: (event) => {
          if (disabled) return;
          clearPattern();
          drawingRef.current = true;
          addDotAt(event.nativeEvent.locationX, event.nativeEvent.locationY);
        },
        onPanResponderMove: (event) => {
          if (disabled || completedRef.current || !drawingRef.current) return;
          addDotAt(event.nativeEvent.locationX, event.nativeEvent.locationY);
        },
        onPanResponderRelease: finishPattern,
        onPanResponderTerminate: clearPattern,
        onPanResponderTerminationRequest: () => false,
      }),
    // gridSize is included because the responder is attached to this grid.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [disabled, onComplete, gridSize],
  );

  // React Native Web/Electron uses pointer events for reliable mouse dragging.
  const webPointerHandlers = isWeb
    ? {
        onPointerDown: (event: any) => {
          if (disabled) return;
          event.preventDefault?.();
          clearPattern();
          drawingRef.current = true;
          const native = event.nativeEvent ?? event;
          addDotAt(
            native.locationX ?? native.offsetX ?? 0,
            native.locationY ?? native.offsetY ?? 0,
          );
        },
        onPointerMove: (event: any) => {
          if (disabled || completedRef.current || !drawingRef.current) return;
          const native = event.nativeEvent ?? event;
          addDotAt(
            native.locationX ?? native.offsetX ?? 0,
            native.locationY ?? native.offsetY ?? 0,
          );
        },
        onPointerUp: finishPattern,
        onPointerCancel: clearPattern,
        onPointerLeave: (event: any) => {
          // Do not finish on a brief leave; pointer-up completes the pattern.
          void event;
        },
      }
    : {};

  return (
    <View
      style={[
        styles.patternGrid,
        {
          width: gridSize,
          height: gridSize,
          ...(isWeb
            ? ({
                touchAction: "none",
                userSelect: "none",
                cursor: disabled ? "default" : "crosshair",
              } as any)
            : {}),
        },
      ]}
      {...(isWeb ? (webPointerHandlers as any) : panResponder.panHandlers)}
      accessibilityLabel="3 by 3 pattern grid"
    >
      {selected.slice(1).map((index, position) => {
        const from = centers[selected[position]];
        const to = centers[index];
        if (!from || !to) return null;
        const dx = to.x - from.x;
        const dy = to.y - from.y;
        const length = Math.hypot(dx, dy);
        const angle = Math.atan2(dy, dx);
        const midX = (from.x + to.x) / 2;
        const midY = (from.y + to.y) / 2;

        return (
          <View
            key={`line-${position}`}
            pointerEvents="none"
            style={{
              position: "absolute",
              left: midX,
              top: midY - 2,
              width: length,
              height: 4,
              borderRadius: 2,
              backgroundColor: "#10B981",
              transform: [
                { translateX: -length / 2 },
                { rotate: `${angle}rad` },
              ],
            }}
          />
        );
      })}

      {centers.map((center, index) => (
        <View
          key={index}
          pointerEvents="none"
          style={{
            position: "absolute",
            left: center.x - dotRadius,
            top: center.y - dotRadius,
            width: dotRadius * 2,
            height: dotRadius * 2,
            borderRadius: dotRadius,
            borderWidth: 2,
            borderColor: "#10B981",
            backgroundColor: selected.includes(index) ? "#10B981" : "#FFFFFF",
          }}
        />
      ))}
    </View>
  );
}

export default function SecuritySettingsScreen() {
  const router = useRouter();
  const { width: windowWidth } = useWindowDimensions();
  const isDesktop = Platform.OS === "web";

  const {
    config,
    setPin,
    changePin,
    updateSettings,
    enableAppLock,
    disableAppLock,
    setPattern,
    removeAppPattern,
  } = useSecurity();

  const [newPin, setNewPin] = useState("");
  const [oldPin, setOldPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [busy, setBusy] = useState(false);

  const [patternSetupVisible, setPatternSetupVisible] = useState(false);
  const [firstPattern, setFirstPattern] = useState<number[] | null>(null);
  const [patternResetKey, setPatternResetKey] = useState(0);
  const [patternMessage, setPatternMessage] = useState(
    "Draw a pattern connecting at least 4 dots.",
  );

  const hasPin = Boolean(config.pinHash && config.pinSalt);
  const hasPattern = Boolean(config.patternHash && config.patternSalt);
  const hasUnlockMethod = hasPin || hasPattern;
  const contentWidth = isDesktop ? Math.min(windowWidth - 48, 760) : undefined;

  const savePin = async () => {
    if (!/^\d{6,8}$/.test(newPin)) {
      showMessage("Invalid PIN", "Enter 6–8 digits.");
      return;
    }

    if (hasPin && !/^\d{6,8}$/.test(oldPin)) {
      showMessage("Current PIN required", "Enter your current 6–8 digit PIN.");
      return;
    }

    if (newPin !== confirmPin) {
      showMessage("PIN mismatch", "The two PINs do not match.");
      return;
    }

    if (busy) return;
    setBusy(true);
    try {
      if (hasPin) {
        const changed = await changePin(oldPin, newPin);
        if (!changed) {
          showMessage("Incorrect PIN", "Your current PIN is incorrect.");
          return;
        }
      } else {
        await setPin(newPin);
      }

      setOldPin("");
      setNewPin("");
      setConfirmPin("");
      showMessage("PIN saved", "Your security PIN has been updated.");
    } catch (error) {
      showMessage("Unable to save PIN", getErrorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const toggleAppLock = async (enabled: boolean) => {
    try {
      if (enabled) {
        if (!hasUnlockMethod) {
          showMessage(
            "Set a PIN or pattern first",
            "Create a security PIN or pattern before enabling app lock.",
          );
          return;
        }
        await enableAppLock();
      } else {
        await disableAppLock();
      }
    } catch (error) {
      showMessage("Unable to update app lock", getErrorMessage(error));
    }
  };

  const toggleBiometrics = async (enabled: boolean) => {
    if (isDesktop) {
      showMessage(
        "Biometrics unavailable",
        "Fingerprint authentication is not supported by this Electron desktop implementation. Use your PIN or pattern instead.",
      );
      return;
    }

    try {
      if (!enabled) {
        await updateSettings({ biometricEnabled: false });
        return;
      }

      if (!hasPin) {
        showMessage(
          "Set a PIN first",
          "Configure a security PIN before enabling biometric unlock.",
        );
        return;
      }

      const hardware = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();

      if (!hardware || !enrolled) {
        showMessage(
          "Biometrics unavailable",
          "Set up a fingerprint or supported biometric in your device settings first.",
        );
        return;
      }

      await updateSettings({ biometricEnabled: true });
      showMessage("Enabled", "Biometric unlock is enabled.");
    } catch (error) {
      showMessage("Unable to update biometrics", getErrorMessage(error));
    }
  };

  const beginPatternSetup = () => {
    setFirstPattern(null);
    setPatternMessage("Draw a pattern connecting at least 4 dots.");
    setPatternResetKey((key) => key + 1);
    setPatternSetupVisible(true);
  };

  const handlePatternDrawn = async (drawnPattern: number[]) => {
    if (!firstPattern) {
      setFirstPattern(drawnPattern);
      setPatternMessage("Draw the same pattern again to confirm.");
      setPatternResetKey((key) => key + 1);
      return;
    }

    if (
      firstPattern.length !== drawnPattern.length ||
      firstPattern.some((dot, index) => dot !== drawnPattern[index])
    ) {
      setFirstPattern(null);
      setPatternMessage("Patterns did not match. Start again.");
      setPatternResetKey((key) => key + 1);
      return;
    }

    setBusy(true);
    try {
      await setPattern(drawnPattern);
      setPatternSetupVisible(false);
      setFirstPattern(null);
      showMessage("Pattern saved", "Your pattern lock has been configured.");
    } catch (error) {
      showMessage("Unable to save pattern", getErrorMessage(error));
    } finally {
      setBusy(false);
      setPatternResetKey((key) => key + 1);
    }
  };

  const performRemovePattern = async () => {
    try {
      await removeAppPattern();
      showMessage("Pattern removed", "Your pattern has been removed.");
    } catch (error) {
      showMessage("Unable to remove pattern", getErrorMessage(error));
    }
  };

  const handleRemovePattern = () => {
    const title = "Remove pattern lock?";
    const message = "You will no longer be able to unlock using this pattern.";

    if (isDesktop && typeof window !== "undefined") {
      if (window.confirm(`${title}\n\n${message}`)) {
        void performRemovePattern();
      }
      return;
    }

    Alert.alert(title, message, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: () => void performRemovePattern(),
      },
    ]);
  };

  const Row = ({
    title,
    description,
    value,
    onValueChange,
    disabled = false,
  }: {
    title: string;
    description: string;
    value: boolean;
    onValueChange: (value: boolean) => void | Promise<void>;
    disabled?: boolean;
  }) => (
    <View style={styles.row}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowDescription}>{description}</Text>
      </View>
      <Switch
        value={value}
        disabled={disabled}
        onValueChange={(nextValue) => void onValueChange(nextValue)}
        trackColor={{ false: "#D1D5DB", true: "#A7F3D0" }}
        thumbColor={value ? "#059669" : "#F9FAFB"}
      />
    </View>
  );

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          isDesktop && styles.desktopContent,
          contentWidth ? { width: contentWidth, alignSelf: "center" } : null,
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <Pressable
          onPress={() => router.back()}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          hitSlop={8}
        >
          <Ionicons name="arrow-back" size={20} color="#172B22" />
          <Text style={styles.backButtonText}>Back</Text>
        </Pressable>

        <View style={styles.pageHeader}>
          <Text style={styles.heading}>Privacy & Security</Text>
          <Text style={styles.subtitle}>
            Protect your notes and control private previews.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>PIN protection</Text>
          {hasPin ? (
            <>
              <Text style={styles.configuredText}>
                A security PIN is configured.
              </Text>
              <TextInput
                value={oldPin}
                onChangeText={(value) =>
                  setOldPin(value.replace(/\D/g, "").slice(0, 8))
                }
                placeholder="Current PIN"
                placeholderTextColor="#7B8794"
                keyboardType="number-pad"
                secureTextEntry
                maxLength={8}
                style={styles.input}
                autoComplete="off"
                textContentType="none"
              />
            </>
          ) : (
            <Text style={styles.rowDescription}>
              Create a PIN to enable PIN-based unlock.
            </Text>
          )}

          <TextInput
            value={newPin}
            onChangeText={(value) =>
              setNewPin(value.replace(/\D/g, "").slice(0, 8))
            }
            placeholder="New 6–8 digit PIN"
            placeholderTextColor="#7B8794"
            keyboardType="number-pad"
            secureTextEntry
            maxLength={8}
            style={styles.input}
            autoComplete="off"
            textContentType="none"
          />

          <TextInput
            value={confirmPin}
            onChangeText={(value) =>
              setConfirmPin(value.replace(/\D/g, "").slice(0, 8))
            }
            placeholder="Confirm new PIN"
            placeholderTextColor="#7B8794"
            keyboardType="number-pad"
            secureTextEntry
            maxLength={8}
            style={styles.input}
            autoComplete="off"
            textContentType="none"
          />

          <Pressable
            disabled={busy}
            onPress={() => void savePin()}
            style={({ pressed }) => [
              styles.primaryButton,
              busy && styles.disabledButton,
              pressed && !busy && styles.pressedButton,
            ]}
          >
            <Text style={styles.primaryButtonText}>
              {busy ? "Saving..." : hasPin ? "Change PIN" : "Set PIN"}
            </Text>
          </Pressable>
        </View>

        <View style={[styles.card, styles.patternCard]}>
          <Text style={styles.sectionTitle}>Pattern lock</Text>
          <Text style={styles.rowDescription}>
            Draw a pattern on the 3×3 grid. Connect at least four dots and
            confirm the same pattern twice.{" "}
            {isDesktop
              ? "Use your mouse to drag across the dots."
              : "Drag your finger across the dots."}
          </Text>

          <View style={styles.patternStatus}>
            <View
              style={[
                styles.statusDot,
                { backgroundColor: hasPattern ? "#10B981" : "#9CA3AF" },
              ]}
            />
            <Text style={styles.patternStatusText}>
              {hasPattern
                ? "Pattern lock is configured"
                : "No pattern configured"}
            </Text>
          </View>

          {patternSetupVisible ? (
            <View style={styles.patternSetup}>
              <Text style={styles.patternMessage}>{patternMessage}</Text>
              <PatternGrid
                key={patternResetKey}
                resetKey={patternResetKey}
                disabled={busy}
                onComplete={handlePatternDrawn}
              />
              <Pressable
                onPress={() => {
                  setPatternSetupVisible(false);
                  setFirstPattern(null);
                }}
                style={styles.secondaryButton}
              >
                <Text style={styles.secondaryButtonText}>Cancel</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.patternActions}>
              <Pressable
                onPress={beginPatternSetup}
                style={styles.primaryButton}
              >
                <Text style={styles.primaryButtonText}>
                  {hasPattern ? "Change Pattern" : "Set Pattern Lock"}
                </Text>
              </Pressable>

              {hasPattern && (
                <Pressable
                  onPress={handleRemovePattern}
                  style={styles.removeButton}
                >
                  <Text style={styles.removeButtonText}>Remove Pattern</Text>
                </Pressable>
              )}
            </View>
          )}
        </View>

        <View style={[styles.card, styles.settingsCard]}>
          <Text style={styles.sectionTitle}>App security settings</Text>

          <Row
            title="Require app lock"
            description="Require authentication when opening the protected app."
            value={config.appLockEnabled}
            onValueChange={toggleAppLock}
          />

          <Row
            title="Fingerprint / biometrics"
            description={
              isDesktop
                ? "Not available in this Electron desktop implementation."
                : "Use your device's native biometric prompt."
            }
            value={isDesktop ? false : config.biometricEnabled}
            onValueChange={toggleBiometrics}
            disabled={isDesktop}
          />

          <Row
            title="Auto-lock"
            description="Lock when the app leaves the foreground."
            value={config.autoLockEnabled}
            onValueChange={(value) =>
              updateSettings({ autoLockEnabled: value })
            }
          />

          <Row
            title="Hide private previews"
            description="Hide locked note titles and content previews."
            value={config.hidePrivatePreviews}
            onValueChange={(value) =>
              updateSettings({ hidePrivatePreviews: value })
            }
          />
        </View>

        <Text style={styles.footnote}>
          Keep your PIN or pattern safe. This local implementation does not
          provide PIN or pattern recovery.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = {
  screen: {
    flex: 1,
    backgroundColor: "#F3F8F5",
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  desktopContent: {
    paddingTop: 28,
    paddingHorizontal: 28,
  },
  pageHeader: {
    marginBottom: 4,
  },
  backButton: {
    alignSelf: "flex-start" as const,
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    marginBottom: 10,
    marginLeft: -8,
    borderRadius: 10,
    cursor: "pointer" as any,
  },
  backButtonText: {
    color: "#172B22",
    fontSize: 14,
    fontWeight: "700" as const,
  },
  heading: {
    fontSize: 26,
    fontWeight: "800" as const,
    color: "#172B22",
  },
  subtitle: {
    color: "#718278",
    marginTop: 6,
    marginBottom: 20,
    lineHeight: 20,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E1EAE4",
    ...(isWeb ? ({ boxShadow: "0 5px 18px rgba(23,43,34,0.05)" } as any) : {}),
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "800" as const,
    color: "#172B22",
    marginBottom: 12,
  },
  configuredText: {
    color: "#059669",
    marginBottom: 12,
    fontWeight: "600" as const,
  },
  input: {
    backgroundColor: "#F6FAF7",
    borderWidth: 1,
    borderColor: "#E1EAE4",
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: "#172B22",
    marginBottom: 10,
    outlineStyle: "none" as any,
  },
  primaryButton: {
    backgroundColor: "#10B981",
    borderRadius: 12,
    padding: 15,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    marginTop: 6,
    cursor: "pointer" as any,
  },
  disabledButton: {
    opacity: 0.6,
    cursor: "not-allowed" as any,
  },
  pressedButton: {
    opacity: 0.85,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontWeight: "800" as const,
  },
  patternCard: {
    marginTop: 16,
  },
  patternGrid: {
    alignSelf: "center" as const,
    position: "relative" as const,
    marginVertical: 12,
    backgroundColor: "#F8FCF9",
    borderRadius: 16,
  },
  patternStatus: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 8,
    marginTop: 14,
    marginBottom: 8,
  },
  statusDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
  },
  patternStatusText: {
    color: "#52645A",
    fontSize: 13,
    fontWeight: "600" as const,
  },
  patternSetup: {
    marginTop: 8,
    alignItems: "center" as const,
  },
  patternMessage: {
    textAlign: "center" as const,
    color: "#52645A",
    lineHeight: 20,
    marginTop: 8,
  },
  patternActions: {
    marginTop: 8,
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: "#D6E5DC",
    borderRadius: 12,
    padding: 13,
    alignItems: "center" as const,
    width: "100%" as const,
    marginTop: 10,
    cursor: "pointer" as any,
  },
  secondaryButtonText: {
    color: "#52645A",
    fontWeight: "700" as const,
  },
  removeButton: {
    borderWidth: 1,
    borderColor: "#F3C5C9",
    borderRadius: 12,
    padding: 14,
    alignItems: "center" as const,
    marginTop: 10,
    cursor: "pointer" as any,
  },
  removeButtonText: {
    color: "#C53030",
    fontWeight: "700" as const,
  },
  settingsCard: {
    marginTop: 16,
    paddingHorizontal: 16,
  },
  row: {
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#E8EFEA",
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 12,
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: "700" as const,
    color: "#172B22",
  },
  rowDescription: {
    marginTop: 4,
    color: "#718278",
    fontSize: 12,
    lineHeight: 18,
  },
  footnote: {
    color: "#718278",
    fontSize: 12,
    lineHeight: 18,
    marginTop: 16,
  },
};
