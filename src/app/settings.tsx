import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";

import * as Contacts from "expo-contacts/legacy";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import {
  getChecklistWidgetTheme,
  refreshChecklistHomeWidget,
  setChecklistWidgetTheme,
  type ChecklistWidgetTheme,
} from "../../utils/homeChecklistWidget";

import axios from "axios";

import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { SafeAreaView } from "react-native-safe-area-context";

import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";

import { useAppTheme, type ThemeChoice } from "../../context/app-theme-context";

const COLORS = {
  background: "#F3F8F5",
  surface: "#FFFFFF",
  primary: "#208A75",
  primaryDark: "#155E50",
  primaryLight: "#DDF4EB",
  text: "#172F2B",
  secondary: "#71827D",
  border: "#DCE9E3",
  muted: "#F2F7F4",
  orange: "#C9852A",
  orangeLight: "#FFF4E3",
  purple: "#7664C8",
  purpleLight: "#F0EDFF",
  blue: "#4C83C3",
  blueLight: "#EAF2FF",
  textSecondary: "#64748B",
};

type ToggleRowProps = {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  iconColor: string;
  iconBackground: string;
  title: string;
  subtitle: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  last?: boolean;
};

const STORAGE = {
  theme: "app-settings-theme",
  notifications: "app-settings-notifications",
  reminders: "app-settings-reminders",
  haptics: "app-settings-haptics",
  autoBackup: "app-settings-auto-backup",
  cloudBackup: "app-settings-cloud-backup",
  cloudSync: "app-settings-cloud-sync",
  backupStatus: "app-settings-backup-status",
  backupAccount: "app-settings-backup-account",
};
export default function AppSettingsScreen() {
  const { theme, setTheme, colors, isDark } = useAppTheme();
  const { width: windowWidth } = useWindowDimensions();
  const isDesktop = Platform.OS === "web" && windowWidth >= 1024;
  const isLargeDesktop = Platform.OS === "web" && windowWidth >= 1440;
  const [loading, setLoading] = useState(true);
  const [widgetTheme, setWidgetTheme] = useState<ChecklistWidgetTheme>("mint");
  const [widgetThemeBusy, setWidgetThemeBusy] = useState(false);
  const [themeModalVisible, setThemeModalVisible] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [remindersEnabled, setRemindersEnabled] = useState(true);
  const [hapticsEnabled, setHapticsEnabled] = useState(true);
  const [noteThemeVisible, setNoteThemeVisible] = useState(false);
  const [defaultNoteColor, setDefaultNoteColor] = useState("#FFF4CC");
  const [defaultNotePattern, setDefaultNotePattern] = useState("plain");
  const [customNoteColor, setCustomNoteColor] = useState("#FFF4CC");
  const [accentColor, setAccentColor] = useState("#239B83");
  const [notebookStyle, setNotebookStyle] = useState("classic");
  const [noteTextSize, setNoteTextSize] = useState("medium");
  const [noteCornerStyle, setNoteCornerStyle] = useState("rounded");
  const [homeLayout, setHomeLayout] = useState("comfortable");
  const [showHomeGreeting, setShowHomeGreeting] = useState(true);
  const [showHomeStats, setShowHomeStats] = useState(true);
  const [helpSupportVisible, setHelpSupportVisible] = useState(false);
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);
  const [autoBackupEnabled, setAutoBackupEnabled] = useState(false);
  const [cloudBackupEnabled, setCloudBackupEnabled] = useState(false);
  const [cloudSyncEnabled, setCloudSyncEnabled] = useState(false);
  const [backupBusy, setBackupBusy] = useState(false);
  const [lastBackupAt, setLastBackupAt] = useState<string | null>(null);
  const [backupAccount, setBackupAccount] = useState("This device");

  const [feedbackModalVisible, setFeedbackModalVisible] = useState(false);
  const [feedbackType, setFeedbackType] = useState("Suggestion");
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [feedbackEmail, setFeedbackEmail] = useState("");
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);
  const [logoutModalVisible, setLogoutModalVisible] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const SUPPORT_EMAIL = "your-support-email@example.com";
  // Replace this with your actual support email address.

  const showFeedbackAlert = (title: string, message: string) => {
    if (Platform.OS === "web") {
      window.alert(`${title}\n\n${message}`);
    } else {
      Alert.alert(title, message);
    }
  };

  const sendFeedback = async () => {
    const message = feedbackMessage.trim();
    const email = feedbackEmail.trim();

    if (!message) {
      showFeedbackAlert("Message required", "Please enter your feedback.");
      return;
    }

    if (message.length > 3000) {
      showFeedbackAlert(
        "Message too long",
        "Feedback must be 3000 characters or fewer.",
      );
      return;
    }

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showFeedbackAlert("Invalid email", "Please enter a valid email address.");
      return;
    }

    if (feedbackSubmitting) return;

    try {
      setFeedbackSubmitting(true);

      const token = await AsyncStorage.getItem("login_token");

      if (!token) {
        showFeedbackAlert(
          "Login required",
          "Please log in to submit feedback.",
        );
        return;
      }

      const response = await axios.post(
        "https://todolistbackend-855c.onrender.com/api/feedback",
        {
          message,
          feedbackType,
          email: email || "",
        },
        {
          headers: {
            Authorization: token,
            "Content-Type": "application/json",
          },
        },
      );

      if (response.data?.success) {
        setFeedbackModalVisible(false);
        setFeedbackMessage("");
        setFeedbackEmail("");
        setFeedbackType("Suggestion");

        showFeedbackAlert(
          "Thank you!",
          "Your feedback has been submitted successfully.",
        );
      } else {
        showFeedbackAlert(
          "Submission failed",
          response.data?.error || "Unable to submit feedback.",
        );
      }
    } catch (error: any) {
      console.error(
        "Feedback submission error:",
        error?.response?.data || error?.message || error,
      );

      showFeedbackAlert(
        "Submission failed",
        error?.response?.data?.error ||
          "Could not submit feedback. Please check your connection and try again.",
      );
    } finally {
      setFeedbackSubmitting(false);
    }
  };

  const ACCENT_COLORS = [
    { name: "Emerald", color: "#239B83" },
    { name: "Blue", color: "#3978D4" },
    { name: "Violet", color: "#8064D8" },
    { name: "Rose", color: "#E05275" },
    { name: "Amber", color: "#C9852A" },
    { name: "Teal", color: "#0F9D9A" },
  ];

  const saveDefaultNoteTheme = async () => {
    try {
      await AsyncStorage.multiSet([
        [
          "defaultNoteTheme",
          JSON.stringify({
            color: defaultNoteColor,
            pattern: defaultNotePattern,
            notebookStyle,
            textSize: noteTextSize,
            cornerStyle: noteCornerStyle,
          }),
        ],
        ["app-accent-color", accentColor],
        ["default-notebook-style", notebookStyle],
        ["default-note-text-size", noteTextSize],
        ["default-note-corner-style", noteCornerStyle],
        ["home-screen-layout", homeLayout],
        ["home-screen-show-greeting", String(showHomeGreeting)],
        ["home-screen-show-stats", String(showHomeStats)],
        // ViewTodolistScreen already reads this shared appearance object.
        [
          "notes:appearance-settings",
          JSON.stringify({
            appTheme: isDark ? "dark" : "light",
            accentColor,
            defaultNoteColor,
            notePattern: defaultNotePattern,
            notebookStyle:
              notebookStyle === "journal" ? "rounded" : notebookStyle,
            noteFontSize: noteTextSize,
            noteFontFamily: "System",
            showHero: showHomeStats,
            showQuickNotes: true,
            showCategories: true,
            homeLayout,
            showHomeGreeting,
            showHomeStats,
          }),
        ],
      ]);

      setNoteThemeVisible(false);
      Alert.alert(
        "Theme saved",
        "Your default note paper theme has been saved.",
      );
    } catch (error) {
      console.error("Failed to save note theme:", error);
      Alert.alert("Error", "Unable to save your default note theme.");
    }
  };

  useEffect(() => {
    let active = true;
    getChecklistWidgetTheme()
      .then((savedTheme) => {
        if (active) setWidgetTheme(savedTheme);
      })
      .catch((error) => {
        console.warn("Unable to load checklist widget theme:", error);
      });
    return () => {
      active = false;
    };
  }, []);

  const handleWidgetThemeChange = async (nextTheme: ChecklistWidgetTheme) => {
    if (widgetThemeBusy) return;

    setWidgetThemeBusy(true);

    try {
      const success = await setChecklistWidgetTheme(nextTheme);

      if (!success) {
        Alert.alert(
          "Widget theme unavailable",
          "Could not apply the selected theme. Check the native Android widget module and rebuild the app.",
        );
        return;
      }

      setWidgetTheme(nextTheme);
    } catch (error) {
      console.error("Widget theme update failed:", error);

      Alert.alert(
        "Widget theme error",
        "Could not change the home-screen checklist widget theme.",
      );
    } finally {
      setWidgetThemeBusy(false);
    }
  };

  const handleRefreshChecklistWidget = async () => {
    if (widgetThemeBusy) return;
    setWidgetThemeBusy(true);
    try {
      const success = await refreshChecklistHomeWidget();
      if (success) {
        Alert.alert(
          "Widget refreshed",
          "Your home-screen checklist widget has been refreshed.",
        );
      } else {
        Alert.alert(
          "Widget unavailable",
          "The Android widget module is not available. Rebuild and install the native Android app.",
        );
      }
    } catch (error) {
      console.error("Checklist widget refresh failed:", error);
      Alert.alert("Refresh failed", "Could not refresh the checklist widget.");
    } finally {
      setWidgetThemeBusy(false);
    }
  };

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [
          savedNotifications,
          savedReminders,
          savedHaptics,
          savedNoteTheme,
          savedAccent,
          savedNotebook,
          savedTextSize,
          savedCorner,
          savedHomeLayout,
          savedGreeting,
          savedStats,
          savedAppearance,
        ] = await AsyncStorage.multiGet([
          STORAGE.notifications,
          STORAGE.reminders,
          STORAGE.haptics,
          "defaultNoteTheme",
          "app-accent-color",
          "default-notebook-style",
          "default-note-text-size",
          "default-note-corner-style",
          "home-screen-layout",
          "home-screen-show-greeting",
          "home-screen-show-stats",
          "notes:appearance-settings",
          STORAGE.autoBackup,
          STORAGE.cloudBackup,
          STORAGE.cloudSync,
          STORAGE.backupStatus,
          STORAGE.backupAccount,
        ]);
        if (!active) return;
        if (savedNotifications[1] !== null)
          setNotificationsEnabled(savedNotifications[1] === "true");
        if (savedReminders[1] !== null)
          setRemindersEnabled(savedReminders[1] === "true");
        if (savedHaptics[1] !== null)
          setHapticsEnabled(savedHaptics[1] === "true");
        if (savedNoteTheme[1]) {
          try {
            const saved = JSON.parse(savedNoteTheme[1]);
            if (typeof saved.color === "string") {
              setDefaultNoteColor(saved.color);
              setCustomNoteColor(saved.color);
            }
            if (typeof saved.pattern === "string")
              setDefaultNotePattern(saved.pattern);
          } catch {}
        }
        if (savedAccent[1]) setAccentColor(savedAccent[1]);
        if (savedNotebook[1]) setNotebookStyle(savedNotebook[1]);
        if (savedTextSize[1]) setNoteTextSize(savedTextSize[1]);
        if (savedCorner[1]) setNoteCornerStyle(savedCorner[1]);
        if (savedHomeLayout[1]) setHomeLayout(savedHomeLayout[1]);
        if (savedGreeting[1] !== null)
          setShowHomeGreeting(savedGreeting[1] === "true");
        if (savedStats[1] !== null) setShowHomeStats(savedStats[1] === "true");
        if (savedAppearance[1]) {
          try {
            const appearance = JSON.parse(savedAppearance[1]);
            if (typeof appearance.accentColor === "string")
              setAccentColor(appearance.accentColor);
            if (typeof appearance.defaultNoteColor === "string") {
              setDefaultNoteColor(appearance.defaultNoteColor);
              setCustomNoteColor(appearance.defaultNoteColor);
            }
            if (
              ["plain", "lined", "dotted", "grid"].includes(
                appearance.notePattern,
              )
            )
              setDefaultNotePattern(appearance.notePattern);
            if (["classic", "minimal"].includes(appearance.notebookStyle))
              setNotebookStyle(appearance.notebookStyle);
            if (appearance.notebookStyle === "rounded")
              setNotebookStyle("journal");
            if (["small", "medium", "large"].includes(appearance.noteFontSize))
              setNoteTextSize(appearance.noteFontSize);
            if (typeof appearance.homeLayout === "string")
              setHomeLayout(appearance.homeLayout);
            if (typeof appearance.showHomeGreeting === "boolean")
              setShowHomeGreeting(appearance.showHomeGreeting);
            if (typeof appearance.showHomeStats === "boolean")
              setShowHomeStats(appearance.showHomeStats);
          } catch (appearanceError) {
            console.warn(
              "Unable to load shared appearance settings:",
              appearanceError,
            );
          }
        }
        const savedAutoBackup = await AsyncStorage.getItem(STORAGE.autoBackup);
        const savedCloudBackup = await AsyncStorage.getItem(
          STORAGE.cloudBackup,
        );
        const savedCloudSync = await AsyncStorage.getItem(STORAGE.cloudSync);
        const savedBackupStatus = await AsyncStorage.getItem(
          STORAGE.backupStatus,
        );
        const savedBackupAccount = await AsyncStorage.getItem(
          STORAGE.backupAccount,
        );
        if (savedAutoBackup !== null)
          setAutoBackupEnabled(savedAutoBackup === "true");
        if (savedCloudBackup !== null)
          setCloudBackupEnabled(savedCloudBackup === "true");
        if (savedCloudSync !== null)
          setCloudSyncEnabled(savedCloudSync === "true");
        if (savedBackupStatus) setLastBackupAt(savedBackupStatus);
        if (savedBackupAccount) setBackupAccount(savedBackupAccount);
        // When enabled, create a quiet local snapshot whenever the settings screen opens.
        if (savedAutoBackup === "true") {
          await createLocalBackup(true);
        }
      } catch (error) {
        console.warn("Unable to load app settings:", error);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const createLocalBackup = async (silent = false) => {
    if (backupBusy) return;
    setBackupBusy(true);
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      // Back up app data and preferences, excluding session credentials and tokens.
      const excluded = new Set([
        "login_token",
        "token",
        "authToken",
        "userId",
        "userid",
        "currentUserId",
        "fcmToken",
        "fcmUserId",
      ]);
      const backupKeys = allKeys.filter((key) => !excluded.has(key));
      const pairs = await AsyncStorage.multiGet(backupKeys);
      const payload = {
        format: "todo-notes-backup",
        version: 1,
        createdAt: new Date().toISOString(),
        account: (await AsyncStorage.getItem("userEmail")) || "This device",
        data: Object.fromEntries(pairs),
      };
      const json = JSON.stringify(payload, null, 2);
      const fileUri = `${FileSystem.cacheDirectory || FileSystem.documentDirectory}todo-notes-backup-${Date.now()}.json`;
      await FileSystem.writeAsStringAsync(fileUri, json, {
        encoding: FileSystem.EncodingType.UTF8,
      });
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(fileUri, {
          mimeType: "application/json",
          dialogTitle: "Save your notes backup",
          UTI: "public.json",
        });
      } else {
        Alert.alert("Backup created", `Backup file created at:\n${fileUri}`);
      }
      const timestamp = new Date().toISOString();
      setLastBackupAt(timestamp);
      await AsyncStorage.setItem(STORAGE.backupStatus, timestamp);
      Alert.alert(
        "Backup ready",
        "Your local app data backup was created. Save the JSON file somewhere safe to recover it after reinstalling.",
      );
    } catch (error) {
      console.error("Local backup failed:", error);
      Alert.alert(
        "Backup failed",
        "Could not create the backup file. Check storage permissions and try again.",
      );
    } finally {
      setBackupBusy(false);
    }
  };

  const restoreLocalBackup = async () => {
    if (backupBusy) return;
    try {
      const picked = await DocumentPicker.getDocumentAsync({
        type: ["application/json", "text/json", "public.json"],
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (picked.canceled || !picked.assets?.length) return;
      const asset = picked.assets[0];
      const raw = await FileSystem.readAsStringAsync(asset.uri, {
        encoding: FileSystem.EncodingType.UTF8,
      });
      const parsed = JSON.parse(raw);
      if (
        parsed?.format !== "todo-notes-backup" ||
        parsed?.version !== 1 ||
        !parsed?.data ||
        typeof parsed.data !== "object"
      ) {
        Alert.alert(
          "Invalid backup",
          "Choose a JSON backup exported from this app.",
        );
        return;
      }
      Alert.alert(
        "Restore backup?",
        "Restoring will overwrite local values for keys included in this backup. Export a current backup first if you need to keep today's data.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Restore",
            style: "destructive",
            onPress: async () => {
              setBackupBusy(true);
              try {
                const entries = Object.entries(parsed.data)
                  .filter(
                    ([key, value]) =>
                      typeof key === "string" &&
                      (typeof value === "string" || value === null),
                  )
                  .map(
                    ([key, value]) => [key, value ?? ""] as [string, string],
                  );
                if (entries.length) await AsyncStorage.multiSet(entries);
                const timestamp = new Date().toISOString();
                setLastBackupAt(timestamp);
                await AsyncStorage.setItem(STORAGE.backupStatus, timestamp);
                Alert.alert(
                  "Restore complete",
                  `Restored ${entries.length} local storage entries. Reopen the app to refresh screens.`,
                );
              } catch (error) {
                console.error("Restore failed:", error);
                Alert.alert(
                  "Restore failed",
                  "The backup could not be restored.",
                );
              } finally {
                setBackupBusy(false);
              }
            },
          },
        ],
      );
    } catch (error) {
      console.error("Backup file read failed:", error);
      Alert.alert(
        "Could not read backup",
        "Select a valid JSON backup file and try again.",
      );
    }
  };

  const chooseBackupAccount = () => {
    Alert.alert(
      "Backup account",
      "Choose where this device backup is associated.",
      [
        {
          text: "This device",
          onPress: () => {
            setBackupAccount("This device");
            void AsyncStorage.setItem(STORAGE.backupAccount, "This device");
          },
        },
        {
          text: "Signed-in account",
          onPress: async () => {
            const email = await AsyncStorage.getItem("userEmail");
            if (!email) {
              Alert.alert(
                "No account found",
                "Sign in before choosing an account.",
              );
              return;
            }
            setBackupAccount(email);
            await AsyncStorage.setItem(STORAGE.backupAccount, email);
          },
        },
        { text: "Cancel", style: "cancel" },
      ],
    );
  };

  const savePreference = async (key: string, value: string, label: string) => {
    try {
      await AsyncStorage.setItem(key, value);
    } catch (error) {
      console.warn(`Unable to save ${label}:`, error);
      Alert.alert(
        "Could not save setting",
        `Please try changing ${label} again.`,
      );
    }
  };

  const importContactDetails = async () => {
    try {
      const permission = await Contacts.requestPermissionsAsync();

      if (!permission.granted) {
        Alert.alert(
          "Contacts Permission Required",
          "Allow contacts access to view your device contacts.",
        );
        return;
      }

      router.push("/contacts");
    } catch (error) {
      console.error("Failed to open contacts:", error);
      Alert.alert("Error", "Unable to open contacts.");
    }
  };

  const chooseTheme = async (choice: ThemeChoice) => {
    try {
      await setTheme(choice);
      setThemeModalVisible(false);
    } catch (error) {
      console.error("Theme update failed:", error);
      Alert.alert("Theme error", "Unable to save the selected theme.");
    }
  };

  const toggleSetting = async (
    key: string,
    value: boolean,
    setter: (next: boolean) => void,
    label: string,
  ) => {
    setter(value);
    await savePreference(key, String(value), label);
  };

  const showInfo = (title: string, message: string) => {
    if (Platform.OS === "web") {
      window.alert(`${title}\n\n${message}`);
    } else {
      Alert.alert(title, message);
    }
  };

  const handleLogout = () => {
    // Use an in-app modal because Alert.alert() is not supported reliably
    // by React Native Web when running inside Electron.
    setLogoutModalVisible(true);
  };

  const cancelLogout = () => {
    if (!isLoggingOut) {
      setLogoutModalVisible(false);
    }
  };

  const confirmLogout = async () => {
    if (isLoggingOut) return;

    setIsLoggingOut(true);

    try {
      // Remove session/auth data while preserving app preferences and user data.
      await AsyncStorage.multiRemove([
        "userId",
        "userid",
        "currentUserId",
        "login_token",
        "token",
        "authToken",
        "userEmail",
        "userName",
        "isLoggedIn",
        "offlineMode",
        "offlineUserId",
        "offlineUserEmail",
        "offlineUserName",
        "fcmToken",
        "fcmUserId",
      ]);

      setLogoutModalVisible(false);
      router.replace("/loginscreen");
    } catch (error) {
      console.error("Logout storage cleanup failed:", error);
      setLogoutModalVisible(false);
      showInfo(
        "Logout failed",
        "Could not clear your session. Please try again.",
      );
    } finally {
      setIsLoggingOut(false);
    }
  };

  const SettingRow = ({
    icon,
    iconColor = COLORS.primary,
    iconBackground = COLORS.primaryLight,
    title,
    subtitle,
    value,
    onPress,
    rightLabel,
    last = false,
  }: {
    icon: keyof typeof Ionicons.glyphMap;
    iconColor?: string;
    iconBackground?: string;
    title: string;
    subtitle?: string;
    value?: string;
    onPress?: () => void;
    rightLabel?: string;
    last?: boolean;
  }) => (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.settingRow,
        !last && styles.rowDivider,
        { borderBottomColor: colors.border },
        pressed && onPress && styles.pressed,
      ]}
    >
      <View
        style={[
          styles.rowIcon,
          { backgroundColor: isDark ? colors.background : iconBackground },
        ]}
      >
        <Ionicons name={icon} size={19} color={iconColor} />
      </View>
      <View style={styles.rowCopy}>
        <Text style={[styles.rowTitle, { color: colors.text }]}>{title}</Text>
        {!!subtitle && (
          <Text style={[styles.rowSubtitle, { color: colors.secondaryText }]}>
            {subtitle}
          </Text>
        )}
      </View>
      {!!value && (
        <Text style={[styles.valueText, { color: colors.primary }]}>
          {value}
        </Text>
      )}
      {!!rightLabel && (
        <Text style={[styles.valueText, { color: colors.primary }]}>
          {rightLabel}
        </Text>
      )}
      {!!onPress && (
        <Ionicons name="chevron-forward" size={18} color="#9AA9A3" />
      )}
    </Pressable>
  );

  const ToggleRow = ({
    icon,
    iconColor = COLORS.primary,
    iconBackground = COLORS.primaryLight,
    title,
    subtitle,
    value,
    onValueChange,
    last = false,
  }: {
    icon: keyof typeof Ionicons.glyphMap;
    iconColor?: string;
    iconBackground?: string;
    title: string;
    subtitle?: string;
    value: boolean;
    onValueChange: (next: boolean) => void;
    last?: boolean;
  }) => (
    <View
      style={[
        styles.settingRow,
        !last && styles.rowDivider,
        { borderBottomColor: colors.border },
      ]}
    >
      <View
        style={[
          styles.rowIcon,
          { backgroundColor: isDark ? colors.background : iconBackground },
        ]}
      >
        <Ionicons name={icon} size={19} color={iconColor} />
      </View>
      <View style={styles.rowCopy}>
        <Text style={[styles.rowTitle, { color: colors.text }]}>{title}</Text>
        {!!subtitle && (
          <Text style={[styles.rowSubtitle, { color: colors.secondaryText }]}>
            {subtitle}
          </Text>
        )}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{
          false: colors.border,
          true: isDark ? colors.primary : "#A9DFD0",
        }}
        thumbColor={value ? colors.primary : isDark ? "#D7E1DC" : "#FFFFFF"}
        accessibilityLabel={title}
      />
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView
        style={[styles.loadingScreen, { backgroundColor: colors.background }]}
      >
        <StatusBar
          barStyle={isDark ? "light-content" : "dark-content"}
          backgroundColor={colors.background}
        />
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={[styles.loadingText, { color: colors.secondaryText }]}>
          Loading settings…
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={[
        styles.safeArea,
        isDesktop && styles.desktopSafeArea,
        { backgroundColor: colors.background },
      ]}
      edges={["top", "left", "right"]}
    >
      <StatusBar
        barStyle={isDark ? "light-content" : "dark-content"}
        backgroundColor={colors.background}
      />
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          isDesktop && styles.desktopScrollContent,
        ]}
        showsVerticalScrollIndicator={false}
      >
       <View style={[styles.header, isDesktop && styles.desktopHeader]}>
  <Pressable
    onPress={() => router.back()}
    style={[
      styles.backButton,
      isDesktop && styles.desktopBackButton,
      {
        backgroundColor: isDark ? "#26332E" : "#F1F5F9",
        borderColor: isDark ? "#3D5148" : "#E2E8F0",
        borderWidth: 1,
      },
    ]}
    accessibilityRole="button"
    accessibilityLabel="Go back"
  >
    <Ionicons
      name="arrow-back"
      size={22}
      color={isDark ? "#FFFFFF" : "#1F2937"}
    />
  </Pressable>

  <View
    style={[styles.headerCopy, isDesktop && styles.desktopHeaderCopy]}
  >
    <Text style={[styles.eyebrow, isDesktop && styles.desktopEyebrow]}>
      PREFERENCES
    </Text>

    <Text
      style={[
        styles.headerTitle,
        isDesktop && styles.desktopHeaderTitle,
        { color: colors.text },
      ]}
    >
      App settings
    </Text>

    <Text
      style={[
        styles.headerSubtitle,
        isDesktop && styles.desktopHeaderSubtitle,
        { color: colors.secondaryText },
      ]}
    >
      Make your workspace feel like yours.
    </Text>
  </View>
