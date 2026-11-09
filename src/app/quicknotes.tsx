// CreateQuickNote.js
// Expo setup:
//   npx expo install expo-linear-gradient expo-image-picker @react-native-community/datetimepicker react-native-safe-area-context
// (@expo/vector-icons is already included in Expo)
//
// Use: <CreateQuickNote onBack={() => navigation.goBack()} onCreate={(note) => console.log(note)} />

import { useSecurity } from "@/security/SecurityProvider";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import DateTimePicker from "@react-native-community/datetimepicker";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Image,
  ImageBackground,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAppTheme } from "../../context/app-theme-context";

/* ------------------------------ COLOR HELPERS ----------------------------- */

const toRgb = (h) => {
  const n = parseInt(h.replace("#", ""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const mix = (a, b, t) => {
  const [r1, g1, b1] = toRgb(a);
  const [r2, g2, b2] = toRgb(b);
  const c = (x, y) =>
    Math.round(x + (y - x) * t)
      .toString(16)
      .padStart(2, "0");
  return `#${c(r1, r2)}${c(g1, g2)}${c(b1, b2)}`;
};

const PURPLE = ["#7C83FD", "#5B4BF5"];
const WARM = ["#FF8A65", "#FF4F8B"];
const GOLD = ["#FFB347", "#FF8A3D"];
const GREEN = ["#3FC9A0", "#1FA37F"];
const BLUE = ["#5AA9FF", "#2F7DF0"];

// Builds a full theme object from one or two colors
const mk = (id, label, kind, c1, c2, accent, extra = {}) => ({
  id,
  label,
  kind,
  colors: [c1, c2 || c1],
  bg: extra.pattern ? c1 : mix(c1, "#ffffff", 0.6),
  hero: [
    mix(c1, "#ffffff", 0.1),
    c2 ? mix(c2, "#ffffff", 0.05) : mix(c1, "#000000", 0.06),
  ],
  heroText: mix(c2 || c1, "#000000", 0.62),
  accent,
  ...extra,
});

/* ------------------------------- THEME DATA ------------------------------- */

const COLORS = [
  mk("default", "Default", "gradient", "#DFF7E9", "#BDEFD9", GREEN),
  mk("pink", "Pink", "solid", "#FFC9DD", null, WARM),
  mk("peach", "Peach", "solid", "#FFD3BA", null, WARM),
  mk("yellow", "Yellow", "solid", "#FFEBA0", null, GOLD),
  mk("mint", "Mint", "solid", "#BDEFD9", null, GREEN),
  mk("sky", "Sky", "solid", "#BCDDFF", null, BLUE),
  mk("lavender", "Lavender", "solid", "#D6C9FF", null, PURPLE),
  mk("rose", "Rose", "solid", "#FFB3C1", null, WARM),
  mk("coral", "Coral", "solid", "#FFB4A2", null, WARM),
  mk("orange", "Orange", "solid", "#FFCF99", null, GOLD),
  mk("lime", "Lime", "solid", "#DDF2A6", null, GREEN),
  mk("aqua", "Aqua", "solid", "#A9EBEF", null, GREEN),
  mk("lilac", "Lilac", "solid", "#EBC9F5", null, PURPLE),
  mk("sand", "Sand", "solid", "#EBDDC3", null, GOLD),
  mk("grey", "Grey", "solid", "#DADDE6", null, PURPLE),
  mk("periwinkle", "Periwinkle", "solid", "#C5CBFF", null, PURPLE),
];

const GRADIENTS = [
  mk("g-orchid", "Orchid", "gradient", "#F6C7FF", "#CFA8FF", PURPLE),
  mk("g-ocean", "Ocean", "gradient", "#9BD0FF", "#5B8CFF", BLUE),
  mk("g-sunset", "Sunset", "gradient", "#FFD27A", "#FF9A5C", WARM),
  mk("g-lagoon", "Lagoon", "gradient", "#9BF0D8", "#4FD6E8", GREEN),
  mk("g-peachy", "Peachy", "gradient", "#FFECD2", "#FCB69F", WARM),
  mk("g-candy", "Candy", "gradient", "#FF9A9E", "#FECFEF", WARM),
  mk("g-aurora", "Aurora", "gradient", "#A1C4FD", "#C2E9FB", BLUE),
  mk("g-lemonade", "Lemonade", "gradient", "#F6D365", "#FDA085", GOLD),
  mk("g-cotton", "Cotton", "gradient", "#E0C3FC", "#8EC5FC", PURPLE),
  mk("g-spring", "Spring", "gradient", "#D4FC79", "#96E6A1", GREEN),
  mk("g-berry", "Berry", "gradient", "#F093FB", "#F5576C", WARM),
  mk("g-twilight", "Twilight", "gradient", "#8E9EFF", "#C9A7F5", PURPLE),
  mk("g-mojito", "Mojito", "gradient", "#B2FEFA", "#0ED2F7", BLUE),
  mk("g-blush", "Blush", "gradient", "#FBC2EB", "#A6C1EE", PURPLE),
];

const PATTERNS = [
  mk("p-leaf", "Pattern 1", "pattern", "#E3F5EA", null, GREEN, {
    pattern: "leaf",
    ink: "#7CC9A0",
  }),
  mk("p-grid", "Pattern 2", "pattern", "#EEF0FF", null, PURPLE, {
    pattern: "grid",
    ink: "#B8BEFF",
  }),
  mk("p-dots", "Pattern 3", "pattern", "#FFF0F5", null, WARM, {
    pattern: "dots",
    ink: "#F4A6C0",
  }),
  mk("p-stripes", "Pattern 4", "pattern", "#E6F4FF", null, BLUE, {
    pattern: "stripes",
    ink: "#B3D9FA",
  }),
  mk("p-checker", "Pattern 5", "pattern", "#FFF6D9", null, GOLD, {
    pattern: "checker",
    ink: "#FFE08A",
  }),
  mk("p-hearts", "Pattern 6", "pattern", "#FFE9EF", null, WARM, {
    pattern: "heart",
    ink: "#FF9DB5",
  }),
  mk("p-stars", "Pattern 7", "pattern", "#F0EAFF", null, PURPLE, {
    pattern: "star",
    ink: "#B9A6F5",
  }),
  mk("p-flowers", "Pattern 8", "pattern", "#FFF0E0", null, GOLD, {
    pattern: "flower",
    ink: "#FFBF8A",
  }),
];

const GALLERY = [
  "mountain",
  "blossom",
  "beach",
  "leaf",
  "clouds",
  "sunset",
  "forest",
  "city",
  "ocean",
  "desert",
  "flowers",
  "snow",
  "lake",
  "night",
  "waterfall",
  "autumn",
  "space",
  "garden",
].map((s) => `https://picsum.photos/seed/${s}/500/500`);

const MAIN_ROW_IDS = [
  "default",
  "pink",
  "peach",
  "yellow",
  "mint",
  "sky",
  "lavender",
  "p-leaf",
  "p-grid",
];
const MAIN_ROW = MAIN_ROW_IDS.map((id) =>
  [...COLORS, ...PATTERNS].find((t) => t.id === id),
);

const TABS = ["Colors", "Gradients", "Patterns", "Image"];
const MAX_CHARS = 1000;
const INK = "#1B1B3A";
const BRAND = "#1FA37F";

/* ---------------------------- PATTERN OVERLAY ----------------------------- */

const ICONS = { leaf: "leaf", heart: "heart", star: "star", flower: "flower" };

function PatternOverlay({ type, ink, cell }) {
  const [d, setD] = useState({ w: 0, h: 0 });
  const items = [];

  if (d.w > 0 && d.h > 0) {
    const cols = Math.ceil(d.w / cell) + 1;
    const rows = Math.ceil(d.h / cell) + 1;

    if (type === "grid") {
      for (let r = 0; r < rows; r++)
        items.push(
          <View
            key={`h${r}`}
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: r * cell,
              height: 1,
              backgroundColor: ink,
              opacity: 0.55,
            }}
          />,
        );
      for (let c = 0; c < cols; c++)
        items.push(
          <View
            key={`v${c}`}
            style={{
              position: "absolute",
              top: 0,
              bottom: 0,
              left: c * cell,
              width: 1,
              backgroundColor: ink,
              opacity: 0.55,
            }}
          />,
        );
    } else if (type === "stripes") {
      for (let r = 0; r < rows; r += 2)
        items.push(
          <View
            key={`s${r}`}
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: r * cell,
              height: cell,
              backgroundColor: ink,
              opacity: 0.4,
            }}
          />,
        );
    } else if (type === "dots") {
      const dot = Math.max(3, cell * 0.22);
      for (let r = 0; r < rows; r++)
        for (let c = 0; c < cols; c++)
          items.push(
            <View
              key={`d${r}-${c}`}
              style={{
                position: "absolute",
                top: r * cell + cell / 2 - dot / 2,
                left: c * cell + cell / 2 - dot / 2,
                width: dot,
                height: dot,
                borderRadius: dot / 2,
                backgroundColor: ink,
                opacity: 0.7,
              }}
            />,
          );
    } else if (type === "checker") {
      for (let r = 0; r < rows; r++)
        for (let c = 0; c < cols; c++)
          if ((r + c) % 2 === 0)
            items.push(
              <View
                key={`c${r}-${c}`}
                style={{
                  position: "absolute",
                  top: r * cell,
                  left: c * cell,
                  width: cell,
                  height: cell,
                  backgroundColor: ink,
                  opacity: 0.35,
                }}
              />,
            );
    } else if (ICONS[type]) {
      const size = Math.max(7, cell * 0.5);
      for (let r = 0; r < rows; r++)
        for (let c = 0; c < cols; c++) {
          const offset = r % 2 === 0 ? 0 : cell / 2;
          items.push(
            <Ionicons
              key={`i${r}-${c}`}
              name={ICONS[type]}
              size={size}
              color={ink}
              style={{
                position: "absolute",
                top: r * cell + (cell - size) / 2,
                left: c * cell + offset + (cell - size) / 2,
                opacity: 0.65,
                transform: [{ rotate: (r + c) % 2 ? "-18deg" : "14deg" }],
              }}
            />,
          );
        }
    }
  }

  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
      onLayout={(e) =>
        setD({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })
      }
    >
      {items}
    </View>
  );
}

