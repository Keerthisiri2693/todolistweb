import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
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
type UserProfile = {
  userId?: string;
  userName?: string;
  email?: string;
  Description?: string;
  profilePicUrl?: string;
};

const COLORS = {
  background: "#F3F8F5",
  surface: "#FFFFFF",
  primary: "#21866F",
  mint: "#45C7A5",
  paleMint: "#E2F5ED",
  dark: "#173C35",
  text: "#36574D",
  muted: "#80938B",
  border: "#E1EBE5",
  input: "#F8FBF9",
  danger: "#C74B4B",
};

export default function ProfileScreen() {
  const { width: windowWidth } = useWindowDimensions();
  const isDesktop = Platform.OS === "web" && windowWidth >= 1024;
  const isLargeDesktop = Platform.OS === "web" && windowWidth >= 1440;
  const [profile, setProfile] = useState<UserProfile>({});
  const [userName, setUserName] = useState("");
  const [email, setEmail] = useState("");
  const [description, setDescription] = useState("");
  const [image, setImage] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadProfile = useCallback(async () => {
    try {
      setLoading(true);

      const userId = await AsyncStorage.getItem("userId");

      if (!userId) {
        Alert.alert("Login required", "Please log in to view your profile.");
        return;
      }

      const response = await API.post("/api/getUser", { userId });

      if (!response.data?.success) {
        throw new Error(response.data?.error || "Unable to load profile.");
      }

      const data = response.data.data as UserProfile;

      setProfile(data);
      setUserName(data.userName || "");
      setEmail(data.email || "");
      setDescription(data.Description || "");
    } catch (error: any) {
      console.log(
        "LOAD PROFILE ERROR:",
        error?.response?.data || error.message,
      );

      Alert.alert(
        "Unable to load profile",
        error?.response?.data?.error || error.message || "Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const pickImage = async () => {
    try {
      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        Alert.alert(
          "Permission required",
          "Allow photo library access to choose a profile picture.",
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
      Alert.alert("Error", "Unable to select a profile photo.");
    }
  };

  // Electron/Web uses window.alert because React Native Alert.alert
  // is not consistently displayed in the Electron renderer.
  const showMessage = (title: string, message: string) => {
    if (Platform.OS === "web" && typeof window !== "undefined") {
      window.alert(`${title}\n\n${message}`);
      return;
    }

    Alert.alert(title, message);
  };

  const handleSave = async () => {
    const trimmedUserName = userName.trim();
    const normalizedEmail = email.trim().toLowerCase();
    const trimmedDescription = description.trim();

    if (!trimmedUserName) {
      showMessage("Required", "Please enter your username.");
      return;
    }

    if (!normalizedEmail) {
      showMessage("Required", "Please enter your email address.");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      showMessage("Invalid email", "Please enter a valid email address.");
      return;
    }

    if (saving) return;

    setSaving(true);

    try {
      const token = await AsyncStorage.getItem("login_token");

      if (!token) {
        showMessage(
          "Login required",
          "Login token not found. Please log in again.",
        );
        return;
      }

      const formData = new FormData();
      formData.append("userName", trimmedUserName);
      formData.append("email", normalizedEmail);
      formData.append("Description", trimmedDescription);

      // The backend route must use upload.single("file").
      // Expo ImagePicker supplies `file` on web; use it directly when present.
      if (image?.uri) {
        const fileName =
          image.fileName ||
          `profile_${Date.now()}.${image.mimeType?.includes("png") ? "png" : "jpg"}`;
        const mimeType = image.mimeType || "image/jpeg";

        if (Platform.OS === "web") {
          const webAsset = image as ImagePicker.ImagePickerAsset & {
            file?: File;
          };

          let uploadFile: File;

          if (webAsset.file instanceof File) {
            uploadFile = webAsset.file;
          } else {
            // Fallback for browser/Electron assets that expose only a blob URL.
            const imageResponse = await fetch(image.uri);

            if (!imageResponse.ok) {
              throw new Error(
                `Could not read selected image (${imageResponse.status}). Please select it again.`,
              );
            }

            const imageBlob = await imageResponse.blob();
            uploadFile = new File([imageBlob], fileName, {
              type: imageBlob.type || mimeType,
            });
          }

          if (uploadFile.size <= 0) {
            throw new Error(
              "The selected profile image is empty. Please select it again.",
            );
          }

          formData.append("file", uploadFile, uploadFile.name || fileName);

          console.log("PROFILE FILE READY:", {
            fieldName: "file",
            name: uploadFile.name,
            type: uploadFile.type,
            size: uploadFile.size,
          });
        } else {
          // React Native Android/iOS multipart file representation.
          formData.append("file", {
            uri: image.uri,
            name: fileName,
            type: mimeType,
          } as any);

          console.log("PROFILE FILE READY:", {
            fieldName: "file",
            uri: image.uri,
            name: fileName,
            type: mimeType,
          });
        }
      } else {
        console.log(
          "PROFILE UPDATE: no new image selected; existing image will be retained by backend.",
        );
      }

      console.log("========== PROFILE UPDATE REQUEST ==========");
      console.log("API URL:", API.defaults.baseURL);
      console.log("Endpoint:", "/api/updateUserDetails");
      console.log("Platform:", Platform.OS);
      console.log("Username:", trimmedUserName);
      console.log("Email:", normalizedEmail);
      console.log("Description length:", trimmedDescription.length);
      console.log("Image selected:", Boolean(image?.uri));

      // Important:
      // - Browser/Electron fetch creates the multipart boundary automatically.
      // - Do not set Content-Type manually.
      // - Using fetch here avoids Axios defaults/interceptors accidentally
      //   sending application/json for FormData in the Electron renderer.
      let responseData: any;
      let responseStatus: number;

      if (Platform.OS === "web") {
        const baseURL = API.defaults.baseURL;

        if (!baseURL) {
          throw new Error("API baseURL is not configured.");
        }

        const requestURL = new URL(
          "/api/updateUserDetails",
          baseURL,
        ).toString();

        const webResponse = await fetch(requestURL, {
          method: "POST",
          headers: {
            Authorization: token,
            Accept: "application/json",
            // Do NOT add Content-Type here. The browser adds the boundary.
          },
          body: formData,
        });

        responseStatus = webResponse.status;

        const responseText = await webResponse.text();

        try {
          responseData = responseText ? JSON.parse(responseText) : {};
        } catch {
          throw new Error(
            `Server returned a non-JSON response (HTTP ${responseStatus}): ${responseText.slice(0, 300)}`,
          );
        }

        console.log("========== PROFILE UPDATE RESPONSE ==========");
        console.log("HTTP status:", responseStatus);
        console.log("Response data:", responseData);
        console.log("==============================================");

        if (!webResponse.ok) {
          throw new Error(
            responseData?.error ||
              responseData?.message ||
              `Server error (${responseStatus}).`,
          );
        }
      } else {
        // Native Axios request: keep the React Native URI file upload.
        const nativeResponse = await API.post(
          "/api/updateUserDetails",
          formData,
          {
            headers: {
              Authorization: token,
              Accept: "application/json",
            },
            timeout: 30000,
          },
        );

        responseStatus = nativeResponse.status;
        responseData = nativeResponse.data;

        console.log("========== PROFILE UPDATE RESPONSE ==========");
        console.log("HTTP status:", responseStatus);
        console.log("Response headers:", nativeResponse.headers);
        console.log("Response data:", responseData);
        console.log("==============================================");
      }

      if (!responseData?.success) {
        throw new Error(
          responseData?.error ||
            responseData?.message ||
            "The server did not confirm the profile update.",
        );
      }

      const returnedProfile =
        responseData?.data && typeof responseData.data === "object"
          ? responseData.data
          : {};

      // Accept the server's canonical image URL. Do not fabricate a URL
      // or treat an empty string as a successful image upload.
      const returnedImageUrl =
        typeof returnedProfile.profilePicUrl === "string"
          ? returnedProfile.profilePicUrl
          : profile.profilePicUrl || "";

      setProfile((previous) => ({
        ...previous,
        userName: returnedProfile.userName || trimmedUserName,
        email: returnedProfile.email || normalizedEmail,
        Description: returnedProfile.Description ?? trimmedDescription,
        ...returnedProfile,
        profilePicUrl: returnedImageUrl,
      }));

      setUserName(returnedProfile.userName || trimmedUserName);
      setEmail(returnedProfile.email || normalizedEmail);
      setDescription(returnedProfile.Description ?? trimmedDescription);

      // Clear the pending image only after the server confirms upload.
      setImage(null);

      if (image?.uri && !returnedImageUrl) {
        console.warn(
          "Profile details were updated, but the server response contains an empty profilePicUrl. Check req.file, Cloudinary upload, and the backend response.",
        );

        showMessage(
          "Profile updated, image not saved",
          "Your text details were updated, but the server returned an empty profile image URL. Please check the backend upload response.",
        );
        return;
      }

      showMessage(
        "Success",
        responseData?.message || "Your profile has been updated successfully.",
      );
    } catch (error: any) {
      console.error("========== PROFILE UPDATE ERROR ==========");
      console.error("Message:", error?.message);
      console.error("Code:", error?.code);
      console.error("HTTP status:", error?.response?.status);
      console.error("Server response:", error?.response?.data);
      console.error("API URL:", API.defaults.baseURL);
      console.error("===========================================");

      let message = "Unable to connect to the server.";

      if (error?.response) {
        message =
          error.response.data?.error ||
          error.response.data?.message ||
          `Server error (${error.response.status}).`;
      } else if (error?.message) {
        message = error.message;
      }

      showMessage("Profile update failed", message);
    } finally {
      setSaving(false);
    }
  };

  const avatarUri = image?.uri || profile.profilePicUrl || "";
  const initial = userName.trim().charAt(0).toUpperCase() || "U";

  if (loading) {
    return (
      <View style={styles.loadingScreen}>
        <StatusBar
          barStyle="dark-content"
          backgroundColor={COLORS.background}
        />
        <View style={styles.loadingIcon}>
          <Ionicons name="person-outline" size={30} color={COLORS.primary} />
        </View>
        <ActivityIndicator
          size="small"
          color={COLORS.primary}
          style={{ marginTop: 18 }}
        />
        <Text style={styles.loadingText}>Loading your profile...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <KeyboardAvoidingView
        style={styles.screen}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <StatusBar
          barStyle="dark-content"
          backgroundColor={COLORS.background}
        />

        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={[styles.header, isDesktop && styles.desktopHeader]}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => router.back()}
              accessibilityRole="button"
              accessibilityLabel="Go back"
            >
              <Ionicons name="arrow-back" size={22} color={COLORS.dark} />
            </TouchableOpacity>

            <View style={styles.headerText}>
              <Text style={styles.headerTitle}>My Profile</Text>
              <Text style={styles.headerSubtitle}>Your personal space</Text>
            </View>
          </View>

          {isDesktop && (
            <View style={styles.desktopIntro}>
              <View style={styles.desktopIntroCopy}>
                <Text style={styles.desktopEyebrow}>ACCOUNT WORKSPACE</Text>
                <Text style={styles.desktopPageTitle}>
                  Your profile, your space.
                </Text>
                <Text style={styles.desktopPageSubtitle}>
                  Keep your account information and personal details up to date.
                </Text>
              </View>
              <View style={styles.desktopIntroBadge}>
                <Ionicons
                  name="shield-checkmark-outline"
                  size={18}
                  color={COLORS.primary}
                />
                <Text style={styles.desktopIntroBadgeText}>
                  Personal account
                </Text>
              </View>
            </View>
          )}

          {/* Profile hero */}
          <View style={[styles.heroCard, isDesktop && styles.desktopHeroCard]}>
            <View style={styles.heroDecoration} />

            <TouchableOpacity
              style={styles.avatarWrapper}
              onPress={pickImage}
              disabled={saving}
              accessibilityRole="button"
              accessibilityLabel="Change profile picture"
            >
              {avatarUri ? (
                <Image source={{ uri: avatarUri }} style={styles.avatar} />
              ) : (
                <View style={styles.avatarFallback}>
                  <Text style={styles.avatarInitial}>{initial}</Text>
                </View>
              )}

              <View style={styles.cameraButton}>
                <Ionicons name="camera" size={16} color="#FFFFFF" />
              </View>
            </TouchableOpacity>

            <Text style={styles.heroName}>
              {userName.trim() || "Your Name"}
            </Text>
            <Text style={styles.heroEmail}>
              {email || "Add your email address"}
            </Text>

            <View style={styles.profileStatus}>
              <View style={styles.statusDot} />
              <Text style={styles.statusText}>Personal profile</Text>
            </View>

            <TouchableOpacity
              style={styles.photoButton}
              onPress={pickImage}
              disabled={saving}
            >
              <Ionicons name="image-outline" size={17} color={COLORS.primary} />
              <Text style={styles.photoButtonText}>Change photo</Text>
            </TouchableOpacity>
          </View>

          {/* User ID */}
          <View style={[styles.idCard, isDesktop && styles.desktopIdCard]}>
            <View style={styles.idIcon}>
              <Ionicons
                name="shield-checkmark-outline"
                size={22}
                color={COLORS.primary}
              />
            </View>

            <View style={styles.idContent}>
              <Text style={styles.idLabel}>YOUR USER ID</Text>
              <Text style={styles.idValue}>
                {profile.userId || "Not available"}
              </Text>
            </View>

            <Ionicons
              name="checkmark-circle"
              size={21}
              color={COLORS.primary}
            />
          </View>

          {/* Form */}
          <View
            style={[
              styles.sectionHeading,
              isDesktop && styles.desktopSectionHeading,
            ]}
          >
            <Text style={styles.sectionTitle}>Personal information</Text>
            <Text style={styles.sectionDescription}>
              Update the details associated with your account.
            </Text>
          </View>

          <View style={[styles.formCard, isDesktop && styles.desktopFormCard]}>
            <Text style={styles.label}>Username</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="person-outline" size={20} color={COLORS.muted} />
              <TextInput
                style={styles.input}
                value={userName}
                onChangeText={setUserName}
                placeholder="Enter your username"
                placeholderTextColor="#A2B1AA"
                autoCapitalize="none"
                editable={!saving}
                maxLength={50}
                returnKeyType="next"
              />
            </View>

            <Text style={styles.label}>Email address</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="mail-outline" size={20} color={COLORS.muted} />
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="Enter your email"
                placeholderTextColor="#A2B1AA"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                editable={!saving}
                maxLength={254}
                returnKeyType="next"
              />
            </View>

            <View style={styles.labelRow}>
              <Text style={styles.label}>About me</Text>
              <Text style={styles.optional}>OPTIONAL</Text>
            </View>

            <View style={[styles.inputWrapper, styles.descriptionWrapper]}>
              <Ionicons
                name="document-text-outline"
                size={20}
                color={COLORS.muted}
                style={styles.descriptionIcon}
              />
              <TextInput
                style={[styles.input, styles.descriptionInput]}
                value={description}
                onChangeText={setDescription}
                placeholder="Write a little about yourself..."
                placeholderTextColor="#A2B1AA"
                multiline
                textAlignVertical="top"
                editable={!saving}
                maxLength={300}
              />
            </View>

            <Text style={styles.characterCount}>
              {description.length}/300 characters
            </Text>

            <TouchableOpacity
              style={[styles.saveButton, saving && styles.saveButtonDisabled]}
              onPress={handleSave}
              disabled={saving}
              accessibilityRole="button"
              accessibilityLabel="Save profile changes"
            >
              {saving ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons
                    name="checkmark-circle-outline"
                    size={21}
                    color="#FFFFFF"
                  />
                  <Text style={styles.saveButtonText}>Save Changes</Text>
                </>
              )}
            </TouchableOpacity>

            <View style={styles.secureNote}>
              <Ionicons
                name="lock-closed-outline"
                size={14}
                color={COLORS.muted}
              />
              <Text style={styles.secureText}>
                Your profile details are saved to your account.
              </Text>
            </View>
          </View>

          <Text style={styles.footer}>Made for your everyday notes.</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  screen: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  container: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: Platform.OS === "android" ? 18 : 12,
    paddingBottom: 35,
  },
  loadingScreen: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: COLORS.background,
  },
  loadingIcon: {
    width: 66,
    height: 66,
    borderRadius: 22,
    backgroundColor: COLORS.paleMint,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    color: COLORS.muted,
    fontSize: 14,
    marginTop: 12,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 22,
    gap: 13,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 15,
    backgroundColor: COLORS.surface,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  headerText: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 23,
    fontWeight: "800",
    color: COLORS.dark,
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 13,
    color: COLORS.muted,
    marginTop: 3,
  },
  headerIcon: {
    width: 44,
    height: 44,
    borderRadius: 15,
    backgroundColor: COLORS.paleMint,
    alignItems: "center",
    justifyContent: "center",
  },
  heroCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 25,
    paddingHorizontal: 20,
    paddingTop: 26,
    paddingBottom: 20,
    alignItems: "center",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  heroDecoration: {
    position: "absolute",
    top: -68,
    right: -40,
    width: 190,
    height: 150,
    borderRadius: 100,
    backgroundColor: "#E9F8F1",
    transform: [{ rotate: "-18deg" }],
  },
  avatarWrapper: {
    position: "relative",
    marginBottom: 15,
  },
  avatar: {
    width: 112,
    height: 112,
    borderRadius: 38,
    borderWidth: 4,
    borderColor: "#DDF4EA",
    backgroundColor: COLORS.paleMint,
  },
  avatarFallback: {
    width: 112,
    height: 112,
    borderRadius: 38,
    borderWidth: 4,
    borderColor: "#DDF4EA",
    backgroundColor: COLORS.paleMint,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitial: {
    fontSize: 42,
    fontWeight: "800",
    color: COLORS.primary,
  },
  cameraButton: {
    position: "absolute",
    bottom: -3,
    right: -5,
    width: 35,
    height: 35,
    borderRadius: 13,
    backgroundColor: COLORS.primary,
    borderWidth: 3,
    borderColor: COLORS.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  heroName: {
    fontSize: 22,
    fontWeight: "800",
    color: COLORS.dark,
    textAlign: "center",
  },
  heroEmail: {
    fontSize: 14,
    color: COLORS.muted,
    marginTop: 5,
    textAlign: "center",
  },
  profileStatus: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    backgroundColor: "#F0F8F3",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginTop: 13,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: COLORS.primary,
  },
  statusText: {
    fontSize: 12,
    color: COLORS.primary,
    fontWeight: "600",
  },
  photoButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 17,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#CDE9DD",
    paddingHorizontal: 17,
    paddingVertical: 10,
    backgroundColor: "#FAFDFB",
  },
  photoButtonText: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.primary,
  },
  idCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    marginTop: 16,
    backgroundColor: COLORS.paleMint,
    borderRadius: 18,
    gap: 12,
  },
  idIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  idContent: {
    flex: 1,
  },
  idLabel: {
    color: "#6D8B7E",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.1,
  },
  idValue: {
    fontSize: 17,
    fontWeight: "800",
    color: COLORS.dark,
    marginTop: 4,
  },
  sectionHeading: {
    marginTop: 27,
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 19,
    fontWeight: "800",
    color: COLORS.dark,
  },
  sectionDescription: {
    fontSize: 13,
    color: COLORS.muted,
    lineHeight: 19,
    marginTop: 5,
  },
  formCard: {
    backgroundColor: COLORS.surface,
    padding: 18,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  label: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.text,
    marginBottom: 9,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.input,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 13,
    paddingHorizontal: 13,
    marginBottom: 20,
    minHeight: 53,
    gap: 11,
  },
  input: {
    flex: 1,
    paddingVertical: 13,
    color: COLORS.dark,
    fontSize: 14,
    minWidth: 0,
  },
  labelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  optional: {
    fontSize: 10,
    color: COLORS.muted,
    fontWeight: "700",
    marginBottom: 9,
    letterSpacing: 0.7,
  },
  descriptionWrapper: {
    alignItems: "flex-start",
    minHeight: 112,
    paddingTop: 3,
    marginBottom: 4,
  },
  descriptionIcon: {
    marginTop: 13,
  },
  descriptionInput: {
    minHeight: 100,
    lineHeight: 21,
  },
  characterCount: {
    textAlign: "right",
    color: COLORS.muted,
    fontSize: 11,
    marginTop: 5,
    marginBottom: 20,
  },
  saveButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    minHeight: 54,
    borderRadius: 15,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 18,
  },
  saveButtonDisabled: {
    opacity: 0.65,
  },
  saveButtonText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  secureNote: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    marginTop: 15,
  },
  secureText: {
    fontSize: 11,
    color: COLORS.muted,
    flexShrink: 1,
  },
  footer: {
    textAlign: "center",
    marginTop: 23,
    color: COLORS.muted,
    fontSize: 12,
  },
  // Desktop-only layout. Mobile styles above remain the defaults.
  desktopContainer: {
    width: "100%",
    maxWidth: 1180,
    alignSelf: "center",
    paddingHorizontal: 42,
    paddingTop: 30,
    paddingBottom: 56,
  },
  desktopHeader: {
    marginBottom: 28,
    gap: 16,
  },
  desktopIntro: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#E7F6EF",
    borderColor: "#D2EDE1",
    borderWidth: 1,
    borderRadius: 22,
    paddingHorizontal: 28,
    paddingVertical: 24,
    marginBottom: 22,
    overflow: "hidden",
  },
  desktopIntroCopy: {
    flex: 1,
  },
  desktopEyebrow: {
    color: COLORS.primary,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.8,
    marginBottom: 8,
  },
  desktopPageTitle: {
    color: COLORS.dark,
    fontSize: 27,
    lineHeight: 34,
    fontWeight: "800",
    letterSpacing: -0.7,
  },
  desktopPageSubtitle: {
    color: COLORS.muted,
    fontSize: 14,
    lineHeight: 21,
    marginTop: 6,
  },
  desktopIntroBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 30,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#D2EDE1",
    marginLeft: 20,
  },
  desktopIntroBadgeText: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: "700",
  },
  desktopHeroCard: {
    borderRadius: 24,
    paddingHorizontal: 36,
    paddingTop: 34,
    paddingBottom: 30,
    minHeight: 300,
    shadowColor: "#173C35",
    shadowOpacity: 0.05,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 7 },
    elevation: 2,
  },
  desktopIdCard: {
    padding: 20,
    marginTop: 18,
    borderRadius: 18,
  },
  desktopSectionHeading: {
    marginTop: 32,
    marginBottom: 17,
  },
  desktopFormCard: {
    padding: 30,
    borderRadius: 22,
    shadowColor: "#173C35",
    shadowOpacity: 0.045,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  desktopSaveButton: {
    minHeight: 56,
    borderRadius: 14,
    alignSelf: "flex-start",
    minWidth: 220,
    paddingHorizontal: 28,
  },
});
