import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  AppState,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAppTheme } from "../../context/app-theme-context";
import API from "../../services/api";
import {
  getPendingQuickNotes,
  removePendingQuickNote,
} from "../../services/OfflineQuickNote";
import { getPendingRegistrations } from "../../services/offlineRegistration";
import {
  getPendingTodos,
  removePendingTodo,
} from "../../services/offlineTodoQueue";

// Keep these paths aligned with your app/ filenames.
const ROUTES = {
  quickNotes: "/quicknotes",
  createTodo: "/cretenote",
  viewTodos: "/viewlist",
  settings: "/settings",
} as const;

type Palette = {
  background: string;
  card: string;
  ink: string;
  secondary: string;
  border: string;
  mint: string;
  deepGreen: string;
  softMint: string;
  white: string;
  heroText: string;
  heroSubtext: string;
};

const LIGHT_COLORS: Palette = {
  background: "#F3F9F6",
  card: "#FFFFFF",
  ink: "#183B32",
  secondary: "#71877E",
  border: "#DFEDE6",
  mint: "#32AD91",
  deepGreen: "#17483F",
  softMint: "#E3F5ED",
  white: "#FFFFFF",
  heroText: "#E9FFF5",
  heroSubtext: "#D9F5E9",
};

const DARK_COLORS: Palette = {
  background: "#101C19",
  card: "#1B2B26",
  ink: "#F0FAF5",
  secondary: "#A4B9AF",
  border: "#30453C",
  mint: "#5AD5B0",
  deepGreen: "#143D33",
  softMint: "#243F35",
  white: "#FFFFFF",
  heroText: "#E9FFF5",
  heroSubtext: "#D9F5E9",
};

type ActionCardProps = {
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  gradient: readonly [string, string, ...string[]];
  onPress: () => void;
};