/* ------------------------------- SWATCH ---------------------------------- */

function Swatch({
  theme,
  selected,
  size = 56,
  onPress,
  selectedColor = BRAND,
}) {
  const radius = 14;
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      style={[
        { width: size, height: size, borderRadius: radius + 2, padding: 2 },
        selected && { borderWidth: 2, borderColor: selectedColor },
      ]}
    >
      <View style={{ flex: 1, borderRadius: radius, overflow: "hidden" }}>
        {theme.kind === "image" ? (
          <Image source={{ uri: theme.uri }} style={StyleSheet.absoluteFill} />
        ) : (
          <LinearGradient
            colors={
              theme.kind === "pattern" ? [theme.bg, theme.bg] : theme.colors
            }
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
        )}
        {theme.kind === "pattern" && (
          <PatternOverlay
            type={theme.pattern}
            ink={theme.ink}
            cell={Math.max(10, size / 4)}
          />
        )}
      </View>
      {selected && (
        <View style={[styles.check, { backgroundColor: selectedColor }]}>
          <Ionicons name="checkmark" size={12} color="#fff" />
        </View>
      )}
    </TouchableOpacity>
  );
}

function ImageSwatch({ onPress, primary = BRAND, isDark = false }) {
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      style={[
        styles.imageSwatch,
        {
          backgroundColor: isDark ? "#26332E" : "#ECEDF2",
          borderColor: isDark ? "#405A4B" : "rgba(127,160,142,0.25)",
        },
      ]}
    >
      <Ionicons name="image" size={26} color={primary} />
      <View style={[styles.plus, { backgroundColor: primary }]}>
        <Ionicons name="add" size={14} color="#fff" />
      </View>
    </TouchableOpacity>
  );
}

/* ------------------------------ MAIN SCREEN ------------------------------- */

