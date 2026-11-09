
import React, { useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  useColorScheme,
  View,
} from "react-native";
import { useSecurity } from "./SecurityProvider";
import { SafeAreaView } from "react-native-safe-area-context";

export default function SecurityLockScreen() {
  const { unlockWithPin, unlockWithPattern, unlockWithBiometrics, config } = useSecurity();

  const isDark = useColorScheme() === "dark";

  const colors = {
    background: isDark ? "#101815" : "#F3F8F5",
    card: isDark ? "#1B2621" : "#FFFFFF",
    text: isDark ? "#F0FDF4" : "#172B22",
    secondary: isDark ? "#A4B8AC" : "#718278",
    border: isDark ? "#34463B" : "#E1EAE4",
    input: isDark ? "#24332B" : "#F6FAF7",
    accent: "#10B981",
    accentDark: "#059669",
    accentSoft: isDark ? "#243F32" : "#DDF8E9",
    error: isDark ? "#FDA4AF" : "#DC3545",
    errorBg: isDark ? "#42252B" : "#FFF0F1",
    white: "#FFFFFF",
  };

  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [unlockMode, setUnlockMode] = useState<"pin" | "pattern">("pin");
  const [patternBusy, setPatternBusy] = useState(false);
  const [patternError, setPatternError] = useState("");
  const hasPattern = Boolean(config.patternHash && config.patternSalt);

  const submitPattern = async (drawnPattern: number[]) => {
    if (patternBusy) return;
    if (drawnPattern.length < 4) {
      setPatternError("Connect at least 4 dots.");
      return;
    }
    setPatternBusy(true);
    setPatternError("");
    try {
      const success = await unlockWithPattern(drawnPattern);
      if (!success) setPatternError("Incorrect pattern. Please try again.");
    } catch {
      setPatternError("Unable to verify your pattern. Please try again.");
    } finally {
      setPatternBusy(false);
    }
  };

  const submitPin = async () => {
    if (busy || pin.length < 6) return;

    Keyboard.dismiss();
    setBusy(true);
    setError("");

    try {
      const success = await unlockWithPin(pin);

      if (!success) {
        setError("Incorrect PIN. Please try again.");
        setPin("");
      }
    } catch {
      setError("Unable to verify your PIN. Please try again.");
      setPin("");
    } finally {
      setBusy(false);
    }
  };

  const submitBiometrics = async () => {
    if (busy || Platform.OS === "web") return;

    setBusy(true);
    setError("");

    try {
      const success = await unlockWithBiometrics();

      if (!success) {
        setError("Fingerprint verification failed. Try your PIN.");
      }
    } catch {
      setError("Biometric authentication failed. Try your PIN.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView
      style={[styles.screen, { backgroundColor: colors.background }]}
    >
      <StatusBar
        barStyle={isDark ? "light-content" : "dark-content"}
        backgroundColor={colors.background}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.container}>
          {/* Brand header */}
          <View style={styles.brandRow}>
            <View
              style={[
                styles.brandIcon,
                { backgroundColor: colors.accentSoft },
              ]}
            >
              <Text style={styles.brandIconText}>N</Text>
            </View>

            <Text style={[styles.brandName, { color: colors.text }]}>
              My Notes
            </Text>

            <View
              style={[
                styles.secureBadge,
                { backgroundColor: colors.accentSoft },
              ]}
            >
              <Text style={[styles.secureBadgeText, { color: colors.accentDark }]}>
                SECURE
              </Text>
            </View>
          </View>

          {/* Hero section */}
          <View style={styles.hero}>
            <View
              style={[
                styles.heroIconOuter,
                { backgroundColor: colors.accentSoft },
              ]}
            >
              <View
                style={[
                  styles.heroIconInner,
                  { backgroundColor: colors.accent },
                ]}
              >
                <Text style={styles.heroLock}>🔒</Text>
              </View>

              <View
                style={[
                  styles.checkBadge,
                  {
                    backgroundColor: colors.card,
                    borderColor: colors.background,
                  },
                ]}
              >
                <Text style={styles.checkBadgeText}>✓</Text>
              </View>
            </View>

            <Text style={[styles.eyebrow, { color: colors.accentDark }]}>
              YOUR PERSONAL SPACE
            </Text>

            <Text style={[styles.title, { color: colors.text }]}>
              Welcome back
            </Text>

            <Text style={[styles.subtitle, { color: colors.secondary }]}>
              Your notes are protected. Unlock using your PIN or pattern.
            </Text>
          </View>

          {/* Unlock method switch */}
          {hasPattern && (
            <View style={styles.modeSwitch}>
              <Pressable
                onPress={() => { setUnlockMode("pin"); setPatternError(""); setError(""); }}
                style={[styles.modeButton, unlockMode === "pin" && { backgroundColor: colors.accent }]}
                accessibilityRole="button"
              >
                <Text style={[styles.modeButtonText, { color: unlockMode === "pin" ? colors.white : colors.text }]}>PIN</Text>
              </Pressable>
              <Pressable
                onPress={() => { setUnlockMode("pattern"); setError(""); setPatternError(""); }}
                style={[styles.modeButton, unlockMode === "pattern" && { backgroundColor: colors.accent }]}
                accessibilityRole="button"
              >
                <Text style={[styles.modeButtonText, { color: unlockMode === "pattern" ? colors.white : colors.text }]}>Pattern</Text>
              </Pressable>
            </View>
          )}

          {/* PIN or pattern unlock card */}
          <View
            style={[
              styles.card,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
              },
            ]}
          >
            <View style={styles.cardHeader}>
              <View style={styles.cardTitleGroup}>
                <Text style={[styles.cardTitle, { color: colors.text }]}>
                  Unlock your notes
                </Text>
                <Text
                  style={[styles.cardSubtitle, { color: colors.secondary }]}
                >
                  {unlockMode === "pin" ? "Enter your 6–8 digit PIN" : "Draw your saved unlock pattern"}
                </Text>
              </View>

              <View
                style={[
                  styles.cardHeaderIcon,
                  { backgroundColor: colors.accentSoft },
                ]}
              >
                <Text style={styles.cardHeaderIconText}>✳</Text>
              </View>
            </View>

            {unlockMode === "pin" ? (
              <>
            <TextInput
              value={pin}
              onChangeText={(value) => {
                setPin(value.replace(/\D/g, "").slice(0, 8));
                if (error) setError("");
              }}
              placeholder="Enter PIN"
              placeholderTextColor={colors.secondary}
              keyboardType="number-pad"
              secureTextEntry
              maxLength={8}
              editable={!busy}
              returnKeyType="done"
              onSubmitEditing={() => void submitPin()}
              accessibilityLabel="Security PIN"
              style={[
                styles.pinInput,
                {
                  color: colors.text,
                  backgroundColor: colors.input,
                  borderColor: error ? colors.error : colors.border,
                },
              ]}
            />

            <View style={styles.pinStatusRow}>
              <View style={styles.pinDots}>
                {Array.from({ length: 6 }).map((_, index) => (
                  <View
                    key={index}
                    style={[
                      styles.pinDot,
                      {
                        backgroundColor:
                          index < pin.length
                            ? colors.accent
                            : colors.border,
                      },
                    ]}
                  />
                ))}
              </View>

              <Text style={[styles.pinCount, { color: colors.secondary }]}>
                {pin.length}/8
              </Text>
            </View>

            {!!error && (
              <View
                style={[
                  styles.errorBox,
                  { backgroundColor: colors.errorBg },
                ]}
              >
                <Text style={[styles.errorIcon, { color: colors.error }]}>
                  !
                </Text>
                <Text style={[styles.errorText, { color: colors.error }]}>
                  {error}
                </Text>
              </View>
            )}

            <Pressable
              onPress={() => void submitPin()}
              disabled={busy || pin.length < 6}
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.primaryButton,
                {
                  backgroundColor: colors.accent,
                  opacity:
                    busy || pin.length < 6 ? 0.55 : pressed ? 0.85 : 1,
                },
              ]}
            >
              {busy ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <>
                  <Text style={styles.primaryButtonText}>Unlock notes</Text>
                  <Text style={styles.buttonArrow}>→</Text>
                </>
              )}
            </Pressable>

              </>
            ) : (
              <View style={styles.patternSection}>
                <Text style={[styles.patternTitle, { color: colors.text }]}>Draw your pattern</Text>
                <Text style={[styles.patternSubtitle, { color: colors.secondary }]}>Connect at least four dots to unlock</Text>
                <PatternGrid
                  disabled={patternBusy}
                  accent={colors.accent}
                  borderColor={colors.border}
                  onComplete={(value) => { setPatternError(""); void submitPattern(value); }}
                />
                {patternBusy && <ActivityIndicator color={colors.accent} style={{ marginTop: 10 }} />}
                {!!patternError && (
                  <View style={[styles.errorBox, { backgroundColor: colors.errorBg }]}>
                    <Text style={[styles.errorIcon, { color: colors.error }]}>!</Text>
                    <Text style={[styles.errorText, { color: colors.error }]}>{patternError}</Text>
                  </View>
                )}
              </View>
            )}

            {Platform.OS !== "web" && config.biometricEnabled && (
              <>
                <View style={styles.separator}>
                  <View
                    style={[
                      styles.separatorLine,
                      { backgroundColor: colors.border },
                    ]}
                  />
                  <Text style={[styles.orText, { color: colors.secondary }]}>
                    OR
                  </Text>
                  <View
                    style={[
                      styles.separatorLine,
                      { backgroundColor: colors.border },
                    ]}
                  />
                </View>

                <Pressable
                  onPress={() => void submitBiometrics()}
                  disabled={busy}
                  accessibilityRole="button"
                  style={({ pressed }) => [
                    styles.biometricButton,
                    {
                      backgroundColor: colors.card,
                      borderColor: colors.border,
                      opacity: busy ? 0.6 : pressed ? 0.75 : 1,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.fingerprintCircle,
                      { backgroundColor: colors.accentSoft },
                    ]}
                  >
                    <Text
                      style={[
                        styles.fingerprint,
                        { color: colors.accentDark },
                      ]}
                    >
                      ◎
                    </Text>
                  </View>

                  <View style={styles.biometricTextGroup}>
                    <Text
                      style={[
                        styles.biometricButtonText,
                        { color: colors.text },
                      ]}
                    >
                      Unlock with fingerprint
                    </Text>
                    <Text
                      style={[
                        styles.biometricSubtitle,
                        { color: colors.secondary },
                      ]}
                    >
                      Use your device biometrics
                    </Text>
                  </View>

                  <Text style={[styles.buttonArrow, { color: colors.accent }]}>
                    →
                  </Text>
                </Pressable>
              </>
            )}
          </View>

          {/* Privacy reassurance */}
          <View style={styles.footer}>
            <Text style={styles.footerIcon}>🛡️</Text>
            <View style={styles.footerTextGroup}>
              <Text style={[styles.footerTitle, { color: colors.text }]}>
                Your privacy matters
              </Text>
              <Text style={[styles.footerText, { color: colors.secondary }]}>
                Your notes stay protected behind your security settings.
              </Text>
            </View>
          </View>

          <Text style={[styles.versionText, { color: colors.secondary }]}>
            PRIVATE BY DESIGN
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}


