import {
  createElement,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { updateChecklistHomeWidget } from "../../utils/homeChecklistWidget";

import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import { LinearGradient } from "expo-linear-gradient";
import * as Notifications from "expo-notifications";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import {
  ActivityIndicator,
  FlatList,
  Image,
  ImageBackground,
  Linking,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { useAppTheme } from "../../context/app-theme-context";

import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import { useVideoPlayer, VideoView } from "expo-video";

type MediaPlayerProps = {
  uri: string;
  title?: string;
};

function DetailsAudioPlayer({ uri, title }: MediaPlayerProps) {
  // Electron uses the Expo Web build. Use the browser's native audio control
  // on desktop; keep expo-audio for Android/iOS.
  if (Platform.OS === "web") {
    return (
      <View
        style={[
          baseStyles.detailsMediaRow,
          {
            width: "100%",
            minWidth: 0,
            paddingVertical: 12,
            paddingHorizontal: 12,
          },
        ]}
      >
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={baseStyles.detailsMediaTitle} numberOfLines={1}>
            {title || "Voice note"}
          </Text>
          {createElement("audio" as any, {
            controls: true,
            preload: "metadata",
            src: uri,
            style: {
              display: "block",
              width: "100%",
              maxWidth: "100%",
              marginTop: 8,
            },
            onError: (event: any) => {
              console.warn(
                "[Desktop audio] Could not load voice note:",
                uri,
                event?.currentTarget?.error,
              );
            },
          })}
        </View>
      </View>
    );
  }

  return <NativeDetailsAudioPlayer uri={uri} title={title} />;
}

function NativeDetailsAudioPlayer({ uri, title }: MediaPlayerProps) {
  const player = useAudioPlayer(uri);
  const status = useAudioPlayerStatus(player);

  const formatTime = (seconds?: number) => {
    if (!Number.isFinite(seconds)) return "0:00";
    const total = Math.max(0, Math.floor(seconds ?? 0));
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
  };

  return (
    <View style={baseStyles.detailsMediaRow}>
      <Pressable
        onPress={() => {
          if (status.playing) player.pause();
          else player.play();
        }}
        accessibilityRole="button"
        accessibilityLabel={
          status.playing ? "Pause voice note" : "Play voice note"
        }
      >
        <Ionicons
          name={status.playing ? "pause-circle" : "play-circle"}
          size={42}
          color={C.primary}
        />
      </Pressable>

      <View style={{ flex: 1 }}>
        <Text style={baseStyles.detailsMediaTitle} numberOfLines={1}>
          {title || "Voice note"}
        </Text>

        <View style={baseStyles.detailsProgressTrack}>
          <View
            style={[
              baseStyles.detailsProgressFill,
              {
                width:
                  status.duration > 0
                    ? `${Math.min(100, (status.currentTime / status.duration) * 100)}%`
                    : "0%",
              },
            ]}
          />
        </View>

        <Text style={baseStyles.detailsMediaSub}>
          {formatTime(status.currentTime)} / {formatTime(status.duration)}
        </Text>
      </View>
    </View>
  );
}

function DetailsVideoPlayer({ uri, title }: MediaPlayerProps) {
  const player = useVideoPlayer(uri, (instance) => {
    instance.loop = false;
  });

  const [isPlaying, setIsPlaying] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const formatTime = (seconds: number) => {
    if (!Number.isFinite(seconds) || seconds < 0) return "00:00";

    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);

    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  return (
    <View
      style={{
        marginTop: 8,
        marginBottom: 8,
        borderRadius: 16,
        overflow: "hidden",
        backgroundColor: "#14251F",
        borderWidth: 1,
        borderColor: "#29483B",
      }}
    >
      {/* Video */}
      <View
        style={{
          width: "100%",
          aspectRatio: 16 / 9,
          backgroundColor: "#0B1511",
        }}
      >
        <VideoView
          player={player}
          style={{
            width: "100%",
            height: "100%",
          }}
          nativeControls
          contentFit="contain"
          allowsFullscreen
          allowsPictureInPicture
        />
      </View>

      {/* Video Information */}
      <View
        style={{
          paddingHorizontal: 13,
          paddingVertical: 12,
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
        }}
      >
        <View
          style={{
            width: 38,
            height: 38,
            borderRadius: 11,
            backgroundColor: "#245541",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <Ionicons name="videocam" size={20} color="#A7E8CC" />
        </View>

        <View style={{ flex: 1 }}>
          <Text
            style={{
              color: "#F0F8F3",
              fontSize: 13,
              fontWeight: "700",
            }}
            numberOfLines={2}
          >
            {title || "Video attachment"}
          </Text>

          <Text
            style={{
              color: "#A3B9AD",
              fontSize: 11,
              marginTop: 3,
            }}
          >
            Video attachment
          </Text>
        </View>
      </View>
    </View>
  );
}

type AudioAttachmentProps = {
  uri: string;
};

function AudioAttachment({ uri }: AudioAttachmentProps) {
  const player = useAudioPlayer({ uri });
  const status = useAudioPlayerStatus(player);

  return (
    <View style={baseStyles.compactFileRow}>
      <Pressable
        onPress={() => {
          if (status.playing) {
            player.pause();
          } else {
            player.play();
          }
        }}
        accessibilityRole="button"
        accessibilityLabel={status.playing ? "Pause audio" : "Play audio"}
      >
        <Ionicons
          name={status.playing ? "pause-circle" : "play-circle"}
          size={38}
          color={C.primary}
        />
      </Pressable>

      <View style={{ flex: 1 }}>
        <Text style={baseStyles.compactFileText}>Voice note</Text>
        <Text style={{ color: C.sub, fontSize: 12 }}>
          {status.playing
            ? "Playing..."
            : status.isLoaded
              ? "Ready to play"
              : "Loading audio..."}
        </Text>
      </View>
    </View>
  );
}

// Show notification banners while the app is in the foreground.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// ============================================================
// LOCAL REMINDER NOTIFICATIONS
// ============================================================
const REMINDER_CHANNEL_ID = "reminders";

const cancelLocalReminderNotifications = async (todoId: string) => {
  const id = String(todoId || "").trim();
  if (!id) return;

  const pending = await Notifications.getAllScheduledNotificationsAsync();
  const matching = pending.filter(
    (notification) => String(notification.content.data?.todoId ?? "") === id,
  );

  await Promise.all(
    matching.map((notification) =>
      Notifications.cancelScheduledNotificationAsync(notification.identifier),
    ),
  );
};

const isTodayOrFutureDate = (dateValue: string) => {
  if (!dateValue) return false;

  // Parse YYYY-MM-DD as a local calendar date to avoid UTC timezone shifts.
  const match = String(dateValue).trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  let selected: Date;

  if (match) {
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);

    selected = new Date(year, month - 1, day);

    // Reject invalid values such as 2026-02-31.
    if (
      selected.getFullYear() !== year ||
      selected.getMonth() !== month - 1 ||
      selected.getDate() !== day
    ) {
      return false;
    }
  } else {
    const parsed = new Date(dateValue);
    if (Number.isNaN(parsed.getTime())) return false;
    selected = new Date(
      parsed.getFullYear(),
      parsed.getMonth(),
      parsed.getDate(),
    );
  }

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  return selected.getTime() >= today.getTime();
};

const scheduleLocalReminderNotification = async (
  todoId: string,
  title: string,
  scheduledAt: Date,
): Promise<string> => {
  const id = String(todoId || "").trim();
  if (!id) throw new Error("A note ID is required to schedule a reminder.");
  if (!(scheduledAt instanceof Date) || Number.isNaN(scheduledAt.getTime())) {
    throw new Error("The reminder date or time is invalid.");
  }
  if (scheduledAt.getTime() <= Date.now()) {
    throw new Error("Choose a reminder time in the future.");
  }

  const permission = await Notifications.getPermissionsAsync();
  let status = permission.status;
  if (status !== "granted") {
    const requested = await Notifications.requestPermissionsAsync();
    status = requested.status;
  }
  if (status !== "granted") {
    throw new Error(
      "Notification permission is disabled. Allow notifications in Android Settings and try again.",
    );
  }

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync(REMINDER_CHANNEL_ID, {
      name: "Reminders",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      sound: "default",
      enableVibrate: true,
      enableLights: true,
    });
  }

  // Replacing a reminder must replace its previous local notification too.
  await cancelLocalReminderNotifications(id);

  return Notifications.scheduleNotificationAsync({
    content: {
      title: "Reminder",
      body: title.trim() || "You have a task to do.",
      sound: "default",
      data: { todoId: id, type: "todo-reminder" },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: scheduledAt,
      ...(Platform.OS === "android" ? { channelId: REMINDER_CHANNEL_ID } : {}),
    },
  });
};

const makeReminderDateTime = (
  dateValue: string,
  timeValue: string,
): Date | null => {
  // Expected values: YYYY-MM-DD and HH:mm
  const dateMatch = dateValue.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  const timeMatch = timeValue.match(/^(\d{1,2}):(\d{2})$/);

  if (!dateMatch || !timeMatch) {
    console.warn("[Reminder] Invalid date/time:", {
      dateValue,
      timeValue,
    });
    return null;
  }

  const year = Number(dateMatch[1]);
  const month = Number(dateMatch[2]);
  const day = Number(dateMatch[3]);
  const hour = Number(timeMatch[1]);
  const minute = Number(timeMatch[2]);

  if (
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31 ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59
  ) {
    return null;
  }

  // Construct local device time (not UTC).
  const reminderDate = new Date(year, month - 1, day, hour, minute, 0, 0);

  // Reject invalid calendar dates.
  if (
    reminderDate.getFullYear() !== year ||
    reminderDate.getMonth() !== month - 1 ||
    reminderDate.getDate() !== day
  ) {
    return null;
  }

  return reminderDate;
};

// ============================================================
// API
// ============================================================
const API_BASE_URL = "https://todolistbackend-855c.onrender.com";

// ============================================================
// THEME
// ============================================================
const COLORS = {
  // Matched to the original green login-page theme.
  bg: "#EAFBF4",
  surface: "#FFFFFF",
  ink: "#064E3B",
  sub: "#648477",
  mute: "#8BA99B",
  line: "#D5E9DF",
  chip: "#D1FAE5",
  primary: "#10B981",
  primarySoft: "#D1FAE5",
  hero: "#064E3B",
  heroSoft: "#047857",
  today: "#059669",
  upcoming: "#0EA5E9",
  done: "#047857",
  danger: "#F16B6B",
  dangerSoft: "#FDECEC",
  amber: "#E9A23B",
};

// Shared short alias used by the existing screen styles.
const C = COLORS;

// Stable per-note border colors. The same note keeps its color after refresh.
const CARD_BORDER_COLORS = [
  "#10B981", // Mint green
  "#60A5FA", // Blue
  "#F59E0B", // Amber
  "#A78BFA", // Purple
  "#F472B6", // Pink
  "#14B8A6", // Teal
  "#FB7185", // Rose
  "#84CC16", // Lime
  "#38BDF8", // Sky blue
  "#C084FC", // Violet
];
const NOTE_IMAGE_PATTERNS: Record<
  string,
  "plain" | "lined" | "dotted" | "grid"
> = {
  // Patterns are assigned by image ID; the gallery currently uses cute1–cute19.
  cute1: "lined",
  cute2: "dotted",
  cute3: "grid",
  cute4: "plain",
  cute5: "lined",
  cute6: "dotted",
  cute7: "grid",
  cute8: "lined",
  cute9: "dotted",
  cute10: "grid",
  cute11: "plain",
  cute12: "lined",
  cute13: "dotted",
  cute14: "grid",
  cute15: "lined",
  cute16: "dotted",
  cute17: "grid",
  cute18: "plain",
  cute19: "lined",
  // Also support the note1.jpg–note11.jpg naming scheme if you use those assets.
  "note1.jpg": "lined",
  "note2.jpg": "dotted",
  "note3.jpg": "grid",
  "note4.jpg": "plain",
  "note5.jpg": "lined",
  "note6.jpg": "dotted",
  "note7.jpg": "grid",
  "note8.jpg": "lined",
  "note9.jpg": "dotted",
  "note10.jpg": "grid",
  "note11.jpg": "plain",
};
// ============================================================
// TYPES
// ============================================================
type Todo = {
  _id?: string;
  tdlId: string;
  userId?: string;
  title?: string | null;
  date?: string | null;
  text?: string | null;
  alignment?: "left" | "center" | "right";
  type?: string[] | string;
  fileIds?: string[];
  fileNames?: string[];
  attachmentNames?: string[];
  alarm?: string | null;
  reminderDate?: string | null;
  reminderTime?: string | null;
  recurring?: string | null;
  noteType?: string | null;
  isPin?: boolean | string;
  locked?: boolean;
  /** True only for duplicate notes stored exclusively on this device. */
  isLocalDuplicate?: boolean;
  createdAt?: string;
  updatedAt?: string;
  status?: "Today" | "Upcoming" | "Completed" | string;
};

type NoteOrganizationMeta = {
  folderId?: string;
  categoryIds?: string[];
  tags?: string[];

  archived?: boolean;
  trashed?: boolean;
  priority?: "Low" | "Medium" | "High";
  noteColor?: string;
  notePattern?: "plain" | "lined" | "dotted" | "grid";
  noteBackgroundImage?: string;
};

type NoteFolder = { id: string; name: string };
type NoteCategory = { id: string; name: string; color: string };
type OrganizationModalType = "folder" | "category" | "tag" | null;

type QuickNoteMeta = {
  isQuickNote?: boolean;
  quickNoteColor?: string;
  textColor?: string;
  alignment?: "left" | "center" | "right";
  // Persisted by the Create Quick Note screen on this device.
  notePattern?: "plain" | "lined" | "dotted" | "grid" | string;
  backgroundImageUri?: string;
  noteBackgroundImage?: string;
  quickNoteTheme?: {
    id?: string;
    label?: string;
    kind?: string;
    colors?: string[] | null;
    pattern?: string | null;
    ink?: string | null;
    uri?: string | null;
    bg?: string | null;
  };
  quickNotePinned?: boolean;
  title?: string;
  updatedAt?: string;
};

type AppAlertButton = {
  text: string;
  style?: "default" | "cancel" | "destructive";
  onPress?: () => void | Promise<void>;
};

type AppAlertState = {
  visible: boolean;
  title: string;
  message: string;
  buttons: AppAlertButton[];
};

type FilterType = "All" | "Today" | "Upcoming" | "Completed";

type SheetAction = {
  key: string;
  label: string;
  icon: string;
  color: string;
  bg: string;
  onPress: () => void;
};

// ============================================================
// HELPERS
// ============================================================
const getAuthorizationHeader = (value: string) => {
  const clean = String(value || "").trim();
  if (!clean) return "";
  return clean.toLowerCase().startsWith("bearer ") ? clean : `Bearer ${clean}`;
};

const isValidDate = (value?: string | null) => {
  if (!value) return false;
  return !Number.isNaN(new Date(value).getTime());
};

const formatTodoDate = (value?: string | null) => {
  if (!isValidDate(value)) return "No date";
  return new Date(value!).toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};
const formatAlarm = (value?: string | null) => {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    // If older data contains a plain HH:mm value, still convert it to AM/PM.
    return format12HourTime(String(value));
  }

  return `${date.toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
  })} · ${date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })}`;
};

const format12HourTime = (time: string): string => {
  if (!time) return "";

  // Handle 24-hour time, such as "14:30"
  const match = time.match(/^(\d{1,2}):(\d{2})$/);

  if (match) {
    const hours = Number(match[1]);
    const minutes = Number(match[2]);

    if (hours > 23 || minutes > 59) return time;

    const period = hours >= 12 ? "PM" : "AM";
    const displayHours = hours % 12 || 12;

    return `${displayHours}:${String(minutes).padStart(2, "0")} ${period}`;
  }

  // Handle ISO date strings or other parseable time values
  const date = new Date(time);

  if (!Number.isNaN(date.getTime()) && time.includes("T")) {
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  }

  return time;
};

const getTodoReminder = (todo: Todo) => {
  // Prefer the separate reminder fields when present so the saved date and time
  // are displayed consistently. Keep `alarm` as a backward-compatible fallback.
  const date = todo.reminderDate ? formatTodoDate(todo.reminderDate) : "";

  const time = todo.reminderTime
    ? format12HourTime(String(todo.reminderTime))
    : "";

  if (date && time) return `${date} · ${time}`;
  if (date) return date;
  if (time) return time;
  if (todo.alarm) return formatAlarm(todo.alarm);

  return "";
};

const getStatusMeta = (
  status?: string,
  isDark = false,
  palette: typeof COLORS = C,
) => {
  switch (status) {
    case "Today":
      return {
        color: isDark ? "#93C5FD" : palette.today,
        bg: isDark ? "#1E3A5F" : "#E6F0FF",
        icon: "today",
      };
    case "Upcoming":
      return {
        color: isDark ? "#C4B5FD" : palette.upcoming,
        bg: isDark ? "#352653" : "#F0E9FF",
        icon: "calendar",
      };
    case "Completed":
      return {
        color: isDark ? "#6EE7B7" : palette.done,
        bg: isDark ? "#174536" : "#DDF7F3",
        icon: "checkmark-circle",
      };
    default:
      return { color: palette.sub, bg: palette.chip, icon: "ellipse-outline" };
  }
};

const PRIORITY_STYLE: Record<string, { color: string; bg: string }> = {
  High: { color: "#B91C1C", bg: "#FEE2E2" },
  Medium: { color: "#92400E", bg: "#FEF3C7" },
  Low: { color: "#166534", bg: "#DCFCE7" },
};

const CATEGORY_COLORS = [
  "#DBEAFE",
  "#DCFCE7",
  "#FEF3C7",
  "#FCE7F3",
  "#EDE9FE",
  "#FEE2E2",
  "#CCFBF1",
  "#E2E8F0",
];

// Local image assets used by the per-note background gallery.
const NOTE_BACKGROUND_IMAGES = [
  {
    id: "cute1",
    label: "Cute 1",
    category: "Cute",
    source: require("../../assets/images/cute1.jpg"),
  },
  {
    id: "cute2",
    label: "Cute 2",
    category: "Cute",
    source: require("../../assets/images/cute2.jpg"),
  },
  {
    id: "cute3",
    label: "Cute 3",
    category: "Cute",
    source: require("../../assets/images/cute3.jpg"),
  },
  {
    id: "cute4",
    label: "Cute 4",
    category: "Cute",
    source: require("../../assets/images/cute4.jpg"),
  },
  {
    id: "cute5",
    label: "Cute 5",
    category: "Cute",
    source: require("../../assets/images/cute5.jpg"),
  },
  {
    id: "cute6",
    label: "Cute 6",
    category: "Cute",
    source: require("../../assets/images/cute6.jpg"),
  },
  {
    id: "cute7",
    label: "Cute 7",
    category: "Cute",
    source: require("../../assets/images/cute7.jpg"),
  },
  {
    id: "cute8",
    label: "Cute 8",
    category: "Cute",
    source: require("../../assets/images/cute8.jpg"),
  },
  {
    id: "cute9",
    label: "Cute 9",
    category: "Cute",
    source: require("../../assets/images/cute9.jpg"),
  },
  {
    id: "cute10",
    label: "Cute 10",
    category: "Cute",
    source: require("../../assets/images/cute10.jpg"),
  },
  {
    id: "cute11",
    label: "Cute 11",
    category: "Cute",
    source: require("../../assets/images/cute11.jpg"),
  },
  {
    id: "cute12",
    label: "Cute 12",
    category: "Cute",
    source: require("../../assets/images/cute12.jpg"),
  },
  {
    id: "cute13",
    label: "Cute 13",
    category: "Cute",
    source: require("../../assets/images/cute13.jpg"),
  },
  {
    id: "cute14",
    label: "Cute 14",
    category: "Cute",
    source: require("../../assets/images/cute14.jpg"),
  },
  {
    id: "cute15",
    label: "Cute 15",
    category: "Cute",
    source: require("../../assets/images/cute15.jpg"),
  },
  {
    id: "cute16",
    label: "Cute 16",
    category: "Cute",
    source: require("../../assets/images/cute16.jpg"),
  },
  {
    id: "cute17",
    label: "Cute 17",
    category: "Cute",
    source: require("../../assets/images/cute17.jpg"),
  },
  {
    id: "cute18",
    label: "Cute 18",
    category: "Cute",
    source: require("../../assets/images/cute18.jpg"),
  },
  {
    id: "cute19",
    label: "Cute 19",
    category: "Cute",
    source: require("../../assets/images/cute19.jpg"),
  },
];
const NOTE_BACKGROUND_CATEGORIES = ["All", "Cute"];

// ============================================================
// SCREEN
// ============================================================
export default function ViewTodolistScreen() {
  const { from } = useLocalSearchParams<{ from?: string }>();
  const { width: windowWidth } = useWindowDimensions();
  const isDesktop = Platform.OS === "web" && windowWidth >= 1100;
  const isWideDesktop = Platform.OS === "web" && windowWidth >= 1500;
  const {
    theme: sharedTheme,
    isDark,
    colors: sharedColors,
    setTheme,
  } = useAppTheme();

  // Every screen surface, text, border and input uses the active app theme.
  // User-selected note colors/images remain untouched.
  const C = useMemo(
    () => ({
      ...COLORS,
      bg: sharedColors.background || (isDark ? "#101D18" : "#EAFBF4"),
      surface: sharedColors.surface || (isDark ? "#192A22" : "#FFFFFF"),
      ink: sharedColors.text || (isDark ? "#E8F5ED" : "#064E3B"),
      sub: sharedColors.secondaryText || (isDark ? "#A8C4B3" : "#648477"),
      mute: isDark ? "#82998C" : "#8BA99B",
      line: isDark ? "#304A3B" : "#D5E9DF",
      chip: isDark ? "#263B30" : "#D1FAE5",
      primary: isDark ? "#55D6A0" : "#10B981",
      primarySoft: isDark ? "#214B3A" : "#D1FAE5",
      hero: isDark ? "#0C2B20" : "#064E3B",
      heroSoft: isDark ? "#14543D" : "#047857",
      danger: isDark ? "#FCA5A5" : "#F16B6B",
      dangerSoft: isDark ? "#3A2024" : "#FDECEC",
      amber: isDark ? "#FBBF24" : "#E9A23B",
    }),
    [isDark, sharedColors],
  );

  const styles = useMemo(() => createStyles(C), [C]);
  const appTheme: "light" | "dark" = isDark ? "dark" : "light";
  const [noteTextColors, setNoteTextColors] = useState<Record<string, string>>(
    {},
  );

  // Cross-platform replacement for showAppAlert().
  // React Native Alert.alert is not implemented consistently in Electron/Web.
  const [appAlert, setAppAlert] = useState<AppAlertState>({
    visible: false,
    title: "",
    message: "",
    buttons: [],
  });

  const showAppAlert = useCallback(
    (title: string, message = "", buttons?: AppAlertButton[]) => {
      setAppAlert({
        visible: true,
        title: String(title || ""),
        message: String(message || ""),
        buttons:
          buttons && buttons.length > 0
            ? buttons
            : [{ text: "OK", style: "default" }],
      });
    },
    [],
  );

  const closeAppAlert = useCallback(() => {
    setAppAlert((current) => ({ ...current, visible: false }));
  }, []);

  const pressAppAlertButton = useCallback((button: AppAlertButton) => {
    setAppAlert((current) => ({ ...current, visible: false }));
    if (button.onPress) {
      // Do not block the UI while async actions (delete, save, etc.) run.
      Promise.resolve()
        .then(() => button.onPress?.())
        .catch((error) =>
          console.error("[AppAlert] Button action failed:", error),
        );
    }
  }, []);

  const [todos, setTodos] = useState<Todo[]>([]);
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterType>("All");
  const [pinnedIds, setPinnedIds] = useState<string[]>([]);
  const [quickNoteMeta, setQuickNoteMeta] = useState<
    Record<string, QuickNoteMeta>
  >({});
  const [sortBy, setSortBy] = useState<
    "date" | "title" | "modified" | "priority"
  >("date");
  const [gridLayout, setGridLayout] = useState(false);
  const [calendarView, setCalendarView] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedCalendarDate, setSelectedCalendarDate] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  });
  const [organizationMeta, setOrganizationMeta] = useState<
    Record<string, NoteOrganizationMeta>
  >({});
  const [noteFolders, setNoteFolders] = useState<NoteFolder[]>([]);

  const [collectionFilter, setCollectionFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [organizationModal, setOrganizationModal] =
    useState<OrganizationModalType>(null);
  const [organizationInput, setOrganizationInput] = useState("");
  const [editingOrganizationId, setEditingOrganizationId] = useState<
    string | null
  >(null);
  const [selectedOrganizationColor, setSelectedOrganizationColor] = useState(
    CATEGORY_COLORS[0],
  );
  const [tagTodoId, setTagTodoId] = useState<string | null>(null);
  const [menuVisible, setMenuVisible] = useState(false);
  const [actionTodo, setActionTodo] = useState<Todo | null>(null);
  const [statusTodo, setStatusTodo] = useState<Todo | null>(null);
  const [statusBusy, setStatusBusy] = useState(false);
  const [reminderTodo, setReminderTodo] = useState<Todo | null>(null);
  const [reminderModalVisible, setReminderModalVisible] = useState(false);
  const [reminderDateValue, setReminderDateValue] = useState(new Date());
  const [createChoiceVisible, setCreateChoiceVisible] = useState(false);
  const [createChoiceFolderId, setCreateChoiceFolderId] = useState<
    string | null
  >(null);
  const [reminderTimeValue, setReminderTimeValue] = useState(() => {
    const next = new Date();
    next.setMinutes(next.getMinutes() + 5, 0, 0);
    return next;
  });
  const [reminderBusy, setReminderBusy] = useState(false);
  const [lockDialogVisible, setLockDialogVisible] = useState(false);
  const [lockDialogMode, setLockDialogMode] = useState<
    "lock" | "unlock" | "changePin"
  >("lock");
  const [lockTarget, setLockTarget] = useState<Todo | null>(null);
  const [currentLockPin, setCurrentLockPin] = useState("");
  const [newLockPin, setNewLockPin] = useState("");
  const [confirmLockPin, setConfirmLockPin] = useState("");
  const [lockRequestBusy, setLockRequestBusy] = useState(false);
  const [detailsVisible, setDetailsVisible] = useState(false);
  const [shareDialogVisible, setShareDialogVisible] = useState(false);
  const [shareText, setShareText] = useState("");
  const [selectedTodo, setSelectedTodo] = useState<Todo | null>(null);
  const [selectedSketchUri, setSelectedSketchUri] = useState<string | null>(
    null,
  );

  const [appearanceVisible, setAppearanceVisible] = useState(false);
  const [backgroundGalleryVisible, setBackgroundGalleryVisible] =
    useState(false);
  const [backgroundCategory, setBackgroundCategory] = useState("All");
  const [accentColor, setAccentColor] = useState(C.primary);
  const [defaultNoteColor, setDefaultNoteColor] = useState("#FFF8DC");
  const [notePattern, setNotePattern] = useState<
    "plain" | "lined" | "dotted" | "grid"
  >("plain");
  const [notebookStyle, setNotebookStyle] = useState<
    "classic" | "minimal" | "rounded"
  >("rounded");
  const [noteFontSize, setNoteFontSize] = useState<
    "small" | "medium" | "large"
  >("medium");
  const [noteFontFamily, setNoteFontFamily] = useState<
    "System" | "serif" | "monospace"
  >("System");

  const [showHero, setShowHero] = useState(true);
  const [showQuickNotes, setShowQuickNotes] = useState(true);

  const [homeLayoutDensity, setHomeLayoutDensity] = useState<
    "compact" | "comfortable" | "spacious"
  >("comfortable");
  const [showHomeGreeting, setShowHomeGreeting] = useState(true);
  const appearanceColors = [
    "#FFF8DC",
    "#FFFFFF",
    "#FDE2E4",
    "#E0F2FE",
    "#DCFCE7",
    "#EDE9FE",
    "#FEF3C7",
    "#F3E8FF",
    "#F1F5F9",
    "#D1FAE5",
    "#FFE4E6",
    "#DBEAFE",
  ];

  const saveAppearance = useCallback(
    async (patch: Record<string, any>) => {
      const next = {
        appTheme,
        accentColor,
        defaultNoteColor,
        notePattern,
        notebookStyle,
        noteFontSize,
        noteFontFamily,
        showHero,
        showQuickNotes,
        homeLayout: homeLayoutDensity,
        showHomeGreeting,
        showHomeStats: showHero,
        ...patch,
      };
      try {
        await AsyncStorage.setItem(
          "notes:appearance-settings",
          JSON.stringify(next),
        );
      } catch (error) {
        console.warn("Could not save appearance settings", error);
      }
    },
    [
      appTheme,
      accentColor,
      defaultNoteColor,
      notePattern,
      notebookStyle,
      noteFontSize,
      noteFontFamily,
      showHero,
      showQuickNotes,
      homeLayoutDensity,
      showHomeGreeting,
    ],
  );

  const updateAppearance = useCallback(
    (patch: Record<string, any>) => {
      if (patch.appTheme !== undefined)
        void setTheme(patch.appTheme === "dark" ? "Dark" : "Light");
      if (patch.accentColor !== undefined) setAccentColor(patch.accentColor);
      if (patch.defaultNoteColor !== undefined)
        setDefaultNoteColor(patch.defaultNoteColor);
      if (patch.notePattern !== undefined) setNotePattern(patch.notePattern);
      if (patch.notebookStyle !== undefined)
        setNotebookStyle(patch.notebookStyle);
      if (patch.noteFontSize !== undefined) setNoteFontSize(patch.noteFontSize);
      if (patch.noteFontFamily !== undefined)
        setNoteFontFamily(patch.noteFontFamily);

      if (patch.showHero !== undefined) setShowHero(patch.showHero);
      if (patch.showQuickNotes !== undefined)
        setShowQuickNotes(patch.showQuickNotes);

      void saveAppearance(patch);
    },
    [saveAppearance, setTheme],
  );

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void (async () => {
        try {
          const raw = await AsyncStorage.getItem("notes:appearance-settings");
          if (!active || !raw) return;
          const a = JSON.parse(raw);
          if (a.accentColor) setAccentColor(a.accentColor);
          if (a.defaultNoteColor) setDefaultNoteColor(a.defaultNoteColor);
          if (["plain", "lined", "dotted", "grid"].includes(a.notePattern))
            setNotePattern(a.notePattern);
          if (["classic", "minimal", "rounded"].includes(a.notebookStyle))
            setNotebookStyle(a.notebookStyle);
          if (["small", "medium", "large"].includes(a.noteFontSize))
            setNoteFontSize(a.noteFontSize);
          if (["System", "serif", "monospace"].includes(a.noteFontFamily))
            setNoteFontFamily(a.noteFontFamily);
          if (typeof a.showHero === "boolean") setShowHero(a.showHero);
          if (typeof a.showQuickNotes === "boolean")
            setShowQuickNotes(a.showQuickNotes);

          if (
            a.homeLayout === "compact" ||
            a.homeLayout === "comfortable" ||
            a.homeLayout === "spacious"
          )
            setHomeLayoutDensity(a.homeLayout);
          if (typeof a.showHomeGreeting === "boolean")
            setShowHomeGreeting(a.showHomeGreeting);
        } catch (error) {
          console.warn("Could not load appearance settings", error);
        }
      })();
      return () => {
        active = false;
      };
    }, []),
  );

  // Alerts/modals can't open while another Modal is closing on iOS, so defer.
  const afterModal = useCallback((fn: () => void) => {
    setTimeout(fn, 260);
  }, []);

  // ==========================================================
  // AUTH + LOAD
  // ==========================================================
  const loadAuth = useCallback(async () => {
    try {
      const storedToken = await AsyncStorage.getItem("login_token");
      if (storedToken) setToken(storedToken);
      return storedToken || "";
    } catch (error) {
      console.error("❌ LOAD AUTH ERROR:", error);
      return "";
    }
  }, []);

  const mergeTodos = (localItems: Todo[], serverItems: Todo[]): Todo[] => {
    // Storage/API responses can contain null or malformed rows. Sanitize
    // before any downstream helper, filter, sort, or renderer reads properties.
    const safeLocalItems = Array.isArray(localItems)
      ? localItems.filter(
          (item): item is Todo => !!item && typeof item === "object",
        )
      : [];
    const safeServerItems = Array.isArray(serverItems)
      ? serverItems.filter(
          (item): item is Todo => !!item && typeof item === "object",
        )
      : [];
    const serverKeys = new Set(
      safeServerItems.map((item) => String(item.tdlId || item._id || "")),
    );
    const visibleLocalItems = safeLocalItems.filter(
      (item) => !serverKeys.has(String(item.tdlId || item._id || "")),
    );
    return [...visibleLocalItems, ...safeServerItems];
  };

  const loadTodos = useCallback(
    async (showLoader = true) => {
      let localTodos: Todo[] = [];
      let cachedTodos: Todo[] = [];
      let currentToken = token;
      let hasRenderedLocalData = false;

      try {
        if (showLoader) setLoading(true);

        // Read token + cached data together to avoid serial AsyncStorage round trips.
        const stored = await AsyncStorage.multiGet([
          "login_token",
          "local_todos",
          "view_todolist_cache",
        ]);
        const values = Object.fromEntries(stored) as Record<
          string,
          string | null
        >;
        currentToken = currentToken || values["login_token"] || "";
        if (currentToken && currentToken !== token) setToken(currentToken);

        try {
          const parsedLocal = values["local_todos"]
            ? JSON.parse(values["local_todos"]!)
            : [];
          localTodos = Array.isArray(parsedLocal)
            ? parsedLocal.filter(
                (item: any) => item && (item.tdlId || item._id),
              )
            : [];
        } catch (e) {
          console.warn("Could not read local notes:", e);
        }

        try {
          const parsedCache = values["view_todolist_cache"]
            ? JSON.parse(values["view_todolist_cache"]!)
            : [];
          cachedTodos = Array.isArray(parsedCache)
            ? parsedCache.filter(
                (item: any) => item && (item.tdlId || item._id),
              )
            : [];
        } catch (e) {
          console.warn("Could not read cached notes:", e);
        }

        // Show cached notes immediately while the server refresh happens in the background.
        const initialItems = mergeTodos(localTodos, cachedTodos);
        if (initialItems.length > 0) {
          setTodos(initialItems);
          setLoading(false);
          hasRenderedLocalData = true;
        }

        if (!currentToken) {
          if (!hasRenderedLocalData) setLoading(false);
          return;
        }

        const response = await axios.get(`${API_BASE_URL}/api/todolist`, {
          headers: { Authorization: getAuthorizationHeader(currentToken) },
          timeout: 10000,
        });

        if (response.data?.success === true) {
          const payload = response.data?.data;
          const taskList = Array.isArray(payload)
            ? payload
            : Array.isArray(payload?.tasks)
              ? payload.tasks
              : [];
          // Some update endpoints omit attachment fields from the response even
          // though the note still owns those attachments. Restore the previous
          // attachment metadata only when the server omitted the field entirely.
          // An explicit empty fileIds array is respected, so a user-cleared
          // attachment stays cleared.
          const previousById = new Map<string, any>();
          [...cachedTodos, ...localTodos].forEach((item: any) => {
            const key = String(item?.tdlId || item?._id || "");
            if (key) previousById.set(key, item);
          });

          const serverTodos: Todo[] = taskList
            .filter((item: any) => item && (item.tdlId || item._id))
            .map((item: any) => {
              const key = String(item?.tdlId || item?._id || "");
              const previous = previousById.get(key);
              if (!previous) return item;

              const next = { ...item };
              if (
                !Object.prototype.hasOwnProperty.call(item, "fileIds") &&
                Array.isArray(previous.fileIds)
              ) {
                next.fileIds = previous.fileIds;
              }
              if (
                !Object.prototype.hasOwnProperty.call(item, "type") &&
                previous.type !== undefined
              ) {
                next.type = previous.type;
              }
              if (
                !Object.prototype.hasOwnProperty.call(item, "fileNames") &&
                Array.isArray(previous.fileNames)
              ) {
                next.fileNames = previous.fileNames;
              }
              if (
                !Object.prototype.hasOwnProperty.call(
                  item,
                  "attachmentNames",
                ) &&
                Array.isArray(previous.attachmentNames)
              ) {
                next.attachmentNames = previous.attachmentNames;
              }
              return next;
            });

          const mergedTodos = mergeTodos(localTodos, serverTodos);
          setTodos(mergedTodos);
          // Cache the enriched snapshot, including attachment metadata.
          void AsyncStorage.setItem(
            "view_todolist_cache",
            JSON.stringify(serverTodos),
          ).catch(() => {});
        } else {
          setTodos(mergeTodos(localTodos, cachedTodos));
        }
      } catch (error: any) {
        console.error(
          "❌ LOAD TODOS ERROR:",
          error?.response?.data || error?.message || error,
        );
        setTodos((previous) =>
          previous.length ? previous : mergeTodos(localTodos, cachedTodos),
        );
        // Do not interrupt the user with an alert for a slow/offline refresh.
        // Cached/local notes remain visible and the user can pull to refresh again.
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [token],
  );

  // Keep this helper stable between renders. It is used in several hook
  // dependency arrays; recreating it on every render causes dependent
  // callbacks/effects (including checklist widget sync) to run repeatedly.
  const getTodoKey = useCallback(
    (todo: any): string =>
      String(todo?.tdlId ?? todo?._id ?? todo?.id ?? todo?.title ?? ""),
    [],
  );

  const getQuickNoteMeta = useCallback(
    (todo: Todo | null | undefined): QuickNoteMeta => {
      // A stale state update or malformed persisted row must never crash
      // metadata lookup. Return an empty metadata object for invalid rows.
      if (!todo || typeof todo !== "object") return {} as QuickNoteMeta;
      const id = getTodoKey(todo);
      const titleKey = String(todo?.title || "")
        .trim()
        .toLowerCase();
      const localMeta = quickNoteMeta[id] || quickNoteMeta[titleKey] || {};
      const data: any = todo;
      return {
        ...localMeta,
        isQuickNote:
          localMeta.isQuickNote ??
          (data.noteType === "quick" ||
            data.note_type === "quick" ||
            data.quickNote === true),
        quickNoteColor: localMeta.quickNoteColor || data.quickNoteColor,
        textColor: localMeta.textColor || data.textColor,
        alignment: localMeta.alignment || data.alignment || "left",
        notePattern: localMeta.notePattern || data.notePattern,
        backgroundImageUri:
          localMeta.backgroundImageUri || data.backgroundImageUri,
        noteBackgroundImage:
          localMeta.noteBackgroundImage || data.noteBackgroundImage,
        quickNoteTheme:
          localMeta.quickNoteTheme || data.quickNoteTheme || data.theme,
      };
    },
    [getTodoKey, quickNoteMeta],
  );
  useEffect(() => {
    loadAuth();
    loadTodos(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let cancelled = false;

    const syncChecklistWidget = async () => {
      try {
        const checklistTasks = todos
          .filter((todo): todo is Todo => !!todo && typeof todo === "object")
          .filter((todo) => {
            const meta = organizationMeta[getTodoKey(todo)] || {};

            return (
              !meta.archived &&
              !meta.trashed &&
              getQuickNoteMeta(todo).isQuickNote !== true
            );
          })
          .slice(0, 5)
          .map((todo) => ({
            id: String(todo.tdlId || todo._id || ""),
            title: String(todo.title || "Untitled task"),
            status: todo.status,
            completed: todo.status === "Completed",
          }))
          .filter((task) => task.id.length > 0);

        // IMPORTANT: Replace "token" with your actual AsyncStorage
        // authentication-token key if it has a different name.
        const authToken = await AsyncStorage.getItem("login_token");

        if (cancelled) return;

        if (!authToken) {
          console.warn(
            "Checklist widget sync skipped: authentication token not found.",
          );
          return;
        }

        await updateChecklistHomeWidget(checklistTasks, authToken);
      } catch (error) {
        console.error("Checklist widget synchronization failed:", error);
      }
    };

    void syncChecklistWidget();

    return () => {
      cancelled = true;
    };
  }, [todos, organizationMeta, getTodoKey, getQuickNoteMeta]);

  const getOrganizationMeta = useCallback(
    (todo: Todo): NoteOrganizationMeta =>
      organizationMeta[getTodoKey(todo)] || {},
    [getTodoKey, organizationMeta],
  );

  // ==========================================================
  // ORGANIZATION (local)
  // ==========================================================
  const persistOrganization = useCallback(
    async (
      nextMeta: Record<string, NoteOrganizationMeta>,
      nextFolders = noteFolders,
    ) => {
      setOrganizationMeta(nextMeta);
      setNoteFolders(nextFolders);

      try {
        await AsyncStorage.multiSet([
          ["notes:organization-meta", JSON.stringify(nextMeta)],
          ["notes:folders", JSON.stringify(nextFolders)],
        ]);
      } catch {
        showAppAlert(
          "Save failed",
          "Could not save note organization on this device.",
        );
      }
    },
    [noteFolders],
  );

  useEffect(() => {
    void (async () => {
      try {
        const pairs = await AsyncStorage.multiGet([
          "notes:organization-meta",
          "notes:folders",
          "notes:categories",
        ]);
        const stored: Record<string, string | null> = Object.fromEntries(pairs);
        if (stored["notes:organization-meta"])
          setOrganizationMeta(JSON.parse(stored["notes:organization-meta"]!));
        if (stored["notes:folders"])
          setNoteFolders(JSON.parse(stored["notes:folders"]!));
      } catch (error) {
        console.warn("Could not load local note organization metadata", error);
      }
    })();
  }, []);

  const updateNoteMeta = useCallback(
    async (todo: Todo, patch: Partial<NoteOrganizationMeta>) => {
      const id = getTodoKey(todo);
      if (!id) return;
      const next = {
        ...organizationMeta,
        [id]: { ...(organizationMeta[id] || {}), ...patch },
      };
      await persistOrganization(next);
    },
    [getTodoKey, organizationMeta, persistOrganization],
  );

  const selectBackgroundForActionTodo = useCallback(
    async (backgroundId: string) => {
      if (!actionTodo) {
        setBackgroundGalleryVisible(false);
        return;
      }

      // Selecting an image also assigns its matching pattern to this note.
      // Both values are saved in this note's local metadata.
      const notePattern = NOTE_IMAGE_PATTERNS[backgroundId] ?? "plain";
      await updateNoteMeta(actionTodo, {
        noteBackgroundImage: backgroundId,
        notePattern,
      });

      setBackgroundGalleryVisible(false);
      setAppearanceVisible(false);
      setActionTodo(null);
    },
    [actionTodo, updateNoteMeta],
  );

  const clearBackgroundForActionTodo = useCallback(async () => {
    if (actionTodo)
      await updateNoteMeta(actionTodo, { noteBackgroundImage: undefined });
    setBackgroundGalleryVisible(false);
  }, [actionTodo, updateNoteMeta]);

  const openOrganizationEditor = useCallback(
    (type: Exclude<OrganizationModalType, null>, id?: string) => {
      setOrganizationModal(type);
      setEditingOrganizationId(id || null);
      if (type === "folder") {
        setOrganizationInput(noteFolders.find((x) => x.id === id)?.name || "");
      } else {
        setOrganizationInput("");
      }
    },
    [noteFolders],
  );

  const saveOrganizationEditor = useCallback(async () => {
    const name = organizationInput.trim();
    if (!name) {
      showAppAlert("Name required", "Please enter a name.");
      return;
    }
    const id = editingOrganizationId || `${organizationModal}-${Date.now()}`;
    if (organizationModal === "folder") {
      const next = editingOrganizationId
        ? noteFolders.map((item) => (item.id === id ? { ...item, name } : item))
        : [...noteFolders, { id, name }];
      await persistOrganization(organizationMeta, next);
    } else if (organizationModal === "tag" && editingOrganizationId) {
      const isEdit = editingOrganizationId.includes("::");
      const noteId = isEdit
        ? editingOrganizationId.split("::")[0]
        : editingOrganizationId;
      const oldTag = isEdit
        ? editingOrganizationId.slice(editingOrganizationId.indexOf("::") + 2)
        : "";
      const current = organizationMeta[noteId] || {};
      const tags = current.tags || [];
      const nextTags = isEdit
        ? tags.map((tag) => (tag === oldTag ? name : tag))
        : [...tags, name];
      await persistOrganization({
        ...organizationMeta,
        [noteId]: { ...current, tags: Array.from(new Set(nextTags)) },
      });
      // Stay in the tag manager so several tags can be added in a row.
      setEditingOrganizationId(noteId);
      setOrganizationInput("");
      return;
    }
    setOrganizationModal(null);
    setOrganizationInput("");
  }, [
    organizationInput,
    editingOrganizationId,
    organizationModal,
    noteFolders,
    organizationMeta,
    persistOrganization,
    selectedOrganizationColor,
  ]);

  const [folderPickerVisible, setFolderPickerVisible] = useState(false);
  const [selectedTodoForFolder, setSelectedTodoForFolder] =
    useState<Todo | null>(null);

  const chooseFolderForNote = useCallback((todo: Todo) => {
    setSelectedTodoForFolder(todo);
    setFolderPickerVisible(true);
  }, []);

  const [priorityModalVisible, setPriorityModalVisible] = useState(false);
  const [priorityTodo, setPriorityTodo] = useState<Todo | null>(null);

  const choosePriority = useCallback((todo: Todo) => {
    setPriorityTodo(todo);
    setPriorityModalVisible(true);
  }, []);

  const manageTags = useCallback(
    (todo: Todo) => {
      setTagTodoId(getTodoKey(todo));
      setOrganizationModal("tag");
      setEditingOrganizationId(getTodoKey(todo));
      setOrganizationInput("");
    },
    [getTodoKey],
  );

  const moveToTrash = useCallback(
    (todo: Todo) => {
      showAppAlert(
        "Move to Trash",
        `Move “${todo.title || "Untitled note"}” to Trash?`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Move to Trash",
            style: "destructive",
            onPress: async () => {
              try {
                // Duplicate notes stay on-device; no server/API call is made.
                if (todo.isLocalDuplicate) {
                  const raw = await AsyncStorage.getItem("local_todos");
                  const localTodos: Todo[] = raw ? JSON.parse(raw) : [];
                  const id = getTodoKey(todo);
                  const updatedLocal = localTodos.map((item) =>
                    getTodoKey(item) === id
                      ? { ...item, updatedAt: new Date().toISOString() }
                      : item,
                  );
                  await AsyncStorage.setItem(
                    "local_todos",
                    JSON.stringify(updatedLocal),
                  );
                }
                await updateNoteMeta(todo, { trashed: true, archived: false });
              } catch (error: any) {
                showAppAlert(
                  "Trash failed",
                  error?.message || "Could not move this note to Trash.",
                );
              }
            },
          },
        ],
      );
    },
    [getTodoKey, updateNoteMeta],
  );

  const restoreFromTrash = useCallback(
    async (todo: Todo) => {
      try {
        // Restoring a local duplicate only changes its local organization metadata.
        await updateNoteMeta(todo, { trashed: false });
        if (todo.isLocalDuplicate) {
          const raw = await AsyncStorage.getItem("local_todos");
          const localTodos: Todo[] = raw ? JSON.parse(raw) : [];
          const id = getTodoKey(todo);
          const updatedLocal = localTodos.map((item) =>
            getTodoKey(item) === id
              ? { ...item, updatedAt: new Date().toISOString() }
              : item,
          );
          await AsyncStorage.setItem(
            "local_todos",
            JSON.stringify(updatedLocal),
          );
        }
      } catch (error: any) {
        showAppAlert(
          "Restore failed",
          error?.message || "Could not restore this note.",
        );
      }
    },
    [getTodoKey, updateNoteMeta],
  );

  const permanentlyDeleteTodo = useCallback(
    (todo: Todo) => {
      showAppAlert(
        "Delete forever",
        `“${todo.title || "Untitled note"}” will be permanently deleted. This can't be undone.`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete forever",
            style: "destructive",
            onPress: async () => {
              const id = getTodoKey(todo);
              try {
                // Local duplicates must never call the backend delete endpoint.
                if (todo.isLocalDuplicate) {
                  const raw = await AsyncStorage.getItem("local_todos");
                  const localTodos: Todo[] = raw ? JSON.parse(raw) : [];
                  const remainingLocal = localTodos.filter(
                    (item) => getTodoKey(item) !== id,
                  );
                  await AsyncStorage.setItem(
                    "local_todos",
                    JSON.stringify(remainingLocal),
                  );
                } else {
                  const currentToken =
                    token || (await AsyncStorage.getItem("login_token")) || "";
                  if (currentToken && todo.tdlId) {
                    const response = await axios.post(
                      `${API_BASE_URL}/api/deleteTodos/${encodeURIComponent(todo.tdlId)}`,
                      {},
                      {
                        headers: {
                          Authorization: getAuthorizationHeader(currentToken),
                        },
                      },
                    );
                    if (response.data?.success !== true) {
                      throw new Error("Backend deletion failed");
                    }
                  }
                }

                // Remove from local UI/cache only after deletion succeeds.
                const next = { ...organizationMeta };
                delete next[id];
                await persistOrganization(next);

                setTodos((items) =>
                  items.filter((item) => getTodoKey(item) !== id),
                );

                // Prevent deleted duplicate from reappearing from the screen cache.
                if (todo.isLocalDuplicate) {
                  const cacheRaw = await AsyncStorage.getItem(
                    "view_todolist_cache",
                  );
                  if (cacheRaw) {
                    const cached: Todo[] = JSON.parse(cacheRaw);
                    await AsyncStorage.setItem(
                      "view_todolist_cache",
                      JSON.stringify(
                        cached.filter((item) => getTodoKey(item) !== id),
                      ),
                    );
                  }

                  const pinsRaw = await AsyncStorage.getItem("notes:pinnedIds");
                  const pins: string[] = pinsRaw ? JSON.parse(pinsRaw) : [];
                  const nextPins = pins.filter((value) => value !== id);
                  await AsyncStorage.setItem(
                    "notes:pinnedIds",
                    JSON.stringify(nextPins),
                  );
                  setPinnedIds(nextPins);
                }
              } catch (error: any) {
                showAppAlert(
                  "Delete failed",
                  error?.response?.data?.message ||
                    error?.message ||
                    "Could not permanently delete this note.",
                );
              }
            },
          },
        ],
      );
    },
    [getTodoKey, organizationMeta, persistOrganization, token],
  );

  const deleteFolder = useCallback(
    (folder: NoteFolder) => {
      showAppAlert(
        "Delete folder",
        `Delete “${folder.name}”? Notes stay and become unfiled.`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete",
            style: "destructive",
            onPress: async () => {
              const nextMeta = { ...organizationMeta };
              Object.keys(nextMeta).forEach((id) => {
                if (nextMeta[id].folderId === folder.id)
                  nextMeta[id] = { ...nextMeta[id], folderId: undefined };
              });
              await persistOrganization(
                nextMeta,
                noteFolders.filter((item) => item.id !== folder.id),
              );
              if (collectionFilter === folder.id) setCollectionFilter("all");
            },
          },
        ],
      );
    },
    [organizationMeta, noteFolders, persistOrganization, collectionFilter],
  );

  // ==========================================================
  // QUICK NOTES / PINS
  // ==========================================================

  const loadQuickNoteMetadata = useCallback(async () => {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const metaKeys = keys.filter((key) => key.startsWith("quick-note-meta:"));
      const entries = await AsyncStorage.multiGet(metaKeys);
      const next: Record<string, QuickNoteMeta> = {};
      for (const [key, value] of entries) {
        if (!value) continue;
        try {
          const meta = JSON.parse(value) as QuickNoteMeta;
          next[key.slice("quick-note-meta:".length)] = meta;
          if (meta.title) next[meta.title.trim().toLowerCase()] = meta;
        } catch {
          /* Ignore malformed local metadata. */
        }
      }
      setQuickNoteMeta(next);
    } catch (error) {
      console.warn("Unable to load quick-note metadata:", error);
    }
  }, []);

  useEffect(() => {
    void AsyncStorage.getItem("notes:pinnedIds")
      .then((raw) => {
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed))
            setPinnedIds(parsed.filter((id) => typeof id === "string"));
        }
      })
      .catch(() => undefined);
    void loadQuickNoteMetadata();
  }, [loadQuickNoteMetadata]);

  const togglePin = useCallback(
    async (todo: Todo) => {
      const id = getTodoKey(todo);
      if (!id) return;

      const meta = getQuickNoteMeta(todo);
      const isPinned = pinnedIds.includes(id) || meta.quickNotePinned === true;

      const next = isPinned
        ? pinnedIds.filter((value) => value !== id)
        : [...pinnedIds, id];

      setPinnedIds(next);

      try {
        await AsyncStorage.setItem("notes:pinnedIds", JSON.stringify(next));

        if (meta.isQuickNote) {
          const updated = {
            ...meta,
            quickNotePinned: !isPinned,
            title: String(todo.title || ""),
          };

          await AsyncStorage.setItem(
            `quick-note-meta:${id}`,
            JSON.stringify(updated),
          );

          const titleKey = String(todo.title || "")
            .trim()
            .toLowerCase();

          if (titleKey) {
            await AsyncStorage.setItem(
              `quick-note-meta:${titleKey}`,
              JSON.stringify(updated),
            );
          }

          setQuickNoteMeta((current) => ({
            ...current,
            [id]: updated,
            ...(titleKey ? { [titleKey]: updated } : {}),
          }));
        }
      } catch {
        showAppAlert("Pin failed", "Could not save this pin on this device.");
      }
    },
    [getTodoKey, getQuickNoteMeta, pinnedIds],
  );

  const convertQuickNoteToTodo = useCallback(
    async (todo: Todo) => {
      const id = getTodoKey(todo);
      const meta = getQuickNoteMeta(todo);

      if (!id) return;

      const updated = {
        ...meta,
        isQuickNote: false,
        quickNotePinned: false,
        title: String(todo.title || ""),
        updatedAt: new Date().toISOString(),
      };

      try {
        await AsyncStorage.setItem(
          `quick-note-meta:${id}`,
          JSON.stringify(updated),
        );

        const titleKey = String(todo.title || "")
          .trim()
          .toLowerCase();

        if (titleKey) {
          await AsyncStorage.setItem(
            `quick-note-meta:${titleKey}`,
            JSON.stringify(updated),
          );
        }

        setQuickNoteMeta((current) => ({
          ...current,
          [id]: updated,
          ...(titleKey ? { [titleKey]: updated } : {}),
        }));

        setPinnedIds((current) => current.filter((value) => value !== id));

        const storedPins = await AsyncStorage.getItem("notes:pinnedIds");

        const nextPins = (
          storedPins ? (JSON.parse(storedPins) as string[]) : []
        ).filter((value) => value !== id);

        await AsyncStorage.setItem("notes:pinnedIds", JSON.stringify(nextPins));

        // Successfully converted silently.
      } catch (error) {
        console.error("Quick note conversion failed:", error);

        showAppAlert(
          "Conversion failed",
          "Could not update this quick note on this device.",
        );
      }
    },
    [getTodoKey, getQuickNoteMeta],
  );

  // ==========================================================
  // NOTE LOCK / UNLOCK / CHANGE SECURITY PIN
  // ==========================================================
  const openLockDialog = useCallback(
    (todo: Todo, mode: "lock" | "unlock" | "changePin") => {
      // The backend security routes look up notes by `tdlId`, so do not send
      // MongoDB `_id` as a substitute when `tdlId` is missing.
      const id = String(todo.tdlId || "").trim();

      if (!id || id.startsWith("local-")) {
        showAppAlert(
          "Save note first",
          "Security locking is available for notes saved to your account. Save this note to the server first.",
        );
        return;
      }

      setLockTarget(todo);
      setLockDialogMode(mode);
      setCurrentLockPin("");
      setNewLockPin("");
      setConfirmLockPin("");
      setLockDialogVisible(true);
    },
    [],
  );

  const submitLockDialog = useCallback(async () => {
    if (!lockTarget || lockRequestBusy) return;

    // Backend route examples use findOne({ tdlId: req.params.id }).
    const id = String(lockTarget.tdlId || "").trim();

    if (!id || id.startsWith("local-")) {
      showAppAlert(
        "Invalid note",
        "This note does not have a valid server note ID. Save it to your account first.",
      );
      return;
    }

    const validPin = (value: string) => /^\d{4,6}$/.test(value);

    if (lockDialogMode === "lock" || lockDialogMode === "changePin") {
      if (!validPin(newLockPin)) {
        showAppAlert("Invalid PIN", "Enter a 4–6 digit numeric PIN.");
        return;
      }

      if (newLockPin !== confirmLockPin) {
        showAppAlert("PIN mismatch", "New PIN and confirmation do not match.");
        return;
      }
    }

    if (lockDialogMode === "unlock" || lockDialogMode === "changePin") {
      if (!validPin(currentLockPin)) {
        showAppAlert("Invalid PIN", "Enter your current 4–6 digit PIN.");
        return;
      }
    }

    let endpoint: "lockNote" | "unlockNote" | "changeLockPin";
    let body: Record<string, string>;

    if (lockDialogMode === "lock") {
      endpoint = "lockNote";
      body = { lockPin: newLockPin };
    } else if (lockDialogMode === "unlock") {
      endpoint = "unlockNote";
      body = { lockPin: currentLockPin };
    } else {
      endpoint = "changeLockPin";
      body = {
        currentPin: currentLockPin,
        newPin: newLockPin,
      };
    }

    setLockRequestBusy(true);

    try {
      const currentToken =
        token || (await AsyncStorage.getItem("login_token")) || "";

      if (!currentToken) {
        showAppAlert(
          "Sign in required",
          "Please sign in before changing note security.",
        );
        return;
      }

      const requestUrl = `${API_BASE_URL}/api/${endpoint}/${encodeURIComponent(id)}`;

      console.log("[Note security] Request:", endpoint, requestUrl);

      const response = await axios.post(requestUrl, body, {
        headers: {
          Authorization: getAuthorizationHeader(currentToken),
        },
        timeout: 12000,
      });

      if (response.data?.success !== true) {
        throw new Error(
          response.data?.message || "The security update failed.",
        );
      }

      const isLocked = lockDialogMode !== "unlock";

      setTodos((previousTodos) =>
        previousTodos.map((item) =>
          String(item.tdlId || "").trim() === id
            ? { ...item, locked: isLocked }
            : item,
        ),
      );

      // Update the local cache to avoid showing the note's content in the list
      // while locked. This is UI/cache hygiene, not a replacement for backend
      // authorization on note-content endpoints.
      try {
        const updateCache = (items: any[]) =>
          items.map((item) => {
            if (String(item?.tdlId || "").trim() !== id) return item;

            if (isLocked) {
              return {
                ...item,
                locked: true,
                title: "Locked note",
                text: "",
                fileIds: [],
                type: [],
              };
            }

            return { ...item, locked: false };
          });

        for (const key of ["view_todolist_cache", "local_todos"]) {
          const cacheRaw = await AsyncStorage.getItem(key);
          if (!cacheRaw) continue;

          try {
            const cached = JSON.parse(cacheRaw);
            if (Array.isArray(cached)) {
              await AsyncStorage.setItem(
                key,
                JSON.stringify(updateCache(cached)),
              );
            }
          } catch (parseError) {
            console.warn(`Could not parse ${key}`, parseError);
          }
        }
      } catch (cacheError) {
        console.warn("Could not update note security cache", cacheError);
      }

      setLockDialogVisible(false);
      setLockTarget(null);
      setCurrentLockPin("");
      setNewLockPin("");
      setConfirmLockPin("");

      const title =
        lockDialogMode === "lock"
          ? "Note locked"
          : lockDialogMode === "unlock"
            ? "Note unlocked"
            : "PIN changed";

      const message =
        lockDialogMode === "lock"
          ? "Your note is now locked."
          : lockDialogMode === "unlock"
            ? "Your note is now unlocked."
            : "Your security PIN has been changed.";

      showAppAlert(title, message);
      await loadTodos(false);
    } catch (error: any) {
      const status = error?.response?.status;
      const serverMessage = error?.response?.data?.message;
      console.error("[Note security] Failed:", {
        endpoint,
        id,
        status,
        url: error?.config?.url,
        response: error?.response?.data,
        message: error?.message,
      });

      let message = serverMessage || error?.message || "Please try again.";

      if (status === 404) {
        message =
          endpoint === "changeLockPin"
            ? "The change-security-PIN API was not found (404). Add the backend POST /api/changeLockPin/:id route and confirm it is mounted correctly."
            : `The ${endpoint} API returned 404. Confirm the backend route exists and that this note's tdlId matches a database record.`;
      }

      showAppAlert("Security update failed", message);
    } finally {
      setLockRequestBusy(false);
    }
  }, [
    lockTarget,
    lockRequestBusy,
    lockDialogMode,
    newLockPin,
    confirmLockPin,
    currentLockPin,
    token,
    loadTodos,
  ]);
  // ==========================================================
  // NOTE ACTIONS
  // ==========================================================

  const showDetails = useCallback(async (todo: Todo) => {
    const item = todo as any;

    const todoId = item.tdlId ?? item.todoId ?? item._id ?? item.id;

    // Preserve the full note and its attachments.
    setSelectedTodo({ ...todo } as Todo);
    setSelectedSketchUri(null);
    setDetailsVisible(true);

    try {
      let sketchUri =
        item.drawingUri ??
        item.sketchUri ??
        item.sketchImage ??
        item.drawingImage ??
        item.canvasUri ??
        null;

      if (todoId != null && !sketchUri) {
        const id = String(todoId);

        sketchUri = await AsyncStorage.getItem(`note-drawing:${id}`);

        if (!sketchUri) {
          const keys = await AsyncStorage.getAllKeys();

          const matchingKey = keys.find(
            (key) =>
              key.includes(id) && /drawing|sketch|handwriting/i.test(key),
          );

          if (matchingKey) {
            sketchUri = await AsyncStorage.getItem(matchingKey);
          }
        }
      }

      setSelectedSketchUri(sketchUri || null);

      const fileIds = Array.isArray(item.fileIds) ? item.fileIds : [];

      const attachmentTypes = Array.isArray(item.type)
        ? item.type
        : item.type
          ? [String(item.type)]
          : [];

      console.log("Full Details debug:", {
        todoId,
        title: item.title,
        hasText: Boolean(item.text ?? item.description),
        fileIds,
        attachmentTypes,
        attachmentCount: fileIds.length,
        sketchFound: Boolean(sketchUri),
      });
    } catch (error) {
      console.warn("Failed to load note details:", error);
    }
  }, []);

  const duplicateTodo = useCallback(
    async (todo: Todo) => {
      try {
        const originalTitle = String(todo.title || "Untitled note").trim();

        const now = new Date().toISOString();

        const copy: Todo = {
          ...todo,

          // Give the copy its own local identity
          tdlId: `local-${Date.now()}-${Math.random()
            .toString(36)
            .slice(2, 8)}`,
          _id: undefined,

          // Identify this as a local-only duplicate
          isLocalDuplicate: true,

          title: originalTitle,
          text: String(todo.text || ""),
          date: todo.date || now.slice(0, 10),
          createdAt: now,
          updatedAt: now,
        };

        const storageKey = "local_todos";

        const storedTodos = await AsyncStorage.getItem(storageKey);

        const localTodos: Todo[] = storedTodos ? JSON.parse(storedTodos) : [];

        await AsyncStorage.setItem(
          storageKey,
          JSON.stringify([copy, ...localTodos]),
        );

        setTodos((previousTodos) => [
          copy,
          ...previousTodos.filter(
            (item) =>
              String(item.tdlId || item._id || "") !== String(copy.tdlId),
          ),
        ]);

        showAppAlert("Duplicated", `"${copy.title}" was saved locally.`);
      } catch (error: any) {
        showAppAlert(
          "Duplicate failed",
          error?.message || "Unable to duplicate note.",
        );
      }
    },
    [setTodos],
  );

  const editTodo = (todo: Todo) => {
    const meta = getQuickNoteMeta(todo);

    if (meta.isQuickNote === true) {
      // Quick Note editor
      router.push({
        pathname: "/quicknotes",
        params: {
          isEditMode: "true",
          editTodo: JSON.stringify(todo),
          isLocalDuplicate: todo.isLocalDuplicate ? "true" : "false",
        },
      });
      return;
    }

    // Regular Todo editor
    router.push({
      pathname: "/cretenote",
      params: {
        isEditMode: "true",
        editTodo: JSON.stringify(todo),
      },
    });
  };

  const hasReminder = (todo: Todo) =>
    Boolean(todo.alarm || todo.reminderDate || todo.reminderTime);

  // Manage only the reminder from this screen; the note itself is never edited.
  const openReminderEditor = (todo: Todo) => {
    const initialDate = todo.reminderDate || todo.date;
    const parsedDate = initialDate ? new Date(initialDate) : new Date();
    const safeDate = Number.isNaN(parsedDate.getTime())
      ? new Date()
      : parsedDate;
    const rawTime = String(todo.reminderTime || todo.alarm || "");
    const match = rawTime.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
    const nextTime = new Date();
    if (match) {
      let hours = Number(match[1]) % 12;
      if ((match[3] || "").toUpperCase() === "PM") hours += 12;
      nextTime.setHours(hours, Number(match[2]), 0, 0);
    } else {
      nextTime.setMinutes(nextTime.getMinutes() + 5, 0, 0);
    }
    setReminderTodo(todo);
    setReminderDateValue(safeDate);
    setReminderTimeValue(nextTime);
    setReminderModalVisible(true);
  };

  const openReminderDatePicker = () => {
    const input = document.createElement("input");

    input.type = "date";

    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");

    const formatDate = (date: Date) =>
      `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

    input.min = formatDate(now);
    input.value = formatDate(reminderDateValue);

    input.style.position = "fixed";
    input.style.left = "50%";
    input.style.top = "50%";
    input.style.transform = "translate(-50%, -50%)";
    input.style.zIndex = "999999";
    input.style.opacity = "1";

    document.body.appendChild(input);

    input.onchange = () => {
      if (!input.value) {
        input.remove();
        return;
      }

      const [year, month, day] = input.value.split("-").map(Number);

      const selected = new Date(
        year,
        month - 1,
        day,
        reminderDateValue.getHours(),
        reminderDateValue.getMinutes(),
        0,
        0,
      );

      setReminderDateValue(selected);
      input.remove();
    };

    input.addEventListener("cancel", () => input.remove());

    input.focus();

    if (typeof input.showPicker === "function") {
      input.showPicker();
    } else {
      input.click();
    }
  };

  const openReminderTimePicker = () => {
    const input = document.createElement("input");

    input.type = "time";
    input.value =
      `${String(reminderTimeValue.getHours()).padStart(2, "0")}:` +
      `${String(reminderTimeValue.getMinutes()).padStart(2, "0")}`;

    input.style.position = "fixed";
    input.style.left = "50%";
    input.style.top = "50%";
    input.style.transform = "translate(-50%, -50%)";
    input.style.zIndex = "999999";
    input.style.opacity = "1";

    document.body.appendChild(input);

    input.onchange = () => {
      if (!input.value) {
        input.remove();
        return;
      }

      const [hours, minutes] = input.value.split(":").map(Number);

      const selected = new Date(reminderTimeValue);
      selected.setHours(hours, minutes, 0, 0);

      setReminderTimeValue(selected);
      input.remove();
    };

    input.addEventListener("cancel", () => input.remove());

    input.focus();

    if (typeof input.showPicker === "function") {
      input.showPicker();
    } else {
      input.click();
    }
  };

  const formatReminderDate = (value: Date) =>
    `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
  const formatReminderTime = (value: Date) =>
    `${String(value.getHours()).padStart(2, "0")}:${String(value.getMinutes()).padStart(2, "0")}`;

  const saveReminderFromView = async () => {
    if (!reminderTodo || reminderBusy) return;

    const id = String(reminderTodo.tdlId || reminderTodo._id || "").trim();

    if (!id || id.startsWith("local-")) {
      showAppAlert(
        "Save the note first",
        "Reminders can be added after this note has been saved to your account.",
      );
      return;
    }

    // Build date and time directly from the selected Date objects.
    const selectedDate = new Date(reminderDateValue);
    const selectedTime = new Date(reminderTimeValue);

    if (
      Number.isNaN(selectedDate.getTime()) ||
      Number.isNaN(selectedTime.getTime())
    ) {
      showAppAlert(
        "Invalid reminder",
        "Please select a valid reminder date and time.",
      );
      return;
    }

    const currentDate = [
      selectedDate.getFullYear(),
      String(selectedDate.getMonth() + 1).padStart(2, "0"),
      String(selectedDate.getDate()).padStart(2, "0"),
    ].join("-");

    const currentTime = [
      String(selectedTime.getHours()).padStart(2, "0"),
      String(selectedTime.getMinutes()).padStart(2, "0"),
    ].join(":");

    const alarmLabel = selectedTime.toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    });

    // Combine the chosen calendar date and clock time in local time.
    const scheduledAt = new Date(
      selectedDate.getFullYear(),
      selectedDate.getMonth(),
      selectedDate.getDate(),
      selectedTime.getHours(),
      selectedTime.getMinutes(),
      0,
      0,
    );

    console.log("[Reminder] Device now:", new Date().toString());
    console.log("[Reminder] Selected date:", currentDate);
    console.log("[Reminder] Selected time:", currentTime);
    console.log("[Reminder] Scheduled date:", scheduledAt.toString());

    if (scheduledAt.getTime() <= Date.now()) {
      showAppAlert(
        "Choose a future time",
        "The selected reminder time has passed. Please choose a future date and time.",
      );
      return;
    }

    setReminderBusy(true);

    try {
      const currentToken =
        token || (await AsyncStorage.getItem("login_token")) || "";

      if (!currentToken) {
        throw new Error("Please sign in and try again.");
      }

      const headers = {
        Authorization: getAuthorizationHeader(currentToken),
      };

      const payload = {
        reminderDate: currentDate,
        reminderTime: currentTime,
        alarm: alarmLabel,
      };

      if (hasReminder(reminderTodo)) {
        await axios.post(
          `${API_BASE_URL}/api/editReminder/${encodeURIComponent(id)}`,
          payload,
          { headers, timeout: 15000 },
        );
      } else {
        await axios.post(
          `${API_BASE_URL}/api/addReminder/${encodeURIComponent(id)}`,
          payload,
          { headers, timeout: 15000 },
        );
      }

      // Keep existing date/time API endpoints in sync.
      await axios.post(
        `${API_BASE_URL}/api/setReminderDate/${encodeURIComponent(id)}`,
        { reminderDate: currentDate, date: currentDate },
        { headers, timeout: 15000 },
      );

      await axios.post(
        `${API_BASE_URL}/api/setReminderTime/${encodeURIComponent(id)}`,
        {
          reminderTime: currentTime,
          time: currentTime,
          alarm: alarmLabel,
        },
        { headers, timeout: 15000 },
      );

      let localNotificationError = "";

      try {
        await scheduleLocalReminderNotification(
          id,
          String(reminderTodo.title || "You have a task to do."),
          scheduledAt,
        );
      } catch (notificationError: any) {
        localNotificationError =
          notificationError?.message ||
          "The device notification could not be scheduled.";

        console.warn(
          "[Reminder] Local notification scheduling failed:",
          notificationError,
        );
      }

      const updated: Todo = {
        ...reminderTodo,
        reminderDate: currentDate,
        reminderTime: currentTime,
        alarm: alarmLabel,
        updatedAt: new Date().toISOString(),
      };

      setTodos((items) =>
        items.map((item) =>
          getTodoKey(item) === getTodoKey(reminderTodo) ? updated : item,
        ),
      );

      for (const key of ["view_todolist_cache", "local_todos"]) {
        try {
          const raw = await AsyncStorage.getItem(key);

          if (raw) {
            const parsed = JSON.parse(raw);

            if (Array.isArray(parsed)) {
              await AsyncStorage.setItem(
                key,
                JSON.stringify(
                  parsed.map((item: Todo) =>
                    getTodoKey(item) === getTodoKey(reminderTodo)
                      ? updated
                      : item,
                  ),
                ),
              );
            }
          }
        } catch (cacheError) {
          console.warn(
            `Could not update ${key} after saving reminder`,
            cacheError,
          );
        }
      }

      setReminderModalVisible(false);
      setReminderTodo(null);

      showAppAlert(
        localNotificationError
          ? "Reminder saved, notification not scheduled"
          : "Reminder saved",
        localNotificationError
          ? `The reminder was saved to your account, but this device could not schedule the notification. ${localNotificationError}`
          : `Reminder set for ${currentDate} at ${alarmLabel}.`,
      );
    } catch (error: any) {
      console.error(
        "[Reminder] Save failed:",
        error?.response?.data || error?.message || error,
      );

      showAppAlert(
        "Reminder failed",
        error?.response?.data?.message ||
          error?.message ||
          "Could not save this reminder.",
      );
    } finally {
      setReminderBusy(false);
    }
  };

  const handleSnooze = useCallback(
    async (todo: Todo, minutes: number) => {
      const id = String(todo.tdlId || "").trim();

      if (!id || id.startsWith("local-")) {
        showAppAlert(
          "Cannot snooze reminder",
          "This note is not saved to your account yet. Please save it first.",
        );
        return;
      }

      try {
        const currentToken =
          token || (await AsyncStorage.getItem("login_token")) || "";

        if (!currentToken) {
          throw new Error("Please sign in and try again.");
        }

        const response = await axios.post(
          `${API_BASE_URL}/api/snoozeReminder/${encodeURIComponent(id)}`,
          { minutes },
          {
            headers: {
              Authorization: getAuthorizationHeader(currentToken),
            },
            timeout: 15000,
          },
        );

        if (response.status !== 200 || response.data?.success === false) {
          throw new Error(
            response.data?.message || "Could not snooze this reminder.",
          );
        }

        // Use the server's updated reminder time when provided.
        const snoozeUntil =
          response.data?.reminderDate ||
          response.data?.snoozeUntil ||
          new Date(Date.now() + minutes * 60 * 1000).toISOString();

        // Cancel the old local notification.
        try {
          await cancelLocalReminderNotifications(id);
        } catch (notificationError) {
          console.warn(
            "[Reminder] Could not cancel old notification:",
            notificationError,
          );
        }

        const updated: Todo = {
          ...todo,
          reminderDate: snoozeUntil,
          reminderTime: new Date(snoozeUntil).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          }),
          alarm: snoozeUntil,
          updatedAt: new Date().toISOString(),
        };

        const targetKey = getTodoKey(todo);

        setTodos((items) =>
          items.map((item) =>
            getTodoKey(item) === targetKey ? { ...item, ...updated } : item,
          ),
        );

        // Update local caches.
        for (const key of ["view_todolist_cache", "local_todos"]) {
          try {
            const raw = await AsyncStorage.getItem(key);
            if (!raw) continue;

            const parsed = JSON.parse(raw);

            if (Array.isArray(parsed)) {
              await AsyncStorage.setItem(
                key,
                JSON.stringify(
                  parsed.map((item: Todo) =>
                    getTodoKey(item) === targetKey
                      ? { ...item, ...updated }
                      : item,
                  ),
                ),
              );
            }
          } catch (cacheError) {
            console.warn(`[Reminder] Could not update ${key}:`, cacheError);
          }
        }

        // Schedule the new local notification if your app uses local reminders.
        // Call your existing scheduling function here, if applicable.

        showAppAlert(
          "Reminder snoozed",
          `Your reminder has been snoozed for ${minutes} minutes.`,
        );
      } catch (error: any) {
        console.error(
          "[Reminder] Snooze failed:",
          error?.response?.data || error?.message || error,
        );

        showAppAlert(
          "Snooze failed",
          error?.response?.data?.message ||
            error?.message ||
            "Could not snooze this reminder.",
        );
      }
    },
    [token, getTodoKey],
  );

  const snoozeReminder = useCallback(
    (todo: Todo) => {
      showAppAlert(
        "Snooze reminder",
        `How long would you like to snooze “${todo.title || "Untitled note"}”?`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "5 minutes",
            onPress: () => handleSnooze(todo, 5),
          },
          {
            text: "10 minutes",
            onPress: () => handleSnooze(todo, 10),
          },
          {
            text: "15 minutes",
            onPress: () => handleSnooze(todo, 15),
          },
        ],
      );
    },
    [handleSnooze],
  );

  const deleteReminder = useCallback(
    (todo: Todo) => {
      const performDelete = async () => {
        const id = String(todo.tdlId || "").trim();

        if (!id || id.startsWith("local-")) {
          showAppAlert(
            "Cannot update reminder",
            "This note is not saved to your account yet. Open the note, clear its reminder, and save it.",
          );
          return;
        }

        try {
          const currentToken =
            token || (await AsyncStorage.getItem("login_token")) || "";

          if (!currentToken) {
            throw new Error("Please sign in and try again.");
          }

          const response = await axios.post(
            `${API_BASE_URL}/api/deleteReminder/${encodeURIComponent(id)}`,
            {},
            {
              headers: {
                Authorization: getAuthorizationHeader(currentToken),
              },
              timeout: 15000,
            },
          );

          if (response.status !== 200 || response.data?.success === false) {
            throw new Error(
              response.data?.message || "Could not delete this reminder.",
            );
          }

          // Cancel pending local notifications for this note.
          try {
            await cancelLocalReminderNotifications(id);
          } catch (notificationError) {
            console.warn(
              "[Reminder] Local notification cancellation failed:",
              notificationError,
            );
          }

          const cleared: Todo = {
            ...todo,
            alarm: null,
            reminderDate: null,
            reminderTime: null,
            recurring: "none",
            updatedAt: new Date().toISOString(),
          };

          const targetKey = getTodoKey(todo);

          // Update the current screen immediately.
          setTodos((items) =>
            items.map((item) =>
              getTodoKey(item) === targetKey ? { ...item, ...cleared } : item,
            ),
          );

          // Update locally cached notes.
          const cacheKeys = ["view_todolist_cache", "local_todos"];

          await Promise.all(
            cacheKeys.map(async (key) => {
              try {
                const raw = await AsyncStorage.getItem(key);
                if (!raw) return;

                const parsed = JSON.parse(raw);

                if (!Array.isArray(parsed)) return;

                const updated = parsed.map((item: Todo) =>
                  getTodoKey(item) === targetKey
                    ? { ...item, ...cleared }
                    : item,
                );

                await AsyncStorage.setItem(key, JSON.stringify(updated));
              } catch (cacheError) {
                console.warn(`[Reminder] Could not update ${key}:`, cacheError);
              }
            }),
          );

          showAppAlert(
            "Reminder deleted",
            "The reminder has been removed and its pending notifications cancelled.",
          );
        } catch (error: any) {
          console.error(
            "[Reminder] Delete failed:",
            error?.response?.data || error?.message || error,
          );

          showAppAlert(
            "Delete failed",
            error?.response?.data?.message ||
              error?.message ||
              "Could not delete this reminder.",
          );
        }
      };

      showAppAlert(
        "Delete reminder?",
        `Remove the reminder for “${todo.title || "Untitled note"}”? The note itself will remain.`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete reminder",
            style: "destructive",
            onPress: performDelete,
          },
        ],
      );
    },
    [token, getTodoKey],
  );

  const addTodo = (folderId?: string | null) => {
    const cleanFolderId = typeof folderId === "string" ? folderId.trim() : "";

    if (Platform.OS === "web") {
      setCreateChoiceFolderId(cleanFolderId || null);
      setCreateChoiceVisible(true);
      return;
    }

    const folderParams = cleanFolderId ? { folderId: cleanFolderId } : {};

    showAppAlert("Create new", "What would you like to create?", [
      {
        text: "Cancel",
        style: "cancel",
      },
      {
        text: "Quick Note",
        onPress: () =>
          router.push({
            pathname: "/quicknotes",
            params: {
              quickNote: "true",
              ...folderParams,
            },
          }),
      },
      {
        text: "Todo Task",
        onPress: () =>
          router.push({
            pathname: "/cretenote",
            params: {
              quickNote: "false",
              ...folderParams,
            },
          }),
      },
    ]);
  };

  const openQuickNote = () => {
    setCreateChoiceVisible(false);

    router.push({
      pathname: "/quicknotes",
      params: {
        quickNote: "true",
        ...(createChoiceFolderId ? { folderId: createChoiceFolderId } : {}),
      },
    });
  };

  const openTodoTask = () => {
    setCreateChoiceVisible(false);

    router.push({
      pathname: "/cretenote",
      params: {
        quickNote: "false",
        ...(createChoiceFolderId ? { folderId: createChoiceFolderId } : {}),
      },
    });
  };

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadTodos(false);
  }, [loadTodos]);

  // ==========================================================
  // DERIVED DATA
  // ==========================================================
  const filteredTodos = useMemo(() => {
    // Keep every derived list free of null rows, even if an older state update
    // or cached payload introduced one after the initial load.
    let result = (Array.isArray(todos) ? todos : []).filter(
      (todo): todo is Todo => !!todo && typeof todo === "object",
    );

    const searchText = search.trim().toLowerCase();
    if (searchText) {
      result = result.filter(
        (todo) =>
          String(todo.title || "")
            .toLowerCase()
            .includes(searchText) ||
          String(todo.text || "")
            .toLowerCase()
            .includes(searchText),
      );
    }

    if (filter !== "All")
      result = result.filter((todo) => todo.status === filter);

    result = result.filter((todo) => {
      const meta = organizationMeta[getTodoKey(todo)] || {};

      if (collectionFilter === "archived" && !meta.archived) return false;
      if (collectionFilter === "trash" && !meta.trashed) return false;
      if (collectionFilter !== "trash" && meta.trashed) return false;
      if (
        collectionFilter !== "archived" &&
        collectionFilter !== "trash" &&
        meta.archived
      )
        return false;
      if (
        !["all", "archived", "trash"].includes(collectionFilter) &&
        meta.folderId !== collectionFilter
      )
        return false;
      if (
        categoryFilter !== "all" &&
        !(meta.categoryIds || []).includes(categoryFilter)
      )
        return false;
      return true;
    });

    result.sort((a, b) => {
      const aKey = String(a.tdlId || a._id || "");
      const bKey = String(b.tdlId || b._id || "");

      const aTitleKey = String(a.title || "")
        .trim()
        .toLowerCase();
      const bTitleKey = String(b.title || "")
        .trim()
        .toLowerCase();

      const aMeta = quickNoteMeta[aKey] || quickNoteMeta[aTitleKey] || {};

      const bMeta = quickNoteMeta[bKey] || quickNoteMeta[bTitleKey] || {};

      // 1. Pinned notes always appear first
      const aPinned =
        pinnedIds.includes(aKey) || aMeta.quickNotePinned === true;

      const bPinned =
        pinnedIds.includes(bKey) || bMeta.quickNotePinned === true;

      if (aPinned !== bPinned) {
        return aPinned ? -1 : 1;
      }

      // 2. Quick Notes appear before regular notes
      const aQuick = aMeta.isQuickNote === true;
      const bQuick = bMeta.isQuickNote === true;

      if (aQuick !== bQuick) {
        return aQuick ? -1 : 1;
      }

      // 3. Apply the selected sort option
      switch (sortBy) {
        case "title":
          return String(a.title || "").localeCompare(
            String(b.title || ""),
            undefined,
            { sensitivity: "base" },
          );

        case "modified": {
          const aTime = new Date(a.updatedAt || a.createdAt || 0).getTime();

          const bTime = new Date(b.updatedAt || b.createdAt || 0).getTime();

          const safeATime = Number.isFinite(aTime) ? aTime : 0;
          const safeBTime = Number.isFinite(bTime) ? bTime : 0;

          // Most recently modified first
          return safeBTime - safeATime;
        }

        case "priority": {
          const rank: Record<string, number> = {
            High: 3,
            Medium: 2,
            Low: 1,
          };

          const aPriority = organizationMeta[getTodoKey(a)]?.priority || "";

          const bPriority = organizationMeta[getTodoKey(b)]?.priority || "";

          return (rank[bPriority] || 0) - (rank[aPriority] || 0);
        }

        case "date":
        default: {
          const aTime = a.date
            ? new Date(a.date).getTime()
            : Number.MAX_SAFE_INTEGER;

          const bTime = b.date
            ? new Date(b.date).getTime()
            : Number.MAX_SAFE_INTEGER;

          const safeATime = Number.isFinite(aTime)
            ? aTime
            : Number.MAX_SAFE_INTEGER;

          const safeBTime = Number.isFinite(bTime)
            ? bTime
            : Number.MAX_SAFE_INTEGER;

          // Earliest date first; notes without a date appear last
          return safeATime - safeBTime;
        }
      }
    });

    return result;
  }, [
    todos,
    search,
    filter,
    pinnedIds,
    sortBy,
    quickNoteMeta,
    organizationMeta,
    collectionFilter,
    categoryFilter,
    getTodoKey,
  ]);

  const quickNoteTodos = useMemo(
    () =>
      filteredTodos.filter(
        (todo) => getQuickNoteMeta(todo).isQuickNote === true,
      ),
    [filteredTodos, getQuickNoteMeta],
  );
  const regularTodos = useMemo(
    () =>
      filteredTodos.filter(
        (todo) => getQuickNoteMeta(todo).isQuickNote !== true,
      ),
    [filteredTodos, getQuickNoteMeta],
  );

  // Counts only cover active notes (not archived / trashed).
  const counts = useMemo(() => {
    const active = todos.filter((todo) => {
      if (!todo || typeof todo !== "object") return false;
      const meta = organizationMeta[getTodoKey(todo)] || {};
      return !meta.trashed && !meta.archived;
    });
    return {
      all: active.length,
      today: active.filter((t) => t.status === "Today").length,
      upcoming: active.filter((t) => t.status === "Upcoming").length,
      completed: active.filter((t) => t.status === "Completed").length,
    };
  }, [todos, organizationMeta, getTodoKey]);

  const progress =
    counts.all > 0 ? Math.round((counts.completed / counts.all) * 100) : 0;

  const collectionLabel = useMemo(() => {
    if (collectionFilter === "all") return null;

    if (collectionFilter === "archived") return "Archived";
    if (collectionFilter === "trash") return "Trash";
    return noteFolders.find((f) => f.id === collectionFilter)?.name || null;
  }, [collectionFilter, noteFolders]);

  // Pass a folder ID only when the current collection is an actual folder.
  // For All, Archived, Trash, or any non-folder view, omit folderId entirely.
  const activeFolderId = useMemo(
    () =>
      noteFolders.some((folder) => folder.id === collectionFilter)
        ? collectionFilter
        : undefined,
    [noteFolders, collectionFilter],
  );

  const sortLabel = {
    date: "Date",
    title: "Title",
    modified: "Modified",
    priority: "Priority",
  }[sortBy];
  const cycleSort = () =>
    setSortBy((v) =>
      v === "date"
        ? "title"
        : v === "title"
          ? "modified"
          : v === "modified"
            ? "priority"
            : "date",
    );

  // ==========================================================
  // SHARE NOTE
  // ==========================================================
  // Read note content from common legacy field names as well as `text`.
  // Some older notes may store their body under `content` or `description`.

  const getShareableNoteText = useCallback(
    (todo: Todo, includeDetails = false) => {
      const data = todo as Todo & Record<string, any>;

      const title = String(data.title || data.name || "Untitled note").trim();

      const rawDescription = data.description ?? data.desc ?? "";

      const description =
        typeof rawDescription === "string"
          ? rawDescription.trim()
          : String(rawDescription || "").trim();

      const rawBody = data.text ?? data.content ?? data.note ?? data.body ?? "";

      const body =
        typeof rawBody === "string"
          ? rawBody.trim()
          : String(rawBody || "").trim();

      const lines: string[] = [
        `Title: ${title}`,
        ...(description ? ["", `Description: ${description}`] : []),
        ...(body ? ["", body] : []),
      ];

      if (includeDetails) {
        lines.push("", "──────────────", "📋 Note Details");

        // Date
        if (data.date) {
          lines.push(`📅 Date: ${formatTodoDate(data.date)}`);
        }

        // Status
        if (data.status) {
          lines.push(`📌 Status: ${data.status}`);
        }

        // Reminder
        const reminder = getTodoReminder(todo);
        if (reminder) {
          lines.push(`⏰ Reminder: ${reminder}`);
        }

        // Tags
        const tags = getOrganizationMeta(todo).tags || [];
        if (tags.length > 0) {
          lines.push(`🏷️ Tags: ${tags.join(", ")}`);
        }

        // Additional fields, when available
        if (data.category) {
          lines.push(`📂 Category: ${data.category}`);
        }

        if (data.folderName || data.folder) {
          lines.push(`📁 Folder: ${data.folderName || data.folder}`);
        }

        if (data.priority) {
          lines.push(`⚡ Priority: ${data.priority}`);
        }

        if (data.createdAt) {
          lines.push(`🗓️ Created: ${formatTodoDate(data.createdAt)}`);
        }

        if (data.updatedAt) {
          lines.push(`🔄 Updated: ${formatTodoDate(data.updatedAt)}`);
        }

        if (data.completedAt) {
          lines.push(`✅ Completed: ${formatTodoDate(data.completedAt)}`);
        }

        lines.push("", "Shared from Notes");
      }

      return lines.join("\n").trim();
    },
    [getOrganizationMeta],
  );

  const shareNoteAsText = useCallback(
    async (todo: Todo) => {
      if (todo.locked) {
        showAppAlert("Note locked", "Unlock this note before sharing it.");
        return;
      }
      const message = getShareableNoteText(todo, false);
      if (!message.trim()) {
        showAppAlert(
          "Nothing to share",
          "This note does not contain any text yet.",
        );
        return;
      }
      try {
        await Share.share({
          message,
          title: String(todo.title || "Untitled note"),
        });
      } catch (error: any) {
        showAppAlert(
          "Share failed",
          error?.message || "Could not share this note.",
        );
      }
    },
    [getShareableNoteText],
  );

  const copyTextToClipboard = async (text: string): Promise<void> => {
    // Preferred clipboard API (Electron / modern browsers)
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }

    // Fallback for Electron environments
    const textarea = document.createElement("textarea");

    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    textarea.style.top = "0";

    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();

    const copied = document.execCommand("copy");
    document.body.removeChild(textarea);

    if (!copied) {
      throw new Error("Could not copy text to clipboard.");
    }
  };

  const shareNoteThroughOtherApps = useCallback(
    async (todo: Todo) => {
      const showShareMessage = (title: string, message: string) => {
        showAppAlert(title, message);
      };

      if (todo.locked) {
        showShareMessage("Note locked", "Unlock this note before sharing it.");
        return;
      }

      const text = getShareableNoteText(todo, false);

      if (!text.trim()) {
        showShareMessage(
          "Nothing to share",
          "This note does not contain any text yet.",
        );
        return;
      }

      // Android/iOS use the native share sheet. Desktop opens our custom app picker.
      if (Platform.OS !== "web") {
        try {
          await Share.share({
            message: text,
            title: String(todo.title || "Untitled note"),
          });
        } catch (error: any) {
          showShareMessage(
            "Share failed",
            error?.message || "Could not share this note.",
          );
        }
        return;
      }

      setShareText(text);
      setShareDialogVisible(true);
    },
    [getShareableNoteText],
  );

  const changeTodoStatus = (todo: Todo) => {
    if (!todo || todo.locked) return;
    setStatusTodo(todo);
  };

  const updateTodoStatus = async (
    todo: Todo,
    nextStatus: "Today" | "Upcoming" | "Completed",
  ) => {
    if (!todo || statusBusy) return;

    const id = String(todo.tdlId || todo._id || "").trim();
    const isLocalOnly =
      todo.isLocalDuplicate === true || !id || id.startsWith("local-");

    setStatusBusy(true);
    try {
      let updatedTodo: Todo = {
        ...todo,
        status: nextStatus,
        updatedAt: new Date().toISOString(),
      };

      if (!isLocalOnly) {
        const currentToken =
          token || (await AsyncStorage.getItem("login_token")) || "";
        if (!currentToken) {
          throw new Error("Please sign in and try again.");
        }

        const response = await axios.put(
          `${API_BASE_URL}/api/updateTdlStatus/${encodeURIComponent(id)}`,
          { status: nextStatus },
          {
            headers: {
              Authorization: getAuthorizationHeader(currentToken),
              "Content-Type": "application/json",
            },
            timeout: 15000,
          },
        );

        if (response.status !== 200 || response.data?.success === false) {
          throw new Error(
            response.data?.message || "Could not update task status.",
          );
        }

        const serverTask =
          response.data?.data?.data ??
          response.data?.data?.task ??
          response.data?.data;
        if (serverTask && typeof serverTask === "object") {
          updatedTodo = { ...todo, ...serverTask, status: nextStatus };
        }
      }

      const targetKey = getTodoKey(todo);
      setTodos((items) =>
        items.map((item) =>
          item && getTodoKey(item) === targetKey ? updatedTodo : item,
        ),
      );

      // Keep the list cache and local-only duplicate storage in sync.
      const cacheKeys = isLocalOnly
        ? ["local_todos", "view_todolist_cache"]
        : ["view_todolist_cache"];
      await Promise.all(
        cacheKeys.map(async (key) => {
          try {
            const raw = await AsyncStorage.getItem(key);
            if (!raw) return;
            const parsed = JSON.parse(raw);
            if (!Array.isArray(parsed)) return;
            const next = parsed.map((item: Todo | null) =>
              item && getTodoKey(item) === targetKey ? updatedTodo : item,
            );
            await AsyncStorage.setItem(key, JSON.stringify(next));
          } catch (cacheError) {
            console.warn(`[Status] Could not update ${key}:`, cacheError);
          }
        }),
      );

      setStatusTodo(null);
      showAppAlert("Status updated", `Task moved to ${nextStatus}.`);
    } catch (error: any) {
      console.error(
        "[Status] Update failed:",
        error?.response?.data || error?.message || error,
      );
      const message =
        error?.response?.data?.message ||
        error?.message ||
        "Could not update task status.";
      showAppAlert("Status update failed", message);
    } finally {
      setStatusBusy(false);
    }
  };

  const shareWithDesktopApp = async (
    appName: "whatsapp" | "gmail" | "outlook" | "telegram",
  ) => {
    try {
      const desktopShare = (window as any).electronShare;

      if (desktopShare?.openApp) {
        await desktopShare.openApp(appName, shareText);
      } else {
        const urls: Record<typeof appName, string> = {
          whatsapp: "https://web.whatsapp.com/send?text=",
          gmail: "https://mail.google.com/mail/?view=cm&fs=1&body=",
          outlook: "https://outlook.live.com/mail/0/deeplink/compose?body=",
          telegram: "https://t.me/share/url?url=&text=",
        };

        window.open(
          urls[appName] + encodeURIComponent(shareText),
          "_blank",
          "noopener,noreferrer",
        );
      }

      setShareDialogVisible(false);
    } catch (error: any) {
      showAppAlert(
        "Share failed",
        error?.message || "Unable to open the sharing app.",
      );
    }
  };

  const copyShareText = async () => {
    try {
      const desktopShare = (window as any).electronShare;

      if (Platform.OS === "web" && desktopShare?.copyText) {
        await desktopShare.copyText(shareText);
      } else if (Platform.OS === "web" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareText);
      } else {
        throw new Error("Clipboard is not available.");
      }

      setShareDialogVisible(false);
      showAppAlert("Copied", "Note copied successfully.");
    } catch (error: any) {
      showAppAlert("Copy failed", error?.message || "Unable to copy note.");
    }
  };

  // ==========================================================
  // ACTION SHEET CONTENT
  // ==========================================================
  const buildSheetActions = (todo: Todo): SheetAction[] => {
    const meta = getOrganizationMeta(todo);
    const quick = getQuickNoteMeta(todo);
    const id = getTodoKey(todo);
    const pinned = pinnedIds.includes(id) || quick.quickNotePinned === true;

    if (meta.trashed) {
      return [
        {
          key: "restore",
          label: "Restore",
          icon: "refresh",
          color: C.done,
          bg: "#DDF7F3",
          onPress: () => restoreFromTrash(todo),
        },
        {
          key: "forever",
          label: "Delete forever",
          icon: "trash-bin",
          color: C.danger,
          bg: C.dangerSoft,
          onPress: () => permanentlyDeleteTodo(todo),
        },
      ];
    }

    // A locked note exposes only security actions. Details, edit, duplicate and
    // organization actions are intentionally unavailable until it is unlocked.
    if (todo.locked) {
      return [
        {
          key: "security",
          label: "Unlock note",
          icon: "lock-open-outline",
          color: C.done,
          bg: "#DDF7F3",
          onPress: () => openLockDialog(todo, "unlock"),
        },
        {
          key: "changePin",
          label: "Change PIN",
          icon: "key-outline",
          color: "#B45309",
          bg: "#FEF3C7",
          onPress: () => openLockDialog(todo, "changePin"),
        },
      ];
    }

    const list: SheetAction[] = [
      {
        key: "shareApps",
        label: "Share with apps",
        icon: "share-social-outline",
        color: "#0F766E",
        bg: "#D5F5EF",
        onPress: () => void shareNoteThroughOtherApps(todo),
      },
      {
        key: "security",
        label: todo.locked ? "Unlock note" : "Lock note",
        icon: todo.locked ? "lock-open-outline" : "lock-closed-outline",
        color: "#7C3AED",
        bg: "#EDE9FE",
        onPress: () => openLockDialog(todo, todo.locked ? "unlock" : "lock"),
      },
      {
        key: "edit",
        label: "Edit",
        icon: "create-outline",
        color: C.primary,
        bg: C.primarySoft,
        onPress: () => {
          if (todo.locked) {
            showAppAlert("Note locked", "Unlock this note before editing it.");
          } else {
            editTodo(todo);
          }
        },
      },

      {
        key: "changeStatus",
        label: "Change status",
        icon: "swap-horizontal-outline",
        color: "#0F766E",
        bg: "#D5F5EF",
        onPress: () => changeTodoStatus(todo),
      },

      // Add or edit reminder
      {
        key: "addReminder",
        label: hasReminder(todo) ? "Edit reminder" : "Add reminder",
        icon: "alarm-outline",
        color: C.today,
        bg: "#E6F0FF",
        onPress: () => openReminderEditor(todo),
      },

      // Delete reminder only when one exists
      ...(hasReminder(todo)
        ? [
            {
              key: "deleteReminder",
              label: "Delete reminder",
              icon: "notifications-off-outline",
              color: C.danger,
              bg: C.dangerSoft,
              onPress: () => deleteReminder(todo),
            } as SheetAction,
            {
              key: "snoozeReminder",
              label: "Snooze 10 min",
              icon: "time-outline",
              color: "#B45309",
              bg: "#FEF3C7",
              onPress: () => snoozeReminder(todo),
            } as SheetAction,
          ]
        : []),

      // Duplicate
      {
        key: "duplicate",
        label: "Duplicate",
        icon: "copy-outline",
        color: C.sub,
        bg: C.chip,
        onPress: () => void duplicateTodo(todo),
      },

      // Move to trash
      {
        key: "trash",
        label: "Trash",
        icon: "trash-outline",
        color: C.danger,
        bg: C.dangerSoft,
        onPress: () => moveToTrash(todo),
      },

      {
        key: "pin",
        label: pinned ? "Unpin" : "Pin",
        icon: pinned ? "pin" : "pin-outline",
        color: isDark ? "#8DE8C4" : "#16866B",
        bg: isDark ? "#294B3D" : "#C9EFDF",
        onPress: () => void togglePin(todo),
      },
      {
        key: "folder",
        label: "Move to folder",
        icon: "folder-open-outline",
        color: C.today,
        bg: "#E6F0FF",
        onPress: () => chooseFolderForNote(todo),
      },

      {
        key: "tags",
        label: "Tags",
        icon: "pricetags-outline",
        color: "#0F766E",
        bg: "#D5F5EF",
        onPress: () => manageTags(todo),
      },

      {
        key: "priority",
        label: "Priority",
        icon: "flag-outline",
        color: "#B45309",
        bg: "#FEF3C7",
        onPress: () => choosePriority(todo),
      },

      {
        key: "archive",
        label: meta.archived ? "Unarchive" : "Archive",
        icon: meta.archived ? "archive" : "archive-outline",
        color: C.sub,
        bg: C.chip,
        onPress: () =>
          void updateNoteMeta(todo, {
            archived: !meta.archived,
            trashed: false,
          }),
      },
    ];
    if (quick.isQuickNote) {
      list.push({
        key: "convert",
        label: "Make a Todo",
        icon: "checkbox-outline",
        color: C.primary,
        bg: C.primarySoft,
        onPress: () => void convertQuickNoteToTodo(todo),
      });
    }

    return list;
  };

  // ==========================================================
  // RENDER: MEDIA
  // ==========================================================

  const renderMedia = (todo: Todo) => {
    const fileIds = Array.isArray(todo.fileIds) ? todo.fileIds : [];
    if (fileIds.length === 0) return null;

    const rawTodo = todo as Todo & Record<string, unknown>;
    const typeSource =
      (Array.isArray(rawTodo.fileTypes) && rawTodo.fileTypes) ||
      (Array.isArray(rawTodo.attachmentTypes) && rawTodo.attachmentTypes) ||
      (Array.isArray(rawTodo.mimeTypes) && rawTodo.mimeTypes) ||
      (Array.isArray(todo.type) && todo.type) ||
      (typeof todo.type === "string" && todo.type.toLowerCase() !== "todo"
        ? [todo.type]
        : []);
    const rawTypes = typeSource as unknown[];
    const rawNames =
      (Array.isArray(rawTodo.fileNames) && rawTodo.fileNames) ||
      (Array.isArray(rawTodo.attachmentNames) && rawTodo.attachmentNames) ||
      [];

    const getType = (index: number) => {
      const type = String(rawTypes[index] ?? rawTypes[0] ?? "")
        .toLowerCase()
        .trim();
      const name = String(rawNames[index] ?? "")
        .toLowerCase()
        .trim();
      const candidate = type || name;
      if (
        candidate.startsWith("image") ||
        /\.(png|jpe?g|gif|webp|bmp|heic|heif|avif)$/i.test(candidate)
      )
        return "image";
      if (
        candidate.startsWith("audio") ||
        candidate === "webm-audio" ||
        /\.(mp3|m4a|aac|wav|ogg|opus|flac)$/i.test(candidate) ||
        (/\.webm$/i.test(candidate) &&
          /(voice|audio|recording|record|mic|speech)/i.test(candidate))
      )
        return "audio";
      if (
        candidate.startsWith("video") ||
        /\.(mp4|mov|mkv|webm|avi|3gp|m4v)$/i.test(candidate)
      )
        return "video";
      return "file";
    };

    const firstType = getType(0);
    if (firstType === "audio" && Platform.OS === "web") {
      return (
        <View style={[styles.mediaContainer, { padding: 8 }]}>
          <DetailsAudioPlayer
            uri={`${API_BASE_URL.replace(/\/+$/, "")}/api/media/${encodeURIComponent(String(fileIds[0]))}`}
            title={rawNames[0] ? String(rawNames[0]) : "Voice note"}
          />
          {fileIds.length > 1 && (
            <Text style={styles.attachmentTitle}>
              +{fileIds.length - 1} more attachment(s)
            </Text>
          )}
        </View>
      );
    }

    if (firstType === "image") {
      return (
        <View style={styles.mediaContainer}>
          <Image
            source={{
              uri: `${API_BASE_URL.replace(/\/+$/, "")}/api/media/${encodeURIComponent(String(fileIds[0]))}`,
            }}
            style={styles.todoImage}
            resizeMode="cover"
            onError={(event) =>
              console.warn(
                "Todo image failed to load:",
                event.nativeEvent.error,
              )
            }
          />
          {fileIds.length > 1 && (
            <View style={styles.mediaCount}>
              <Ionicons name="images" size={12} color="#FFFFFF" />
              <Text style={styles.mediaCountText}>{fileIds.length}</Text>
            </View>
          )}
        </View>
      );
    }

    const mediaInfo = {
      audio: { icon: "mic", label: "Voice note" },
      video: { icon: "videocam", label: "Video" },
      file: { icon: "document-text", label: "File" },
    } as const;
    const info =
      mediaInfo[firstType as keyof typeof mediaInfo] ?? mediaInfo.file;

    return (
      <View style={styles.attachmentRow}>
        <View style={styles.attachmentIcon}>
          <Ionicons name={info.icon as any} size={16} color={C.primary} />
        </View>
        <Text style={styles.attachmentTitle}>
          {rawNames[0] ? String(rawNames[0]) : info.label}
          {fileIds.length > 1 ? `  +${fileIds.length - 1}` : ""}
        </Text>
      </View>
    );
  };

  // ==========================================================
  // RENDER: CARD
  // ==========================================================
  const renderTodo = ({ item }: { item: Todo | null }) => {
    // Defensive guard: API/local cache data can occasionally contain null rows.
    // FlatList may still call renderItem for such a row, so never read item.title
    // or any other property until the item has been validated.
    if (!item || typeof item !== "object") return null;

    const status = getStatusMeta(item.status, isDark, C);
    const noteMeta = getQuickNoteMeta(item);
    const isQuickNote = noteMeta.isQuickNote === true;
    const itemId = getTodoKey(item);
    const isPinned =
      pinnedIds.includes(itemId) || noteMeta.quickNotePinned === true;
    const organization = getOrganizationMeta(item);

    // Use a deterministic color based on the note ID, not its list position.
    // This keeps each card's border color stable when sorting or refreshing.
    const cardColorIndex =
      Array.from(itemId || String(item.title || "note")).reduce(
        (total, char) => total + char.charCodeAt(0),
        0,
      ) % CARD_BORDER_COLORS.length;
    const cardBorderColor =
      organization.noteColor || CARD_BORDER_COLORS[cardColorIndex];
    const folderName = noteFolders.find(
      (folder) => folder.id === organization.folderId,
    )?.name;
    const isTrashed = organization.trashed === true;
    const priority = organization.priority
      ? PRIORITY_STYLE[organization.priority]
      : null;

    const savedTheme = isQuickNote ? noteMeta.quickNoteTheme : undefined;
    // Support both theme objects and the standalone fields saved by older editor versions.
    const themeImageUri =
      (savedTheme?.kind === "image" && typeof savedTheme.uri === "string"
        ? savedTheme.uri
        : undefined) ||
      (typeof noteMeta.backgroundImageUri === "string"
        ? noteMeta.backgroundImageUri
        : undefined);
    const backgroundId =
      organization.noteBackgroundImage || noteMeta.noteBackgroundImage;
    const selectedBackground = NOTE_BACKGROUND_IMAGES.find(
      (image) => image.id === backgroundId,
    )?.source;
    const useSavedThemeImage = !selectedBackground && !!themeImageUri;
    const useSavedGradient =
      !selectedBackground &&
      !useSavedThemeImage &&
      savedTheme?.kind === "gradient" &&
      Array.isArray(savedTheme.colors) &&
      savedTheme.colors.length >= 2;
    const savedThemeColor =
      savedTheme?.bg ||
      savedTheme?.colors?.[0] ||
      noteMeta.quickNoteColor ||
      defaultNoteColor;
    const activePattern = String(
      savedTheme?.pattern ||
        noteMeta.notePattern ||
        organization.notePattern ||
        "plain",
    )
      .toLowerCase()
      .trim();
    const CardContainer: any =
      selectedBackground || useSavedThemeImage
        ? ImageBackground
        : useSavedGradient
          ? LinearGradient
          : View;
    const cardContainerProps: any = selectedBackground
      ? {
          source: selectedBackground,
          imageStyle: {
            borderRadius:
              notebookStyle === "classic"
                ? 8
                : notebookStyle === "minimal"
                  ? 14
                  : 20,
          },
          resizeMode: "cover",
        }
      : useSavedThemeImage
        ? {
            source: { uri: themeImageUri },
            imageStyle: {
              borderRadius:
                notebookStyle === "classic"
                  ? 8
                  : notebookStyle === "minimal"
                    ? 14
                    : 20,
            },
            resizeMode: "cover",
          }
        : useSavedGradient
          ? {
              colors: savedTheme.colors,
              start: { x: 0, y: 0 },
              end: { x: 1, y: 1 },
            }
          : {};

    return (
      <Pressable
        onPress={() => {
          // Tapping anywhere on the note card opens the full details view.
          // The dedicated ellipsis button still opens the actions menu.
          if (item.locked) {
            showAppAlert(
              "Note locked",
              "Unlock this note before viewing its details.",
            );
            return;
          }
          void showDetails(item);
        }}
        accessibilityRole="button"
        accessibilityLabel={`Open details for ${item.title || "Untitled note"}`}
        style={[
          styles.card,
          isDesktop && styles.desktopCard,
          {
            position: "relative",
            minHeight: 150,
            padding: 18,
            borderRadius: 16,

            backgroundColor:
              selectedBackground || useSavedThemeImage
                ? isDark
                  ? "rgba(25,42,34,0.72)"
                  : "rgba(255,255,255,0.48)"
                : isDark && isQuickNote && !useSavedGradient
                  ? C.surface
                  : isDark &&
                      !organization.noteColor &&
                      !isQuickNote &&
                      defaultNoteColor === "#FFF8DC"
                    ? C.surface
                    : savedThemeColor,

            borderColor:
              selectedBackground || useSavedThemeImage
                ? isDark
                  ? "rgba(168,196,179,0.72)"
                  : "rgba(0,0,0,0.45)"
                : isDark && isQuickNote && !useSavedGradient
                  ? C.line
                  : isDark &&
                      !organization.noteColor &&
                      !isQuickNote &&
                      defaultNoteColor === "#FFF8DC"
                    ? C.line
                    : savedThemeColor,

            borderWidth: 1.8,
          },

          appTheme === "dark" &&
            !organization.noteColor &&
            !isQuickNote &&
            defaultNoteColor === "#FFF8DC" && {
              backgroundColor: C.surface,
              borderColor: C.line,
            },
        ]}
      >
        {/* Pattern overlay is anchored to the full note card, not the
          intrinsic content width of ImageBackground/LinearGradient. */}
        {activePattern !== "plain" && (
          <View pointerEvents="none" style={styles.notePatternOverlay}>
            {(() => {
              const raw = String(activePattern || "plain")
                .toLowerCase()
                .trim();
              const aliases: Record<string, string> = {
                line: "stripes",
                lines: "stripes",
                lined: "stripes",
                dot: "dots",
                dotted: "dots",
                hearts: "heart",
                stars: "star",
                flowers: "flower",
                leaves: "leaf",
                checks: "checker",
                checkered: "checker",
              };
              const pattern = aliases[raw] || raw;
              const backgroundHex = String(savedThemeColor || "#FFFFFF")
                .trim()
                .replace("#", "");
              const normalizedHex =
                backgroundHex.length === 3
                  ? backgroundHex
                      .split("")
                      .map((value) => value + value)
                      .join("")
                  : backgroundHex;
              const rgb = /^[0-9a-fA-F]{6}$/.test(normalizedHex)
                ? [
                    parseInt(normalizedHex.slice(0, 2), 16),
                    parseInt(normalizedHex.slice(2, 4), 16),
                    parseInt(normalizedHex.slice(4, 6), 16),
                  ]
                : [255, 255, 255];
              const luminance =
                (0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]) / 255;
              const ink =
                luminance < 0.42
                  ? "rgba(255,255,255,0.62)"
                  : "rgba(31,41,55,0.30)";
              const rows = Array.from({ length: 12 });
              const cols = Array.from({ length: 40 });
              const glyph =
                pattern === "heart"
                  ? "♥"
                  : pattern === "star"
                    ? "★"
                    : pattern === "flower"
                      ? "✿"
                      : pattern === "leaf"
                        ? "❧"
                        : "";

              if (glyph) {
                return (
                  <View style={styles.savedThemeMotifGrid}>
                    {rows.map((_, row) =>
                      cols.map((__, col) => (
                        <Text
                          key={`${pattern}-${row}-${col}`}
                          style={{
                            position: "absolute",
                            left: `${(col / (cols.length - 1)) * 98}%`,
                            top: `${(row / (rows.length - 1)) * 94}%`,
                            color: ink,
                            fontSize: 17,
                            lineHeight: 22,
                            opacity: 0.72,
                          }}
                        >
                          {glyph}
                        </Text>
                      )),
                    )}
                  </View>
                );
              }

              if (pattern === "dots") {
                return (
                  <View style={styles.savedThemeMotifGrid}>
                    {rows.map((_, row) =>
                      cols.map((__, col) => (
                        <View
                          key={`dot-${row}-${col}`}
                          style={{
                            position: "absolute",
                            left: `${(col / (cols.length - 1)) * 98}%`,
                            top: `${(row / (rows.length - 1)) * 94}%`,
                            width: 4,
                            height: 4,
                            borderRadius: 3,
                            backgroundColor: ink,
                            opacity: 0.8,
                          }}
                        />
                      )),
                    )}
                  </View>
                );
              }

              if (pattern === "grid" || pattern === "checker") {
                return (
                  <View style={styles.savedThemeMotifGrid}>
                    {pattern === "grid" ? (
                      <>
                        {Array.from({ length: 42 }).map((_, i) => (
                          <View
                            key={`gv-${i}`}
                            style={{
                              position: "absolute",
                              top: 0,
                              bottom: 0,
                              left: `${(i / 42) * 100}%`,
                              width: 1,
                              backgroundColor: ink,
                              opacity: 0.55,
                            }}
                          />
                        ))}
                        {Array.from({ length: 14 }).map((_, i) => (
                          <View
                            key={`gh-${i}`}
                            style={{
                              position: "absolute",
                              left: 0,
                              right: 0,
                              top: `${(i / 14) * 100}%`,
                              height: 1,
                              backgroundColor: ink,
                              opacity: 0.55,
                            }}
                          />
                        ))}
                      </>
                    ) : (
                      rows.map((_, row) =>
                        cols.map((__, col) =>
                          (row + col) % 2 === 0 ? (
                            <View
                              key={`checker-${row}-${col}`}
                              style={{
                                position: "absolute",
                                left: `${(col / cols.length) * 100}%`,
                                top: `${(row / rows.length) * 100}%`,
                                width: `${100 / cols.length}%`,
                                height: `${100 / rows.length}%`,
                                backgroundColor: ink,
                                opacity: 0.32,
                              }}
                            />
                          ) : null,
                        ),
                      )
                    )}
                  </View>
                );
              }

              if (pattern === "stripes") {
                return (
                  <View style={styles.savedThemeMotifGrid}>
                    {Array.from({ length: 16 }).map((_, i) => (
                      <View
                        key={`stripe-${i}`}
                        style={{
                          position: "absolute",
                          left: 0,
                          right: 0,
                          top: `${(i / 16) * 100}%`,
                          height: 1,
                          backgroundColor: ink,
                          opacity: 0.5,
                        }}
                      />
                    ))}
                  </View>
                );
              }
              return null;
            })()}
          </View>
        )}

        <CardContainer
          {...cardContainerProps}
          style={{
            flex: 1,
            width: "100%",
            alignSelf: "stretch",
            backgroundColor: "transparent",
            position: "relative",
            zIndex: 1,
          }}
        >
          {/* Title row */}
          <View style={styles.cardTop}>
            <View style={{ flex: 1, minWidth: 0 }}>
              {/* Title + Copy badge */}
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  flexWrap: "wrap",
                }}
              >
                <Text
                  numberOfLines={2}
                  style={[
                    styles.cardTitle,
                    {
                      // Quick Note title uses a theme-aware high-contrast ink color.
                      color: isQuickNote
                        ? isDark
                          ? "#D6E2DA"
                          : "#102B20"
                        : C.ink,
                    },
                    {
                      fontSize:
                        noteFontSize === "small"
                          ? 14
                          : noteFontSize === "large"
                            ? 19
                            : 16.5,
                      fontFamily:
                        noteFontFamily === "System"
                          ? undefined
                          : noteFontFamily,
                    },
                  ]}
                >
                  {item.locked ? "Locked note" : item.title || "Untitled note"}
                </Text>

                {!item.locked && item.isLocalDuplicate && (
                  <View
                    style={{
                      marginLeft: 6,
                      paddingHorizontal: 7,
                      paddingVertical: 3,
                      borderRadius: 6,
                      backgroundColor:
                        appTheme === "dark" ? "#064E3B" : "#D1FAE5",
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 10,
                        fontWeight: "700",
                        color: appTheme === "dark" ? "#A7F3D0" : "#047857",
                      }}
                    >
                      Copy
                    </Text>
                  </View>
                )}
              </View>

              {/* Recurring reminder indicator */}
              {item.recurring && item.recurring !== "none" && (
                <View style={styles.recurringBadge}>
                  <Ionicons
                    name="repeat"
                    size={13}
                    color={appTheme === "dark" ? "#A78BFA" : "#6D28D9"}
                  />

                  <Text
                    style={[
                      styles.recurringBadgeText,
                      appTheme === "dark" && { color: "#C4B5FD" },
                    ]}
                  >
                    {item.recurring.charAt(0).toUpperCase() +
                      item.recurring.slice(1)}
                  </Text>
                </View>
              )}
            </View>

            {isPinned && <Text style={{ fontSize: 15, marginTop: 3 }}>📌</Text>}

            {item.locked && (
              <Ionicons
                name="lock-closed"
                size={15}
                color="#7C3AED"
                style={{ marginTop: 3 }}
              />
            )}

            <Pressable
              hitSlop={8}
              style={styles.iconBtn}
              onPress={() => setActionTodo(item)}
              accessibilityLabel="More actions"
            >
              <Ionicons name="ellipsis-horizontal" size={18} color={C.sub} />
            </Pressable>
          </View>

          {/* Chips */}
          <View style={styles.chipRow}>
            <View style={[styles.pill, { backgroundColor: status.bg }]}>
              <View
                style={[styles.pillDot, { backgroundColor: status.color }]}
              />
              <Text style={[styles.pillText, { color: status.color }]}>
                {item.status || "Todo"}
              </Text>
            </View>
            {isQuickNote && (
              <View
                style={[
                  styles.pill,
                  { backgroundColor: isDark ? "#263B30" : "#F8E9C8" },
                ]}
              >
                <Ionicons
                  name="flash"
                  size={11}
                  color={isDark ? "#F4C978" : "#B45309"}
                />
                <Text
                  style={[
                    styles.pillText,
                    { color: isDark ? "#F4D9A3" : "#92400E" },
                  ]}
                >
                  Quick note
                </Text>
              </View>
            )}
            {priority && (
              <View style={[styles.pill, { backgroundColor: priority.bg }]}>
                <Ionicons name="flag" size={10} color={priority.color} />
                <Text style={[styles.pillText, { color: priority.color }]}>
                  {organization.priority}
                </Text>
              </View>
            )}
            {folderName ? (
              <View style={styles.pill}>
                <Ionicons name="folder" size={11} color={C.sub} />
                <Text style={styles.pillText}>{folderName}</Text>
              </View>
            ) : null}

            {(organization.tags || []).map((tag) => (
              <View key={tag} style={styles.pill}>
                <Text style={styles.pillText}>#{tag}</Text>
              </View>
            ))}
            {organization.archived ? (
              <View style={styles.pill}>
                <Ionicons name="archive" size={11} color={C.sub} />
                <Text style={styles.pillText}>Archived</Text>
              </View>
            ) : null}
          </View>

          {/* Body: render normal text and checklist rows separately. */}
          {item.locked ? (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                paddingVertical: 10,
              }}
            >
              <Ionicons name="lock-closed" size={16} color={C.sub} />
              <Text style={[styles.cardText, { fontWeight: "700" }]}>
                Content hidden · Unlock to view
              </Text>
            </View>
          ) : (
            (() => {
              // API/local data may contain null, non-string, or whitespace-only text.
              const bodyText = typeof item.text === "string" ? item.text : "";

              if (!bodyText.trim()) return null;

              const bodyTextColor = isQuickNote
                ? isDark
                  ? "#B9C9BF"
                  : "#183D2D"
                : noteMeta.textColor || C.ink;

              const bodyFontSize =
                noteFontSize === "small"
                  ? 12
                  : noteFontSize === "large"
                    ? 16
                    : 14;

              const bodyFontFamily =
                noteFontFamily === "System" ? undefined : noteFontFamily;

              return (
                <View style={{ marginTop: 8, gap: 5 }}>
                  {bodyText.split(/\\r?\\n/).map((line, index) => {
                    // Supports the checkbox formats used by common note editors.
                    const checkboxMatch = line.match(
                      /^(\\s*)(☐|☑️?|□|■|\\[\\s?\\]|\\[[xX]\\])\\s*(.*)$/,
                    );

                    if (checkboxMatch) {
                      const marker = checkboxMatch[2];
                      const checked =
                        marker === "☑" ||
                        marker === "☑️" ||
                        marker === "■" ||
                        /^\\[[xX]\\]$/.test(marker);

                      const checklistText = checkboxMatch[3];

                      return (
                        <View
                          key={`body-check-${index}`}
                          style={{
                            flexDirection: "row",
                            alignItems: "flex-start",
                            paddingLeft: Math.min(
                              checkboxMatch[1].length * 8,
                              32,
                            ),
                            gap: 7,
                          }}
                        >
                          <Ionicons
                            name={checked ? "checkbox" : "square-outline"}
                            size={17}
                            color={checked ? C.primary : C.sub}
                            style={{ marginTop: 1 }}
                          />
                          {!!checklistText.trim() && (
                            <Text
                              style={[
                                styles.cardText,
                                {
                                  flex: 1,
                                  color: bodyTextColor,
                                  fontSize: bodyFontSize,
                                  fontFamily: bodyFontFamily,
                                  textDecorationLine: checked
                                    ? "line-through"
                                    : "none",
                                  opacity: checked ? 0.65 : 1,
                                },
                              ]}
                            >
                              {checklistText}
                            </Text>
                          )}
                        </View>
                      );
                    }

                    // Preserve blank lines so paragraphs keep their spacing.
                    if (!line.trim()) {
                      return (
                        <View
                          key={`body-space-${index}`}
                          style={{ height: 3 }}
                        />
                      );
                    }

                    // Ordinary note text must always be rendered as visible text.
                    return (
                      <Text
                        key={`body-text-${index}`}
                        style={[
                          styles.cardText,
                          {
                            color: bodyTextColor,
                            fontSize: bodyFontSize,
                            fontFamily: bodyFontFamily,
                          },
                        ]}
                      >
                        {line}
                      </Text>
                    );
                  })}
                </View>
              );
            })()
          )}

          {!item.locked && renderMedia(item)}

          {/* Footer */}
          <View style={styles.cardFooter}>
            <View style={styles.footerItem}>
              <Ionicons name="calendar-outline" size={14} color={C.mute} />
              <Text style={styles.footerText}>{formatTodoDate(item.date)}</Text>
            </View>

            <View style={styles.footerItem}>
              <Ionicons name="time-outline" size={14} color={C.mute} />
              <Text style={styles.footerText}>
                {new Date(item.date).toLocaleTimeString("en-IN", {
                  timeZone: "Asia/Kolkata",
                  hour: "2-digit",
                  minute: "2-digit",
                  hour12: true,
                })}
              </Text>
            </View>
            {getTodoReminder(item) ? (
              <View style={[styles.footerItem, { flexShrink: 1 }]}>
                <Ionicons name="alarm-outline" size={14} color="#D97706" />
                <Text
                  numberOfLines={1}
                  style={[styles.footerText, { color: "#B45309" }]}
                >
                  Remainder: {getTodoReminder(item)}
                </Text>
              </View>
            ) : null}
          </View>
        </CardContainer>
      </Pressable>
    );
  };

  // ==========================================================
  // CALENDAR-BASED NOTE VIEW
  // ==========================================================

  const toCalendarKey = useCallback((value?: string | null) => {
    if (!value) return "";

    // Preserve date-only values without timezone conversion.
    const dateOnly = String(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);

    if (dateOnly) {
      return `${dateOnly[1]}-${dateOnly[2]}-${dateOnly[3]}`;
    }

    const parsed = new Date(value);

    if (Number.isNaN(parsed.getTime())) return "";

    return [
      parsed.getFullYear(),
      String(parsed.getMonth() + 1).padStart(2, "0"),
      String(parsed.getDate()).padStart(2, "0"),
    ].join("-");
  }, []);

  const getNoteCalendarKey = useCallback(
    (todo: Todo) =>
      toCalendarKey(todo.date || todo.createdAt || todo.updatedAt),
    [toCalendarKey],
  );

  // Counts use the same filtered notes as the list.
  const calendarNoteCounts = useMemo(() => {
    const counts: Record<string, number> = {};

    filteredTodos.forEach((todo) => {
      const key = getNoteCalendarKey(todo);
      if (key) counts[key] = (counts[key] || 0) + 1;
    });

    return counts;
  }, [filteredTodos, getNoteCalendarKey]);

  // Selected calendar date filters the same list, including Quick Notes.
  const calendarVisibleTodos = useMemo(() => {
    if (!selectedCalendarDate) return [];

    return filteredTodos.filter(
      (todo) => getNoteCalendarKey(todo) === selectedCalendarDate,
    );
  }, [filteredTodos, selectedCalendarDate, getNoteCalendarKey]);

  // In calendar view, both regular To-do notes and Quick/Cute notes must
  // be restricted to the selected date. In list view, keep the existing behavior.
  const displayedQuickNoteTodos = calendarView
    ? calendarVisibleTodos.filter(
        (todo) => getQuickNoteMeta(todo).isQuickNote === true,
      )
    : quickNoteTodos;

  const displayedTodos = calendarView
    ? calendarVisibleTodos.filter(
        (todo) => getQuickNoteMeta(todo).isQuickNote !== true,
      )
    : regularTodos;

  const selectedDateTodoCount = calendarVisibleTodos.filter(
    (todo) => getQuickNoteMeta(todo).isQuickNote !== true,
  ).length;

  const selectedDateQuickNoteCount = calendarVisibleTodos.filter(
    (todo) => getQuickNoteMeta(todo).isQuickNote === true,
  ).length;

  const calendarCells = useMemo(() => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const firstWeekday = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: Array<{ day: number | null; key: string }> = [];
    for (let i = 0; i < firstWeekday; i++)
      cells.push({ day: null, key: `empty-${i}` });
    for (let day = 1; day <= daysInMonth; day++) {
      cells.push({
        day,
        key: `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
      });
    }
    while (cells.length % 7 !== 0)
      cells.push({ day: null, key: `end-${cells.length}` });
    return cells;
  }, [calendarMonth]);

  // ==========================================================
  // RENDER: EMPTY / LOADING
  // ==========================================================
  const renderEmpty = () => {
    if (loading) return null;

    const searching = search.trim().length > 0;

    return (
      <View style={styles.emptyContainer}>
        <View style={styles.emptyIcon}>
          <Ionicons
            name={searching ? "search" : "document-text-outline"}
            size={34}
            color={C.primary}
          />
        </View>

        <Text style={styles.emptyTitle}>
          {searching
            ? "No matches"
            : filter === "All" && !collectionLabel
              ? "Nothing here yet"
              : "No notes in this view"}
        </Text>

        <Text style={styles.emptyDescription}>
          {searching
            ? "Try a different keyword."
            : "Your notes and tasks will appear here."}
        </Text>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" backgroundColor={C.bg} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={C.primary} />
          <Text style={styles.loadingText}>Loading your notes…</Text>
        </View>
      </SafeAreaView>
    );
  }

  const sectionHeader = (
    icon: string,
    color: string,
    title: string,
    count: number,
  ) => (
    <View style={styles.sectionHeader}>
      <View style={[styles.sectionIcon, { backgroundColor: color + "22" }]}>
        <Ionicons name={icon as any} size={15} color={color} />
      </View>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionCount}>
        <Text style={styles.sectionCountText}>{count}</Text>
      </View>
    </View>
  );

  const menuSections: {
    title: string;
    items: {
      label: string;
      icon: string;
      active?: boolean;
      action: () => void;
    }[];
  }[] = [
    {
      title: "Collections",
      items: [
        {
          label: "All notes",
          icon: "documents-outline",
          active:
            collectionFilter === "all" &&
            filter === "All" &&
            categoryFilter === "all",
          action: () => {
            setCollectionFilter("all");
            setCategoryFilter("all");
            setFilter("All");
          },
        },

        {
          label: "Archived",
          icon: "archive-outline",
          active: collectionFilter === "archived",
          action: () => {
            setCollectionFilter("archived");
            setFilter("All");
          },
        },
        {
          label: "Trash",
          icon: "trash-outline",
          active: collectionFilter === "trash",
          action: () => {
            setCollectionFilter("trash");
            setFilter("All");
          },
        },
      ],
    },
    {
      title: "Create",
      items: [
        {
          label: "New folder",
          icon: "folder-outline",
          action: () => openOrganizationEditor("folder"),
        },
      ],
    },
    {
      title: "View",
      items: [
        {
          label: gridLayout ? "List view" : "Grid view",
          icon: gridLayout ? "list-outline" : "grid-outline",
          action: () => setGridLayout((v) => !v),
        },
        {
          label: `Sort by ${sortLabel.toLowerCase()}`,
          icon: "swap-vertical-outline",
          action: cycleSort,
        },
      ],
    },
  ];

  // ==========================================================
  // RENDER
  // ==========================================================
  return (
    <SafeAreaView
      style={[
        styles.safeArea,
        isDesktop && styles.desktopSafeArea,
        { backgroundColor: sharedColors.background },
      ]}
    >
      <StatusBar
        barStyle={isDark ? "light-content" : "dark-content"}
        backgroundColor={sharedColors.background}
      />

      <View
        style={[
          styles.container,
          isDesktop && styles.desktopContainer,
          { backgroundColor: sharedColors.background },
        ]}
      >
        {/* HEADER */}
        <View
          style={[
            styles.header,
            isDesktop && styles.desktopHeader,
            { backgroundColor: sharedColors.background },
          ]}
        >
          <Pressable
            style={[styles.roundBtn, { backgroundColor: sharedColors.surface }]}
            onPress={() => {
              if (from === "/cretenote" || from === "/quicknotes") {
                router.replace(from as any);
              } else if (router.canGoBack()) {
                router.back();
              } else {
                router.replace("/");
              }
            }}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            hitSlop={8}
          >
            <Ionicons name="chevron-back" size={22} color={sharedColors.text} />
          </Pressable>
          <View
            style={[
              styles.headerCenter,
              isDesktop && styles.desktopHeaderCenter,
            ]}
          >
            <Text
              style={[
                styles.headerTitle,
                isDesktop && styles.desktopHeaderTitle,
                { color: sharedColors.text },
              ]}
            >
              My Notes
            </Text>
            <Text
              style={[
                styles.headerSubtitle,
                { color: sharedColors.secondaryText },
              ]}
            >
              {counts.today > 0
                ? `${counts.today} due today`
                : "Nothing due today"}
            </Text>
            {isDesktop && (
              <Text
                style={[
                  styles.desktopHeaderHint,
                  { color: sharedColors.secondaryText },
                ]}
              >
                Your personal space to plan, capture and organize.
              </Text>
            )}
          </View>

          <Pressable
            style={[styles.roundBtn, { backgroundColor: sharedColors.surface }]}
            onPress={() => setMenuVisible(true)}
            accessibilityRole="button"
            accessibilityLabel="Open notes menu"
            hitSlop={8}
          >
            <Ionicons
              name="options-outline"
              size={21}
              color={sharedColors.text}
            />
          </Pressable>
        </View>

        <FlatList
          data={displayedTodos}
          keyExtractor={(item, index) =>
            String(item.tdlId || item._id || index)
          }
          renderItem={({ item }) =>
            gridLayout ? (
              <View
                style={[styles.gridCell, isDesktop && styles.desktopGridCell]}
              >
                {renderTodo({ item })}
              </View>
            ) : (
              renderTodo({ item })
            )
          }
          numColumns={gridLayout ? (isDesktop ? 3 : 2) : 1}
          key={
            gridLayout
              ? isDesktop
                ? "notes-grid-desktop"
                : "notes-grid"
              : "notes-list"
          }
          columnWrapperStyle={
            gridLayout
              ? [styles.gridRow, isDesktop && styles.desktopGridRow]
              : undefined
          }
          contentContainerStyle={[
            styles.listContent,
            isDesktop && styles.desktopListContent,
            displayedTodos.length === 0 &&
              displayedQuickNoteTodos.length === 0 &&
              styles.emptyListContent,
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentInsetAdjustmentBehavior="automatic"
          initialNumToRender={8}
          maxToRenderPerBatch={8}
          updateCellsBatchingPeriod={40}
          windowSize={7}
          onEndReachedThreshold={0.35}
          ListFooterComponent={<View style={styles.listFooterSpace} />}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={accentColor}
              colors={[accentColor]}
            />
          }
          ListHeaderComponent={
            <View style={isDesktop ? styles.desktopListHeader : undefined}>
              {isDesktop && (
                <View style={styles.desktopIntro}>
                  <View>
                    <Text style={styles.desktopEyebrow}>
                      PERSONAL WORKSPACE
                    </Text>
                    <Text
                      style={[
                        styles.desktopPageTitle,
                        { color: sharedColors.text },
                      ]}
                    >
                      Your notes, in focus.
                    </Text>
                    <Text
                      style={[
                        styles.desktopPageSubtitle,
                        { color: sharedColors.secondaryText },
                      ]}
                    >
                      Keep ideas organized and make progress on what matters.
                    </Text>
                  </View>
                  <View style={styles.desktopIntroBadge}>
                    <Ionicons name="leaf-outline" size={16} color="#14785E" />
                    <Text style={styles.desktopIntroBadgeText}>
                      Mint workspace
                    </Text>
                  </View>
                </View>
              )}

              {/* HERO OVERVIEW */}

              {showHero && (
                <View
                  style={[
                    styles.hero,
                    {
                      backgroundColor: "#123D32",
                      borderRadius: 24,
                      padding: 18,
                      overflow: "hidden",
                      borderWidth: 1,
                      borderColor: "#245B49",
                      ...(isDesktop
                        ? {
                            borderRadius: 28,
                            padding: isWideDesktop ? 28 : 24,
                            marginBottom: 10,
                          }
                        : {}),
                    },
                  ]}
                >
                  {/* Decorative dark mint shapes */}
                  <View
                    style={[
                      styles.heroBlobA,
                      { backgroundColor: "#28785C", opacity: 0.35 },
                    ]}
                  />
                  <View
                    style={[
                      styles.heroBlobB,
                      { backgroundColor: "#36A47B", opacity: 0.22 },
                    ]}
                  />

                  <View style={[styles.heroTop, { alignItems: "center" }]}>
                    <View style={styles.heroInfo}>
                      <Text
                        style={[
                          styles.heroLabel,
                          { color: "#A4E8CC", letterSpacing: 1.5 },
                        ]}
                      >
                        YOUR WORKSPACE
                      </Text>

                      <View style={styles.heroNumberRow}>
                        <Text style={[styles.heroNumber, { color: "#F0FFF8" }]}>
                          {counts.all}
                        </Text>

                        <Text style={[styles.heroUnit, { color: "#B8EBD5" }]}>
                          {counts.all === 1 ? "active item" : "active items"}
                        </Text>
                      </View>

                      <Text style={[styles.heroSubtitle, { color: "#A5D7C1" }]}>
                        Keep moving forward, one task at a time.
                      </Text>
                    </View>

                    <View
                      style={[styles.progressRing, { alignItems: "center" }]}
                    >
                      <View
                        style={[
                          styles.ring,
                          {
                            backgroundColor: "#1B4D3F",
                            borderColor: "#55D6A0",
                            borderWidth: 4,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.ringText,
                            { color: "#D8FFEC", fontWeight: "800" },
                          ]}
                        >
                          {progress}%
                        </Text>
                      </View>

                      <Text
                        style={[
                          styles.ringCaption,
                          {
                            color: "#A4E8CC",
                            fontWeight: "700",
                            letterSpacing: 1,
                          },
                        ]}
                      >
                        COMPLETED
                      </Text>
                    </View>
                  </View>

                  {/* Progress bar */}
                  <View
                    style={[
                      styles.progressTrack,
                      {
                        backgroundColor: "#285B49",
                        height: 8,
                        borderRadius: 10,
                        overflow: "hidden",
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.progressFill,
                        {
                          width: `${Math.max(0, Math.min(100, progress))}%`,
                          backgroundColor: "#55D6A0",
                          borderRadius: 10,
                        },
                      ]}
                    />
                  </View>

                  {/* Statistics */}
                  <View style={styles.heroStats}>
                    {[
                      { label: "Today", value: counts.today },
                      { label: "Upcoming", value: counts.upcoming },
                      { label: "Done", value: counts.completed },
                    ].map((s) => (
                      <View
                        key={s.label}
                        style={[
                          styles.heroStat,
                          {
                            backgroundColor: "#19483A",
                            borderColor: "#2D6A53",
                            borderWidth: 1,
                            borderRadius: 16,
                            paddingVertical: 12,
                          },
                        ]}
                      >
                        <View
                          style={[
                            styles.heroStatDot,
                            { backgroundColor: "#55D6A0" },
                          ]}
                        />

                        <Text
                          style={[styles.heroStatValue, { color: "#F0FFF8" }]}
                        >
                          {s.value}
                        </Text>

                        <Text
                          style={[styles.heroStatLabel, { color: "#A4D9C2" }]}
                        >
                          {s.label}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {/* SEARCH */}

              <View
                style={[
                  styles.searchContainer,
                  isDesktop && styles.desktopSearchContainer,
                ]}
              >
                <Ionicons name="search" size={18} color={C.mute} />
                <TextInput
                  value={search}
                  onChangeText={setSearch}
                  placeholder="Search titles and text"
                  placeholderTextColor={C.mute}
                  style={styles.searchInput}
                  returnKeyType="search"
                />
                {search.length > 0 && (
                  <Pressable onPress={() => setSearch("")} hitSlop={8}>
                    <Ionicons name="close-circle" size={18} color={C.mute} />
                  </Pressable>
                )}
              </View>

              {/* CALENDAR VIEW TOGGLE */}
              <View
                style={[
                  styles.viewSwitcher,
                  isDesktop && styles.desktopViewSwitcher,
                ]}
              >
                <Pressable
                  onPress={() => setCalendarView(false)}
                  style={[
                    styles.viewSwitcherOption,
                    !calendarView && styles.viewSwitcherActive,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="List view"
                  accessibilityState={{ selected: !calendarView }}
                >
                  <Ionicons
                    name="list-outline"
                    size={16}
                    color={!calendarView ? "#FFFFFF" : C.primary}
                  />
                  <Text
                    style={[
                      styles.viewSwitcherText,
                      !calendarView && styles.viewSwitcherActiveText,
                    ]}
                  >
                    List
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => setCalendarView(true)}
                  style={[
                    styles.viewSwitcherOption,
                    calendarView && styles.viewSwitcherActive,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Calendar view"
                  accessibilityState={{ selected: calendarView }}
                >
                  <Ionicons
                    name="calendar-outline"
                    size={16}
                    color={calendarView ? "#FFFFFF" : C.primary}
                  />
                  <Text
                    style={[
                      styles.viewSwitcherText,
                      calendarView && styles.viewSwitcherActiveText,
                    ]}
                  >
                    Calendar
                  </Text>
                </Pressable>
              </View>

              {calendarView && (
                <View style={styles.calendarPanel}>
                  <View style={styles.calendarHeader}>
                    <Pressable
                      style={styles.calendarArrow}
                      onPress={() =>
                        setCalendarMonth(
                          (month) =>
                            new Date(
                              month.getFullYear(),
                              month.getMonth() - 1,
                              1,
                            ),
                        )
                      }
                      accessibilityLabel="Previous month"
                    >
                      <Ionicons name="chevron-back" size={19} color={C.ink} />
                    </Pressable>
                    <Pressable
                      onPress={() => {
                        const now = new Date();
                        setCalendarMonth(
                          new Date(now.getFullYear(), now.getMonth(), 1),
                        );
                        setSelectedCalendarDate(
                          `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`,
                        );
                      }}
                    >
                      <Text style={styles.calendarMonthTitle}>
                        {calendarMonth.toLocaleDateString("en-IN", {
                          month: "long",
                          year: "numeric",
                        })}
                      </Text>
                    </Pressable>
                    <Pressable
                      style={styles.calendarArrow}
                      onPress={() =>
                        setCalendarMonth(
                          (month) =>
                            new Date(
                              month.getFullYear(),
                              month.getMonth() + 1,
                              1,
                            ),
                        )
                      }
                      accessibilityLabel="Next month"
                    >
                      <Ionicons
                        name="chevron-forward"
                        size={19}
                        color={C.ink}
                      />
                    </Pressable>
                  </View>
                  <View style={styles.calendarWeekRow}>
                    {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(
                      (day) => (
                        <Text key={day} style={styles.calendarWeekday}>
                          {day}
                        </Text>
                      ),
                    )}
                  </View>
                  <View style={styles.calendarGrid}>
                    {calendarCells.map((cell) => {
                      if (!cell.day)
                        return (
                          <View key={cell.key} style={styles.calendarDayCell} />
                        );
                      const active = selectedCalendarDate === cell.key;
                      const hasNotes = (calendarNoteCounts[cell.key] || 0) > 0;
                      const now = new Date();
                      const isToday =
                        cell.key ===
                        `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
                      return (
                        <Pressable
                          key={cell.key}
                          style={[
                            styles.calendarDayCell,
                            active && { backgroundColor: accentColor },
                            !active && isToday && styles.calendarTodayCell,
                          ]}
                          onPress={() => setSelectedCalendarDate(cell.key)}
                          accessibilityRole="button"
                          accessibilityLabel={`${cell.day}, ${calendarMonth.toLocaleDateString("en-IN", { month: "long" })}${hasNotes ? `, ${calendarNoteCounts[cell.key]} notes` : ""}`}
                        >
                          <Text
                            style={[
                              styles.calendarDayText,
                              active && { color: "#FFFFFF" },
                              !active &&
                                isToday && {
                                  color: C.primary,
                                  fontWeight: "800",
                                },
                            ]}
                          >
                            {cell.day}
                          </Text>
                          {hasNotes && (
                            <View
                              style={[
                                styles.calendarNoteDot,
                                active && { backgroundColor: "#FFFFFF" },
                              ]}
                            />
                          )}
                        </Pressable>
                      );
                    })}
                  </View>
                  <View style={styles.calendarSelectedSummary}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.calendarSelectedTitle}>
                        {new Date(
                          `${selectedCalendarDate}T12:00:00`,
                        ).toLocaleDateString("en-IN", {
                          weekday: "long",
                          day: "numeric",
                          month: "short",
                        })}
                      </Text>

                      <Text style={styles.calendarSelectedSubtitle}>
                        {calendarVisibleTodos.length}{" "}
                        {calendarVisibleTodos.length === 1 ? "note" : "notes"}{" "}
                        on this date
                      </Text>

                      <Text style={styles.calendarSelectedSubtitle}>
                        To-do Notes: {selectedDateTodoCount} · Quick Notes:{" "}
                        {selectedDateQuickNoteCount}
                      </Text>
                    </View>

                    {/* Buttons arranged vertically */}
                    <View
                      style={{
                        flexDirection: "column",
                        alignItems: "flex-end",
                        justifyContent: "center",
                        gap: 8,
                      }}
                    >
                      {/* Yesterday / Today / Tomorrow button */}
                      {(() => {
                        const now = new Date();

                        const todayStart = new Date(
                          now.getFullYear(),
                          now.getMonth(),
                          now.getDate(),
                        );

                        const selected = new Date(
                          `${selectedCalendarDate}T12:00:00`,
                        );

                        const selectedStart = new Date(
                          selected.getFullYear(),
                          selected.getMonth(),
                          selected.getDate(),
                        );

                        const difference = Math.round(
                          (selectedStart.getTime() - todayStart.getTime()) /
                            86400000,
                        );

                        // Hide button for all other dates
                        if (![-1, 0, 1].includes(difference)) {
                          return null;
                        }

                        const buttonLabel =
                          difference === -1
                            ? "Yesterday"
                            : difference === 1
                              ? "Tomorrow"
                              : "Today";

                        return (
                          <Pressable
                            onPress={() => {
                              const currentDate = new Date();

                              setCalendarMonth(
                                new Date(
                                  currentDate.getFullYear(),
                                  currentDate.getMonth(),
                                  1,
                                ),
                              );

                              setSelectedCalendarDate(
                                `${currentDate.getFullYear()}-${String(
                                  currentDate.getMonth() + 1,
                                ).padStart(2, "0")}-${String(
                                  currentDate.getDate(),
                                ).padStart(2, "0")}`,
                              );
                            }}
                            style={[
                              styles.calendarTodayButton,
                              {
                                height: 36,
                                minWidth: 100,
                                paddingHorizontal: 12,
                                alignItems: "center",
                                justifyContent: "center",
                                borderRadius: 10,
                                backgroundColor: C.primarySoft,
                                borderColor: C.line,
                                borderWidth: 1,
                              },
                            ]}
                            accessibilityRole="button"
                            accessibilityLabel={`Go to ${buttonLabel.toLowerCase()}`}
                          >
                            <Text
                              style={[
                                styles.calendarTodayButtonText,
                                {
                                  includeFontPadding: false,
                                  textAlign: "center",
                                },
                              ]}
                            >
                              {buttonLabel}
                            </Text>
                          </Pressable>
                        );
                      })()}

                      {/* Link note is available only for today and future dates. */}
                      {isTodayOrFutureDate(selectedCalendarDate) && (
                        <Pressable
                          onPress={() =>
                            router.push({
                              pathname: "/cretenote",
                              params: {
                                quickNote: "false",
                                selectedDate: selectedCalendarDate,
                              },
                            })
                          }
                          style={[
                            styles.calendarTodayButton,
                            {
                              height: 36,
                              minWidth: 110,
                              paddingHorizontal: 10,
                              flexDirection: "row",
                              alignItems: "center",
                              justifyContent: "center",
                              backgroundColor: accentColor,
                              borderRadius: 10,
                            },
                          ]}
                          accessibilityRole="button"
                          accessibilityLabel={`Create a note for ${selectedCalendarDate}`}
                        >
                          <Ionicons
                            name="add-circle-outline"
                            size={16}
                            color="#FFFFFF"
                          />

                          <Text
                            style={[
                              styles.calendarTodayButtonText,
                              {
                                color: "#FFFFFF",
                                marginLeft: 5,
                                includeFontPadding: false,
                                textAlign: "center",
                              },
                            ]}
                          >
                            Link note
                          </Text>
                        </Pressable>
                      )}
                    </View>
                  </View>
                </View>
              )}

              {/* STATUS FILTERS */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.chipScroll}
              >
                {(
                  [
                    ["All", counts.all],
                    ["Today", counts.today],
                    ["Upcoming", counts.upcoming],
                    ["Completed", counts.completed],
                  ] as [FilterType, number][]
                ).map(([name, count]) => {
                  const active = filter === name;

                  return (
                    <Pressable
                      key={name}
                      onPress={() => setFilter(name)}
                      style={[
                        styles.filterChip,
                        active && {
                          backgroundColor: accentColor,
                          borderColor: accentColor,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.filterText,
                          active && styles.filterTextActive,
                        ]}
                      >
                        {name}
                      </Text>

                      <View
                        style={[
                          styles.filterCount,
                          active && styles.filterCountActive,
                        ]}
                      >
                        <Text
                          style={[
                            styles.filterCountText,
                            active && styles.filterCountTextActive,
                          ]}
                        >
                          {count}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
              </ScrollView>

              <View style={styles.toolsContainer}>
                <Pressable
                  style={({ pressed }) => [
                    styles.toolChip,
                    pressed && styles.toolChipPressed,
                  ]}
                  onPress={cycleSort}
                  android_ripple={{ color: "#D8F3E7", borderless: false }}
                >
                  <View style={styles.toolIconBox}>
                    <Ionicons
                      name="swap-vertical"
                      size={17}
                      color={C.primary}
                    />
                  </View>

                  <Text style={styles.toolChipText}>{sortLabel}</Text>

                  <Ionicons name="chevron-down" size={13} color={C.primary} />
                </Pressable>

                <Pressable
                  style={({ pressed }) => [
                    styles.toolChip,
                    styles.layoutToolChip,
                    pressed && styles.toolChipPressed,
                  ]}
                  onPress={() => setGridLayout((v) => !v)}
                  android_ripple={{ color: "#D8F3E7", borderless: false }}
                >
                  <Ionicons
                    name={gridLayout ? "list-outline" : "grid-outline"}
                    size={17}
                    color={C.primary}
                  />

                  <Text style={styles.toolChipText}>
                    {gridLayout ? "List view" : "Grid view"}
                  </Text>
                </Pressable>
              </View>

              {/* Folder Collection Chips */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.folderChipsContainer}
                keyboardShouldPersistTaps="handled"
              >
                {/* Active collection */}
                {collectionLabel && (
                  <Pressable
                    style={({ pressed }) => [
                      styles.folderChip,
                      styles.folderChipActive,
                      pressed && styles.folderChipPressed,
                    ]}
                    onPress={() => setCollectionFilter("all")}
                  >
                    <Ionicons name="folder-open" size={15} color="#FFFFFF" />

                    <Text style={styles.folderChipTextActive} numberOfLines={1}>
                      {collectionLabel}
                    </Text>

                    <View style={styles.folderChipClose}>
                      <Ionicons name="close" size={12} color="#FFFFFF" />
                    </View>
                  </Pressable>
                )}

                {/* Available folders */}
                {noteFolders
                  .filter((folder) => folder.id !== collectionFilter)
                  .map((folder) => (
                    <Pressable
                      key={folder.id}
                      style={({ pressed }) => [
                        styles.folderChip,
                        styles.folderChipInactive,
                        pressed && styles.folderChipPressed,
                      ]}
                      onPress={() => setCollectionFilter(folder.id)}
                      onLongPress={() =>
                        showAppAlert(folder.name, "Manage this folder", [
                          {
                            text: "Rename",
                            onPress: () =>
                              openOrganizationEditor("folder", folder.id),
                          },
                          {
                            text: "Delete",
                            style: "destructive",
                            onPress: () => deleteFolder(folder),
                          },
                          { text: "Cancel", style: "cancel" },
                        ])
                      }
                    >
                      <Ionicons
                        name="folder-outline"
                        size={16}
                        color="#238665"
                      />

                      <Text style={styles.folderChipText} numberOfLines={1}>
                        {folder.name}
                      </Text>

                      <Pressable
                        hitSlop={8}
                        onPress={() =>
                          showAppAlert(folder.name, "Manage this folder", [
                            {
                              text: "Rename",
                              onPress: () =>
                                openOrganizationEditor("folder", folder.id),
                            },
                            {
                              text: "Delete",
                              style: "destructive",
                              onPress: () => deleteFolder(folder),
                            },
                            { text: "Cancel", style: "cancel" },
                          ])
                        }
                        style={styles.folderChipMore}
                      >
                        <Ionicons
                          name="ellipsis-vertical"
                          size={15}
                          color="#648174"
                        />
                      </Pressable>
                    </Pressable>
                  ))}
              </ScrollView>

              {/* QUICK NOTES */}

              {showQuickNotes && displayedQuickNoteTodos.length > 0 && (
                <View style={{ marginTop: 6 }}>
                  {sectionHeader(
                    "flash",
                    C.amber,
                    "Quick notes",
                    displayedQuickNoteTodos.length,
                  )}

                  <View
                    style={
                      gridLayout ? styles.gridContainer : styles.listContainer
                    }
                  >
                    {displayedQuickNoteTodos.map((item, index) => (
                      <View
                        key={String(
                          item.tdlId ??
                            item._id ??
                            item.id ??
                            `quick-note-${index}`,
                        )}
                        style={gridLayout ? styles.gridItem : styles.listItem}
                      >
                        {renderTodo({ item })}
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {displayedTodos.length > 0 &&
                sectionHeader(
                  "checkbox",
                  C.primary,
                  "Todos",
                  displayedTodos.length,
                )}
            </View>
          }
          ListEmptyComponent={
            displayedQuickNoteTodos.length === 0 ? renderEmpty() : null
          }
        />

        {/* FAB */}
        <Pressable
          style={[styles.fab, { backgroundColor: accentColor }]}
          onPress={() => addTodo(activeFolderId)}
          accessibilityLabel="Create a note or todo"
        >
          <Ionicons name="add" size={24} color="#FFFFFF" />
          <Text style={styles.fabText}>New</Text>
        </Pressable>
      </View>

      {/* ======================= NOTES MENU (bottom sheet) ======================= */}
      <Modal
        transparent
        visible={menuVisible}
        animationType="slide"
        onRequestClose={() => setMenuVisible(false)}
      >
        <Pressable
          style={styles.sheetOverlay}
          onPress={() => setMenuVisible(false)}
        >
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Notes</Text>
            <ScrollView
              showsVerticalScrollIndicator={false}
              style={{ maxHeight: 520 }}
            >
              {menuSections.map((section) => (
                <View key={section.title} style={{ marginTop: 14 }}>
                  <Text style={styles.sheetSection}>{section.title}</Text>
                  <View style={styles.menuGroup}>
                    {section.items.map((item, idx) => (
                      <Pressable
                        key={item.label}
                        style={[
                          styles.menuRow,
                          idx > 0 && styles.menuRowBorder,
                        ]}
                        onPress={() => {
                          setMenuVisible(false);
                          afterModal(item.action);
                        }}
                      >
                        <View
                          style={[
                            styles.menuIcon,
                            item.active && { backgroundColor: accentColor },
                          ]}
                        >
                          <Ionicons
                            name={item.icon as any}
                            size={17}
                            color={item.active ? "#FFFFFF" : accentColor}
                          />
                        </View>
                        <Text
                          style={[
                            styles.menuLabel,
                            item.active && { color: accentColor },
                          ]}
                        >
                          {item.label}
                        </Text>
                        {item.active ? (
                          <Ionicons
                            name="checkmark"
                            size={18}
                            color={accentColor}
                          />
                        ) : (
                          <Ionicons
                            name="chevron-forward"
                            size={15}
                            color={C.mute}
                          />
                        )}
                      </Pressable>
                    ))}
                  </View>
                </View>
              ))}
              <View style={{ height: 12 }} />
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ======================= NOTE ACTIONS (bottom sheet grid) ======================= */}

      <Modal
        transparent
        visible={actionTodo !== null}
        animationType="slide"
        statusBarTranslucent
        onRequestClose={() => setActionTodo(null)}
      >
        <View style={styles.actionModalRoot}>
          <Pressable
            style={styles.sheetOverlay}
            onPress={() => setActionTodo(null)}
          />

          <View style={styles.sheet}>
            {/* Drag handle */}
            <View style={styles.sheetHandleContainer}>
              <View style={styles.sheetHandle} />
            </View>

            {/* Header */}
            <View style={styles.sheetHeader}>
              <View style={styles.sheetHeaderText}>
                <Text numberOfLines={2} style={styles.sheetTitle}>
                  {actionTodo?.locked
                    ? "Locked note"
                    : actionTodo?.title?.trim() || "Untitled note"}
                </Text>

                <Text style={styles.sheetSub}>
                  Choose an action for this note
                </Text>
              </View>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close note actions"
                onPress={() => setActionTodo(null)}
                style={styles.sheetCloseButton}
              >
                <Ionicons name="close" size={20} color={C.sub} />
              </Pressable>
            </View>

            <View style={styles.sheetDivider} />

            {/* Action grid */}
            <View style={styles.actionGrid}>
              {actionTodo &&
                buildSheetActions(actionTodo)
                  .filter((action): action is SheetAction =>
                    Boolean(
                      action &&
                      typeof action.key === "string" &&
                      action.key.length > 0 &&
                      typeof action.label === "string" &&
                      typeof action.icon === "string" &&
                      typeof action.onPress === "function",
                    ),
                  )
                  .map((action) => (
                    <Pressable
                      key={action.key}
                      accessibilityRole="button"
                      accessibilityLabel={action.label}
                      style={({ pressed }) => [
                        styles.actionCell,
                        pressed && styles.actionCellPressed,
                      ]}
                      onPress={() => {
                        setActionTodo(null);
                        afterModal(action.onPress);
                      }}
                    >
                      <View
                        style={[
                          styles.actionIcon,
                          { backgroundColor: action.bg },
                        ]}
                      >
                        <Ionicons
                          name={action.icon as any}
                          size={23}
                          color={action.color}
                        />
                      </View>

                      <Text numberOfLines={2} style={styles.actionLabel}>
                        {action.label}
                      </Text>
                    </Pressable>
                  ))}
            </View>
          </View>
        </View>
      </Modal>

      {/* ======================= CHANGE TASK STATUS ======================= */}
      <Modal
        transparent
        visible={statusTodo !== null}
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => !statusBusy && setStatusTodo(null)}
      >
        <View style={styles.dialogOverlay}>
          <View
            style={{
              width: "100%",
              maxWidth: 420,
              alignSelf: "center",
              padding: 22,
              borderRadius: 22,
              backgroundColor: C.surface,
              borderWidth: 1,
              borderColor: C.line,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 8,
              }}
            >
              <Text style={[styles.dialogTitle, { color: C.ink }]}>
                Change status
              </Text>
              <Pressable
                disabled={statusBusy}
                onPress={() => setStatusTodo(null)}
                hitSlop={10}
              >
                <Ionicons name="close" size={22} color={C.sub} />
              </Pressable>
            </View>
            <Text
              style={{
                color: C.sub,
                fontSize: 14,
                marginBottom: 18,
              }}
              numberOfLines={2}
            >
              {statusTodo?.title || "Choose a status for this task"}
            </Text>

            {(
              [
                {
                  value: "Today",
                  icon: "today-outline",
                  color: C.today,
                  bg: isDark ? "#1E3A5F" : "#E6F0FF",
                },
                {
                  value: "Upcoming",
                  icon: "calendar-outline",
                  color: C.upcoming,
                  bg: isDark ? "#352653" : "#F0E9FF",
                },
                {
                  value: "Completed",
                  icon: "checkmark-circle-outline",
                  color: C.done,
                  bg: isDark ? "#174536" : "#DDF7F3",
                },
              ] as const
            ).map((option) => {
              const active = statusTodo?.status === option.value;
              return (
                <Pressable
                  key={option.value}
                  disabled={statusBusy || !statusTodo}
                  onPress={() =>
                    statusTodo &&
                    void updateTodoStatus(statusTodo, option.value)
                  }
                  style={{
                    minHeight: 58,
                    paddingHorizontal: 14,
                    marginBottom: 10,
                    borderRadius: 14,
                    borderWidth: active ? 2 : 1,
                    borderColor: active ? option.color : C.line,
                    backgroundColor: option.bg,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 12,
                    opacity: statusBusy ? 0.6 : 1,
                  }}
                >
                  <Ionicons
                    name={option.icon as any}
                    size={23}
                    color={option.color}
                  />
                  <Text
                    style={{
                      flex: 1,
                      fontSize: 16,
                      fontWeight: "700",
                      color: C.ink,
                    }}
                  >
                    {option.value}
                  </Text>
                  {active ? (
                    <Ionicons
                      name="checkmark-circle"
                      size={21}
                      color={option.color}
                    />
                  ) : (
                    <Ionicons name="chevron-forward" size={18} color={C.sub} />
                  )}
                </Pressable>
              );
            })}

            {statusBusy ? (
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 9,
                  paddingTop: 5,
                }}
              >
                <ActivityIndicator color={C.primary} />
                <Text style={{ color: C.sub, fontSize: 13 }}>
                  Updating status...
                </Text>
              </View>
            ) : null}
          </View>
        </View>
      </Modal>

      {/* ======================= REMINDER EDITOR ======================= */}
      <Modal
        transparent
        visible={reminderModalVisible}
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => !reminderBusy && setReminderModalVisible(false)}
      >
        <View style={styles.dialogOverlay}>
          <View style={styles.reminderDialog}>
            <View style={styles.reminderDialogHeader}>
              <View style={styles.reminderHeaderIcon}>
                <Ionicons name="alarm-outline" size={24} color={C.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.dialogTitle}>
                  {reminderTodo && hasReminder(reminderTodo)
                    ? "Edit reminder"
                    : "Add reminder"}
                </Text>
                <Text style={styles.reminderSubtitle} numberOfLines={2}>
                  {reminderTodo?.title || "Untitled note"}
                </Text>
              </View>
              <Pressable
                onPress={() => !reminderBusy && setReminderModalVisible(false)}
                style={styles.reminderClose}
              >
                <Ionicons name="close" size={20} color={C.sub} />
              </Pressable>
            </View>
            <Text style={styles.reminderHint}>
              Only the reminder will change. Your note content stays untouched.
            </Text>
            <Text style={styles.reminderFieldLabel}>REMINDER DATE</Text>
            <Pressable
              style={styles.reminderPickerRow}
              onPress={openReminderDatePicker}
            >
              <View style={styles.reminderPickerIcon}>
                <Ionicons name="calendar-outline" size={20} color={C.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.reminderPickerCaption}>Date</Text>
                <Text style={styles.reminderPickerValue}>
                  {reminderDateValue.toLocaleDateString([], {
                    weekday: "short",
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={C.mute} />
            </Pressable>
            <Text style={styles.reminderFieldLabel}>REMINDER TIME</Text>
            <Pressable
              style={styles.reminderPickerRow}
              onPress={openReminderTimePicker}
            >
              <View style={styles.reminderPickerIcon}>
                <Ionicons name="time-outline" size={20} color={C.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.reminderPickerCaption}>Time</Text>
                <Text style={styles.reminderPickerValue}>
                  {reminderTimeValue.toLocaleTimeString([], {
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={C.mute} />
            </Pressable>
            <View style={styles.reminderButtonRow}>
              <Pressable
                style={styles.reminderCancelButton}
                disabled={reminderBusy}
                onPress={() => setReminderModalVisible(false)}
              >
                <Text style={styles.reminderCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[
                  styles.reminderSaveButton,
                  reminderBusy && { opacity: 0.65 },
                ]}
                disabled={reminderBusy}
                onPress={() => void saveReminderFromView()}
              >
                {reminderBusy ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons
                      name="checkmark-circle-outline"
                      size={18}
                      color="#FFFFFF"
                    />
                    <Text style={styles.reminderSaveText}>Save reminder</Text>
                  </>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* ======================= LOCK / UNLOCK / CHANGE PIN ======================= */}
      <Modal
        transparent
        visible={lockDialogVisible}
        animationType="fade"
        onRequestClose={() => !lockRequestBusy && setLockDialogVisible(false)}
        statusBarTranslucent
      >
        <View style={styles.dialogOverlay}>
          <View style={styles.dialog}>
            <View style={{ alignItems: "center", marginBottom: 14 }}>
              <View
                style={{
                  width: 58,
                  height: 58,
                  borderRadius: 20,
                  backgroundColor: isDark ? "#352653" : "#EDE9FE",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 10,
                }}
              >
                <Ionicons
                  name={
                    lockDialogMode === "unlock"
                      ? "lock-open"
                      : lockDialogMode === "changePin"
                        ? "key"
                        : "lock-closed"
                  }
                  size={27}
                  color="#7C3AED"
                />
              </View>
              <Text
                style={[
                  styles.dialogTitle,
                  { marginBottom: 4, textAlign: "center" },
                ]}
              >
                {lockDialogMode === "lock"
                  ? "Lock note"
                  : lockDialogMode === "unlock"
                    ? "Unlock note"
                    : "Change security PIN"}
              </Text>
              <Text
                style={{
                  color: C.sub,
                  fontSize: 13,
                  textAlign: "center",
                  lineHeight: 19,
                }}
              >
                {lockDialogMode === "lock"
                  ? "Create a 4–6 digit PIN to protect this note."
                  : lockDialogMode === "unlock"
                    ? "Enter the PIN to unlock this note."
                    : "Verify your current PIN, then create a new one."}
              </Text>
            </View>
            {(lockDialogMode === "unlock" ||
              lockDialogMode === "changePin") && (
              <TextInput
                value={currentLockPin}
                onChangeText={(v) =>
                  setCurrentLockPin(v.replace(/\D/g, "").slice(0, 6))
                }
                placeholder="Current PIN"
                placeholderTextColor={C.mute}
                keyboardType="number-pad"
                secureTextEntry
                maxLength={6}
                style={[styles.dialogInput, { marginBottom: 10 }]}
                editable={!lockRequestBusy}
              />
            )}
            {lockDialogMode !== "unlock" && (
              <>
                <TextInput
                  value={newLockPin}
                  onChangeText={(v) =>
                    setNewLockPin(v.replace(/\D/g, "").slice(0, 6))
                  }
                  placeholder="New PIN (4–6 digits)"
                  placeholderTextColor={C.mute}
                  keyboardType="number-pad"
                  secureTextEntry
                  maxLength={6}
                  style={[styles.dialogInput, { marginBottom: 10 }]}
                  editable={!lockRequestBusy}
                />
                <TextInput
                  value={confirmLockPin}
                  onChangeText={(v) =>
                    setConfirmLockPin(v.replace(/\D/g, "").slice(0, 6))
                  }
                  placeholder="Confirm new PIN"
                  placeholderTextColor={C.mute}
                  keyboardType="number-pad"
                  secureTextEntry
                  maxLength={6}
                  style={styles.dialogInput}
                  editable={!lockRequestBusy}
                />
              </>
            )}
            <View style={styles.dialogActions}>
              <Pressable
                style={styles.dialogCancel}
                disabled={lockRequestBusy}
                onPress={() => setLockDialogVisible(false)}
              >
                <Text style={styles.dialogCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[
                  styles.dialogSave,
                  {
                    backgroundColor: "#7C3AED",
                    opacity: lockRequestBusy ? 0.7 : 1,
                  },
                ]}
                disabled={lockRequestBusy}
                onPress={() => void submitLockDialog()}
              >
                {lockRequestBusy ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.dialogSaveText}>
                    {lockDialogMode === "lock"
                      ? "Lock note"
                      : lockDialogMode === "unlock"
                        ? "Unlock"
                        : "Update PIN"}
                  </Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* ======================= FOLDER / CATEGORY / TAG EDITOR ======================= */}
      <Modal
        transparent
        visible={organizationModal !== null}
        animationType="fade"
        onRequestClose={() => setOrganizationModal(null)}
      >
        <View style={styles.dialogOverlay}>
          <View style={styles.dialog}>
            <Text style={styles.dialogTitle}>
              {organizationModal === "folder"
                ? editingOrganizationId
                  ? "Rename folder"
                  : "New folder"
                : organizationModal === "category"
                  ? editingOrganizationId
                    ? "Edit category"
                    : "New category"
                  : editingOrganizationId?.includes("::")
                    ? "Edit tag"
                    : "Tags"}
            </Text>

            <TextInput
              value={organizationInput}
              onChangeText={setOrganizationInput}
              placeholder={organizationModal === "tag" ? "Add a tag" : "Name"}
              placeholderTextColor={C.mute}
              style={styles.dialogInput}
              autoFocus
              onSubmitEditing={() => void saveOrganizationEditor()}
            />

            {organizationModal === "tag" && tagTodoId && (
              <View style={styles.tagList}>
                {(organizationMeta[tagTodoId]?.tags || []).map((tag) => (
                  <View key={tag} style={styles.tagRow}>
                    <Text style={styles.tagName}>#{tag}</Text>
                    <Pressable
                      onPress={() => {
                        setEditingOrganizationId(`${tagTodoId}::${tag}`);
                        setOrganizationInput(tag);
                      }}
                      style={styles.tagAction}
                    >
                      <Text style={styles.tagActionText}>Edit</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => {
                        const nextMeta = {
                          ...organizationMeta,
                          [tagTodoId]: {
                            ...(organizationMeta[tagTodoId] || {}),
                            tags: (
                              organizationMeta[tagTodoId]?.tags || []
                            ).filter((value) => value !== tag),
                          },
                        };
                        void persistOrganization(nextMeta);
                      }}
                      style={[
                        styles.tagAction,
                        { backgroundColor: C.dangerSoft },
                      ]}
                    >
                      <Text style={[styles.tagActionText, { color: C.danger }]}>
                        Remove
                      </Text>
                    </Pressable>
                  </View>
                ))}
              </View>
            )}

            {organizationModal === "category" && (
              <>
                <Text style={styles.colorLabel}>Color</Text>
                <View style={styles.colorRow}>
                  {CATEGORY_COLORS.map((color) => (
                    <Pressable
                      key={color}
                      onPress={() => setSelectedOrganizationColor(color)}
                      style={[
                        styles.colorSwatch,
                        { backgroundColor: color },
                        selectedOrganizationColor === color &&
                          styles.colorSwatchSelected,
                      ]}
                    />
                  ))}
                </View>
              </>
            )}

            <View style={styles.dialogActions}>
              <Pressable
                style={styles.dialogCancel}
                onPress={() => setOrganizationModal(null)}
              >
                <Text style={styles.dialogCancelText}>
                  {organizationModal === "tag" ? "Done" : "Cancel"}
                </Text>
              </Pressable>
              <Pressable
                style={styles.dialogSave}
                onPress={() => void saveOrganizationEditor()}
              >
                <Text style={styles.dialogSaveText}>
                  {organizationModal === "tag" &&
                  !editingOrganizationId?.includes("::")
                    ? "Add"
                    : "Save"}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* PER-NOTE IMAGE BACKGROUND GALLERY */}
      <Modal
        transparent
        visible={backgroundGalleryVisible}
        animationType="slide"
        onRequestClose={() => setBackgroundGalleryVisible(false)}
      >
        <View style={styles.sheetOverlay}>
          <View
            style={[
              styles.appearanceSheet,
              { maxHeight: "88%" },
              { backgroundColor: C.surface, borderColor: C.line },
            ]}
          >
            <View style={styles.sheetHandle} />
            <View style={styles.appearanceHeader}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.sheetTitle, { color: C.ink }]}>
                  Choose note background
                </Text>
                <Text style={[styles.sheetSub, { color: C.sub }]}>
                  Select an image for this note only
                </Text>
              </View>
              <Pressable
                onPress={() => setBackgroundGalleryVisible(false)}
                style={styles.detailsCloseButton}
              >
                <Ionicons name="close" size={21} color={C.sub} />
              </Pressable>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8, paddingVertical: 10 }}
            >
              {NOTE_BACKGROUND_CATEGORIES.map((category) => (
                <Pressable
                  key={category}
                  onPress={() => setBackgroundCategory(category)}
                  style={{
                    paddingHorizontal: 13,
                    paddingVertical: 9,
                    borderRadius: 18,
                    backgroundColor:
                      backgroundCategory === category
                        ? accentColor
                        : appTheme === "dark"
                          ? "#263449"
                          : "#F1F5F9",
                  }}
                >
                  <Text
                    style={{
                      color:
                        backgroundCategory === category
                          ? "#FFFFFF"
                          : appTheme === "dark"
                            ? "#E2E8F0"
                            : "#475569",
                      fontWeight: "700",
                      fontSize: 12,
                    }}
                  >
                    {category}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
            <FlatList
              data={NOTE_BACKGROUND_IMAGES.filter(
                (image) =>
                  backgroundCategory === "All" ||
                  image.category === backgroundCategory,
              )}
              keyExtractor={(image) => image.id}
              numColumns={3}
              showsVerticalScrollIndicator={false}
              columnWrapperStyle={{ gap: 10 }}
              contentContainerStyle={{ gap: 10, paddingBottom: 16 }}
              renderItem={({ item: image }) => {
                const selected = actionTodo
                  ? getOrganizationMeta(actionTodo).noteBackgroundImage ===
                    image.id
                  : false;
                return (
                  <Pressable
                    onPress={() => void selectBackgroundForActionTodo(image.id)}
                    style={{
                      flex: 1,
                      maxWidth: "33%",
                      borderRadius: 14,
                      padding: 4,
                      borderWidth: selected ? 2 : 1,
                      borderColor: selected ? accentColor : "#E2E8F0",
                      backgroundColor:
                        appTheme === "dark" ? "#1E293B" : "#FFFFFF",
                    }}
                  >
                    <Image
                      source={image.source}
                      resizeMode="cover"
                      style={{ width: "100%", height: 112, borderRadius: 10 }}
                    />
                    <Text
                      numberOfLines={1}
                      style={{
                        paddingVertical: 7,
                        textAlign: "center",
                        fontSize: 11,
                        fontWeight: "700",
                        color: C.ink,
                      }}
                    >
                      {image.label}
                    </Text>
                    {selected && (
                      <View
                        style={{
                          position: "absolute",
                          top: 8,
                          right: 8,
                          backgroundColor: accentColor,
                          borderRadius: 12,
                          padding: 3,
                        }}
                      >
                        <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                      </View>
                    )}
                  </Pressable>
                );
              }}
            />
            <View style={{ flexDirection: "row", gap: 10, paddingTop: 8 }}>
              <Pressable
                onPress={() => void clearBackgroundForActionTodo()}
                style={[
                  styles.appearanceWideButton,
                  { flex: 1, borderColor: C.line },
                ]}
              >
                <Text style={styles.appearanceWideButtonText}>
                  Remove image
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setBackgroundGalleryVisible(false)}
                style={[
                  styles.appearanceApplyButton,
                  { flex: 1, backgroundColor: accentColor },
                ]}
              >
                <Text style={styles.appearanceApplyText}>Close</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* PER-NOTE  NOTE DETAILS */}

      <Modal
        visible={detailsVisible}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setDetailsVisible(false)}
      >
        <View style={styles.detailsOverlay}>
          <View style={styles.detailsCard}>
            {/* Header */}
            <View style={styles.detailsHeader}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.detailsEyebrow}>NOTE DETAILS</Text>

                <Text
                  style={[
                    styles.detailsTitle,
                    {
                      color:
                        selectedTodo &&
                        getQuickNoteMeta(selectedTodo).isQuickNote
                          ? isDark
                            ? "#E7F5EE"
                            : "#102B20"
                          : C.ink,
                    },
                  ]}
                  numberOfLines={2}
                  ellipsizeMode="tail"
                >
                  {selectedTodo?.title || "Untitled note"}
                </Text>
              </View>

              <Pressable
                onPress={() => setDetailsVisible(false)}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="Close note details"
              >
                <Ionicons name="close" size={23} color={C.sub} />
              </Pressable>
            </View>

            <View style={styles.detailsAccent} />

            {/* Scrollable content */}
            <ScrollView
              style={{
                width: "100%",
                flexGrow: 0,
                flexShrink: 1,
                maxHeight: "90%",
              }}
              contentContainerStyle={{
                paddingHorizontal: 12,
                paddingTop: 8,
                paddingBottom: 6,
              }}
              showsVerticalScrollIndicator
              nestedScrollEnabled
              keyboardShouldPersistTaps="handled"
            >
              {/* Content with clickable hyperlinks */}
              <View style={styles.detailsSection}>
                <Text style={styles.detailsSectionTitle}>Content</Text>

                {(() => {
                  const noteText = selectedTodo?.text?.trim() || "";

                  const contentColor =
                    selectedTodo && getQuickNoteMeta(selectedTodo).isQuickNote
                      ? isDark
                        ? "#DCEFE5"
                        : "#183D2D"
                      : selectedTodo
                        ? getQuickNoteMeta(selectedTodo).textColor || C.ink
                        : C.ink;

                  if (!noteText) {
                    return (
                      <Text
                        style={[
                          styles.detailsContent,
                          {
                            color: contentColor,
                            textAlign:
                              selectedTodo?.alignment ||
                              getQuickNoteMeta(selectedTodo!).alignment ||
                              "left",
                          },
                        ]}
                      >
                        No content available.
                      </Text>
                    );
                  }

                  // Detect HTTPS, HTTP and www links
                  const urlRegex = /(?:https?:\/\/|www\.)[^\s<>"')\]]+/gi;

                  const contentParts: any[] = [];

                  let lastIndex = 0;
                  let match: RegExpExecArray | null;
                  let linkIndex = 0;

                  while ((match = urlRegex.exec(noteText)) !== null) {
                    const originalUrl = match[0];

                    // Remove trailing punctuation
                    const cleanUrl = originalUrl.replace(/[.,!?;:]+$/, "");

                    const trailingText = originalUrl.slice(cleanUrl.length);

                    // Normal text before hyperlink
                    if (match.index > lastIndex) {
                      contentParts.push(noteText.slice(lastIndex, match.index));
                    }

                    // Add HTTPS automatically for www links
                    const openUrl = /^www\./i.test(cleanUrl)
                      ? `https://${cleanUrl}`
                      : cleanUrl;

                    // Clickable hyperlink
                    contentParts.push(
                      <Text
                        key={`hyperlink-${linkIndex++}`}
                        style={{
                          color: "#168A73",
                          textDecorationLine: "underline",
                          fontWeight: "700",
                        }}
                        onPress={async () => {
                          try {
                            await Linking.openURL(openUrl);
                          } catch (error) {
                            console.warn(
                              "[Details] Hyperlink open failed:",
                              openUrl,
                              error,
                            );

                            showAppAlert("Unable to open link", openUrl);
                          }
                        }}
                        accessibilityRole="link"
                        accessibilityLabel={`Open ${cleanUrl}`}
                      >
                        {cleanUrl}
                      </Text>,
                    );

                    // Keep punctuation as normal text
                    if (trailingText) {
                      contentParts.push(trailingText);
                    }

                    lastIndex = match.index + originalUrl.length;
                  }

                  // Remaining normal text
                  if (lastIndex < noteText.length) {
                    contentParts.push(noteText.slice(lastIndex));
                  }

                  return (
                    <Text
                      style={[
                        styles.detailsContent,
                        {
                          color: contentColor,
                          textAlign:
                            selectedTodo?.alignment ||
                            getQuickNoteMeta(selectedTodo!).alignment ||
                            "left",
                        },
                      ]}
                    >
                      {contentParts}
                    </Text>
                  );
                })()}
              </View>

              {/* Sketch / Drawing */}
              {!!selectedSketchUri && (
                <View style={styles.detailsSection}>
                  <Text style={styles.detailsSectionTitle}>
                    Sketch &amp; Drawing
                  </Text>

                  <Image
                    source={{ uri: selectedSketchUri }}
                    style={[
                      styles.detailsSketchImage,
                      {
                        height: 130,
                        marginTop: 4,
                      },
                    ]}
                    resizeMode="contain"
                    onError={(event) => {
                      console.warn(
                        "[Details] Sketch loading failed:",
                        event.nativeEvent.error,
                      );
                    }}
                  />
                </View>
              )}

              {/* Image / Audio / Video / File Attachments */}
              {(() => {
                const item = selectedTodo as any;

                const fileIds: string[] = Array.isArray(item?.fileIds)
                  ? item.fileIds
                      .filter(
                        (fileId: unknown) =>
                          fileId !== null &&
                          fileId !== undefined &&
                          String(fileId).trim() !== "",
                      )
                      .map((fileId: unknown) => String(fileId))
                  : [];

                const rawTypes = item?.type;

                const fileTypes: string[] = Array.isArray(rawTypes)
                  ? rawTypes.map((value: unknown) => String(value ?? ""))
                  : rawTypes
                    ? [String(rawTypes)]
                    : [];

                const rawNames = Array.isArray(item?.fileNames)
                  ? item.fileNames
                  : Array.isArray(item?.attachmentNames)
                    ? item.attachmentNames
                    : [];

                if (fileIds.length === 0) return null;

                const baseUrl = API_BASE_URL.replace(/\/+$/, "");

                const normalizeType = (value: string) =>
                  value.toLowerCase().trim().split(";")[0].trim();

                const extensionOf = (name: string) =>
                  name
                    .split("?")[0]
                    .split("#")[0]
                    .split(".")
                    .pop()
                    ?.toLowerCase() || "";

                return (
                  <View
                    style={[
                      styles.detailsSection,
                      {
                        width: "100%",
                        alignSelf: "stretch",
                        marginBottom: 8,
                      },
                    ]}
                  >
                    <Text style={styles.detailsSectionTitle}>
                      Attachments ({fileIds.length})
                    </Text>

                    {fileIds.map((id, index) => {
                      const nameValue = rawNames[index];

                      const fileName =
                        typeof nameValue === "string" && nameValue.trim()
                          ? nameValue.trim()
                          : "";

                      const type = normalizeType(
                        String(fileTypes[index] ?? fileTypes[0] ?? ""),
                      );

                      const extension = extensionOf(fileName);

                      const mediaUrl = `${baseUrl}/api/media/${encodeURIComponent(id)}`;

                      const isImage =
                        type.startsWith("image/") ||
                        type === "image" ||
                        /\.(jpg|jpeg|png|webp|gif|bmp|heic|heif|avif)$/i.test(
                          type,
                        ) ||
                        [
                          "jpg",
                          "jpeg",
                          "png",
                          "webp",
                          "gif",
                          "bmp",
                          "heic",
                          "heif",
                          "avif",
                        ].includes(extension);

                      const isAudio =
                        type.startsWith("audio/") ||
                        type === "audio" ||
                        type === "webm-audio" ||
                        /\.(mp3|m4a|aac|wav|ogg|opus|flac)$/i.test(type) ||
                        [
                          "mp3",
                          "m4a",
                          "aac",
                          "wav",
                          "ogg",
                          "opus",
                          "flac",
                        ].includes(extension) ||
                        (extension === "webm" &&
                          /(voice|audio|recording|record|mic|speech)/i.test(
                            fileName,
                          ));

                      const isVideo =
                        type.startsWith("video/") ||
                        type === "video" ||
                        /\.(mp4|mov|mkv|webm|avi|3gp|m4v)$/i.test(type) ||
                        [
                          "mp4",
                          "mov",
                          "mkv",
                          "webm",
                          "avi",
                          "3gp",
                          "m4v",
                        ].includes(extension);

                      const displayName =
                        fileName ||
                        (isImage
                          ? "Image attachment"
                          : isAudio
                            ? "Audio attachment"
                            : isVideo
                              ? "Video attachment"
                              : "File attachment");

                      // Image attachment
                      if (isImage) {
                        return (
                          <View
                            key={`${id}-${index}`}
                            style={{
                              width: "100%",
                              marginTop: 5,
                              marginBottom: 5,
                              padding: 5,
                              borderRadius: 10,
                              backgroundColor: C.surface,
                              borderWidth: 1,
                              borderColor: C.line,
                            }}
                          >
                            <Image
                              source={{ uri: mediaUrl }}
                              style={{
                                width: "100%",
                                height: 150,
                                borderRadius: 7,
                                backgroundColor: C.bg,
                              }}
                              resizeMode="contain"
                              fadeDuration={0}
                              onError={(event) => {
                                console.warn(
                                  "[Details] Image error:",
                                  mediaUrl,
                                  event.nativeEvent.error,
                                );
                              }}
                            />

                            <Text
                              style={[styles.detailsMediaSub, { marginTop: 5 }]}
                              numberOfLines={2}
                            >
                              {displayName}
                            </Text>
                          </View>
                        );
                      }

                      // Audio attachment
                      if (isAudio) {
                        return (
                          <View
                            key={`${id}-${index}`}
                            style={{
                              width: "100%",
                              marginTop: 5,
                            }}
                          >
                            <DetailsAudioPlayer
                              uri={mediaUrl}
                              title={displayName}
                            />
                          </View>
                        );
                      }

                      // Video attachment
                      if (isVideo) {
                        return (
                          <View
                            key={`${id}-${index}`}
                            style={{
                              width: "100%",
                              marginTop: 5,
                            }}
                          >
                            <DetailsVideoPlayer
                              uri={mediaUrl}
                              title={displayName}
                            />
                          </View>
                        );
                      }

                      // Document / Other file attachment
                      return (
                        <Pressable
                          key={`${id}-${index}`}
                          style={[
                            styles.detailsMediaRow,
                            {
                              marginTop: 5,
                              paddingVertical: 12,
                              paddingHorizontal: 10,
                              borderRadius: 10,
                              backgroundColor: C.surface,
                              borderWidth: 1,
                              borderColor: C.line,
                            },
                          ]}
                          onPress={async () => {
                            try {
                              await Linking.openURL(mediaUrl);
                            } catch (error) {
                              console.warn(
                                "[Details] Could not open attachment:",
                                mediaUrl,
                                error,
                              );
                            }
                          }}
                          accessibilityRole="button"
                          accessibilityLabel={`Open ${displayName}`}
                        >
                          <Ionicons
                            name="document-text-outline"
                            size={26}
                            color={C.primary}
                          />

                          <View
                            style={{
                              flex: 1,
                              marginLeft: 10,
                            }}
                          >
                            <Text
                              style={styles.detailsMediaTitle}
                              numberOfLines={2}
                            >
                              {displayName}
                            </Text>

                            <Text style={styles.detailsMediaSub}>
                              {type ||
                                (extension
                                  ? `${extension.toUpperCase()} file`
                                  : "Document")}
                            </Text>
                          </View>

                          <View
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                              gap: 5,
                            }}
                          >
                            <Text
                              style={{
                                color: C.primary,
                                fontSize: 12,
                                fontWeight: "600",
                              }}
                            >
                              Open
                            </Text>

                            <Ionicons
                              name="open-outline"
                              size={18}
                              color={C.primary}
                            />
                          </View>
                        </Pressable>
                      );
                    })}
                  </View>
                );
              })()}

              {/* Information */}
              {(() => {
                if (!selectedTodo) return null;

                const item = selectedTodo as any;
                const organization = getOrganizationMeta(selectedTodo);

                const folderName =
                  noteFolders.find(
                    (folder) => folder.id === organization.folderId,
                  )?.name ??
                  item.folderName ??
                  (typeof item.folder === "string" ? item.folder : undefined);

                const info = [
                  {
                    label: "Status",
                    value: item.status,
                  },
                  {
                    label: "Priority",
                    value: organization.priority ?? item.priority,
                  },
                  {
                    label: "Folder",
                    value: folderName,
                  },
                  {
                    label: "Created",
                    value: item.createdAt
                      ? new Date(item.createdAt).toLocaleDateString()
                      : undefined,
                  },
                  {
                    label: "Modified",
                    value: item.updatedAt
                      ? new Date(item.updatedAt).toLocaleDateString()
                      : undefined,
                  },
                ].filter(
                  (entry) =>
                    entry.value !== undefined &&
                    entry.value !== null &&
                    String(entry.value).trim() !== "",
                );

                if (!info.length) return null;

                return (
                  <View style={[styles.detailsSection, { marginBottom: 4 }]}>
                    <Text
                      style={[styles.detailsSectionTitle, { marginBottom: 5 }]}
                    >
                      Information
                    </Text>

                    <View
                      style={{
                        flexDirection: "row",
                        flexWrap: "wrap",
                        gap: 5,
                      }}
                    >
                      {info.map((entry) => (
                        <View
                          key={entry.label}
                          style={{
                            width: "48%",
                            flexGrow: 1,
                            minWidth: 95,
                            paddingHorizontal: 7,
                            paddingVertical: 5,
                            borderRadius: 7,
                            backgroundColor: C.surface,
                            borderWidth: 1,
                            borderColor: C.line,
                          }}
                        >
                          <Text
                            style={{
                              fontSize: 10,
                              color: "#648477",
                              marginBottom: 1,
                            }}
                          >
                            {entry.label}
                          </Text>

                          <Text
                            numberOfLines={1}
                            ellipsizeMode="tail"
                            style={{
                              fontSize: 11,
                              fontWeight: "600",
                              color: "#164E3B",
                            }}
                          >
                            {String(entry.value)}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </View>
                );
              })()}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* move folder */}

      <Modal
        visible={folderPickerVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setFolderPickerVisible(false)}
      >
        <View style={styles.folderModalOverlay}>
          <View style={styles.folderModalContainer}>
            {/* Header */}
            <View style={styles.folderModalHeader}>
              <View>
                <Text style={styles.folderModalTitle}>Move note</Text>
                <Text style={styles.folderModalSubtitle}>
                  Choose a destination folder
                </Text>
              </View>

              <TouchableOpacity
                onPress={() => setFolderPickerVisible(false)}
                style={styles.folderCloseButton}
              >
                <Text style={styles.folderCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Scrollable folder list */}
            <ScrollView
              style={styles.folderList}
              contentContainerStyle={styles.folderListContent}
              showsVerticalScrollIndicator
              nestedScrollEnabled
            >
              {/* No folder */}
              <TouchableOpacity
                style={styles.folderOption}
                onPress={() => {
                  if (selectedTodoForFolder) {
                    void updateNoteMeta(selectedTodoForFolder, {
                      folderId: undefined,
                    });
                  }
                  setFolderPickerVisible(false);
                }}
              >
                <View style={styles.folderIconBox}>
                  <Text style={styles.folderIcon}>📂</Text>
                </View>

                <Text style={styles.folderOptionText}>No folder</Text>
              </TouchableOpacity>

              {/* All folders */}
              {noteFolders.map((folder) => (
                <TouchableOpacity
                  key={folder.id}
                  style={styles.folderOption}
                  onPress={() => {
                    if (selectedTodoForFolder) {
                      void updateNoteMeta(selectedTodoForFolder, {
                        folderId: folder.id,
                      });
                    }
                    setFolderPickerVisible(false);
                  }}
                >
                  <View style={styles.folderIconBox}>
                    <Text style={styles.folderIcon}>📁</Text>
                  </View>

                  <Text style={styles.folderOptionText} numberOfLines={1}>
                    {folder.name}
                  </Text>

                  <Text style={styles.folderArrow}>›</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Footer */}
            <TouchableOpacity
              style={styles.folderCancelButton}
              onPress={() => setFolderPickerVisible(false)}
            >
              <Text style={styles.folderCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* priority */}

      <Modal
        visible={priorityModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setPriorityModalVisible(false)}
      >
        <View style={styles.priorityOverlay}>
          <View style={styles.priorityContainer}>
            <Text style={styles.priorityTitle}>Set Priority</Text>
            <Text style={styles.prioritySubtitle}>
              Choose a priority for your note
            </Text>

            {[
              {
                label: "High",
                icon: "flag",
                color: "#DC2626",
                bg: "#FEF2F2",
                value: "High",
              },
              {
                label: "Medium",
                icon: "flag",
                color: "#D97706",
                bg: "#FFFBEB",
                value: "Medium",
              },
              {
                label: "Low",
                icon: "flag-outline",
                color: "#16A34A",
                bg: "#F0FDF4",
                value: "Low",
              },
            ].map((item) => (
              <Pressable
                key={item.value}
                style={styles.priorityOption}
                onPress={() => {
                  if (priorityTodo) {
                    void updateNoteMeta(priorityTodo, {
                      priority: item.value,
                    });
                  }
                  setPriorityModalVisible(false);
                }}
              >
                <View
                  style={[styles.priorityIconBox, { backgroundColor: item.bg }]}
                >
                  <Ionicons
                    name={item.icon as any}
                    size={19}
                    color={item.color}
                  />
                </View>

                <Text style={styles.priorityOptionText}>{item.label}</Text>

                <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
              </Pressable>
            ))}

            {/* Remove priority */}
            <Pressable
              style={styles.removePriorityOption}
              onPress={() => {
                if (priorityTodo) {
                  void updateNoteMeta(priorityTodo, {
                    priority: undefined,
                  });
                }
                setPriorityModalVisible(false);
              }}
            >
              <View style={styles.removePriorityIcon}>
                <Ionicons name="flag-outline" size={19} color="#DC2626" />
                <View style={styles.removePriorityLine} />
              </View>

              <Text style={styles.removePriorityText}>Remove Priority</Text>
            </Pressable>

            <Pressable
              style={styles.priorityCancelButton}
              onPress={() => setPriorityModalVisible(false)}
            >
              <Text style={styles.priorityCancelText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal
        visible={createChoiceVisible}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setCreateChoiceVisible(false)}
      >
        <Pressable
          style={{
            flex: 1,
            backgroundColor: "rgba(10, 30, 23, 0.38)",
            justifyContent: "center",
            alignItems: "center",
            padding: 20,
          }}
          onPress={() => setCreateChoiceVisible(false)}
        >
          <Pressable
            onPress={(event) => event.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: 440,
              backgroundColor: C.surface,
              borderRadius: 22,
              padding: 24,
              borderWidth: 1,
              borderColor: C.line,
              elevation: 12,
              shadowColor: "#000",
              shadowOpacity: 0.12,
              shadowRadius: 20,
              shadowOffset: { width: 0, height: 8 },
            }}
          >
            <Text
              style={{
                fontSize: 23,
                fontWeight: "800",
                color: C.ink,
              }}
            >
              Create new
            </Text>

            <Text
              style={{
                fontSize: 14,
                color: C.sub,
                marginTop: 6,
                marginBottom: 22,
              }}
            >
              What would you like to create?
            </Text>

            <Pressable
              onPress={openQuickNote}
              style={{
                flexDirection: "row",
                alignItems: "center",
                padding: 18,
                borderRadius: 16,
                backgroundColor: C.primarySoft,
                marginBottom: 12,
                gap: 14,
              }}
            >
              <Text style={{ fontSize: 27 }}>⚡</Text>

              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 16, fontWeight: "800", color: C.ink }}>
                  Quick Note
                </Text>
                <Text style={{ fontSize: 12, color: C.sub, marginTop: 3 }}>
                  Quickly capture your thoughts
                </Text>
              </View>

              <Text style={{ fontSize: 22, color: C.primary }}>›</Text>
            </Pressable>

            <Pressable
              onPress={openTodoTask}
              style={{
                flexDirection: "row",
                alignItems: "center",
                padding: 18,
                borderRadius: 16,
                backgroundColor: C.bg,
                borderWidth: 1,
                borderColor: C.line,
                gap: 14,
              }}
            >
              <Text style={{ fontSize: 27 }}>☑</Text>

              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 16, fontWeight: "800", color: C.ink }}>
                  Todo Task
                </Text>
                <Text style={{ fontSize: 12, color: C.sub, marginTop: 3 }}>
                  Create and manage your tasks
                </Text>
              </View>

              <Text style={{ fontSize: 22, color: C.primary }}>›</Text>
            </Pressable>

            <Pressable
              onPress={() => setCreateChoiceVisible(false)}
              style={{
                alignItems: "center",
                paddingVertical: 14,
                marginTop: 8,
              }}
            >
              <Text style={{ color: C.sub, fontWeight: "700" }}>Cancel</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Share with others - Desktop custom share dialog */}
      <Modal
        visible={shareDialogVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setShareDialogVisible(false)}
      >
        <Pressable
          onPress={() => setShareDialogVisible(false)}
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.48)",
            justifyContent: "center",
            alignItems: "center",
            padding: 20,
          }}
        >
          <Pressable
            onPress={(event) => event.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: 440,
              backgroundColor: C.surface,
              borderRadius: 24,
              padding: 22,
              borderWidth: 1,
              borderColor: C.line,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <View style={{ flex: 1 }}>
                <Text style={{ color: C.ink, fontSize: 21, fontWeight: "800" }}>
                  Share with others
                </Text>
                <Text style={{ color: C.sub, fontSize: 13, marginTop: 5 }}>
                  Choose an app to share your note
                </Text>
              </View>
              <Pressable
                onPress={() => setShareDialogVisible(false)}
                accessibilityRole="button"
                accessibilityLabel="Close share dialog"
                style={{ padding: 7 }}
              >
                <Ionicons name="close" size={23} color={C.sub} />
              </Pressable>
            </View>

            <View
              style={{
                flexDirection: "row",
                flexWrap: "wrap",
                gap: 10,
                marginTop: 22,
              }}
            >
              {(
                [
                  {
                    key: "whatsapp",
                    label: "WhatsApp",
                    icon: "logo-whatsapp",
                    color: "#25D366",
                  },
                  {
                    key: "gmail",
                    label: "Gmail",
                    icon: "mail",
                    color: "#EA4335",
                  },
                  {
                    key: "outlook",
                    label: "Outlook",
                    icon: "mail-outline",
                    color: "#0078D4",
                  },
                  {
                    key: "telegram",
                    label: "Telegram",
                    icon: "paper-plane",
                    color: "#229ED9",
                  },
                ] as const
              ).map((item) => (
                <Pressable
                  key={item.key}
                  onPress={() => void shareWithDesktopApp(item.key)}
                  accessibilityRole="button"
                  style={({ pressed }) => ({
                    width: "48%",
                    flexGrow: 1,
                    minHeight: 76,
                    borderRadius: 15,
                    borderWidth: 1,
                    borderColor: C.line,
                    backgroundColor: pressed ? C.primarySoft : C.bg,
                    padding: 13,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 11,
                  })}
                >
                  <View
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 13,
                      backgroundColor: C.surface,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Ionicons
                      name={item.icon as any}
                      size={23}
                      color={item.color}
                    />
                  </View>
                  <Text
                    style={{ color: C.ink, fontSize: 13, fontWeight: "800" }}
                  >
                    {item.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Pressable
              onPress={() => void copyShareText()}
              accessibilityRole="button"
              style={({ pressed }) => ({
                marginTop: 14,
                minHeight: 48,
                borderRadius: 14,
                backgroundColor: pressed ? C.primary : C.primarySoft,
                borderWidth: 1,
                borderColor: C.line,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 9,
              })}
            >
              <Ionicons name="copy-outline" size={19} color={C.primary} />
              <Text style={{ color: C.ink, fontWeight: "800", fontSize: 14 }}>
                Copy note
              </Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Reusable cross-platform alert/confirmation dialog.
          Works in Android, Expo Web and Electron Desktop. */}
      <Modal
        visible={appAlert.visible}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={closeAppAlert}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.48)",
            justifyContent: "center",
            alignItems: "center",
            padding: 20,
          }}
        >
          <Pressable
            style={StyleSheet.absoluteFillObject}
            onPress={closeAppAlert}
            accessibilityRole="button"
            accessibilityLabel="Close alert"
          />
          <View
            style={{
              width: "100%",
              maxWidth: 430,
              borderRadius: 18,
              padding: 22,
              backgroundColor: C.surface,
              borderWidth: 1,
              borderColor: C.line,
              shadowColor: "#000000",
              shadowOffset: { width: 0, height: 10 },
              shadowOpacity: 0.18,
              shadowRadius: 24,
              elevation: 12,
            }}
          >
            <Text
              style={{
                color: C.ink,
                fontSize: 19,
                fontWeight: "800",
                marginBottom: appAlert.message ? 9 : 2,
              }}
            >
              {appAlert.title}
            </Text>

            {!!appAlert.message && (
              <Text
                style={{
                  color: C.sub,
                  fontSize: 14,
                  lineHeight: 21,
                }}
              >
                {appAlert.message}
              </Text>
            )}

            <View
              style={{
                flexDirection: "row",
                flexWrap: "wrap",
                justifyContent: "flex-end",
                alignItems: "center",
                gap: 9,
                marginTop: 24,
              }}
            >
              {appAlert.buttons.map((button, index) => {
                const destructive = button.style === "destructive";
                const cancel = button.style === "cancel";
                return (
                  <Pressable
                    key={`${button.text}-${index}`}
                    onPress={() => pressAppAlertButton(button)}
                    accessibilityRole="button"
                    style={({ pressed }) => ({
                      minHeight: 42,
                      paddingHorizontal: 17,
                      borderRadius: 11,
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: destructive
                        ? C.danger
                        : cancel
                          ? C.bg
                          : C.primary,
                      borderWidth: cancel ? 1 : 0,
                      borderColor: C.line,
                      opacity: pressed ? 0.78 : 1,
                    })}
                  >
                    <Text
                      style={{
                        color: cancel ? C.ink : "#FFFFFF",
                        fontSize: 13,
                        fontWeight: "800",
                      }}
                    >
                      {button.text}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ============================================================
// STYLES
// ============================================================
const shadow = {
  shadowColor: "#1B1D4B",
  shadowOffset: { width: 0, height: 6 },
  shadowOpacity: 0.07,
  shadowRadius: 16,
  elevation: 3,
} as const;

const createStyles = (C: typeof COLORS) =>
  StyleSheet.create({
    calendarActionsContainer: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "flex-end",
      gap: 8,
    },

    calendarLinkNoteButton: {
      height: 36,
      minWidth: 100,
      paddingHorizontal: 12,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 10,
    },

    calendarLinkNoteText: {
      marginLeft: 5,
      fontSize: 13,
      fontWeight: "600",
      includeFontPadding: false,
      textAlignVertical: "center",
    },

    calendarTodayButton: {
      height: 36,
      minWidth: 68,
      paddingHorizontal: 12,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 10,
    },

    detailsCard: {
      width: "92%",
      maxHeight: "87%",
      flexGrow: 0,
      flexShrink: 1,
      alignSelf: "center",
      backgroundColor: C.surface,
      borderRadius: 18,
      overflow: "hidden",
      elevation: 8,
    },

    detailsOverlay: {
      flex: 1,
      backgroundColor: "rgba(15, 23, 42, 0.40)",
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: 12,
      paddingVertical: 12,
    },

    detailsHeader: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 14,
      paddingTop: 10,
      paddingBottom: 8,
      gap: 10,
    },

    detailsEyebrow: {
      fontSize: 9,
      fontWeight: "700",
      letterSpacing: 1,
      color: C.sub,
      marginBottom: 2,
    },

    detailsTitle: {
      fontSize: 17,
      fontWeight: "700",
      color: C.ink,
    },

    detailsAccent: {
      height: 2,
      backgroundColor: "#A7E8CC",
    },

    detailsSection: {
      marginBottom: 8,
    },

    detailsSectionTitle: {
      fontSize: 12,
      fontWeight: "700",
      color: C.ink,
      marginBottom: 5,
    },

    detailsContent: {
      fontSize: 13,
      lineHeight: 19,
      color: C.ink,
    },

    detailsSketchImage: {
      width: "100%",
      height: 130,
      borderRadius: 9,
      backgroundColor: C.bg,
    },

    detailsAttachment: {
      marginBottom: 6,
    },

    detailsAttachmentImage: {
      width: "100%",
      height: 140,
      borderRadius: 9,
      backgroundColor: C.bg,
    },

    detailsMediaRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingVertical: 5,
    },

    detailsMediaTitle: {
      fontSize: 12,
      fontWeight: "600",
      color: C.ink,
    },

    detailsMediaSub: {
      fontSize: 10,
      color: C.sub,
      marginTop: 2,
    },

    compactDetailsFooter: {
      paddingHorizontal: 12,
      paddingTop: 3,
      paddingBottom: 5,
      borderTopWidth: 1,
      borderTopColor: C.line,
      backgroundColor: C.surface,
    },

    detailsDoneButton: {
      height: 34,
      borderRadius: 8,
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: 14,
    },

    detailsDoneButtonText: {
      color: "#FFFFFF",
      fontSize: 13,
      fontWeight: "700",
    },

    detailsProgressTrack: {
      height: 4,
      backgroundColor: C.line,
      borderRadius: 4,
      overflow: "hidden",
      marginTop: 8,
    },

    detailsProgressFill: {
      height: "100%",
      backgroundColor: C.primary,
      borderRadius: 4,
    },

    detailsVideoContainer: {
      width: "100%",
      marginBottom: 8,
    },

    detailsVideo: {
      width: "100%",
      height: 220,
      borderRadius: 10,
      backgroundColor: "#000000",
    },

    compactDetailSection: {
      marginBottom: 18,
    },

    compactDetailHeading: {
      fontSize: 13,
      fontWeight: "700",
      color: C.ink,
      marginBottom: 8,
    },

    compactSketchImage: {
      width: "100%",
      height: 190,
      borderRadius: 10,
      backgroundColor: C.bg || "#F8FAFC",
    },

    compactAttachmentList: {
      gap: 10,
    },

    compactAttachmentImage: {
      width: "100%",
      height: 190,
      borderRadius: 10,
      backgroundColor: C.bg || "#F8FAFC",
    },

    compactFileRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingVertical: 8,
    },

    compactFileText: {
      fontSize: 13,
      color: C.ink,
    },

    compactInfoRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      paddingVertical: 8,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: C.line || "#E2E8F0",
      gap: 12,
    },

    compactInfoLabel: {
      fontSize: 12,
      color: C.sub,
      flex: 1,
    },

    compactInfoValue: {
      fontSize: 12,
      color: C.ink,
      fontWeight: "600",
      flex: 2,
      textAlign: "right",
    },

    detailsInfoGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 10,
    },

    detailsInfoTile: {
      width: "48%",
      flexGrow: 1,
      flexBasis: "42%",
      minHeight: 125,
      padding: 13,
      borderRadius: 18,
      backgroundColor: C.surface,
      borderWidth: 1,
      borderColor: C.line,
    },

    detailsInfoTileIcon: {
      width: 39,
      height: 39,
      borderRadius: 13,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 12,
    },

    detailsInfoTileLabel: {
      fontSize: 11,
      fontWeight: "600",
      color: C.sub,
      marginBottom: 5,
    },

    detailsInfoTileValue: {
      fontSize: 13,
      lineHeight: 19,
      fontWeight: "800",
      color: C.ink,
    },

    detailsHeaderIcon: {
      width: 48,
      height: 48,
      borderRadius: 16,
      backgroundColor: C.primarySoft,
      alignItems: "center",
      justifyContent: "center",
    },

    detailsTitleContainer: {
      flex: 1,
      minWidth: 0,
    },

    detailsSubtitle: {
      marginTop: 4,
      fontSize: 12,
      color: C.sub,
    },

    detailsCloseButton: {
      width: 38,
      height: 38,
      borderRadius: 13,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: C.bg || "#F1F5F9",
      borderWidth: 1,
      borderColor: C.line || "#E2E8F0",
    },

    detailsScroll: {
      flexShrink: 1,
    },

    detailsScrollContent: {
      paddingHorizontal: 20,
      paddingTop: 20,
      paddingBottom: 12,
    },

    detailsSectionHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 9,
      marginTop: 6,
      marginBottom: 12,
    },

    detailsSectionIcon: {
      width: 32,
      height: 32,
      borderRadius: 11,
      backgroundColor: C.primarySoft,
      alignItems: "center",
      justifyContent: "center",
    },

    detailsContentBox: {
      padding: 16,
      minHeight: 90,
      borderRadius: 17,
      backgroundColor: C.bg || "#F8FAFC",
      borderWidth: 1,
      borderColor: C.line || "#E2E8F0",
      marginBottom: 22,
    },

    detailsOptionalBadge: {
      paddingHorizontal: 9,
      paddingVertical: 5,
      borderRadius: 20,
      backgroundColor: C.bg,
    },

    detailsOptionalText: {
      fontSize: 10,
      fontWeight: "700",
      color: C.sub,
    },

    detailsSketchBox: {
      minHeight: 170,
      borderRadius: 18,
      overflow: "hidden",
      backgroundColor: C.bg || "#F8FAFC",
      borderWidth: 1,
      borderColor: C.line || "#E2E8F0",
      marginBottom: 22,
    },

    noSketchContainer: {
      minHeight: 170,
      padding: 20,
      alignItems: "center",
      justifyContent: "center",
    },

    noSketchIcon: {
      width: 54,
      height: 54,
      borderRadius: 18,
      backgroundColor: C.primarySoft,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 12,
    },

    noSketchTitle: {
      fontSize: 14,
      fontWeight: "700",
      color: C.ink,
    },

    noSketchText: {
      fontSize: 12,
      color: C.sub,
      marginTop: 5,
      textAlign: "center",
    },

    detailsInfoCard: {
      borderRadius: 18,
      paddingHorizontal: 14,
      backgroundColor: C.bg || "#F8FAFC",
      borderWidth: 1,
      borderColor: C.line || "#E2E8F0",
    },

    detailsInfoRow: {
      flexDirection: "row",
      alignItems: "center",
      minHeight: 64,
      paddingVertical: 10,
      gap: 12,
    },

    detailsInfoIcon: {
      width: 40,
      height: 40,
      borderRadius: 13,
      backgroundColor: C.primarySoft,
      alignItems: "center",
      justifyContent: "center",
    },

    detailsInfoText: {
      flex: 1,
      minWidth: 0,
    },

    detailsInfoLabel: {
      fontSize: 11,
      fontWeight: "600",
      color: C.sub,
      marginBottom: 4,
    },

    detailsInfoValue: {
      fontSize: 13,
      fontWeight: "700",
      color: C.ink,
      lineHeight: 19,
    },

    detailsInfoDivider: {
      height: 1,
      backgroundColor: C.line || "#E2E8F0",
      marginLeft: 52,
    },

    detailsFooter: {
      paddingHorizontal: 20,
      paddingTop: 12,
      paddingBottom: 16,
      borderTopWidth: 1,
      borderTopColor: C.line || "#E2E8F0",
      backgroundColor: C.surface || "#FFFFFF",
    },

    priorityOverlay: {
      flex: 1,
      backgroundColor: "rgba(15, 23, 42, 0.45)",
      justifyContent: "center",
      alignItems: "center",
      padding: 22,
    },

    priorityContainer: {
      width: "100%",
      maxWidth: 400,
      backgroundColor: C.surface,
      borderRadius: 22,
      padding: 20,
    },

    priorityTitle: {
      fontSize: 21,
      fontWeight: "700",
      color: C.ink,
    },

    prioritySubtitle: {
      fontSize: 13,
      color: C.sub,
      marginTop: 5,
      marginBottom: 18,
    },

    priorityOption: {
      flexDirection: "row",
      alignItems: "center",
      padding: 11,
      marginBottom: 8,
      borderRadius: 13,
      backgroundColor: C.surface,
      borderWidth: 1,
      borderColor: C.line,
    },

    priorityIconBox: {
      width: 40,
      height: 40,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      marginRight: 12,
    },

    priorityOptionText: {
      flex: 1,
      fontSize: 15,
      fontWeight: "600",
      color: C.ink,
    },

    removePriorityOption: {
      flexDirection: "row",
      alignItems: "center",
      padding: 12,
      marginTop: 3,
      borderRadius: 13,
      backgroundColor: C.dangerSoft,
      borderWidth: 1,
      borderColor: C.dangerSoft,
    },

    removePriorityIcon: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: C.dangerSoft,
      alignItems: "center",
      justifyContent: "center",
      marginRight: 12,
    },

    removePriorityLine: {
      position: "absolute",
      width: 23,
      height: 2,
      backgroundColor: "#DC2626",
      transform: [{ rotate: "-45deg" }],
    },

    removePriorityText: {
      fontSize: 14,
      fontWeight: "600",
      color: C.danger,
    },

    priorityCancelButton: {
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 13,
      marginTop: 12,
      borderRadius: 12,
      backgroundColor: C.primarySoft,
    },

    priorityCancelText: {
      fontSize: 14,
      fontWeight: "700",
      color: C.primary,
    },

    folderChipsContainer: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingVertical: 10,
      gap: 9,
    },

    folderChip: {
      flexDirection: "row",
      alignItems: "center",
      alignSelf: "flex-start",
      minHeight: 40,
      maxWidth: 230,
      paddingLeft: 13,
      paddingRight: 10,
      borderRadius: 14,
      borderWidth: 1,
      gap: 7,
    },

    folderChipActive: {
      backgroundColor: "#238665",
      borderColor: "#238665",
      elevation: 2,
      shadowColor: "#238665",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.14,
      shadowRadius: 4,
    },

    folderChipInactive: {
      backgroundColor: C.primarySoft,
      borderColor: C.line,
    },

    folderChipPressed: {
      opacity: 0.75,
      transform: [{ scale: 0.97 }],
    },

    folderChipText: {
      flexShrink: 1,
      fontSize: 13,
      fontWeight: "600",
      color: C.ink,
    },

    folderChipTextActive: {
      flexShrink: 1,
      fontSize: 13,
      fontWeight: "700",
      color: "#FFFFFF",
    },

    folderChipClose: {
      width: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: "rgba(255,255,255,0.18)",
      alignItems: "center",
      justifyContent: "center",
    },

    folderChipMore: {
      width: 25,
      height: 28,
      alignItems: "center",
      justifyContent: "center",
      marginLeft: 1,
    },

    folderModalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.45)",
      justifyContent: "center",
      alignItems: "center",
      padding: 20,
    },

    folderModalContainer: {
      width: "100%",
      maxWidth: 420,
      maxHeight: "80%",
      backgroundColor: C.surface,
      borderRadius: 22,
      padding: 18,
      overflow: "hidden",
    },

    folderModalHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 16,
    },

    folderModalTitle: {
      fontSize: 20,
      fontWeight: "700",
      color: C.ink,
    },

    folderModalSubtitle: {
      fontSize: 13,
      color: C.sub,
      marginTop: 4,
    },

    folderCloseButton: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: C.primarySoft,
      alignItems: "center",
      justifyContent: "center",
    },

    folderCloseText: {
      fontSize: 16,
      color: C.primary,
    },

    folderList: {
      flexShrink: 1,
    },

    folderListContent: {
      paddingBottom: 6,
    },

    folderOption: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 12,
      paddingHorizontal: 10,
      marginBottom: 6,
      backgroundColor: C.surface,
      borderRadius: 13,
      borderWidth: 1,
      borderColor: C.line,
    },

    folderIconBox: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: C.primarySoft,
      alignItems: "center",
      justifyContent: "center",
      marginRight: 12,
    },

    folderIcon: {
      fontSize: 20,
    },

    folderOptionText: {
      flex: 1,
      fontSize: 15,
      fontWeight: "500",
      color: C.ink,
    },

    folderArrow: {
      fontSize: 25,
      color: C.sub,
      marginLeft: 8,
    },

    folderCancelButton: {
      marginTop: 10,
      paddingVertical: 13,
      borderRadius: 12,
      backgroundColor: C.primarySoft,
      alignItems: "center",
    },

    folderCancelText: {
      fontSize: 15,
      fontWeight: "600",
      color: C.primary,
    },
    homeGreeting: {
      fontSize: 22,
      lineHeight: 28,
      fontWeight: "800",
      letterSpacing: -0.5,
      paddingHorizontal: 2,
    },
    safeArea: { flex: 1, backgroundColor: C.bg },
    container: { flex: 1, backgroundColor: C.bg },

    // Desktop-only responsive workspace styles.
    desktopSafeArea: {
      alignItems: "center",
    },
    desktopContainer: {
      width: "100%",
      maxWidth: 1440,
      alignSelf: "center",
      paddingHorizontal: 30,
    },
    desktopHeader: {
      paddingHorizontal: 8,
      paddingTop: 22,
      paddingBottom: 12,
      minHeight: 82,
    },
    desktopHeaderCenter: {
      marginHorizontal: 18,
    },
    desktopHeaderTitle: {
      fontSize: 30,
      letterSpacing: -1,
    },
    desktopHeaderHint: {
      fontSize: 12,
      marginTop: 4,
    },
    desktopListContent: {
      width: "100%",
      maxWidth: 1280,
      alignSelf: "center",
      paddingHorizontal: 18,
      paddingTop: 24,
      paddingBottom: 48,
    },
    desktopListHeader: {
      width: "100%",
    },
    desktopIntro: {
      minHeight: 124,
      marginBottom: 24,
      paddingHorizontal: 8,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 20,
    },
    desktopEyebrow: {
      color: "#16866B",
      fontSize: 11,
      fontWeight: "800",
      letterSpacing: 1.8,
      marginBottom: 8,
    },
    desktopPageTitle: {
      fontSize: 31,
      lineHeight: 38,
      fontWeight: "800",
      letterSpacing: -1,
    },
    desktopPageSubtitle: {
      fontSize: 14,
      marginTop: 6,
    },
    desktopIntroBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: 15,
      paddingVertical: 10,
      borderRadius: 30,
      backgroundColor: "#DDF4EB",
      borderWidth: 1,
      borderColor: "#C3E8D8",
    },
    desktopIntroBadgeText: {
      color: "#155E50",
      fontSize: 12,
      fontWeight: "700",
    },
    desktopGridRow: {
      gap: 18,
    },
    desktopSearchContainer: {
      width: "100%",
      maxWidth: 920,
      minHeight: 54,
      marginTop: 20,
      marginBottom: 18,
      borderRadius: 16,
      paddingHorizontal: 18,
      alignSelf: "flex-start",
    },
    desktopViewSwitcher: {
      alignSelf: "flex-start",
      marginBottom: 16,
    },
    desktopGridCell: {
      flex: 1,
      maxWidth: "33.333%",
      minWidth: 0,
    },
    desktopCard: {
      borderRadius: 20,
      paddingVertical: 22,
      paddingHorizontal: 24,
      marginVertical: 10,
      minHeight: 178,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.055,
      shadowRadius: 20,
      elevation: 3,
    },

    // Header
    header: {
      paddingHorizontal: 18,
      paddingTop: 8,
      paddingBottom: 6,
      flexDirection: "row",
      alignItems: "center",
    },
    roundBtn: {
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor: C.surface,
      alignItems: "center",
      justifyContent: "center",
      ...shadow,
      shadowOpacity: 0.05,
    },
    headerCenter: { flex: 1, marginHorizontal: 14 },
    headerTitle: {
      fontSize: 26,
      fontWeight: "800",
      letterSpacing: -0.8,
      color: C.ink,
    },
    headerSubtitle: {
      marginTop: 1,
      fontSize: 13,
      fontWeight: "500",
      color: C.sub,
    },

    // List
    listContent: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 24 },
    emptyListContent: { flexGrow: 1 },
    listFooterSpace: { height: 112 },
    gridRow: { gap: 12, alignItems: "stretch" },
    gridCell: { flex: 1, maxWidth: "50%", minWidth: 0 },

    heroTop: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: 20,
      paddingVertical: 18,
      gap: 14,
    },

    heroInfo: {
      flex: 1,
    },

    recurringBadge: {
      flexDirection: "row",
      alignItems: "center",
      alignSelf: "flex-start",
      gap: 5,
      marginTop: 6,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 8,
      backgroundColor: C.primarySoft,
    },

    recurringBadgeText: {
      fontSize: 11,
      fontWeight: "600",
      color: "#6D28D9",
    },

    gridContainer: {
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "space-between",
      alignItems: "flex-start",
    },

    gridItem: {
      width: "48%",
      marginBottom: 10,
    },

    listContainer: {
      flexDirection: "column",
      width: "100%",
    },

    listItem: {
      width: "100%",
      marginBottom: 10,
    },

    heroLabel: {
      fontSize: 11,
      fontWeight: "800",
      letterSpacing: 1.6,
      color: C.sub,
      textTransform: "uppercase",
      marginBottom: 8,
    },

    heroNumberRow: {
      flexDirection: "row",
      alignItems: "baseline",
      flexWrap: "wrap",
      gap: 8,
    },

    heroNumber: {
      fontSize: 40,
      fontWeight: "800",
      letterSpacing: -1.5,
      color: C.ink,
    },

    heroUnit: {
      fontSize: 14,
      fontWeight: "600",
      color: C.sub,
    },

    heroSubtitle: {
      fontSize: 12,
      lineHeight: 18,
      color: C.sub,
      marginTop: 6,
    },

    progressRing: {
      alignItems: "center",
      justifyContent: "center",
    },

    ring: {
      width: 72,
      height: 72,
      borderRadius: 36,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: C.surface,
      borderWidth: 4,
      borderColor: C.primary,
      shadowColor: C.primary,
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.12,
      shadowRadius: 8,
      elevation: 3,
    },

    ringText: {
      fontSize: 18,
      fontWeight: "800",
      color: C.primary,
    },

    ringCaption: {
      fontSize: 9,
      fontWeight: "800",
      letterSpacing: 1.1,
      color: C.sub,
      marginTop: 7,
    },

    hero: {
      backgroundColor: "#312E81",
      borderRadius: 24,
      padding: 22,
      overflow: "hidden",
    },

    heroBlobA: {
      backgroundColor: "#6366F1",
      opacity: 0.28,
    },

    heroBlobB: {
      backgroundColor: "#8B5CF6",
      opacity: 0.22,
    },

    progressTrack: {
      backgroundColor: "rgba(255,255,255,0.18)",
    },

    progressFill: {
      backgroundColor: "#6EE7B7",
    },

    heroStatValue: {
      color: "#FFFFFF",
    },

    heroStatLabel: {
      color: "#C7D2FE",
    },

    detailsSketchFallback: {
      fontSize: 13,
      color: C.sub,
      lineHeight: 21,
      paddingVertical: 12,
    },

    heroStats: { flexDirection: "row", gap: 10, marginTop: 16 },
    heroStat: {
      flex: 1,
      backgroundColor: "rgba(255,255,255,0.09)",
      borderRadius: 16,
      paddingVertical: 11,
      paddingHorizontal: 12,
    },
    heroStatDot: { width: 7, height: 7, borderRadius: 4, marginBottom: 8 },

    detailsDoneText: {
      color: "#FFFFFF",
      fontSize: 14,
      fontWeight: "700",
    },

    // Search
    calendarViewToggle: {
      minHeight: 44,
      marginHorizontal: 16,
      marginTop: 12,
      marginBottom: 4,
      paddingHorizontal: 13,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: C.line,
      backgroundColor: C.surface,
      flexDirection: "row",
      alignItems: "center",
      gap: 9,
    },
    calendarViewToggleText: { color: C.ink, fontSize: 13, fontWeight: "700" },
    calendarPanel: {
      marginHorizontal: 16,
      marginTop: 8,
      marginBottom: 10,
      padding: 14,
      borderRadius: 20,
      backgroundColor: C.surface,
      borderWidth: 1,
      borderColor: C.line,
    },
    calendarHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 12,
    },
    calendarArrow: {
      width: 34,
      height: 34,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: C.primarySoft,
    },
    calendarMonthTitle: { color: C.ink, fontSize: 16, fontWeight: "800" },
    calendarWeekRow: { flexDirection: "row", marginBottom: 5 },
    calendarWeekday: {
      width: "14.2857%",
      textAlign: "center",
      color: C.sub,
      fontSize: 11,
      fontWeight: "700",
      paddingVertical: 7,
    },
    calendarGrid: { flexDirection: "row", flexWrap: "wrap" },
    calendarDayCell: {
      width: "14.2857%",
      height: 42,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 12,
      marginBottom: 2,
    },
    calendarDayText: { color: C.ink, fontSize: 13, fontWeight: "600" },
    calendarTodayCell: { borderWidth: 1, borderColor: C.primary },
    calendarNoteDot: {
      width: 4,
      height: 4,
      borderRadius: 2,
      backgroundColor: C.primary,
      marginTop: 2,
    },
    calendarSelectedSummary: {
      borderTopWidth: 1,
      borderTopColor: C.line,
      paddingTop: 12,
      marginTop: 7,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    calendarSelectedTitle: { color: C.ink, fontSize: 13, fontWeight: "800" },
    calendarSelectedSubtitle: { color: C.sub, fontSize: 11, marginTop: 3 },
    calendarTodayButtonText: {
      color: C.ink,
      fontWeight: "800",
      fontSize: 12,
    },
    searchContainer: {
      marginTop: 16,
      height: 50,
      paddingHorizontal: 16,
      borderRadius: 25,
      backgroundColor: C.surface,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      ...shadow,
      shadowOpacity: 0.05,
    },
    searchInput: { flex: 1, paddingVertical: 0, fontSize: 15, color: C.ink },

    // Chips
    chipScroll: { paddingTop: 14, paddingBottom: 6, gap: 8, paddingRight: 8 },
    filterChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 7,
      height: 38,
      paddingLeft: 15,
      paddingRight: 8,
      borderRadius: 19,
      backgroundColor: C.surface,
      borderWidth: 1,
      borderColor: C.line,
    },
    filterChipActive: { backgroundColor: C.ink, borderColor: C.ink },
    filterText: { fontSize: 13, fontWeight: "700", color: C.sub },
    filterTextActive: { color: "#FFFFFF" },
    filterCount: {
      minWidth: 22,
      height: 22,
      paddingHorizontal: 6,
      borderRadius: 11,
      backgroundColor: C.chip,
      alignItems: "center",
      justifyContent: "center",
    },
    filterCountActive: { backgroundColor: "rgba(255,255,255,0.18)" },
    filterCountText: { fontSize: 11, fontWeight: "800", color: C.sub },
    filterCountTextActive: { color: "#FFFFFF" },
    toolChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      height: 34,
      paddingHorizontal: 13,
      borderRadius: 17,
      backgroundColor: C.surface,
      borderWidth: 1,
      borderColor: C.line,
    },
    toolChipActive: { backgroundColor: C.primary, borderColor: C.primary },

    // Section headers
    sectionHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 9,
      marginTop: 14,
      marginBottom: 8,
      paddingHorizontal: 2,
    },
    sectionIcon: {
      width: 28,
      height: 28,
      borderRadius: 9,
      alignItems: "center",
      justifyContent: "center",
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: "800",
      letterSpacing: -0.4,
      color: C.ink,
    },
    sectionCount: {
      minWidth: 24,
      height: 22,
      paddingHorizontal: 7,
      borderRadius: 11,
      backgroundColor: C.chip,
      alignItems: "center",
      justifyContent: "center",
    },
    sectionCountText: { fontSize: 11.5, fontWeight: "800", color: C.sub },

    // Card
    card: {
      backgroundColor: C.surface,
      borderRadius: 22,
      // Keep saved note patterns/images clipped to the rounded card.
      position: "relative",
      overflow: "hidden",
      paddingVertical: 16,
      paddingLeft: 19,
      paddingRight: 14,
      marginVertical: 7,
      borderWidth: 1.8,
      borderColor: C.primary,
      shadowColor: C.hero,
      shadowOffset: { width: 0, height: 5 },
      shadowOpacity: 0.075,
      shadowRadius: 13,
      elevation: 2,
    },
    cardDone: { opacity: 0.72 },
    cardAccent: {
      position: "absolute",
      left: 0,
      top: 14,
      bottom: 14,
      width: 4,
      borderTopRightRadius: 4,
      borderBottomRightRadius: 4,
    },
    cardTop: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
    cardTitle: {
      fontSize: 20,
      lineHeight: 23,
      fontWeight: "800",
      letterSpacing: -0.25,
      color: C.ink,
    },
    cardTitleDone: { textDecorationLine: "line-through", color: C.sub },
    iconBtn: {
      width: 30,
      height: 30,
      borderRadius: 15,
      alignItems: "center",
      justifyContent: "center",
    },
    chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 },
    pill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      paddingHorizontal: 9,
      paddingVertical: 4,
      borderRadius: 10,
      backgroundColor: C.chip,
    },
    pillDot: { width: 6, height: 6, borderRadius: 3 },
    pillText: { fontSize: 11, fontWeight: "700", color: C.sub },
    cardText: { marginTop: 10, fontSize: 17, lineHeight: 21, color: C.ink },
    cardTextDone: { color: C.mute, textDecorationLine: "line-through" },
    cardFooter: {
      flexDirection: "row",
      alignItems: "center",
      flexWrap: "wrap",
      gap: 10,
      marginTop: 13,
      paddingTop: 10,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: "rgba(100,132,119,0.22)",
    },
    footerItem: { flexDirection: "row", alignItems: "center", gap: 5 },
    footerText: { fontSize: 14, fontWeight: "700", color: C.sub },
    trashBar: { flexDirection: "row", gap: 8, marginTop: 12 },
    trashBtn: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      height: 38,
      borderRadius: 12,
    },
    trashBtnText: { fontSize: 12.5, fontWeight: "800" },

    // Media
    mediaContainer: {
      height: 160,
      marginTop: 12,
      borderRadius: 16,
      overflow: "hidden",
      backgroundColor: C.chip,
    },
    todoImage: { width: "100%", height: "100%" },
    mediaCount: {
      position: "absolute",
      right: 8,
      bottom: 8,
      height: 26,
      paddingHorizontal: 9,
      borderRadius: 13,
      backgroundColor: "rgba(18,20,43,0.7)",
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
    },
    mediaCountText: { fontSize: 11, fontWeight: "800", color: "#FFFFFF" },
    attachmentRow: {
      marginTop: 12,
      flexDirection: "row",
      alignItems: "center",
      gap: 9,
      padding: 8,
      borderRadius: 14,
      backgroundColor: C.chip,
    },
    attachmentIcon: {
      width: 30,
      height: 30,
      borderRadius: 10,
      backgroundColor: C.primarySoft,
      alignItems: "center",
      justifyContent: "center",
    },
    attachmentTitle: { fontSize: 12.5, fontWeight: "700", color: C.ink },

    // Empty / loading
    emptyContainer: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 34,
      paddingVertical: 50,
    },
    emptyIcon: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: C.primarySoft,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 16,
    },
    emptyTitle: {
      fontSize: 19,
      fontWeight: "800",
      color: C.ink,
      textAlign: "center",
    },
    emptyDescription: {
      marginTop: 6,
      fontSize: 14,
      lineHeight: 20,
      color: C.sub,
      textAlign: "center",
    },
    emptyButton: {
      marginTop: 18,
      height: 46,
      paddingHorizontal: 20,
      borderRadius: 23,
      backgroundColor: C.primary,
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    emptyButtonText: { color: "#FFFFFF", fontSize: 14, fontWeight: "800" },
    loadingContainer: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: C.bg,
      gap: 12,
    },
    loadingText: { fontSize: 13, fontWeight: "600", color: C.sub },

    // FAB
    fab: {
      position: "absolute",
      right: 20,
      bottom: 24,
      height: 56,
      paddingHorizontal: 22,
      borderRadius: 28,
      backgroundColor: C.primary,
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      shadowColor: C.primary,
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.4,
      shadowRadius: 16,
      elevation: 8,
    },
    fabText: { color: "#FFFFFF", fontSize: 15, fontWeight: "800" },

    actionModalRoot: {
      flex: 1,
      justifyContent: "flex-end",
    },
    sheetHandleContainer: {
      alignItems: "center",
      paddingVertical: 8,
    },
    sheetHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingTop: 12,
      paddingBottom: 18,
      gap: 12,
    },
    sheetHeaderText: { flex: 1 },
    sheetCloseButton: {
      width: 38,
      height: 38,
      borderRadius: 13,
      backgroundColor: C.bg,
      borderWidth: 1,
      borderColor: C.line,
      alignItems: "center",
      justifyContent: "center",
    },
    sheetDivider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: C.line,
      marginBottom: 18,
    },
    actionCellPressed: { opacity: 0.72, transform: [{ scale: 0.97 }] },

    sheetOverlay: {
      flex: 1,
      justifyContent: "flex-end",
      backgroundColor: "rgba(15, 23, 42, 0.55)",
    },

    appearanceSheet: {
      width: "100%",
      maxHeight: "92%",
      backgroundColor: C.surface,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      paddingHorizontal: 20,
      paddingTop: 10,
      paddingBottom: 16,
      borderWidth: 1,
      borderColor: C.line,
      elevation: 24,
      shadowColor: "#000000",
      shadowOffset: { width: 0, height: -5 },
      shadowOpacity: 0.15,
      shadowRadius: 18,
    },

    sheetHandle: {
      width: 42,
      height: 5,
      borderRadius: 10,
      backgroundColor: C.line,
      alignSelf: "center",
      marginTop: 3,
      marginBottom: 18,
    },

    appearanceHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
      marginBottom: 20,
    },

    sheetTitle: {
      fontSize: 22,
      fontWeight: "800",
      color: C.ink,
      letterSpacing: -0.5,
    },

    sheetSub: {
      marginTop: 5,
      fontSize: 12,
      lineHeight: 18,
      color: C.sub,
    },

    appearanceSectionTitle: {
      fontSize: 13,
      fontWeight: "800",
      color: C.ink,
      marginTop: 20,
      marginBottom: 11,
      letterSpacing: 0.2,
    },

    notePatternOverlay: {
      position: "absolute",
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      width: "100%",
      height: "100%",
      borderRadius: 20,
      overflow: "hidden",
      zIndex: 0,
    },
    savedThemeMotifGrid: {
      ...StyleSheet.absoluteFill,
      overflow: "hidden",
    },
    notePatternLine: {
      position: "absolute",
      left: 0,
      right: 0,
      height: 1,
      backgroundColor: "rgba(99, 102, 241, 0.20)",
    },
    notePatternDotRow: {
      position: "absolute",
      left: 10,
      right: 10,
      flexDirection: "row",
      justifyContent: "space-between",
    },
    notePatternDot: {
      width: 2,
      height: 2,
      borderRadius: 1,
      backgroundColor: "rgba(99, 102, 241, 0.38)",
    },
    notePatternGrid: {
      ...StyleSheet.absoluteFill,
    },
    notePatternGridVertical: {
      position: "absolute",
      top: 0,
      bottom: 0,
      width: 1,
      backgroundColor: "rgba(99, 102, 241, 0.16)",
    },
    notePatternGridHorizontal: {
      position: "absolute",
      left: 0,
      right: 0,
      height: 1,
      backgroundColor: "rgba(99, 102, 241, 0.16)",
    },

    patternOption: {
      flex: 1,
      minWidth: 130,
      borderWidth: 1.5,
      borderColor: C.line,
      borderRadius: 14,
      padding: 9,
      backgroundColor: C.surface,
      overflow: "hidden",
    },

    patternPreview: {
      height: 76,
      borderRadius: 8,
      backgroundColor: C.surface,
      borderWidth: 1,
      borderColor: C.line,
      paddingHorizontal: 9,
      paddingVertical: 7,
      justifyContent: "space-between",
      overflow: "hidden",
    },

    patternLine: {
      height: 1,
      width: "100%",
      backgroundColor: "#A5B4FC",
    },

    patternDotRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      flex: 1,
    },

    patternDot: {
      width: 3,
      height: 3,
      borderRadius: 2,
      backgroundColor: "#818CF8",
    },

    patternGrid: {
      ...StyleSheet.absoluteFill,
      flexDirection: "row",
      justifyContent: "space-evenly",
    },

    patternGridVertical: {
      width: 1,
      height: "100%",
      backgroundColor: "#C7D2FE",
    },

    patternGridHorizontal: {
      position: "absolute",
      left: 0,
      right: 0,
      height: 1,
      backgroundColor: "#C7D2FE",
      top: "25%",
    },

    patternLabelRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginTop: 9,
      gap: 4,
    },

    appearanceOptionText: {
      fontSize: 13,
      fontWeight: "600",
      color: C.ink,
    },

    appearanceOptionRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 9,
      alignItems: "stretch",
    },

    appearanceOption: {
      flex: 1,
      minWidth: 130,
      minHeight: 48,
      paddingHorizontal: 12,
      paddingVertical: 11,
      borderRadius: 14,
      borderWidth: 1.5,
      borderColor: C.line,
      backgroundColor: C.bg,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
    },

    appearanceSwatches: {
      flexDirection: "row",
      flexWrap: "wrap",
      alignItems: "center",
      gap: 12,
      paddingVertical: 4,
    },

    appearanceSwatch: {
      width: 35,
      height: 35,
      borderRadius: 18,
      borderWidth: 2,
      borderColor: C.line,
    },

    appearanceSwatchSelected: {
      borderWidth: 3,
      borderColor: C.line,
      transform: [{ scale: 1.1 }],
    },

    appearanceWideButton: {
      minHeight: 49,
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderRadius: 14,
      borderWidth: 1.5,
      backgroundColor: C.bg,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      marginTop: 12,
    },

    appearanceWideButtonText: {
      flex: 1,
      fontSize: 12,
      fontWeight: "700",
      lineHeight: 18,
    },

    appearanceSmallOption: {
      flexGrow: 1,
      flexBasis: "21%",
      minHeight: 42,
      paddingHorizontal: 10,
      paddingVertical: 10,
      borderRadius: 12,
      borderWidth: 1.5,
      borderColor: C.line,
      backgroundColor: C.bg,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 5,
    },

    appearanceToggleRow: {
      minHeight: 52,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 13,
      paddingVertical: 8,
      marginBottom: 8,
      borderRadius: 13,
      backgroundColor: C.bg,
      borderWidth: 1,
      borderColor: C.line,
    },

    appearancePreview: {
      minHeight: 125,
      padding: 17,
      marginTop: 3,
      borderRadius: 18,
      borderWidth: 1.5,
      overflow: "hidden",
    },

    appearancePreviewDot: {
      width: 9,
      height: 9,
      borderRadius: 5,
      marginBottom: 12,
    },

    appearanceApplyButton: {
      minHeight: 50,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 15,
      marginTop: 20,
      elevation: 3,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.12,
      shadowRadius: 5,
    },

    appearanceApplyText: {
      color: "#FFFFFF",
      fontSize: 15,
      fontWeight: "800",
      letterSpacing: 0.3,
    },

    sheet: {
      width: "100%",
      backgroundColor: C.surface,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      paddingHorizontal: 20,
      paddingTop: 8,
      paddingBottom: 30,
      borderWidth: 1,
      borderColor: C.line,
      elevation: 20,
      shadowColor: "#000000",
      shadowOffset: { width: 0, height: -5 },
      shadowOpacity: 0.14,
      shadowRadius: 18,
    },

    sheetSection: {
      fontSize: 13,
      fontWeight: "700",
      color: C.sub,
      marginBottom: 8,
      marginLeft: 4,
    },
    menuGroup: { backgroundColor: C.bg, borderRadius: 20, overflow: "hidden" },
    menuRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    menuRowBorder: { borderTopWidth: 1, borderTopColor: C.line },
    menuIcon: {
      width: 34,
      height: 34,
      borderRadius: 11,
      backgroundColor: C.primarySoft,
      alignItems: "center",
      justifyContent: "center",
    },
    menuLabel: { flex: 1, fontSize: 15, fontWeight: "700", color: C.ink },
    actionGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "flex-start",
      marginHorizontal: -5,
      rowGap: 18,
    },
    actionCell: {
      width: "25%",
      minHeight: 94,
      alignItems: "center",
      justifyContent: "flex-start",
      paddingHorizontal: 5,
      borderRadius: 16,
    },
    actionIcon: {
      width: 54,
      height: 54,
      borderRadius: 18,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 9,
      borderWidth: 1,
      borderColor: "rgba(128,128,128,0.10)",
    },
    actionLabel: {
      width: "100%",
      fontSize: 11,
      lineHeight: 15,
      fontWeight: "700",
      color: C.ink,
      textAlign: "center",
    },

    // Editor dialog
    reminderDialog: {
      width: "100%",
      maxWidth: 440,
      borderRadius: 26,
      backgroundColor: C.surface,
      padding: 22,
      borderWidth: 1,
      borderColor: C.line,
      shadowColor: "#064E3B",
      shadowOpacity: 0.18,
      shadowRadius: 24,
      shadowOffset: { width: 0, height: 12 },
      elevation: 12,
    },
    reminderDialogHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    reminderHeaderIcon: {
      width: 48,
      height: 48,
      borderRadius: 16,
      backgroundColor: C.primarySoft,
      alignItems: "center",
      justifyContent: "center",
    },
    reminderSubtitle: {
      color: C.sub,
      fontSize: 13,
      fontWeight: "600",
      marginTop: -8,
    },
    reminderClose: {
      width: 34,
      height: 34,
      borderRadius: 12,
      backgroundColor: C.bg,
      alignItems: "center",
      justifyContent: "center",
    },
    reminderHint: {
      marginTop: 14,
      marginBottom: 18,
      color: C.sub,
      fontSize: 12.5,
      lineHeight: 18,
      backgroundColor: C.bg,
      padding: 11,
      borderRadius: 12,
    },
    reminderFieldLabel: {
      fontSize: 10,
      letterSpacing: 1.2,
      fontWeight: "900",
      color: C.sub,
      marginBottom: 8,
      marginTop: 4,
    },
    reminderPickerRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      padding: 13,
      borderWidth: 1,
      borderColor: C.line,
      borderRadius: 16,
      marginBottom: 14,
      backgroundColor: C.surface,
    },
    reminderPickerIcon: {
      width: 40,
      height: 40,
      borderRadius: 13,
      backgroundColor: C.primarySoft,
      alignItems: "center",
      justifyContent: "center",
    },
    reminderPickerCaption: {
      color: C.sub,
      fontSize: 11,
      fontWeight: "700",
      marginBottom: 3,
    },
    reminderPickerValue: { color: C.ink, fontSize: 14, fontWeight: "800" },
    reminderButtonRow: { flexDirection: "row", gap: 10, marginTop: 8 },
    reminderCancelButton: {
      height: 48,
      paddingHorizontal: 18,
      borderRadius: 15,
      borderWidth: 1,
      borderColor: C.line,
      alignItems: "center",
      justifyContent: "center",
    },
    reminderCancelText: { color: C.sub, fontWeight: "800", fontSize: 14 },
    reminderSaveButton: {
      flex: 1,
      height: 48,
      borderRadius: 15,
      backgroundColor: C.primary,
      flexDirection: "row",
      gap: 8,
      alignItems: "center",
      justifyContent: "center",
    },
    reminderSaveText: { color: "#FFFFFF", fontWeight: "900", fontSize: 14 },
    dialogOverlay: {
      flex: 1,
      backgroundColor: "rgba(18,20,43,0.5)",
      alignItems: "center",
      justifyContent: "center",
      padding: 24,
    },
    dialog: {
      width: "100%",
      maxWidth: 400,
      backgroundColor: C.surface,
      borderRadius: 28,
      padding: 22,
    },
    dialogTitle: {
      fontSize: 20,
      fontWeight: "800",
      letterSpacing: -0.4,
      color: C.ink,
      marginBottom: 14,
    },
    dialogInput: {
      height: 50,
      borderRadius: 16,
      paddingHorizontal: 16,
      fontSize: 15,
      color: C.ink,
      backgroundColor: C.bg,
      borderWidth: 1,
      borderColor: C.line,
    },
    tagList: { marginTop: 12, maxHeight: 190 },
    tagRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 8,
      gap: 8,
      borderBottomWidth: 1,
      borderBottomColor: C.line,
    },
    tagName: { flex: 1, fontSize: 14, fontWeight: "700", color: C.ink },
    tagAction: {
      paddingHorizontal: 11,
      paddingVertical: 6,
      borderRadius: 10,
      backgroundColor: C.primarySoft,
    },
    tagActionText: { fontSize: 12, fontWeight: "800", color: C.primary },
    colorLabel: {
      marginTop: 16,
      marginBottom: 9,
      fontSize: 13,
      fontWeight: "700",
      color: C.sub,
    },
    colorRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
    colorSwatch: {
      width: 34,
      height: 34,
      borderRadius: 17,
      borderWidth: 3,
      borderColor: "transparent",
    },
    colorSwatchSelected: { borderColor: C.ink },
    dialogActions: {
      flexDirection: "row",
      justifyContent: "flex-end",
      gap: 10,
      marginTop: 22,
    },
    dialogCancel: {
      height: 46,
      paddingHorizontal: 20,
      borderRadius: 23,
      backgroundColor: C.chip,
      alignItems: "center",
      justifyContent: "center",
    },
    dialogCancelText: { fontSize: 14, fontWeight: "800", color: C.sub },
    dialogSave: {
      height: 46,
      paddingHorizontal: 26,
      borderRadius: 23,
      backgroundColor: C.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    dialogSaveText: { fontSize: 14, fontWeight: "800", color: "#FFFFFF" },
    viewSwitcher: {
      flexDirection: "row",
      alignSelf: "flex-end",
      alignItems: "center",
      marginHorizontal: 16,
      marginTop: 8,
      marginBottom: 6,
      padding: 3,
      borderRadius: 12,
      backgroundColor: C.bg,
      borderWidth: 1,
      borderColor: C.line,
    },

    viewSwitcherOption: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 5,
      paddingHorizontal: 12,
      minHeight: 32,
      borderRadius: 9,
    },

    viewSwitcherActive: {
      backgroundColor: C.primary,
    },

    viewSwitcherText: {
      fontSize: 12,
      fontWeight: "600",
      color: C.primary,
    },

    viewSwitcherActiveText: {
      color: "#FFFFFF",
    },

    toolsContainer: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      marginVertical: 8,
    },

    layoutToolChip: {
      backgroundColor: C.primarySoft,
      borderColor: C.line,
    },

    toolIconBox: {
      width: 27,
      height: 27,
      borderRadius: 9,
      backgroundColor: C.primarySoft,
      alignItems: "center",
      justifyContent: "center",
    },

    toolChipText: {
      fontSize: 12,
      fontWeight: "700",
      color: C.ink,
      letterSpacing: 0.2,
    },

    toolChipPressed: {
      opacity: 0.75,
      transform: [{ scale: 0.97 }],
    },
  });

const baseStyles = createStyles(COLORS);