</View>

        <LinearGradient
          colors={isDark ? ["#203B32", "#172A24"] : ["#DDF6EC", "#F0FAF5"]}
          style={[
            styles.heroCard,
            isDesktop && styles.desktopHeroCard,
            isLargeDesktop && styles.desktopHeroCardLarge,
          ]}
        >
          <View style={styles.heroText}>
            <Text
              style={[
                styles.heroTitle,
                { color: isDark ? colors.text : COLORS.primaryDark },
              ]}
            >
              A calmer way to stay organized
            </Text>
            <Text
              style={[
                styles.heroSubtitle,
                { color: isDark ? colors.secondaryText : "#47796C" },
              ]}
            >
              Manage appearance, reminders, and your app experience in one
              place.
            </Text>
          </View>
          <View style={styles.heroIconWrap}>
            <Ionicons
              name="leaf-outline"
              size={34}
              color={COLORS.primaryDark}
            />
          </View>
          <View style={styles.heroDecoration} />
        </LinearGradient>

        <Text
          style={[
            styles.sectionHeading,
            isDesktop && styles.desktopSectionHeading,
            { color: colors.text },
          ]}
        >
          Appearance
        </Text>
        <View
          style={[
            styles.sectionCard,
            isDesktop && styles.desktopSectionCard,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <SettingRow
            icon="color-palette-outline"
            title="App theme"
            subtitle="Choose how the app looks"
            value={theme}
            onPress={() => setThemeModalVisible(true)}
          />
          <SettingRow
            icon="brush-outline"
            iconColor={COLORS.purple}
            iconBackground={COLORS.purpleLight}
            title="Note themes"
            subtitle="Choose your default paper color and pattern"
            onPress={() => setNoteThemeVisible(true)}
            last
          />
        </View>

        <Text
          style={[
            styles.sectionHeading,
            isDesktop && styles.desktopSectionHeading,
            { color: colors.text },
          ]}
        >
          Notifications
        </Text>
        <View
          style={[
            styles.sectionCard,
            isDesktop && styles.desktopSectionCard,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <ToggleRow
            icon="notifications-outline"
            title="Push notifications"
            subtitle="Notification preference for the app"
            value={notificationsEnabled}
            onValueChange={(value) =>
              toggleSetting(
                STORAGE.notifications,
                value,
                setNotificationsEnabled,
                "notifications preference",
              )
            }
          />
          <ToggleRow
            icon="alarm-outline"
            iconColor={COLORS.orange}
            iconBackground={COLORS.orangeLight}
            title="Todo reminders"
            subtitle="Reminder preference for tasks"
            value={remindersEnabled}
            onValueChange={(value) =>
              toggleSetting(
                STORAGE.reminders,
                value,
                setRemindersEnabled,
                "reminder preference",
              )
            }
            last
          />
        </View>
        <Text
          style={[
            styles.helperText,
            isDesktop && styles.desktopHelperText,
            { color: colors.secondaryText },
          ]}
        >
          These switches save your preferences on this device. Connect them to
          your notification and reminder scheduling logic to enforce them
          app-wide.
        </Text>

        <Text
          style={[
            styles.sectionHeading,
            isDesktop && styles.desktopSectionHeading,
            { color: colors.text },
          ]}
        >
          Backup & sync
        </Text>
        <View
          style={[
            styles.sectionCard,
            isDesktop && styles.desktopSectionCard,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <SettingRow
            icon="cloud-download-outline"
            iconColor={COLORS.primary}
            title="Manual backup"
            subtitle={
              backupBusy ? "Working…" : "Export local app data to a JSON file"
            }
            onPress={() => void createLocalBackup()}
            rightLabel={backupBusy ? "Please wait" : "Back up"}
          />
          <SettingRow
            icon="folder-open-outline"
            iconColor={COLORS.blue}
            iconBackground={COLORS.blueLight}
            title="Restore backup"
            subtitle="Import a previously exported JSON backup"
            onPress={() => void restoreLocalBackup()}
          />
          <ToggleRow
            icon="sync-outline"
            title="Automatic backup"
            subtitle="Create a local snapshot when you open settings"
            value={autoBackupEnabled}
            onValueChange={async (value) => {
              setAutoBackupEnabled(value);
              await savePreference(
                STORAGE.autoBackup,
                String(value),
                "automatic backup preference",
              );
              if (value)
                Alert.alert(
                  "Automatic backup enabled",
                  "A local snapshot will be created when this settings screen opens. Keep exported files separately for recovery after reinstall.",
                );
            }}
          />
          <SettingRow
            icon="person-circle-outline"
            iconColor={COLORS.purple}
            iconBackground={COLORS.purpleLight}
            title="Backup account"
            subtitle="Choose the account label for this device backup"
            value={backupAccount}
            onPress={chooseBackupAccount}
          />
          <ToggleRow
            icon="cloud-outline"
            title="Cloud backup option"
            subtitle="Requires authenticated cloud storage setup"
            value={cloudBackupEnabled}
            onValueChange={(value) => {
              setCloudBackupEnabled(false);
              void savePreference(
                STORAGE.cloudBackup,
                "false",
                "cloud backup preference",
              );
              Alert.alert(
                "Cloud backup not connected",
                "Cloud backup needs a secure backend or cloud provider integration. No cloud upload was performed.",
              );
            }}
          />
          <ToggleRow
            icon="git-compare-outline"
            title="Cloud synchronization"
            subtitle="Sync notes across devices after backend setup"
            value={cloudSyncEnabled}
            onValueChange={(value) => {
              setCloudSyncEnabled(false);
              void savePreference(
                STORAGE.cloudSync,
                "false",
                "cloud sync preference",
              );
              Alert.alert(
                "Sync not connected",
                "Cross-device sync requires account-scoped backend APIs and conflict handling. No synchronization was performed.",
              );
            }}
            last
          />
        </View>
        <Text
          style={[
            styles.helperText,
            isDesktop && styles.desktopHelperText,
            { color: colors.secondaryText },
          ]}
        >
          Backup status:{" "}
          {lastBackupAt
            ? `Last local backup/restore ${new Date(lastBackupAt).toLocaleString()}`
            : "No backup created yet"}
          . Local backup includes AsyncStorage entries and excludes
          authentication tokens. Notes stored only on your server are not
          downloaded by this local export.
        </Text>

        <Text
          style={[
            styles.sectionHeading,
            isDesktop && styles.desktopSectionHeading,
            { color: colors.text },
          ]}
        >
          Experience
        </Text>
        <View
          style={[
            styles.sectionCard,
            isDesktop && styles.desktopSectionCard,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <SettingRow
            icon="chatbubble-ellipses-outline"
            iconColor={COLORS.blue}
            iconBackground={COLORS.blueLight}
            title="Send feedback"
            subtitle="Share suggestions or report a problem"
            onPress={() => setFeedbackModalVisible(true)}
          />
        </View>

        <Text
          style={[
            styles.sectionHeading,
            isDesktop && styles.desktopSectionHeading,
            { color: colors.text },
          ]}
        >
          Support & information
        </Text>
        <View
          style={[
            styles.sectionCard,
            isDesktop && styles.desktopSectionCard,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <SettingRow
            icon="shield-checkmark-outline"
            iconColor={COLORS.blue}
            iconBackground={COLORS.blueLight}
            title="Privacy & security"
            subtitle="Set PIN, fingerprint and manage app lock"
            onPress={() => router.push("/security")}
          />
          <SettingRow
            icon="help-circle-outline"
            iconColor={COLORS.orange}
            iconBackground={COLORS.orangeLight}
            title="Help & support"
            subtitle="FAQs, troubleshooting & contact"
            onPress={() => setHelpSupportVisible(true)}
          />
          <SettingRow
            icon="information-circle-outline"
            iconColor={COLORS.purple}
            iconBackground={COLORS.purpleLight}
            title="About this app"
            subtitle="Version and app information"
            onPress={() => showInfo("About", "Todo & Notes\nVersion 1.0.0")}
            last
          />
        </View>

        <Text
          style={[
            styles.sectionHeading,
            isDesktop && styles.desktopSectionHeading,
            { color: colors.text },
          ]}
        >
          Account
        </Text>
        <View
          style={[
            styles.sectionCard,
            isDesktop && styles.desktopSectionCard,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Log out"
            onPress={handleLogout}
            style={({ pressed }) => [
              styles.settingRow,
              pressed && styles.pressed,
            ]}
          >
            <View style={[styles.rowIcon, { backgroundColor: "#FDECEC" }]}>
              <Ionicons name="log-out-outline" size={20} color="#C83E4D" />
            </View>
            <View style={styles.rowCopy}>
              <Text style={[styles.rowTitle, { color: "#C83E4D" }]}>
                Log out
              </Text>
              <Text
                style={[styles.rowSubtitle, { color: colors.secondaryText }]}
              >
                Sign out of this account on this device
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#9AA9A3" />
          </Pressable>
        </View>

        <Text
          style={[
            styles.footer,
            isDesktop && styles.desktopFooter,
            { color: colors.secondaryText },
          ]}
        >
          Made for your everyday ideas and tasks.
        </Text>
      </ScrollView>

      {/* Cross-platform logout confirmation (including Electron Desktop). */}
      <Modal
        visible={logoutModalVisible}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={cancelLogout}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(0, 0, 0, 0.48)",
            justifyContent: "center",
            alignItems: "center",
            padding: 20,
          }}
        >
          <Pressable
            style={{
              position: "absolute",
              top: 0,
              right: 0,
              bottom: 0,
              left: 0,
            }}
            onPress={cancelLogout}
            disabled={isLoggingOut}
            accessibilityRole="button"
            accessibilityLabel="Close logout confirmation"
          />

          <View
            style={{
              width: "100%",
              maxWidth: 380,
              backgroundColor: colors.surface,
              borderRadius: 18,
              borderWidth: 1,
              borderColor: colors.border,
              padding: 24,
              elevation: 12,
              shadowColor: "#000",
              shadowOpacity: 0.2,
              shadowRadius: 20,
              shadowOffset: { width: 0, height: 8 },
            }}
          >
            <View
              style={{
                width: 48,
                height: 48,
                borderRadius: 24,
                backgroundColor: "#FDECEC",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 16,
              }}
            >
              <Ionicons name="log-out-outline" size={24} color="#C83E4D" />
            </View>

            <Text
              style={{
                color: colors.text,
                fontSize: 20,
                fontWeight: "700",
              }}
            >
              Log out?
            </Text>

            <Text
              style={{
                color: colors.secondaryText,
                fontSize: 14,
                lineHeight: 22,
                marginTop: 10,
                marginBottom: 24,
              }}
            >
              Are you sure you want to log out of your account?
            </Text>

            <View
              style={{
                flexDirection: "row",
                justifyContent: "flex-end",
                alignItems: "center",
                gap: 12,
              }}
            >
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Cancel logout"
                disabled={isLoggingOut}
                onPress={cancelLogout}
                style={({ pressed }) => ({
                  paddingVertical: 11,
                  paddingHorizontal: 18,
                  borderRadius: 9,
                  borderWidth: 1,
                  borderColor: colors.border,
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <Text style={{ color: colors.text, fontWeight: "600" }}>
                  Cancel
                </Text>
              </Pressable>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Confirm logout"
                disabled={isLoggingOut}
                onPress={confirmLogout}
                style={({ pressed }) => ({
                  paddingVertical: 11,
                  paddingHorizontal: 18,
                  borderRadius: 9,
                  backgroundColor: "#C83E4D",
                  opacity: isLoggingOut ? 0.6 : pressed ? 0.85 : 1,
                })}
              >
                <Text style={{ color: "#FFFFFF", fontWeight: "600" }}>
                  {isLoggingOut ? "Logging out..." : "Log out"}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        transparent
        visible={themeModalVisible}
        animationType="fade"
        onRequestClose={() => setThemeModalVisible(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setThemeModalVisible(false)}
        >
          <Pressable
            style={[styles.modalCard, { backgroundColor: colors.surface }]}
            onPress={() => undefined}
          >
            <View style={styles.modalHeader}>
              <View>
                <Text style={[styles.modalTitle, { color: colors.text }]}>
                  App theme
                </Text>
                <Text
                  style={[
                    styles.modalSubtitle,
                    { color: colors.secondaryText },
                  ]}
                >
                  Choose your preferred appearance
                </Text>
              </View>

              <Pressable
                onPress={() => setThemeModalVisible(false)}
                style={[
                  styles.closeButton,
                  { backgroundColor: colors.background },
                ]}
              >
                <Ionicons name="close" size={21} color={colors.text} />
              </Pressable>
            </View>

            {(["System", "Light", "Dark"] as ThemeChoice[]).map((choice) => {
              const selected = theme === choice;
              const icon =
                choice === "System"
                  ? "phone-portrait-outline"
                  : choice === "Light"
                    ? "sunny-outline"
                    : "moon-outline";

              return (
                <Pressable
                  key={choice}
                  onPress={() => chooseTheme(choice)}
                  style={[
                    styles.themeOption,
                    {
                      backgroundColor: selected
                        ? colors.background
                        : colors.surface,
                      borderColor: selected ? colors.primary : colors.border,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.themeOptionIcon,
                      { backgroundColor: colors.background },
                    ]}
                  >
                    <Ionicons
                      name={icon as keyof typeof Ionicons.glyphMap}
                      size={20}
                      color={selected ? colors.primary : colors.secondaryText}
                    />
                  </View>

                  <View style={styles.themeOptionCopy}>
                    <Text
                      style={[styles.themeOptionTitle, { color: colors.text }]}
                    >
                      {choice}
                    </Text>
                    <Text
                      style={[
                        styles.themeOptionSubtitle,
                        { color: colors.secondaryText },
                      ]}
                    >
                      {choice === "System"
                        ? "Follow device settings"
                        : choice === "Light"
                          ? "Bright and clean"
                          : "Easy on the eyes"}
                    </Text>
                  </View>

                  {selected && (
                    <Ionicons
                      name="checkmark-circle"
                      size={21}
                      color={colors.primary}
                    />
                  )}
                </Pressable>
              );
            })}
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={noteThemeVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setNoteThemeVisible(false)}
      >
        <View style={styles.noteThemeOverlay}>
          <Pressable
            style={styles.noteThemeBackdrop}
            onPress={() => setNoteThemeVisible(false)}
          />

          <View style={styles.noteThemeModal}>
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.noteThemeScrollContent}
            >
              <View style={styles.noteThemeHeader}>
                <View>
                  <Text style={styles.noteThemeTitle}>Note themes</Text>
                  <Text style={styles.noteThemeSubtitle}>
                    Personalize your default paper
                  </Text>
                </View>

                <Pressable
                  onPress={() => setNoteThemeVisible(false)}
                  style={styles.noteThemeClose}
                >
                  <Ionicons name="close" size={22} color="#475569" />
                </Pressable>
              </View>

              <Text style={styles.noteThemeSectionTitle}>Live preview</Text>
              <View
                style={[
                  styles.liveNotePreview,
                  {
                    backgroundColor: defaultNoteColor,
                    borderRadius:
                      noteCornerStyle === "square"
                        ? 2
                        : noteCornerStyle === "soft"
                          ? 24
                          : 14,
                  },
                ]}
              >
                {defaultNotePattern === "lined" && (
                  <View pointerEvents="none" style={styles.livePatternLayer}>
                    {[1, 2, 3, 4, 5].map((line) => (
                      <View
                        key={line}
                        style={[styles.liveHorizontalLine, { top: line * 22 }]}
                      />
                    ))}
                  </View>
                )}
                {defaultNotePattern === "grid" && (
                  <View pointerEvents="none" style={styles.livePatternLayer}>
                    {[1, 2, 3, 4, 5, 6, 7, 8].map((line) => (
                      <View
                        key={`v-${line}`}
                        style={[
                          styles.liveVerticalLine,
                          { left: `${line * 12.5}%` },
                        ]}
                      />
                    ))}
                    {[1, 2, 3, 4, 5].map((line) => (
                      <View
                        key={`h-${line}`}
                        style={[styles.liveHorizontalLine, { top: line * 22 }]}
                      />
                    ))}
                  </View>
                )}
                {defaultNotePattern === "dotted" && (
                  <View pointerEvents="none" style={styles.liveDotsLayer}>
                    {Array.from({ length: 42 }, (_, index) => (
                      <View key={index} style={styles.liveDot} />
                    ))}
                  </View>
                )}
                <View style={styles.livePreviewContent}>
                  <Text
                    style={[styles.livePreviewEyebrow, { color: accentColor }]}
                  >
                    MY NOTEBOOK
                  </Text>
                  <Text
                    style={[
                      styles.livePreviewTitle,
                      {
                        fontSize:
                          noteTextSize === "small"
                            ? 15
                            : noteTextSize === "large"
                              ? 21
                              : 18,
                        color: "#24332E",
                      },
                    ]}
                  >
                    A little reminder
                  </Text>
                  <Text
                    style={[
                      styles.livePreviewBody,
                      {
                        fontSize:
                          noteTextSize === "small"
                            ? 11
                            : noteTextSize === "large"
                              ? 15
                              : 13,
                        color: "#53645D",
                      },
                    ]}
                  >
                    Write your ideas, plans and everyday thoughts here.
                  </Text>
                  <View
                    style={[
                      styles.livePreviewTag,
                      { backgroundColor: accentColor },
                    ]}
                  >
                    <Text style={styles.livePreviewTagText}>
                      {notebookStyle === "journal"
                        ? "JOURNAL"
                        : notebookStyle === "minimal"
                          ? "MINIMAL"
                          : "CLASSIC"}
                    </Text>
                  </View>
                </View>
              </View>

              <Text style={styles.noteThemeSectionTitle}>Paper color</Text>

              <View style={styles.noteThemeColors}>
                {[
                  { name: "Cream", color: "#FFF4CC" },
                  { name: "White", color: "#FFFFFF" },
                  { name: "Pink", color: "#FFE4E8" },
                  { name: "Lavender", color: "#EDE9FE" },
                  { name: "Mint", color: "#DDF7E8" },
                  { name: "Blue", color: "#DBEAFE" },
                  { name: "Peach", color: "#FFEDD5" },
                  { name: "Gray", color: "#F1F5F9" },
                ].map((item) => {
                  const selected = defaultNoteColor === item.color;

                  return (
                    <Pressable
                      key={item.name}
                      style={styles.noteThemeColorOption}
                      onPress={() => setDefaultNoteColor(item.color)}
                    >
                      <View
                        style={[
                          styles.noteThemeColorCircle,
                          {
                            backgroundColor: item.color,
                            borderColor: selected ? "#7C3AED" : "#D1D5DB",
                            borderWidth: selected ? 3 : 1,
                          },
                        ]}
                      >
                        {selected && (
                          <Ionicons
                            name="checkmark"
                            size={19}
                            color="#4338CA"
                          />
                        )}
                      </View>

                      <Text style={styles.noteThemeColorLabel}>
                        {item.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text style={styles.noteThemeSectionTitle}>Paper pattern</Text>

              <View style={styles.noteThemePatterns}>
                {[
                  { id: "plain", label: "Plain" },
                  { id: "lined", label: "Lined" },
                  { id: "dotted", label: "Dotted" },
                  { id: "grid", label: "Grid" },
                ].map((item) => {
                  const selected = defaultNotePattern === item.id;

                  return (
                    <Pressable
                      key={item.id}
                      onPress={() => setDefaultNotePattern(item.id)}
                      style={[
                        styles.noteThemePatternOption,
                        selected && styles.noteThemePatternSelected,
                      ]}
                    >
                      <View
                        style={[
                          styles.noteThemePreview,
                          { backgroundColor: defaultNoteColor },
                          item.id === "lined" && {
                            borderTopWidth: 1,
                            borderColor: "#CBD5E1",
                          },
                          item.id === "grid" && {
                            borderWidth: 1,
                            borderColor: "#CBD5E1",
                          },
                        ]}
                      >
                        {item.id === "lined" && (
                          <View style={styles.noteThemeLines}>
                            {[1, 2, 3, 4].map((line) => (
                              <View key={line} style={styles.noteThemeLine} />
                            ))}
                          </View>
                        )}

                        {item.id === "dotted" && (
                          <View style={styles.noteThemeDots}>
                            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(
                              (dot) => (
                                <View key={dot} style={styles.noteThemeDot} />
                              ),
                            )}
                          </View>
                        )}

                        {item.id === "grid" && (
                          <View style={styles.noteThemeGrid}>
                            {/* Vertical lines */}
                            {[1, 2, 3, 4, 5, 6].map((line) => (
                              <View
                                key={`vertical-${line}`}
                                style={[
                                  styles.noteThemeGridVerticalLine,
                                  { left: `${(line / 7) * 100}%` },
                                ]}
                              />
                            ))}

                            {/* Horizontal lines */}
                            {[1, 2, 3, 4].map((line) => (
                              <View
                                key={`horizontal-${line}`}
                                style={[
                                  styles.noteThemeGridHorizontalLine,
                                  { top: `${line * 20}%` },
                                ]}
                              />
                            ))}
                          </View>
                        )}
                      </View>

                      <View style={styles.noteThemePatternLabelRow}>
                        <Text style={styles.noteThemePatternLabel}>
                          {item.label}
                        </Text>

                        {selected && (
                          <Ionicons
                            name="checkmark-circle"
                            size={17}
                            color="#7C3AED"
                          />
                        )}
                      </View>
                    </Pressable>
                  );
                })}
              </View>

              

              <Text style={styles.noteThemeSectionTitle}>App accent color</Text>
              <View style={styles.accentPalette}>
                {ACCENT_COLORS.map((item) => (
                  <Pressable
                    key={item.name}
                    onPress={() => setAccentColor(item.color)}
                    style={styles.accentOption}
                    accessibilityLabel={`${item.name} accent`}
                  >
                    <View
                      style={[
                        styles.accentCircle,
                        {
                          backgroundColor: item.color,
                          borderColor:
                            accentColor === item.color
                              ? "#172033"
                              : "transparent",
                          borderWidth: accentColor === item.color ? 3 : 0,
                        },
                      ]}
                    >
                      {accentColor === item.color && (
                        <Ionicons name="checkmark" size={17} color="#FFFFFF" />
                      )}
                    </View>
                    <Text style={styles.noteThemeColorLabel}>{item.name}</Text>
                  </Pressable>
                ))}
              </View>

              <Text style={styles.noteThemeSectionTitle}>Notebook style</Text>
              <View style={styles.choiceRow}>
                {[
                  { id: "classic", label: "Classic", icon: "book-outline" },
                  { id: "minimal", label: "Minimal", icon: "document-outline" },
                  { id: "journal", label: "Journal", icon: "journal-outline" },
                ].map((item) => (
                  <Pressable
                    key={item.id}
                    onPress={() => setNotebookStyle(item.id)}
                    style={[
                      styles.choiceChip,
                      notebookStyle === item.id && styles.choiceChipSelected,
                    ]}
                  >
                    <Ionicons
                      name={item.icon as keyof typeof Ionicons.glyphMap}
                      size={17}
                      color={notebookStyle === item.id ? "#6D4ACD" : "#64748B"}
                    />
                    <Text
                      style={[
                        styles.choiceChipText,
                        notebookStyle === item.id &&
                          styles.choiceChipTextSelected,
                      ]}
                    >
                      {item.label}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <Text style={styles.noteThemeSectionTitle}>Note appearance</Text>
              <Text style={styles.appearanceLabel}>Text size</Text>
              <View style={styles.choiceRow}>
                {["small", "medium", "large"].map((size) => (
                  <Pressable
                    key={size}
                    onPress={() => setNoteTextSize(size)}
                    style={[
                      styles.choiceChip,
                      noteTextSize === size && styles.choiceChipSelected,
                    ]}
                  >
                    <Text
                      style={[
                        styles.choiceChipText,
                        noteTextSize === size && styles.choiceChipTextSelected,
                      ]}
                    >
                      {size[0].toUpperCase() + size.slice(1)}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <Text style={styles.appearanceLabel}>Paper corners</Text>
              <View style={styles.choiceRow}>
                {[
                  { id: "square", label: "Square" },
                  { id: "rounded", label: "Rounded" },
                  { id: "soft", label: "Soft" },
                ].map((item) => (
                  <Pressable
                    key={item.id}
                    onPress={() => setNoteCornerStyle(item.id)}
                    style={[
                      styles.choiceChip,
                      noteCornerStyle === item.id && styles.choiceChipSelected,
                    ]}
                  >
                    <Text
                      style={[
                        styles.choiceChipText,
                        noteCornerStyle === item.id &&
                          styles.choiceChipTextSelected,
                      ]}
                    >
                      {item.label}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <Text style={styles.noteThemeSectionTitle}>
                Home screen personalization
              </Text>
              <Text style={styles.appearanceLabel}>Layout density</Text>
              <View style={styles.choiceRow}>
                {[
                  { id: "compact", label: "Compact" },
                  { id: "comfortable", label: "Comfortable" },
                  { id: "spacious", label: "Spacious" },
                ].map((item) => (
                  <Pressable
                    key={item.id}
                    onPress={() => setHomeLayout(item.id)}
                    style={[
                      styles.choiceChip,
                      homeLayout === item.id && styles.choiceChipSelected,
                    ]}
                  >
                    <Text
                      style={[
                        styles.choiceChipText,
                        homeLayout === item.id && styles.choiceChipTextSelected,
                      ]}
                    >
                      {item.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <View style={styles.homeToggleRow}>
                <View style={styles.homeToggleCopy}>
                  <Text style={styles.choiceChipText}>Show greeting</Text>
                  <Text style={styles.noteThemeSubtitle}>
                    Personal welcome on your home screen
                  </Text>
                </View>
                <Switch
                  value={showHomeGreeting}
                  onValueChange={setShowHomeGreeting}
                  trackColor={{ false: "#CBD5E1", true: "#B7A5F3" }}
                  thumbColor={showHomeGreeting ? "#6D4ACD" : "#FFFFFF"}
                />
              </View>
              <View style={styles.homeToggleRow}>
                <View style={styles.homeToggleCopy}>
                  <Text style={styles.choiceChipText}>Show overview cards</Text>
                  <Text style={styles.noteThemeSubtitle}>
                    Quick totals and progress summaries
                  </Text>
                </View>
                <Switch
                  value={showHomeStats}
                  onValueChange={setShowHomeStats}
                  trackColor={{ false: "#CBD5E1", true: "#B7A5F3" }}
                  thumbColor={showHomeStats ? "#6D4ACD" : "#FFFFFF"}
                />
              </View>

              <Text style={styles.noteThemeHint}>
                Preview updates above as you choose. Save to store defaults for
                new notes and your home-screen preferences.
              </Text>

              <View style={styles.noteThemeActions}>
                <Pressable
                  style={styles.noteThemeCancelButton}
                  onPress={() => setNoteThemeVisible(false)}
                >
                  <Text style={styles.noteThemeCancelText}>Cancel</Text>
                </Pressable>

                <Pressable
                  style={styles.noteThemeSaveButton}
                  onPress={saveDefaultNoteTheme}
                >
                  <Ionicons name="checkmark" size={19} color="#FFFFFF" />
                  <Text style={styles.noteThemeSaveText}>Save default</Text>
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal
        visible={helpSupportVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setHelpSupportVisible(false)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(15,23,42,0.45)",
            justifyContent: "flex-end",
          }}
        >
          <View
            style={{
              backgroundColor: "#FFFFFF",
              borderTopLeftRadius: 28,
              borderTopRightRadius: 28,
              padding: 22,
              maxHeight: "88%",
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 20,
              }}
            >
              <View>
                <Text
                  style={{ fontSize: 23, fontWeight: "700", color: "#172033" }}
                >
                  Help & Support
                </Text>
                <Text style={{ fontSize: 13, color: "#64748B", marginTop: 5 }}>
                  We're here to help you
                </Text>
              </View>

              <Pressable
                onPress={() => setHelpSupportVisible(false)}
                accessibilityLabel="Close help and support"
                style={{ padding: 8 }}
              >
                <Ionicons name="close" size={25} color="#475569" />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {[
                {
                  question: "How do I create a note?",
                  answer:
                    "Open the Create Note screen, enter your title and content, and tap Save.",
                },
                {
                  question: "How do I edit or delete a note?",
                  answer:
                    "Open the note and use the available edit or delete actions. Confirm before deleting if prompted.",
                },
                {
                  question: "How do I pin important notes?",
                  answer:
                    "Use the pin option on a note, if available, to keep important notes easy to find.",
                },
                {
                  question: "What should I do if my notes are missing?",
                  answer:
                    "Check your selected collection and filters, then reopen the app. Avoid clearing app data until you have confirmed your notes are backed up.",
                },
              ].map((faq, index) => (
                <View
                  key={faq.question}
                  style={{
                    borderBottomWidth: 1,
                    borderBottomColor: "#E8EDF4",
                    paddingVertical: 15,
                  }}
                >
                  <Pressable
                    onPress={() =>
                      setExpandedFaq(expandedFaq === index ? null : index)
                    }
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <Text
                      style={{
                        flex: 1,
                        fontSize: 15,
                        fontWeight: "600",
                        color: "#243047",
                        paddingRight: 12,
                      }}
                    >
                      {faq.question}
                    </Text>

                    <Ionicons
                      name={
                        expandedFaq === index ? "chevron-up" : "chevron-down"
                      }
                      size={19}
                      color="#64748B"
                    />
                  </Pressable>

                  {expandedFaq === index && (
                    <Text
                      style={{
                        color: "#64748B",
                        fontSize: 14,
                        lineHeight: 22,
                        marginTop: 12,
                      }}
                    >
                      {faq.answer}
                    </Text>
                  )}
                </View>
              ))}

              <Pressable
                onPress={() =>
                  Alert.alert(
                    "Contact Support",
                    "Configure your support email address to enable email support.",
                  )
                }
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  backgroundColor: "#FFF4E5",
                  borderRadius: 16,
                  padding: 16,
                  marginTop: 20,
                  marginBottom: 24,
                }}
              >
                <Ionicons name="mail-outline" size={24} color="#EA8A16" />

                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text
                    style={{
                      fontSize: 15,
                      fontWeight: "700",
                      color: "#172033",
                    }}
                  >
                    Contact Support
                  </Text>
                  <Text
                    style={{ fontSize: 13, color: "#64748B", marginTop: 4 }}
                  >
                    Get help with an app issue
                  </Text>
                </View>

                <Ionicons name="chevron-forward" size={20} color="#64748B" />
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal
        visible={feedbackModalVisible}
        transparent
        animationType={Platform.OS === "web" ? "fade" : "slide"}
        onRequestClose={() => setFeedbackModalVisible(false)}
      >
        <View style={styles.overlay}>
          <View
            style={[
              styles.feedbackKeyboardInner,
              Platform.OS === "web" && styles.webFeedbackContainer,
            ]}
          >
            <View style={[styles.modal, { backgroundColor: colors.surface }]}>
              <ScrollView
                style={styles.feedbackScroll}
                contentContainerStyle={styles.feedbackScrollContent}
                keyboardShouldPersistTaps="always"
                showsVerticalScrollIndicator={false}
                nestedScrollEnabled
              >
                {/* Header */}
                <View style={styles.feedbackHeader}>
                  <View style={styles.headingGroup}>
                    <View style={styles.iconCircle}>
                      <Ionicons
                        name="chatbubble-ellipses-outline"
                        size={24}
                        color={COLORS.blue}
                      />
                    </View>

                    <View style={styles.feedbackHeadingText}>
                      <Text style={[styles.title, { color: colors.text }]}>
                        Send feedback
                      </Text>
                      <Text
                        style={[
                          styles.subtitle,
                          { color: colors.textSecondary },
                        ]}
                      >
                        Help us improve your experience
                      </Text>
                    </View>
                  </View>

                  <Pressable
                    onPress={() => setFeedbackModalVisible(false)}
                    hitSlop={10}
                    accessibilityLabel="Close feedback form"
                  >
                    <Ionicons
                      name="close-circle-outline"
                      size={27}
                      color={colors.textSecondary}
                    />
                  </Pressable>
                </View>

                {/* Feedback type */}
                <Text style={[styles.label, { color: colors.text }]}>
                  Feedback type
                </Text>

                <View style={styles.typeRow}>
                  {["Suggestion", "Bug report", "Other"].map((type) => {
                    const selected = feedbackType === type;

                    return (
                      <Pressable
                        key={type}
                        onPress={() => setFeedbackType(type)}
                        style={[
                          styles.typeChip,
                          {
                            backgroundColor: selected
                              ? COLORS.blueLight
                              : colors.surface,
                            borderColor: selected ? COLORS.blue : colors.border,
                          },
                        ]}
                      >
                        <Text
                          style={{
                            color: selected ? COLORS.blue : colors.text,
                            fontWeight: selected ? "700" : "500",
                            fontSize: 12,
                          }}
                        >
                          {type}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                {/* Message */}
                <Text style={[styles.label, { color: colors.text }]}>
                  Your message *
                </Text>

                <TextInput
                  value={feedbackMessage}
                  onChangeText={setFeedbackMessage}
                  placeholder="Tell us what you think or what we can improve..."
                  placeholderTextColor={colors.textSecondary}
                  multiline
                  editable
                  maxLength={3000}
                  textAlignVertical="top"
                  style={[
                    styles.messageInput,
                    {
                      color: colors.text,
                      backgroundColor: colors.background,
                      borderColor: colors.border,
                    },
                    Platform.OS === "web" && styles.webTextInput,
                  ]}
                />

                <Text style={[styles.counter, { color: colors.textSecondary }]}>
                  {feedbackMessage.length}/3000
                </Text>

                {/* Email */}
                <Text style={[styles.label, { color: colors.text }]}>
                  Email address (optional)
                </Text>

                <TextInput
                  value={feedbackEmail}
                  onChangeText={setFeedbackEmail}
                  placeholder="you@example.com"
                  placeholderTextColor={colors.textSecondary}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable
                  style={[
                    styles.emailInput,
                    {
                      color: colors.text,
                      backgroundColor: colors.background,
                      borderColor: colors.border,
                    },
                    Platform.OS === "web" && styles.webTextInput,
                  ]}
                />

                {/* Submit */}
                <Pressable
                  onPress={sendFeedback}
                  disabled={feedbackSubmitting}
                  style={[
                    styles.sendButton,
                    { opacity: feedbackSubmitting ? 0.6 : 1 },
                  ]}
                >
                  {feedbackSubmitting ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Ionicons name="send-outline" size={19} color="#FFFFFF" />
                  )}

                  <Text style={styles.sendButtonText}>
                    {feedbackSubmitting ? "Submitting..." : "Submit feedback"}
                  </Text>
                </Pressable>

                <Text
                  style={[
                    styles.feedbackFooter,
                    { color: colors.textSecondary },
                  ]}
                >
                  Your feedback will be submitted to help improve the app.
                </Text>
              </ScrollView>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  feedbackKeyboardInner: {
    width: "100%",
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },

  webFeedbackContainer: {
    height: "100vh" as any,
    overflow: "auto" as any,
  },

  feedbackScroll: {
    width: "100%",
  },

  feedbackScrollContent: {
    padding: 20,
    paddingBottom: 30,
  },

  webTextInput: {
    outlineStyle: "none" as any,
    cursor: "text" as any,
    userSelect: "text" as any,
    pointerEvents: "auto" as any,
  },

  messageInput: {
    minHeight: 120,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    fontSize: 15,
    textAlignVertical: "top",
  },

  emailInput: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    fontSize: 15,
  },

  modal: {
    width: "100%",
    maxWidth: 550,
    maxHeight: "85%",
    borderRadius: 20,
    overflow: "hidden",
  },

  liveNotePreview: {
    minHeight: 150,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "#D8DEE8",
    overflow: "hidden",
    position: "relative",
  },
  livePatternLayer: {
    ...StyleSheet.absoluteFill,
    overflow: "hidden",
  },

  feedbackKeyboard: {
    flex: 1,
    width: "100%",
    justifyContent: "center",
  },

  feedbackHeadingText: {
    flexShrink: 1,
  },

  liveHorizontalLine: {
    position: "absolute",
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: "#9AA9B866",
  },
  liveVerticalLine: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: StyleSheet.hairlineWidth,
    backgroundColor: "#9AA9B866",
  },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.48)",
    justifyContent: "center",
    padding: 18,
  },

  feedbackHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 24,
  },
  headingGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: "#E8F1FF",
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
  },
  subtitle: {
    fontSize: 12,
    marginTop: 4,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 10,
  },
  typeRow: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
    marginBottom: 22,
  },
  typeChip: {
    borderWidth: 1,
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 13,
  },

  counter: {
    textAlign: "right",
    fontSize: 11,
    marginBottom: 18,
  },

  sendButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    minHeight: 50,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    marginTop: 20,
  },
  sendButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
  feedbackFooter: {
    textAlign: "center",
    fontSize: 11,
    lineHeight: 17,
    marginTop: 12,
  },
  liveDotsLayer: {
    ...StyleSheet.absoluteFill,
    flexDirection: "row",
    flexWrap: "wrap",
    alignContent: "space-around",
    justifyContent: "space-around",
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  liveDot: {
    width: 3,
    height: 3,
    borderRadius: 2,
    backgroundColor: "#9AA9B8",
    margin: 6,
  },
  livePreviewContent: { zIndex: 1 },
  livePreviewEyebrow: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  livePreviewTitle: { fontWeight: "800", marginBottom: 6 },
  livePreviewBody: { lineHeight: 19, maxWidth: 250 },
  livePreviewTag: {
    alignSelf: "flex-start",
    marginTop: 12,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 8,
  },
  livePreviewTagText: {
    color: "#FFFFFF",
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.5,
  },

  noteThemeScrollContent: { paddingBottom: 6 },
  customColorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 22,
  },
  customColorSwatch: {
    width: 38,
    height: 38,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#D1D5DB",
  },
  customColorInput: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#D8DEE8",
    paddingHorizontal: 12,
    color: "#172033",
    backgroundColor: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
  applyColorButton: {
    height: 42,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: "#6D4ACD",
    alignItems: "center",
    justifyContent: "center",
  },
  applyColorText: { color: "#FFFFFF", fontSize: 12, fontWeight: "800" },
  accentPalette: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  accentOption: { width: "16%", alignItems: "center", gap: 5 },
  accentCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  choiceRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 18,
  },
  choiceChip: {
    minHeight: 40,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  choiceChipSelected: { borderColor: "#8B73D6", backgroundColor: "#F3EFFF" },
  choiceChipText: { color: "#475569", fontSize: 12, fontWeight: "700" },
  choiceChipTextSelected: { color: "#6240B8" },
  appearanceLabel: {
    color: "#64748B",
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 8,
  },
  homeToggleRow: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#E2E8F0",
    paddingVertical: 8,
    marginBottom: 5,
  },
  homeToggleCopy: { flex: 1, paddingRight: 12 },

  noteThemeGrid: {
    ...StyleSheet.absoluteFill,
    overflow: "hidden",
  },

  noteThemeGridVerticalLine: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: "#CBD5E1",
    left: "16.66%",
  },

  noteThemeGridHorizontalLine: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: "#CBD5E1",
  },
  noteThemeOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(15, 23, 42, 0.48)",
  },
  noteThemeBackdrop: {
    ...StyleSheet.absoluteFill,
  },
  noteThemeModal: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 22,
    paddingTop: 24,
    paddingBottom: 30,
    maxHeight: "90%",
  },
  noteThemeHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 24,
  },
  noteThemeTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#172033",
  },
  noteThemeSubtitle: {
    fontSize: 13,
    color: "#64748B",
    marginTop: 5,
  },
  noteThemeClose: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  noteThemeSectionTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#334155",
    marginBottom: 14,
  },
  noteThemeColors: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: 24,
  },
  noteThemeColorOption: {
    width: "23%",
    alignItems: "center",
    marginBottom: 16,
  },
  noteThemeColorCircle: {
    width: 43,
    height: 43,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  noteThemeColorLabel: {
    marginTop: 7,
    fontSize: 11,
    color: "#475569",
    fontWeight: "600",
  },
  noteThemePatterns: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  noteThemePatternOption: {
    width: "48%",
    padding: 9,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginBottom: 12,
  },
  noteThemePatternSelected: {
    borderColor: "#7C3AED",
    backgroundColor: "#F5F3FF",
  },
  noteThemePreview: {
    height: 74,
    borderRadius: 8,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  noteThemeLines: {
    flex: 1,
    justifyContent: "space-evenly",
    paddingHorizontal: 8,
  },
  noteThemeLine: {
    height: 1,
    backgroundColor: "#94A3B8",
  },
  noteThemeDots: {
    flex: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    alignContent: "space-evenly",
    justifyContent: "space-evenly",
    padding: 8,
  },
  noteThemeDot: {
    width: 3,
    height: 3,
    borderRadius: 2,
    backgroundColor: "#94A3B8",
    margin: 4,
  },

  noteThemeGridLine: {
    width: 1,
    height: "100%",
    backgroundColor: "#CBD5E1",
  },
  noteThemePatternLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 9,
  },
  noteThemePatternLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#334155",
  },
  noteThemeHint: {
    fontSize: 12,
    lineHeight: 18,
    color: "#64748B",
    marginBottom: 20,
  },
  noteThemeActions: {
    flexDirection: "row",
    gap: 12,
  },
  noteThemeCancelButton: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F1F5F9",
  },
  noteThemeCancelText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#475569",
  },
  noteThemeSaveButton: {
    flex: 1.5,
    height: 48,
    borderRadius: 14,
    flexDirection: "row",
    gap: 7,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#7C3AED",
  },
  noteThemeSaveText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  importContactButton: {
    minHeight: 76,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  importContactIcon: {
    width: 44,
    height: 44,
    borderRadius: 15,
    backgroundColor: COLORS.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  importContactCopy: { flex: 1 },
  importContactButtonText: { fontSize: 14, fontWeight: "700" },
  desktopSafeArea: {
    alignItems: "center",
  },
  desktopScrollContent: {
    width: "100%",
    alignItems: "center",
    paddingHorizontal: 42,
    paddingTop: 34,
    paddingBottom: 64,
  },
  desktopHeader: {
    width: "100%",
    maxWidth: 1120,
    marginBottom: 30,
    gap: 18,
  },
  desktopBackButton: {
    width: 48,
    height: 48,
    borderRadius: 16,
  },
  desktopHeaderCopy: {
    paddingVertical: 2,
  },
  desktopEyebrow: {
    fontSize: 11,
    letterSpacing: 2.2,
    marginBottom: 7,
  },
  desktopHeaderTitle: {
    fontSize: 34,
    letterSpacing: -1.1,
  },
  desktopHeaderSubtitle: {
    fontSize: 14,
    marginTop: 6,
  },
  desktopHeaderMark: {
    width: 54,
    height: 54,
    borderRadius: 18,
  },
  desktopHeroCard: {
    width: "100%",
    maxWidth: 1120,
    minHeight: 178,
    paddingHorizontal: 34,
    paddingVertical: 30,
    borderRadius: 28,
    marginBottom: 34,
  },
  desktopHeroCardLarge: {
    minHeight: 194,
    paddingHorizontal: 42,
  },
  desktopHeroTitle: {
    fontSize: 25,
    lineHeight: 32,
    maxWidth: 420,
  },
  desktopHeroSubtitle: {
    fontSize: 14,
    lineHeight: 22,
    maxWidth: 500,
    marginTop: 10,
  },
  desktopSectionHeading: {
    width: "100%",
    maxWidth: 1120,
    fontSize: 15,
    letterSpacing: 0.5,
    marginBottom: 13,
    marginTop: 8,
    marginLeft: 0,
  },
  desktopSectionCard: {
    width: "100%",
    maxWidth: 1120,
    borderRadius: 20,
    paddingHorizontal: 24,
    marginBottom: 28,
    shadowOpacity: 0.035,
    shadowRadius: 12,
  },
  desktopHelperText: {
    width: "100%",
    maxWidth: 1120,
    fontSize: 12,
    lineHeight: 19,
    marginTop: -15,
    marginBottom: 28,
    paddingHorizontal: 4,
  },
  desktopFooter: {
    width: "100%",
    maxWidth: 1120,
    fontSize: 12,
    marginTop: 10,
  },
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  loadingScreen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.background,
    gap: 12,
  },
  loadingText: { color: COLORS.secondary, fontSize: 14, fontWeight: "500" },
  scrollContent: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 42 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 24,
    gap: 12,
  },
 backButton: {
  width: 42,
  height: 42,
  borderRadius: 12,
  alignItems: "center",
  justifyContent: "center",
  marginRight: 12,
},
  headerCopy: { flex: 1 },
  eyebrow: {
    fontSize: 10,
    letterSpacing: 1.7,
    fontWeight: "800",
    color: COLORS.primary,
    marginBottom: 3,
  },
  headerTitle: {
    fontSize: 27,
    fontWeight: "800",
    color: COLORS.text,
    letterSpacing: -0.7,
  },
  headerSubtitle: { fontSize: 12, color: COLORS.secondary, marginTop: 3 },
  headerMark: {
    width: 46,
    height: 46,
    borderRadius: 16,
    backgroundColor: COLORS.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#CBE9DE",
  },
  heroCard: {
    minHeight: 150,
    borderRadius: 26,
    padding: 22,
    flexDirection: "row",
    alignItems: "center",
    overflow: "hidden",
    marginBottom: 28,
    borderWidth: 1,
    borderColor: "#D4EEE3",
  },
  heroText: { flex: 1, paddingRight: 10, zIndex: 1 },
  heroTitle: {
    fontSize: 19,
    lineHeight: 24,
    fontWeight: "800",
    color: COLORS.primaryDark,
    maxWidth: 235,
  },
  heroSubtitle: {
    fontSize: 12,
    lineHeight: 18,
    color: "#47796C",
    marginTop: 8,
    maxWidth: 245,
  },
  heroIconWrap: {
    width: 62,
    height: 62,
    borderRadius: 22,
    backgroundColor: "#FFFFFFB8",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
  },
  heroDecoration: {
    position: "absolute",
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: "#FFFFFF55",
    right: -32,
    top: -44,
  },
  sectionHeading: {
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 0.35,
    color: COLORS.text,
    marginBottom: 11,
    marginLeft: 3,
    marginTop: 3,
  },
  sectionCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 15,
    marginBottom: 25,
    shadowColor: "#183B30",
    shadowOpacity: 0.055,
    shadowRadius: 15,
    shadowOffset: { width: 0, height: 5 },
    elevation: 2,
  },
  settingRow: {
    minHeight: 78,
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    gap: 12,
  },
  rowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  pressed: { opacity: 0.72 },
  rowIcon: {
    width: 44,
    height: 44,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  rowCopy: { flex: 1 },
  rowTitle: { fontSize: 14, fontWeight: "750", color: COLORS.text },
  rowSubtitle: {
    fontSize: 11,
    lineHeight: 16,
    color: COLORS.secondary,
    marginTop: 4,
  },
  valueText: {
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.primary,
    marginRight: 1,
  },
  helperText: {
    fontSize: 11,
    lineHeight: 17,
    color: COLORS.secondary,
    marginTop: -14,
    marginBottom: 24,
    paddingHorizontal: 3,
  },
  footer: {
    textAlign: "center",
    fontSize: 11,
    color: "#91A29B",
    marginTop: 2,
    marginBottom: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(14, 31, 26, 0.42)",
    justifyContent: "center",
    padding: 22,
  },
  modalCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 25,
    padding: 20,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 18,
  },
  modalTitle: { fontSize: 20, fontWeight: "800", color: COLORS.text },
  modalSubtitle: { fontSize: 12, color: COLORS.secondary, marginTop: 4 },
  closeButton: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: COLORS.muted,
    alignItems: "center",
    justifyContent: "center",
  },
  themeOption: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    padding: 12,
    marginTop: 9,
    gap: 12,
  },
  themeOptionSelected: {
    borderColor: COLORS.primary,
    backgroundColor: "#F0FAF6",
  },
  themeOptionIcon: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: COLORS.muted,
    alignItems: "center",
    justifyContent: "center",
  },
  themeOptionIconSelected: { backgroundColor: COLORS.primaryLight },
  themeOptionCopy: { flex: 1 },
  themeOptionTitle: { fontSize: 14, fontWeight: "700", color: COLORS.text },
  themeOptionSubtitle: { fontSize: 11, color: COLORS.secondary, marginTop: 3 },
});