type PatternGridProps = {
  disabled?: boolean;
  accent: string;
  borderColor: string;
  onComplete: (pattern: number[]) => void;
};

/** Continuous drag-to-draw 3x3 pattern grid. Each dot is represented by 0..8. */
function PatternGrid({ disabled = false, accent, borderColor, onComplete }: PatternGridProps) {
  const [selected, setSelected] = useState<number[]>([]);
  const selectedRef = useRef<number[]>([]);
  const layoutRef = useRef({ width: 0, height: 0 });
  const activeRef = useRef(false);
  const radius = 28;

  const addDotAt = (x: number, y: number) => {
    const { width, height } = layoutRef.current;
    if (!width || !height) return;
    const cellW = width / 3;
    const cellH = height / 3;
    const col = Math.round((x - cellW / 2) / cellW);
    const row = Math.round((y - cellH / 2) / cellH);
    if (row < 0 || row > 2 || col < 0 || col > 2) return;
    const centerX = col * cellW + cellW / 2;
    const centerY = row * cellH + cellH / 2;
    if (Math.hypot(x - centerX, y - centerY) > radius) return;
    const index = row * 3 + col;
    if (selectedRef.current.includes(index)) return;
    const next = [...selectedRef.current, index];
    selectedRef.current = next;
    setSelected(next);
  };

  const responder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => !disabled,
    onMoveShouldSetPanResponder: () => !disabled,
    onPanResponderGrant: (event) => {
      if (disabled) return;
      selectedRef.current = [];
      setSelected([]);
      activeRef.current = true;
      addDotAt(event.nativeEvent.locationX, event.nativeEvent.locationY);
    },
    onPanResponderMove: (event) => {
      if (activeRef.current && !disabled) {
        addDotAt(event.nativeEvent.locationX, event.nativeEvent.locationY);
      }
    },
    onPanResponderRelease: () => {
      activeRef.current = false;
      const completed = [...selectedRef.current];
      selectedRef.current = [];
      setSelected([]);
      if (completed.length >= 4) onComplete(completed);
      else if (completed.length > 0) onComplete(completed);
    },
    onPanResponderTerminate: () => {
      activeRef.current = false;
      selectedRef.current = [];
      setSelected([]);
    },
  }), [disabled, onComplete]);

  return (
    <View
      {...responder.panHandlers}
      onLayout={(event) => {
        layoutRef.current = {
          width: event.nativeEvent.layout.width,
          height: event.nativeEvent.layout.height,
        };
      }}
      style={patternStyles.grid}
      accessibilityLabel="Draw a pattern across the nine dots"
    >
      {Array.from({ length: 9 }, (_, index) => (
        <View key={index} pointerEvents="none" style={patternStyles.cell}>
          <View style={[patternStyles.dot, { borderColor, backgroundColor: selected.includes(index) ? accent : "transparent" }, selected.includes(index) && patternStyles.selectedDot]} />
        </View>
      ))}
    </View>
  );
}

