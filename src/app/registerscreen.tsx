import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";

import { SafeAreaView } from "react-native-safe-area-context";
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

export default function RegisterScreen() {
  const { width } = useWindowDimensions();
  const isDesktop = Platform.OS === "web" && width >= 1000;

  const [userName, setUserName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [description, setDescription] = useState("");
  const [image, setImage] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const generateRandomUserId = () =>
    Math.floor(100000 + Math.random() * 900000).toString();

  const pickImage = async () => {
    try {
      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        Alert.alert(
          "Permission Required",
          "Please allow gallery access to select a profile image.",
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets.length > 0) {
        setImage(result.assets[0]);
      }
    } catch (error) {
      console.log("IMAGE PICKER ERROR:", error);
      Alert.alert("Error", "Unable to select image.");
    }
  };

  const handleRegister = async () => {
    const trimmedUserName = userName.trim();
    const trimmedEmail = email.trim().toLowerCase();

    if (!trimmedUserName) {
      Alert.alert("Required", "Please enter your username.");
      return;
    }

    if (!trimmedEmail) {
      Alert.alert("Required", "Please enter your email.");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      Alert.alert("Invalid Email", "Please enter a valid email address.");
      return;
    }

    if (!password) {
      Alert.alert("Required", "Please enter your password.");
      return;
    }

    if (password.length < 6) {
      Alert.alert(
        "Weak Password",
        "Your password must contain at least 6 characters.",
      );
      return;
    }

    if (!confirmPassword) {
      Alert.alert("Required", "Please confirm your password.");
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert("Password Mismatch", "Passwords do not match.");
      return;
    }

    if (loading) return;

    try {
      setLoading(true);

      const userId = generateRandomUserId();
      const formData = new FormData();

      formData.append("userId", userId);
      formData.append("userName", trimmedUserName);
      formData.append("email", trimmedEmail);
      formData.append("password", password);
      formData.append("confirmPassword", confirmPassword);
      formData.append("Description", description.trim());

      if (image) {
        formData.append("profile", {
          uri: image.uri,
          name: image.fileName || "profile.jpg",
          type: image.mimeType || "image/jpeg",
        } as any);
      }

      const response = await API.post("/api/userRegister", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      if (response.data?.success) {
  if (Platform.OS === "web") {
    // Electron / Desktop / Expo Web
    router.replace("/loginscreen");
  } else {
    // Android / iOS
    Alert.alert(
      "Registration Successful",
      "Your account has been created successfully!",
      [
        {
          text: "Continue to Login",
          onPress: () => {
            router.replace("/loginscreen");
          },
        },
      ],
      { cancelable: false }
    );
  }
} else {
  Alert.alert(
    "Registration Failed",
    response.data?.message || "Unable to create your account."
  );
}
    } catch (error: any) {
      console.log(
        "REGISTER ERROR:",
        error?.response?.data || error?.message || error,
      );

      if (error?.response) {
        Alert.alert(
          "Server Error",
          error.response.data?.message ||
            `Server returned ${error.response.status}.`,
        );
      } else if (error?.request) {
        Alert.alert(
          "Network Error",
          "Unable to connect to the server. Check your internet connection and API URL.",
        );
      } else {
        Alert.alert("Error", error?.message || "Something went wrong.");
      }
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
          showsVerticalScrollIndicator={false}
        >
          {/* TodoList brand header */}
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

          {/* Registration card */}
          <View style={[styles.card, isDesktop && styles.desktopCard]}>
            <View style={styles.headingRow}>
              <View style={styles.headingCopy}>
                <Text style={styles.greeting}>YOUR PRODUCTIVE LIFE</Text>
                <Text style={styles.title}>Create account</Text>
                <Text style={styles.subtitle}>
                  Plan your days, one small step at a time.
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

            {/* Compact profile image picker */}
            <TouchableOpacity
              style={styles.profileSection}
              onPress={pickImage}
              disabled={loading}
              activeOpacity={0.82}
              accessibilityRole="button"
              accessibilityLabel={
                image ? "Change profile photo" : "Add profile photo"
              }
            >
              <View style={styles.avatarWrapper}>
                {image ? (
                  <Image source={{ uri: image.uri }} style={styles.avatar} />
                ) : (
                  <View style={styles.avatarPlaceholder}>
                    <Ionicons
                      name="person-outline"
                      size={25}
                      color={COLORS.primary}
                    />
                  </View>
                )}
                <View style={styles.cameraBadge}>
                  <Ionicons name="camera" size={12} color="#FFFFFF" />
                </View>
              </View>

              <View style={styles.profileCopy}>
                <Text style={styles.profileTitle} numberOfLines={1}>
                  {image ? "Profile photo selected" : "Add profile photo"}
                </Text>
                <Text style={styles.profileSubtitle} numberOfLines={2}>
                  {image
                    ? "Tap to choose another image"
                    : "Personalize your account · Optional"}
                </Text>
              </View>

              <View style={styles.photoAction}>
                <Text style={styles.photoActionText}>
                  {image ? "Change" : "Add"}
                </Text>
                <Ionicons
                  name="arrow-forward"
                  size={13}
                  color={COLORS.primary}
                />
              </View>
            </TouchableOpacity>

            {/* Username */}
            <View style={styles.inputContainer}>
              <View style={styles.inputIcon}>
                <Ionicons
                  name="person-outline"
                  size={19}
                  color={COLORS.primary}
                />
              </View>

              <TextInput
                placeholder="Username"
                placeholderTextColor={COLORS.secondaryText}
                value={userName}
                onChangeText={setUserName}
                style={styles.input}
                autoCapitalize="none"
                autoCorrect={false}
                editable={!loading}
                returnKeyType="next"
                accessibilityLabel="Username"
              />
            </View>

            {/* Email */}
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

            {/* Password */}
            <View style={styles.inputContainer}>
              <View style={styles.inputIcon}>
                <Ionicons
                  name="lock-closed-outline"
                  size={19}
                  color={COLORS.primary}
                />
              </View>

              <TextInput
                placeholder="Password (at least 6 characters)"
                placeholderTextColor={COLORS.secondaryText}
                value={password}
                onChangeText={setPassword}
                style={styles.input}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                editable={!loading}
                returnKeyType="next"
                accessibilityLabel="Password"
              />

              <TouchableOpacity
                onPress={() => setShowPassword((v) => !v)}
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
              </TouchableOpacity>
            </View>

            {/* Confirm password */}
            <View style={styles.inputContainer}>
              <View style={styles.inputIcon}>
                <Ionicons
                  name="shield-checkmark-outline"
                  size={19}
                  color={COLORS.primary}
                />
              </View>

              <TextInput
                placeholder="Confirm password"
                placeholderTextColor={COLORS.secondaryText}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                style={styles.input}
                secureTextEntry={!showConfirmPassword}
                autoCapitalize="none"
                autoCorrect={false}
                editable={!loading}
                returnKeyType="next"
                accessibilityLabel="Confirm password"
              />

              <TouchableOpacity
                onPress={() => setShowConfirmPassword((v) => !v)}
                disabled={loading}
                hitSlop={10}
                accessibilityLabel={
                  showConfirmPassword
                    ? "Hide confirm password"
                    : "Show confirm password"
                }
              >
                <Ionicons
                  name={showConfirmPassword ? "eye-off-outline" : "eye-outline"}
                  size={21}
                  color={COLORS.secondaryText}
                />
              </TouchableOpacity>
            </View>

            {/* Description */}
            <View style={[styles.inputContainer, styles.descriptionBox]}>
              <View style={styles.descriptionIcon}>
                <Ionicons
                  name="document-text-outline"
                  size={19}
                  color={COLORS.primary}
                />
              </View>

              <TextInput
                placeholder="A little about you (optional)"
                placeholderTextColor={COLORS.secondaryText}
                value={description}
                onChangeText={setDescription}
                style={[styles.input, styles.descriptionInput]}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
                editable={!loading}
                maxLength={300}
                accessibilityLabel="Description"
              />
            </View>

            {/* Register button */}
            <TouchableOpacity
              style={[styles.registerButton, loading && styles.buttonDisabled]}
              onPress={handleRegister}
              disabled={loading}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Create account"
            >
              {loading ? (
                <>
                  <ActivityIndicator color="#FFFFFF" />
                  <Text style={styles.registerButtonText}>
                    Creating account...
                  </Text>
                </>
              ) : (
                <>
                  <Text style={styles.registerButtonText}>Create account</Text>
                  <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
                </>
              )}
            </TouchableOpacity>

            {/* Login navigation */}
            <View style={styles.loginRow}>
              <Text style={styles.loginPrompt}>Already have an account?</Text>

              <TouchableOpacity
                onPress={() => router.replace("/loginscreen")}
                disabled={loading}
                hitSlop={8}
              >
                <Text style={styles.loginLink}>Log in</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Footer */}
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
  flex: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 24,
    justifyContent: "center",
  },
  brandHeader: {
    alignItems: "center",
    marginBottom: 22,
  },
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
  brandAccent: {
    color: COLORS.accent,
  },
  brandTagline: {
    color: COLORS.secondaryText,
    fontSize: 12,
    marginTop: 4,
  },
  header: {
    alignItems: "center",
    marginBottom: 24,
  },
  brandIcon: {
    width: 64,
    height: 64,
    borderRadius: 22,
    backgroundColor: COLORS.mint,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  brandTitle: {
    color: COLORS.text,
    fontSize: 24,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  brandSubtitle: {
    color: COLORS.secondaryText,
    fontSize: 12,
    marginTop: 5,
    textAlign: "center",
  },
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
    marginBottom: 12,
    gap: 10,
  },
  headingCopy: {
    flex: 1,
  },
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
  profileSection: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 11,
    paddingVertical: 10,
    marginBottom: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.paleMint,
    gap: 11,
  },
  profileCopy: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  avatarWrapper: {
    width: 56,
    height: 56,
    position: "relative",
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: COLORS.border,
  },
  avatarPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.mint,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
    justifyContent: "center",
  },
  cameraBadge: {
    position: "absolute",
    right: -2,
    bottom: -1,
    width: 21,
    height: 21,
    borderRadius: 11,
    backgroundColor: COLORS.primary,
    borderWidth: 2,
    borderColor: COLORS.paleMint,
    alignItems: "center",
    justifyContent: "center",
  },
  profileTitle: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: "700",
  },
  profileSubtitle: {
    color: COLORS.secondaryText,
    fontSize: 10,
    lineHeight: 14,
  },
  photoAction: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: COLORS.mint,
  },
  photoActionText: {
    color: COLORS.primary,
    fontSize: 11,
    fontWeight: "700",
  },
  label: {
    color: COLORS.secondaryText,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.1,
    marginBottom: 8,
    marginTop: 4,
  },
  inputContainer: {
    minHeight: 47,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.paleMint,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    paddingHorizontal: 10,
    marginBottom: 11,
  },
  inputIcon: {
    width: 30,
    height: 30,
    borderRadius: 9,
    backgroundColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  input: {
    flex: 1,
    minWidth: 0,
    minHeight: 44,
    color: COLORS.text,
    fontSize: 13,
    paddingVertical: 7,
  },
  descriptionBox: {
    alignItems: "flex-start",
    minHeight: 70,
    paddingTop: 6,
  },
  descriptionIcon: {
    width: 30,
    height: 30,
    borderRadius: 9,
    backgroundColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
    marginTop: 2,
  },
  descriptionInput: {
    minHeight: 60,
    paddingTop: 6,
    textAlignVertical: "top",
  },
  registerButton: {
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
  buttonDisabled: {
    opacity: 0.65,
  },
  registerButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
  },
  loginRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    flexWrap: "wrap",
    gap: 5,
    marginTop: 14,
  },
  loginPrompt: {
    color: COLORS.secondaryText,
    fontSize: 12,
  },
  loginLink: {
    color: COLORS.primary,
    fontSize: 13,
    fontWeight: "800",
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    marginTop: 12,
  },
  footerText: {
    color: COLORS.secondaryText,
    fontSize: 11,
  },

  // Desktop registration layout
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
  desktopHeroContent: {
    width: "100%",
    marginTop: 70,
  },
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
  desktopFeatureList: {
    gap: 17,
    marginTop: 38,
  },
  desktopFeatureRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
  },
  desktopFeatureIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  desktopFeatureText: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "600",
  },
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