function ActionCard({
  title,
  subtitle,
  icon,
  gradient,
  onPress,
}: ActionCardProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${subtitle}`}
      onPress={onPress}
      style={({ pressed }) => [styles.actionWrap, pressed && styles.pressed]}
    >
      <LinearGradient
        colors={gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.actionCard}
      >
        <View style={styles.actionTop}>
          <View style={styles.actionIcon}>
            <Ionicons name={icon} size={23} color="#FFFFFF" />
          </View>

          <View style={styles.arrowBubble}>
            <Ionicons name="arrow-forward" size={15} color="#FFFFFF" />
          </View>
        </View>

        <Text style={styles.actionTitle}>{title}</Text>
        <Text style={styles.actionSubtitle}>{subtitle}</Text>
      </LinearGradient>
    </Pressable>
  );
}

type HomeUser = {
  userName?: string;
  email?: string;
  Description?: string;
  profilePicUrl?: string;
};

export default function HomeScreen() {
  const router = useRouter();
  const { isDark, colors: appColors } = useAppTheme();
  const { width: windowWidth } = useWindowDimensions();
  const isDesktop = Platform.OS === "web" && windowWidth >= 1000;

  const [user, setUser] = useState<HomeUser | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  // Prevent overlapping profile refreshes triggered by focus, app resume,
  // network reconnect, and manual sync at nearly the same time.
  const profileRefreshInFlightRef = useRef(false);

  const refreshPendingCount = useCallback(async () => {
    try {
      const userId = await AsyncStorage.getItem("userId");
      const [pendingTodos, pendingQuickNotes, pendingRegistrations] =
        await Promise.all([
          getPendingTodos(userId || undefined),
          getPendingQuickNotes(),
          getPendingRegistrations(),
        ]);
      // Include offline Todos, Quick Notes, and pending registrations.
      const userQuickNotes = userId
        ? pendingQuickNotes.filter((note) => note.userId === userId)
        : [];
      setPendingCount(
        pendingTodos.length +
          userQuickNotes.length +
          pendingRegistrations.length,
      );
    } catch (error) {
      console.warn("Unable to read pending sync items:", error);
      setPendingCount(0);
    }
  }, []);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsOnline(
        state.isConnected === true && state.isInternetReachable !== false,
      );
    });

    refreshPendingCount();
    return unsubscribe;
  }, [refreshPendingCount]);

  const getUser = useCallback(async () => {
    if (profileRefreshInFlightRef.current) {
      return;
    }

    profileRefreshInFlightRef.current = true;

    try {
      const userId = await AsyncStorage.getItem("userId");

      if (!userId) {
        console.warn("getUser: userId was not found in AsyncStorage.");
        setUser(null);
        setProfileLoading(false);
        return;
      }

      const cacheKey = `cachedProfile:${userId}`;

      // 1. Load cached profile first.
      let cachedUser: HomeUser | null = null;

      const cachedProfile = await AsyncStorage.getItem(cacheKey);

      if (cachedProfile) {
        try {
          cachedUser = JSON.parse(cachedProfile) as HomeUser;
          setUser(cachedUser);
        } catch (error) {
          console.warn("Invalid cached profile:", error);
          await AsyncStorage.removeItem(cacheKey);
        }
      }

      // 2. Check network availability.
      const network = await NetInfo.fetch();

      const online =
        network.isConnected === true && network.isInternetReachable !== false;

      const offlineMode =
        (await AsyncStorage.getItem("offlineMode")) === "true";

      if (!online || offlineMode) {
        return;
      }

      // 3. Fetch latest profile from backend.
      const response = await API.post("/api/getUser", { userId });

      console.log("GET USER RESPONSE:", response.data);

      if (!response.data?.success) {
        console.warn(
          "getUser failed:",
          response.data?.message || "Server did not return success.",
        );
        return;
      }

      const userData =
        response.data.user ??
        response.data.data ??
        response.data.userDetails ??
        response.data;

      // 4. Preserve existing image URL if backend returns empty string.
      const serverImageUrl =
        typeof userData?.profilePicUrl === "string"
          ? userData.profilePicUrl.trim()
          : "";

      const cachedImageUrl =
        typeof cachedUser?.profilePicUrl === "string"
          ? cachedUser.profilePicUrl.trim()
          : "";

      const profile: HomeUser = {
        userName: userData?.userName ?? cachedUser?.userName ?? "",
        email: userData?.email ?? cachedUser?.email ?? "",
        Description: userData?.Description ?? cachedUser?.Description ?? "",
        profilePicUrl: serverImageUrl || cachedImageUrl,
      };

      console.log("PROFILE IMAGE URL:", profile.profilePicUrl);

      // 5. Update state and cache.
      setUser(profile);

      await AsyncStorage.setItem(cacheKey, JSON.stringify(profile));
    } catch (error: any) {
      console.error(
        "getUser API error; cached profile will be kept:",
        error?.response?.data ?? error?.message ?? error,
      );
    } finally {
      setProfileLoading(false);
      profileRefreshInFlightRef.current = false;
    }
  }, []);

  // Refresh whenever Home becomes the active route.
  useFocusEffect(
    useCallback(() => {
      getUser();
      return undefined;
    }, [getUser]),
  );

  // Refresh after restoring the Electron/mobile app from the background.
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") {
        getUser();
        refreshPendingCount();
      }
    });

    return () => subscription.remove();
  }, [getUser, refreshPendingCount]);

  // Refresh the profile when connectivity changes from offline to online.
  useEffect(() => {
    let wasOnline = false;

    const unsubscribe = NetInfo.addEventListener((state) => {
      const nowOnline =
        state.isConnected === true && state.isInternetReachable !== false;

      if (nowOnline && !wasOnline) {
        getUser();
        refreshPendingCount();
      }

      wasOnline = nowOnline;
    });

    return unsubscribe;
  }, [getUser, refreshPendingCount]);

  const handleSync = useCallback(async () => {
    if (syncing) return;

    setSyncing(true);

    try {
      const network = await NetInfo.fetch();
      const online =
        network.isConnected === true && network.isInternetReachable !== false;

      if (!online) {
        Alert.alert(
          "You are offline",
          "Connect to the internet, then tap Sync Data again. Your local Todos remain queued.",
        );
        return;
      }

      const token =
        (await AsyncStorage.getItem("login_token")) ||
        (await AsyncStorage.getItem("token"));

      if (!token) {
        Alert.alert(
          "Login required",
          "Please sign in again before syncing your Todos.",
        );
        return;
      }

      const authHeaders = {
        Authorization: token.startsWith("Bearer ") ? token : `Bearer ${token}`,
      };

      // Read only this signed-in user's queue; never upload another user's data.
      const currentUserId = await AsyncStorage.getItem("userId");
      if (!currentUserId) {
        Alert.alert(
          "Login required",
          "Your user ID was not found. Please sign in again.",
        );
        return;
      }
      const userTodos = await getPendingTodos(currentUserId);

      let syncedCount = 0;
      let failedCount = 0;

      for (const todo of userTodos) {
        try {
          const formData = await buildQueuedTodoFormData(todo);

          const isUpdate = todo.operation === "update" && Boolean(todo.todoId);

          // Use the app's configured API client so its base URL and interceptors apply.
          const response = isUpdate
            ? await API.put(`/api/updateTodolist/${todo.todoId}`, formData, {
                headers: authHeaders,
                timeout: 30000,
              })
            : await API.post("/api/createTodolist", formData, {
                headers: authHeaders,
                timeout: 30000,
              });

          if (response.data?.success !== true) {
            throw new Error(
              response.data?.message || "The server did not confirm the save.",
            );
          }

          // Remove only after the backend confirms success.
          await removePendingTodo(todo.id);
          syncedCount += 1;
        } catch (error) {
          failedCount += 1;

          console.error("[Todo Sync] Failed:", {
            queueId: todo.id,
            operation: todo.operation,
            todoId: todo.todoId,
            message:
              (error as any)?.response?.data?.message ||
              (error instanceof Error ? error.message : String(error)),
          });

          // Leave this item in the queue so it can be retried.
        }
      }

      // Sync Quick Notes using the same multipart API contract as Todo creation.
      const queuedQuickNotes = (await getPendingQuickNotes()).filter(
        (note) => note.userId === currentUserId,
      );
      let syncedQuickNotes = 0;
      let failedQuickNotes = 0;

      for (const note of queuedQuickNotes) {
        try {
          const formData = new FormData();
          const quickNoteFields: Record<string, string> = {
            title: note.title,
            text: note.text,
            date: note.date,
            createdAt: note.createdAt,
            updatedAt: note.updatedAt,
            userId: note.userId,
            status: note.status || "pending",
            reminderDate: note.reminderDate || "",
            reminderTime: note.reminderTime || "",
            recurring: note.recurring || "none",
            quickNoteColor: note.quickNoteColor || "",
            quickNotePinned: String(note.quickNotePinned ?? false),
            notePattern: note.notePattern || "plain",
            noteType: note.noteType || "quickNote",
            isQuickNote: String(note.isQuickNote ?? true),
            theme: JSON.stringify(note.theme ?? null),
          };

          Object.entries(quickNoteFields).forEach(([key, value]) => {
            formData.append(key, value);
          });

          const response = await API.post("/api/createTodolist", formData, {
            headers: authHeaders,
            timeout: 30000,
          });

          if (response.data?.success !== true) {
            throw new Error(
              response.data?.message ||
                "The server did not confirm the Quick Note save.",
            );
          }

          await removePendingQuickNote(note.id);
          syncedQuickNotes += 1;
        } catch (error) {
          failedQuickNotes += 1;
          console.error("[Quick Note Sync] Failed:", {
            queueId: note.id,
            message:
              (error as any)?.response?.data?.message ||
              (error instanceof Error ? error.message : String(error)),
          });
          // Keep failed Quick Notes queued for the next retry.
        }
      }

      const remainingForUser = await getPendingTodos(currentUserId);
      const remainingQuickNotes = (await getPendingQuickNotes()).filter(
        (note) => note.userId === currentUserId,
      );

      // Refresh server-backed profile and update its local cache.
      await getUser();
      await refreshPendingCount();

      const pendingRegistrations = await getPendingRegistrations();
      setPendingCount(
        remainingForUser.length +
          remainingQuickNotes.length +
          pendingRegistrations.length,
      );

      const messages = [
        `Todos synced: ${syncedCount}.`,
        `Quick Notes synced: ${syncedQuickNotes}.`,
        `Todos still waiting: ${remainingForUser.length}.`,
        `Quick Notes still waiting: ${remainingQuickNotes.length}.`,
      ];

      if (failedCount > 0) {
        messages.push(
          `${failedCount} Todo(s) failed to sync. Check the console for details.`,
        );
      }

      if (failedQuickNotes > 0) {
        messages.push(
          `${failedQuickNotes} Quick Note(s) failed to sync. They remain queued for retry.`,
        );
      }

      if (pendingRegistrations.length > 0) {
        messages.push(
          `${pendingRegistrations.length} registration(s) still need attention. Passwords were not stored offline, so they cannot be submitted automatically.`,
        );
      }

      Alert.alert("Sync complete", messages.join("\n"));
    } catch (error) {
      console.error(
        "Manual sync failed:",
        (error as any)?.response?.data ??
          (error instanceof Error ? error.message : error),
      );

      Alert.alert(
        "Sync failed",
        "Unable to complete syncing. Check your connection and try again.",
      );
    } finally {
      setSyncing(false);
    }
  }, [getUser, refreshPendingCount, syncing]);

  // Use the shared app theme so Settings changes are reflected here.
  // Keep the dashboard's mint-green accent in both light and dark modes.
  const baseColors = isDark ? DARK_COLORS : LIGHT_COLORS;
  const colors: Palette = {
    ...baseColors,
    background: appColors.background,
    card: appColors.surface,
    ink: appColors.text,
    secondary: appColors.secondaryText,
    border: appColors.border,
    mint: appColors.primary,
    softMint: isDark ? DARK_COLORS.softMint : LIGHT_COLORS.softMint,
  };

  const themed = createStyles(colors);

  const openRoute = (route: (typeof ROUTES)[keyof typeof ROUTES]) => {
    router.push(route as never);
  };

  return (
    <SafeAreaView style={themed.safeArea} edges={["top", "left", "right"]}>
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
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.brandRow}>
            <LinearGradient
              colors={["#45C7A5", "#21866F"]}
              style={styles.brandIcon}
            >
              <Ionicons name="leaf" size={24} color="#FFFFFF" />
            </LinearGradient>

            <View style={{ flexShrink: 1 }}>
              <Text style={themed.brandName}>E-diary</Text>
              <Text style={themed.brandCaption} numberOfLines={1}>
                {user?.userName
                  ? `WELCOME, ${user.userName.toUpperCase()}`
                  : profileLoading
                    ? "YOUR PERSONAL WORKSPACE"
                    : "YOUR PERSONAL WORKSPACE"}
              </Text>
            </View>
          </View>

          <View style={styles.headerActions}>
            {/* Settings Button */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open Settings"
              onPress={() => openRoute(ROUTES.settings)}
              style={({ pressed }) => [
                themed.settingsButton,
                pressed && styles.pressed,
              ]}
            >
              <Ionicons name="settings-outline" size={22} color={colors.mint} />
            </Pressable>

            {/* Profile Button: show the saved profile picture when available */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open Profile"
              onPress={() => router.push("/profile")}
              style={({ pressed }) => [
                themed.settingsButton,
                { overflow: "hidden", padding: 0 },
                pressed && styles.pressed,
              ]}
            >
              {user?.profilePicUrl &&
              /^https?:\/\//i.test(user.profilePicUrl) ? (
                <Image
                  source={{ uri: user.profilePicUrl }}
                  style={styles.profileImage}
                  resizeMode="cover"
                  onError={() =>
                    console.warn("Unable to load profile picture URL.")
                  }
                />
              ) : (
                <Ionicons
                  name="person-circle-outline"
                  size={25}
                  color={colors.mint}
                />
              )}
            </Pressable>
          </View>
        </View>

        {isDesktop && (
          <View style={styles.desktopPageIntro}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.desktopEyebrow, { color: colors.mint }]}>
                PERSONAL DASHBOARD
              </Text>
              <Text style={[styles.desktopPageTitle, { color: colors.ink }]}>
                Good to see you{user?.userName ? `, ${user.userName}` : ""}.
              </Text>
              <Text
                style={[
                  styles.desktopPageSubtitle,
                  { color: colors.secondary },
                ]}
              >
                Keep your notes, plans and everyday tasks in one calm workspace.
              </Text>
            </View>
            <View
              style={[
                styles.desktopDatePill,
                {
                  backgroundColor: colors.softMint,
                  borderColor: colors.border,
                },
              ]}
            >
              <Ionicons name="calendar-outline" size={17} color={colors.mint} />
              <Text
                style={{ color: colors.ink, fontSize: 12, fontWeight: "700" }}
              >
                MY WORKSPACE
              </Text>
            </View>
          </View>
        )}

        {/* Connectivity status + manual sync */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Synchronize data"
          onPress={handleSync}
          disabled={syncing}
          style={({ pressed }) => [
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              borderWidth: 1,
              borderRadius: isDesktop ? 20 : 17,
              paddingHorizontal: isDesktop ? 22 : 15,
              paddingVertical: isDesktop ? 13 : 14,
              marginBottom: isDesktop ? 16 : 24,
              width: "100%",
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              ...(isDesktop ? styles.desktopSyncCard : {}),
            },
            pressed && styles.pressed,
            syncing && { opacity: 0.7 },
          ]}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              flex: 1,
            }}
          >
            <View
              style={{
                width: 43,
                height: 43,
                borderRadius: 14,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: colors.softMint,
              }}
            >
              <Ionicons
                name={isOnline ? "cloud-done-outline" : "cloud-offline-outline"}
                size={23}
                color={colors.mint}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text
                style={{ color: colors.ink, fontSize: 14, fontWeight: "800" }}
              >
                {syncing ? "Checking sync..." : "Sync Data"}
              </Text>
              <Text
                style={{ color: colors.secondary, fontSize: 11, marginTop: 4 }}
              >
                {isOnline ? "Online" : "Offline"} · {pendingCount} pending
                item(s) to sync
              </Text>
            </View>
          </View>
          {syncing ? (
            <ActivityIndicator color={colors.mint} />
          ) : (
            <Ionicons name="sync-outline" size={23} color={colors.mint} />
          )}
        </Pressable>

        {/* Desktop main layout: hero on the left, workspace actions on the right */}
        <View style={isDesktop ? styles.desktopMainRow : undefined}>
          {/* Welcome hero */}
          <LinearGradient
            colors={["#17483F", "#237D6B", "#39BFA5"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.hero, isDesktop && styles.desktopHero]}
          >
            <View style={styles.heroCircleOne} />
            <View style={styles.heroCircleTwo} />

            <View style={styles.heroCopy}>
              <View style={styles.welcomePill}>
                <Ionicons name="sparkles" size={13} color="#E9FFF5" />
                <Text style={styles.welcomeText}>A FRESH START</Text>
              </View>

              <Text style={styles.heroTitle}>
                {user?.userName ? `Hello, ${user.userName}!` : "Your ideas."}
                {"\n"}
                Your day. Your space.
              </Text>

              <Text style={styles.heroSubtitle}>
                Write it down, plan what matters, and keep your day beautifully
                organized.
              </Text>
            </View>

            {/* Decorative note illustration */}
            <View style={styles.paperBack} pointerEvents="none" />

            <View style={styles.paperFront} pointerEvents="none">
              <View style={styles.paperDots}>
                <View style={styles.paperDot} />
                <View style={[styles.paperDot, { opacity: 0.55 }]} />
                <View style={[styles.paperDot, { opacity: 0.3 }]} />
              </View>

              <View style={styles.paperLine} />
              <View style={styles.paperShortLine} />

              <View style={styles.paperCheckRow}>
                <View style={styles.paperCheck}>
                  <Ionicons name="checkmark" size={10} color="#FFFFFF" />
                </View>
                <View style={styles.paperMediumLine} />
              </View>

              <View style={styles.paperCheckRow}>
                <View style={styles.paperEmptyCheck} />
                <View style={styles.paperLine} />
              </View>
            </View>

            <View style={styles.floatingSparkle}>
              <Ionicons name="sparkles" size={19} color="#FFF1BC" />
            </View>
          </LinearGradient>

          <View style={isDesktop ? styles.desktopWorkspace : undefined}>
            {/* Workspace heading */}
            <View style={styles.sectionHeading}>
              <View>
                <Text style={themed.eyebrow}>MADE FOR YOUR EVERYDAY</Text>
                <Text style={themed.sectionTitle}>Your workspace</Text>
              </View>
            </View>

            {/* Quick Notes + Create To-Do */}
            <View style={styles.actionGrid}>
              {/* Quick Notes - Orange */}
              <ActionCard
                title="Quick Notes"
                subtitle="Capture ideas quickly"
                icon="flash-outline"
                gradient={["#FFB15C", "#F28A32", "#D96A1B"]}
                onPress={() => openRoute(ROUTES.quickNotes)}
              />

              {/* Create To-Do - Lavender */}
              <ActionCard
                title="Create To-Do"
                subtitle="Organize your day"
                icon="checkbox-outline"
                gradient={["#B18AEF", "#8E63D4", "#6843A8"]}
                onPress={() => openRoute(ROUTES.createTodo)}
              />
            </View>

            {/* View saved items */}

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="View saved items"
              onPress={() => openRoute(ROUTES.viewTodos)}
              style={({ pressed }) => [
                themed.savedCard,
                {
                  backgroundColor: isDark ? "#20332F" : "#EAF2F1",
                  borderColor: isDark ? "#45635D" : "#C7DDDA",
                  borderWidth: 1,
                },
                pressed && styles.pressed,
              ]}
            >
              <View
                style={[
                  themed.savedIcon,
                  {
                    backgroundColor: isDark ? "#304A46" : "#D5E8E5",
                  },
                ]}
              >
                <Ionicons
                  name="albums-outline"
                  size={25}
                  color={isDark ? "#A8D5CB" : "#477F78"}
                />
              </View>

              <View style={styles.savedCopy}>
                <Text
                  style={[
                    themed.savedTitle,
                    { color: isDark ? "#FFFFFF" : "#172F2B" },
                  ]}
                >
                  View saved items
                </Text>

                <Text
                  style={[
                    themed.savedSubtitle,
                    { color: isDark ? "#C0CEC7" : "#60766C" },
                  ]}
                >
                  All your notes and to-do lists in one place
                </Text>
              </View>

              <View
                style={[
                  themed.savedArrow,
                  {
                    backgroundColor: isDark ? "#304A46" : "#D5E8E5",
                  },
                ]}
              >
                <Ionicons
                  name="arrow-forward"
                  size={17}
                  color={isDark ? "#A8D5CB" : "#477F78"}
                />
              </View>
            </Pressable>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Ionicons name="leaf-outline" size={17} color={colors.mint} />
          <Text style={themed.footerText}>Less clutter. More clarity.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

type QueuedTodo = Awaited<ReturnType<typeof getPendingTodos>>[number];

function getQueuedFileName(uri: string, fallback: string): string {
  const cleanUri = uri.split("?")[0];
  const lastPart = cleanUri.split("/").pop();
  return lastPart || fallback;
}

function getQueuedMimeType(uri: string, fallback: string): string {
  const name = getQueuedFileName(uri, "");
  const extension = name.split(".").pop()?.toLowerCase();

  const mimeTypes: Record<string, string> = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
    heic: "image/heic",
    mp4: "video/mp4",
    mov: "video/quicktime",
    m4a: "audio/mp4",
    mp3: "audio/mpeg",
    wav: "audio/wav",
    aac: "audio/aac",
  };

  return (extension && mimeTypes[extension]) || fallback;
}

async function appendQueuedFile(
  formData: FormData,
  fieldName: string,
  uri: string | null | undefined,
  fallbackName: string,
  fallbackMime: string,
): Promise<void> {
  if (!uri) return;

  const name = getQueuedFileName(uri, fallbackName);
  const type = getQueuedMimeType(uri, fallbackMime);

  if (Platform.OS === "web") {
    // Blob URLs must still be available to the browser.
    const fileResponse = await fetch(uri);

    if (!fileResponse.ok) {
      throw new Error(`Unable to read local attachment: ${name}`);
    }

    const blob = await fileResponse.blob();

    formData.append(fieldName, blob, name);
  } else {
    // React Native's FormData supports this native file descriptor.
    formData.append(fieldName, { uri, name, type } as unknown as Blob);
  }
}

async function buildQueuedTodoFormData(todo: QueuedTodo): Promise<FormData> {
  const formData = new FormData();

  const fields: Record<string, string> = {
    title: todo.title,
    date: todo.date,
    createdAt: todo.createdAt,
    updatedAt: todo.updatedAt,
    text: todo.text,
    alarm: todo.alarm || "",
    reminderDate: todo.reminderDate || "",
    reminderTime: todo.reminderTime || "",
    status: todo.status,
    noteType: "todo",
    recurring: todo.recurring || "none",
    isQuickNote: "false",
    quickNoteColor: todo.quickNoteColor || "",
    quickNotePinned: String(todo.quickNotePinned ?? false),
    notePattern: todo.notePattern || "plain",
    userId: todo.userId,
  };

  Object.entries(fields).forEach(([key, value]) => {
    formData.append(key, value);
  });

  await appendQueuedFile(
    formData,
    "file",
    todo.imageUri,
    "todo-image.jpg",
    "image/jpeg",
  );

  await appendQueuedFile(
    formData,
    "file",
    todo.videoUri,
    "todo-video.mp4",
    "video/mp4",
  );

  await appendQueuedFile(
    formData,
    "file",
    todo.voiceUri,
    "todo-voice.m4a",
    "audio/mp4",
  );

  await appendQueuedFile(
    formData,
    "file",
    todo.drawingUri,
    "todo-drawing.png",
    "image/png",
  );

  await appendQueuedFile(
    formData,
    "backgroundImage",
    todo.backgroundImageUri,
    "todo-background.jpg",
    "image/jpeg",
  );

  return formData;
}

function createStyles(colors: Palette) {
  return StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: colors.background,
    },
    brandName: {
      color: colors.ink,
      fontSize: 24,
      fontWeight: "900",
      letterSpacing: -0.8,
    },
    brandCaption: {
      color: colors.secondary,
      fontSize: 8,
      fontWeight: "800",
      letterSpacing: 1.2,
      marginTop: 3,
    },
    settingsButton: {
      width: 46,
      height: 46,
      borderRadius: 16,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
    },
    eyebrow: {
      color: colors.mint,
      fontSize: 9,
      fontWeight: "900",
      letterSpacing: 1.5,
      marginBottom: 5,
    },
    sectionTitle: {
      color: colors.ink,
      fontSize: 22,
      fontWeight: "900",
      letterSpacing: -0.5,
    },
    sectionIcon: {
      width: 42,
      height: 42,
      borderRadius: 15,
      backgroundColor: colors.softMint,
      alignItems: "center",
      justifyContent: "center",
    },
    savedCard: {
      minHeight: 94,
      borderRadius: 23,
      padding: 15,
      flexDirection: "row",
      alignItems: "center",
      gap: 13,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      shadowColor: "#173B35",
      shadowOpacity: 0.04,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 5 },
      elevation: 2,
    },
    savedIcon: {
      width: 49,
      height: 49,
      borderRadius: 16,
      backgroundColor: colors.softMint,
      alignItems: "center",
      justifyContent: "center",
    },
    savedTitle: {
      color: colors.ink,
      fontSize: 14,
      fontWeight: "900",
    },
    savedSubtitle: {
      color: colors.secondary,
      fontSize: 10,
      lineHeight: 15,
      marginTop: 5,
    },
    savedArrow: {
      width: 32,
      height: 32,
      borderRadius: 11,
      backgroundColor: colors.softMint,
      alignItems: "center",
      justifyContent: "center",
    },
    footerText: {
      color: colors.secondary,
      fontSize: 11,
      fontWeight: "600",
    },
  });
}

const styles = StyleSheet.create({
  desktopScrollContent: {
    width: "100%",
    maxWidth: 1580,
    alignSelf: "center",
    paddingHorizontal: 40,
    paddingTop: 20,
    paddingBottom: 24,
  },
  desktopPageIntro: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 24,
    gap: 24,
  },
  desktopEyebrow: {
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 2,
    marginBottom: 9,
  },
  desktopPageTitle: {
    fontSize: 31,
    lineHeight: 38,
    fontWeight: "900",
    letterSpacing: -1.1,
  },
  desktopPageSubtitle: { fontSize: 13, lineHeight: 20, marginTop: 7 },
  desktopDatePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    paddingHorizontal: 15,
    paddingVertical: 11,
    borderRadius: 14,
    borderWidth: 1,
  },
  desktopSyncCard: {
    minHeight: 82,
    shadowColor: "#173B35",
    shadowOpacity: 0.045,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 7 },
    elevation: 2,
  },
  desktopMainRow: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: 22,
    minHeight: 390,
  },
  desktopHero: {
    flex: 1.12,
    minHeight: 390,
    marginBottom: 0,
    padding: 34,
    borderRadius: 26,
    justifyContent: "center",
  },
  desktopWorkspace: {
    flex: 1,
    minWidth: 360,
    justifyContent: "center",
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 35,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  profileImage: {
    width: 44,
    height: 44,
    borderRadius: 15,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 23,
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
  },
  brandIcon: {
    width: 49,
    height: 49,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  hero: {
    minHeight: 300,
    borderRadius: 29,
    padding: 22,
    overflow: "hidden",
    marginBottom: 29,
    position: "relative",
  },
  heroCopy: {
    width: "76%",
    zIndex: 2,
  },
  welcomePill: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 30,
    backgroundColor: "rgba(255,255,255,0.15)",
    marginBottom: 16,
  },
  welcomeText: {
    color: "#E9FFF5",
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1,
  },
  heroTitle: {
    color: "#FFFFFF",
    fontSize: 27,
    lineHeight: 34,
    fontWeight: "900",
    letterSpacing: -0.8,
  },
  heroSubtitle: {
    color: "#D9F5E9",
    fontSize: 12,
    lineHeight: 18,
    marginTop: 11,
    maxWidth: 235,
  },
  heroButton: {
    alignSelf: "flex-start",
    marginTop: 17,
    backgroundColor: "#FFFFFF",
    borderRadius: 13,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },
  heroButtonText: {
    color: "#17483F",
    fontSize: 12,
    fontWeight: "800",
  },
  heroCircleOne: {
    position: "absolute",
    width: 215,
    height: 215,
    borderRadius: 108,
    backgroundColor: "rgba(255,255,255,0.07)",
    right: -75,
    top: -78,
  },
  heroCircleTwo: {
    position: "absolute",
    width: 175,
    height: 175,
    borderRadius: 88,
    backgroundColor: "rgba(255,255,255,0.06)",
    right: 8,
    bottom: -115,
  },
  paperBack: {
    position: "absolute",
    width: 70,
    height: 95,
    right: 12,
    bottom: 33,
    borderRadius: 11,
    backgroundColor: "#C7F2E5",
    transform: [{ rotate: "12deg" }],
  },
  paperFront: {
    position: "absolute",
    width: 76,
    height: 105,
    right: 23,
    bottom: 27,
    borderRadius: 11,
    backgroundColor: "#FFFFFF",
    padding: 10,
    transform: [{ rotate: "-7deg" }],
    elevation: 5,
    shadowColor: "#0B332C",
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
  },
  paperDots: {
    flexDirection: "row",
    gap: 4,
    marginBottom: 10,
  },
  paperDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: "#39BFA5",
  },
  paperLine: {
    height: 4,
    width: "100%",
    borderRadius: 4,
    backgroundColor: "#E4EBE8",
    marginBottom: 7,
  },
  paperShortLine: {
    height: 4,
    width: "65%",
    borderRadius: 4,
    backgroundColor: "#E4EBE8",
    marginBottom: 10,
  },
  paperCheckRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginBottom: 7,
  },
  paperCheck: {
    width: 10,
    height: 10,
    borderRadius: 3,
    backgroundColor: "#39BFA5",
    alignItems: "center",
    justifyContent: "center",
  },
  paperEmptyCheck: {
    width: 10,
    height: 10,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: "#B8C9C2",
  },
  paperMediumLine: {
    height: 4,
    width: 32,
    borderRadius: 4,
    backgroundColor: "#D9E5E0",
  },
  floatingSparkle: {
    position: "absolute",
    right: 5,
    top: 105,
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  sectionHeading: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 17,
  },
  actionGrid: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 14,
  },
  actionWrap: {
    flex: 1,
    borderRadius: 22,
    overflow: "hidden",
  },
  actionCard: {
    minHeight: 160,
    padding: 14,
    justifyContent: "center",
  },
  actionTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  actionIcon: {
    width: 44,
    height: 44,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.22)",
  },
  arrowBubble: {
    width: 27,
    height: 27,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  actionTitle: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "900",
  },
  actionSubtitle: {
    color: "#FFFFFF",
    opacity: 0.92,
    fontSize: 10,
    lineHeight: 15,
    marginTop: 5,
  },
  savedCopy: {
    flex: 1,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    marginTop: 25,
  },
  pressed: {
    opacity: 0.86,
    transform: [{ scale: 0.985 }],
  },
});