const patternStyles = StyleSheet.create({
  grid: {
    width: 276,
    height: 276,
    flexDirection: "row",
    flexWrap: "wrap",
    alignSelf: "center",
    marginTop: 14,
    marginBottom: 8,
    touchAction: "none",
  } as any,
  cell: {
    width: "33.3333%",
    height: "33.3333%",
    alignItems: "center",
    justifyContent: "center",
  },
  dot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
  },
  selectedDot: {
    transform: [{ scale: 1.25 }],
  },
});

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
  },
  container: {
    width: "100%",
    maxWidth: 480,
    alignSelf: "center",
    paddingHorizontal: 22,
    paddingVertical: 24,
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 30,
  },
  brandIcon: {
    width: 38,
    height: 38,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  brandIconText: {
    fontSize: 22,
    fontWeight: "900",
    color: "#059669",
  },
  brandName: {
    fontSize: 17,
    fontWeight: "800",
    marginLeft: 10,
    letterSpacing: -0.3,
  },
  secureBadge: {
    marginLeft: "auto",
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 20,
  },
  secureBadgeText: {
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1.1,
  },
  hero: {
    alignItems: "center",
    marginBottom: 27,
  },
  heroIconOuter: {
    width: 94,
    height: 94,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 23,
  },
  heroIconInner: {
    width: 65,
    height: 65,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
  },
  heroLock: {
    fontSize: 29,
  },
  checkBadge: {
    position: "absolute",
    right: -3,
    bottom: -3,
    width: 29,
    height: 29,
    borderRadius: 15,
    borderWidth: 3,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#10B981",
  },
  checkBadgeText: {
    fontSize: 15,
    color: "#FFFFFF",
    fontWeight: "900",
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 2,
    marginBottom: 9,
  },
  title: {
    fontSize: 30,
    fontWeight: "900",
    letterSpacing: -1,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
    maxWidth: 300,
    marginTop: 9,
  },
  card: {
    width: "100%",
    borderRadius: 25,
    borderWidth: 1,
    padding: 21,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.05,
    shadowRadius: 18,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 21,
  },
  cardTitleGroup: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: -0.4,
  },
  cardSubtitle: {
    fontSize: 12,
    marginTop: 5,
  },
  cardHeaderIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 12,
  },
  cardHeaderIconText: {
    color: "#059669",
    fontSize: 24,
    fontWeight: "800",
  },
  pinInput: {
    height: 58,
    borderRadius: 15,
    borderWidth: 1,
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
    letterSpacing: 5,
    paddingHorizontal: 14,
  },
  pinStatusRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 13,
  },
  pinDots: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  pinDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  pinCount: {
    fontSize: 11,
    fontWeight: "600",
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    padding: 11,
    marginTop: 15,
    gap: 8,
  },
  errorIcon: {
    width: 19,
    height: 19,
    borderWidth: 1.5,
    borderColor: "#DC3545",
    borderRadius: 10,
    textAlign: "center",
    fontSize: 12,
    fontWeight: "900",
    overflow: "hidden",
  },
  errorText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "600",
  },
  primaryButton: {
    minHeight: 54,
    borderRadius: 15,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 22,
    paddingHorizontal: 17,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
  },
  buttonArrow: {
    fontSize: 21,
    fontWeight: "600",
    color: "#FFFFFF",
    marginLeft: 10,
  },
  separator: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginVertical: 19,
  },
  separatorLine: {
    height: 1,
    flex: 1,
  },
  orText: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.5,
  },
  biometricButton: {
    minHeight: 66,
    borderRadius: 15,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    gap: 12,
  },
  fingerprintCircle: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  fingerprint: {
    fontSize: 29,
    fontWeight: "600",
  },
  biometricTextGroup: {
    flex: 1,
  },
  biometricButtonText: {
    fontSize: 13,
    fontWeight: "800",
  },
  biometricSubtitle: {
    fontSize: 11,
    marginTop: 4,
  },
  modeSwitch: {
    flexDirection: "row",
    alignSelf: "center",
    width: "100%",
    maxWidth: 280,
    padding: 4,
    borderRadius: 14,
    backgroundColor: "#E7F2EB",
    marginBottom: 16,
  },
  modeButton: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 11,
    alignItems: "center",
  },
  modeButtonText: {
    fontSize: 13,
    fontWeight: "800",
  },
  patternSection: {
    alignItems: "center",
    paddingTop: 4,
  },
  patternTitle: {
    fontSize: 15,
    fontWeight: "800",
  },
  patternSubtitle: {
    fontSize: 12,
    textAlign: "center",
    marginTop: 5,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 25,
    paddingHorizontal: 4,
  },
  footerIcon: {
    fontSize: 23,
  },
  footerTextGroup: {
    flex: 1,
  },
  footerTitle: {
    fontSize: 12,
    fontWeight: "800",
    marginBottom: 4,
  },
  footerText: {
    fontSize: 11,
    lineHeight: 17,
  },
  versionText: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 2,
    textAlign: "center",
    marginTop: 25,
  },
});