export default function CreateQuickNote({
  onBack,
  onCreate,
  // Android emulator: 10.0.2.2 = your computer. Real phone: use your computer's LAN IP or your server URL
  apiUrl = "https://todolistbackend-855c.onrender.com/api/createTodolist",
  // Edit endpoint is assumed to be PUT /api/updateTodolist/:id.
  // Change this prop if your backend uses a different update route.
  updateApiUrl = "https://todolistbackend-855c.onrender.com/api/updateTodolist",
  noteType = "quick", // "quick" | "todo"
  recurring = "none", // "none" | "daily" | "weekly" | "monthly" | "yearly"
  authToken,
}) {
  const { width } = useWindowDimensions();
  const isDesktop = Platform.OS === "web" && width >= 1000;
  const { isDark, colors: appTheme } = useAppTheme();
  // Prevent the app-level security listener from treating the system photo picker
  // as a real app exit. These methods must also exist in SecurityProvider.
  const { beginExternalActivity, endExternalActivity } = useSecurity();
  // Mint is this screen's visual identity; preserve contrast in both app modes.
  const ui = {
    background: isDark ? "#101D18" : "#F1FAF5",
    surface: isDark ? "#192A22" : "#FFFFFF",
    text: isDark ? "#E8F5ED" : "#18392B",
    secondaryText: isDark ? "#A8C4B3" : "#648372",
    border: isDark ? "#304A3B" : "#D4E9DC",
    primary: "#1FA37F",
    placeholder: isDark ? "#82998C" : "#91A99B",
    backButton: isDark ? "#24382E" : "#FFFFFF",
    backIcon: isDark ? "#E8F5ED" : "#173C35",
    softSurface: isDark ? "#20352B" : "rgba(127,160,142,0.07)",
    softBorder: isDark ? "#304A3B" : "rgba(127,160,142,0.12)",
    softAction: isDark ? "#263A32" : "#E8F7EE",
    reminderSurface: isDark ? "#24463A" : "#E2F7EB",
  };

  const {
    isEditMode,
    editTodo: editTodoParam,
    folderId: folderIdParam,
  } = useLocalSearchParams();

  // Folder assignment is local-only. The note itself is still saved to the API.
  const folderId = String(
    Array.isArray(folderIdParam)
      ? (folderIdParam[0] ?? "")
      : (folderIdParam ?? ""),
  ).trim();

  const editingNote = useMemo(() => {
    if (isEditMode !== "true" || !editTodoParam) return null;

    try {
      return JSON.parse(
        Array.isArray(editTodoParam) ? editTodoParam[0] : editTodoParam,
      );
    } catch {
      return null;
    }
  }, [isEditMode, editTodoParam]);

  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [theme, setTheme] = useState(COLORS[0]);
  const [reminder, setReminder] = useState(null);

  // Populate the editor when a Quick Note is opened in edit mode.
  useEffect(() => {
    if (!editingNote) return;

    setTitle(String(editingNote.title ?? ""));
    setNote(
      String(
        editingNote.text ??
          editingNote.description ??
          editingNote.content ??
          editingNote.note ??
          "",
      ),
    );

    const savedTheme =
      editingNote.quickNoteTheme ??
      editingNote.theme ??
      editingNote.quickNoteMeta?.quickNoteTheme;

    if (savedTheme) {
      if (savedTheme.kind === "image" && savedTheme.uri) {
        setTheme({
          id: savedTheme.id || "image",
          label: savedTheme.label || "Image",
          kind: "image",
          uri: savedTheme.uri,
          bg: savedTheme.bg || "#F4F4F8",
          accent: savedTheme.accent || PURPLE,
          hero: savedTheme.hero || ["#E9E1FF", "#CFC1FF"],
          heroText: savedTheme.heroText || "#2B1A8F",
        });
      } else {
        const allThemes = [...COLORS, ...GRADIENTS, ...PATTERNS];
        const matchedTheme = allThemes.find(
          (item) => item.id === savedTheme.id,
        );
        if (matchedTheme) setTheme(matchedTheme);
      }
    }

    const reminderDate = editingNote.reminderDate;
    const reminderTime = editingNote.reminderTime;
    if (reminderDate) {
      const dateParts = String(reminderDate).split("-").map(Number);
      const timeParts = String(reminderTime || "09:00")
        .split(":")
        .map(Number);
      if (dateParts.length === 3 && dateParts.every(Number.isFinite)) {
        const parsedReminder = new Date(
          dateParts[0],
          dateParts[1] - 1,
          dateParts[2],
          timeParts[0] || 0,
          timeParts[1] || 0,
        );
        if (!Number.isNaN(parsedReminder.getTime()))
          setReminder(parsedReminder);
      }
    }
  }, [editingNote]);

  // One single modal, two views: 'themes' | 'images'
  const [sheet, setSheet] = useState(null);
  const [tab, setTab] = useState("Colors");

  const [pickerMode, setPickerMode] = useState(null); // null | date | time | ios | web
  const [tempDate, setTempDate] = useState(new Date());

  const isImage = theme.kind === "image";
  const isPattern = theme.kind === "pattern";
  // The built-in Default option follows the shared app theme. Other note themes
  // keep their individually selected colors/backgrounds.
  const isDefaultTheme = theme.id === "default";
  const heroColors = isDefaultTheme
    ? [ui.surface, ui.background]
    : theme.hero || COLORS[0].hero;
  const heroText = isDefaultTheme
    ? ui.text
    : theme.heroText || COLORS[0].heroText;
  const accent = isDefaultTheme
    ? [ui.primary, ui.primary]
    : theme.accent || PURPLE;

  const sheetSwatch = Math.floor((width - 40 - 36) / 4);
  const imageCell = Math.floor((width - 40 - 20) / 3);

  const reminderLabel = useMemo(() => {
    if (!reminder) return null;
    const d = reminder.toLocaleDateString("en-GB", {
      weekday: "short",
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
    const t = reminder.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });
    return `${d}  •  ${t}`;
  }, [reminder]);

  /* ---- reminder picker: Android, iOS and Web ---- */
  const openReminder = () => {
    const now = new Date();
    const initialDate =
      reminder && reminder.getTime() > now.getTime() ? new Date(reminder) : now;

    setTempDate(initialDate);
    setPickerMode(
      Platform.OS === "web" ? "web" : Platform.OS === "ios" ? "ios" : "date",
    );
  };

  // Convert a local Date to the value expected by HTML datetime-local.
  const getWebDateTimeValue = (date) => {
    const offset = date.getTimezoneOffset();
    return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 16);
  };

  const handleWebReminderChange = (value) => {
    if (!value) return;
    // datetime-local is local time; avoid parsing it as UTC.
    const [datePart, timePart] = value.split("T");
    if (!datePart || !timePart) return;
    const [year, month, day] = datePart.split("-").map(Number);
    const [hour, minute] = timePart.split(":").map(Number);
    const selectedDate = new Date(year, month - 1, day, hour, minute, 0, 0);
    if (!Number.isNaN(selectedDate.getTime())) setTempDate(selectedDate);
  };

  const saveReminder = () => {
    if (!(tempDate instanceof Date) || Number.isNaN(tempDate.getTime())) {
      Alert.alert("Invalid reminder", "Please choose a valid date and time.");
      return;
    }
    if (tempDate.getTime() <= Date.now()) {
      Alert.alert("Invalid reminder", "Please choose a future date and time.");
      return;
    }
    setReminder(new Date(tempDate));
    setPickerMode(null);
  };

  const onAndroidChange = (event, selected) => {
    if (event?.type === "dismissed" || !selected) {
      setPickerMode(null);
      return;
    }

    const d = new Date(tempDate);
    if (pickerMode === "date") {
      d.setFullYear(
        selected.getFullYear(),
        selected.getMonth(),
        selected.getDate(),
      );
      setTempDate(d);
      setPickerMode("time");
      return;
    }

    d.setHours(selected.getHours(), selected.getMinutes(), 0, 0);
    if (d.getTime() <= Date.now()) {
      Alert.alert("Invalid reminder", "Please choose a future date and time.");
      setPickerMode("date");
      return;
    }
    setReminder(d);
    setPickerMode(null);
  };

  /* ---- images ---- */
  const applyImage = (uri) => {
    setTheme({
      id: "image",
      label: "Image",
      kind: "image",
      uri,
      bg: "#F4F4F8",
      accent: PURPLE,
      hero: ["#E9E1FF", "#CFC1FF"],
      heroText: "#2B1A8F",
    });
    setSheet(null);
  };

  const chooseFromGallery = async () => {
    // Mark this as an intentional system-picker transition before Android changes
    // AppState. SecurityProvider should skip auto-lock while this flag is active.
    beginExternalActivity();

    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!perm.granted) {
        Alert.alert(
          "Permission needed",
          "Allow photo access to pick a background.",
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: false,
        quality: 0.8,
      });

      const selectedUri = !result.canceled ? result.assets?.[0]?.uri : null;

      if (selectedUri) {
        // This updates the current note's background; it does not navigate away.
        applyImage(selectedUri);
      }
    } catch (error) {
      console.error("Image selection failed:", error);
      Alert.alert(
        "Image error",
        "Could not open the photo library. Please try again.",
      );
    } finally {
      // Always release the suppression flag, including permission denial/cancel.
      endExternalActivity();
    }
  };

  const pickTheme = (t) => {
    console.log("🎨 THEME SELECTED:", {
      id: t.id,
      label: t.label,
      kind: t.kind,
      pattern: t.pattern,
      ink: t.ink,
      bg: t.bg,
    });

    setTheme(t);
    setSheet(null);
  };

  const [saving, setSaving] = useState(false);

  const pad = (n) => String(n).padStart(2, "0");

  // Save a Quick Note on this device when the app is offline or no session token
  // is available. ViewList already reads and merges the `local_todos` key.
  const saveQuickNoteLocally = async (
    editingId = "",
    attachmentFields = {},
  ) => {
    const now = new Date().toISOString();
    const localId =
      editingId ||
      `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const savedTheme = {
      id: theme.id,
      label: theme.label,
      kind: theme.kind,
      colors: theme.colors || null,
      pattern: theme.pattern || null,
      ink: theme.ink || null,
      uri: theme.kind === "image" ? theme.uri : null,
      bg: isDefaultTheme ? ui.background : theme.bg || null,
    };

    const localNote = {
      ...(editingNote && typeof editingNote === "object" ? editingNote : {}),
      ...attachmentFields,
      tdlId: localId,
      _id: localId,
      id: localId,
      title: title.trim(),
      text: note.trim(),
      description: note.trim(),
      content: note.trim(),
      date: now,
      createdAt: editingNote?.createdAt || now,
      updatedAt: now,
      noteType: "quick",
      isQuickNote: true,
      isOfflinePending: true,
      isLocalCopy: true,
      isLocalDuplicate: true,
      syncStatus: "pending",
      reminderDate: reminder
        ? `${reminder.getFullYear()}-${pad(reminder.getMonth() + 1)}-${pad(reminder.getDate())}`
        : null,
      reminderTime: reminder
        ? `${pad(reminder.getHours())}:${pad(reminder.getMinutes())}`
        : null,
      recurring,
      theme: savedTheme,
      quickNoteTheme: savedTheme,
      quickNoteColor: isDefaultTheme
        ? ui.background
        : theme.bg || theme.colors?.[0] || "#FFF8DC",
    };

    const storageKey = "local_todos";
    const rawLocalTodos = await AsyncStorage.getItem(storageKey);
    const localTodos = rawLocalTodos ? JSON.parse(rawLocalTodos) : [];
    const updatedTodos = [
      localNote,
      ...(Array.isArray(localTodos) ? localTodos : []).filter(
        (item) =>
          String(item?.tdlId ?? item?._id ?? item?.id ?? item?.todoId ?? "") !==
          localId,
      ),
    ];
    await AsyncStorage.setItem(storageKey, JSON.stringify(updatedTodos));

    const titleKey = title.trim().toLowerCase();
    const quickNoteMeta = {
      isQuickNote: true,
      title: title.trim(),
      quickNoteColor: localNote.quickNoteColor,
      quickNoteTheme: savedTheme,
      updatedAt: now,
    };
    const metaPairs = [
      [`quick-note-meta:${localId}`, JSON.stringify(quickNoteMeta)],
    ];
    if (titleKey)
      metaPairs.push([
        `quick-note-meta:${titleKey}`,
        JSON.stringify(quickNoteMeta),
      ]);
    await AsyncStorage.multiSet(metaPairs);

    console.log("[QuickNote] Saved locally for offline viewing:", localId);
    onCreate?.(localNote);
    router.push({
  pathname: "/viewlist",
  params: { from: "/quicknotes" },
});

  };

  const handleCreate = async () => {
    if (saving) return;
    if (!title.trim() && !note.trim())
      return Alert.alert("Empty note", "Add a title or some text first.");

    if (reminder && reminder.getTime() <= Date.now()) {
      Alert.alert("Invalid reminder", "Please choose a future date and time.");
      return;
    }

    // Preserve existing attachment IDs and metadata when editing a Quick Note.
    // This screen does not edit attachments, so changing title/text/theme must not
    // silently remove the attachments saved on the original note.
    const preservedAttachmentFields = {};
    if (editingNote && typeof editingNote === "object") {
      const attachmentFieldNames = [
        "fileIds",
        "fileNames",
        "fileTypes",
        "attachmentIds",
        "attachmentNames",
        "attachmentTypes",
        "attachments",
        "mimeTypes",
        "mediaTypes",
        "media",
        "type",
      ];

      for (const fieldName of attachmentFieldNames) {
        if (Object.prototype.hasOwnProperty.call(editingNote, fieldName)) {
          preservedAttachmentFields[fieldName] = editingNote[fieldName];
        }
      }
    }

    const payload = {
      ...preservedAttachmentFields,
      title: title.trim(),
      text: note.trim(),
      date: new Date().toISOString(),
      reminderDate: reminder
        ? `${reminder.getFullYear()}-${pad(reminder.getMonth() + 1)}-${pad(reminder.getDate())}`
        : null,
      reminderTime: reminder
        ? `${pad(reminder.getHours())}:${pad(reminder.getMinutes())}`
        : null,
      recurring,
      noteType,
      utcOffsetMinutes: -new Date().getTimezoneOffset(),
      // Theme metadata lets the backend persist the selected appearance if its schema supports it.
      theme: {
        id: theme.id,
        label: theme.label,
        kind: theme.kind,
        colors: theme.colors || null,
        pattern: theme.pattern || null,
        ink: theme.ink || null,
        uri: theme.kind === "image" ? theme.uri : null,
        bg: isDefaultTheme ? ui.background : theme.bg || null,
      },
    };

    console.log("💾 PATTERN BEFORE SAVE:", {
      themeId: theme.id,
      themeLabel: theme.label,
      themeKind: theme.kind,
      selectedPattern: theme.pattern ?? null,
      patternInk: theme.ink ?? null,
      backgroundColor: theme.bg ?? null,
    });

    try {
      setSaving(true);

      const editingId = String(
        editingNote?.tdlId ??
          editingNote?._id ??
          editingNote?.id ??
          editingNote?.todoId ??
          "",
      ).trim();

      // A duplicated note uses a local-* ID. Edit and save that copy only in
      // AsyncStorage; do not update the original note or call the backend API.
      const isLocalCopy =
        isEditMode === "true" &&
        !!editingNote &&
        (String(editingNote.tdlId ?? editingNote.id ?? "").startsWith(
          "local-",
        ) ||
          editingNote.isLocalDuplicate === true ||
          editingNote.isLocalCopy === true);

      if (isLocalCopy) {
        const now = new Date().toISOString();
        const savedTheme = {
          id: theme.id,
          label: theme.label,
          kind: theme.kind,
          colors: theme.colors || null,
          pattern: theme.pattern || null,
          ink: theme.ink || null,
          uri: theme.kind === "image" ? theme.uri : null,
          bg: isDefaultTheme ? ui.background : theme.bg || null,
        };

        const updatedLocalNote = {
          ...editingNote,
          tdlId: editingId,
          id: editingNote.id ?? editingId,
          title: title.trim(),
          text: note.trim(),
          description: note.trim(),
          content: note.trim(),
          date: editingNote.date || now.slice(0, 10),
          updatedAt: now,
          noteType: "quick",
          isQuickNote: true,
          isLocalCopy: true,
          reminderDate: reminder
            ? `${reminder.getFullYear()}-${pad(reminder.getMonth() + 1)}-${pad(reminder.getDate())}`
            : null,
          reminderTime: reminder
            ? `${pad(reminder.getHours())}:${pad(reminder.getMinutes())}`
            : null,
          theme: savedTheme,
          quickNoteTheme: savedTheme,
          quickNoteColor: isDefaultTheme
            ? ui.background
            : theme.bg || theme.colors?.[0] || "#FFF8DC",
        };

        const storageKey = "local_todos";
        const rawLocalTodos = await AsyncStorage.getItem(storageKey);
        const localTodos = rawLocalTodos ? JSON.parse(rawLocalTodos) : [];
        const updatedTodos = [
          updatedLocalNote,
          ...localTodos.filter(
            (item) =>
              String(item.tdlId ?? item._id ?? item.id ?? item.todoId ?? "") !==
              editingId,
          ),
        ];
        await AsyncStorage.setItem(storageKey, JSON.stringify(updatedTodos));

        const titleKey = title.trim().toLowerCase();
        const quickNoteMeta = {
          isQuickNote: true,
          title: title.trim(),
          quickNoteColor: updatedLocalNote.quickNoteColor,
          quickNoteTheme: savedTheme,
          updatedAt: now,
        };
        const metaPairs = [
          [`quick-note-meta:${editingId}`, JSON.stringify(quickNoteMeta)],
        ];
        if (titleKey)
          metaPairs.push([
            `quick-note-meta:${titleKey}`,
            JSON.stringify(quickNoteMeta),
          ]);
        await AsyncStorage.multiSet(metaPairs);

        onCreate?.(updatedLocalNote);
       router.push({
  pathname: "/viewlist",
  params: { from: "/quicknotes" },
});
        return;
      }

      // Only server-backed notes require an authentication token.
      const token =
        authToken ||
        (await AsyncStorage.getItem("login_token")) ||
        (await AsyncStorage.getItem("token"));

      // Without a saved login token, keep the note locally instead of blocking
      // creation. It will still appear in ViewList and can be synced later.
      if (!token || !apiUrl) {
        await saveQuickNoteLocally(editingId, preservedAttachmentFields);
        return;
      }

      if (isEditMode === "true" && !editingId) {
        Alert.alert(
          "Cannot update note",
          "This Quick Note has no database ID. Please open it again from the saved notes list.",
        );
        return;
      }

      if (isEditMode === "true" && !updateApiUrl) {
        Alert.alert(
          "Configuration error",
          "The Quick Note update API URL is missing.",
        );
        return;
      }

      const requestUrl =
        isEditMode === "true"
          ? `${updateApiUrl.replace(/\/$/, "")}/${encodeURIComponent(editingId)}`
          : apiUrl;
      const requestMethod = isEditMode === "true" ? "PUT" : "POST";

      console.log(
        "📤 QUICK NOTE SAVE PAYLOAD:",
        JSON.stringify(payload, null, 2),
      );
      console.log("🧭 QUICK NOTE SAVE REQUEST:", {
        method: requestMethod,
        url: requestUrl,
      });

      let res;
      try {
        res = await fetch(requestUrl, {
          method: requestMethod,
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        });
      } catch (networkError) {
        console.warn(
          "[QuickNote] Network unavailable; saving locally:",
          networkError,
        );
        await saveQuickNoteLocally(editingId, preservedAttachmentFields);
        return;
      }
      const json = await res.json().catch(() => ({}));
      console.log("📥 QUICK NOTE SAVE RESPONSE:", {
        status: res.status,
        success: json.success,
        savedTheme: json.task?.theme ?? json.data?.theme ?? json.theme ?? null,
        response: json,
      });

      if (!res.ok || json.success === false) {
        const msg = Array.isArray(json.errors)
          ? json.errors.join("\n")
          : json.message ||
            json.error ||
            (isEditMode === "true"
              ? "Could not update note"
              : "Could not create note");
        Alert.alert("Error", msg);
        return;
      }

      // APIs may return the created item as `task`, `data`, or the root object.
      const createdNote = json.task ?? json.data ?? json;
      const savedItem = createdNote?.task ?? createdNote?.data ?? createdNote;
      const savedId = String(
        savedItem?.tdlId ??
          savedItem?._id ??
          savedItem?.id ??
          savedItem?.todoId ??
          editingNote?.tdlId ??
          editingNote?._id ??
          editingNote?.id ??
          editingNote?.todoId ??
          "",
      ).trim();

      // Persist the folder link on this device, using the same metadata store
      // that the Todo List screen reads. Do not send folderId to the backend.
      if (savedId) {
        try {
          const organizationKey = "notes:organization-meta";
          const rawOrganizationMeta =
            await AsyncStorage.getItem(organizationKey);
          const organizationMeta = rawOrganizationMeta
            ? JSON.parse(rawOrganizationMeta)
            : {};

          // If this screen was opened from a folder, assign/update that folder.
          // If folderId is absent (for example, editing from the general list),
          // preserve any existing local folder assignment.
          if (folderId) {
            organizationMeta[savedId] = {
              ...(organizationMeta[savedId] || {}),
              folderId,
            };
            await AsyncStorage.setItem(
              organizationKey,
              JSON.stringify(organizationMeta),
            );
            console.log("[QuickNote Folder] Saved local assignment:", {
              savedId,
              folderId,
            });
          }
        } catch (folderError) {
          console.error(
            "[QuickNote Folder] Failed to save local folder assignment:",
            folderError,
          );
        }
      }

      const titleKey = title.trim().toLowerCase();
      const quickNoteMeta = {
        isQuickNote:
          noteType === "quick" ||
          String(noteType).toLowerCase().includes("quick"),
        title: title.trim(),
        quickNoteColor: isDefaultTheme
          ? ui.background
          : theme.bg || theme.colors?.[0] || "#FFF8DC",
        quickNoteTheme: {
          id: theme.id,
          label: theme.label,
          kind: theme.kind,
          colors: theme.colors || null,
          pattern: theme.pattern || null,
          ink: theme.ink || null,
          uri: theme.kind === "image" ? theme.uri : null,
          bg: isDefaultTheme ? ui.background : theme.bg || null,
        },
        updatedAt: new Date().toISOString(),
      };
      const metaPairs = [];
      if (savedId)
        metaPairs.push([
          `quick-note-meta:${savedId}`,
          JSON.stringify(quickNoteMeta),
        ]);
      if (titleKey)
        metaPairs.push([
          `quick-note-meta:${titleKey}`,
          JSON.stringify(quickNoteMeta),
        ]);
      console.log("💽 QUICK NOTE METADATA TO SAVE:", {
        savedId,
        titleKey,
        metaPairs,
        quickNoteMeta,
      });
      if (metaPairs.length) await AsyncStorage.multiSet(metaPairs);
      console.log(
        "✅ QUICK NOTE METADATA SAVED:",
        metaPairs.map(([key]) => key),
      );
      onCreate?.({
        ...(editingNote && typeof editingNote === "object" ? editingNote : {}),
        ...(savedItem && typeof savedItem === "object" ? savedItem : {}),
        ...preservedAttachmentFields,
        theme: quickNoteMeta.quickNoteTheme,
        quickNoteTheme: quickNoteMeta.quickNoteTheme,
      });
     router.push({
  pathname: "/viewlist",
  params: { from: "/quicknotes" },
});
    } catch (e) {
      console.error("Create quick note failed:", e);
      Alert.alert(
        "Network error",
        `Could not complete the request to ${isEditMode === "true" ? updateApiUrl : apiUrl}. Check the backend URL and update route.`,
      );
    } finally {
      setSaving(false);
    }
  };

  const sheetList =
    tab === "Colors" ? COLORS : tab === "Gradients" ? GRADIENTS : PATTERNS;

  /* ------------------------------- RENDER ------------------------------- */

  const Body = (
    <SafeAreaView style={{ flex: 1, backgroundColor: "transparent" }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {/* Header */}
        <View
          style={[
            styles.header,
            isDesktop && styles.desktopHeader,
            {
              backgroundColor: "transparent",
              flexDirection: "row",
              alignItems: "center",
            },
          ]}
        >
          <TouchableOpacity
            style={[styles.backBtn, { backgroundColor: ui.backButton }]}
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={22} color={ui.backIcon} />
          </TouchableOpacity>

          <Text
            style={[
              styles.headerTitle,
              {
                color: ui.text,
                flex: 1,
                textAlign: "center",
              },
            ]}
          >
            {isEditMode === "true" ? "Edit Quick Note" : "Create Quick Note"}
          </Text>
        </View>

        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            isDesktop && styles.desktopScroll,
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Hero banner */}
          <LinearGradient
            colors={heroColors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.hero, isDesktop && styles.desktopHero]}
          >
            <View style={{ flex: 1 }}>
              <View
                style={[
                  styles.heroPill,
                  {
                    backgroundColor: isDark
                      ? "rgba(255,255,255,0.12)"
                      : "rgba(255,255,255,0.68)",
                  },
                ]}
              >
                <Ionicons name="sparkles-outline" size={12} color={heroText} />
                <Text style={[styles.heroPillText, { color: heroText }]}>
                  QUICK CAPTURE
                </Text>
              </View>
              <Text style={[styles.heroTitle, { color: heroText }]}>
                A space for{"\n"}your thoughts
              </Text>
              <Text style={[styles.heroSub, { color: heroText }]}>
                Save ideas, reminders and little moments before they slip away.
              </Text>
            </View>
            <View style={styles.heroArt}>
              <View style={styles.paper}>
                <View style={styles.paperLine} />
                <View style={styles.paperLine} />
                <View style={[styles.paperLine, { width: "55%" }]} />
              </View>
              <Ionicons
                name="pencil"
                size={46}
                color={ui.primary}
                style={styles.pencil}
              />
              <Ionicons
                name="sparkles"
                size={18}
                color={ui.primary}
                style={styles.spark}
              />
            </View>
          </LinearGradient>

          {isDesktop ? (
            <View style={styles.desktopColumns}>
              <View style={styles.desktopColumn}>
                {/* Title */}
                <View style={styles.sectionHeading}>
                  <Text
                    style={[
                      styles.label,
                      {
                        color: ui.text,
                        marginTop: isDesktop ? 12 : 24,
                        marginBottom: 8,
                      },
                    ]}
                  >
                    Title
                  </Text>
                  <Text
                    style={[styles.optionalText, { color: ui.secondaryText }]}
                  >
                    OPTIONAL
                  </Text>
                </View>
                <View
                  style={[
                    styles.fieldCard,
                    { backgroundColor: ui.surface, borderColor: ui.border },
                  ]}
                >
                  <Ionicons name="text-outline" size={20} color={ui.primary} />
                  <TextInput
                    value={title}
                    onChangeText={setTitle}
                    placeholder="Give your note a title..."
                    placeholderTextColor={ui.placeholder}
                    returnKeyType="next"
                    style={[styles.titleInput, { color: ui.text }]}
                  />
                </View>

                {/* Note */}
                <View style={styles.sectionHeading}>
                  <Text
                    style={[
                      styles.label,
                      {
                        color: ui.text,
                        marginTop: isDesktop ? 12 : 22,
                        marginBottom: 8,
                      },
                    ]}
                  >
                    Your note
                  </Text>
                  <Text
                    style={[styles.optionalText, { color: ui.secondaryText }]}
                  >
                    UP TO {MAX_CHARS} CHARACTERS
                  </Text>
                </View>
                <View
                  style={[
                    styles.noteCard,
                    { backgroundColor: ui.surface, borderColor: ui.border },
                  ]}
                >
                  <TextInput
                    value={note}
                    onChangeText={(t) => setNote(t.slice(0, MAX_CHARS))}
                    placeholder="What's on your mind? Start writing..."
                    placeholderTextColor={ui.placeholder}
                    multiline
                    textAlignVertical="top"
                    style={[styles.noteInput, { color: ui.text }]}
                  />
                  <View
                    style={[styles.counterRow, { borderTopColor: ui.border }]}
                  >
                    <View style={styles.writingHint}>
                      <Ionicons
                        name="create-outline"
                        size={14}
                        color={ui.secondaryText}
                      />
                      <Text
                        style={[
                          styles.writingHintText,
                          { color: ui.secondaryText },
                        ]}
                      >
                        Your thoughts, your space
                      </Text>
                    </View>
                    <Text
                      style={[
                        styles.counter,
                        {
                          color:
                            note.length >= MAX_CHARS
                              ? "#DC2626"
                              : ui.secondaryText,
                        },
                      ]}
                    >
                      {note.length}/{MAX_CHARS}
                    </Text>
                  </View>
                </View>
              </View>
              <View style={styles.desktopColumn}>
                {/* Theme */}
                <View style={[styles.rowBetween, { marginTop: 6 }]}>
                  <View>
                    <Text
                      style={[
                        styles.label,
                        {
                          color: ui.text,
                          marginTop: isDesktop ? 12 : 22,
                          marginBottom: 4,
                        },
                      ]}
                    >
                      Personalize
                    </Text>
                    <Text
                      style={[styles.sectionHint, { color: ui.secondaryText }]}
                    >
                      Choose a background that feels like you.
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => {
                      setTab("Colors");
                      setSheet("themes");
                    }}
                    style={[styles.seeAll, { backgroundColor: ui.softAction }]}
                  >
                    <Text style={[styles.seeAllText, { color: ui.primary }]}>
                      View all
                    </Text>
                    <Ionicons
                      name="arrow-forward"
                      size={14}
                      color={ui.primary}
                    />
                  </TouchableOpacity>
                </View>

                <View
                  style={[
                    styles.themeGrid,
                    {
                      backgroundColor: ui.softSurface,
                      borderColor: ui.softBorder,
                    },
                  ]}
                >
                  {MAIN_ROW.map((t) => (
                    <View key={t.id} style={styles.themeCell}>
                      <Swatch
                        theme={t}
                        selected={theme.id === t.id}
                        selectedColor={ui.primary}
                        size={62}
                        onPress={() => setTheme(t)}
                      />
                      <Text
                        style={[
                          styles.themeName,
                          { color: ui.text },
                          theme.id === t.id && {
                            color: ui.primary,
                            fontWeight: "700",
                          },
                        ]}
                      >
                        {t.label}
                      </Text>
                    </View>
                  ))}
                  <View style={styles.themeCell}>
                    {isImage ? (
                      <Swatch
                        theme={theme}
                        selected
                        selectedColor={ui.primary}
                        size={62}
                        onPress={() => setSheet("images")}
                      />
                    ) : (
                      <ImageSwatch
                        onPress={() => setSheet("images")}
                        primary={ui.primary}
                        isDark={isDark}
                      />
                    )}
                    <Text
                      style={[
                        styles.themeName,
                        { color: ui.text },
                        isImage && { color: ui.primary, fontWeight: "700" },
                      ]}
                    >
                      Image
                    </Text>
                  </View>
                </View>

                {/* Reminder */}
                <View style={styles.sectionHeading}>
                  <Text
                    style={[
                      styles.label,
                      {
                        color: ui.text,
                        marginTop: isDesktop ? 14 : 24,
                        marginBottom: 8,
                      },
                    ]}
                  >
                    Reminder
                  </Text>
                  <Text
                    style={[styles.optionalText, { color: ui.secondaryText }]}
                  >
                    OPTIONAL
                  </Text>
                </View>
                <TouchableOpacity
                  activeOpacity={0.82}
                  onPress={openReminder}
                  style={[
                    styles.reminderCard,
                    {
                      backgroundColor: ui.surface,
                      borderColor: reminder ? ui.primary : ui.border,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.reminderIconWrap,
                      { backgroundColor: ui.reminderSurface },
                    ]}
                  >
                    <Ionicons
                      name="notifications-outline"
                      size={21}
                      color={ui.primary}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.reminderTitle, { color: ui.text }]}>
                      {reminderLabel
                        ? "Reminder scheduled"
                        : "Never miss a thought"}
                    </Text>
                    <Text
                      style={[
                        styles.reminderText,
                        {
                          color: reminderLabel ? ui.primary : ui.secondaryText,
                        },
                      ]}
                    >
                      {reminderLabel || "Tap to choose date and time"}
                    </Text>
                  </View>
                  <Ionicons
                    name={
                      reminderLabel ? "checkmark-circle" : "chevron-forward"
                    }
                    size={21}
                    color={reminderLabel ? ui.primary : ui.secondaryText}
                  />
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <>
              {/* Title */}
              <View style={styles.sectionHeading}>
                <Text
                  style={[
                    styles.label,
                    { color: ui.text, marginTop: 24, marginBottom: 10 },
                  ]}
                >
                  Title
                </Text>
                <Text
                  style={[styles.optionalText, { color: ui.secondaryText }]}
                >
                  OPTIONAL
                </Text>
              </View>
              <View
                style={[
                  styles.fieldCard,
                  { backgroundColor: ui.surface, borderColor: ui.border },
                ]}
              >
                <Ionicons name="text-outline" size={20} color={ui.primary} />
                <TextInput
                  value={title}
                  onChangeText={setTitle}
                  placeholder="Give your note a title..."
                  placeholderTextColor={ui.placeholder}
                  returnKeyType="next"
                  style={[styles.titleInput, { color: ui.text }]}
                />
              </View>

              {/* Note */}
              <View style={styles.sectionHeading}>
                <Text
                  style={[
                    styles.label,
                    { color: ui.text, marginTop: 22, marginBottom: 10 },
                  ]}
                >
                  Your note
                </Text>
                <Text
                  style={[styles.optionalText, { color: ui.secondaryText }]}
                >
                  UP TO {MAX_CHARS} CHARACTERS
                </Text>
              </View>
              <View
                style={[
                  styles.noteCard,
                  { backgroundColor: ui.surface, borderColor: ui.border },
                ]}
              >
                <TextInput
                  value={note}
                  onChangeText={(t) => setNote(t.slice(0, MAX_CHARS))}
                  placeholder="What's on your mind? Start writing..."
                  placeholderTextColor={ui.placeholder}
                  multiline
                  textAlignVertical="top"
                  style={[styles.noteInput, { color: ui.text }]}
                />
                <View
                  style={[styles.counterRow, { borderTopColor: ui.border }]}
                >
                  <View style={styles.writingHint}>
                    <Ionicons
                      name="create-outline"
                      size={14}
                      color={ui.secondaryText}
                    />
                    <Text
                      style={[
                        styles.writingHintText,
                        { color: ui.secondaryText },
                      ]}
                    >
                      Your thoughts, your space
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.counter,
                      {
                        color:
                          note.length >= MAX_CHARS
                            ? "#DC2626"
                            : ui.secondaryText,
                      },
                    ]}
                  >
                    {note.length}/{MAX_CHARS}
                  </Text>
                </View>
              </View>

              {/* Theme */}
              <View style={[styles.rowBetween, { marginTop: 6 }]}>
                <View>
                  <Text
                    style={[
                      styles.label,
                      { color: ui.text, marginTop: 22, marginBottom: 4 },
                    ]}
                  >
                    Personalize
                  </Text>
                  <Text
                    style={[styles.sectionHint, { color: ui.secondaryText }]}
                  >
                    Choose a background that feels like you.
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => {
                    setTab("Colors");
                    setSheet("themes");
                  }}
                  style={[styles.seeAll, { backgroundColor: ui.softAction }]}
                >
                  <Text style={[styles.seeAllText, { color: ui.primary }]}>
                    View all
                  </Text>
                  <Ionicons name="arrow-forward" size={14} color={ui.primary} />
                </TouchableOpacity>
              </View>

              <View
                style={[
                  styles.themeGrid,
                  {
                    backgroundColor: ui.softSurface,
                    borderColor: ui.softBorder,
                  },
                ]}
              >
                {MAIN_ROW.map((t) => (
                  <View key={t.id} style={styles.themeCell}>
                    <Swatch
                      theme={t}
                      selected={theme.id === t.id}
                      selectedColor={ui.primary}
                      size={62}
                      onPress={() => setTheme(t)}
                    />
                    <Text
                      style={[
                        styles.themeName,
                        { color: ui.text },
                        theme.id === t.id && {
                          color: ui.primary,
                          fontWeight: "700",
                        },
                      ]}
                    >
                      {t.label}
                    </Text>
                  </View>
                ))}
                <View style={styles.themeCell}>
                  {isImage ? (
                    <Swatch
                      theme={theme}
                      selected
                      selectedColor={ui.primary}
                      size={62}
                      onPress={() => setSheet("images")}
                    />
                  ) : (
                    <ImageSwatch
                      onPress={() => setSheet("images")}
                      primary={ui.primary}
                      isDark={isDark}
                    />
                  )}
                  <Text
                    style={[
                      styles.themeName,
                      { color: ui.text },
                      isImage && { color: ui.primary, fontWeight: "700" },
                    ]}
                  >
                    Image
                  </Text>
                </View>
              </View>

              {/* Reminder */}
              <View style={styles.sectionHeading}>
                <Text
                  style={[
                    styles.label,
                    { color: ui.text, marginTop: 24, marginBottom: 10 },
                  ]}
                >
                  Reminder
                </Text>
                <Text
                  style={[styles.optionalText, { color: ui.secondaryText }]}
                >
                  OPTIONAL
                </Text>
              </View>
              <TouchableOpacity
                activeOpacity={0.82}
                onPress={openReminder}
                style={[
                  styles.reminderCard,
                  {
                    backgroundColor: ui.surface,
                    borderColor: reminder ? ui.primary : ui.border,
                  },
                ]}
              >
                <View
                  style={[
                    styles.reminderIconWrap,
                    { backgroundColor: ui.reminderSurface },
                  ]}
                >
                  <Ionicons
                    name="notifications-outline"
                    size={21}
                    color={ui.primary}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.reminderTitle, { color: ui.text }]}>
                    {reminderLabel
                      ? "Reminder scheduled"
                      : "Never miss a thought"}
                  </Text>
                  <Text
                    style={[
                      styles.reminderText,
                      { color: reminderLabel ? ui.primary : ui.secondaryText },
                    ]}
                  >
                    {reminderLabel || "Tap to choose date and time"}
                  </Text>
                </View>
                <Ionicons
                  name={reminderLabel ? "checkmark-circle" : "chevron-forward"}
                  size={21}
                  color={reminderLabel ? ui.primary : ui.secondaryText}
                />
              </TouchableOpacity>
            </>
          )}
          {/* CTA */}
          <TouchableOpacity
            activeOpacity={0.88}
            onPress={handleCreate}
            disabled={saving}
            style={{
              marginTop: isDesktop ? 20 : 28,
              maxWidth: isDesktop ? 620 : undefined,
              alignSelf: isDesktop ? "center" : undefined,
              width: isDesktop ? "100%" : undefined,
            }}
          >
            <LinearGradient
              colors={accent}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[
                styles.cta,
                { shadowColor: ui.primary, opacity: saving ? 0.72 : 1 },
              ]}
            >
              {saving ? (
                <View style={styles.ctaInner}>
                  <Text style={styles.ctaText}>Saving your note...</Text>
                </View>
              ) : (
                <View style={styles.ctaInner}>
                  <Ionicons
                    name="checkmark-circle-outline"
                    size={22}
                    color="#FFFFFF"
                  />
                  <Text style={styles.ctaText}>
                    {isEditMode === "true" ? "Update note" : "Create note"}
                  </Text>
                  <Ionicons name="arrow-forward" size={19} color="#FFFFFF" />
                </View>
              )}
            </LinearGradient>
          </TouchableOpacity>
          <Text style={[styles.footerHint, { color: ui.secondaryText }]}>
            A little note today can become a big idea tomorrow.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: isDefaultTheme ? ui.background : theme.bg,
      }}
    >
      {/* Screen background follows the selected theme */}
      {isImage ? (
        <ImageBackground
          source={{ uri: theme.uri }}
          style={{ flex: 1 }}
          blurRadius={4}
        >
          <View
            style={{
              flex: 1,
              backgroundColor: isDark
                ? "rgba(0,0,0,0.42)"
                : "rgba(255,255,255,0.6)",
            }}
          >
            {Body}
          </View>
        </ImageBackground>
      ) : (
        <View style={{ flex: 1 }}>
          {theme.kind === "gradient" && !isDefaultTheme && (
            <LinearGradient
              colors={[
                mix(theme.colors[0], "#ffffff", 0.6),
                mix(theme.colors[1], "#ffffff", 0.45),
              ]}
              style={StyleSheet.absoluteFill}
            />
          )}
          {isPattern && (
            <PatternOverlay type={theme.pattern} ink={theme.ink} cell={46} />
          )}
          {Body}
        </View>
      )}

      {/* ---------------- Single bottom sheet (themes / images) ---------------- */}
      <Modal
        visible={!!sheet}
        transparent
        animationType="slide"
        onRequestClose={() => setSheet(null)}
      >
        <View
          style={[
            styles.backdrop,
            {
              backgroundColor: isDark
                ? "rgba(0,0,0,0.58)"
                : "rgba(20,20,40,0.35)",
            },
          ]}
        >
          <TouchableOpacity
            style={{ flex: 1 }}
            activeOpacity={1}
            onPress={() => setSheet(null)}
          />

          <View
            style={[
              styles.sheet,
              {
                backgroundColor: ui.surface,
                borderColor: ui.border,
                borderWidth: 1,
              },
            ]}
          >
            {sheet === "themes" ? (
              <>
                <View style={styles.sheetHeader}>
                  <Text style={[styles.sheetTitle, { color: ui.text }]}>
                    Theme Selection
                  </Text>
                  <TouchableOpacity onPress={() => setSheet(null)} hitSlop={12}>
                    <Ionicons name="close" size={22} color={ui.text} />
                  </TouchableOpacity>
                </View>

                <View style={styles.tabs}>
                  {TABS.map((t) => (
                    <TouchableOpacity
                      key={t}
                      onPress={() =>
                        t === "Image" ? setSheet("images") : setTab(t)
                      }
                      style={[
                        styles.tab,
                        { borderBottomColor: ui.border },
                        tab === t && {
                          borderBottomWidth: 2,
                          borderBottomColor: ui.primary,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.tabText,
                          { color: ui.secondaryText },
                          tab === t && { color: ui.primary, fontWeight: "700" },
                        ]}
                      >
                        {t}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <ScrollView
                  style={{ flexShrink: 1 }}
                  contentContainerStyle={styles.sheetGrid}
                  showsVerticalScrollIndicator={false}
                >
                  {sheetList.map((t) => (
                    <Swatch
                      key={t.id}
                      theme={t}
                      size={sheetSwatch}
                      selectedColor={ui.primary}
                      selected={theme.id === t.id}
                      onPress={() => pickTheme(t)}
                    />
                  ))}
                </ScrollView>
              </>
            ) : (
              <>
                <View style={styles.sheetHeader}>
                  <TouchableOpacity
                    onPress={() => setSheet("themes")}
                    hitSlop={12}
                  >
                    <Ionicons name="chevron-back" size={22} color={ui.text} />
                  </TouchableOpacity>
                  <Text style={[styles.sheetTitle, { color: ui.text }]}>
                    Select Image Background
                  </Text>
                  <TouchableOpacity onPress={() => setSheet(null)} hitSlop={12}>
                    <Ionicons name="close" size={22} color={ui.text} />
                  </TouchableOpacity>
                </View>

                <ScrollView
                  style={{ flexShrink: 1 }}
                  contentContainerStyle={styles.imageGrid}
                  showsVerticalScrollIndicator={false}
                >
                  {GALLERY.map((uri) => (
                    <TouchableOpacity
                      key={uri}
                      activeOpacity={0.85}
                      onPress={() => applyImage(uri)}
                      style={{
                        width: imageCell,
                        height: imageCell,
                        borderRadius: 14,
                        overflow: "hidden",
                      }}
                    >
                      <Image
                        source={{ uri }}
                        style={{ width: "100%", height: "100%" }}
                      />
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                <TouchableOpacity
                  onPress={chooseFromGallery}
                  style={[
                    styles.galleryBtn,
                    { backgroundColor: ui.softAction },
                  ]}
                >
                  <Ionicons name="image-outline" size={18} color={ui.primary} />
                  <Text style={[styles.galleryText, { color: ui.primary }]}>
                    Choose from Gallery
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* ---------------- Date / time picker ---------------- */}

      {/* ANDROID: native date picker followed by native time picker */}
      {Platform.OS === "android" &&
        (pickerMode === "date" || pickerMode === "time") && (
          <DateTimePicker
            value={tempDate}
            mode={pickerMode}
            minimumDate={pickerMode === "date" ? new Date() : undefined}
            onChange={onAndroidChange}
          />
        )}

      {/* IOS: native spinner inside a bottom sheet */}
      {Platform.OS === "ios" && (
        <Modal
          visible={pickerMode === "ios"}
          transparent
          animationType="slide"
          onRequestClose={() => setPickerMode(null)}
        >
          <View
            style={[
              styles.backdrop,
              {
                backgroundColor: isDark
                  ? "rgba(0,0,0,0.58)"
                  : "rgba(20,20,40,0.35)",
              },
            ]}
          >
            <TouchableOpacity
              style={{ flex: 1 }}
              activeOpacity={1}
              onPress={() => setPickerMode(null)}
            />
            <View
              style={[
                styles.sheet,
                {
                  backgroundColor: ui.surface,
                  borderColor: ui.border,
                  borderWidth: 1,
                },
              ]}
            >
              <View
                style={[styles.sheetHandle, { backgroundColor: ui.border }]}
              />
              <Text
                style={{
                  color: ui.text,
                  fontSize: 18,
                  fontWeight: "800",
                  textAlign: "center",
                  marginBottom: 12,
                }}
              >
                Select Reminder
              </Text>
              <DateTimePicker
                value={tempDate}
                mode="datetime"
                display="spinner"
                minimumDate={new Date()}
                onChange={(_, date) => {
                  if (date) setTempDate(date);
                }}
              />
              <TouchableOpacity
                style={[styles.galleryBtn, { backgroundColor: ui.softAction }]}
                onPress={saveReminder}
              >
                <Text style={[styles.galleryText, { color: ui.primary }]}>
                  Set Reminder
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}

      {/* WEB: browser-native date and time input in a themed modal */}
      {Platform.OS === "web" && (
        <Modal
          visible={pickerMode === "web"}
          transparent
          animationType="fade"
          onRequestClose={() => setPickerMode(null)}
        >
          <View
            style={{
              flex: 1,
              justifyContent: "center",
              alignItems: "center",
              padding: 20,
              backgroundColor: "rgba(0,0,0,0.45)",
            }}
          >
            <View
              style={{
                width: "100%",
                maxWidth: 430,
                padding: 24,
                borderRadius: 20,
                backgroundColor: ui.surface,
                borderWidth: 1,
                borderColor: ui.border,
                ...(Platform.OS === "web"
                  ? { boxShadow: "0 12px 36px rgba(0,0,0,0.18)" }
                  : {}),
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
                    style={{ color: ui.text, fontSize: 20, fontWeight: "800" }}
                  >
                    Set Reminder
                  </Text>
                  <Text
                    style={{
                      color: ui.secondaryText,
                      fontSize: 13,
                      marginTop: 5,
                    }}
                  >
                    Choose a future date and time
                  </Text>
                </View>
                <TouchableOpacity onPress={() => setPickerMode(null)}>
                  <Ionicons
                    name="close-circle-outline"
                    size={26}
                    color={ui.secondaryText}
                  />
                </TouchableOpacity>
              </View>

              <Text
                style={{
                  color: ui.text,
                  fontSize: 14,
                  fontWeight: "700",
                  marginBottom: 9,
                }}
              >
                Date & Time
              </Text>

              <input
                type="datetime-local"
                value={getWebDateTimeValue(tempDate)}
                min={getWebDateTimeValue(new Date())}
                onChange={(event) =>
                  handleWebReminderChange(event.target.value)
                }
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  height: 48,
                  padding: "0 12px",
                  borderRadius: 10,
                  border: `1px solid ${ui.border}`,
                  backgroundColor: ui.background,
                  color: ui.text,
                  fontSize: 15,
                  outline: "none",
                }}
              />

              <View
                style={{
                  marginTop: 16,
                  padding: 14,
                  borderRadius: 12,
                  backgroundColor: ui.reminderSurface,
                }}
              >
                <View
                  style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
                >
                  <Ionicons
                    name="notifications-outline"
                    size={18}
                    color={ui.primary}
                  />
                  <Text
                    style={{
                      color: ui.primary,
                      fontSize: 14,
                      fontWeight: "700",
                    }}
                  >
                    {tempDate.toLocaleDateString("en-GB", {
                      weekday: "short",
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                  </Text>
                </View>
                <Text
                  style={{
                    color: ui.text,
                    fontSize: 19,
                    fontWeight: "800",
                    marginTop: 7,
                  }}
                >
                  {tempDate.toLocaleTimeString("en-US", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </Text>
              </View>

              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "flex-end",
                  gap: 10,
                  marginTop: 22,
                }}
              >
                <TouchableOpacity
                  onPress={() => setPickerMode(null)}
                  style={{
                    paddingHorizontal: 18,
                    paddingVertical: 12,
                    borderRadius: 10,
                    backgroundColor: ui.softAction,
                  }}
                >
                  <Text style={{ color: ui.secondaryText, fontWeight: "700" }}>
                    Cancel
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={saveReminder}
                  style={{
                    paddingHorizontal: 20,
                    paddingVertical: 12,
                    borderRadius: 10,
                    backgroundColor: ui.primary,
                  }}
                >
                  <Text style={{ color: "#FFFFFF", fontWeight: "700" }}>
                    Set Reminder
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

/* --------------------------------- STYLES --------------------------------- */

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },

  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },

  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    marginLeft: 12,
  },

  scroll: { paddingHorizontal: 20, paddingBottom: 38 },
  desktopScroll: {
    width: "100%",
    maxWidth: 1440,
    alignSelf: "center",
    paddingHorizontal: 40,
    paddingTop: 12,
    paddingBottom: 28,
  },
  desktopHeader: {
    width: "100%",
    maxWidth: 1440,
    alignSelf: "center",
    paddingHorizontal: 40,
    paddingVertical: 10,
  },
  desktopHero: {
    minHeight: 148,
    paddingHorizontal: 30,
    paddingVertical: 22,
    borderRadius: 22,
    marginBottom: 18,
  },
  desktopColumns: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 24,
    width: "100%",
  },
  desktopColumn: {
    flex: 1,
    minWidth: 0,
    backgroundColor: "rgba(255,255,255,0.48)",
    borderWidth: 1,
    borderColor: "rgba(127,160,142,0.14)",
    borderRadius: 20,
    paddingHorizontal: 22,
    paddingVertical: 8,
  },
  hero: {
    borderRadius: 28,
    padding: 21,
    flexDirection: "row",
    minHeight: 176,
    overflow: "hidden",
    marginTop: 4,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.45)",
  },
  heroPill: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 20,
    marginBottom: 11,
  },
  heroPillText: { fontSize: 9, fontWeight: "800", letterSpacing: 1.1 },
  heroTitle: {
    fontSize: 26,
    fontWeight: "900",
    lineHeight: 31,
    letterSpacing: -0.7,
  },
  heroSub: {
    fontSize: 12,
    marginTop: 8,
    opacity: 0.84,
    lineHeight: 18,
    maxWidth: 190,
  },
  heroArt: {
    width: 104,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 4,
  },
  paper: {
    width: 74,
    height: 94,
    backgroundColor: "rgba(255,255,255,0.92)",
    borderRadius: 15,
    padding: 12,
    transform: [{ rotate: "8deg" }],
    gap: 8,
    shadowColor: "#1A5B43",
    shadowOpacity: 0.14,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 7 },
    elevation: 3,
  },
  paperLine: {
    height: 5,
    borderRadius: 3,
    backgroundColor: "#B7E6D0",
    width: "90%",
  },
  pencil: {
    position: "absolute",
    right: 1,
    bottom: 6,
    transform: [{ rotate: "10deg" }],
  },
  spark: { position: "absolute", top: 0, right: 3 },
  label: { fontSize: 17, fontWeight: "800", letterSpacing: -0.25 },
  sectionHeading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  optionalText: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.8,
    marginTop: 22,
    marginBottom: 10,
  },
  fieldCard: {
    minHeight: 58,
    borderRadius: 17,
    borderWidth: 1,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    shadowColor: "#18392B",
    shadowOpacity: 0.035,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
  },
  titleInput: { flex: 1, paddingVertical: 15, fontSize: 15, fontWeight: "500" },
  noteCard: {
    height: 174,
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 15,
    paddingTop: 13,
    paddingBottom: 0,
    shadowColor: "#18392B",
    shadowOpacity: 0.035,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
  },
  noteInput: { flex: 1, fontSize: 15, lineHeight: 22, padding: 0 },
  counterRow: {
    minHeight: 36,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 8,
  },
  writingHint: { flexDirection: "row", alignItems: "center", gap: 5 },
  writingHintText: { fontSize: 11, fontWeight: "500" },
  counter: { fontSize: 11, fontWeight: "700" },
  rowBetween: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
  },
  sectionHint: { fontSize: 12, marginBottom: 13, lineHeight: 17 },
  seeAll: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginBottom: 13,
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderRadius: 20,
  },
  seeAllText: { fontSize: 12, fontWeight: "800" },
  themeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    rowGap: 10,
    backgroundColor: "rgba(127,160,142,0.07)",
    borderRadius: 22,
    paddingVertical: 12,
    paddingHorizontal: 5,
    borderWidth: 1,
    borderColor: "rgba(127,160,142,0.12)",
  },
  themeCell: { width: "20%", alignItems: "center" },
  themeName: {
    fontSize: 11,
    marginTop: 6,
    fontWeight: "600",
    textAlign: "center",
  },
  check: {
    position: "absolute",
    right: 4,
    bottom: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: BRAND,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  imageSwatch: {
    width: 58,
    height: 58,
    borderRadius: 16,
    backgroundColor: "#ECEDF2",
    alignItems: "center",
    justifyContent: "center",
    margin: 2,
    borderWidth: 1,
    borderColor: "rgba(127,160,142,0.25)",
  },
  plus: {
    position: "absolute",
    right: 4,
    bottom: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#1FA37F",
    alignItems: "center",
    justifyContent: "center",
  },
  reminderCard: {
    minHeight: 78,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 13,
    paddingVertical: 12,
    borderRadius: 18,
    borderWidth: 1,
  },
  reminderIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  reminderTitle: { fontSize: 14, fontWeight: "800", marginBottom: 4 },
  reminderText: { flex: 1, fontSize: 12, lineHeight: 17 },
  cta: {
    height: 58,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
    shadowOpacity: 0.22,
    shadowRadius: 13,
    shadowOffset: { width: 0, height: 7 },
    elevation: 5,
  },
  ctaInner: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  ctaText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 0.1,
  },
  footerHint: {
    textAlign: "center",
    fontSize: 11,
    marginTop: 14,
    marginBottom: 4,
  },
  backdrop: { flex: 1, justifyContent: "flex-end" },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 20,
    paddingTop: 10,
    paddingBottom: 32,
    maxHeight: "80%",
  },
  sheetHandle: {
    width: 42,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 18,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  sheetTitle: { fontSize: 17, fontWeight: "800", letterSpacing: -0.2 },
  tabs: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    marginBottom: 16,
  },
  tab: { paddingVertical: 10, paddingHorizontal: 7 },
  tabActive: { borderBottomWidth: 2 },
  tabText: { fontSize: 13, fontWeight: "600" },
  tabTextActive: { fontWeight: "800" },
  sheetGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    paddingBottom: 8,
  },
  imageGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    paddingBottom: 8,
  },
  galleryBtn: {
    marginTop: 14,
    height: 48,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  galleryText: { fontWeight: "800", fontSize: 14 },
});
