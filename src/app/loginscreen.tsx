import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import * as Crypto from "expo-crypto";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { getFcmToken } from "../../services/fcmToken";
import { secureGet, secureSet } from "../../services/secureStorage";

import { router } from "expo-router";
import API from "../../services/api";

const COLORS = {
  primary: "#064E3B",
  primaryDark: "#043D2F",
  background: "#F4F2E8",
  surface: "#FFFFFF",
  text: "#24352F",
  secondaryText: "#78827B",
  border: "#E9E5D9",
  mint: "#E5F0E9",
  paleMint: "#FCFBF7",
  accent: "#D99036",
  danger: "#C74B45",
};

export default function LoginScreen() {
  const { width } = useWindowDimensions();
  const isDesktop = Platform.OS === "web" && width >= 1000;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const requestFCMPermission = async (): Promise<string | null> => {
    // The web/Electron implementation safely returns null. FCM is native-only.
    try {
      return await getFcmToken();
    } catch (error: any) {
      console.warn(
        "FCM is unavailable on this platform:",
        error?.message || error,
      );
      return null;
    }
  };

  const createPasswordVerifier = async (password: string, salt: string) => {
    return Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      `${salt}:${password}`,
    );
  };

  const saveOfflineLogin = async (
    userId: string,
    userEmail: string,
    userName: string,
    password: string,
  ) => {
    const salt = Crypto.randomUUID();

    const verifier = await createPasswordVerifier(password, salt);

    // SecureStore keys cannot contain a colon. Normalize the ID so the key
    // remains valid on Android/iOS, and use the platform-aware helper on web.
    const safeUserId = userId.replace(/[^A-Za-z0-9._-]/g, "_");
    await secureSet(
      `offlineLogin.${safeUserId}`,
      JSON.stringify({
        email: userEmail.trim().toLowerCase(),
        salt,
        verifier,
      }),
    );

    await AsyncStorage.multiSet([
      ["offlineUserId", userId],
      ["offlineUserEmail", userEmail.trim().toLowerCase()],
      ["offlineUserName", userName || ""],
    ]);
  };

  const handleLogin = async () => {
    const trimmedEmail = email.trim().toLowerCase();

    if (!trimmedEmail) {
      Alert.alert("Required", "Please enter your email.");
      return;
    }

    if (!password) {
      Alert.alert("Required", "Please enter your password.");
      return;
    }

    if (loading) return;

    setLoading(true);

    try {
      const network = await NetInfo.fetch();

      const isOnline =
        network.isConnected === true && network.isInternetReachable !== false;

      // =========================================
      // OFFLINE LOGIN
      // =========================================
      if (!isOnline) {
        const offlineUserId = await AsyncStorage.getItem("offlineUserId");

        const offlineEmail = await AsyncStorage.getItem("offlineUserEmail");

        if (
          !offlineUserId ||
          !offlineEmail ||
          offlineEmail.toLowerCase() !== trimmedEmail
        ) {
          Alert.alert(
            "Offline Login",
            "This account has not been verified for offline access on this device. Connect to the internet and log in first.",
          );
          return;
        }

        const safeUserId = offlineUserId.replace(/[^A-Za-z0-9._-]/g, "_");
        const savedVerifier = await secureGet(`offlineLogin.${safeUserId}`);

        if (!savedVerifier) {
          Alert.alert(
            "Offline Login",
            "Offline credentials are unavailable. Connect to the internet to log in.",
          );
          return;
        }

        const saved = JSON.parse(savedVerifier);

        const enteredVerifier = await createPasswordVerifier(
          password,
          saved.salt,
        );

        if (
          saved.email !== trimmedEmail ||
          saved.verifier !== enteredVerifier
        ) {
          Alert.alert("Login Failed", "Incorrect email or password.");
          return;
        }

        // Offline access is a local session, not a new
        // server authentication or a valid new API token.
        await AsyncStorage.multiSet([
          ["userId", offlineUserId],
          ["userEmail", trimmedEmail],
          ["userName", (await AsyncStorage.getItem("offlineUserName")) || ""],
          ["isLoggedIn", "true"],
          ["offlineMode", "true"],
        ]);

        Alert.alert(
          "Offline Login",
          "Login successful. You are working offline. Sync your data when internet returns.",
          [
            {
              text: "Continue",
              onPress: () => router.replace("/home"),
            },
          ],
        );

        return;
      }

      // =========================================
      // ONLINE LOGIN
      // =========================================
      const response = await API.post("/api/userLoginOrLogout", {
        type: "login",
        email: trimmedEmail,
        password,
      });

      const data = response?.data;

      const userId = data?.userId ?? data?.userid ?? data?.user_id;
      const loginToken = data?.token ?? data?.accessToken ?? data?.access_token;
      const userName = data?.userName ?? data?.username ?? data?.name ?? "";

      if (!userId || !loginToken) {
        Alert.alert(
          "Login Failed",
          data?.message || "The server did not return valid login details.",
        );
        return;
      }

      const normalizedUserId = String(userId).trim();
      const normalizedToken = String(loginToken).trim();

      if (!normalizedUserId || !normalizedToken) {
        Alert.alert("Login Failed", "Invalid server login details.");
        return;
      }

      // Save normal authenticated session
      await AsyncStorage.multiSet([
        ["userId", normalizedUserId],
        ["login_token", normalizedToken],
        ["userEmail", trimmedEmail],
        ["isLoggedIn", "true"],
        ["offlineMode", "false"],
        ["offlineUserId", normalizedUserId],
        ["offlineUserEmail", trimmedEmail],
        ["offlineUserName", String(userName)],
        ["userName", String(userName)],
      ]);

      // Cache the offline password verifier only after
      // the backend confirms successful authentication.
      await saveOfflineLogin(
        normalizedUserId,
        trimmedEmail,
        String(userName),
        password,
      );

      // FCM is optional. Never block login on notification setup.
      const fcmToken = await requestFCMPermission();

      if (fcmToken) {
        await AsyncStorage.multiSet([
          ["fcmToken", fcmToken],
          ["fcmUserId", normalizedUserId],
        ]);

        try {
          await API.post(
            "/api/sendFcmTokenToBackend",
            { token: fcmToken },
            {
              headers: {
                Authorization: `Bearer ${normalizedToken}`,
              },
            },
          );
        } catch (error: any) {
          console.warn("FCM upload failed:", error?.message);
        }
      }

      router.replace("/home");
    } catch (error: any) {
      console.error(
        "Login error:",
        error?.response?.data || error?.message || error,
      );

      Alert.alert(
        "Login Failed",
        error?.response?.data?.message ||
          "Unable to verify your login. Check your connection and try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            isDesktop && styles.desktopScrollContent,
          ]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={
            Platform.OS === "ios" ? "interactive" : "on-drag"
          }
          showsVerticalScrollIndicator={false}
          automaticallyAdjustKeyboardInsets={Platform.OS === "ios"}
        >
          <View
            style={[styles.brandHeader, isDesktop && styles.desktopBrandHeader]}
          >
            <View style={styles.brandMark}>
              <Ionicons name="checkmark-done" size={27} color="#FFFFFF" />
            </View>
            <Text style={styles.brandName}>
              Todo<Text style={styles.brandAccent}>List</Text>
            </Text>
            <Text style={styles.brandTagline}>Make room for what matters.</Text>

            {isDesktop && (
              <View style={styles.desktopHeroContent}>
                <Text style={styles.desktopHeroEyebrow}>
                  YOUR PERSONAL PRODUCTIVITY SPACE
                </Text>
                <Text style={styles.desktopHeroTitle}>
                  Make time for what matters.
                </Text>
                <Text style={styles.desktopHeroDescription}>
                  Bring your tasks, notes and daily plans together in one calm,
                  organized workspace.
                </Text>
                <View style={styles.desktopFeatureList}>
                  {[
                    ["checkbox-outline", "Organize everyday tasks"],
                    ["document-text-outline", "Keep notes in one place"],
                    ["calendar-outline", "Plan your schedule"],
                    ["notifications-outline", "Stay on top of reminders"],
                  ].map(([icon, label]) => (
                    <View style={styles.desktopFeatureRow} key={label}>
                      <View style={styles.desktopFeatureIcon}>
                        <Ionicons
                          name={icon as any}
                          size={18}
                          color={COLORS.primary}
                        />
                      </View>
                      <Text style={styles.desktopFeatureText}>{label}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </View>

          <View style={[styles.card, isDesktop && styles.desktopCard]}>
            <View style={styles.headingRow}>
              <View style={styles.headingCopy}>
                <Text style={styles.greeting}>YOUR PRODUCTIVE LIFE</Text>
                <Text style={styles.title}>Welcome back</Text>
                <Text style={styles.subtitle}>
                  Log in to continue your tasks, notes and daily plans.
                </Text>
              </View>
              <View style={styles.headingIcon}>
                <Ionicons
                  name="calendar-outline"
                  size={25}
                  color={COLORS.primary}
                />
              </View>
            </View>

            <View style={styles.inputContainer}>
              <View style={styles.inputIcon}>
                <Ionicons
                  name="mail-outline"
                  size={19}
                  color={COLORS.primary}
                />
              </View>
              <TextInput
                placeholder="Email address"
                placeholderTextColor={COLORS.secondaryText}
                value={email}
                onChangeText={setEmail}
                style={styles.input}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                editable={!loading}
                returnKeyType="next"
                accessibilityLabel="Email address"
              />
            </View>

            <View style={styles.inputContainer}>
              <View style={styles.inputIcon}>
                <Ionicons
                  name="lock-closed-outline"
                  size={19}
                  color={COLORS.primary}
                />
              </View>
              <TextInput
                placeholder="Password"
                placeholderTextColor={COLORS.secondaryText}
                value={password}
                onChangeText={setPassword}
                style={styles.input}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                editable={!loading}
                returnKeyType="done"
                onSubmitEditing={handleLogin}
                accessibilityLabel="Password"
              />
              <Pressable
                onPress={() => setShowPassword((current) => !current)}
                disabled={loading}
                hitSlop={10}
                accessibilityLabel={
                  showPassword ? "Hide password" : "Show password"
                }
              >
                <Ionicons
                  name={showPassword ? "eye-off-outline" : "eye-outline"}
                  size={21}
                  color={COLORS.secondaryText}
                />
              </Pressable>
            </View>

            <Pressable
              style={[styles.loginButton, loading && styles.buttonDisabled]}
              onPress={handleLogin}
              disabled={loading}
              accessibilityRole="button"
              accessibilityLabel="Log in"
            >
              {loading ? (
                <>
                  <ActivityIndicator color="#FFFFFF" />
                  <Text style={styles.loginButtonText}>Signing in...</Text>
                </>
              ) : (
                <>
                  <Text style={styles.loginButtonText}>Log in</Text>
                  <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
                </>
              )}
            </Pressable>

            <View style={styles.registerRow}>
              <Text style={styles.registerText}>Don't have an account?</Text>
              <Pressable
                onPress={() => router.push("/registerscreen")}
                disabled={loading}
                hitSlop={8}
              >
                <Text style={styles.registerLink}>Create account</Text>
              </Pressable>
            </View>
          </View>

          {!isDesktop && (
            <View style={styles.footer}>
              <Ionicons name="leaf-outline" size={16} color={COLORS.primary} />
              <Text style={styles.footerText}>
                Small steps. Meaningful progress.
              </Text>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 24,
    justifyContent: "center",
  },
  brandHeader: { alignItems: "center", marginBottom: 22 },
  brandMark: {
    width: 54,
    height: 54,
    borderRadius: 18,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 9,
  },
  brandName: {
    color: COLORS.primary,
    fontSize: 27,
    fontWeight: "900",
    letterSpacing: -1,
  },
  brandAccent: { color: COLORS.accent },
  brandTagline: { color: COLORS.secondaryText, fontSize: 12, marginTop: 4 },
  card: {
    width: "100%",
    maxWidth: 480,
    alignSelf: "center",
    backgroundColor: COLORS.surface,
    borderRadius: 25,
    paddingHorizontal: 20,
    paddingVertical: 22,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: "#26392F",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.07,
    shadowRadius: 20,
    elevation: 3,
  },
  headingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 18,
    gap: 10,
  },
  headingCopy: { flex: 1 },
  greeting: {
    color: COLORS.primary,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.5,
    marginBottom: 7,
  },
  title: {
    color: COLORS.text,
    fontSize: 25,
    fontWeight: "800",
    letterSpacing: -0.7,
  },
  subtitle: {
    color: COLORS.secondaryText,
    fontSize: 11,
    lineHeight: 16,
    marginTop: 4,
  },
  headingIcon: {
    width: 42,
    height: 42,
    borderRadius: 15,
    backgroundColor: COLORS.mint,
    alignItems: "center",
    justifyContent: "center",
  },
  inputContainer: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.paleMint,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    paddingHorizontal: 10,
    marginBottom: 12,
  },
  inputIcon: {
    width: 30,
    height: 30,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  input: {
    flex: 1,
    minWidth: 0,
    minHeight: 48,
    color: COLORS.text,
    fontSize: 13,
    paddingVertical: 7,
  },
  loginButton: {
    minHeight: 53,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: COLORS.primary,
    borderRadius: 13,
    marginTop: 4,
    paddingHorizontal: 16,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.14,
    shadowRadius: 6,
    elevation: 2,
  },
  buttonDisabled: { opacity: 0.65 },
  loginButtonText: { color: "#FFFFFF", fontSize: 14, fontWeight: "800" },
  registerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    flexWrap: "wrap",
    gap: 5,
    marginTop: 14,
  },
  registerText: { color: COLORS.secondaryText, fontSize: 12 },
  registerLink: { color: COLORS.primary, fontSize: 13, fontWeight: "800" },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    marginTop: 12,
  },
  footerText: { color: COLORS.secondaryText, fontSize: 11 },
  desktopScrollContent: {
    flexGrow: 1,
    width: "100%",
    maxWidth: 1500,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 56,
    paddingHorizontal: 56,
    paddingVertical: 36,
  },
  desktopBrandHeader: {
    flex: 1,
    minWidth: 0,
    maxWidth: 570,
    minHeight: 650,
    alignSelf: "stretch",
    justifyContent: "center",
    alignItems: "flex-start",
    backgroundColor: "#E9EFE5",
    borderRadius: 28,
    paddingHorizontal: 46,
    paddingVertical: 42,
    marginBottom: 0,
  },
  desktopHeroContent: { width: "100%", marginTop: 70 },
  desktopHeroEyebrow: {
    color: COLORS.primary,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.7,
    marginBottom: 16,
  },
  desktopHeroTitle: {
    color: COLORS.text,
    fontSize: 43,
    lineHeight: 52,
    fontWeight: "900",
    letterSpacing: -1.5,
    maxWidth: 430,
  },
  desktopHeroDescription: {
    color: COLORS.secondaryText,
    fontSize: 15,
    lineHeight: 25,
    marginTop: 17,
    maxWidth: 410,
  },
  desktopFeatureList: { gap: 17, marginTop: 38 },
  desktopFeatureRow: { flexDirection: "row", alignItems: "center", gap: 13 },
  desktopFeatureIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  desktopFeatureText: { color: COLORS.text, fontSize: 14, fontWeight: "600" },
  desktopCard: {
    flex: 1,
    width: "100%",
    maxWidth: 590,
    alignSelf: "center",
    paddingHorizontal: 34,
    paddingVertical: 30,
    borderRadius: 24,
  },
});
