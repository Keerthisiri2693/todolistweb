import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  NativeSyntheticEvent,
  TextInputKeyPressEventData,
} from "react-native";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
  NativeModules,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";

import { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import { RichEditor } from "react-native-pell-rich-editor";

import { Ionicons } from "@expo/vector-icons";

import AsyncStorage from "@react-native-async-storage/async-storage";

import axios from "axios";
import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
  useAudioRecorder,
  useAudioRecorderState,
} from "expo-audio";
import * as Clipboard from "expo-clipboard";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import * as Notifications from "expo-notifications";
import { router, useLocalSearchParams } from "expo-router";
import { VideoView, useVideoPlayer } from "expo-video";
import { SafeAreaView } from "react-native-safe-area-context";
import { captureRef } from "react-native-view-shot";
import { useAppTheme } from "../../context/app-theme-context";

import DraggableFlatList, {
  ScaleDecorator,
} from "react-native-draggable-flatlist";

const API_BASE_URL = "https://todolistbackend-855c.onrender.com";

type TodoStatus = "Pending" | "Completed" | "Overdue";

type ReorderChecklistItem = {
  id: string;
  text: string;
  checked: boolean;
};

const mintTheme = {
  background: "#EAF8F1",
  surface: "#F5FCF8",
  primary: "#16866A",
  primaryDark: "#116B55",
  border: "#D3EDE0",
  text: "#183B32",
  subtitle: "#6B877C",
};

type DrawingPoint = { x: number; y: number; t?: number };
type DrawingStroke = { points: DrawingPoint[]; color: string; width: number };

type TodoItem = {
  id?: string | number;
  tdlId?: string | number;
  _id?: string | number;
  todoId?: string | number;
  title?: string;
  text?: string;
  date?: string;
  alarm?: string;
  reminderDate?: string | null;
  reminderTime?: string | null;
  recurring?: "none" | "daily" | "weekly" | "monthly";
  status?: string;
  type?: string;
  fileIds?: unknown;
  backgroundImageUrl?: string;
  backgroundImage?: string;
  quickNoteColor?: string;
  quickNotePinned?: boolean;
  notePattern?: string;
  notebookStyle?: "classic" | "minimal" | "journal";
  noteTextSize?: "small" | "medium" | "large";
  noteCornerStyle?: "square" | "rounded" | "soft";
  alignment?: "left" | "center" | "right";
  createdAt?: string;
  updatedAt?: string;
  isLocalDuplicate?: boolean;
};

type ExistingAttachment = {
  id: string;
  type: string;
  name: string;
  uri: string;
};

type WebSelectedFile = {
  uri: string;
  file: File;
};

type ApiResponse = {
  success?: boolean;
  message?: string;
  data?: TodoItem | string;
  todo?: TodoItem;
  task?: TodoItem;
};

type LocalQuickNote = {
  _id: string;
  id: string;
  title: string;
  description?: string;
  text?: string;
  drawingUri?: string;
  drawingText?: string;
  imageUri?: string;
  videoUri?: string;
  voiceUri?: string;
  backgroundImageUri?: string;
  backgroundImageUrl?: string;
  notePattern?: string;
  serverTodoId?: string;
  isQuickNote: true;
  quickNoteColor: string;
  quickNotePinned: boolean;
  createdAt: string;
  updatedAt: string;
  localOnly: boolean;
};

const COLORS = {
  background: "#EAF8F1",
  surface: "#F5FCF8",
  primary: "#16866A",
  primaryDark: "#116B55",
  primaryLight: "#DDF4E8",
  text: "#183B32",
  secondaryText: "#6B877C",
  border: "#D3EDE0",
  muted: "#E4F5EC",
  green: "#16866A",
  greenLight: "#DDF4E8",
  orange: "#C9852A",
  orangeLight: "#FFF4E3",
  red: "#D94F5C",
  redLight: "#FFF0F1",
};

const authHeader = (token: string) => ({
  Authorization: token.startsWith("Bearer ") ? token : `Bearer ${token}`,
});

const toDateInput = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const toAlarmLabel = (date: Date) => {
  return date.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const getStatusForDate = (dateText: string, dueDateTime?: Date): TodoStatus => {
  if (!dateText) return "Pending";
  // When the selected due time is available, compare the full timestamp.
  // Otherwise treat the date as due at the end of that day.
  const due =
    dueDateTime && !Number.isNaN(dueDateTime.getTime())
      ? dueDateTime
      : new Date(`${dateText}T23:59:59`);
  if (Number.isNaN(due.getTime())) return "Pending";
  return due.getTime() < Date.now() ? "Overdue" : "Pending";
};

const getFileName = (uri: string, fallback: string) => {
  const lastPart = uri.split("/").pop()?.split("?")[0];
  return lastPart || `${fallback}_${Date.now()}`;
};

/**
 * Appends a local file to multipart FormData.
 *
 * React Native networking accepts { uri, name, type } descriptors.
 * Browser/Electron FormData does not: it requires a real Blob/File.
 * This helper keeps native behaviour and converts local web/blob URIs
 * into Blob objects before appending them.
 */
const appendLocalUpload = async (
  formData: FormData,
  fieldName: string,
  uri: string,
  fileName: string,
  mimeType: string,
  webFile?: Blob | null,
) => {
  if (Platform.OS === "web") {
    let blob: Blob;

    if (webFile instanceof Blob) {
      blob = webFile;
    } else {
      const response = await fetch(uri);
      if (!response.ok) {
        throw new Error(`Unable to read attachment: ${fileName}`);
      }
      blob = await response.blob();
    }

    const resolvedType = blob.type || mimeType || "application/octet-stream";
    const uploadBlob =
      blob.type === resolvedType
        ? blob
        : new Blob([blob], { type: resolvedType });

    formData.append(fieldName, uploadBlob, fileName);
    return;
  }

  formData.append(
    fieldName,
    {
      uri,
      name: fileName,
      type: mimeType || "application/octet-stream",
    } as unknown as Blob,
  );
};

const getAudioMimeType = (fileName: string, fallback = "audio/mp4") => {
  const extension = fileName.split(".").pop()?.toLowerCase();
  if (extension === "webm") return "audio/webm";
  if (extension === "wav") return "audio/wav";
  if (extension === "mp3") return "audio/mpeg";
  if (extension === "aac") return "audio/aac";
  if (extension === "ogg" || extension === "opus") return "audio/ogg";
  if (extension === "m4a" || extension === "mp4") return "audio/mp4";
  return fallback;
};

const getExistingAttachments = (
  todo: TodoItem | null | undefined,
): ExistingAttachment[] => {
  if (!todo) return [];

  const rawTodo = todo as TodoItem & Record<string, unknown>;

  // The API/local cache may serialize fileIds as JSON text instead of an array.
  // Normalize both formats so editing does not silently drop saved attachments.
  const rawIds: unknown[] = (() => {
    if (Array.isArray(todo.fileIds)) return todo.fileIds;
    if (typeof todo.fileIds === "string" && todo.fileIds.trim()) {
      try {
        const parsed: unknown = JSON.parse(todo.fileIds);
        if (Array.isArray(parsed)) return parsed;
      } catch {
        // Some older records stored a single ID as plain text.
        return [todo.fileIds];
      }
    }
    const legacyIds = rawTodo.attachmentIds ?? rawTodo.files;
    if (Array.isArray(legacyIds)) {
      return legacyIds.map((entry) =>
        entry && typeof entry === "object"
          ? ((entry as Record<string, unknown>).id ??
            (entry as Record<string, unknown>).fileId ??
            (entry as Record<string, unknown>)._id)
          : entry,
      );
    }
    return [];
  })();
  const rawTypes = Array.isArray(rawTodo.fileTypes)
    ? rawTodo.fileTypes
    : Array.isArray(rawTodo.attachmentTypes)
      ? rawTodo.attachmentTypes
      : Array.isArray(rawTodo.mimeTypes)
        ? rawTodo.mimeTypes
        : Array.isArray(todo.type)
          ? todo.type
          : todo.type
            ? [todo.type]
            : [];

  const rawNames = Array.isArray(rawTodo.fileNames)
    ? rawTodo.fileNames
    : Array.isArray(rawTodo.attachmentNames)
      ? rawTodo.attachmentNames
      : [];

  return rawIds
    .map((rawId, index) => {
      if (rawId === null || rawId === undefined || String(rawId).trim() === "")
        return null;
      const id = String(rawId);
      const rawType = rawTypes[index] ?? rawTypes[0] ?? "";
      const type =
        typeof rawType === "string" ? rawType : String(rawType ?? "");
      const rawName = rawNames[index];
      const name =
        typeof rawName === "string" && rawName.trim()
          ? rawName
          : `Attachment ${index + 1}`;
      return {
        id,
        type,
        name,
        uri: `${API_BASE_URL.replace(/\/+$/, "")}/api/media/${encodeURIComponent(id)}`,
      };
    })
    .filter((item): item is ExistingAttachment => item !== null);
};

const parseDateText = (value: string): Date | null => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  date.setHours(0, 0, 0, 0);
  return date;
};

const formatLongDate = (dateText: string) => {
  const date = parseDateText(dateText);
  if (!date) return "Choose due date";
  return date.toLocaleDateString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const getErrorMessage = (error: unknown) => {
  if (axios.isAxiosError(error)) {
    return (
      error.response?.data?.message ||
      error.message ||
      "Unable to connect to the server."
    );
  }
  return error instanceof Error ? error.message : "Something went wrong.";
};

type VideoPreviewProps = { uri: string };

function VideoPreview({ uri }: VideoPreviewProps) {
  const player = useVideoPlayer(uri, (videoPlayer) => {
    videoPlayer.pause();
  });

  return (
    <View style={styles.videoPreviewCard}>
      <VideoView
        player={player}
        style={styles.videoPreview}
        nativeControls
        contentFit="contain"
      />
      <Text style={styles.videoPreviewCaption}>Selected video</Text>
    </View>
  );
}

type NotePatternProps = {
  pattern: string;
  ink: string;
};

/** Shared pattern renderer used by both the paper-theme previews and note editor. */

/** Shared pattern renderer used by paper-theme previews and note editor. */
function NotePattern({ pattern, ink }: NotePatternProps) {
  const rows = Array.from({ length: 8 });
  const cols = Array.from({ length: 10 });
  const normalized = (pattern || "plain").trim().toLowerCase();

  if (!normalized || normalized === "plain") return null;

  const motifGlyph: Record<string, string> = {
    heart: "♥",
    hearts: "♥",
    star: "★",
    stars: "✦",
    flower: "✿",
    leaf: "❧",
    coffee: "☕",
    bubbles: "○",
    sunrise: "☀",
    petals: "❀",
    clouds: "☁",
    rainbow: "⌒",
    sparkles: "✧",
    snowflakes: "❄",
    ornamental: "❧",
  };

  const motifPatterns = new Set(Object.keys(motifGlyph));

  return (
    <View
      pointerEvents="none"
      collapsable={false}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        overflow: "hidden",
        zIndex: 2,
        elevation: 2,
      }}
    >
      {/* LINED */}
      {(normalized === "lined" || normalized === "stripes") &&
        Array.from({ length: 14 }, (_, index) => (
          <View
            key={`line-${index}`}
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: `${7 + index * 7.5}%`,
              height: 1,
              backgroundColor: ink,
            }}
          />
        ))}

      {/* DOTS */}
      {(normalized === "dotted" ||
        normalized === "dots" ||
        normalized === "microdots") &&
        rows.map((_, row) =>
          cols.map((__, col) => (
            <View
              key={`dot-${row}-${col}`}
              style={{
                position: "absolute",
                left: `${5 + col * 10}%`,
                top: `${6 + row * 12}%`,
                width: normalized === "microdots" ? 2 : 3.5,
                height: normalized === "microdots" ? 2 : 3.5,
                borderRadius: 4,
                backgroundColor: ink,
                opacity: normalized === "microdots" ? 0.55 : 0.78,
              }}
            />
          )),
        )}

      {/* GRID */}
      {normalized === "grid" && (
        <>
          {Array.from({ length: 13 }, (_, index) => (
            <View
              key={`grid-v-${index}`}
              style={{
                position: "absolute",
                left: `${index * 8.33}%`,
                top: 0,
                bottom: 0,
                width: 1,
                backgroundColor: ink,
                opacity: 0.7,
              }}
            />
          ))}
          {Array.from({ length: 14 }, (_, index) => (
            <View
              key={`grid-h-${index}`}
              style={{
                position: "absolute",
                top: `${index * 7.7}%`,
                left: 0,
                right: 0,
                height: 1,
                backgroundColor: ink,
                opacity: 0.7,
              }}
            />
          ))}
        </>
      )}

      {/* DIAGONAL */}
      {normalized === "diagonal" &&
        Array.from({ length: 17 }, (_, index) => (
          <View
            key={`diagonal-${index}`}
            style={{
              position: "absolute",
              left: "-25%",
              top: `${index * 8}%`,
              width: "150%",
              height: 1.2,
              backgroundColor: ink,
              opacity: 0.75,
              transform: [{ rotate: "-25deg" }],
            }}
          />
        ))}

      {/* WAVES */}
      {normalized === "waves" &&
        Array.from({ length: 8 }, (_, index) => (
          <Text
            key={`wave-${index}`}
            numberOfLines={1}
            style={{
              position: "absolute",
              left: "-5%",
              top: `${index * 14}%`,
              width: "115%",
              color: ink,
              fontSize: 25,
              letterSpacing: 3,
              opacity: 0.75,
            }}
          >
            〰 〰 〰 〰 〰
          </Text>
        ))}

      {/* CIRCLES */}
      {normalized === "circles" &&
        rows.map((_, row) =>
          cols.map((__, col) => (
            <View
              key={`circle-${row}-${col}`}
              style={{
                position: "absolute",
                left: `${2 + col * 11}%`,
                top: `${2 + row * 12}%`,
                width: 22,
                height: 22,
                borderRadius: 12,
                borderWidth: 1.2,
                borderColor: ink,
                opacity: 0.65,
              }}
            />
          )),
        )}

      {/* CHECKER */}
      {normalized === "checker" &&
        Array.from({ length: 8 }, (_, row) =>
          Array.from({ length: 10 }, (_, col) =>
            (row + col) % 2 === 0 ? (
              <View
                key={`checker-${row}-${col}`}
                style={{
                  position: "absolute",
                  left: `${col * 10}%`,
                  top: `${row * 12.5}%`,
                  width: "10%",
                  height: "12.5%",
                  backgroundColor: ink,
                  opacity: 0.13,
                }}
              />
            ) : null,
          ),
        )}

      {/* ZIGZAG */}
      {normalized === "zigzag" &&
        Array.from({ length: 8 }, (_, row) => (
          <Text
            key={`zigzag-${row}`}
            numberOfLines={1}
            style={{
              position: "absolute",
              left: "-3%",
              top: `${row * 14}%`,
              width: "110%",
              color: ink,
              fontSize: 23,
              letterSpacing: 5,
              opacity: 0.72,
            }}
          >
            ⌁⌁⌁⌁⌁⌁⌁
          </Text>
        ))}

      {/* CROSS */}
      {normalized === "cross" &&
        rows.map((_, row) =>
          cols.map((__, col) => (
            <Text
              key={`cross-${row}-${col}`}
              style={{
                position: "absolute",
                left: `${5 + col * 10}%`,
                top: `${5 + row * 12}%`,
                color: ink,
                fontSize: 12,
                opacity: 0.68,
              }}
            >
              ✚
            </Text>
          )),
        )}

      {/* CONFETTI */}
      {normalized === "confetti" &&
        Array.from({ length: 48 }, (_, index) => {
          const glyphs = ["•", "✦", "▪", "✧", "＋"];
          return (
            <Text
              key={`confetti-${index}`}
              style={{
                position: "absolute",
                left: `${(index * 37) % 96}%`,
                top: `${(index * 53) % 94}%`,
                color: ink,
                fontSize: index % 3 === 0 ? 13 : 10,
                opacity: 0.75,
                transform: [{ rotate: `${(index * 29) % 90}deg` }],
              }}
            >
              {glyphs[index % glyphs.length]}
            </Text>
          );
        })}

      {/* DIAMONDS */}
      {normalized === "diamonds" &&
        rows.map((_, row) =>
          cols.map((__, col) => (
            <View
              key={`diamond-${row}-${col}`}
              style={{
                position: "absolute",
                left: `${5 + col * 10}%`,
                top: `${5 + row * 12}%`,
                width: 11,
                height: 11,
                borderWidth: 1.1,
                borderColor: ink,
                transform: [{ rotate: "45deg" }],
                opacity: 0.75,
              }}
            />
          )),
        )}

      {/* THEMES WITH REPEATED MOTIFS */}
      {motifPatterns.has(normalized) &&
        rows.map((_, row) =>
          cols.map((__, col) => {
            const glyph = motifGlyph[normalized];
            const alternate =
              normalized === "bubbles" ||
              normalized === "petals" ||
              normalized === "sparkles" ||
              normalized === "snowflakes" ||
              normalized === "ornamental";
            const useGlyph = !alternate || (row + col) % 2 === 0;

            return (
              <Text
                key={`motif-${normalized}-${row}-${col}`}
                style={{
                  position: "absolute",
                  left: `${3 + col * 10}%`,
                  top: `${2 + row * 12}%`,
                  color: ink,
                  fontSize:
                    normalized === "coffee"
                      ? 15
                      : normalized === "bubbles"
                        ? 19
                        : normalized === "clouds"
                          ? 19
                          : normalized === "snowflakes"
                            ? 16
                            : normalized === "sparkles"
                              ? 17
                              : 14,
                  lineHeight: 22,
                  opacity: normalized === "ornamental" ? 0.58 : 0.72,
                }}
              >
                {useGlyph
                  ? glyph
                  : normalized === "bubbles"
                    ? "◌"
                    : normalized === "petals"
                      ? "✿"
                      : normalized === "sparkles"
                        ? "✦"
                        : normalized === "snowflakes"
                          ? "✳"
                          : "❖"}
              </Text>
            );
          }),
        )}

      {/* SUNRISE HORIZON */}
      {normalized === "sunrise" && (
        <>
          <View
            style={{
              position: "absolute",
              left: "35%",
              top: "25%",
              width: 58,
              height: 58,
              borderRadius: 29,
              backgroundColor: ink,
              opacity: 0.16,
            }}
          />
          {[0, 1, 2, 3].map((index) => (
            <View
              key={`sunrise-line-${index}`}
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                top: `${57 + index * 9}%`,
                height: 1.5,
                backgroundColor: ink,
                opacity: 0.65 - index * 0.1,
              }}
            />
          ))}
        </>
      )}

      {/* RAINBOW ARCS */}
      {normalized === "rainbow" &&
        [0, 1, 2, 3].map((index) => (
          <View
            key={`rainbow-${index}`}
            style={{
              position: "absolute",
              width: 105 + index * 22,
              height: 105 + index * 22,
              borderRadius: 100,
              borderWidth: 3,
              borderColor: ink,
              opacity: 0.16,
              left: "22%",
              top: "28%",
            }}
          />
        ))}
    </View>
  );
}

export default function TodolistScreen() {
  const [hyperlinkModalVisible, setHyperlinkModalVisible] = useState(false);
  const [hyperlinkList, setHyperlinkList] = useState<string[]>([]);
  const [selectedHyperlink, setSelectedHyperlink] = useState<string | null>(
    null,
  );
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const isDesktop = Platform.OS === "web" && screenWidth >= 1100;
  const isWideDesktop = Platform.OS === "web" && screenWidth >= 1500;

  // Cross-platform alert state. Desktop/Web uses the custom modal below;
  // Android and iOS continue using the native React Native alert.
  type DesktopAlertButton = NonNullable<
    Parameters<typeof Alert.alert>[2]
  >[number];
  type DesktopAlertOptions = Parameters<typeof Alert.alert>[3];

  const [appAlert, setAppAlert] = useState<{
    visible: boolean;
    title: string;
    message: string;
    buttons: DesktopAlertButton[];
    options?: DesktopAlertOptions;
  }>({
    visible: false,
    title: "",
    message: "",
    buttons: [],
  });

  const showAlert = (
    title: string,
    message: string = "",
    buttons?: DesktopAlertButton[],
    options?: DesktopAlertOptions,
  ) => {
    if (Platform.OS !== "web") {
      Alert.alert(title, message, buttons, options);
      return;
    }

    setAppAlert({
      visible: true,
      title,
      message,
      buttons:
        buttons && buttons.length > 0
          ? buttons
          : [{ text: "OK", style: "default" }],
      options,
    });
  };

  const closeAppAlert = () => {
    setAppAlert((previous) => ({
      ...previous,
      visible: false,
    }));
    appAlert.options?.onDismiss?.();
  };
  const isNarrowPhone = screenWidth < 360;
  const isCompactPhone = screenWidth < 390;
  const isShortScreen = screenHeight < 700;
  const pageHorizontalPadding = isNarrowPhone ? 12 : isCompactPhone ? 16 : 20;
  const { isDark, colors: appTheme } = useAppTheme();
  const [reorderChecklistVisible, setReorderChecklistVisible] = useState(false);
  const [selectedTextColor, setSelectedTextColor] = useState("#172F2B");
  const [attachedFiles, setAttachedFiles] = useState<
    DocumentPicker.DocumentPickerAsset[]
  >([]);

  const [drawingLanguage, setDrawingLanguage] = useState<"ta" | "en">("ta");

  const [isNumberedListMode, setIsNumberedListMode] = useState(false);
  const [isChecklistMode, setIsChecklistMode] = useState(false);
  const [isNormalTextMode, setIsNormalTextMode] = useState(false);
  const [checklistItems, setChecklistItems] = useState<
    { id: string; text: string; checked: boolean }[]
  >([]);
  const [listNumber, setListNumber] = useState(1);

  const [reorderChecklistItems, setReorderChecklistItems] = useState<
    ReorderChecklistItem[]
  >([]);

  const openChecklistReorder = () => {
    const items = content
      .split("\n")
      .filter((line) => line.trim().length > 0)
      .filter((line) => /^[\s]*[☐☑✓]/.test(line))
      .map((line, index) => {
        const trimmedLine = line.trim();
        const checked = /^[☑✓]/.test(trimmedLine);

        return {
          id: `reorder-${Date.now()}-${index}`,
          text: trimmedLine.replace(/^[☐☑✓]\s*/, ""),
          checked,
        };
      });

    setReorderChecklistItems(items);
    setReorderChecklistVisible(true);
  };

  const saveChecklistReorder = (items: ReorderChecklistItem[]) => {
    setReorderChecklistItems(items);

    const reorderedText = items
      .map((item) => `${item.checked ? "☑" : "☐"} ${item.text}`)
      .join("\n");

    setContent(reorderedText);
    setModifiedAt(new Date().toISOString());
  };
  // Apply the mint palette to existing screen styles without removing features.
  // Explicit custom note/paper colors remain intact.
  const themeStyle = (style: any): any => {
    if (!style || typeof style !== "object" || Array.isArray(style))
      return style;
    const result: Record<string, any> = {};
    const mintBackgrounds = new Set([
      "#ffffff",
      "#fff",
      "#fafbfe",
      "#fafcff",
      "#f8fafc",
      "#f9fbfa",
      "#f3f7f5",
      "#f5f8f7",
      "#f7faf9",
      "#f8fbfa",
      "#f2faf9",
      "#fbfefd",
      "#f6faf8",
      "#f1f5f3",
      "#edf4f1",
      "#e8f0ed",
      "#e0f4ee",
      "#eaf7f2",
      "#e0f5ec",
      "#f0f7f4",
      "#f4f8f6",
    ]);
    const mintTextColors = new Set([
      "#172f2b",
      "#17233f",
      "#193d37",
      "#243247",
      "#24443e",
      "#254740",
      "#183a3b",
      "#123d3b",
      "#173b38",
      "#183a35",
    ]);
    const mutedTextColors = new Set([
      "#71827d",
      "#8491a3",
      "#87958f",
      "#8aa19a",
      "#91a09b",
      "#737f8e",
      "#727c96",
      "#64748b",
      "#6b7280",
    ]);
    const mintAccentColors = new Set([
      "#239b83",
      "#16866d",
      "#16866a",
      "#138a78",
      "#20a58b",
      "#159f89",
      "#087b72",
      "#39bda0",
      "#168a70",
      "#18a98b",
    ]);
    Object.entries(style).forEach(([key, value]) => {
      if (typeof value !== "string" || !/^#[0-9a-f]{3,8}$/i.test(value)) {
        result[key] = value;
        return;
      }
      const hex = value.toLowerCase();
      if (key === "backgroundColor") {
        if (mintBackgrounds.has(hex)) result[key] = mintTheme.surface;
        else if (
          ["#f3f7f5", "#f5f8f7", "#f7faf9", "#f8fbfa", "#f2faf9"].includes(hex)
        )
          result[key] = mintTheme.background;
        else if (
          [
            "#dceae5",
            "#e5efec",
            "#e5eeec",
            "#edf4f1",
            "#eef3ff",
            "#e0f4ee",
            "#eaf7f2",
          ].includes(hex)
        )
          result[key] = mintTheme.background;
        else result[key] = value;
      } else if (key === "color") {
        if (mintTextColors.has(hex)) result[key] = mintTheme.text;
        else if (mutedTextColors.has(hex)) result[key] = mintTheme.subtitle;
        else if (mintAccentColors.has(hex)) result[key] = mintTheme.primary;
        else result[key] = value;
      } else if (key === "borderColor") {
        if (
          [
            "#dceae5",
            "#dce9e2",
            "#e5eaf3",
            "#e5eeec",
            "#e9eef4",
            "#d7eee6",
            "#e8eeec",
            "#e5efec",
          ].includes(hex)
        )
          result[key] = mintTheme.border;
        else result[key] = value;
      } else {
        result[key] = value;
      }
    });
    return result;
  };
  const [strikethrough, setStrikethrough] = useState(false);

  const [linkModalVisible, setLinkModalVisible] = useState(false);
  const [attachmentModalVisible, setAttachmentModalVisible] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");

  const [colorPaletteVisible, setColorPaletteVisible] = useState(false);
  const [fontPickerVisible, setFontPickerVisible] = useState(false);

  const [noteThemePickerVisible, setNoteThemePickerVisible] = useState(false);

  const [isBulletMode, setIsBulletMode] = useState(false);

  const textColors = [
    "#172F2B", // Default
    "#DC2626", // Red
    "#239B83", // Blue
    "#16A34A", // Green
    "#9333EA", // Purple
    "#EA580C", // Orange
    "#DB2777", // Pink
    "#0891B2", // Cyan
    "#CA8A04", // Yellow
    "#000000", // Black
    "#6B7280", // Gray
    "#FFFFFF", // White
  ];

  const fontFamilies = [
    "System",
    "serif",
    "sans-serif",
    "monospace",
    "sans-serif-light",
    "sans-serif-medium",
    "sans-serif-condensed",
    "casual",
    "cursive",
  ] as const;

  const params = useLocalSearchParams<{
    tdlId?: string;
    id?: string;
    todo?: string;
    isEditMode?: string;
    editTodo?: string;
    quickNote?: string;
    templateTitle?: string | string[];
    templateContent?: string | string[];
    templateBackground?: string | string[];
    templateBackgroundType?: string | string[];
    selectedDate?: string | string[];
    folderId?: string | string[];
  }>();

  const folderId = Array.isArray(params.folderId)
    ? params.folderId[0]
    : params.folderId;
  // A template selected from Note Templates is still a Todo on this screen.
  // Keep its draft separate from the generic "new Todo" draft.
  const incomingTemplateTitle = Array.isArray(params.templateTitle)
    ? params.templateTitle[0]
    : params.templateTitle;
  const incomingTemplateContent = Array.isArray(params.templateContent)
    ? params.templateContent[0]
    : params.templateContent;
  const hasIncomingTemplate =
    typeof incomingTemplateTitle === "string" &&
    typeof incomingTemplateContent === "string";

  const rawEditTodo = params.editTodo ?? params.todo;

  const passedTodo = useMemo<TodoItem | null>(() => {
    if (!rawEditTodo || Array.isArray(rawEditTodo)) return null;
    try {
      const parsed: unknown = JSON.parse(rawEditTodo);
      if (!parsed || typeof parsed !== "object") return null;
      return parsed as TodoItem;
    } catch {
      return null;
    }
  }, [rawEditTodo]);

  const todoId =
    params.tdlId ??
    params.id ??
    (passedTodo?.tdlId != null ? String(passedTodo.tdlId) : undefined) ??
    (passedTodo?.id != null ? String(passedTodo.id) : undefined);

  const isEditing = params.isEditMode === "true" || Boolean(todoId);

  const [token, setToken] = useState("");
  const [userId, setUserId] = useState("");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const appliedTemplateKey = useRef<string | null>(null);

  // Apply the selected template to this Todo editor.
  // Do not mark it as a Quick Note: this screen only creates/updates Todos.
  useEffect(() => {
    const templateBackground = Array.isArray(params.templateBackground)
      ? params.templateBackground[0]
      : params.templateBackground;
    const templateBackgroundType = Array.isArray(params.templateBackgroundType)
      ? params.templateBackgroundType[0]
      : params.templateBackgroundType;

    if (!hasIncomingTemplate) return;

    const key = `${incomingTemplateTitle}::${incomingTemplateContent}::${String(templateBackground ?? "")}`;
    if (appliedTemplateKey.current === key) return;
    appliedTemplateKey.current = key;

    setTitle(incomingTemplateTitle);
    setContent(incomingTemplateContent);
    if (
      templateBackgroundType === "image" &&
      typeof templateBackground === "string" &&
      templateBackground.length > 0
    ) {
      setNoteBackgroundImageUri(templateBackground);
    } else if (
      typeof templateBackground === "string" &&
      /^#[0-9A-Fa-f]{6}$/.test(templateBackground)
    ) {
      setQuickNoteColor(templateBackground);
      setNoteBackgroundImageUri(null);
    }
    setModifiedAt(new Date().toISOString());
  }, [
    hasIncomingTemplate,
    incomingTemplateTitle,
    incomingTemplateContent,
    params.templateBackground,
    params.templateBackgroundType,
  ]);
  const contentInputRef = useRef<any>(null);
  const checklistInputRefs = useRef<Record<number, TextInput | null>>({});
  // This screen is exclusively for Todos. Quick Notes use their own screen.
  const isQuickNote = false;
  const setIsQuickNote = (_value: boolean) => {};
  const [quickNoteColor, setQuickNoteColor] = useState("#FFF4CC");
  const [defaultNotebookStyle, setDefaultNotebookStyle] = useState<
    "classic" | "minimal" | "journal"
  >("classic");
  const [defaultNoteTextSize, setDefaultNoteTextSize] = useState<
    "small" | "medium" | "large"
  >("medium");
  const [defaultNoteCornerStyle, setDefaultNoteCornerStyle] = useState<
    "square" | "rounded" | "soft"
  >("rounded");
  const [personalAccentColor, setPersonalAccentColor] = useState("#239B83");
  // appTheme.primary is the shared accent color from AppThemeProvider.
  // This keeps this editor in sync when the user changes the accent in Settings.
  useEffect(() => {
    if (
      typeof appTheme?.primary === "string" &&
      /^#[0-9A-Fa-f]{6}$/.test(appTheme.primary)
    ) {
      setPersonalAccentColor(appTheme.primary);
    }
  }, [appTheme?.primary]);
  const [noteBackgroundImageUri, setNoteBackgroundImageUri] = useState<
    string | null
  >(null);
  const [quickNotePinned, setQuickNotePinned] = useState(false);
  const quickNoteColors = [
    "#FFF4CC",
    "#DDF7E8",
    "#DDEBFF",
    "#FCE1EE",
    "#EDE2FF",
    "#FFFFFF",
  ];
  const [notePattern, setNotePattern] = useState<string>("plain");
  const [pendingNotePattern, setPendingNotePattern] = useState<string>("plain");

  useEffect(() => {
    if (!noteThemePickerVisible) {
      setPendingNotePattern(notePattern || "plain");
    }
  }, [notePattern, noteThemePickerVisible]);

  const noteTemplates = [
    {
      id: "meeting",
      title: "Meeting Notes",
      icon: "people-outline" as const,
      color: "#DDF7E8",
      body: "Meeting: \nDate: \nAttendees: \n\nAgenda\n• \n\nAction items\n☐ \n☐ ",
    },
    {
      id: "daily",
      title: "Daily Plan",
      icon: "sunny-outline" as const,
      color: "#FFF4CC",
      body: "Top priorities\n☐ \n☐ \n☐ \n\nNotes\n\nEnd-of-day reflection\n",
    },
    {
      id: "idea",
      title: "Idea Capture",
      icon: "bulb-outline" as const,
      color: "#EDE2FF",
      body: "Idea: \n\nProblem it solves\n\nHow it could work\n\nNext step\n",
    },
    {
      id: "checklist",
      title: "Checklist",
      icon: "checkbox-outline" as const,
      color: "#DDEBFF",
      body: "☐ First task\n☐ Second task\n☐ Third task\n☐ ",
    },
    {
      id: "journal",
      title: "Journal",
      icon: "book-outline" as const,
      color: "#FCE1EE",
      body: "Today I feel…\n\nWhat went well?\n\nWhat I learned\n\nTomorrow I want to…",
    },
  ];
  const applyNoteTemplate = (template: (typeof noteTemplates)[number]) => {
    showAlert(
      "Use template?",
      `Replace the current title and content with “${template.title}”?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Apply template",
          onPress: () => {
            setTitle(template.title);
            setContent(template.body);
            setQuickNoteColor(template.color);
            setModifiedAt(new Date().toISOString());
          },
        },
      ],
    );
  };

  const chooseNoteBackgroundFromGallery = async () => {
    try {
      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        showAlert(
          "Photo permission required",
          "Allow photo access to choose a note background.",
        );
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [3, 4],
        quality: 0.9,
      });
      if (result.canceled || !result.assets?.[0]?.uri) return;
      setNoteBackgroundImageUri(result.assets[0].uri);
      setNotePattern("plain");
      setNoteThemePickerVisible(false);
      setModifiedAt(new Date().toISOString());
    } catch (error) {
      console.error("Failed to choose note background", error);
      showAlert("Unable to open gallery", "Please try again.");
    }
  };

  const openNoteThemePicker = () => {
    setNoteThemePickerVisible(true);
  };

  const openNoteTemplatePicker = () => {
    router.push("/notestemplate");
  };

  const [todoDate, setTodoDate] = useState(toDateInput(new Date()));
  const [dateText, setDateText] = useState(toDateInput(new Date()));
  const [dueDateTime, setDueDateTime] = useState<Date>(new Date());
  const [alarmDate, setAlarmDate] = useState<Date | null>(null);
  const [recurring, setRecurring] = useState<
    "none" | "daily" | "weekly" | "monthly"
  >("none");

  const [imageUris, setImageUris] = useState<string[]>([]);
  const [videoUris, setVideoUris] = useState<string[]>([]);
  // Keep the real browser File objects: blob URLs are only for previews and
  // cannot be uploaded as React Native { uri, name, type } file descriptors.
  const [webImageFiles, setWebImageFiles] = useState<WebSelectedFile[]>([]);
  const [webVideoFiles, setWebVideoFiles] = useState<WebSelectedFile[]>([]);
  const [existingAttachments, setExistingAttachments] = useState<
    ExistingAttachment[]
  >([]);
  const [drawingUri, setDrawingUri] = useState<string | null>(null);
  const [drawingModalVisible, setDrawingModalVisible] = useState(false);
  const [drawingText, setDrawingText] = useState("");
  const [drawingRecognitionBusy, setDrawingRecognitionBusy] = useState(false);
  const [drawingRecognitionStatus, setDrawingRecognitionStatus] = useState("");

  const [drawingStrokes, setDrawingStrokes] = useState<DrawingStroke[]>([]);
  const [currentDrawingStroke, setCurrentDrawingStroke] =
    useState<DrawingStroke | null>(null);
  const [drawingColor, setDrawingColor] = useState("#172F2B");
  const [drawingBrushSize, setDrawingBrushSize] = useState(4);
  const [drawingTool, setDrawingTool] = useState<"pen" | "pencil">("pen");
  const [drawingEraser, setDrawingEraser] = useState(false);
  const [drawingCanvasSize, setDrawingCanvasSize] = useState({
    width: 360,
    height: 440,
  });
  const drawingCanvasCaptureRef = useRef<View>(null);
  const drawingUndoStack = useRef<DrawingStroke[][]>([]);
  const drawingRedoStack = useRef<DrawingStroke[][]>([]);
  const drawingStartRef = useRef<DrawingStroke | null>(null);
  const drawingStrokeStartTimeRef = useRef<number>(0);
  const drawingRecognitionTimerRef = useRef<ReturnType<
    typeof setTimeout
  > | null>(null);
  const drawingRecognitionRequestRef = useRef(0);
  const richEditorRef = useRef<RichEditor>(null);
  const [voiceUri, setVoiceUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [recordingBusy, setRecordingBusy] = useState(false);

  const [bold, setBold] = useState(false);
  const [italic, setItalic] = useState(false);
  const [underline, setUnderline] = useState(false);

  const [fontSize, setFontSize] = useState(18);
  const [lineSpacing, setLineSpacing] = useState(28);
  const [letterSpacing, setLetterSpacing] = useState(0);
  const [spacingModalVisible, setSpacingModalVisible] = useState(false);
  const [textColor, setTextColor] = useState("#172F2B");
  const [fontFamily, setFontFamily] = useState<string | undefined>(undefined);
  const [alignment, setAlignment] = useState<"left" | "center" | "right">(
    "left",
  );
  const [selection, setSelection] = useState({ start: 0, end: 0 });
  const [createdAt, setCreatedAt] = useState<string>(new Date().toISOString());
  const [modifiedAt, setModifiedAt] = useState<string>(
    new Date().toISOString(),
  );
  const [draftReady, setDraftReady] = useState(false);
  const [draftStatus, setDraftStatus] = useState<
    "loading" | "saving" | "saved" | "idle" | "error"
  >("loading");

  const undoStack = useRef<string[]>([]);
  const redoStack = useRef<string[]>([]);
  const draftLoaded = useRef(false);

  // Prevent auto-save from recreating a draft after a successful database save.
  const skipDraftAutoSaveRef = useRef(false);
  const activeDraftKeyRef = useRef<string | null>(null);
  const draftSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const draftWriteInFlightRef = useRef<Promise<void> | null>(null);

  const [playerError, setPlayerError] = useState("");
  const [isPaused, setIsPaused] = useState(false);
  const [recordingSessionActive, setRecordingSessionActive] = useState(false);
  const mounted = useRef(true);
  const savingRef = useRef(false);
  const recordingRef = useRef(false);

  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder, 500);
  const player = useAudioPlayer(voiceUri);
  const playerStatus = useAudioPlayerStatus(player);

  const status = useMemo(
    () => getStatusForDate(dateText, dueDateTime),
    [dateText, dueDateTime],
  );
  const formattedDate = useMemo(() => formatLongDate(dateText), [dateText]);

  const templateDraftKey = hasIncomingTemplate
    ? `template-${encodeURIComponent(incomingTemplateTitle)}`
    : "new";
  const draftKey = `notes-draft:${todoId || templateDraftKey}`;

  const deleteLocalDraft = useCallback(async () => {
    if (loading) return;
    try {
      // Disable auto-save and cancel any scheduled write before deleting.
      skipDraftAutoSaveRef.current = true;
      draftLoaded.current = false;
      setDraftReady(false);
      if (draftSaveTimerRef.current) {
        clearTimeout(draftSaveTimerRef.current);
        draftSaveTimerRef.current = null;
      }
      if (draftWriteInFlightRef.current) {
        await draftWriteInFlightRef.current.catch(() => undefined);
      }
      await AsyncStorage.removeItem(draftKey);
      showAlert(
        "Draft deleted",
        "The local draft was deleted. A Todo already saved on the server is not deleted.",
        [
          {
            text: "OK",
            onPress: () => router.replace("/cretenote"),
          },
        ],
      );
    } catch (error) {
      console.error("Unable to delete local note draft:", error);
      showAlert(
        "Delete failed",
        "Could not delete the local draft. Please try again.",
      );
    }
  }, [draftKey, loading]);


const insertChecklist = useCallback(() => {
  const start = Math.max(0, Math.min(selection.start, content.length));

  const before = content.slice(0, start);
  const after = content.slice(start);

  const prefix =
    start === 0 || content[start - 1] === "\n" ? "" : "\n";

  const insertText = `${prefix}☐ `;
  const updated = before + insertText + after;

  undoStack.current.push(content);
  redoStack.current = [];

  setContent(updated);
  setModifiedAt(new Date().toISOString());
  setIsNormalTextMode(false);
  setIsChecklistMode(true);

  const cursor = start + insertText.length;

  setSelection({ start: cursor, end: cursor });
}, [content, selection]);


  const toggleChecklistAtCursor = useCallback(() => {
    const start = Math.max(0, Math.min(selection.start, content.length));

    const lineStart = content.lastIndexOf("\n", Math.max(0, start - 1)) + 1;

    const newlineIndex = content.indexOf("\n", start);

    const lineEnd = newlineIndex === -1 ? content.length : newlineIndex;

    const line = content.slice(lineStart, lineEnd);

    const match = line.match(/^(\s*)(☐|☑)(\s*)/);

    if (!match) {
      return;
    }

    const next = match[2] === "☐" ? "☑" : "☐";

    const updatedLine =
      match[1] + next + match[3] + line.slice(match[0].length);

    const updated =
      content.slice(0, lineStart) + updatedLine + content.slice(lineEnd);

    undoStack.current.push(content);
    redoStack.current = [];

    setContent(updated);
    setModifiedAt(new Date().toISOString());
  }, [content, selection]);


  

const handleChecklistKeyPress = useCallback(
  (
    index: number,
    event: NativeSyntheticEvent<TextInputKeyPressEventData>
  ) => {
    const key = event.nativeEvent.key;

    // Handle only Backspace.
    if (key !== "Backspace") return;

    const lines = content.split("\n");

    if (index < 0 || index >= lines.length) return;

    const currentLine = lines[index] ?? "";

    // Match checklist checkbox.
    const match = currentLine.match(/^(\s*)(☐|☑)(?:\uFE0F)?(\s?)(.*)$/);

    // Not a checklist item.
    if (!match) return;

    const checkboxText = match[4];

    // Delete only when the checklist item is empty.
    // Do not delete checkbox when it contains text.
    if (checkboxText.trim().length > 0) return;

    // Save undo history.
    undoStack.current.push(content);
    redoStack.current = [];

    // Remove the empty checklist line.
    lines.splice(index, 1);

    const updated = lines.join("\n");

    // Update content.
    setContent(updated);
    setModifiedAt(new Date().toISOString());

    // Calculate previous available row.
    const focusIndex =
      lines.length > 0
        ? Math.max(0, Math.min(index - 1, lines.length - 1))
        : -1;

    if (focusIndex >= 0) {
      const focusLine = lines[focusIndex] ?? "";

      const focusMatch = focusLine.match(
        /^(\s*)(☐|☑)(?:\uFE0F)?(\s?)(.*)$/
      );

      // Calculate checkbox prefix length.
      const prefixLength = focusMatch
        ? focusMatch[1].length + 1 + focusMatch[3].length
        : 0;

      // Calculate absolute cursor position.
      const lineStart = lines
        .slice(0, focusIndex)
        .reduce(
          (total, line) => total + line.length + 1,
          0
        );

      const cursor =
        lineStart +
        prefixLength +
        (focusMatch
          ? focusMatch[4].length
          : focusLine.length);

      setSelection({
        start: cursor,
        end: cursor,
      });

      // Focus previous checklist input.
      requestAnimationFrame(() => {
        checklistInputRefs.current[focusIndex]?.focus();
      });
    } else {
      setSelection({ start: 0, end: 0 });
    }
  },
  [content]
);



  const handleContentChange = useCallback(
    (value: string) => {
      let nextValue = value;
      let nextBulletMode = isBulletMode;
      let nextNumberedMode = isNumberedListMode;
      let nextChecklistMode = isChecklistMode;
      let nextListNumber = listNumber;

      let cursorPosition = value.length;

      if (
        (isBulletMode || isNumberedListMode || isChecklistMode) &&
        value.length > content.length
      ) {
        let newlinePosition = -1;

        for (let i = 0; i < value.length; i++) {
          if (value[i] === "\n" && content[i] !== "\n") {
            newlinePosition = i;
            break;
          }
        }

        if (newlinePosition !== -1) {
          const lineStart = content.lastIndexOf("\n", newlinePosition - 1) + 1;

          const previousLine = content.slice(lineStart, newlinePosition).trim();

          const isEmptyBullet = previousLine === "•";
          const isEmptyNumberedItem = /^\d+\.$/.test(previousLine);
          const isEmptyChecklistItem = /^(☐|☑)$/.test(previousLine);

          if (isBulletMode && isEmptyBullet) {
            nextValue =
              content.slice(0, lineStart) + value.slice(newlinePosition + 1);

            cursorPosition = lineStart;

            nextBulletMode = false;
          } else if (isNumberedListMode && isEmptyNumberedItem) {
            nextValue =
              content.slice(0, lineStart) + value.slice(newlinePosition + 1);

            cursorPosition = lineStart;

            nextNumberedMode = false;
            nextListNumber = 1;
          } else if (isChecklistMode && isEmptyChecklistItem) {
            nextValue =
              content.slice(0, lineStart) + value.slice(newlinePosition + 1);

            cursorPosition = lineStart;

            nextChecklistMode = false;
          } else {
            const insertAt = newlinePosition + 1;

            if (isBulletMode) {
              const prefix = "• ";

              nextValue =
                value.slice(0, insertAt) + prefix + value.slice(insertAt);

              cursorPosition = insertAt + prefix.length;
            } else if (isNumberedListMode) {
              const prefix = `${nextListNumber}. `;

              nextValue =
                value.slice(0, insertAt) + prefix + value.slice(insertAt);

              cursorPosition = insertAt + prefix.length;
              nextListNumber += 1;
            } else if (isChecklistMode) {
              const prefix = "☐ ";

              nextValue =
                value.slice(0, insertAt) + prefix + value.slice(insertAt);

              cursorPosition = insertAt + prefix.length;
            }
          }
        }
      }

      undoStack.current.push(content);

      if (undoStack.current.length > 100) {
        undoStack.current.shift();
      }

      redoStack.current = [];

      setContent(nextValue);
      setModifiedAt(new Date().toISOString());

      setIsBulletMode(nextBulletMode);
      setIsNumberedListMode(nextNumberedMode);
      setIsChecklistMode(nextChecklistMode);
      setListNumber(nextListNumber);

      // Update cursor after content modification
      requestAnimationFrame(() => {
        setSelection({
          start: cursorPosition,
          end: cursorPosition,
        });
      });
    },
    [content, isBulletMode, isNumberedListMode, isChecklistMode, listNumber],
  );


  const toggleChecklistItem = useCallback(
  (lineIndex: number) => {
    const lines = content.split("\n");

    if (lineIndex < 0 || lineIndex >= lines.length) return;

    const line = lines[lineIndex] ?? "";

    const match = line.match(
      /^(\s*)(☐|☑)(?:\uFE0F)?(\s?)(.*)$/
    );

    if (!match) return;

    const nextCheckbox =
      match[2] === "☐" ? "☑" : "☐";

    lines[lineIndex] =
      `${match[1]}${nextCheckbox}${match[3]}${match[4]}`;

    const updated = lines.join("\n");

    undoStack.current.push(content);

    if (undoStack.current.length > 100) {
      undoStack.current.shift();
    }

    redoStack.current = [];

    setContent(updated);
    setModifiedAt(new Date().toISOString());
  },
  [content]
);

  const toggleChecklistAtLine = useCallback(
    (lineIndex: number) => {
      const lines = content.split("\n");

      if (lineIndex < 0 || lineIndex >= lines.length) return;

      const line = lines[lineIndex];

      const match = line.match(/^(\s*)(☐|☑)(\s*)/);

      if (!match) return;

      const nextCheckbox = match[2] === "☐" ? "☑" : "☐";

      lines[lineIndex] =
        match[1] + nextCheckbox + match[3] + line.slice(match[0].length);

      const updated = lines.join("\n");

      undoStack.current.push(content);
      redoStack.current = [];

      setContent(updated);
      setModifiedAt(new Date().toISOString());
    },
    [content],
  );

  const updateChecklistLine = useCallback(
    (lineIndex: number, nextText: string) => {
      const lines = content.split("\n");
      if (lineIndex < 0 || lineIndex >= lines.length) return;

      const currentLine = lines[lineIndex] ?? "";
      const checkboxPrefix = currentLine.match(/^(\s*[☐☑]\s?)/)?.[1] ?? "";
      lines[lineIndex] = checkboxPrefix + nextText;

      const updated = lines.join("\n");
      if (updated.length > 2000) return;

      undoStack.current.push(content);
      if (undoStack.current.length > 100) undoStack.current.shift();
      redoStack.current = [];

      setContent(updated);
      setModifiedAt(new Date().toISOString());
    },
    [content],
  );



  const addChecklistItemAfter = useCallback(
    (lineIndex: number) => {
      const lines = content.split("\n");
      if (lineIndex < 0 || lineIndex >= lines.length) return;

      const currentLine = lines[lineIndex] ?? "";
      const match = currentLine.match(/^(\s*)(☐|☑)(?:\uFE0F)?(\s?)(.*)$/);

      // Enter on an empty checkbox ends the checklist, matching the old editor behavior.
      if (match && !match[4].trim()) {
        lines.splice(lineIndex, 1);
        const updated = lines.join("\n");

        undoStack.current.push(content);
        if (undoStack.current.length > 100) undoStack.current.shift();
        redoStack.current = [];

        setContent(updated);
        setModifiedAt(new Date().toISOString());

        const stillHasChecklist = lines.some((entry) =>
          /^\s*[☐☑]\s?/.test(entry),
        );
        setIsChecklistMode(stillHasChecklist);

        requestAnimationFrame(() => {
          if (stillHasChecklist) {
            checklistInputRefs.current[Math.max(0, lineIndex - 1)]?.focus();
          } else {
            contentInputRef.current?.focus();
          }
        });
        return;
      }

      lines.splice(lineIndex + 1, 0, "☐ ");
      const updated = lines.join("\n");

      undoStack.current.push(content);
      if (undoStack.current.length > 100) undoStack.current.shift();
      redoStack.current = [];

      setContent(updated);
      setIsNormalTextMode(false);
      setIsChecklistMode(true);
      setModifiedAt(new Date().toISOString());

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          checklistInputRefs.current[lineIndex + 1]?.focus();
        });
      });
    },
    [content],
  );

 const checklistLines = content.split("\n");

const hasChecklistItems = checklistLines.some((line) =>
  /^\s*[☐☑](?:\uFE0F)?\s?/.test(line)
);

const showChecklistEditor =
  isChecklistMode || hasChecklistItems;

  const renderNoteWithLinks = (text: string) => {
    const urlRegex = /https?:\/\/[^\s]+|www\.[^\s]+/gi;
    const parts = text.split(urlRegex);
    const urls = text.match(urlRegex) ?? [];

    return (
      <Text style={{ color: textColor, fontSize, lineHeight: lineSpacing }}>
        {parts.map((part, index) => (
          <React.Fragment key={`text-${index}`}>
            {part}
            {urls[index] ? (
              <Text
                key={`link-${index}`}
                style={{
                  color: "#1685E5",
                  textDecorationLine: "underline",
                }}
                onPress={() => {
                  const url = urls[index].startsWith("http")
                    ? urls[index]
                    : `https://${urls[index]}`;

                  Linking.openURL(url).catch(() => {
                    showAlert("Error", "Unable to open this link.");
                  });
                }}
              >
                {urls[index]}
              </Text>
            ) : null}
          </React.Fragment>
        ))}
      </Text>
    );
  };

  const replaceSelection = useCallback(
    (insert: string, wrap = false) => {
      const start = Math.max(0, Math.min(selection.start, content.length));

      const end = Math.max(start, Math.min(selection.end, content.length));

      const selected = content.slice(start, end);

      const value = wrap
        ? `${content.slice(0, start)}${insert}${selected}${insert}${content.slice(end)}`
        : `${content.slice(0, start)}${insert}${content.slice(end)}`;

      undoStack.current.push(content);
      redoStack.current = [];

      const cursor = wrap
        ? start + insert.length + selected.length + insert.length
        : start + insert.length;

      setContent(value);
      setModifiedAt(new Date().toISOString());

      requestAnimationFrame(() => {
        setSelection({
          start: cursor,
          end: cursor,
        });

        contentInputRef.current?.focus();
      });
    },
    [content, selection],
  );

  const changeIndent = useCallback(
    (direction: "increase" | "decrease") => {
      const textLength = content.length;
      const start = Math.max(0, Math.min(selection.start, textLength));
      const end = Math.max(start, Math.min(selection.end, textLength));

      const firstLineStart =
        start === 0 ? 0 : content.lastIndexOf("\n", start - 1) + 1;

      let affectedEnd = end;
      if (end > start && content[end - 1] === "\n") {
        affectedEnd = end - 1;
      }

      const lineStarts: number[] = [firstLineStart];

      if (start !== end) {
        let searchFrom = firstLineStart;
        while (true) {
          const newlineIndex = content.indexOf("\n", searchFrom);
          if (newlineIndex === -1 || newlineIndex >= affectedEnd) break;

          const nextLineStart = newlineIndex + 1;
          if (nextLineStart > affectedEnd) break;

          lineStarts.push(nextLineStart);
          searchFrom = nextLineStart;
        }
      }

      const edits: Array<{
        position: number;
        removeCount: number;
        insertText: string;
      }> = [];

      for (const position of lineStarts) {
        if (direction === "increase") {
          edits.push({ position, removeCount: 0, insertText: "  " });
        } else {
          const line = content.slice(position);
          const leadingSpaces = line.match(/^ {1,2}/)?.[0].length ?? 0;
          if (leadingSpaces > 0) {
            edits.push({
              position,
              removeCount: leadingSpaces,
              insertText: "",
            });
          }
        }
      }

      if (edits.length === 0) return;

      let updatedContent = content;
      for (const edit of [...edits].sort((a, b) => b.position - a.position)) {
        updatedContent =
          updatedContent.slice(0, edit.position) +
          edit.insertText +
          updatedContent.slice(edit.position + edit.removeCount);
      }

      const adjustPosition = (originalPosition: number) => {
        let adjusted = originalPosition;

        for (const edit of edits) {
          if (edit.insertText.length > 0) {
            if (edit.position <= originalPosition) {
              adjusted += edit.insertText.length;
            }
          } else if (edit.removeCount > 0) {
            if (originalPosition >= edit.position + edit.removeCount) {
              adjusted -= edit.removeCount;
            } else if (originalPosition > edit.position) {
              adjusted = edit.position;
            }
          }
        }

        return Math.max(0, Math.min(adjusted, updatedContent.length));
      };

      undoStack.current.push(content);
      if (undoStack.current.length > 100) undoStack.current.shift();
      redoStack.current = [];

      setContent(updatedContent);
      setSelection({
        start: adjustPosition(start),
        end: adjustPosition(end),
      });
      setModifiedAt(new Date().toISOString());
    },
    [content, selection],
  );

  const undoEdit = useCallback(() => {
    const previous = undoStack.current.pop();
    if (previous === undefined) return;
    redoStack.current.push(content);
    setContent(previous);
    setModifiedAt(new Date().toISOString());
  }, [content]);

  const redoEdit = useCallback(() => {
    const next = redoStack.current.pop();
    if (next === undefined) return;
    undoStack.current.push(content);
    setContent(next);
    setModifiedAt(new Date().toISOString());
  }, [content]);

  const copyContent = useCallback(async () => {
    await Clipboard.setStringAsync(content);
    showAlert("Copied", "Note text copied to clipboard.");
  }, [content]);

  const cutSelection = useCallback(async () => {
    const start = Math.max(0, Math.min(selection.start, content.length));
    const end = Math.max(start, Math.min(selection.end, content.length));
    if (start === end) {
      await Clipboard.setStringAsync(content);
      setContent("");
      return;
    }
    await Clipboard.setStringAsync(content.slice(start, end));
    const value = content.slice(0, start) + content.slice(end);
    undoStack.current.push(content);
    redoStack.current = [];
    setContent(value);
    setSelection({ start, end: start });
  }, [content, selection]);

  const pasteContent = useCallback(async () => {
    const pasted = await Clipboard.getStringAsync();
    if (pasted) replaceSelection(pasted);
  }, [replaceSelection]);

  const insertHyperlink = useCallback(() => {
    setLinkUrl("");
    setLinkModalVisible(true);
  }, []);

  const handleInsertLink = useCallback(() => {
    const url = linkUrl.trim();

    if (!url) {
      showAlert("Insert link", "Please enter a URL.");
      return;
    }

    const normalizedUrl = /^https?:\/\//i.test(url) ? url : `https://${url}`;

    const start = Math.max(0, Math.min(selection.start, content.length));
    const end = Math.max(start, Math.min(selection.end, content.length));

    const updatedContent =
      content.slice(0, start) + normalizedUrl + content.slice(end);

    handleContentChange(updatedContent);

    const cursorPosition = start + normalizedUrl.length;
    setSelection({
      start: cursorPosition,
      end: cursorPosition,
    });

    setLinkUrl("");
    setLinkModalVisible(false);
  }, [linkUrl, selection, content, handleContentChange]);

  const renderLinkedText = (text: string) => {
    const parts = text.split(/(https?:\/\/[^\s]+|www\.[^\s]+)/gi);

    return (
      <Text
        style={{
          fontSize,
          color: textColor,
          fontFamily:
            !fontFamily || fontFamily === "System" ? undefined : fontFamily,
        }}
      >
        {parts.map((part, index) => {
          const isUrl = /^(https?:\/\/|www\.)/i.test(part);

          return (
            <Text
              key={index}
              style={
                isUrl
                  ? {
                      color: "#1685E5",
                      textDecorationLine: "underline",
                    }
                  : { color: textColor }
              }
            >
              {part}
            </Text>
          );
        })}
      </Text>
    );
  };

  const openFirstHyperlink = useCallback(() => {
    const matches = content.match(/https?:\/\/[^\s<>"')\]]+/gi) || [];

    const uniqueLinks = [
      ...new Set(matches.map((url) => url.replace(/[.,!?;:]+$/, ""))),
    ];

    if (uniqueLinks.length === 0) {
      showAlert(
        "No hyperlinks",
        "Add a URL such as https://example.com first.",
      );
      return;
    }

    if (uniqueLinks.length === 1) {
      Linking.openURL(uniqueLinks[0]).catch(() => {
        showAlert("Unable to open link", uniqueLinks[0]);
      });
      return;
    }

    setHyperlinkList(uniqueLinks);
    setSelectedHyperlink(null);
    setHyperlinkModalVisible(true);
  }, [content]);

  useEffect(() => {
    let active = true;

    // A different draft key means the user is creating/opening another note.
    // Re-enable auto-save for that new draft only.
    if (activeDraftKeyRef.current !== draftKey) {
      activeDraftKeyRef.current = draftKey;
      skipDraftAutoSaveRef.current = false;
    }

    const restoreDraft = async () => {
      try {
        const raw = await AsyncStorage.getItem(draftKey);

        if (!active) return;

        let shouldApplyDefaultTheme = !isEditing && !hasIncomingTemplate;

        let restoredDraft = false;

        if (raw && !hasIncomingTemplate) {
          const draft = JSON.parse(raw) as {
            title?: string;
            content?: string;
            modifiedAt?: string;
            createdAt?: string;
            isQuickNote?: boolean;
            quickNoteColor?: string;
            quickNotePinned?: boolean;
            notePattern?: string;
            notebookStyle?: "classic" | "minimal" | "journal";
            noteTextSize?: "small" | "medium" | "large";
            noteCornerStyle?: "square" | "rounded" | "soft";
            alignment?: "left" | "center" | "right";
            drawingUri?: string;
            drawingText?: string;
            imageUris?: string[];
            videoUris?: string[];
            attachedFiles?: Array<{
              uri: string;
              name: string;
              mimeType?: string;
              size?: number;
              lastModified?: number;
            }>;
            noteBackgroundImageUri?: string | null;
          };

          const draftHasContent = Boolean(
            (typeof draft.title === "string" && draft.title.trim()) ||
            (typeof draft.content === "string" && draft.content.trim()),
          );

          shouldApplyDefaultTheme = shouldApplyDefaultTheme && !draftHasContent;

          if (!isEditing || (!title && !content)) {
            if (typeof draft.title === "string") {
              setTitle(draft.title);
            }

            if (typeof draft.content === "string") {
              setContent(draft.content);
            }

            if (["left", "center", "right"].includes(draft.alignment || "")) {
              setAlignment(draft.alignment as "left" | "center" | "right");
            }

            if (typeof draft.createdAt === "string") {
              setCreatedAt(draft.createdAt);
            }

            if (typeof draft.modifiedAt === "string") {
              setModifiedAt(draft.modifiedAt);
            }

            if (typeof draft.quickNoteColor === "string") {
              setQuickNoteColor(draft.quickNoteColor);
            }

            if (typeof draft.quickNotePinned === "boolean") {
              setQuickNotePinned(draft.quickNotePinned);
            }

            if (
              typeof draft.notePattern === "string" &&
              draft.notePattern.trim().length > 0
            ) {
              setNotePattern(draft.notePattern.trim().toLowerCase());
            }

            if (
              ["classic", "minimal", "journal"].includes(
                draft.notebookStyle || "",
              )
            ) {
              setDefaultNotebookStyle(
                draft.notebookStyle as "classic" | "minimal" | "journal",
              );
            }

            if (
              ["small", "medium", "large"].includes(draft.noteTextSize || "")
            ) {
              const size = draft.noteTextSize as "small" | "medium" | "large";
              setDefaultNoteTextSize(size);
              setFontSize(size === "small" ? 14 : size === "large" ? 22 : 18);
              setLineSpacing(
                size === "small" ? 22 : size === "large" ? 34 : 28,
              );
            }

            if (
              ["square", "rounded", "soft"].includes(
                draft.noteCornerStyle || "",
              )
            ) {
              setDefaultNoteCornerStyle(
                draft.noteCornerStyle as "square" | "rounded" | "soft",
              );
            }

            if (typeof draft.drawingUri === "string") {
              setDrawingUri(draft.drawingUri);
            }

            if (typeof draft.drawingText === "string") {
              setDrawingText(draft.drawingText);
            }

            if (Array.isArray(draft.imageUris)) {
              setImageUris(
                draft.imageUris.filter(
                  (uri): uri is string => typeof uri === "string",
                ),
              );
            }

            if (Array.isArray(draft.videoUris)) {
              setVideoUris(
                draft.videoUris.filter(
                  (uri): uri is string => typeof uri === "string",
                ),
              );
            }

            if (Array.isArray(draft.attachedFiles)) {
              setAttachedFiles(
                draft.attachedFiles
                  .filter(
                    (file) =>
                      file &&
                      typeof file.uri === "string" &&
                      typeof file.name === "string",
                  )
                  .map((file) => ({
                    ...file,
                    mimeType: file.mimeType,
                    size: file.size,
                    lastModified: file.lastModified,
                  })) as DocumentPicker.DocumentPickerAsset[],
              );
            }

            if (typeof draft.noteBackgroundImageUri === "string") {
              setNoteBackgroundImageUri(draft.noteBackgroundImageUri);
            }

            restoredDraft = true;
          }
        }

        if (shouldApplyDefaultTheme) {
          try {
            const savedDefaultTheme =
              await AsyncStorage.getItem("defaultNoteTheme");

            if (!active) return;

            if (savedDefaultTheme) {
              const defaultTheme = JSON.parse(savedDefaultTheme) as {
                color?: string;
                pattern?: string;
                notebookStyle?: string;
                textSize?: string;
                cornerStyle?: string;
              };

              // Apply default paper color
              if (
                typeof defaultTheme.color === "string" &&
                /^#[0-9A-Fa-f]{6}$/.test(defaultTheme.color)
              ) {
                setQuickNoteColor(defaultTheme.color);
              }

              // Apply default paper pattern
              if (typeof defaultTheme.pattern === "string") {
                const pattern = defaultTheme.pattern.trim().toLowerCase();

                if (pattern) {
                  setNotePattern(pattern);
                  setPendingNotePattern(pattern);
                }
              }

              // Apply notebook style
              if (
                ["classic", "minimal", "journal"].includes(
                  defaultTheme.notebookStyle || "",
                )
              ) {
                setDefaultNotebookStyle(
                  defaultTheme.notebookStyle as
                    | "classic"
                    | "minimal"
                    | "journal",
                );
              }

              // Apply text size
              if (
                ["small", "medium", "large"].includes(
                  defaultTheme.textSize || "",
                )
              ) {
                const size = defaultTheme.textSize as
                  | "small"
                  | "medium"
                  | "large";

                setDefaultNoteTextSize(size);

                setFontSize(size === "small" ? 14 : size === "large" ? 22 : 18);
                setLineSpacing(
                  size === "small" ? 22 : size === "large" ? 34 : 28,
                );
              }

              // Apply corner style
              if (
                ["square", "rounded", "soft"].includes(
                  defaultTheme.cornerStyle || "",
                )
              ) {
                setDefaultNoteCornerStyle(
                  defaultTheme.cornerStyle as "square" | "rounded" | "soft",
                );
              }

              // New note should not inherit an old background image
              setNoteBackgroundImageUri(null);
            }

            const savedAccent = await AsyncStorage.getItem("app-accent-color");

            if (!active) return;

            if (savedAccent && /^#[0-9A-Fa-f]{6}$/.test(savedAccent)) {
              setPersonalAccentColor(savedAccent);
            }
          } catch (themeError) {
            console.warn("Unable to load default note theme:", themeError);
          }
        }

        if (!active) return;

        draftLoaded.current = true;
        setDraftReady(true);

        // Set status based on whether a draft was restored.
        setDraftStatus(restoredDraft ? "saved" : "idle");
      } catch (error) {
        console.warn("Unable to restore local note draft:", error);

        if (active) {
          draftLoaded.current = true;
          setDraftReady(true);
          setDraftStatus("error");
        }
      }
    };

    setDraftReady(false);
    draftLoaded.current = false;

    void restoreDraft();

    return () => {
      active = false;
    };
  }, [draftKey, hasIncomingTemplate, isEditing]);

  useEffect(() => {
    if (!draftReady || !draftLoaded.current) return;
    if (skipDraftAutoSaveRef.current) return;

    setDraftStatus("saving");

    const timer = setTimeout(async () => {
      draftSaveTimerRef.current = null;

      // A save/delete may have completed while this timeout was waiting.
      if (skipDraftAutoSaveRef.current) return;

      const draftValue = JSON.stringify({
        title,
        content,
        createdAt,
        modifiedAt,
        isQuickNote,
        quickNoteColor,
        quickNotePinned,
        notePattern,
        notebookStyle: defaultNotebookStyle,
        noteTextSize: defaultNoteTextSize,
        noteCornerStyle: defaultNoteCornerStyle,
        alignment,
        drawingUri,
        drawingText,
        imageUris,
        videoUris,
        attachedFiles: attachedFiles.map((file) => ({
          uri: file.uri,
          name: file.name,
          mimeType: file.mimeType,
          size: file.size,
          lastModified: file.lastModified,
        })),
        noteBackgroundImageUri,
        savedAt: new Date().toISOString(),
      });

      const writePromise = (async () => {
        try {
          // Check again immediately before writing.
          if (skipDraftAutoSaveRef.current) return;

          await AsyncStorage.setItem(draftKey, draftValue);

          if (!skipDraftAutoSaveRef.current) {
            setDraftStatus("saved");
          }
        } catch (error) {
          console.error("Unable to auto-save note draft:", error);
          if (!skipDraftAutoSaveRef.current) {
            setDraftStatus("error");
          }
        }
      })();

      draftWriteInFlightRef.current = writePromise;
      try {
        await writePromise;
      } finally {
        if (draftWriteInFlightRef.current === writePromise) {
          draftWriteInFlightRef.current = null;
        }
      }
    }, 500);

    draftSaveTimerRef.current = timer;

    return () => {
      clearTimeout(timer);
      if (draftSaveTimerRef.current === timer) {
        draftSaveTimerRef.current = null;
      }
    };
  }, [
    draftKey,
    draftReady,
    title,
    content,
    createdAt,
    modifiedAt,
    isQuickNote,
    quickNoteColor,
    quickNotePinned,
    notePattern,
    defaultNotebookStyle,
    defaultNoteTextSize,
    defaultNoteCornerStyle,
    alignment,
    drawingUri,
    drawingText,
    imageUris,
    videoUris,
    noteBackgroundImageUri,
    existingAttachments,
    attachedFiles,
  ]);

  const isRecording = Boolean(recorderState.isRecording);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      try {
        if (recordingRef.current) {
          void recorder.stop().catch(() => undefined);
        }
      } catch {}
      try {
        void player.pause();
      } catch {}
    };
  }, [player, recorder]);

  useEffect(() => {
    let active = true;
    const loadAuth = async () => {
      try {
        const storedUserId = await AsyncStorage.getItem("userId");
        const storedToken =
          (await AsyncStorage.getItem("login_token")) ||
          (await AsyncStorage.getItem("token"));
        if (!active) return;
        setUserId(storedUserId || "");
        setToken(storedToken || "");
      } catch (error) {
        if (active) {
          showAlert("Authentication error", getErrorMessage(error));
        }
      } finally {
        if (active) setInitializing(false);
      }
    };
    void loadAuth();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    // Native notification permissions are unavailable in the Electron web runtime.
    if (Platform.OS === "web") return;

    const requestPermission = async () => {
      try {
        const permissions = await Notifications.getPermissionsAsync();
        if (!permissions.granted) {
          await Notifications.requestPermissionsAsync();
        }
      } catch (error) {
        console.warn("[Notifications] Permission request unavailable:", error);
      }
    };
    void requestPermission();
  }, []);

  useEffect(() => {
    if (!isEditing || !passedTodo) return;
    setTitle(passedTodo.title || "");
    setContent(passedTodo.text || "");
    if (["left", "center", "right"].includes(passedTodo.alignment || "")) {
      setAlignment(passedTodo.alignment as "left" | "center" | "right");
    } else {
      setAlignment("left");
    }
    setExistingAttachments(getExistingAttachments(passedTodo));
    if (
      typeof passedTodo.backgroundImageUrl === "string" &&
      passedTodo.backgroundImageUrl
    ) {
      setNoteBackgroundImageUri(passedTodo.backgroundImageUrl);
    }
    if (typeof passedTodo.quickNoteColor === "string")
      setQuickNoteColor(passedTodo.quickNoteColor);
    if (passedTodo.notePattern) setNotePattern(passedTodo.notePattern);
    if (
      passedTodo.notebookStyle &&
      ["classic", "minimal", "journal"].includes(passedTodo.notebookStyle)
    ) {
      setDefaultNotebookStyle(passedTodo.notebookStyle);
    }
    if (
      passedTodo.noteTextSize &&
      ["small", "medium", "large"].includes(passedTodo.noteTextSize)
    ) {
      setDefaultNoteTextSize(passedTodo.noteTextSize);
      setFontSize(
        passedTodo.noteTextSize === "small"
          ? 14
          : passedTodo.noteTextSize === "large"
            ? 22
            : 18,
      );
      setLineSpacing(
        passedTodo.noteTextSize === "small"
          ? 22
          : passedTodo.noteTextSize === "large"
            ? 34
            : 28,
      );
    }
    if (
      passedTodo.noteCornerStyle &&
      ["square", "rounded", "soft"].includes(passedTodo.noteCornerStyle)
    ) {
      setDefaultNoteCornerStyle(passedTodo.noteCornerStyle);
    }
    const parsedDate = passedTodo.date ? new Date(passedTodo.date) : new Date();
    const validDate = Number.isNaN(parsedDate.getTime())
      ? new Date()
      : parsedDate;
    const dateValue = toDateInput(validDate);
    setTodoDate(dateValue);
    setDateText(dateValue);
    setDueDateTime(validDate);
    const savedReminder = passedTodo.reminderDate || passedTodo.alarm;
    if (savedReminder) {
      const parsedAlarm = new Date(savedReminder);
      setAlarmDate(Number.isNaN(parsedAlarm.getTime()) ? null : parsedAlarm);
    } else {
      setAlarmDate(null);
    }
    setRecurring(
      passedTodo.recurring === "daily" ||
        passedTodo.recurring === "weekly" ||
        passedTodo.recurring === "monthly"
        ? passedTodo.recurring
        : "none",
    );
  }, [isEditing, passedTodo]);

  useEffect(() => {
    if (!todoId) return;
    let active = true;
    AsyncStorage.getItem(`note-drawing:${todoId}`)
      .then((uri) => {
        if (active && uri) setDrawingUri(uri);
      })
      .catch((error) => console.warn("Unable to restore saved sketch:", error));
    return () => {
      active = false;
    };
  }, [todoId]);

  useEffect(() => {
    if (!isEditing) return;
    let active = true;
    const loadQuickNoteMeta = async () => {
      const ids = [
        todoId,
        passedTodo?.tdlId,
        passedTodo?._id,
        passedTodo?.id,
        passedTodo?.todoId,
      ]
        .filter(
          (value): value is string | number =>
            value !== undefined &&
            value !== null &&
            String(value).trim() !== "",
        )
        .map(String);
      const titleKeys = [passedTodo?.title, title]
        .filter(
          (value): value is string =>
            typeof value === "string" && value.trim().length > 0,
        )
        .map((value) => value.trim().toLowerCase());
      const keys = [...new Set([...ids, ...titleKeys])].map(
        (value) => `quick-note-meta:${value}`,
      );
      try {
        for (const key of keys) {
          const raw = await AsyncStorage.getItem(key);
          if (!raw) continue;
          const meta = JSON.parse(raw) as {
            isQuickNote?: boolean;
            quickNoteColor?: string;
            quickNotePinned?: boolean;
            backgroundImageUri?: string;
            notePattern?: string;
            notebookStyle?: "classic" | "minimal" | "journal";
            noteTextSize?: "small" | "medium" | "large";
            noteCornerStyle?: "square" | "rounded" | "soft";
            alignment?: "left" | "center" | "right";
          };
          if (!active) return;
          if (["left", "center", "right"].includes(meta.alignment || "")) {
            setAlignment(meta.alignment as "left" | "center" | "right");
          }
          if (typeof meta.quickNoteColor === "string")
            setQuickNoteColor(meta.quickNoteColor);
          if (typeof meta.quickNotePinned === "boolean")
            setQuickNotePinned(meta.quickNotePinned);
          if (
            typeof meta.backgroundImageUri === "string" &&
            meta.backgroundImageUri
          )
            setNoteBackgroundImageUri(meta.backgroundImageUri);
          if (typeof meta.notePattern === "string" && meta.notePattern.trim()) {
            setNotePattern(meta.notePattern.trim().toLowerCase());
          }
          if (
            meta.notebookStyle &&
            ["classic", "minimal", "journal"].includes(meta.notebookStyle)
          ) {
            setDefaultNotebookStyle(meta.notebookStyle);
          }
          if (
            meta.noteTextSize &&
            ["small", "medium", "large"].includes(meta.noteTextSize)
          ) {
            setDefaultNoteTextSize(meta.noteTextSize);
            setFontSize(
              meta.noteTextSize === "small"
                ? 14
                : meta.noteTextSize === "large"
                  ? 22
                  : 18,
            );
            setLineSpacing(
              meta.noteTextSize === "small"
                ? 22
                : meta.noteTextSize === "large"
                  ? 34
                  : 28,
            );
          }
          if (
            meta.noteCornerStyle &&
            ["square", "rounded", "soft"].includes(meta.noteCornerStyle)
          ) {
            setDefaultNoteCornerStyle(meta.noteCornerStyle);
          }
          return;
        }
      } catch (error) {
        console.warn("Unable to restore quick-note metadata:", error);
      }
    };
    void loadQuickNoteMeta();
    return () => {
      active = false;
    };
  }, [isEditing, todoId, passedTodo, title]);

  useEffect(() => {
    if (!isEditing || !todoId || !token || passedTodo) return;
    let active = true;

    const loadTodo = async () => {
      try {
        const response = await axios.get<{
          success?: boolean;
          data?: TodoItem[];
        }>(`${API_BASE_URL}/api/todolist`, { headers: authHeader(token) });

        if (!active) return;

        const payload = (response.data?.data ?? []).find(
          (item) => String(item.tdlId ?? item.id ?? "") === String(todoId),
        );

        if (!response.data?.success || !payload) {
          showAlert(
            "Unable to load",
            "Todo was not found. Please return to the list and open Edit again.",
          );
          return;
        }

        setTitle(payload.title || "");
        setContent(payload.text || "");
        if (["left", "center", "right"].includes(payload.alignment || "")) {
          setAlignment(payload.alignment as "left" | "center" | "right");
        } else {
          setAlignment("left");
        }
        setExistingAttachments(getExistingAttachments(payload));
        setNoteBackgroundImageUri(payload.backgroundImageUrl || null);
        if (payload.quickNoteColor) setQuickNoteColor(payload.quickNoteColor);
        if (payload.notePattern) setNotePattern(payload.notePattern);
        if (
          payload.notebookStyle &&
          ["classic", "minimal", "journal"].includes(payload.notebookStyle)
        ) {
          setDefaultNotebookStyle(payload.notebookStyle);
        }
        if (
          payload.noteTextSize &&
          ["small", "medium", "large"].includes(payload.noteTextSize)
        ) {
          setDefaultNoteTextSize(payload.noteTextSize);
          setFontSize(
            payload.noteTextSize === "small"
              ? 14
              : payload.noteTextSize === "large"
                ? 22
                : 18,
          );
          setLineSpacing(
            payload.noteTextSize === "small"
              ? 22
              : payload.noteTextSize === "large"
                ? 34
                : 28,
          );
        }
        if (
          payload.noteCornerStyle &&
          ["square", "rounded", "soft"].includes(payload.noteCornerStyle)
        ) {
          setDefaultNoteCornerStyle(payload.noteCornerStyle);
        }
        const parsedDate = payload.date ? new Date(payload.date) : new Date();
        const validDate = Number.isNaN(parsedDate.getTime())
          ? new Date()
          : parsedDate;
        const dateValue = toDateInput(validDate);
        setTodoDate(dateValue);
        setDateText(dateValue);
        setDueDateTime(validDate);

        const savedReminder = payload.reminderDate || payload.alarm;
        if (savedReminder) {
          const parsedAlarm = new Date(savedReminder);
          setAlarmDate(
            Number.isNaN(parsedAlarm.getTime()) ? null : parsedAlarm,
          );
        } else {
          setAlarmDate(null);
        }
        setRecurring(
          payload.recurring === "daily" ||
            payload.recurring === "weekly" ||
            payload.recurring === "monthly"
            ? payload.recurring
            : "none",
        );

        setImageUris([]);
        setVideoUris([]);
        webImageFiles.forEach(({ uri }) => URL.revokeObjectURL(uri));
        webVideoFiles.forEach(({ uri }) => URL.revokeObjectURL(uri));
        setWebImageFiles([]);
        setWebVideoFiles([]);
        setAttachedFiles([]);
        setVoiceUri(null);
      } catch (error) {
        if (active) {
          showAlert("Load failed", getErrorMessage(error));
        }
      }
    };

    void loadTodo();
    return () => {
      active = false;
    };
  }, [isEditing, todoId, token, passedTodo]);

  const applyDate = useCallback((selectedDate: Date) => {
    const value = toDateInput(selectedDate);
    setTodoDate(value);
    setDateText(value);
    setDueDateTime((previous) => {
      const next = new Date(selectedDate);
      next.setHours(previous.getHours(), previous.getMinutes(), 0, 0);
      return next;
    });
  }, []);

  // When launched from a selected calendar day, link the new note to that date.
  const calendarDateApplied = useRef(false);

  useEffect(() => {
    const rawSelectedDate = Array.isArray(params.selectedDate)
      ? params.selectedDate[0]
      : params.selectedDate;
    if (isEditing || !rawSelectedDate || calendarDateApplied.current) return;
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(rawSelectedDate);
    if (!match) return;
    const linkedDate = new Date(
      Number(match[1]),
      Number(match[2]) - 1,
      Number(match[3]),
      12,
      0,
      0,
    );
    if (
      linkedDate.getFullYear() !== Number(match[1]) ||
      linkedDate.getMonth() !== Number(match[2]) - 1 ||
      linkedDate.getDate() !== Number(match[3])
    )
      return;
    calendarDateApplied.current = true;
    applyDate(linkedDate);
  }, [params.selectedDate, isEditing, applyDate]);

  // Web/Electron uses the browser datetime-local picker.
  // Android continues to use the native DateTimePickerAndroid dialogs.
  const formatLocalDateTime = (date: Date) => {
    const pad = (value: number) => String(value).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  };

  const openWebDateTimePicker = useCallback(
    (
      initialDate: Date,
      title: string,
      onSelected: (selectedDate: Date) => void,
    ) => {
      if (Platform.OS !== "web" || typeof document === "undefined") return;

      const now = new Date();
      const input = document.createElement("input");
      input.type = "datetime-local";
      input.step = "60";
      input.min = formatLocalDateTime(now);
      input.value = formatLocalDateTime(initialDate);
      input.setAttribute("aria-label", title);

      // Keep the control visible so Chromium/Electron can open its native picker.
      input.style.cssText = `
        position: fixed;
        left: 50%;
        top: 50%;
        transform: translate(-50%, -50%);
        width: 280px;
        height: 48px;
        padding: 8px;
        opacity: 1;
        z-index: 999999;
        background: #FFFFFF;
        border: 1px solid #16866A;
        border-radius: 8px;
        color: #183B32;
      `;

      document.body.appendChild(input);

      let cleaned = false;
      const cleanup = () => {
        if (cleaned) return;
        cleaned = true;
        input.removeEventListener("change", handleChange);
        input.removeEventListener("cancel", cleanup);
        input.remove();
      };

      const handleChange = () => {
        if (!input.value) {
          cleanup();
          return;
        }

        // datetime-local is local time; this preserves the user's local selection.
        const selectedDate = new Date(input.value);
        if (
          Number.isNaN(selectedDate.getTime()) ||
          selectedDate.getTime() <= Date.now()
        ) {
          window.alert(`Please select a future ${title.toLowerCase()}.`);
          cleanup();
          return;
        }

        onSelected(selectedDate);
        cleanup();
      };

      input.addEventListener("change", handleChange);
      input.addEventListener("cancel", cleanup);
      input.focus();

      try {
        if (typeof input.showPicker === "function") {
          input.showPicker();
        } else {
          input.click();
        }
      } catch (error) {
        console.warn(
          `[${title}] showPicker unavailable; using click fallback.`,
          error,
        );
        try {
          input.click();
        } catch (fallbackError) {
          console.error(`[${title}] Could not open picker:`, fallbackError);
          cleanup();
        }
      }
    },
    [],
  );

  const setQuickDate = useCallback(
    (offset: number) => {
      const date = new Date();
      date.setHours(0, 0, 0, 0);
      date.setDate(date.getDate() + offset);
      applyDate(date);
    },
    [applyDate],
  );

  const openDatePicker = useCallback(() => {
    const now = new Date();

    const current =
      dueDateTime instanceof Date && !Number.isNaN(dueDateTime.getTime())
        ? new Date(dueDateTime)
        : now;

    // Web / Electron
    if (Platform.OS === "web") {
      openWebDateTimePicker(current, "Due date and time", (selectedDate) => {
        setDueDateTime(selectedDate);

        const formatted = toDateInput(selectedDate);
        setTodoDate(formatted);
        setDateText(formatted);
      });
      return;
    }

    // Native picker is supported only on Android.
    // Never call DateTimePickerAndroid from Electron/Web or iOS.
    if (Platform.OS !== "android") {
      return;
    }

    // Android native date and time picker
    DateTimePickerAndroid.open({
      value: current < now ? now : current,
      mode: "date",
      minimumDate: now,
      is24Hour: true,

      onChange: (dateEvent, selectedDate) => {
        if (dateEvent.type !== "set" || !selectedDate) {
          return;
        }

        const selectedDay = new Date(selectedDate);
        const today = new Date();

        // Prevent selecting a past date
        if (selectedDay.toDateString() === today.toDateString()) {
          selectedDay.setHours(
            Math.max(selectedDay.getHours(), today.getHours()),
            selectedDay.getHours() === today.getHours()
              ? Math.max(selectedDay.getMinutes(), today.getMinutes())
              : selectedDay.getMinutes(),
            0,
            0,
          );
        }

        DateTimePickerAndroid.open({
          value: selectedDay,
          mode: "time",
          is24Hour: true,

          onChange: (timeEvent, selectedTime) => {
            if (timeEvent.type !== "set" || !selectedTime) {
              return;
            }

            const finalDate = new Date(selectedDay);
            finalDate.setHours(
              selectedTime.getHours(),
              selectedTime.getMinutes(),
              0,
              0,
            );

            if (finalDate.getTime() <= Date.now()) {
              showAlert(
                "Invalid due date",
                "Please select a future date and time.",
              );
              return;
            }

            setDueDateTime(finalDate);

            const formatted = toDateInput(finalDate);
            setTodoDate(formatted);
            setDateText(formatted);
          },
        });
      },
    });
  }, [
    dueDateTime,
    openWebDateTimePicker,
    setDueDateTime,
    setTodoDate,
    setDateText,
  ]);

  const openReminderPicker = useCallback(() => {
    const now = new Date();

    const initialDate =
      alarmDate instanceof Date &&
      !Number.isNaN(alarmDate.getTime()) &&
      alarmDate.getTime() > now.getTime()
        ? new Date(alarmDate)
        : new Date(now.getTime() + 60 * 60 * 1000);

    // Web / Electron: use the HTML datetime-local picker.
    if (Platform.OS === "web") {
      openWebDateTimePicker(
        initialDate,
        "Reminder date and time",
        (selectedDate) => {
          setAlarmDate(selectedDate);
          setModifiedAt(new Date().toISOString());
        },
      );
      return;
    }

    // DateTimePickerAndroid is Android-only.
    if (Platform.OS !== "android") {
      return;
    }

    // Android: open the native date picker first.
    DateTimePickerAndroid.open({
      value: initialDate,
      mode: "date",
      minimumDate: now,
      is24Hour: true,
      onChange: (dateEvent, selectedDate) => {
        if (dateEvent.type !== "set" || !selectedDate) {
          return;
        }

        // Keep the chosen calendar day and preserve the existing reminder time.
        const selectedDay = new Date(selectedDate);
        selectedDay.setHours(
          initialDate.getHours(),
          initialDate.getMinutes(),
          0,
          0,
        );

        // Then open the native time picker.
        DateTimePickerAndroid.open({
          value: selectedDay,
          mode: "time",
          is24Hour: true,
          onChange: (timeEvent, selectedTime) => {
            if (timeEvent.type !== "set" || !selectedTime) {
              return;
            }

            const finalDate = new Date(selectedDay);
            finalDate.setHours(
              selectedTime.getHours(),
              selectedTime.getMinutes(),
              0,
              0,
            );

            if (finalDate.getTime() <= Date.now()) {
              showAlert(
                "Invalid reminder",
                "Please select a future date and time.",
              );
              return;
            }

            setAlarmDate(finalDate);
            setModifiedAt(new Date().toISOString());
          },
        });
      },
    });
  }, [alarmDate, openWebDateTimePicker, setAlarmDate, setModifiedAt]);

  const openDesktopFilePicker = useCallback(
    (accept: string, onFilesSelected: (files: File[]) => void) => {
      if (Platform.OS !== "web" || typeof document === "undefined") {
        return;
      }

      // Chromium/Electron opens the native Windows file dialog for this input.
      // Keep the input in the DOM until selection/cancel has completed.
      const input = document.createElement("input");
      input.type = "file";
      input.accept = accept;
      input.multiple = true;
      input.setAttribute("aria-hidden", "true");
      input.style.position = "fixed";
      input.style.left = "-10000px";
      input.style.top = "0";
      input.style.width = "1px";
      input.style.height = "1px";
      input.style.opacity = "0";

      const cleanup = () => {
        input.onchange = null;
        input.oncancel = null;
        input.remove();
      };

      input.onchange = () => {
        const files = Array.from(input.files ?? []);
        cleanup();
        if (files.length > 0) {
          onFilesSelected(files);
        } else {
          setAttachmentModalVisible(false);
        }
      };

      input.oncancel = () => {
        cleanup();
        setAttachmentModalVisible(false);
      };

      document.body.appendChild(input);

      // IMPORTANT: this must run synchronously from the actual button click.
      try {
        input.click();
      } catch (error) {
        cleanup();
        setAttachmentModalVisible(false);
        console.error("[Desktop] Could not open Windows file picker:", error);
        showAlert(
          "File picker error",
          "Windows file selection could not be opened.",
        );
      }
    },
    [],
  );

  const pickImage = useCallback(async () => {
    try {
      if (Platform.OS === "web") {
        openDesktopFilePicker("image/*", (files) => {
          const selected = files
            .filter((file) => file.type.startsWith("image/"))
            .map((file) => ({
              uri: URL.createObjectURL(file),
              file,
            }));

          if (selected.length === 0) {
            showAlert("No images selected", "Please choose an image file.");
            return;
          }

          setWebImageFiles((previous) => [...previous, ...selected]);
          setImageUris((previous) => [
            ...new Set([...previous, ...selected.map((item) => item.uri)]),
          ]);
          setAttachmentModalVisible(false);
        });
        return;
      }

      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        showAlert(
          "Permission required",
          "Allow photo-library access to attach images.",
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsMultipleSelection: true,
        allowsEditing: false,
        quality: 0.8,
        selectionLimit: 10,
      });

      if (result.canceled || !result.assets?.length) return;

      const selectedUris = result.assets
        .filter((asset) => asset.type === "image")
        .map((asset) => asset.uri);

      if (selectedUris.length) {
        setImageUris((previous) => [
          ...new Set([...previous, ...selectedUris]),
        ]);
      }
    } catch (error) {
      console.error("Image selection error:", error);
      showAlert("Image error", getErrorMessage(error));
    }
  }, [openDesktopFilePicker]);

  const pickVideo = useCallback(async () => {
    try {
      if (Platform.OS === "web") {
        openDesktopFilePicker("video/*", (files) => {
          const selected = files
            .filter((file) => file.type.startsWith("video/"))
            .map((file) => ({
              uri: URL.createObjectURL(file),
              file,
            }));

          if (selected.length === 0) {
            showAlert("No videos selected", "Please choose a video file.");
            return;
          }

          setWebVideoFiles((previous) => [...previous, ...selected]);
          setVideoUris((previous) => [
            ...new Set([...previous, ...selected.map((item) => item.uri)]),
          ]);
          setAttachmentModalVisible(false);
        });
        return;
      }

      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        showAlert(
          "Permission required",
          "Please allow media-library access to select videos.",
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["videos"],
        allowsMultipleSelection: true,
        allowsEditing: false,
        videoMaxDuration: 300,
        selectionLimit: 10,
      });

      if (result.canceled || !result.assets?.length) return;

      const selectedUris = result.assets
        .filter((asset) => asset.type === "video")
        .map((asset) => asset.uri);

      setVideoUris((previous) => [...new Set([...previous, ...selectedUris])]);
    } catch (error) {
      console.error("Video selection error:", error);
      showAlert("Video error", getErrorMessage(error));
    }
  }, [openDesktopFilePicker]);

  const captureImage = useCallback(async () => {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();

      if (!permission.granted) {
        showAlert(
          "Permission required",
          "Please allow camera access to take a photo.",
        );
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ["images"],
        allowsEditing: false,
        quality: 0.8,
      });

      if (result.canceled || !result.assets?.length) return;

      const uri = result.assets[0].uri;
      setImageUris((previous) => [...new Set([...previous, uri])]);
    } catch (error) {
      showAlert("Camera error", getErrorMessage(error));
    }
  }, []);

  const captureVideo = useCallback(async () => {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();

      if (!permission.granted) {
        showAlert(
          "Permission required",
          "Please allow camera access to record a video.",
        );
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ["videos"],
        videoMaxDuration: 300,
        cameraType: ImagePicker.CameraType.back,
      });

      if (result.canceled || !result.assets?.length) return;

      const uri = result.assets[0].uri;
      setVideoUris((previous) => [...new Set([...previous, uri])]);
    } catch (error) {
      showAlert("Video error", getErrorMessage(error));
    }
  }, []);

  const pickDocument = useCallback(async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "*/*",
        copyToCacheDirectory: true,
        multiple: true,
      });

      if (result.canceled || !result.assets?.length) return;

      setAttachedFiles((previous) => {
        const merged = [...previous, ...result.assets];
        const unique = new Map<string, DocumentPicker.DocumentPickerAsset>();
        merged.forEach((file) => unique.set(file.uri, file));
        return [...unique.values()];
      });
    } catch (error) {
      showAlert("File error", getErrorMessage(error));
    }
  }, []);

  const startRecording = useCallback(async () => {
    if (recordingBusy || loading || recordingSessionActive) return;
    setRecordingBusy(true);

    try {
      const permission = await AudioModule.requestRecordingPermissionsAsync();
      if (!permission.granted) {
        showAlert(
          "Microphone permission",
          "Allow microphone access to record a voice note.",
        );
        return;
      }

      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });
      await recorder.prepareToRecordAsync();
      recorder.record();
      recordingRef.current = true;
      setRecordingSessionActive(true);
      setIsPaused(false);
      setPlayerError("");
    } catch (error) {
      recordingRef.current = false;
      setRecordingSessionActive(false);
      setIsPaused(false);
      showAlert("Recording error", getErrorMessage(error));
    } finally {
      if (mounted.current) setRecordingBusy(false);
    }
  }, [loading, recorder, recordingBusy, recordingSessionActive]);

  const pauseVoiceRecording = useCallback(async () => {
    if (!recordingSessionActive || isPaused || recordingBusy) return;
    try {
      await recorder.pause();
      setIsPaused(true);
    } catch (error) {
      showAlert("Pause error", getErrorMessage(error));
    }
  }, [recorder, recordingSessionActive, isPaused, recordingBusy]);

  const resumeRecording = useCallback(async () => {
    if (!recordingSessionActive || !isPaused || recordingBusy) return;
    try {
      recorder.record();
      setIsPaused(false);
    } catch (error) {
      showAlert("Resume error", getErrorMessage(error));
    }
  }, [recorder, recordingSessionActive, isPaused, recordingBusy]);

  const stopRecording = useCallback(async () => {
    if (!recordingRef.current || recordingBusy) return;
    setRecordingBusy(true);

    try {
      await recorder.stop();
      recordingRef.current = false;
      setRecordingSessionActive(false);
      setIsPaused(false);

      const uri = recorder.uri;
      if (uri) {
        setVoiceUri(uri);
        setPlayerError("");
      } else {
        showAlert(
          "Recording unavailable",
          "The recording did not produce a file. Please try again.",
        );
      }
    } catch (error) {
      showAlert("Unable to stop recording", getErrorMessage(error));
    } finally {
      recordingRef.current = false;
      setRecordingSessionActive(false);
      setIsPaused(false);
      try {
        await setAudioModeAsync({
          allowsRecording: false,
          playsInSilentMode: true,
        });
      } catch {}
      if (mounted.current) setRecordingBusy(false);
    }
  }, [recorder, recordingBusy]);

  const toggleRecording = useCallback(() => {
    if (recordingSessionActive) {
      void stopRecording();
    } else {
      void startRecording();
    }
  }, [recordingSessionActive, startRecording, stopRecording]);

  const togglePlayback = useCallback(async () => {
    if (!voiceUri) return;
    try {
      setPlayerError("");
      if (playerStatus.playing) {
        await player.pause();
      } else {
        await setAudioModeAsync({
          allowsRecording: false,
          playsInSilentMode: true,
        });
        await player.play();
      }
    } catch (error) {
      const message = getErrorMessage(error);
      setPlayerError(message);
      showAlert("Playback error", message);
    }
  }, [player, playerStatus.playing, voiceUri]);

  const beginDrawingStroke = useCallback(
    (x: number, y: number) => {
      drawingUndoStack.current.push(drawingStrokes);
      if (drawingUndoStack.current.length > 100)
        drawingUndoStack.current.shift();
      drawingRedoStack.current = [];
      drawingStrokeStartTimeRef.current = Date.now();
      const stroke: DrawingStroke = {
        points: [{ x, y, t: 0 }],
        color: drawingEraser ? "#FFFFFF" : drawingColor,
        width: drawingEraser
          ? Math.max(14, drawingBrushSize * 3)
          : drawingTool === "pencil"
            ? Math.max(1, drawingBrushSize * 0.6)
            : drawingBrushSize,
      };
      drawingStartRef.current = stroke;
      setCurrentDrawingStroke(stroke);
    },
    [
      drawingBrushSize,
      drawingColor,
      drawingEraser,
      drawingTool,
      drawingStrokes,
    ],
  );

  const moveDrawingStroke = useCallback((x: number, y: number) => {
    const activeStroke = drawingStartRef.current;
    if (!activeStroke) return;
    const nextStroke = {
      ...activeStroke,
      points: [
        ...activeStroke.points,
        { x, y, t: Date.now() - drawingStrokeStartTimeRef.current },
      ],
    };
    drawingStartRef.current = nextStroke;
    setCurrentDrawingStroke(nextStroke);
  }, []);

  const finishDrawingStroke = useCallback(() => {
    const activeStroke = drawingStartRef.current;
    if (activeStroke) {
      setDrawingStrokes((previous) => [...previous, activeStroke]);
      setCurrentDrawingStroke(null);
      drawingStartRef.current = null;
      setModifiedAt(new Date().toISOString());
    }
  }, []);

  useEffect(() => {
    if (drawingRecognitionTimerRef.current) {
      clearTimeout(drawingRecognitionTimerRef.current);
      drawingRecognitionTimerRef.current = null;
    }

    return () => {
      if (drawingRecognitionTimerRef.current) {
        clearTimeout(drawingRecognitionTimerRef.current);
        drawingRecognitionTimerRef.current = null;
      }
    };
  }, [drawingModalVisible]);

  const undoDrawing = useCallback(() => {
    const previous = drawingUndoStack.current.pop();
    if (!previous) return;
    drawingRedoStack.current.push(drawingStrokes);
    setDrawingStrokes(previous);
    setCurrentDrawingStroke(null);
    drawingStartRef.current = null;
  }, [drawingStrokes]);

  const redoDrawing = useCallback(() => {
    const next = drawingRedoStack.current.pop();
    if (!next) return;
    drawingUndoStack.current.push(drawingStrokes);
    setDrawingStrokes(next);
    setCurrentDrawingStroke(null);
    drawingStartRef.current = null;
  }, [drawingStrokes]);

  const clearDrawingCanvas = useCallback(() => {
    if (drawingStrokes.length === 0 && !currentDrawingStroke) return;
    drawingUndoStack.current.push(drawingStrokes);
    drawingRedoStack.current = [];
    setDrawingStrokes([]);
    setCurrentDrawingStroke(null);
    drawingStartRef.current = null;
  }, [currentDrawingStroke, drawingStrokes]);

  const saveDrawing = useCallback(async () => {
    if (Platform.OS === "web") {
      showAlert(
        "Drawing attachment unavailable",
        "Saving a drawing as an image is supported in the Android app. Use an image upload in the desktop app.",
      );
      return;
    }

    if (!drawingCanvasCaptureRef.current) {
      showAlert(
        "Drawing unavailable",
        "Please reopen the drawing canvas and try again.",
      );
      return;
    }
    if (drawingStrokes.length === 0 && !currentDrawingStroke) {
      showAlert("Empty canvas", "Draw something before saving.");
      return;
    }
    try {
      if (currentDrawingStroke) {
        setDrawingStrokes((previous) => [...previous, currentDrawingStroke]);
        setCurrentDrawingStroke(null);
        drawingStartRef.current = null;
        await new Promise((resolve) => setTimeout(resolve, 80));
      }
      const temporaryUri = await captureRef(drawingCanvasCaptureRef, {
        format: "png",
        quality: 1,
        result: "tmpfile",
      });
      const baseDirectory = FileSystem.documentDirectory;
      if (!baseDirectory)
        throw new Error("App document storage is unavailable.");
      const destinationUri = `${baseDirectory}todo_sketch_${Date.now()}.png`;
      await FileSystem.copyAsync({ from: temporaryUri, to: destinationUri });
      setDrawingUri(destinationUri);
      setModifiedAt(new Date().toISOString());
      setDrawingModalVisible(false);
      showAlert("Drawing saved", "Your sketch has been attached to this note.");
    } catch (error) {
      showAlert(
        "Unable to save drawing",
        error instanceof Error
          ? error.message
          : "Please check the drawing dependencies and try again.",
      );
    }
  }, [currentDrawingStroke, drawingStrokes]);

  const clearDrawingAttachment = useCallback(() => {
    setDrawingUri(null);
    setModifiedAt(new Date().toISOString());
  }, []);

  const drawingPath = useCallback((stroke: DrawingStroke) => {
    if (stroke.points.length === 0) return "";
    const [first, ...rest] = stroke.points;
    return (
      `M ${first.x} ${first.y} ` +
      rest.map((point) => `L ${point.x} ${point.y}`).join(" ")
    );
  }, []);

  const cancelTodoNotifications = useCallback(
    async (targetTodoId?: string | null) => {
      // Local notifications are native-only; do not call them from Electron.
      if (Platform.OS === "web" || !targetTodoId) return 0;
      const stableId = String(targetTodoId);
      const pending = await Notifications.getAllScheduledNotificationsAsync();
      const matching = pending.filter(
        (notification) =>
          String(notification.content.data?.todoId ?? "") === stableId,
      );
      await Promise.all(
        matching.map((notification) =>
          Notifications.cancelScheduledNotificationAsync(
            notification.identifier,
          ),
        ),
      );
      console.log(
        `[Todo reminders] Cancelled ${matching.length} reminder(s) for ${stableId}`,
      );
      return matching.length;
    },
    [],
  );

  const scheduleLocalNotification = useCallback(
    async (savedTitle: string, savedTodoId?: string | null) => {
      // The Todo API save still works on desktop; only native notifications are skipped.
      if (Platform.OS === "web") {
        console.info(
          "[Todo reminders] Skipped: native notifications are mobile-only.",
        );
        return;
      }

      const stableTodoId = savedTodoId
        ? String(savedTodoId)
        : todoId
          ? String(todoId)
          : undefined;

      if (stableTodoId) await cancelTodoNotifications(stableTodoId);

      // No selected reminder means the old notification has been cancelled.
      if (!alarmDate) return;

      if (!stableTodoId) {
        throw new Error(
          "The Todo was saved, but the server did not return its ID. Reopen the Todo and set the reminder again.",
        );
      }

      const firstReminder = new Date(alarmDate);
      if (Number.isNaN(firstReminder.getTime())) {
        throw new Error("The reminder date is invalid.");
      }
      if (firstReminder.getTime() <= Date.now()) {
        throw new Error("Choose a reminder date and time in the future.");
      }

      const CHANNEL_ID = "todo-reminders-v4";
      let permissions = await Notifications.getPermissionsAsync();
      if (!permissions.granted) {
        permissions = await Notifications.requestPermissionsAsync();
      }
      if (!permissions.granted) {
        throw new Error(
          "Notification permission is disabled. Enable notifications for this app in your phone Settings and try again.",
        );
      }

      if (Platform.OS === "android") {
        await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
          name: "Todo reminders",
          description: "Reminders for your todo tasks",
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          enableVibrate: true,
          enableLights: true,
        });
      }

      const repeat = recurring || "none";
      const occurrences: Date[] = [];
      const addIfFuture = (candidate: Date) => {
        if (candidate.getTime() > Date.now()) occurrences.push(candidate);
      };

      if (repeat === "none") {
        addIfFuture(firstReminder);
      } else if (repeat === "daily") {
        for (let i = 0; i < 60; i++) {
          const candidate = new Date(firstReminder);
          candidate.setDate(firstReminder.getDate() + i);
          addIfFuture(candidate);
        }
      } else if (repeat === "weekly") {
        for (let i = 0; i < 52; i++) {
          const candidate = new Date(firstReminder);
          candidate.setDate(firstReminder.getDate() + i * 7);
          addIfFuture(candidate);
        }
      } else if (repeat === "monthly") {
        const desiredDay = firstReminder.getDate();
        for (let i = 0; i < 24; i++) {
          const year = firstReminder.getFullYear();
          const month = firstReminder.getMonth() + i;
          const lastDay = new Date(year, month + 1, 0).getDate();
          const candidate = new Date(firstReminder);
          candidate.setDate(1);
          candidate.setFullYear(year, month, 1);
          candidate.setDate(Math.min(desiredDay, lastDay));
          candidate.setHours(
            firstReminder.getHours(),
            firstReminder.getMinutes(),
            0,
            0,
          );
          addIfFuture(candidate);
        }
      }

      if (occurrences.length === 0) {
        throw new Error(
          "No future reminder times could be scheduled. Choose a future date and time.",
        );
      }

      let scheduledCount = 0;
      try {
        for (const occurrence of occurrences) {
          await Notifications.scheduleNotificationAsync({
            content: {
              title: "Todo reminder",
              body: savedTitle || "You have a task to complete.",
              data: {
                todoId: stableTodoId,
                recurring: repeat,
                scheduledFor: occurrence.toISOString(),
              },
            },
            trigger: {
              type: Notifications.SchedulableTriggerInputTypes.DATE,
              date: occurrence,
              ...(Platform.OS === "android" ? { channelId: CHANNEL_ID } : {}),
            },
          });
          scheduledCount += 1;
        }
      } catch (error) {
        // Avoid leaving only a partial set of recurring reminders behind.
        await cancelTodoNotifications(stableTodoId);
        throw error;
      }

      const pendingNotifications =
        await Notifications.getAllScheduledNotificationsAsync();
      console.log(
        "[Todo reminders] Scheduled count:",
        scheduledCount,
        "Pending:",
        pendingNotifications
          .filter(
            (item) => String(item.content.data?.todoId ?? "") === stableTodoId,
          )
          .map((item) => ({
            id: item.identifier,
            title: item.content.title,
            trigger: item.trigger,
          })),
      );
    },
    [alarmDate, recurring, todoId, cancelTodoNotifications],
  );

  const snoozeReminder = useCallback(
    async (minutes: 5 | 10 | 15, title: string, todoId: string) => {
      try {
        const stableTodoId = String(todoId ?? "").trim();
        if (
          !stableTodoId ||
          stableTodoId === "undefined" ||
          stableTodoId === "null"
        ) {
          showAlert(
            "Todo not saved",
            "Save this Todo first, then you can snooze its reminder.",
          );
          return;
        }

        let permissions = await Notifications.getPermissionsAsync();
        if (!permissions.granted) {
          permissions = await Notifications.requestPermissionsAsync();
        }
        if (!permissions.granted) {
          showAlert(
            "Notifications disabled",
            "Enable notifications in your phone settings to snooze this reminder.",
          );
          return;
        }

        const CHANNEL_ID = "todo-reminders-v4";
        if (Platform.OS === "android") {
          await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
            name: "Todo reminders",
            description:
              "Reminders for your todo tasks, including snoozed reminders",
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            enableVibrate: true,
            enableLights: true,
          });
        }

        const snoozeDate = new Date(Date.now() + minutes * 60 * 1000);

        const notificationId = await Notifications.scheduleNotificationAsync({
          content: {
            title: "Todo reminder",
            body: title || "You have a task to complete.",
            data: {
              todoId: stableTodoId,
              type: "snoozed-reminder",
              snoozeMinutes: minutes,
              scheduledFor: snoozeDate.toISOString(),
            },
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: snoozeDate,
            ...(Platform.OS === "android" ? { channelId: CHANNEL_ID } : {}),
          },
        });

        console.log(
          `[Snooze] Todo ${stableTodoId} snoozed for ${minutes} minutes`,
          notificationId,
        );

        showAlert(
          "Reminder snoozed",
          `Your reminder will appear again in ${minutes} minutes.`,
        );
      } catch (error) {
        console.error("Snooze reminder error:", error);

        showAlert("Unable to snooze", "Please try again.");
      }
    },
    [],
  );

  const buildFormData = useCallback(
    async (updatedAtIso = new Date().toISOString()): Promise<FormData> => {
      const formData = new FormData();

      // Associate this Todo with the folder that opened the editor, when provided.
      if (folderId) {
        formData.append("folderId", folderId);
      }

      // Save the selected Todo due date AND time as a full ISO timestamp.
      // Keep reminder date/time in separate fields.
      formData.append("title", title.trim());
      formData.append("date", dueDateTime.toISOString());
      formData.append("createdAt", createdAt);
      formData.append("updatedAt", updatedAtIso);
      formData.append("text", content.trim());
      // Keep the legacy alarm field for compatibility, and save the reminder
      // date and clock time explicitly for the backend/schema.
      formData.append("alarm", alarmDate?.toISOString() || "");
      formData.append("reminderDate", alarmDate ? alarmDate.toISOString() : "");
      formData.append(
        "reminderTime",
        alarmDate
          ? `${String(alarmDate.getHours()).padStart(2, "0")}:${String(alarmDate.getMinutes()).padStart(2, "0")}`
          : "",
      );
      formData.append("status", "pending");
      formData.append("noteType", "todo");
      formData.append("recurring", alarmDate ? recurring : "none");
      formData.append("isQuickNote", "false");
      formData.append("quickNoteColor", quickNoteColor);
      formData.append("quickNotePinned", String(quickNotePinned));
      formData.append("notePattern", notePattern);
      formData.append("notebookStyle", defaultNotebookStyle);
      formData.append("noteTextSize", defaultNoteTextSize);
      formData.append("noteCornerStyle", defaultNoteCornerStyle);
      // Persist paragraph alignment with the note so View Note can reproduce it.
      formData.append("alignment", alignment);
      // Always send the full existing attachment list, including [] when the
      // user intentionally removed every saved attachment. Omitting this field
      // makes the backend unable to distinguish "keep old files" from "clear all".
      const retainedAttachments = existingAttachments.filter((attachment) =>
        Boolean(attachment.id && attachment.id.trim()),
      );
      const retainedFileIds = retainedAttachments.map(
        (attachment) => attachment.id,
      );
      const retainedFileNames = retainedAttachments.map(
        (attachment) => attachment.name,
      );
      const retainedFileTypes = retainedAttachments.map(
        (attachment) => attachment.type,
      );

      formData.append("existingFileIds", JSON.stringify(retainedFileIds));
      // Include compatible metadata fields so the saved Todo/cache can preserve
      // names and MIME types when the backend supports them.
      formData.append("fileIds", JSON.stringify(retainedFileIds));
      formData.append("fileNames", JSON.stringify(retainedFileNames));
      formData.append("fileTypes", JSON.stringify(retainedFileTypes));

      if (userId) formData.append("userId", userId);

      // Append every newly selected image, video, document, voice note,
      // background image and drawing. Web/Electron receives real Blob/File
      // objects; Android/iOS retains React Native URI descriptors.
      for (let index = 0; index < imageUris.length; index += 1) {
        const uri = imageUris[index];

        if (Platform.OS === "web") {
          const selected = webImageFiles.find((item) => item.uri === uri);
          if (!selected) {
            throw new Error(
              "An image preview is no longer linked to its original file. Please remove it and select the image again.",
            );
          }
          await appendLocalUpload(
            formData,
            "file",
            uri,
            selected.file.name || `todo_image_${index + 1}.jpg`,
            selected.file.type || "image/jpeg",
            selected.file,
          );
          continue;
        }

        const name = getFileName(uri, `todo_image_${index + 1}.jpg`);
        const extension = name.split(".").pop()?.toLowerCase();
        const mimeType =
          extension === "png"
            ? "image/png"
            : extension === "webp"
              ? "image/webp"
              : extension === "heic" || extension === "heif"
                ? "image/heic"
                : extension === "gif"
                  ? "image/gif"
                  : "image/jpeg";

        await appendLocalUpload(formData, "file", uri, name, mimeType);
      }

      for (let index = 0; index < videoUris.length; index += 1) {
        const uri = videoUris[index];

        if (Platform.OS === "web") {
          const selected = webVideoFiles.find((item) => item.uri === uri);
          if (!selected) {
            throw new Error(
              "A video preview is no longer linked to its original file. Please remove it and select the video again.",
            );
          }
          await appendLocalUpload(
            formData,
            "file",
            uri,
            selected.file.name || `todo_video_${index + 1}.mp4`,
            selected.file.type || "video/mp4",
            selected.file,
          );
          continue;
        }

        const videoName = getFileName(uri, `todo_video_${index + 1}.mp4`);
        const videoExtension = videoName.split(".").pop()?.toLowerCase();
        const videoMimeType =
          videoExtension === "mov"
            ? "video/quicktime"
            : videoExtension === "webm"
              ? "video/webm"
              : videoExtension === "m4v"
                ? "video/x-m4v"
                : "video/mp4";

        await appendLocalUpload(
          formData,
          "file",
          uri,
          videoName,
          videoMimeType,
        );
      }

      for (let index = 0; index < attachedFiles.length; index += 1) {
        const file = attachedFiles[index];
        const fileName = file.name || `todo_document_${index + 1}`;
        const extension = fileName.split(".").pop()?.toLowerCase();
        const fallbackMimeType =
          extension === "pdf"
            ? "application/pdf"
            : extension === "doc"
              ? "application/msword"
              : extension === "docx"
                ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                : extension === "txt"
                  ? "text/plain"
                  : extension === "xlsx"
                    ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                    : extension === "xls"
                      ? "application/vnd.ms-excel"
                      : extension === "ppt"
                        ? "application/vnd.ms-powerpoint"
                        : extension === "pptx"
                          ? "application/vnd.openxmlformats-officedocument.presentationml.presentation"
                          : extension === "mp3"
                            ? "audio/mpeg"
                            : extension === "wav"
                              ? "audio/wav"
                              : extension === "m4a"
                                ? "audio/mp4"
                                : extension === "webm"
                                  ? "audio/webm"
                                  : "application/octet-stream";

        // Expo DocumentPicker exposes `file` on web in supported versions.
        // Fall back to reading its URI if that property is unavailable.
        const browserFile = (file as DocumentPicker.DocumentPickerAsset & {
          file?: File;
        }).file;

        await appendLocalUpload(
          formData,
          "file",
          file.uri,
          fileName,
          file.mimeType || fallbackMimeType,
          browserFile,
        );
      }

      if (voiceUri) {
        let voiceName = getFileName(voiceUri, "");
        if (!voiceName || !voiceName.includes(".")) {
          voiceName =
            Platform.OS === "web" ? "todo_voice.webm" : "todo_voice.m4a";
        }
        const voiceMimeType = getAudioMimeType(
          voiceName,
          Platform.OS === "web" ? "audio/webm" : "audio/mp4",
        );

        await appendLocalUpload(
          formData,
          "file",
          voiceUri,
          voiceName,
          voiceMimeType,
        );
      }

      if (noteBackgroundImageUri) {
        const backgroundName = getFileName(
          noteBackgroundImageUri,
          "note_background.jpg",
        );
        const backgroundExtension = backgroundName
          .split(".")
          .pop()
          ?.toLowerCase();
        const backgroundMimeType =
          backgroundExtension === "png"
            ? "image/png"
            : backgroundExtension === "webp"
              ? "image/webp"
              : backgroundExtension === "heic"
                ? "image/heic"
                : "image/jpeg";

        await appendLocalUpload(
          formData,
          "backgroundImage",
          noteBackgroundImageUri,
          backgroundName,
          backgroundMimeType,
        );
      }

      if (drawingUri) {
        const drawingName = getFileName(drawingUri, "todo_sketch.png");
        await appendLocalUpload(
          formData,
          "file",
          drawingUri,
          drawingName,
          "image/png",
        );
      }

      return formData;
    },
    [
      alarmDate,
      recurring,
      folderId,
      content,
      createdAt,
      dateText,
      dueDateTime,
      imageUris,
      videoUris,
      webImageFiles,
      webVideoFiles,
      attachedFiles,
      existingAttachments,
      status,
      title,
      userId,
      voiceUri,
      drawingUri,
      isQuickNote,
      quickNoteColor,
      quickNotePinned,
      notePattern,
      defaultNotebookStyle,
      defaultNoteTextSize,
      defaultNoteCornerStyle,
      noteBackgroundImageUri,
      alignment,
    ],
  );

  const pinNoteToHomeScreen = useCallback(async () => {
    const noteId = String(todoId ?? "").trim();
    if (!noteId || noteId.startsWith("quick-note-")) {
      showAlert(
        "Save note first",
        "Save this note to the server, then open it in Edit mode and choose Pin shortcut to home screen.",
      );
      return;
    }

    const nativeShortcut = NativeModules.PinnedNoteShortcut as
      | {
          pinShortcut?: (
            title: string,
            noteId: string,
            content: string,
          ) => Promise<boolean>;
        }
      | undefined;

    if (
      Platform.OS !== "android" ||
      typeof nativeShortcut?.pinShortcut !== "function"
    ) {
      showAlert(
        "Native shortcut unavailable",
        "Pinned home-screen shortcuts require the Android native module and a rebuilt development/production app. Expo Go is not supported.",
      );
      return;
    }

    try {
      const pinned = await nativeShortcut.pinShortcut(
        title.trim() || "My Note",
        noteId,
        content.trim(),
      );
      if (pinned) {
        showAlert(
          "Shortcut requested",
          "If your launcher supports pinned shortcuts, confirm the Android prompt to add this note to your home screen.",
        );
      } else {
        showAlert(
          "Shortcut not added",
          "Android could not pin this shortcut. Try again from your device launcher.",
        );
      }
    } catch (error) {
      console.warn("[PinnedNoteShortcut] Failed:", error);
      showAlert(
        "Unable to pin shortcut",
        error instanceof Error
          ? error.message
          : "The Android shortcut could not be created.",
      );
    }
  }, [todoId, title, content]);

  const clearSavedDraft = useCallback(async () => {
    // Block future auto-saves before deleting the key.
    skipDraftAutoSaveRef.current = true;

    if (draftSaveTimerRef.current) {
      clearTimeout(draftSaveTimerRef.current);
      draftSaveTimerRef.current = null;
    }

    try {
      // Wait for a write that started before the save completed, so removeItem
      // runs after it and the old draft cannot win a race against deletion.
      if (draftWriteInFlightRef.current) {
        await draftWriteInFlightRef.current.catch(() => undefined);
      }

      await AsyncStorage.removeItem(draftKey);
      console.log("[Todo] Draft cleared successfully:", draftKey);
    } catch (error) {
      console.error("[Todo] Failed to clear draft:", error);
    }
  }, [draftKey]);

  const saveLocalDuplicate = async (updatedTodo: TodoItem) => {
    const storageKey = "local_todos";
    const raw = await AsyncStorage.getItem(storageKey);
    const localTodos: TodoItem[] = raw ? JSON.parse(raw) : [];
    const id = String(
      updatedTodo.tdlId ?? updatedTodo._id ?? updatedTodo.id ?? "",
    );

    const exists = localTodos.some(
      (item) => String(item.tdlId ?? item._id ?? item.id ?? "") === id,
    );

    const updatedLocalTodos = exists
      ? localTodos.map((item) =>
          String(item.tdlId ?? item._id ?? item.id ?? "") === id
            ? { ...item, ...updatedTodo, isLocalDuplicate: true }
            : item,
        )
      : [{ ...updatedTodo, isLocalDuplicate: true }, ...localTodos];

    await AsyncStorage.setItem(storageKey, JSON.stringify(updatedLocalTodos));

    try {
      const cacheRaw = await AsyncStorage.getItem("view_todolist_cache");
      if (cacheRaw) {
        const cachedTodos: TodoItem[] = JSON.parse(cacheRaw);
        const cacheHasItem = cachedTodos.some(
          (item) => String(item.tdlId ?? item._id ?? item.id ?? "") === id,
        );
        if (cacheHasItem) {
          await AsyncStorage.setItem(
            "view_todolist_cache",
            JSON.stringify(
              cachedTodos.map((item) =>
                String(item.tdlId ?? item._id ?? item.id ?? "") === id
                  ? { ...item, ...updatedTodo, isLocalDuplicate: true }
                  : item,
              ),
            ),
          );
        }
      }
    } catch (cacheError) {
      console.warn(
        "[Todo] Could not update local duplicate cache:",
        cacheError,
      );
    }
  };

  const saveTodo = useCallback(async () => {
    if (savingRef.current) return;

    if (!title.trim()) {
      showAlert("Title required", "Please enter a Todo title.");
      return;
    }

    const isLocalDuplicate = Boolean(passedTodo?.isLocalDuplicate);

    if (!isLocalDuplicate && (!token || !userId)) {
      showAlert("Login required", "Please sign in before saving this Todo.");
      return;
    }

    if (!parseDateText(dateText) || Number.isNaN(dueDateTime.getTime())) {
      showAlert("Invalid due date", "Please select a valid due date and time.");
      return;
    }

    if (isRecording || recordingRef.current) {
      showAlert(
        "Recording in progress",
        "Stop the voice recording before saving.",
      );
      return;
    }

    if (alarmDate && alarmDate.getTime() <= Date.now()) {
      showAlert("Invalid reminder", "Choose a reminder time in the future.");
      return;
    }

    savingRef.current = true;
    setLoading(true);

    try {
      const nowIso = new Date().toISOString();
      setModifiedAt(nowIso);

      // Local duplicates are edited and saved only on this device.
      if (isLocalDuplicate && passedTodo) {
        const localId = String(
          passedTodo.tdlId ?? passedTodo._id ?? passedTodo.id ?? todoId ?? "",
        ).trim();

        if (!localId) {
          throw new Error(
            "This local copy has no ID. Please duplicate the note again.",
          );
        }

        const updatedLocalTodo: TodoItem = {
          ...passedTodo,
          tdlId: localId,
          id: passedTodo.id ?? localId,
          title: title.trim(),
          text: content.trim(),
          date: dueDateTime.toISOString(),
          alarm: alarmDate?.toISOString() || "",
          reminderDate: alarmDate ? alarmDate.toISOString() : null,
          reminderTime: alarmDate
            ? `${String(alarmDate.getHours()).padStart(2, "0")}:${String(alarmDate.getMinutes()).padStart(2, "0")}`
            : "",
          recurring: alarmDate ? recurring : "none",
          status: "pending",
          // Preserve attachment MIME/type metadata; View List uses this to render media.
          type: passedTodo.type,
          // Keep the saved attachment IDs and metadata in the local-copy record.
          // Removed attachments are absent because this list comes from the editor.
          fileIds: existingAttachments.map((attachment) => attachment.id),
          fileNames: existingAttachments.map((attachment) => attachment.name),
          fileTypes: existingAttachments.map((attachment) => attachment.type),
          attachmentNames: existingAttachments.map(
            (attachment) => attachment.name,
          ),
          attachmentTypes: existingAttachments.map(
            (attachment) => attachment.type,
          ),
          quickNoteColor,
          quickNotePinned,
          notePattern,
          notebookStyle: defaultNotebookStyle,
          noteTextSize: defaultNoteTextSize,
          noteCornerStyle: defaultNoteCornerStyle,
          alignment,
          backgroundImageUrl:
            noteBackgroundImageUri || passedTodo.backgroundImageUrl,
          createdAt: passedTodo.createdAt || createdAt,
          updatedAt: nowIso,
          isLocalDuplicate: true,
          textColor: textColor,
          imageUris: imageUris.length
            ? imageUris
            : (passedTodo as any).imageUris || [],
          videoUris: videoUris.length
            ? videoUris
            : (passedTodo as any).videoUris || [],
          documentAttachments: attachedFiles.map((file) => ({
            name: file.name,
            uri: file.uri,
            mimeType: file.mimeType,
            size: file.size,
          })),
          voiceUri: voiceUri || (passedTodo as any).voiceUri,
          drawingUri: drawingUri || (passedTodo as any).drawingUri,
          drawingText,
        } as TodoItem;

        await saveLocalDuplicate(updatedLocalTodo);
        await clearSavedDraft();

        if (!mounted.current) return;

        // Electron / Web: React Native Alert button callbacks are not reliable
        // for navigation, so navigate directly after the local save succeeds.
        if (Platform.OS === "web") {
          router.push({
            pathname: "/viewlist",
            params: { from: "/cretenote" },
          });
          return;
        }

        // Android / iOS: keep the native success confirmation.
        showAlert(
          "Copy saved",
          "Your duplicate was saved on this device only.",
          [
            {
              text: "OK",
              onPress: () =>
                router.push({
                  pathname: "/viewlist",
                  params: { from: "/cretenote" },
                }),
            },
          ],
        );
        return;
      }

      // Build multipart data only for server-backed saves. This is async
      // because browser/Electron local URIs must be converted to Blob objects.
      const formData = await buildFormData(nowIso);

      const apiTodoId = todoId ? String(todoId) : undefined;

      const shouldUpdate = Boolean(
        isEditing && apiTodoId && !apiTodoId.startsWith("quick-note-"),
      );

      const url = shouldUpdate
        ? `${API_BASE_URL}/api/updateTodolist/${apiTodoId}`
        : `${API_BASE_URL}/api/createTodolist`;

      const response = shouldUpdate
        ? await axios.put<ApiResponse>(url, formData, {
            headers: { ...authHeader(token) },
            timeout: 20000,
          })
        : await axios.post<ApiResponse>(url, formData, {
            headers: { ...authHeader(token) },
            timeout: 20000,
          });

      if (response.data?.success !== true) {
        throw new Error(
          response.data?.message ||
            "The server did not confirm saving this Todo.",
        );
      }

      // Database save confirmed: clear the draft immediately.
      await clearSavedDraft();

      // Get the saved Todo returned by the backend.
      const responsePayload =
        response.data.todo ??
        response.data.task ??
        (response.data.data && typeof response.data.data === "object"
          ? (response.data.data as TodoItem)
          : undefined);

      const savedTodoId = String(
        responsePayload?.tdlId ??
          responsePayload?.id ??
          responsePayload?._id ??
          responsePayload?.todoId ??
          apiTodoId ??
          "",
      ).trim();

      // =====================================================
      // SAVE FOLDER ASSIGNMENT LOCALLY
      // Uses the existing organization metadata storage key.
      // Does not send folderId to the backend.
      // =====================================================
      if (folderId && savedTodoId) {
        try {
          const storageKey = "notes:organization-meta";

          const raw = await AsyncStorage.getItem(storageKey);

          const parsed: Record<string, any> = raw ? JSON.parse(raw) : {};

          // Preserve existing metadata for this Todo.
          parsed[savedTodoId] = {
            ...(parsed[savedTodoId] ?? {}),
            folderId,
          };

          await AsyncStorage.setItem(storageKey, JSON.stringify(parsed));

          console.log("[Folder] Todo assigned locally:", savedTodoId, folderId);
        } catch (folderError) {
          console.error(
            "[Folder] Failed to save folder assignment:",
            folderError,
          );
        }
      }

      // =====================================================
      // PERSIST NOTE APPEARANCE METADATA
      // =====================================================
      const persistedBackground =
        responsePayload?.backgroundImageUrl ||
        responsePayload?.backgroundImage ||
        noteBackgroundImageUri ||
        undefined;

      const appearanceMeta = {
        isQuickNote: false,
        quickNoteColor,
        notePattern,
        notebookStyle: defaultNotebookStyle,
        noteTextSize: defaultNoteTextSize,
        noteCornerStyle: defaultNoteCornerStyle,
        alignment,
        textColor: textColor,
        backgroundImageUri: persistedBackground,
        noteBackgroundImage: undefined,
        updatedAt: new Date().toISOString(),
      };

      const metaKeys = new Set<string>();

      if (savedTodoId) {
        metaKeys.add(`quick-note-meta:${savedTodoId}`);
      }

      if (title.trim()) {
        metaKeys.add(`quick-note-meta:${title.trim().toLowerCase()}`);
      }

      await Promise.all(
        [...metaKeys].map((key) =>
          AsyncStorage.setItem(key, JSON.stringify(appearanceMeta)),
        ),
      );

      // =====================================================
      // SCHEDULE REMINDER
      // =====================================================
      let reminderMessage = "";

      try {
        await scheduleLocalNotification(title.trim(), savedTodoId || null);

        reminderMessage = alarmDate
          ? "\nReminder scheduled successfully."
          : "\nNo reminder is set.";
      } catch (notificationError) {
        console.warn(
          "Todo reminder could not be scheduled:",
          notificationError,
        );

        reminderMessage =
          "\nTodo saved, but the reminder was not scheduled: " +
          getErrorMessage(notificationError);
      }

      if (!mounted.current) return;

      const successMessage =
        (isEditing
          ? "Your Todo and its selected theme/template settings were updated."
          : "Your Todo and its selected theme/template settings were saved to the database.") +
        reminderMessage;

      // Electron / Web: navigate immediately after the server confirms success.
      if (Platform.OS === "web") {
        router.push({
          pathname: "/viewlist",
          params: { from: "/cretenote" },
        });
        return;
      }

      // Android / iOS: preserve the native success alert.
      showAlert("Todo saved", successMessage, [
        {
          text: "OK",
          onPress: () => router.replace("/viewlist"),
        },
      ]);
    } catch (error) {
      console.error("[Todo] Save failed:", error);

      if (mounted.current) {
        showAlert("Save failed", getErrorMessage(error));
      }
    } finally {
      savingRef.current = false;

      if (mounted.current) {
        setLoading(false);
      }
    }
  }, [
    alarmDate,
    recurring,
    buildFormData,
    clearSavedDraft,
    dateText,
    dueDateTime,
    draftKey,
    isEditing,
    isRecording,
    scheduleLocalNotification,
    title,
    content,
    token,
    todoId,
    userId,
    quickNoteColor,
    notePattern,
    defaultNotebookStyle,
    defaultNoteTextSize,
    defaultNoteCornerStyle,
    noteBackgroundImageUri,
    folderId,
    textColor,
    alignment,
  ]);

  const clearReminder = useCallback(async () => {
    try {
      const stableTodoId = todoId ? String(todoId) : undefined;
      if (stableTodoId) await cancelTodoNotifications(stableTodoId);
      setAlarmDate(null);
      setRecurring("none");
      showAlert(
        "Reminder cleared",
        "The reminder has been removed from this Todo.",
      );
    } catch (error) {
      console.error("Unable to clear Todo reminder:", error);
      showAlert("Could not clear reminder", getErrorMessage(error));
    }
  }, [todoId, cancelTodoNotifications]);

  const clearImage = useCallback(() => {
    if (Platform.OS === "web") {
      webImageFiles.forEach(({ uri }) => URL.revokeObjectURL(uri));
    }
    setImageUris([]);
    setWebImageFiles([]);
  }, [webImageFiles]);

  const clearVoice = useCallback(async () => {
    try {
      await player.pause();
    } catch {}
    setVoiceUri(null);
    setPlayerError("");
  }, [player]);

  const cancel = useCallback(() => {
    if (loading) return;
    router.push({
      pathname: "/viewlist",
      params: { from: "/cretenote" },
    });
  }, [loading]);

  const formatButton = (
    label: "B" | "I" | "U",
    active: boolean,
    onPress: () => void,
    accessibilityLabel: string,
  ) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={[
        themeStyle(styles.formatButton),
        active && themeStyle(styles.formatButtonActive),
      ]}
    >
      <Text
        style={[
          themeStyle(styles.formatButtonText),
          label === "B" && themeStyle(styles.boldText),
          label === "I" && themeStyle(styles.italicText),
          label === "U" && themeStyle(styles.underlineText),
          active && themeStyle(styles.formatButtonTextActive),
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );

  if (initializing) {
    return (
      <SafeAreaView style={themeStyle(styles.loadingScreen)}>
        <ActivityIndicator size="large" color={personalAccentColor} />
        <Text style={themeStyle(styles.loadingText)}>
          Preparing your Todo...
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={themeStyle(styles.safeArea)}>
      <KeyboardAvoidingView
        style={themeStyle(uiStyles.flex)}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          style={themeStyle(uiStyles.screen)}
          contentContainerStyle={[
            themeStyle(uiStyles.scrollContent),
            {
              width: "100%",
              maxWidth: isDesktop ? (isWideDesktop ? 1480 : 1280) : 820,
              alignSelf: "center",
              paddingHorizontal: isDesktop
                ? isWideDesktop
                  ? 44
                  : 32
                : pageHorizontalPadding,
              paddingTop: isDesktop ? 28 : isShortScreen ? 8 : 14,
              paddingBottom: isDesktop ? 56 : isShortScreen ? 28 : 42,
            },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View
            style={[
              themeStyle(uiStyles.header),
              {
                backgroundColor: mintTheme.background,

                // Complete border on all four sides
                borderWidth: 1,
                borderColor: mintTheme.border,

                paddingHorizontal: isDesktop ? 24 : isNarrowPhone ? 10 : 14,
                paddingVertical: isDesktop ? 18 : isShortScreen ? 7 : 10,

                borderRadius: isDesktop ? 22 : 0,
                marginBottom: isDesktop ? 22 : 0,

                shadowColor: isDesktop ? "#173F38" : "transparent",
                shadowOffset: { width: 0, height: 5 },
                shadowOpacity: isDesktop ? 0.05 : 0,
                shadowRadius: 14,
                elevation: isDesktop ? 2 : 0,
              },
            ]}
          >
            <View
              style={[
                themeStyle(uiStyles.headerRow),
                {
                  flexDirection: "row",
                  alignItems: "center",
                  gap: isNarrowPhone ? 6 : 10,
                },
              ]}
            >
              {/* Back button */}
              <Pressable
                onPress={cancel}
                style={[
                  themeStyle(uiStyles.backButton),
                  {
                    width: isNarrowPhone ? 38 : 44,
                    height: isNarrowPhone ? 40 : 44,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: mintTheme.surface,
                    borderRadius: 14,
                    borderWidth: 1,
                    borderColor: mintTheme.border,
                  },
                ]}
                accessibilityRole="button"
                accessibilityLabel="Go back"
                hitSlop={8}
              >
                <Ionicons name="arrow-back" size={21} color={mintTheme.text} />
              </Pressable>

              {/* Title and subtitle */}
              <View
                style={[
                  themeStyle(uiStyles.headerCopy),
                  {
                    flex: 1,
                    minWidth: 0,
                  },
                ]}
              >
                <Text
                  style={[
                    themeStyle(uiStyles.headerTitle),
                    {
                      color: mintTheme.text,
                      fontSize: isNarrowPhone ? 16 : 18,
                      fontWeight: "700",
                    },
                  ]}
                  numberOfLines={1}
                >
                  {isEditing ? "Edit Note" : "Create Note"}
                </Text>

                <Text
                  style={[
                    themeStyle(uiStyles.headerSubtitle),
                    {
                      color: mintTheme.subtitle,
                      fontSize: 12,
                      marginTop: 3,
                    },
                  ]}
                  numberOfLines={1}
                >
                  Capture your thoughts
                </Text>
              </View>

              {/* View List button */}
              <Pressable
                onPress={() =>
                  router.push({
                    pathname: "/viewlist",
                    params: { from: "/cretenote" },
                  })
                }
                style={{
                  width: isNarrowPhone ? 36 : 42,
                  height: isNarrowPhone ? 40 : 44,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: mintTheme.surface,
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: mintTheme.border,
                }}
                accessibilityRole="button"
                accessibilityLabel="View Todo List"
                hitSlop={8}
              >
                <Ionicons
                  name="list-outline"
                  size={21}
                  color={mintTheme.primary}
                />
              </Pressable>

              {/* Delete Local Draft button */}
              <Pressable
                onPress={() =>
                  showAlert(
                    "Delete local draft?",
                    "This removes the autosaved draft on this device. A Todo already saved to the server will remain unchanged.",
                    [
                      {
                        text: "Cancel",
                        style: "cancel",
                      },
                      {
                        text: "Delete Draft",
                        style: "destructive",
                        onPress: () => void deleteLocalDraft(),
                      },
                    ],
                    { cancelable: true },
                  )
                }
                style={{
                  width: isNarrowPhone ? 36 : 42,
                  height: isNarrowPhone ? 40 : 44,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: "#FFF1F0",
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: "#F5D4D1",
                }}
                accessibilityRole="button"
                accessibilityLabel="Delete local draft"
                hitSlop={8}
              >
                <Ionicons name="trash-outline" size={20} color="#C74B45" />
              </Pressable>
            </View>
          </View>

          {isDesktop && (
            <View
              style={{
                backgroundColor: mintTheme.surface,
                borderColor: mintTheme.border,
                borderWidth: 1,
                borderRadius: 24,
                paddingHorizontal: 26,
                paddingVertical: 22,
                marginBottom: 20,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 20,
                shadowColor: "#173F38",
                shadowOffset: { width: 0, height: 5 },
                shadowOpacity: 0.035,
                shadowRadius: 14,
                elevation: 1,
              }}
            >
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text
                  style={{
                    color: mintTheme.primary,
                    fontSize: 11,
                    fontWeight: "800",
                    letterSpacing: 1.5,
                    marginBottom: 7,
                  }}
                >
                  PERSONAL WORKSPACE
                </Text>
                <Text
                  style={{
                    color: mintTheme.text,
                    fontSize: isWideDesktop ? 28 : 25,
                    fontWeight: "800",
                    letterSpacing: -0.6,
                  }}
                >
                  {isEditing
                    ? "Refine your note."
                    : "Make space for your ideas."}
                </Text>
                <Text
                  style={{
                    color: mintTheme.subtitle,
                    fontSize: 14,
                    lineHeight: 21,
                    marginTop: 7,
                  }}
                >
                  Write, organize and enrich your thoughts in one place.
                </Text>
              </View>
              <View
                style={{
                  width: 58,
                  height: 58,
                  borderRadius: 19,
                  backgroundColor: "#DDF4E8",
                  borderWidth: 1,
                  borderColor: mintTheme.border,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Ionicons
                  name="document-text-outline"
                  size={27}
                  color={mintTheme.primary}
                />
              </View>
            </View>
          )}

          {/* Responsive workspace: main editor column */}
          <View
            style={{
              width: "100%",
              flexDirection: isDesktop ? "row" : "column",
              alignItems: "flex-start",
              gap: isDesktop ? 24 : 0,
            }}
          >
            <View
              style={{
                flex: isDesktop ? 1 : undefined,
                width: isDesktop ? undefined : "100%",
                minWidth: 0,
                ...(isDesktop
                  ? {
                      padding: 22,
                      backgroundColor: mintTheme.surface,
                      borderWidth: 1,
                      borderColor: mintTheme.border,
                      borderRadius: 24,
                      shadowColor: "#173F38",
                      shadowOffset: { width: 0, height: 8 },
                      shadowOpacity: 0.045,
                      shadowRadius: 20,
                      elevation: 2,
                    }
                  : {}),
              }}
            >
              {/* Note Title Input */}
              <View
                style={[
                  themeStyle(uiStyles.titleField),
                  {
                    flexDirection: "row",
                    alignItems: "center",
                    backgroundColor: mintTheme.surface,
                    borderWidth: 1,
                    borderColor: mintTheme.border,
                    borderRadius: isDesktop ? 16 : 18,
                    paddingHorizontal: isNarrowPhone ? 9 : 14,
                    paddingVertical: isNarrowPhone ? 4 : 6,
                    minHeight: isNarrowPhone ? 54 : isDesktop ? 66 : 64,
                    gap: isNarrowPhone ? 7 : 12,
                    ...(isDesktop
                      ? {
                          shadowColor: "#173F38",
                          shadowOffset: { width: 0, height: 3 },
                          shadowOpacity: 0.025,
                          shadowRadius: 8,
                          elevation: 1,
                        }
                      : {}),
                  },
                ]}
              >
                {/* Pencil icon */}
                <View
                  style={{
                    width: isNarrowPhone ? 34 : 42,
                    height: isNarrowPhone ? 34 : 42,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: mintTheme.background,
                    borderRadius: 13,
                    borderWidth: 1,
                    borderColor: mintTheme.border,
                  }}
                >
                  <Ionicons
                    name="pencil-outline"
                    size={21}
                    color={mintTheme.primary}
                  />
                </View>

                {/* Title input */}
                <TextInput
                  value={title}
                  onChangeText={setTitle}
                  placeholder="Give your note a title..."
                  placeholderTextColor={mintTheme.subtitle}
                  maxLength={100}
                  style={[
                    themeStyle(uiStyles.titleInput),
                    {
                      flex: 1,
                      minWidth: 0,
                      color: mintTheme.text,
                      fontSize: isNarrowPhone ? 14 : 16,
                      fontWeight: "600",
                      paddingVertical: 10,
                    },
                  ]}
                  returnKeyType="next"
                  accessibilityLabel="Note title"
                />

                {/* Character counter */}
                <Text
                  style={[
                    themeStyle(uiStyles.counter),
                    {
                      color: mintTheme.subtitle,
                      fontSize: 11,
                      fontWeight: "600",
                      minWidth: isNarrowPhone ? 30 : 38,
                      textAlign: "right",
                    },
                  ]}
                >
                  {title.length}/100
                </Text>
              </View>

              <View
                style={[
                  themeStyle(styles.editorToolbar),
                  {
                    paddingHorizontal: isDesktop ? 14 : isNarrowPhone ? 5 : 9,
                    paddingVertical: isDesktop ? 12 : isNarrowPhone ? 6 : 9,
                    marginBottom: isDesktop ? 18 : isNarrowPhone ? 10 : 15,
                    borderRadius: isDesktop ? 16 : undefined,
                    backgroundColor: isDesktop ? "#FFFFFF" : undefined,
                    borderColor: isDesktop ? mintTheme.border : undefined,
                    borderWidth: isDesktop ? 1 : undefined,
                    width: "100%",
                    ...(isDesktop
                      ? {
                          shadowColor: "#173F38",
                          shadowOffset: { width: 0, height: 3 },
                          shadowOpacity: 0.025,
                          shadowRadius: 8,
                          elevation: 1,
                        }
                      : {}),
                  },
                ]}
              >
                {/* Row 1: Text styling */}
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                  contentContainerStyle={themeStyle(styles.toolbarRow)}
                >
                  <Text style={themeStyle(styles.toolbarLabel)}>STYLE</Text>
                  {formatButton("B", bold, () => setBold((v) => !v), "Bold")}
                  {formatButton(
                    "I",
                    italic,
                    () => setItalic((v) => !v),
                    "Italic",
                  )}
                  {formatButton(
                    "U",
                    underline,
                    () => setUnderline((v) => !v),
                    "Underline",
                  )}

                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Toggle strikethrough"
                    accessibilityState={{ selected: strikethrough }}
                    style={[
                      themeStyle(styles.toolButton),
                      strikethrough && themeStyle(styles.toolButtonActive),
                    ]}
                    onPress={() => setStrikethrough((value) => !value)}
                  >
                    <Text
                      style={[
                        themeStyle(styles.toolText),
                        { textDecorationLine: "line-through" },
                      ]}
                    >
                      S
                    </Text>
                  </Pressable>

                  <Pressable
                    style={themeStyle(styles.toolButton)}
                    onPress={() => setColorPaletteVisible(true)}
                    accessibilityRole="button"
                    accessibilityLabel="Open text color palette"
                  >
                    <Ionicons
                      name="color-palette-outline"
                      size={19}
                      color={textColor}
                    />
                  </Pressable>

                  <Pressable
                    style={themeStyle(styles.toolButton)}
                    onPress={() => setFontPickerVisible(true)}
                    accessibilityRole="button"
                    accessibilityLabel="Choose font family"
                  >
                    <Ionicons
                      name="text-outline"
                      size={19}
                      color={appTheme.secondaryText}
                    />
                  </Pressable>
                </ScrollView>

                <View style={themeStyle(styles.toolbarSeparator)} />

                {/* Row 2: Paragraph and lists */}
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                  contentContainerStyle={themeStyle(styles.toolbarRow)}
                >
                  <Text style={themeStyle(styles.toolbarLabel)}>PARAGRAPH</Text>

                  {/* Text Alignment */}
                  {(
                    [
                      ["left", "Align left", "menu-outline"],
                      ["center", "Align center", "reorder-three-outline"],
                      ["right", "Align right", "menu-outline"],
                    ] as const
                  ).map(([value, label, iconName]) => (
                    <Pressable
                      key={value}
                      accessibilityRole="button"
                      accessibilityLabel={label}
                      accessibilityState={{ selected: alignment === value }}
                      style={[
                        themeStyle(styles.toolButton),
                        alignment === value &&
                          themeStyle(styles.toolButtonActive),
                      ]}
                      onPress={() => setAlignment(value)}
                    >
                      <Ionicons
                        name={iconName}
                        size={19}
                        color={
                          alignment === value
                            ? personalAccentColor
                            : appTheme.secondaryText
                        }
                        style={
                          value === "right"
                            ? { transform: [{ scaleX: -1 }] }
                            : undefined
                        }
                      />
                    </Pressable>
                  ))}

                  {/* Normal Text */}
                  <Pressable
                    style={themeStyle(styles.toolButton)}
                    onPress={() => {
                      // Switch the editor to normal multiline typing without changing content.
                      setIsNormalTextMode(true);
                      setIsBulletMode(false);
                      setIsNumberedListMode(false);
                      setIsChecklistMode(false);
                      setListNumber(1);

                      setBold(false);
                      setItalic(false);
                      setUnderline(false);
                      setStrikethrough(false);

                      setAlignment("left");

                      // Keep the existing valid notebook style.
                      // Do not use setDefaultNotebookStyle("normal")
                      // unless "normal" is included in its TypeScript type.

                      requestAnimationFrame(() => {
                        requestAnimationFrame(() => {
                          contentInputRef.current?.focus();
                        });
                      });
                    }}
                    accessibilityRole="button"
                    accessibilityLabel="Normal text"
                  >
                    <Ionicons
                      name="text-outline"
                      size={19}
                      color={appTheme.secondaryText}
                    />
                    <Text style={themeStyle(styles.toolText)}>Normal Text</Text>
                  </Pressable>

                  {/* Bullet List */}
                  <Pressable
                    style={themeStyle(styles.toolButton)}
                    onPress={() => {
                      setIsNormalTextMode(true);
                      setIsNumberedListMode(false);
                      setIsChecklistMode(false);
                      setIsBulletMode(true);

                      // Current cursor position
                      const cursorPosition =
                        Math.min(selection.start, selection.end) + 2;

                      // Insert bullet
                      replaceSelection("• ");

                      // Move cursor after bullet
                      requestAnimationFrame(() => {
                        setSelection({
                          start: cursorPosition,
                          end: cursorPosition,
                        });

                        contentInputRef.current?.focus();
                      });
                    }}
                    accessibilityRole="button"
                    accessibilityLabel="Insert bullet list"
                  >
                    <Text style={themeStyle(styles.toolText)}>• List</Text>
                  </Pressable>

                  {/* Numbered List */}
                  <Pressable
                    style={themeStyle(styles.toolButton)}
                    onPress={() => {
                      setIsNormalTextMode(true);
                      setIsBulletMode(false);
                      setIsChecklistMode(false);
                      setIsNumberedListMode(true);
                      setListNumber(2);

                      replaceSelection("1. ");

                      requestAnimationFrame(() => {
                        contentInputRef.current?.focus();
                      });
                    }}
                    accessibilityRole="button"
                    accessibilityLabel="Insert numbered list"
                  >
                    <Text style={themeStyle(styles.toolText)}>1. List</Text>
                  </Pressable>

                  {/* Checklist Toggle Button */}

                  <Pressable
                    style={[
                      themeStyle(styles.toolButton),
                      isChecklistMode && {
                        backgroundColor: "#DDF7EC",
                        borderRadius: 10,
                      },
                    ]}
                    onPress={insertChecklist}
                    accessibilityRole="button"
                    accessibilityLabel="Insert checklist"
                  >
                    <Ionicons
                      name="checkbox-outline"
                      size={20}
                      color={appTheme.secondaryText}
                    />
                    <Text style={themeStyle(styles.toolText)}>Checklist</Text>
                  </Pressable>

                  {/* Reorder Checklist */}
                  <Pressable
                    style={themeStyle(styles.toolButton)}
                    onPress={openChecklistReorder}
                    accessibilityRole="button"
                    accessibilityLabel="Reorder checklist items"
                  >
                    <Ionicons
                      name="reorder-three-outline"
                      size={19}
                      color={appTheme.secondaryText}
                    />
                    <Text style={themeStyle(styles.toolText)}>Reorder</Text>
                  </Pressable>

                  {/* Decrease Indent */}
                  <Pressable
                    style={themeStyle(styles.toolButton)}
                    onPress={() => changeIndent("decrease")}
                    accessibilityRole="button"
                    accessibilityLabel="Decrease indent"
                  >
                    <Ionicons
                      name="return-up-back-outline"
                      size={18}
                      color={appTheme.secondaryText}
                    />
                  </Pressable>

                  {/* Increase Indent */}
                  <Pressable
                    style={themeStyle(styles.toolButton)}
                    onPress={() => changeIndent("increase")}
                    accessibilityRole="button"
                    accessibilityLabel="Increase indent"
                  >
                    <Ionicons
                      name="return-down-forward-outline"
                      size={18}
                      color={appTheme.secondaryText}
                    />
                  </Pressable>

                  {/* Spacing */}
                  <Pressable
                    style={themeStyle(styles.toolButton)}
                    onPress={() => setSpacingModalVisible(true)}
                    accessibilityRole="button"
                    accessibilityLabel="Adjust text spacing"
                  >
                    <Ionicons
                      name="menu-outline"
                      size={18}
                      color={appTheme.secondaryText}
                    />
                    <Text style={themeStyle(styles.spacingButtonLabel)}>
                      Spacing
                    </Text>
                  </Pressable>
                </ScrollView>

                {/* Checklist Reorder Panel */}
                {reorderChecklistVisible && (
                  <View
                    style={{
                      marginVertical: 12,
                      padding: 12,
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: appTheme.primary,
                      backgroundColor: appTheme.surface,
                    }}
                  >
                    <Text
                      style={{
                        color: appTheme.text,
                        fontSize: 17,
                        fontWeight: "700",
                        marginBottom: 10,
                      }}
                    >
                      Reorder Checklist Items
                    </Text>

                    {reorderChecklistItems.length === 0 ? (
                      <Text style={{ color: mintTheme.subtitle }}>
                        No checkbox items found in your note.
                      </Text>
                    ) : (
                      <DraggableFlatList
                        data={reorderChecklistItems}
                        keyExtractor={(item) => item.id}
                        activationDistance={8}
                        scrollEnabled={false}
                        onDragEnd={({ data }) => {
                          saveChecklistReorder(data);
                        }}
                        renderItem={({ item, drag, isActive }) => (
                          <ScaleDecorator>
                            <View
                              style={{
                                flexDirection: "row",
                                alignItems: "center",
                                padding: 8,
                                marginBottom: 6,
                                borderRadius: 8,
                                backgroundColor: isActive
                                  ? `${appTheme.primary}20`
                                  : appTheme.surface,
                              }}
                            >
                              <Pressable
                                onPress={() => {
                                  const updated = reorderChecklistItems.map(
                                    (entry) =>
                                      entry.id === item.id
                                        ? {
                                            ...entry,
                                            checked: !entry.checked,
                                          }
                                        : entry,
                                  );

                                  saveChecklistReorder(updated);
                                }}
                                accessibilityRole="checkbox"
                                accessibilityState={{
                                  checked: item.checked,
                                }}
                              >
                                <Ionicons
                                  name={
                                    item.checked ? "checkbox" : "square-outline"
                                  }
                                  size={23}
                                  color={appTheme.primary}
                                />
                              </Pressable>

                              <Text
                                style={{
                                  flex: 1,
                                  marginHorizontal: 10,
                                  color: appTheme.text,
                                  textDecorationLine: item.checked
                                    ? "line-through"
                                    : "none",
                                }}
                              >
                                {item.text || "Untitled item"}
                              </Text>

                              <Pressable
                                onLongPress={drag}
                                delayLongPress={150}
                                disabled={isActive}
                                accessibilityRole="button"
                                accessibilityLabel={`Move ${item.text}`}
                                hitSlop={8}
                                style={{ padding: 6 }}
                              >
                                <Ionicons
                                  name="reorder-three-outline"
                                  size={25}
                                  color={appTheme.secondaryText}
                                />
                              </Pressable>
                            </View>
                          </ScaleDecorator>
                        )}
                      />
                    )}

                    <Pressable
                      onPress={() => setReorderChecklistVisible(false)}
                      style={{
                        alignSelf: "flex-end",
                        marginTop: 10,
                        paddingHorizontal: 16,
                        paddingVertical: 9,
                        borderRadius: 8,
                        backgroundColor: appTheme.primary,
                      }}
                    >
                      <Text
                        style={{
                          color: "#FFFFFF",
                          fontWeight: "600",
                        }}
                      >
                        Done
                      </Text>
                    </Pressable>
                  </View>
                )}

                <View style={themeStyle(styles.toolbarSeparator)} />

                {/* Row 3: Editing tools */}
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                  contentContainerStyle={themeStyle(styles.toolbarRow)}
                >
                  <Text style={themeStyle(styles.toolbarLabel)}>EDIT</Text>

                  <Pressable
                    style={themeStyle(styles.toolButton)}
                    onPress={undoEdit}
                    accessibilityRole="button"
                    accessibilityLabel="Undo"
                  >
                    <Ionicons
                      name="arrow-undo-outline"
                      size={18}
                      color={appTheme.secondaryText}
                    />
                  </Pressable>

                  <Pressable
                    style={themeStyle(styles.toolButton)}
                    onPress={redoEdit}
                    accessibilityRole="button"
                    accessibilityLabel="Redo"
                  >
                    <Ionicons
                      name="arrow-redo-outline"
                      size={18}
                      color={appTheme.secondaryText}
                    />
                  </Pressable>

                  <Pressable
                    style={themeStyle(styles.toolButton)}
                    onPress={() => void copyContent()}
                    accessibilityRole="button"
                    accessibilityLabel="Copy"
                  >
                    <Ionicons
                      name="copy-outline"
                      size={18}
                      color={appTheme.secondaryText}
                    />
                  </Pressable>

                  <Pressable
                    style={themeStyle(styles.toolButton)}
                    onPress={() => void pasteContent()}
                    accessibilityRole="button"
                    accessibilityLabel="Paste"
                  >
                    <Ionicons
                      name="clipboard-outline"
                      size={18}
                      color={appTheme.secondaryText}
                    />
                  </Pressable>

                  <Pressable
                    style={themeStyle(styles.toolButton)}
                    onPress={() => void cutSelection()}
                    accessibilityRole="button"
                    accessibilityLabel="Cut"
                  >
                    <Ionicons
                      name="cut-outline"
                      size={18}
                      color={appTheme.secondaryText}
                    />
                  </Pressable>

                 <Pressable
  style={themeStyle(styles.toolButton)}
  onPress={() => {
    const fullLength = content.length;
    const range = {
      start: 0,
      end: fullLength,
    };

    // Update React Native selection state
    setSelection(range);

    // Focus the editor
    contentInputRef.current?.focus();

    // Apply selection after the desktop editor receives focus
    requestAnimationFrame(() => {
      const input = contentInputRef.current as any;

      if (input?.setSelectionRange) {
        input.setSelectionRange(0, fullLength);
      } else if (input?.getNode?.()?.setSelectionRange) {
        input.getNode().setSelectionRange(0, fullLength);
      } else {
        input?.setNativeProps?.({
          selection: range,
        });
      }
    });
  }}
  accessibilityRole="button"
  accessibilityLabel="Select all"
>
  <Ionicons
    name="scan-outline"
    size={18}
    color={appTheme.secondaryText}
  />
</Pressable>

                  <Pressable
                    style={themeStyle(styles.toolButton)}
                    onPress={insertHyperlink}
                    accessibilityRole="button"
                    accessibilityLabel="Insert hyperlink"
                  >
                    <Ionicons
                      name="link-outline"
                      size={18}
                      color={appTheme.secondaryText}
                    />
                  </Pressable>

                  <Pressable
                    style={themeStyle(styles.toolButton)}
                    onPress={() => void openFirstHyperlink()}
                    accessibilityRole="button"
                    accessibilityLabel="Open URL"
                  >
                    <Ionicons
                      name="open-outline"
                      size={18}
                      color={appTheme.secondaryText}
                    />
                  </Pressable>

                  <View style={themeStyle(styles.fontSizeControl)}>
                    <Pressable
                      onPress={() => setFontSize((v) => Math.max(12, v - 1))}
                      accessibilityRole="button"
                      accessibilityLabel="Decrease font size"
                      disabled={fontSize <= 12}
                      hitSlop={8}
                      style={({ pressed }) => [
                        styles.fontSizeButton,
                        fontSize <= 12 && styles.fontSizeButtonDisabled,
                        pressed &&
                          fontSize > 12 &&
                          styles.fontSizeButtonPressed,
                      ]}
                    >
                      <Ionicons
                        name="remove"
                        size={18}
                        color={fontSize <= 12 ? "#A8B5AE" : "#287653"}
                      />
                    </Pressable>

                    <View style={styles.fontSizeValueBox}>
                      <Text style={themeStyle(styles.fontSizeText)}>
                        {fontSize}
                      </Text>
                      <Text style={styles.fontSizeUnit}>px</Text>
                    </View>

                    <Pressable
                      onPress={() => setFontSize((v) => Math.min(24, v + 1))}
                      accessibilityRole="button"
                      accessibilityLabel="Increase font size"
                      disabled={fontSize >= 24}
                      hitSlop={8}
                      style={({ pressed }) => [
                        styles.fontSizeButton,
                        fontSize >= 24 && styles.fontSizeButtonDisabled,
                        pressed &&
                          fontSize < 24 &&
                          styles.fontSizeButtonPressed,
                      ]}
                    >
                      <Ionicons
                        name="add"
                        size={18}
                        color={fontSize >= 24 ? "#A8B5AE" : "#287653"}
                      />
                    </Pressable>
                  </View>

                  <Text
                    style={[
                      themeStyle(styles.characterCount),
                      content.length === 0 &&
                        themeStyle(styles.characterCountEmpty),
                      content.length > 500 &&
                        themeStyle(styles.characterCountWarning),
                      content.length > 1000 &&
                        themeStyle(styles.characterCountLimit),
                    ]}
                  >
                    {content.length} characters
                  </Text>
                </ScrollView>
              </View>

              <View
                collapsable={false}
                style={[
                  themeStyle(uiStyles.contentField),
                  {
                    backgroundColor: quickNoteColor,
                    borderColor:
                      defaultNotebookStyle === "minimal"
                        ? "transparent"
                        : defaultNotebookStyle === "journal"
                          ? `${personalAccentColor}99`
                          : `${personalAccentColor}55`,
                    borderWidth:
                      defaultNotebookStyle === "minimal"
                        ? 0
                        : defaultNotebookStyle === "journal"
                          ? 1.5
                          : 1,
                    borderLeftWidth:
                      defaultNotebookStyle === "journal" ? 5 : undefined,
                    padding: isDesktop ? 24 : isNarrowPhone ? 10 : 14,
                    paddingLeft: isDesktop
                      ? defaultNotebookStyle === "journal"
                        ? 28
                        : 24
                      : isNarrowPhone
                        ? defaultNotebookStyle === "journal"
                          ? 14
                          : 10
                        : defaultNotebookStyle === "journal"
                          ? 18
                          : 14,
                    paddingBottom: isDesktop ? 48 : isNarrowPhone ? 32 : 38,
                    minHeight: isDesktop ? 580 : undefined,
                    width: "100%",
                    borderRadius:
                      defaultNoteCornerStyle === "square"
                        ? 4
                        : defaultNoteCornerStyle === "soft"
                          ? 24
                          : 14,
                    shadowColor:
                      defaultNotebookStyle === "classic"
                        ? "#24483B"
                        : "transparent",
                    shadowOffset: {
                      width: 0,
                      height: defaultNotebookStyle === "classic" ? 3 : 0,
                    },
                    shadowOpacity: defaultNotebookStyle === "classic" ? 0.1 : 0,
                    shadowRadius: defaultNotebookStyle === "classic" ? 7 : 0,
                    elevation: defaultNotebookStyle === "classic" ? 2 : 0,
                    position: "relative",
                    overflow: "hidden",
                  },
                ]}
              >
                {/* Background image */}
                {noteBackgroundImageUri ? (
                  <Image
                    pointerEvents="none"
                    source={{ uri: noteBackgroundImageUri }}
                    resizeMode="cover"
                    style={[
                      StyleSheet.absoluteFillObject,
                      {
                        zIndex: 0,
                      },
                    ]}
                  />
                ) : (
                  /* Selected theme pattern - visible before saving */
                  <NotePattern
                    pattern={notePattern}
                    ink={
                      quickNoteColor.toLowerCase() === "#25283d" ||
                      quickNoteColor.toLowerCase() === "#303a63"
                        ? "rgba(255,255,255,0.55)"
                        : "rgba(65,94,82,0.40)"
                    }
                  />
                )}

                {/* Text input layer */}
                <View
                  pointerEvents="box-none"
                  style={{
                    flex: 1,
                    minHeight: 190,
                    zIndex: 1,
                    flexDirection: "row",
                    alignItems: "stretch",
                    backgroundColor: "transparent",
                  }}
                >
                  {showChecklistEditor ? (
                    <View
                      style={{
                        flex: 1,
                        minHeight: 190,
                        backgroundColor: "transparent",
                      }}
                    >
                      {checklistLines.map((line, index) => {
                        const match = line.match(/^(\s*)(☐|☑)(?:\uFE0F)?(\s?)(.*)$/);
                        const checked = match?.[2] === "☑";
                        const prefixLength = match
                          ? match[1].length + 1 + match[3].length
                          : 0;
                        const lineStart = checklistLines
                          .slice(0, index)
                          .reduce(
                            (total, previousLine) =>
                              total + previousLine.length + 1,
                            0,
                          );
                        const inputValue = match ? match[4] : line;

                        return (
                          <View
                            key={`checklist-line-${index}`}
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                              minHeight: Math.max(38, lineSpacing + 8),
                              width: "100%",
                            }}
                          >
                            {match ? (
                              <Pressable
                                onPress={() => toggleChecklistItem(index)}
                                accessibilityRole="checkbox"
                                accessibilityLabel={`Mark ${inputValue || "checklist item"} ${
                                  checked ? "incomplete" : "complete"
                                }`}
                                accessibilityState={{ checked }}
                                hitSlop={8}
                                style={{
                                  width: 34,
                                  minHeight: 40,
                                  alignItems: "center",
                                  justifyContent: "center",
                                }}
                              >
                                <Ionicons
                                  name={checked ? "checkbox" : "square-outline"}
                                  size={22}
                                  color={
                                    checked
                                      ? appTheme.primary
                                      : appTheme.secondaryText
                                  }
                                />
                              </Pressable>
                            ) : null}

                           <TextInput
  key={`${fontFamily ?? "System"}-${index}`}
  ref={(ref) => {
    checklistInputRefs.current[index] = ref;
  }}
  value={inputValue}
  onChangeText={(value) =>
    updateChecklistLine(index, value)
  }
  onKeyPress={(event) =>
    handleChecklistKeyPress(index, event)
  }
  onSelectionChange={(event) => {
    const local = event.nativeEvent.selection;

    setSelection({
      start: lineStart + prefixLength + local.start,
      end: lineStart + prefixLength + local.end,
    });
  }}
  onSubmitEditing={() =>
    addChecklistItemAfter(index)
  }
  placeholder={match ? "Add checklist item..." : ""}
  placeholderTextColor="#84918B"
  multiline={false}
  maxLength={2000}
  returnKeyType="next"
  blurOnSubmit={false}
  autoCapitalize="sentences"
  underlineColorAndroid="transparent"
  style={[
    themeStyle(uiStyles.contentInput),
    {
      flex: 1,
      minWidth: 0,
      minHeight: Math.max(38, lineSpacing + 8),
      padding: 0,
      paddingTop: 0,
      backgroundColor: "transparent",
      color: textColor,
      fontSize,
      fontWeight: bold ? "700" : "400",
      fontStyle:
        defaultNotebookStyle === "journal" || italic
          ? "italic"
          : "normal",
      textDecorationLine: checked
        ? "line-through"
        : underline
          ? "underline"
          : strikethrough
            ? "line-through"
            : "none",
      fontFamily:
        fontFamily && fontFamily !== "System"
          ? fontFamily
          : defaultNotebookStyle === "journal"
            ? "serif"
            : undefined,
      textAlign: alignment,
      lineHeight: lineSpacing,
      letterSpacing,
    },
  ]}
/>
                          </View>
                        );
                      })}
                    </View>
                  ) : (
                    <TextInput
                      ref={contentInputRef}
                      value={content}
                      onChangeText={handleContentChange}
                      onSelectionChange={(event) => {
                        setSelection(event.nativeEvent.selection);
                      }}
                      placeholder="Write your note here..."
                      placeholderTextColor="#84918B"
                      multiline
                      maxLength={2000}
                      textAlignVertical="top"
                      autoCapitalize="sentences"
                      underlineColorAndroid="transparent"
                      style={[
                        themeStyle(uiStyles.contentInput),
                        {
                          flex: 1,
                          minWidth: 0,
                          minHeight: 190,
                          padding: 0,
                          paddingTop: 0,
                          backgroundColor: "transparent",
                          color: textColor,
                          fontSize,

                          fontWeight: bold ? "700" : "400",
                          fontStyle:
                            defaultNotebookStyle === "journal" || italic
                              ? "italic"
                              : "normal",
                          textDecorationLine: underline
                            ? "underline"
                            : strikethrough
                              ? "line-through"
                              : "none",
                          fontFamily:
                            !fontFamily || fontFamily === "System"
                              ? undefined
                              : fontFamily,
                          textAlign: alignment,
                          lineHeight: lineSpacing,
                          letterSpacing,
                        },
                      ]}
                    />
                  )}
                </View>

                {/* Character counter */}
                <Text
                  pointerEvents="none"
                  style={[
                    themeStyle(uiStyles.contentCounter),
                    {
                      zIndex: 2,
                    },
                  ]}
                >
                  {content.length}/2000
                </Text>
              </View>

           
<View
  style={[
    themeStyle(uiStyles.contentMetrics),
    {
      flexWrap: "wrap",
      rowGap: 6,
      columnGap: isNarrowPhone ? 6 : 10,
    },
  ]}
>
  <View style={themeStyle(uiStyles.metricPill)}>
    <Ionicons
      name="document-text-outline"
      size={15}
      color="#16866D"
    />
    <Text style={themeStyle(uiStyles.metricText)}>
      {
        content
          .replace(/(^|\n)\s*[☐☑]\s*/g, "$1")
          .trim()
          .split(/\s+/)
          .filter(Boolean).length
      }{" "}
      words
    </Text>
  </View>

  <View style={themeStyle(uiStyles.metricPill)}>
    <Ionicons
      name="text-outline"
      size={15}
      color="#16866D"
    />
    <Text style={themeStyle(uiStyles.metricText)}>
      {content.length} characters
    </Text>
  </View>
</View>

            </View>

            {/* Desktop sidebar: attachments, scheduling and save actions */}
            <View
              style={{
                width: isDesktop ? 340 : "100%",
                maxWidth: isDesktop ? 380 : undefined,
                flexShrink: 0,
                gap: isDesktop ? 14 : 0,
                marginTop: isDesktop ? 0 : 16,
                ...(isDesktop
                  ? {
                      padding: 18,
                      backgroundColor: mintTheme.surface,
                      borderWidth: 1,
                      borderColor: mintTheme.border,
                      borderRadius: 24,
                      shadowColor: "#173F38",
                      shadowOffset: { width: 0, height: 8 },
                      shadowOpacity: 0.04,
                      shadowRadius: 18,
                      elevation: 2,
                    }
                  : {}),
              }}
            >
              {isDesktop ? (
                <View style={{ marginBottom: 2 }}>
                  <Text
                    style={{
                      color: mintTheme.primary,
                      fontSize: 11,
                      fontWeight: "800",
                      letterSpacing: 1.4,
                    }}
                  >
                    TASK DETAILS
                  </Text>
                  <Text
                    style={{
                      color: mintTheme.text,
                      fontSize: 19,
                      fontWeight: "800",
                      marginTop: 5,
                    }}
                  >
                    Organize your note
                  </Text>
                  <Text
                    style={{
                      color: mintTheme.subtitle,
                      fontSize: 12,
                      marginTop: 4,
                      lineHeight: 18,
                    }}
                  >
                    Schedule, personalize and add files.
                  </Text>
                </View>
              ) : null}

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Open attachment options"
                onPress={() => setAttachmentModalVisible(true)}
                style={({ pressed }) => [
                  themeStyle(uiStyles.attachmentLauncher),
                  pressed && themeStyle(uiStyles.attachmentLauncherPressed),
                ]}
              >
                <View style={themeStyle(uiStyles.attachmentLauncherIcon)}>
                  <Ionicons name="attach-outline" size={24} color="#07876E" />
                </View>
                <View style={themeStyle(uiStyles.attachmentLauncherCopy)}>
                  <Text style={themeStyle(uiStyles.attachmentLauncherTitle)}>
                    Add attachment
                  </Text>
                  <Text style={themeStyle(uiStyles.attachmentLauncherSubtitle)}>
                    Image, video, voice, handwriting or file
                  </Text>
                </View>
                <View style={themeStyle(uiStyles.attachmentLauncherAction)}>
                  <Ionicons name="add" size={23} color="#FFFFFF" />
                </View>
              </Pressable>

              {existingAttachments.length > 0 ||
              imageUris.length > 0 ||
              videoUris.length > 0 ||
              attachedFiles.length > 0 ||
              voiceUri ||
              drawingUri ? (
                <View style={themeStyle(uiStyles.attachmentTray)}>
                  {existingAttachments.map((attachment, index) => {
                    const normalizedType = attachment.type.toLowerCase().trim();
                    const isImage =
                      normalizedType.startsWith("image/") ||
                      normalizedType === "image" ||
                      /\\.(jpg|jpeg|png|webp|gif|bmp|heic|heif|avif)$/i.test(
                        attachment.name,
                      );
                    const isVideo =
                      normalizedType.startsWith("video/") ||
                      normalizedType === "video" ||
                      /\\.(mp4|mov|webm|m4v|avi)$/i.test(attachment.name);
                    const isAudio =
                      normalizedType.startsWith("audio/") ||
                      normalizedType === "audio" ||
                      /\\.(mp3|m4a|aac|wav|ogg|opus)$/i.test(attachment.name);

                    return (
                      <Pressable
                        key={`existing-attachment-${attachment.id}-${index}`}
                        style={[
                          themeStyle(uiStyles.attachmentPreview),
                          !isImage && themeStyle(uiStyles.filePreview),
                          {
                            backgroundColor: isImage
                              ? "#E5F8F2"
                              : isVideo
                                ? "#F0EAFE"
                                : isAudio
                                  ? "#FDE9F2"
                                  : "#EEF3F1",
                          },
                        ]}
                        onPress={() => {
                          void Linking.openURL(attachment.uri).catch(() => {
                            showAlert(
                              "Unable to open attachment",
                              "The saved attachment could not be opened.",
                            );
                          });
                        }}
                        accessibilityRole="button"
                        accessibilityLabel={`Open saved attachment ${attachment.name}`}
                      >
                        {isImage ? (
                          <Image
                            source={{ uri: attachment.uri }}
                            style={themeStyle(uiStyles.previewImage)}
                            resizeMode="cover"
                            onError={(event) =>
                              console.warn(
                                "[Edit] Saved image attachment failed to load:",
                                event.nativeEvent.error,
                              )
                            }
                          />
                        ) : (
                          <Ionicons
                            name={
                              isVideo
                                ? "videocam"
                                : isAudio
                                  ? "musical-notes"
                                  : "document-text"
                            }
                            size={30}
                            color={
                              isVideo
                                ? "#7850CB"
                                : isAudio
                                  ? "#D92B70"
                                  : "#16866A"
                            }
                          />
                        )}
                        <Text
                          numberOfLines={2}
                          style={themeStyle(uiStyles.previewLabel)}
                        >
                          {attachment.name === `Attachment ${index + 1}`
                            ? isImage
                              ? "Saved image"
                              : isVideo
                                ? "Saved video"
                                : isAudio
                                  ? "Saved audio"
                                  : "Saved file"
                            : attachment.name}
                        </Text>
                      </Pressable>
                    );
                  })}
                  {imageUris.map((uri, index) => (
                    <View
                      key={`new-image-${uri}-${index}`}
                      style={themeStyle(uiStyles.attachmentPreview)}
                    >
                      <Image
                        source={{ uri }}
                        style={themeStyle(uiStyles.previewImage)}
                        resizeMode="cover"
                      />
                      <Text
                        numberOfLines={1}
                        style={themeStyle(uiStyles.previewLabel)}
                      >
                        Image {index + 1}
                      </Text>
                      <Pressable
                        style={themeStyle(uiStyles.removeAttachment)}
                        onPress={() => {
                          if (
                            Platform.OS === "web" &&
                            uri.startsWith("blob:")
                          ) {
                            URL.revokeObjectURL(uri);
                          }
                          setImageUris((previous) =>
                            previous.filter((item) => item !== uri),
                          );
                          setWebImageFiles((previous) =>
                            previous.filter((item) => item.uri !== uri),
                          );
                        }}
                        accessibilityRole="button"
                        accessibilityLabel={`Remove image ${index + 1}`}
                      >
                        <Ionicons name="close" size={17} color="#243B43" />
                      </Pressable>
                    </View>
                  ))}

                  {videoUris.map((uri, index) => (
                    <View
                      key={`new-video-${uri}-${index}`}
                      style={[
                        themeStyle(uiStyles.attachmentPreview),
                        themeStyle(uiStyles.filePreview),
                        { backgroundColor: "#F0EAFE" },
                      ]}
                    >
                      <Ionicons name="play-circle" size={35} color="#7850CB" />
                      <Text
                        numberOfLines={2}
                        style={themeStyle(uiStyles.previewLabel)}
                      >
                        Video {index + 1}
                      </Text>
                      <Pressable
                        style={themeStyle(uiStyles.removeAttachment)}
                        onPress={() => {
                          if (
                            Platform.OS === "web" &&
                            uri.startsWith("blob:")
                          ) {
                            URL.revokeObjectURL(uri);
                          }
                          setVideoUris((previous) =>
                            previous.filter((item) => item !== uri),
                          );
                          setWebVideoFiles((previous) =>
                            previous.filter((item) => item.uri !== uri),
                          );
                        }}
                        accessibilityRole="button"
                        accessibilityLabel={`Remove video ${index + 1}`}
                      >
                        <Ionicons name="close" size={17} color="#243B43" />
                      </Pressable>
                    </View>
                  ))}

                  {attachedFiles.map((file, index) => (
                    <Pressable
                      key={`new-document-${file.uri}-${index}`}
                      style={[
                        themeStyle(uiStyles.attachmentPreview),
                        themeStyle(uiStyles.filePreview),
                        { backgroundColor: "#FFF0E5" },
                      ]}
                      onPress={() => {
                        void Linking.openURL(file.uri).catch(() => {
                          showAlert(
                            "Unable to open file",
                            `Could not open ${file.name}.`,
                          );
                        });
                      }}
                      accessibilityRole="button"
                      accessibilityLabel={`Open ${file.name}`}
                    >
                      <Ionicons
                        name="document-text"
                        size={30}
                        color="#F57917"
                      />
                      <Text
                        numberOfLines={2}
                        style={themeStyle(uiStyles.previewLabel)}
                      >
                        {file.name || `Document ${index + 1}`}
                      </Text>
                      <Pressable
                        style={themeStyle(uiStyles.removeAttachment)}
                        onPress={() =>
                          setAttachedFiles((previous) =>
                            previous.filter((item) => item.uri !== file.uri),
                          )
                        }
                        accessibilityRole="button"
                        accessibilityLabel={`Remove ${file.name}`}
                      >
                        <Ionicons name="close" size={17} color="#243B43" />
                      </Pressable>
                    </Pressable>
                  ))}
                  {voiceUri ? (
                    <View
                      style={[
                        themeStyle(uiStyles.attachmentPreview),
                        themeStyle(uiStyles.filePreview),
                        { backgroundColor: "#FDE9F2" },
                      ]}
                    >
                      <Pressable
                        onPress={() => {
                          void togglePlayback();
                        }}
                        hitSlop={10}
                        accessibilityRole="button"
                        accessibilityLabel={
                          playerStatus.playing
                            ? "Pause voice note"
                            : "Play voice note"
                        }
                      >
                        <Ionicons
                          name={
                            playerStatus.playing
                              ? "pause-circle"
                              : "play-circle"
                          }
                          size={32}
                          color="#D92B70"
                        />
                      </Pressable>

                      <Text style={themeStyle(uiStyles.previewLabel)}>
                        {playerStatus.playing
                          ? "Playing voice note"
                          : "Voice note"}
                      </Text>

                      <Pressable
                        style={themeStyle(uiStyles.removeAttachment)}
                        onPress={() => setVoiceUri(null)}
                        hitSlop={8}
                      >
                        <Ionicons name="close" size={17} color="#243B43" />
                      </Pressable>
                    </View>
                  ) : null}
                  {drawingUri ? (
                    <View style={themeStyle(uiStyles.attachmentPreview)}>
                      <Image
                        source={{ uri: drawingUri }}
                        style={themeStyle(uiStyles.previewImage)}
                      />
                      <Pressable
                        style={themeStyle(uiStyles.removeAttachment)}
                        onPress={() => setDrawingUri(null)}
                      >
                        <Ionicons name="close" size={17} color="#243B43" />
                      </Pressable>
                    </View>
                  ) : null}
                  <Pressable
                    style={[
                      themeStyle(uiStyles.attachmentPreview),
                      themeStyle(uiStyles.addMore),
                    ]}
                    onPress={() => void pickImage()}
                  >
                    <Ionicons name="add" size={34} color="#64748B" />
                    <Text style={themeStyle(uiStyles.previewLabel)}>
                      Add More
                    </Text>
                  </Pressable>
                </View>
              ) : null}

              <View style={themeStyle(uiStyles.settingsGrid)}>
                {/* Due Date & Time */}
                <SettingTile
                  icon="calendar-outline"
                  title="Due Date & Time"
                  subtitle={`${formattedDate || "Choose date"} · ${dueDateTime.toLocaleTimeString(
                    [],
                    { hour: "2-digit", minute: "2-digit" },
                  )}`}
                  tint="#18A98B"
                  bg="#E9F9F3"
                  onPress={openDatePicker}
                />

                {/* Note Theme */}
                <SettingTile
                  icon="color-palette-outline"
                  title="Note Theme"
                  subtitle={`${
                    (
                      {
                        "#FFF4CC": "Warm",
                        "#DDF7E8": "Fresh",
                        "#DDEBFF": "Ocean",
                        "#FCE1EE": "Blush",
                        "#EDE2FF": "Lavender",
                        "#FFFFFF": "Classic",
                      } as Record<string, string>
                    )[quickNoteColor] || "Custom"
                  } · ${
                    notePattern.charAt(0).toUpperCase() + notePattern.slice(1)
                  }`}
                  tint="#1686E8"
                  bg="#E8F4FF"
                  onPress={openNoteThemePicker}
                />

                {/* Template */}
                <SettingTile
                  icon="albums-outline"
                  title="Template"
                  subtitle="Daily plan, checklist or journal"
                  tint="#0D8B78"
                  bg="#E5F8F2"
                  onPress={openNoteTemplatePicker}
                />
              </View>

              {/* Reminder + Repeat in one card */}
              <View
                style={[
                  uiStyles.reminderCard,
                  {
                    backgroundColor: appTheme.surface,
                    borderColor: appTheme.border,
                  },
                ]}
              >
                <Pressable
                  onPress={openReminderPicker}
                  accessibilityRole="button"
                  accessibilityLabel="Set reminder date and time"
                  style={uiStyles.reminderHeader}
                >
                  <View
                    style={[
                      uiStyles.reminderIcon,
                      { backgroundColor: "#FFF1E5" },
                    ]}
                  >
                    <Ionicons
                      name="notifications-outline"
                      size={21}
                      color="#E87924"
                    />
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text
                      style={[
                        uiStyles.reminderTitle,
                        { color: mintTheme.text },
                      ]}
                    >
                      Reminder
                    </Text>

                    <Text
                      style={[
                        uiStyles.reminderSubtitle,
                        { color: mintTheme.subtitle },
                      ]}
                    >
                      {alarmDate
                        ? toAlarmLabel(alarmDate)
                        : new Date().toLocaleString([], {
                            dateStyle: "medium",
                            timeStyle: "short",
                          })}
                    </Text>
                  </View>

                  <Ionicons
                    name="chevron-forward"
                    size={18}
                    color={appTheme.secondaryText}
                  />
                </Pressable>

                <View
                  style={[
                    uiStyles.reminderDivider,
                    { backgroundColor: appTheme.border },
                  ]}
                />

                <View style={uiStyles.repeatHeader}>
                  <Ionicons name="repeat-outline" size={18} color="#E87924" />

                  <Text
                    style={[uiStyles.repeatTitle, { color: mintTheme.text }]}
                  >
                    Repeat reminder
                  </Text>

                  <View style={{ flex: 1 }} />

                  <Text
                    style={[
                      uiStyles.repeatCurrent,
                      { color: personalAccentColor },
                    ]}
                  >
                    {
                      {
                        none: "Never",
                        daily: "Daily",
                        weekly: "Weekly",
                        monthly: "Monthly",
                      }[recurring]
                    }
                  </Text>
                </View>

                <View style={uiStyles.recurringOptions}>
                  {(
                    [
                      { label: "Never", value: "none" },
                      { label: "Daily", value: "daily" },
                      { label: "Weekly", value: "weekly" },
                      { label: "Monthly", value: "monthly" },
                    ] as const
                  ).map((option) => {
                    const selected = recurring === option.value;
                    const disabled = !alarmDate && option.value !== "none";

                    return (
                      <Pressable
                        key={option.value}
                        accessibilityRole="button"
                        accessibilityState={{ selected, disabled }}
                        disabled={disabled}
                        onPress={() => setRecurring(option.value)}
                        style={[
                          uiStyles.recurringOption,
                          {
                            borderColor: selected
                              ? personalAccentColor
                              : appTheme.border,
                            backgroundColor: selected
                              ? `${personalAccentColor}18`
                              : appTheme.background,
                          },
                          disabled && { opacity: 0.45 },
                        ]}
                      >
                        {selected && (
                          <Ionicons
                            name="checkmark-circle"
                            size={14}
                            color={personalAccentColor}
                          />
                        )}

                        <Text
                          style={[
                            uiStyles.recurringOptionText,
                            {
                              color: selected
                                ? personalAccentColor
                                : appTheme.text,
                              fontWeight: selected ? "700" : "500",
                            },
                          ]}
                        >
                          {option.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                {!alarmDate && recurring !== "none" && (
                  <Text style={uiStyles.recurringWarning}>
                    Set a reminder date and time to enable repeating.
                  </Text>
                )}
              </View>
              <Pressable
                onPress={() => void saveTodo()}
                disabled={loading || recordingBusy || isRecording}
                style={themeStyle(uiStyles.saveButton)}
              >
                <LinearGradient
                  colors={["#078E89", "#13B9A0", "#23D5A5"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[
                    themeStyle(uiStyles.saveGradient),
                    {
                      minHeight: isDesktop
                        ? 54
                        : isNarrowPhone
                          ? 58
                          : isShortScreen
                            ? 64
                            : 72,
                      borderRadius: isDesktop ? 14 : undefined,
                      gap: isDesktop ? 10 : isNarrowPhone ? 9 : 13,
                    },
                  ]}
                >
                  {loading ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Ionicons
                      name="save-outline"
                      size={isNarrowPhone ? 24 : 30}
                      color="#FFFFFF"
                    />
                  )}
                  <Text
                    style={[
                      themeStyle(uiStyles.saveText),
                      { fontSize: isDesktop ? 16 : isNarrowPhone ? 16 : 20 },
                    ]}
                  >
                    {loading
                      ? "Saving Note..."
                      : isEditing
                        ? "Update Note"
                        : "Save Note"}
                  </Text>
                </LinearGradient>
              </Pressable>

              <View style={themeStyle(uiStyles.draftStatusRow)}>
                <Ionicons
                  name={
                    draftStatus === "saved"
                      ? "checkmark-circle-outline"
                      : "cloud-upload-outline"
                  }
                  size={14}
                  color={appTheme.secondaryText}
                />
                <Text style={themeStyle(uiStyles.draftStatusText)}>
                  {draftStatus === "saved"
                    ? "Draft saved on this device"
                    : "Your changes are saved as a draft"}
                </Text>
              </View>
            </View>
          </View>

          {/* Attachment options bottom-sheet modal */}

          <Modal
            visible={attachmentModalVisible}
            transparent
            animationType="slide"
            statusBarTranslucent
            onRequestClose={() => setAttachmentModalVisible(false)}
          >
            <View style={themeStyle(uiStyles.attachmentModalOverlay)}>
              <Pressable
                style={themeStyle(uiStyles.attachmentModalBackdrop)}
                onPress={() => setAttachmentModalVisible(false)}
                accessibilityLabel="Close attachment options"
              />

              <View
                style={[
                  themeStyle(uiStyles.attachmentModalSheet),
                  { maxHeight: "88%", flexShrink: 1 },
                ]}
              >
                <View style={themeStyle(uiStyles.attachmentModalHandle)} />

                {/* Header stays visible */}
                <View style={themeStyle(uiStyles.attachmentModalHeader)}>
                  <View style={{ flex: 1 }}>
                    <Text style={themeStyle(uiStyles.attachmentModalTitle)}>
                      Add to your note
                    </Text>
                    <Text style={themeStyle(uiStyles.attachmentModalSubtitle)}>
                      Choose what you want to attach
                    </Text>
                  </View>

                  <Pressable
                    style={themeStyle(uiStyles.attachmentModalClose)}
                    onPress={() => setAttachmentModalVisible(false)}
                    accessibilityRole="button"
                    accessibilityLabel="Close"
                  >
                    <Ionicons name="close" size={21} color="#52645F" />
                  </Pressable>
                </View>

                {/* Scrollable attachment options */}
                <ScrollView
                  style={{
                    flex: 1,
                    minHeight: 0,
                    width: "100%",
                  }}
                  contentContainerStyle={{
                    flexGrow: 1,
                    paddingBottom: 20,
                  }}
                  showsVerticalScrollIndicator={true}
                  persistentScrollbar={true}
                  nestedScrollEnabled
                  keyboardShouldPersistTaps="handled"
                >
                  <View style={uiStyles.attachmentModalGrid}>
                    <AttachmentTile
                      label="Add Image"
                      icon="image-outline"
                      tint="#07876E"
                      bg="#E5F8F2"
                      onPress={() => {
                        setAttachmentModalVisible(false);
                        void pickImage();
                      }}
                    />

                    <AttachmentTile
                      label="Add Video"
                      icon="videocam-outline"
                      tint="#8652EB"
                      bg="#F0EAFE"
                      onPress={() => {
                        if (Platform.OS !== "web") {
                          setAttachmentModalVisible(false);
                        }
                        void pickVideo();
                      }}
                    />

                    {!recordingSessionActive && !voiceUri && (
                      <AttachmentTile
                        label="Record Voice"
                        icon="mic-outline"
                        tint="#F12870"
                        bg="#FDE9F2"
                        onPress={() => void startRecording()}
                      />
                    )}

                    {recordingSessionActive && (
                      <>
                        <AttachmentTile
                          label={
                            isPaused ? "Resume Recording" : "Pause Recording"
                          }
                          icon={
                            isPaused
                              ? "play-circle-outline"
                              : "pause-circle-outline"
                          }
                          tint="#0D9488"
                          bg="#DDF7F0"
                          onPress={() => {
                            if (isPaused) void resumeRecording();
                            else void pauseVoiceRecording();
                          }}
                        />

                        <AttachmentTile
                          label="Stop Recording"
                          icon="stop-circle-outline"
                          tint="#D92B70"
                          bg="#FDE9F2"
                          onPress={() => void stopRecording()}
                        />
                      </>
                    )}

                    {voiceUri && !recordingSessionActive && (
                      <AttachmentTile
                        label={
                          playerStatus.playing ? "Pause Audio" : "Play Audio"
                        }
                        icon={
                          playerStatus.playing
                            ? "pause-circle-outline"
                            : "play-circle-outline"
                        }
                        tint="#0D9488"
                        bg="#DDF7F0"
                        onPress={() => void togglePlayback()}
                      />
                    )}

                    <AttachmentTile
                      label="Add File"
                      icon="document-text-outline"
                      tint="#F57917"
                      bg="#FFF0E5"
                      onPress={() => {
                        setAttachmentModalVisible(false);
                        void pickDocument();
                      }}
                    />
                  </View>
                </ScrollView>
              </View>
            </View>
          </Modal>

          {/* Keep the existing color, font, spacing, link and handwriting modals below. */}
          {/* Modals */}
          <Modal
            visible={colorPaletteVisible}
            transparent
            animationType="fade"
            onRequestClose={() => setColorPaletteVisible(false)}
          >
            <Pressable
              style={themeStyle(styles.colorModalOverlay)}
              onPress={() => setColorPaletteVisible(false)}
            >
              <Pressable
                style={themeStyle(styles.colorPaletteCard)}
                onPress={(e) => e.stopPropagation()}
              >
                <View style={themeStyle(styles.colorPaletteHeader)}>
                  <Text style={themeStyle(styles.colorPaletteTitle)}>
                    Text Color
                  </Text>
                  <Pressable onPress={() => setColorPaletteVisible(false)}>
                    <Ionicons name="close" size={23} color={mintTheme.text} />
                  </Pressable>
                </View>

                <View style={themeStyle(styles.colorGrid)}>
                  {textColors.map((color) => (
                    <Pressable
                      key={color}
                      accessibilityRole="button"
                      accessibilityLabel={`Select color ${color}`}
                      accessibilityState={{ selected: textColor === color }}
                      onPress={() => {
                        setTextColor(color);
                        setColorPaletteVisible(false);
                      }}
                      style={[
                        themeStyle(styles.colorSwatch),
                        { backgroundColor: color },
                        textColor === color &&
                          themeStyle(styles.selectedColorSwatch),
                        color === "#FFFFFF" &&
                          themeStyle(styles.whiteColorSwatch),
                      ]}
                    >
                      {textColor === color && (
                        <Ionicons
                          name="checkmark"
                          size={20}
                          color={color === "#FFFFFF" ? "#172F2B" : "#FFFFFF"}
                        />
                      )}
                    </Pressable>
                  ))}
                </View>

                <Text style={themeStyle(styles.selectedColorLabel)}>
                  Selected: {textColor.toUpperCase()}
                </Text>
              </Pressable>
            </Pressable>
          </Modal>

          {/* font family */}
          <Modal
            visible={fontPickerVisible}
            transparent
            animationType="fade"
            onRequestClose={() => setFontPickerVisible(false)}
          >
            <Pressable
              style={themeStyle(styles.fontModalOverlay)}
              onPress={() => setFontPickerVisible(false)}
            >
              <Pressable
                style={themeStyle(styles.fontModalCard)}
                onPress={(e) => e.stopPropagation()}
              >
                <View style={themeStyle(styles.fontModalHeader)}>
                  <Text style={themeStyle(styles.fontModalTitle)}>
                    Choose Font
                  </Text>

                  <Pressable
                    onPress={() => setFontPickerVisible(false)}
                    accessibilityRole="button"
                    accessibilityLabel="Close font picker"
                  >
                    <Ionicons name="close" size={23} color={mintTheme.text} />
                  </Pressable>
                </View>

                {fontFamilies.map((font) => {
                  const isSystemFont = font === "System";
                  const isSelected = isSystemFont
                    ? !fontFamily || fontFamily === "System"
                    : fontFamily === font;

                  return (
                    <Pressable
                      key={font}
                      style={[
                        themeStyle(styles.fontOption),
                        isSelected && themeStyle(styles.fontOptionActive),
                      ]}
                      onPress={() => {
                        setFontFamily(font === "System" ? undefined : font);
                        setFontPickerVisible(false);
                      }}
                      accessibilityRole="button"
                      accessibilityLabel={
                        isSystemFont ? "Default System Font" : font
                      }
                      accessibilityState={{ selected: isSelected }}
                    >
                      <Text
                        style={[
                          themeStyle(styles.fontOptionText),
                          {
                            fontFamily: isSystemFont ? undefined : font,
                          },
                          isSelected && themeStyle(styles.fontOptionTextActive),
                        ]}
                      >
                        {isSystemFont ? "Default System Font" : font}
                      </Text>

                      {isSelected && (
                        <Ionicons
                          name="checkmark-circle"
                          size={20}
                          color="#239B83"
                        />
                      )}
                    </Pressable>
                  );
                })}
              </Pressable>
            </Pressable>
          </Modal>

          <Modal
            visible={spacingModalVisible}
            transparent
            animationType="fade"
            onRequestClose={() => setSpacingModalVisible(false)}
          >
            <Pressable
              style={themeStyle(styles.fontModalOverlay)}
              onPress={() => setSpacingModalVisible(false)}
            >
              <Pressable
                style={themeStyle(styles.fontModalCard)}
                onPress={(e) => e.stopPropagation()}
              >
                <View style={themeStyle(styles.fontModalHeader)}>
                  <Text style={themeStyle(styles.fontModalTitle)}>
                    Text Spacing
                  </Text>
                  <Pressable
                    onPress={() => setSpacingModalVisible(false)}
                    accessibilityLabel="Close text spacing"
                  >
                    <Ionicons name="close" size={23} color={mintTheme.text} />
                  </Pressable>
                </View>

                <Text style={themeStyle(styles.spacingSettingLabel)}>
                  Line spacing
                </Text>
                <Text style={themeStyle(styles.spacingSettingHint)}>
                  Controls the vertical distance between lines.
                </Text>
                <View style={themeStyle(styles.spacingControlRow)}>
                  <Pressable
                    style={themeStyle(styles.spacingStepButton)}
                    onPress={() =>
                      setLineSpacing((value) => Math.max(16, value - 2))
                    }
                    accessibilityLabel="Decrease line spacing"
                  >
                    <Ionicons name="remove" size={20} color={mintTheme.text} />
                  </Pressable>
                  <Text style={themeStyle(styles.spacingValue)}>
                    {lineSpacing} px
                  </Text>
                  <Pressable
                    style={themeStyle(styles.spacingStepButton)}
                    onPress={() =>
                      setLineSpacing((value) => Math.min(40, value + 2))
                    }
                    accessibilityLabel="Increase line spacing"
                  >
                    <Ionicons name="add" size={20} color={mintTheme.text} />
                  </Pressable>
                </View>

                <View style={themeStyle(styles.spacingDivider)} />

                <Text style={themeStyle(styles.spacingSettingLabel)}>
                  Letter spacing
                </Text>
                <Text style={themeStyle(styles.spacingSettingHint)}>
                  Controls the horizontal distance between characters.
                </Text>
                <View style={themeStyle(styles.spacingControlRow)}>
                  <Pressable
                    style={themeStyle(styles.spacingStepButton)}
                    onPress={() =>
                      setLetterSpacing((value) =>
                        Math.max(-1, Math.round((value - 0.25) * 100) / 100),
                      )
                    }
                    accessibilityLabel="Decrease letter spacing"
                  >
                    <Ionicons name="remove" size={20} color={mintTheme.text} />
                  </Pressable>
                  <Text style={themeStyle(styles.spacingValue)}>
                    {letterSpacing.toFixed(2)} px
                  </Text>
                  <Pressable
                    style={themeStyle(styles.spacingStepButton)}
                    onPress={() =>
                      setLetterSpacing((value) =>
                        Math.min(3, Math.round((value + 0.25) * 100) / 100),
                      )
                    }
                    accessibilityLabel="Increase letter spacing"
                  >
                    <Ionicons name="add" size={20} color={mintTheme.text} />
                  </Pressable>
                </View>

                <View style={themeStyle(styles.spacingActionRow)}>
                  <Pressable
                    style={themeStyle(styles.spacingResetButton)}
                    onPress={() => {
                      setLineSpacing(24);
                      setLetterSpacing(0);
                    }}
                  >
                    <Text style={themeStyle(styles.spacingResetText)}>
                      Reset
                    </Text>
                  </Pressable>
                  <Pressable
                    style={themeStyle(styles.spacingDoneButton)}
                    onPress={() => setSpacingModalVisible(false)}
                  >
                    <Text style={themeStyle(styles.spacingDoneText)}>Done</Text>
                  </Pressable>
                </View>
              </Pressable>
            </Pressable>
          </Modal>

          {/* linkmodal */}

          <Modal
            visible={linkModalVisible}
            transparent
            animationType="fade"
            onRequestClose={() => setLinkModalVisible(false)}
          >
            <Pressable
              style={themeStyle(styles.fontModalOverlay)}
              onPress={() => setLinkModalVisible(false)}
            >
              <Pressable
                style={themeStyle(styles.fontModalCard)}
                onPress={(e) => e.stopPropagation()}
              >
                <Text style={themeStyle(styles.fontModalTitle)}>
                  Insert hyperlink
                </Text>

                <TextInput
                  value={linkUrl}
                  onChangeText={setLinkUrl}
                  placeholder="https://example.com"
                  placeholderTextColor={appTheme.secondaryText}
                  keyboardType="url"
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={themeStyle(styles.hyperlinkInput)}
                />

                <View style={themeStyle(styles.fontModalActions)}>
                  <Pressable
                    style={themeStyle(styles.toolButton)}
                    onPress={() => setLinkModalVisible(false)}
                  >
                    <Text style={themeStyle(styles.toolText)}>Cancel</Text>
                  </Pressable>

                  <Pressable
                    style={themeStyle(styles.toolButton)}
                    onPress={handleInsertLink}
                  >
                    <Text style={themeStyle(styles.toolText)}>Insert link</Text>
                  </Pressable>
                </View>
              </Pressable>
            </Pressable>
          </Modal>

          {/* note theeme */}

          <Modal
            visible={noteThemePickerVisible}
            transparent
            animationType="slide"
            statusBarTranslucent
            onRequestClose={() => setNoteThemePickerVisible(false)}
          >
            <View
              style={[
                themeStyle(uiStyles.themeModalOverlay),
                {
                  justifyContent: "flex-end",
                  padding: 0,
                },
              ]}
            >
              <View
                style={[
                  themeStyle(uiStyles.themeModalCard),
                  {
                    width: "100%",
                    height: "88%",
                    borderTopLeftRadius: 26,
                    borderTopRightRadius: 26,
                    borderBottomLeftRadius: 0,
                    borderBottomRightRadius: 0,
                    paddingHorizontal: 18,
                    paddingTop: 20,
                    paddingBottom: 12,
                  },
                ]}
              >
                {/* HEADER */}
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
                      style={[
                        themeStyle(uiStyles.themeModalTitle),
                        { fontSize: 22, fontWeight: "800" },
                      ]}
                    >
                      Customize your note
                    </Text>

                    <Text
                      style={[
                        themeStyle(uiStyles.themeModalSubtitle),
                        { marginTop: 5 },
                      ]}
                    >
                      Choose a color or create your own paper style
                    </Text>
                  </View>

                  <Pressable
                    onPress={() => setNoteThemePickerVisible(false)}
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: 20,
                      backgroundColor: "#F1F5F9",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Ionicons name="close" size={22} color="#334155" />
                  </Pressable>
                </View>

                <ScrollView
                  style={{ flex: 1 }}
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={{ paddingBottom: 28 }}
                >
                  {/* SOLID COLORS */}
                  <View style={{ marginBottom: 25 }}>
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "space-between",
                        marginBottom: 5,
                      }}
                    >
                      <Text
                        style={[
                          themeStyle(uiStyles.noteColorTitle),
                          { fontSize: 17, fontWeight: "800" },
                        ]}
                      >
                        Solid Colors
                      </Text>

                      <Text style={{ fontSize: 11, color: "#94A3B8" }}>
                        Plain background
                      </Text>
                    </View>

                    <Text
                      style={[
                        themeStyle(uiStyles.themeModalSubtitle),
                        { marginBottom: 14 },
                      ]}
                    >
                      Simple colors without patterns
                    </Text>

                    <View
                      style={{
                        flexDirection: "row",
                        flexWrap: "wrap",
                        gap: 13,
                      }}
                    >
                      {[
                        "#FFFFFF",
                        "#FFF4CC",
                        "#FFE4E6",
                        "#FCE7F3",
                        "#EDE9FE",
                        "#DBEAFE",
                        "#D1FAE5",
                        "#A7E8CC",
                        "#FEF3C7",
                        "#F3F4F6",
                        "#E5E7EB",
                        "#D6D3D1",
                        "#FDE2C5",
                        "#D9F0F0",
                        "#E8EAFD",
                        "#F5E6CA",
                      ].map((color) => {
                        const selected =
                          quickNoteColor.toLowerCase() ===
                            color.toLowerCase() &&
                          notePattern === "plain" &&
                          !noteBackgroundImageUri;

                        return (
                          <Pressable
                            key={color}
                            onPress={() => {
                              setQuickNoteColor(color);
                              setNoteBackgroundImageUri(null);
                              setNotePattern("plain");
                              setNoteThemePickerVisible(false);
                            }}
                            style={{
                              width: 43,
                              height: 43,
                              borderRadius: 15,
                              backgroundColor: color,
                              borderWidth: selected ? 2.5 : 1,
                              borderColor: selected
                                ? personalAccentColor
                                : "#E2E8F0",
                              alignItems: "center",
                              justifyContent: "center",
                              elevation: selected ? 2 : 0,
                            }}
                          >
                            {selected && (
                              <Ionicons
                                name="checkmark"
                                size={21}
                                color="#334155"
                              />
                            )}
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>

                  {/* DIVIDER */}
                  <View
                    style={{
                      height: 1,
                      backgroundColor: "#E9EEF2",
                      marginBottom: 22,
                    }}
                  />

                  {/* PAPER PATTERNS */}
                  <View style={{ marginBottom: 18 }}>
                    <Text
                      style={[
                        themeStyle(uiStyles.noteColorTitle),
                        { fontSize: 17, fontWeight: "800" },
                      ]}
                    >
                      Paper Patterns
                    </Text>

                    <Text
                      style={[
                        themeStyle(uiStyles.themeModalSubtitle),
                        { marginTop: 5, marginBottom: 15 },
                      ]}
                    >
                      First select a pattern, then choose its color
                    </Text>

                    <View
                      style={{
                        flexDirection: "row",
                        flexWrap: "wrap",
                        gap: 12,
                      }}
                    >
                      {[
                        { label: "Lined", value: "lined" },
                        { label: "Dotted", value: "dotted" },
                        { label: "Grid", value: "grid" },
                        { label: "Hearts", value: "heart" },
                        { label: "Stars", value: "star" },
                        { label: "Leaves", value: "leaf" },
                        { label: "Flowers", value: "flower" },
                        { label: "Checker", value: "checker" },
                      ].map((item) => {
                        const selected = pendingNotePattern === item.value;

                        return (
                          <Pressable
                            key={item.value}
                            onPress={() => setPendingNotePattern(item.value)}
                            style={{
                              width: "23%",
                              minWidth: 68,
                              flexGrow: 1,
                              padding: 6,
                              borderRadius: 15,
                              borderWidth: selected ? 2 : 1,
                              borderColor: selected
                                ? personalAccentColor
                                : "#E2E8F0",
                              backgroundColor: selected ? "#F0FAF6" : "#FFFFFF",
                            }}
                          >
                            {/* SIMPLE PATTERN PREVIEW */}
                            <View
                              style={{
                                height: 66,
                                borderRadius: 10,
                                backgroundColor: "#F8FAFC",
                                overflow: "hidden",
                                position: "relative",
                                justifyContent: "center",
                              }}
                            >
                              <NotePattern
                                pattern={item.value}
                                ink="rgba(71, 105, 91, 0.28)"
                              />

                              {selected && (
                                <View
                                  style={{
                                    position: "absolute",
                                    top: 5,
                                    right: 5,
                                    width: 19,
                                    height: 19,
                                    borderRadius: 10,
                                    backgroundColor: personalAccentColor,
                                    alignItems: "center",
                                    justifyContent: "center",
                                    zIndex: 5,
                                  }}
                                >
                                  <Ionicons
                                    name="checkmark"
                                    size={13}
                                    color="#FFFFFF"
                                  />
                                </View>
                              )}
                            </View>

                            <Text
                              numberOfLines={1}
                              style={{
                                fontSize: 12,
                                fontWeight: selected ? "800" : "600",
                                color: selected ? "#166B50" : "#475569",
                                textAlign: "center",
                                marginTop: 8,
                                marginBottom: 3,
                              }}
                            >
                              {item.label}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>

                  {/* PATTERN COLOR */}
                  <View
                    style={{
                      backgroundColor: "#F8FAFC",
                      borderRadius: 17,
                      padding: 15,
                      marginTop: 5,
                    }}
                  >
                    <View
                      style={{
                        flexDirection: "row",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: 5,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 15,
                          fontWeight: "800",
                          color: "#263746",
                        }}
                      >
                        Choose Pattern Color
                      </Text>

                      <Text
                        style={{
                          fontSize: 11,
                          color: "#64748B",
                        }}
                      >
                        {pendingNotePattern.charAt(0).toUpperCase() +
                          pendingNotePattern.slice(1)}
                      </Text>
                    </View>

                    <Text
                      style={{
                        fontSize: 12,
                        color: "#94A3B8",
                        marginBottom: 14,
                      }}
                    >
                      Select a background color for your pattern
                    </Text>

                    <View
                      style={{
                        flexDirection: "row",
                        flexWrap: "wrap",
                        gap: 12,
                      }}
                    >
                      {[
                        "#FFFFFF",
                        "#FFF4CC",
                        "#FFE4E6",
                        "#FCE7F3",
                        "#EDE9FE",
                        "#DBEAFE",
                        "#D1FAE5",
                        "#A7E8CC",
                        "#FEF3C7",
                        "#DDF7E8",
                        "#E3F4FF",
                        "#FFE5D4",
                        "#F5E6CA",
                        "#DCEBDD",
                        "#E4E7FF",
                        "#25283D",
                      ].map((color) => {
                        const selected =
                          quickNoteColor.toLowerCase() ===
                            color.toLowerCase() &&
                          notePattern === pendingNotePattern &&
                          !noteBackgroundImageUri;

                        return (
                          <Pressable
                            key={color}
                            onPress={() => {
                              setQuickNoteColor(color);
                              setNoteBackgroundImageUri(null);
                              setNotePattern(pendingNotePattern);
                              setNoteThemePickerVisible(false);
                            }}
                            style={{
                              width: 39,
                              height: 39,
                              borderRadius: 13,
                              backgroundColor: color,
                              borderWidth: selected ? 2.5 : 1,
                              borderColor: selected
                                ? personalAccentColor
                                : "#D8E0E7",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            {selected && (
                              <Ionicons
                                name="checkmark"
                                size={19}
                                color={
                                  color === "#25283D" ? "#FFFFFF" : "#334155"
                                }
                              />
                            )}
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>

                  {/* APPLY BUTTON 
        <Pressable
          onPress={() => {
            setQuickNoteColor("#FFFFFF");
            setNoteBackgroundImageUri(null);
            setNotePattern(pendingNotePattern);
            setNoteThemePickerVisible(false);
          }}
          style={{
            backgroundColor: personalAccentColor,
            borderRadius: 14,
            paddingVertical: 14,
            alignItems: "center",
            justifyContent: "center",
            marginTop: 18,
          }}
        >
          <Text
            style={{
              color: "#FFFFFF",
              fontSize: 15,
              fontWeight: "800",
            }}
          >
            Apply Pattern
          </Text>
        </Pressable> */}
                </ScrollView>
              </View>
            </View>
          </Modal>

          {/* hyperlink */}

          <Modal
            visible={hyperlinkModalVisible}
            transparent
            animationType="fade"
            statusBarTranslucent
            onRequestClose={() => setHyperlinkModalVisible(false)}
          >
            <View style={styles.hyperlinkOverlay}>
              <View style={styles.hyperlinkModal}>
                {/* Header */}
                <View style={styles.hyperlinkHeader}>
                  <View style={styles.hyperlinkHeaderLeft}>
                    <View style={styles.hyperlinkIcon}>
                      <Ionicons name="link" size={23} color="#208A75" />
                    </View>

                    <View style={{ flex: 1 }}>
                      <Text style={styles.hyperlinkTitle}>Open Hyperlink</Text>
                      <Text style={styles.hyperlinkSubtitle}>
                        Select a link to continue
                      </Text>
                    </View>
                  </View>

                  <Pressable
                    onPress={() => setHyperlinkModalVisible(false)}
                    style={styles.hyperlinkClose}
                  >
                    <Ionicons name="close" size={21} color="#52645E" />
                  </Pressable>
                </View>

                {/* Link Count */}
                <View style={styles.hyperlinkCount}>
                  <Ionicons name="globe-outline" size={16} color="#208A75" />
                  <Text style={styles.hyperlinkCountText}>
                    {hyperlinkList.length} links found
                  </Text>
                </View>

                {/* Hyperlink List */}
                <ScrollView
                  style={styles.hyperlinkScroll}
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                >
                  {hyperlinkList.map((url, index) => {
                    const isSelected = selectedHyperlink === url;

                    return (
                      <Pressable
                        key={`${url}-${index}`}
                        onPress={() => setSelectedHyperlink(url)}
                        style={[
                          styles.hyperlinkItem,
                          isSelected && styles.hyperlinkItemSelected,
                        ]}
                      >
                        <View
                          style={[
                            styles.hyperlinkNumber,
                            isSelected && styles.hyperlinkNumberSelected,
                          ]}
                        >
                          <Text
                            style={[
                              styles.hyperlinkNumberText,
                              isSelected && styles.hyperlinkNumberTextSelected,
                            ]}
                          >
                            {index + 1}
                          </Text>
                        </View>

                        <View style={styles.hyperlinkContent}>
                          <Text style={styles.hyperlinkLabel}>
                            Hyperlink {index + 1}
                          </Text>

                          <Text style={styles.hyperlinkUrl} numberOfLines={2}>
                            {url}
                          </Text>
                        </View>

                        <Ionicons
                          name={
                            isSelected ? "checkmark-circle" : "ellipse-outline"
                          }
                          size={22}
                          color={isSelected ? "#208A75" : "#B7C6C0"}
                        />
                      </Pressable>
                    );
                  })}
                </ScrollView>

                {/* Footer */}
                <View style={styles.hyperlinkFooter}>
                  <Pressable
                    style={styles.hyperlinkCancelButton}
                    onPress={() => setHyperlinkModalVisible(false)}
                  >
                    <Text style={styles.hyperlinkCancelText}>Cancel</Text>
                  </Pressable>

                  <Pressable
                    disabled={!selectedHyperlink}
                    style={[
                      styles.hyperlinkOpenButton,
                      !selectedHyperlink && styles.hyperlinkOpenDisabled,
                    ]}
                    onPress={async () => {
                      if (!selectedHyperlink) return;

                      const url = selectedHyperlink;

                      try {
                        await Linking.openURL(url);
                        setHyperlinkModalVisible(false);
                      } catch {
                        showAlert("Unable to open link", url);
                      }
                    }}
                  >
                    <Ionicons name="open-outline" size={18} color="#FFFFFF" />
                    <Text style={styles.hyperlinkOpenText}>Open Link</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          </Modal>

          {/* Desktop/Web alert dialog replacing unsupported Alert.alert UI */}
          <Modal
            visible={Platform.OS === "web" && appAlert.visible}
            transparent
            animationType="fade"
            statusBarTranslucent
            onRequestClose={() => {
              if (appAlert.options?.cancelable) closeAppAlert();
            }}
          >
            <View
              style={{
                flex: 1,
                backgroundColor: "rgba(15, 35, 30, 0.48)",
                alignItems: "center",
                justifyContent: "center",
                padding: 24,
              }}
            >
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Alert backdrop"
                disabled={!appAlert.options?.cancelable}
                onPress={() => {
                  if (appAlert.options?.cancelable) closeAppAlert();
                }}
                style={{
                  position: "absolute",
                  top: 0,
                  right: 0,
                  bottom: 0,
                  left: 0,
                }}
              />

              <View
                accessibilityViewIsModal
                style={{
                  width: "100%",
                  maxWidth: 440,
                  backgroundColor: isDark ? "#1C2B27" : "#FFFFFF",
                  borderRadius: 22,
                  padding: 26,
                  borderWidth: 1,
                  borderColor: isDark ? "#38544A" : "#D3EDE0",
                  shadowColor: "#000000",
                  shadowOffset: { width: 0, height: 12 },
                  shadowOpacity: 0.2,
                  shadowRadius: 25,
                  elevation: 15,
                }}
              >
                <View
                  style={{
                    width: 54,
                    height: 54,
                    borderRadius: 18,
                    backgroundColor: isDark ? "#29483D" : "#DDF4E8",
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: 18,
                  }}
                >
                  <Ionicons
                    name={
                      /error|failed|unable|invalid|required|permission|unavailable/i.test(
                        appAlert.title,
                      )
                        ? "alert-circle-outline"
                        : /delete|remove/i.test(appAlert.title)
                          ? "trash-outline"
                          : /saved|success|copied|cleared|snoozed/i.test(
                                appAlert.title,
                              )
                            ? "checkmark-circle-outline"
                            : "information-circle-outline"
                    }
                    size={30}
                    color="#16866A"
                  />
                </View>

                <Text
                  style={{
                    fontSize: 21,
                    fontWeight: "800",
                    color: isDark ? "#F0FAF5" : "#183B32",
                    marginBottom: 10,
                  }}
                >
                  {appAlert.title}
                </Text>

                {!!appAlert.message && (
                  <Text
                    selectable
                    style={{
                      fontSize: 14,
                      lineHeight: 23,
                      color: isDark ? "#C2D8CE" : "#6B877C",
                      marginBottom: 26,
                    }}
                  >
                    {appAlert.message}
                  </Text>
                )}

                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "flex-end",
                    flexWrap: "wrap",
                    gap: 10,
                  }}
                >
                  {appAlert.buttons.map((button, index) => {
                    const destructive = button.style === "destructive";
                    const cancel = button.style === "cancel";
                    const label = button.text || "OK";

                    return (
                      <Pressable
                        key={`${label}-${index}`}
                        accessibilityRole="button"
                        accessibilityLabel={label}
                        onPress={() => {
                          closeAppAlert();
                          button.onPress?.();
                        }}
                        style={({ pressed }) => ({
                          minWidth: 105,
                          minHeight: 42,
                          paddingHorizontal: 20,
                          paddingVertical: 12,
                          borderRadius: 12,
                          alignItems: "center",
                          justifyContent: "center",
                          backgroundColor: destructive
                            ? "#D94F5C"
                            : cancel
                              ? isDark
                                ? "#30443C"
                                : "#EDF5F0"
                              : "#16866A",
                          opacity: pressed ? 0.82 : 1,
                        })}
                      >
                        <Text
                          style={{
                            fontSize: 14,
                            fontWeight: "700",
                            color: cancel
                              ? isDark
                                ? "#E6F2EC"
                                : "#36564A"
                              : "#FFFFFF",
                          }}
                        >
                          {label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            </View>
          </Modal>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function FormatTool({
  label,
  icon,
  active = false,
  onPress,
}: {
  label: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  active?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={uiStyles.formatTool}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <View style={[uiStyles.formatIcon, active && uiStyles.formatIconActive]}>
        <Ionicons
          name={icon}
          size={23}
          color={active ? "#FFFFFF" : "#4A596D"}
        />
      </View>
      <Text style={uiStyles.formatLabel}>{label}</Text>
    </Pressable>
  );
}

function AttachmentTile({
  label,
  icon,
  tint,
  bg,
  onPress,
}: {
  label: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  tint: string;
  bg: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        uiStyles.attachmentTile,
        { borderColor: `${tint}28`, backgroundColor: pressed ? bg : "#FFFFFF" },
        pressed && uiStyles.attachmentTilePressed,
      ]}
    >
      <View
        style={[
          uiStyles.attachmentIconWrap,
          { backgroundColor: bg, borderColor: `${tint}20` },
        ]}
      >
        <Ionicons name={icon} size={24} color={tint} />
      </View>
      <Text numberOfLines={2} style={uiStyles.attachmentTileLabel}>
        {label}
      </Text>
      <View style={uiStyles.attachmentTileHint}>
        <Text style={[uiStyles.attachmentTileHintText, { color: tint }]}>
          Add
        </Text>
        <Ionicons name="arrow-forward" size={12} color={tint} />
      </View>
    </Pressable>
  );
}

function SettingTile({
  icon,
  title,
  subtitle,
  tint,
  bg,
  onPress,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  title: string;
  subtitle: string;
  tint: string;
  bg: string;
  onPress: () => void;
}) {
  const { width: screenWidth } = useWindowDimensions();
  const narrowLayout = screenWidth < 350;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}: ${subtitle}`}
      onPress={onPress}
      style={({ pressed }) => [
        uiStyles.settingTile,
        {
          width: narrowLayout ? "100%" : "48%",
          minHeight: narrowLayout ? 96 : 118,
          padding: narrowLayout ? 11 : 14,
          backgroundColor: "#FFFFFF",
          borderColor: pressed ? `${tint}70` : "#E5EEEC",
        },
        pressed && uiStyles.settingTilePressed,
      ]}
    >
      <View style={uiStyles.settingTileTop}>
        <View style={[uiStyles.settingIcon, { backgroundColor: bg }]}>
          <Ionicons name={icon} size={22} color={tint} />
        </View>
        <View style={[uiStyles.settingArrow, { backgroundColor: `${tint}12` }]}>
          <Ionicons name="chevron-forward" size={15} color={tint} />
        </View>
      </View>
      <View style={uiStyles.settingTextBlock}>
        <Text numberOfLines={1} style={uiStyles.settingTitle}>
          {title}
        </Text>
        <Text numberOfLines={2} style={uiStyles.settingSubtitle}>
          {subtitle}
        </Text>
      </View>
    </Pressable>
  );
}

const uiStyles = StyleSheet.create({
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#EAF8F1",

    // Full border on all four sides
    borderWidth: 1,
    borderColor: "#D3EDE0",
    borderRadius: 22,

    // Keep the header visually elevated without a dark outline
    shadowColor: "#173F38",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.045,
    shadowRadius: 12,
    elevation: 2,
  },

  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: 44,
  },

  backButton: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#DCE9E2",
  },

  headerCopy: {
    flex: 1,
    minWidth: 0,
    justifyContent: "center",
    paddingVertical: 2,
  },

  headerTitle: {
    fontSize: 19,
    fontWeight: "700",
    letterSpacing: -0.45,
    color: "#183B32",
    lineHeight: 25,
  },

  headerSubtitle: {
    fontSize: 12,
    fontWeight: "500",
    color: "#6B877C",
    marginTop: 4,
    letterSpacing: 0.15,
    lineHeight: 17,
  },

  quickSave: {
    minHeight: 40,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
  },

  quickSaveText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },

  moreButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },

  headerArt: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
    paddingTop: 14,
    paddingBottom: 4,
  },

  noteColorSection: {
    width: "100%",
    marginBottom: 20,
  },

  noteColorTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#334155",
    marginBottom: 5,
  },

  noteColorGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginTop: 14,
    marginBottom: 20,
  },

  noteColorItem: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    alignItems: "center",
    justifyContent: "center",
  },

  noteColorItemSelected: {
    borderWidth: 3,
    borderColor: "#18A98B",
  },

  noteThemesGrid: {
    width: "100%",
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 12,
  },

  reminderCard: {
    width: "100%",
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
    marginVertical: 8,
  },

  reminderHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 48,
  },

  reminderIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },

  reminderTitle: {
    fontSize: 15,
    fontWeight: "700",
  },

  reminderSubtitle: {
    fontSize: 12,
    marginTop: 4,
  },

  reminderDivider: {
    height: 1,
    marginVertical: 14,
  },

  repeatHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginBottom: 12,
  },

  repeatTitle: {
    fontSize: 13,
    fontWeight: "700",
  },

  repeatCurrent: {
    fontSize: 12,
    fontWeight: "700",
  },

  recurringOptions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },

  recurringOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 9,
    borderRadius: 12,
    borderWidth: 1,
  },

  recurringOptionText: {
    fontSize: 11,
  },

  recurringWarning: {
    color: "#D97706",
    fontSize: 11,
    lineHeight: 16,
    marginTop: 10,
  },

  recurringCard: {
    width: "100%",
    marginTop: 2,
    padding: 15,
    borderRadius: 18,
    borderWidth: 1,
    gap: 13,
  },
  recurringHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
  },
  recurringIcon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  recurringTitle: {
    fontSize: 15,
    fontWeight: "700",
  },
  recurringSubtitle: {
    fontSize: 12,
    marginTop: 3,
  },

  // Settings grid
  settingsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    width: "100%",
    alignItems: "stretch",
  },

  // SettingTile card styles
  settingTile: {
    width: "48%",
    minHeight: 118,
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E9EEF4",
    justifyContent: "space-between",
    shadowColor: "#172B4D",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },

  settingIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },

  settingTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#243247",
    letterSpacing: 0.1,
  },

  settingSubtitle: {
    fontSize: 12,
    color: "#8491A3",
    marginTop: 5,
    lineHeight: 17,
  },

  settingTileHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  themeModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.45)",
    justifyContent: "flex-end",
  },

  themeModalCard: {
    height: "78%",
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 22,
    paddingHorizontal: 18,
    paddingBottom: 20,
  },

  themeModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
  },

  themeModalTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#182230",
  },

  themeModalSubtitle: {
    fontSize: 13,
    color: "#7B8794",
    marginTop: 5,
  },

  themeCloseButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },

  themeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    paddingBottom: 24,
  },

  themeCard: {
    width: "48%",
    marginBottom: 4,
    padding: 7,
    borderRadius: 17,
    borderWidth: 1.5,
    borderColor: "#E8EDF3",
    backgroundColor: "#FFFFFF",
  },

  themeCardSelected: {
    borderColor: "#1686E8",
    backgroundColor: "#F0F8FF",
  },

  themePreview: {
    width: "100%",
    height: 90,
    borderRadius: 11,
    overflow: "hidden",
    position: "relative",
    padding: 0,
    justifyContent: "flex-start",
  },

  themeCardName: {
    fontSize: 13,
    fontWeight: "700",
    color: "#243247",
    marginTop: 10,
  },

  themeCardPattern: {
    fontSize: 11,
    color: "#8491A3",
    marginTop: 3,
    marginBottom: 3,
  },

  themeSelectedBadge: {
    position: "absolute",
    top: 7,
    right: 7,
    width: 25,
    height: 25,
    borderRadius: 13,
    backgroundColor: "#1686E8",
    alignItems: "center",
    justifyContent: "center",
  },

  themeLines: {
    gap: 17,
  },

  themeLine: {
    height: 1,
    backgroundColor: "rgba(90, 110, 130, 0.25)",
  },

  themeGridPattern: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 15,
  },

  themeGridLine: {
    width: 22,
    height: 22,
    borderWidth: 0.7,
    borderColor: "rgba(90, 110, 130, 0.2)",
  },

  themeDots: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    padding: 5,
  },

  themeDot: {
    width: 3,
    height: 3,
    borderRadius: 2,
    backgroundColor: "rgba(90, 110, 130, 0.35)",
  },
  // Note color selector card
  noteColorTile: {
    width: "100%",
    minHeight: 94,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 15,
    gap: 12,
    borderWidth: 1,
    borderColor: "#E9EEF4",
    shadowColor: "#172B4D",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },

  noteColorIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: "#E8F4FF",
    alignItems: "center",
    justifyContent: "center",
  },

  colorDots: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 9,
    marginTop: 10,
  },

  colorDot: {
    width: 25,
    height: 25,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: "rgba(30, 41, 59, 0.08)",
  },

  selectedColorDot: {
    borderColor: "#1686E8",
    borderWidth: 3,
    transform: [{ scale: 1.12 }],
  },

  flex: { flex: 1 },
  screen: { flex: 1, backgroundColor: "#EAF8F1" },
  scrollContent: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 36,
    flexGrow: 1,
    gap: 16,
    alignItems: "stretch",
  },
  featureSection: {
    width: "100%",
    alignSelf: "stretch",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#D3EDE0",
    backgroundColor: "#F5FCF8",
    padding: 13,
    gap: 12,
  },
  featureHeadingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  featureTitle: { color: "#183B32", fontSize: 16, fontWeight: "800" },
  featureSubtitle: {
    color: "#647873",
    fontSize: 13,
    lineHeight: 19,
    marginTop: 4,
  },

  templateSection: {
    width: "100%",
    alignSelf: "stretch",
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    paddingVertical: 20,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: "#E7F0EE",
    gap: 18,
    shadowColor: "#183F39",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.055,
    shadowRadius: 12,
    elevation: 3,
  },

  templateHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },

  templateHeaderIcon: {
    width: 50,
    height: 50,
    borderRadius: 17,
    backgroundColor: "#E5F6F1",
    alignItems: "center",
    justifyContent: "center",
  },

  templateHeaderCopy: {
    flex: 1,
    minWidth: 0,
  },

  templateHeading: {
    fontSize: 20,
    lineHeight: 27,
    fontWeight: "800",
    color: "#173C38",
    letterSpacing: -0.45,
  },

  templateSubheading: {
    fontSize: 15,
    lineHeight: 21,
    color: "#758783",
    marginTop: 4,
  },

  templateCount: {
    minWidth: 34,
    height: 34,
    borderRadius: 12,
    paddingHorizontal: 8,
    backgroundColor: "#EFF8F5",
    alignItems: "center",
    justifyContent: "center",
  },

  templateCountText: {
    fontSize: 16,
    fontWeight: "800",
    color: "#138A78",
  },

  templateRow: {
    paddingVertical: 4,
    paddingHorizontal: 2,
    paddingRight: 16,
    gap: 12,
  },

  templateCard: {
    width: 176,
    minHeight: 154,
    borderRadius: 23,
    padding: 16,
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: "rgba(32, 83, 72, 0.09)",
    shadowColor: "#244B45",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 2,
  },

  templateCardPressed: {
    opacity: 0.86,
    transform: [{ scale: 0.97 }],
  },

  templateCardTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  templateIconContainer: {
    width: 49,
    height: 49,
    borderRadius: 17,
    backgroundColor: "rgba(255,255,255,0.78)",
    alignItems: "center",
    justifyContent: "center",
  },

  templateArrow: {
    width: 32,
    height: 32,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.65)",
    alignItems: "center",
    justifyContent: "center",
  },

  templateCardBottom: {
    marginTop: 20,
    gap: 10,
  },

  templateTitle: {
    fontSize: 19,
    lineHeight: 25,
    fontWeight: "800",
    color: "#203F3A",
    letterSpacing: -0.3,
  },

  templateUseRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "rgba(32, 83, 72, 0.12)",
  },

  templateHint: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "700",
    color: "#426E65",
  },

  templateFooter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 2,
  },

  templateFooterText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    color: "#82918F",
  },

  cardPressed: { opacity: 0.75, transform: [{ scale: 0.98 }] },
  patternRow: { flexDirection: "row", gap: 7, width: "100%" },
  patternOption: {
    flex: 1,
    minWidth: 0,
    alignItems: "center",
    gap: 5,
    padding: 5,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: "transparent",
  },
  patternOptionActive: { borderColor: "#159F89", backgroundColor: "#EAF8F3" },
  patternPreview: {
    width: "100%",
    height: 62,
    borderRadius: 9,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#D9E5E1",
    padding: 3,
  },
  patternPreviewActive: { borderColor: "#159F89" },
  previewLine: {
    height: 1,
    width: "100%",
    backgroundColor: "#9CBDB5",
    marginVertical: 4,
  },
  previewGridVertical: {
    position: "absolute",
    left: "50%",
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: "#A9C8C0",
  },
  previewGridHorizontal: {
    position: "absolute",
    top: "50%",
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: "#A9C8C0",
  },
  previewDots: {
    color: "#7C9C93",
    fontSize: 12,
    lineHeight: 14,
    textAlign: "center",
  },
  patternLabel: { color: "#697D77", fontSize: 12, fontWeight: "600" },
  patternLabelActive: { color: "#118A75", fontWeight: "800" },
  editorPatternOverlay: {
    position: "absolute",
    top: 40,
    left: 14,
    right: 14,
    bottom: 28,
    justifyContent: "space-between",
  },
  editorLine: { height: 1, backgroundColor: "#7BA79A35" },
  editorGridOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  editorGridLine: { position: "absolute", backgroundColor: "#7BA79A30" },
  dotRow: { height: 20, justifyContent: "center" },
  dotRowText: { color: "#7BA79A55", fontSize: 20, lineHeight: 20 },
  editorPanel: {
    width: "100%",
    alignSelf: "stretch",
    padding: 13,
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    gap: 14,
    shadowColor: "#8CA7A8",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  titleField: {
    minHeight: 64,
    borderRadius: 18,
    backgroundColor: "#F3F6F8",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 9,
    width: "100%",
    alignSelf: "stretch",
  },
  titleIcon: {
    width: 43,
    height: 43,
    borderRadius: 17,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  titleInput: {
    flex: 1,
    minWidth: 0,
    color: "#193640",
    fontSize: 20,
    paddingVertical: 8,
  },
  counter: { color: "#6D7A8B", fontSize: 13 },

  contentField: {
    minHeight: 230,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: "#ECF1F4",
    padding: 14,
    paddingBottom: 38,
    width: "100%",
    alignSelf: "stretch",
    position: "relative",
    overflow: "hidden",
  },

  contentInput: {
    flex: 1,
    minWidth: 0,
    minHeight: 190,
    padding: 0,
    fontSize: 18,
    lineHeight: 28,
    textAlignVertical: "top",
  },
  contentCounter: {
    position: "absolute",
    bottom: 10,
    right: 14,
    fontSize: 11,
    lineHeight: 15,
    color: "#6D7A8B",
    backgroundColor: "#FFFFFF",
    paddingLeft: 4,
  },
  fontSizePanel: {
    width: "100%",
    alignSelf: "stretch",
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: "#E5EFEC",
    gap: 18,
    shadowColor: "#173F38",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.06,
    shadowRadius: 14,
    elevation: 3,
  },
  fontSizeHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  fontSizeIconBox: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: "#E7F7F2",
    alignItems: "center",
    justifyContent: "center",
  },
  fontSizeCopy: { flex: 1, minWidth: 0, gap: 4 },
  fontSizeTitle: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "800",
    color: "#193D37",
    letterSpacing: -0.3,
  },
  fontSizeSubtitle: { fontSize: 13, lineHeight: 18, color: "#7A8C87" },
  fontSizeBadge: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: "#F0F8F5",
    alignItems: "center",
    justifyContent: "center",
  },
  fontSizePreview: {
    backgroundColor: "#F5FAF8",
    borderRadius: 18,
    paddingVertical: 15,
    paddingHorizontal: 15,
    borderWidth: 1,
    borderColor: "#E7F0EC",
    gap: 12,
  },
  fontSizePreviewHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  fontSizePreviewLabel: {
    fontSize: 11,
    lineHeight: 16,
    fontWeight: "800",
    letterSpacing: 1,
    color: "#83958F",
  },
  fontSizePreviewText: { color: "#254740", lineHeight: 27, fontWeight: "500" },
  fontSizeValue: {
    minWidth: 32,
    textAlign: "center",
    color: "#138A78",
    fontSize: 15,
    lineHeight: 21,
    fontWeight: "800",
  },
  fontSizeControlRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  fontSizeControlCopy: { flex: 1, minWidth: 0, gap: 4 },
  fontSizeControlTitle: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "800",
    color: "#24443E",
  },
  fontSizeControlSubtitle: { fontSize: 12, lineHeight: 17, color: "#87958F" },
  fontSizeControls: { flexDirection: "row", alignItems: "center", gap: 8 },
  fontSizeButton: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: "#EAF7F2",
    borderWidth: 1,
    borderColor: "#D7EEE6",
    alignItems: "center",
    justifyContent: "center",
  },
  fontSizeButtonPressed: {
    backgroundColor: "#D7F0E7",
    transform: [{ scale: 0.96 }],
  },
  disabledControl: {
    backgroundColor: "#F1F4F3",
    borderColor: "#E8EEEC",
    opacity: 0.65,
  },
  fontSizeControlValue: {
    minWidth: 30,
    textAlign: "center",
    fontSize: 18,
    lineHeight: 25,
    fontWeight: "800",
    color: "#193D37",
    fontVariant: ["tabular-nums"],
  },
  fontSizeRangeRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  fontSizeRangeLabel: {
    fontSize: 11,
    lineHeight: 16,
    fontWeight: "600",
    color: "#91A09B",
  },
  fontSizeRangeTrack: {
    flex: 1,
    height: 6,
    borderRadius: 99,
    backgroundColor: "#E8F0ED",
    overflow: "hidden",
  },
  fontSizeRangeFill: {
    height: "100%",
    borderRadius: 99,
    backgroundColor: "#20A58B",
  },
  contentMetrics: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 7,
    marginTop: -4,
  },
  metricPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 14,
    backgroundColor: "#F0F8F4",
    borderWidth: 1,
    borderColor: "#E0EEE7",
    marginTop: 20,
  },
  metricText: { color: "#526B63", fontSize: 12, fontWeight: "600" },
  formatToolbar: {
    minHeight: 79,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: "#EAF0F3",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 3,
    paddingVertical: 7,
  },
  formatTool: {
    flex: 1,
    minWidth: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  formatIcon: {
    width: 35,
    height: 40,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  formatIconActive: { backgroundColor: "#159F89" },
  formatLabel: { color: "#697787", fontSize: 11, marginTop: 3 },
  attachmentActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    width: "100%",
    alignItems: "stretch",
  },
  attachmentLauncher: {
    width: "100%",
    minHeight: 76,
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#DCEDE7",
    backgroundColor: "#FFFFFF",
    shadowColor: "#174C40",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.055,
    shadowRadius: 12,
    elevation: 2,
  },
  attachmentLauncherPressed: {
    backgroundColor: "#F5FBF8",
    transform: [{ scale: 0.99 }],
  },
  attachmentLauncherIcon: {
    width: 46,
    height: 46,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#E5F8F2",
    borderWidth: 1,
    borderColor: "#D1F0E4",
  },
  attachmentLauncherCopy: { flex: 1, minWidth: 0, gap: 4 },
  attachmentLauncherTitle: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "800",
    color: "#193D37",
  },
  attachmentLauncherSubtitle: {
    fontSize: 12,
    lineHeight: 17,
    color: "#7A8B85",
  },
  attachmentLauncherAction: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#07876E",
  },
  attachmentModalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(14, 35, 31, 0.38)",
  },

  attachmentModalBackdrop: {
    ...StyleSheet.absoluteFill,
  },

  attachmentModalSheet: {
    width: "100%",
    height: "50%",
    maxHeight: "78%",
    minHeight: 320,
    flexShrink: 0,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 14,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    backgroundColor: "#F8FBFA",
    overflow: "hidden",
  },

  attachmentModalHandle: {
    alignSelf: "center",
    width: 42,
    height: 5,
    borderRadius: 99,
    backgroundColor: "#CFDCD6",
    marginBottom: 12,
  },

  attachmentModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 12,
  },

  attachmentModalTitle: {
    fontSize: 19,
    lineHeight: 25,
    fontWeight: "800",
    color: "#173D35",
    flexShrink: 1,
  },

  attachmentModalSubtitle: {
    fontSize: 12,
    lineHeight: 17,
    color: "#71827C",
    marginTop: 2,
  },

  attachmentModalClose: {
    width: 38,
    height: 38,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#EDF3F0",
    borderWidth: 1,
    borderColor: "#E1EAE5",
    flexShrink: 0,
  },

  attachmentModalScroll: {
    flexGrow: 0,
    flexShrink: 1,
    minHeight: 0,
  },

  attachmentModalScrollContent: {
    paddingBottom: 12,
    flexGrow: 1,
  },

  attachmentModalGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 9,
    width: "100%",
    alignItems: "stretch",
  },

  attachmentTile: {
    flexGrow: 1,
    flexBasis: "29%",
    minWidth: 85,
    minHeight: 100,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
    paddingVertical: 8,
    gap: 6,
    shadowColor: "#183B34",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 5,
    elevation: 1,
  },

  attachmentIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 13,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  attachmentTileLabel: {
    fontSize: 11,
    lineHeight: 15,
    fontWeight: "700",
    textAlign: "center",
    color: "#203D38",
    minHeight: 28,
  },

  attachmentTilePressed: {
    transform: [{ scale: 0.97 }],
    opacity: 0.92,
    shadowOpacity: 0.015,
    elevation: 0,
  },

  attachmentTileHint: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    marginTop: "auto",
  },

  attachmentTileHintText: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.25,
  },

  attachmentTray: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
    alignItems: "center",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#EAF0F3",
    padding: 8,
  },
  attachmentPreview: {
    width: 76,
    height: 82,
    borderRadius: 13,
    overflow: "hidden",
    backgroundColor: "#F3F6F8",
  },
  previewImage: { width: "100%", height: "100%" },
  filePreview: { alignItems: "center", justifyContent: "center", padding: 4 },
  previewLabel: {
    fontSize: 11,
    color: "#526171",
    textAlign: "center",
    marginTop: 3,
  },
  removeAttachment: {
    position: "absolute",
    top: 3,
    right: 3,
    width: 21,
    height: 21,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  addMore: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F0F3F5",
  },

  settingTilePressed: { opacity: 0.88, transform: [{ scale: 0.985 }] },
  settingTileTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  settingIcon: {
    width: 45,
    height: 45,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  settingArrow: {
    width: 27,
    height: 27,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  settingTextBlock: { gap: 4, minWidth: 0 },

  saveButton: {
    borderRadius: 25,
    overflow: "hidden",
    marginTop: 1,
    shadowColor: "#11B79B",
    shadowOffset: { width: 0, height: 7 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 4,
  },
  saveGradient: {
    minHeight: 72,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 13,
  },
  saveText: { color: "#FFFFFF", fontSize: 20, fontWeight: "800" },
  draftStatusRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  draftStatusText: { color: "#71827D", fontSize: 12 },
});

const styles = StyleSheet.create({
  hyperlinkOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 35, 30, 0.48)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },

  hyperlinkModal: {
    width: "100%",
    maxWidth: 460,
    maxHeight: "78%",
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 20,
    elevation: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 18,
  },

  hyperlinkHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 18,
  },

  hyperlinkHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: 12,
  },

  hyperlinkIcon: {
    width: 46,
    height: 46,
    borderRadius: 15,
    backgroundColor: "#E5F5EF",
    alignItems: "center",
    justifyContent: "center",
  },

  hyperlinkTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#172F2B",
  },

  hyperlinkSubtitle: {
    fontSize: 12,
    color: "#71827D",
    marginTop: 4,
  },

  hyperlinkClose: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: "#F2F7F4",
    alignItems: "center",
    justifyContent: "center",
  },

  hyperlinkCount: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    backgroundColor: "#EFF8F4",
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    marginBottom: 14,
  },

  hyperlinkCountText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#208A75",
  },

  hyperlinkScroll: {
    flexGrow: 0,
    marginBottom: 16,
  },

  hyperlinkItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 13,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: "#E4ECE7",
    backgroundColor: "#FFFFFF",
    marginBottom: 9,
    gap: 11,
  },

  hyperlinkItemSelected: {
    borderColor: "#208A75",
    backgroundColor: "#F0FAF6",
    borderWidth: 1.5,
  },

  hyperlinkNumber: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: "#F0F5F2",
    alignItems: "center",
    justifyContent: "center",
  },

  hyperlinkNumberSelected: {
    backgroundColor: "#208A75",
  },

  hyperlinkNumberText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#71827D",
  },

  hyperlinkNumberTextSelected: {
    color: "#FFFFFF",
  },

  hyperlinkContent: {
    flex: 1,
  },

  hyperlinkLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#263D36",
    marginBottom: 5,
  },

  hyperlinkUrl: {
    fontSize: 12,
    color: "#71827D",
    lineHeight: 18,
  },

  hyperlinkFooter: {
    flexDirection: "row",
    gap: 10,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: "#EAF0EC",
  },

  hyperlinkCancelButton: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    backgroundColor: "#F1F5F2",
    alignItems: "center",
    justifyContent: "center",
  },

  hyperlinkCancelText: {
    color: "#52645E",
    fontSize: 14,
    fontWeight: "700",
  },

  hyperlinkOpenButton: {
    flex: 1.4,
    height: 48,
    borderRadius: 14,
    backgroundColor: "#208A75",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },

  hyperlinkOpenDisabled: {
    backgroundColor: "#A8C9BD",
  },

  hyperlinkOpenText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
  },

  drawingScreen: {
    flex: 1,
    backgroundColor: "#F5FAF8",
  },

  drawingHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 14,
  },

  drawingHeaderButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: "#E8F4EF",
    alignItems: "center",
    justifyContent: "center",
  },

  drawingHeaderText: {
    justifyContent: "center",
  },

  drawingTitle: {
    fontSize: 19,
    fontWeight: "800",
    color: "#183D34",
  },

  drawingSubtitle: {
    fontSize: 12,
    color: "#758A83",
    marginTop: 3,
  },

  drawingSaveButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    minHeight: 40,
    paddingHorizontal: 13,
    borderRadius: 12,
    backgroundColor: "#18A98B",
  },

  drawingSaveButtonText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 13,
  },

  drawingToolbarCard: {
    marginHorizontal: 14,
    marginBottom: 12,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 17,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E3EEE9",
  },

  drawingToolbar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    gap: 4,
    paddingVertical: 5,
  },

  drawingToolButton: {
    minWidth: 38,
    height: 38,
    paddingHorizontal: 7,
    borderRadius: 11,
    backgroundColor: "#F3F7F5",
    alignItems: "center",
    justifyContent: "center",
  },

  drawingToolButtonActive: {
    backgroundColor: "#D9F5EA",
    borderWidth: 1,
    borderColor: "#18A98B",
  },

  drawingToolbarDivider: {
    width: 1,
    height: 25,
    backgroundColor: "#E2EAE6",
    marginHorizontal: 3,
  },

  drawingBrushControl: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    flexWrap: "wrap",
    gap: 7,
    paddingTop: 8,
    paddingBottom: 5,
  },

  drawingBrushLabel: {
    color: "#64776F",
    fontSize: 12,
    fontWeight: "700",
  },

  brushSizeOption: {
    width: 31,
    height: 31,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E1EAE5",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },

  brushSizeOptionActive: {
    borderColor: "#18A98B",
    backgroundColor: "#E0F7EE",
  },

  brushDot: {
    borderRadius: 20,
    backgroundColor: "#183D34",
  },

  drawingColorRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    flexWrap: "wrap",
    gap: 7,
  },

  drawingColorSwatch: {
    width: 23,
    height: 23,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#D5E0DA",
    alignItems: "center",
    justifyContent: "center",
  },

  drawingColorSwatchSelected: {
    borderWidth: 2,
    borderColor: "#18A98B",
    transform: [{ scale: 1.08 }],
  },

  handwritingEditorCard: {
    marginHorizontal: 14,
    marginBottom: 12,
    padding: 12,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E1EEE8",
    borderRadius: 17,
  },

  handwritingEditorHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 9,
  },

  handwritingEditorHeading: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },

  handwritingEditorTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#183D34",
  },

  handwritingEditorHint: {
    fontSize: 11,
    fontWeight: "600",
    color: "#16866F",
    backgroundColor: "#E6F7F0",
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 20,
  },

  handwritingTextInput: {
    minHeight: 58,
    maxHeight: 95,
    paddingHorizontal: 11,
    paddingVertical: 9,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: "#E5ECE8",
    backgroundColor: "#FAFCFB",
    color: "#183D34",
    fontSize: 16,
    lineHeight: 23,
    textAlignVertical: "top",
  },

  handwritingRecognitionStatus: {
    fontSize: 11,
    lineHeight: 16,
    color: "#64776F",
    marginTop: 6,
    marginBottom: 5,
  },

  handwritingConvertButton: {
    minHeight: 42,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 14,
    marginTop: 9,
    borderRadius: 11,
    backgroundColor: "#18A98B",
  },

  handwritingConvertButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },

  handwritingConvertButtonDisabled: {
    opacity: 0.55,
  },

  drawingCanvasHeading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginHorizontal: 17,
    marginBottom: 9,
  },

  drawingCanvasTitle: {
    color: "#183D34",
    fontSize: 14,
    fontWeight: "800",
  },

  drawingCanvasSubtitle: {
    color: "#82928B",
    fontSize: 11,
    marginTop: 3,
  },

  drawingCanvasBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: "#E5F7EF",
  },

  drawingCanvasBadgeDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#18A98B",
  },

  drawingCanvasBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#16866F",
  },

  drawingCanvasOuter: {
    flex: 1,
    minHeight: 120,
    marginHorizontal: 14,
    marginBottom: 10,
    borderRadius: 17,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#DCEAE3",
    backgroundColor: "#FFFFFF",
  },

  drawingCanvas: {
    flex: 1,
    width: "100%",
    minHeight: 120,
    backgroundColor: "#FFFFFF",
    overflow: "hidden",
  },

  drawingBottomActions: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 14,
    paddingTop: 5,
    paddingBottom: 10,
    backgroundColor: "#F5FAF8",
  },

  drawingTextAction: {
    flex: 1,
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: "#BCE7D8",
    backgroundColor: "#FFFFFF",
  },

  drawingTextActionLabel: {
    color: "#16866F",
    fontSize: 13,
    fontWeight: "800",
  },

  drawingImageAction: {
    flex: 1,
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 13,
    backgroundColor: "#18A98B",
  },

  drawingImageActionLabel: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "800",
  },

  /* Handwriting language and recognition */
  handwritingRecognitionBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 6,
    marginBottom: 6,
    backgroundColor: "#F0FAF6",
    borderRadius: 12,
  },

  reminderCard: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
    marginVertical: 8,
  },

  reminderHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 48,
  },

  reminderIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },

  reminderTitle: {
    fontSize: 15,
    fontWeight: "700",
  },

  reminderSubtitle: {
    fontSize: 12,
    marginTop: 4,
  },

  reminderDivider: {
    height: 1,
    marginVertical: 14,
  },

  repeatHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginBottom: 12,
  },

  repeatTitle: {
    fontSize: 13,
    fontWeight: "700",
  },

  repeatCurrent: {
    fontSize: 12,
    fontWeight: "700",
  },

  fontSizeControl: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "flex-start",
    padding: 5,
    gap: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#D7EDE1",
    backgroundColor: "#F1FAF5",
  },

  fontSizeButton: {
    width: 36,
    height: 36,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#DCEDE3",
  },

  fontSizeButtonDisabled: {
    backgroundColor: "#F0F3F1",
    borderColor: "#E7ECE8",
  },

  fontSizeButtonPressed: {
    backgroundColor: "#DDF3E6",
    transform: [{ scale: 0.94 }],
  },

  fontSizeValueBox: {
    minWidth: 44,
    height: 36,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
  },

  fontSizeText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#245C42",
    textAlign: "center",
  },

  fontSizeUnit: {
    fontSize: 10,
    fontWeight: "600",
    color: "#729581",
  },
  videoPreviewCard: {
    width: 220,
    marginTop: 12,
    padding: 8,
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#DCEAE5",
    overflow: "hidden",
  },
  videoPreview: {
    width: "100%",
    height: 150,
    borderRadius: 10,
    backgroundColor: "#111827",
  },
  videoPreviewCaption: {
    marginTop: 7,
    color: "#727C96",
    fontSize: 12,
    fontWeight: "600",
  },
  flex: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  loadingScreen: {
    flex: 1,
    backgroundColor: COLORS.background,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  loadingText: {
    color: COLORS.secondaryText,
    fontSize: 14,
    fontWeight: "500",
  },
  screen: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 42,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
    gap: 9,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#DCEAE5",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTextWrap: {
    flex: 1,
  },
  headerTitle: {
    color: COLORS.text,
    fontSize: 23,
    fontWeight: "800",
    letterSpacing: -0.8,
  },
  headerSubtitle: {
    marginTop: 3,
    color: COLORS.secondaryText,
    fontSize: 12,
  },
  headerIcon: {
    width: 44,
    height: 44,
    borderRadius: 15,
    backgroundColor: COLORS.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  heroCard: {
    minHeight: 158,
    borderRadius: 28,
    padding: 23,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 26,
    overflow: "hidden",
    elevation: 5,
    shadowColor: "#176B5D",
    shadowOffset: { width: 0, height: 7 },
    shadowOpacity: 0.16,
    shadowRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
  },
  heroCopy: {
    flex: 1,
    paddingRight: 10,
  },
  heroEyebrow: {
    color: "#DDF8EF",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.7,
  },
  heroTitle: {
    marginTop: 8,
    color: "#FFFFFF",
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: -0.7,
  },
  heroSubtitle: {
    marginTop: 7,
    color: "#E7FBF3",
    fontSize: 12,
    lineHeight: 19,
    maxWidth: 235,
  },
  heroIllustration: {
    width: 68,
    height: 68,
    borderRadius: 23,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  heroCheck: {
    position: "absolute",
    right: -3,
    bottom: -3,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  sectionHeading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  sectionTitle: {
    color: COLORS.text,
    fontSize: 17,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  requiredText: {
    color: COLORS.red,
    fontSize: 11,
    fontWeight: "600",
  },
  optionalText: {
    color: COLORS.secondaryText,
    fontSize: 11,
    fontWeight: "500",
  },
  colorModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.45)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  colorPaletteCard: {
    width: "100%",
    maxWidth: 340,
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 20,
    elevation: 10,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
  },
  spacingButtonLabel: {
    fontSize: 11,
    color: COLORS.secondaryText,
    marginLeft: 4,
  },
  colorPaletteHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 22,
  },
  colorPaletteTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#172F2B",
  },
  colorGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "flex-start",
    gap: 14,
  },
  colorSwatch: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "transparent",
  },
  selectedColorSwatch: {
    borderColor: "#64748B",
    transform: [{ scale: 1.12 }],
  },
  whiteColorSwatch: {
    borderColor: "#D1D5DB",
  },
  selectedColorLabel: {
    marginTop: 20,
    fontSize: 13,
    fontWeight: "600",
    color: "#64748B",
  },
  editorToolbar: {
    backgroundColor: "#F4F9F6",
    borderWidth: 1,
    borderColor: "#DCEAE5",
    borderRadius: 18,
    paddingVertical: 9,
    paddingHorizontal: 9,
    marginBottom: 15,
    gap: 5,
    width: "100%",
  },
  toolbarRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    minHeight: 42,
    paddingHorizontal: 2,
  },
  toolbarLabel: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1,
    color: "#8AA19A",
    marginRight: 3,
  },
  toolbarSeparator: {
    height: 1,
    backgroundColor: "#E0EBE6",
    marginHorizontal: 2,
  },
  spacingSettingLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: "#172F2B",
    marginTop: 12,
  },
  spacingSettingHint: {
    fontSize: 12,
    color: "#71827D",
    marginTop: 3,
  },
  spacingControlRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 18,
    marginTop: 12,
    marginBottom: 8,
  },
  spacingStepButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  spacingValue: {
    minWidth: 76,
    textAlign: "center",
    fontSize: 15,
    fontWeight: "700",
    color: "#172F2B",
    fontVariant: ["tabular-nums"],
  },
  spacingDivider: {
    height: 1,
    backgroundColor: "#E5EAF2",
    marginTop: 12,
  },
  spacingActionRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: 20,
  },
  spacingResetButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: "#F1F5F9",
  },
  spacingResetText: {
    color: "#475569",
    fontSize: 13,
    fontWeight: "600",
  },
  spacingDoneButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: "#239B83",
  },
  spacingDoneText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
  toolButton: {
    height: 36,
    minWidth: 36,
    paddingHorizontal: 9,
    borderRadius: 10,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#DCEAE5",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  toolButtonActive: {
    backgroundColor: "#DDF4EB",
    borderColor: "#A8DCCD",
  },
  toolText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#536A63",
  },

  characterCount: {
    fontSize: 11,
    color: "#8AA19A",
    paddingHorizontal: 4,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#DCEAE5",
    padding: 20,
    marginBottom: 22,
    shadowColor: "#176B5D",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.055,
    shadowRadius: 14,
    elevation: 2,
  },
  fieldLabel: {
    color: COLORS.secondaryText,
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 8,
  },
  titleInput: {
    minHeight: 43,
    color: COLORS.text,
    fontSize: 17,
    fontWeight: "600",
    paddingVertical: 8,
    paddingHorizontal: 0,
  },
  fieldDivider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: 17,
  },
  formatButton: {
    minWidth: 38,
    height: 38,
    paddingHorizontal: 10,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.muted,
    flexShrink: 0,
  },
  formatButtonActive: {
    backgroundColor: COLORS.primaryLight,
    borderWidth: 1,
    borderColor: "#A8DCCD",
  },
  quickNotePanel: {
    marginBottom: 16,
    padding: 15,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  quickNoteTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  quickNoteTitleWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flexShrink: 1,
  },
  quickNoteHeading: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "700",
  },
  quickNoteCaption: {
    color: COLORS.secondaryText,
    fontSize: 11,
    marginTop: 2,
  },
  quickModeButton: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 11,
    paddingVertical: 8,
  },
  quickModeButtonActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  quickModeButtonText: {
    color: COLORS.text,
    fontSize: 11,
    fontWeight: "700",
  },
  quickModeButtonTextActive: {
    color: "#FFFFFF",
  },
  quickNoteOptionsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginTop: 15,
  },
  quickNoteOptionLabel: {
    color: COLORS.secondaryText,
    fontSize: 12,
    fontWeight: "600",
  },
  quickNoteColors: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  quickNoteColorSwatch: {
    width: 25,
    height: 25,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#D7DCE6",
  },
  quickNoteColorSwatchSelected: {
    borderWidth: 2,
    borderColor: COLORS.primary,
  },
  pinQuickNoteButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 13,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  pinQuickNoteButtonActive: {
    opacity: 1,
  },
  pinQuickNoteText: {
    color: COLORS.secondaryText,
    fontSize: 12,
    fontWeight: "600",
  },
  descriptionHeadingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 8,
  },
  autoSaveStatus: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  autoSaveStatusText: {
    fontSize: 11,
    color: COLORS.secondaryText,
  },
  autoSaveStatusSaved: {
    color: COLORS.green,
  },
  autoSaveStatusError: {
    color: COLORS.red,
  },
  descriptionInput: {
    minHeight: 150,
    color: COLORS.text,
    lineHeight: 24,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E4E8F4",
    backgroundColor: "#FCFDFF",
  },
  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  scheduleLabelWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  fieldIcon: {
    width: 43,
    height: 43,
    borderRadius: 14,
    backgroundColor: COLORS.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  reminderIconBackground: {
    backgroundColor: COLORS.orangeLight,
  },
  scheduleTextWrap: {
    flex: 1,
  },
  dateValue: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: "700",
  },
  reminderValue: {
    color: COLORS.secondaryText,
    fontSize: 12,
    fontWeight: "500",
  },
  smallOutlineButton: {
    minWidth: 69,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: "#DCDDFE",
    backgroundColor: "#FAFAFF",
  },
  smallOutlineButtonText: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: "700",
  },
  dateInput: {
    color: COLORS.text,
    fontSize: 13,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 14,
    backgroundColor: "#FBFCFF",
  },
  quickDateRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 12,
  },
  quickDateButton: {
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: COLORS.muted,
  },
  quickDateButtonActive: {
    backgroundColor: COLORS.primaryLight,
  },
  quickDateText: {
    color: COLORS.secondaryText,
    fontSize: 11,
    fontWeight: "700",
  },
  characterCountEmpty: {
    color: "#64748B",
  },
  characterCountWarning: {
    color: "#D97706",
    backgroundColor: "#FEF3C7",
  },
  characterCountLimit: {
    color: "#DC2626",
    backgroundColor: "#FEE2E2",
  },
  quickDateTextActive: {
    color: COLORS.primary,
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginLeft: "auto",
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 20,
  },
  pendingPill: {
    backgroundColor: COLORS.greenLight,
  },
  overduePill: {
    backgroundColor: COLORS.redLight,
  },
  pendingDot: {
    backgroundColor: COLORS.green,
  },
  overdueDot: {
    backgroundColor: COLORS.red,
  },
  statusText: {
    fontSize: 10,
    fontWeight: "800",
  },
  pendingText: {
    color: COLORS.green,
  },
  overdueText: {
    color: COLORS.red,
  },
  removeReminder: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    marginTop: 12,
    paddingVertical: 4,
  },
  removeReminderText: {
    color: COLORS.red,
    fontSize: 12,
    fontWeight: "600",
  },
  attachmentGrid: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 20,
  },
  attachmentAction: {
    flex: 1,
    minHeight: 130,
    paddingHorizontal: 7,
    paddingVertical: 15,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  recordingAction: {
    borderColor: "#FFCACA",
    backgroundColor: "#FFF9F9",
  },
  attachmentIcon: {
    width: 46,
    height: 46,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  imageIconBackground: {
    backgroundColor: "#EAF1FF",
  },
  voiceIconBackground: {
    backgroundColor: "#F3E9FF",
  },
  recordingIconBackground: {
    backgroundColor: "#FFE6E6",
  },
  reminderAttachmentBackground: {
    backgroundColor: COLORS.orangeLight,
  },
  attachmentTitle: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: "800",
    textAlign: "center",
  },
  attachmentSubtitle: {
    color: COLORS.secondaryText,
    fontSize: 10,
    marginTop: 5,
    textAlign: "center",
  },
  previewCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 13,
    marginBottom: 14,
  },
  previewHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  previewTitleWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  previewTitle: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: "700",
  },
  removeButton: {
    width: 32,
    height: 32,
    borderRadius: 11,
    backgroundColor: COLORS.redLight,
    alignItems: "center",
    justifyContent: "center",
  },
  voicePreviewCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: COLORS.surface,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 13,
    marginBottom: 14,
  },
  voicePreviewIcon: {
    width: 43,
    height: 43,
    borderRadius: 14,
    backgroundColor: COLORS.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  hyperlinkInput: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: COLORS.text,
    fontSize: 15,
    marginTop: 16,
    marginBottom: 16,
  },
  fontModalTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: COLORS.text,
  },
  fontModalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: 10,
  },
  voicePreviewInfo: {
    flex: 1,
  },
  voicePreviewTitle: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: "800",
  },
  voicePreviewSubtitle: {
    color: COLORS.secondaryText,
    fontSize: 10,
    marginTop: 4,
  },
  errorHint: {
    color: COLORS.red,
    fontSize: 10,
    marginTop: 4,
  },
  playButton: {
    width: 39,
    height: 39,
    borderRadius: 14,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  tipCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    backgroundColor: "#DDF4EB",
    borderRadius: 17,
    padding: 15,
    marginTop: 5,
    marginBottom: 24,
  },
  tipIcon: {
    width: 35,
    height: 35,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  tipTextWrap: {
    flex: 1,
  },
  tipTitle: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: "800",
    marginBottom: 4,
  },
  tipText: {
    color: COLORS.secondaryText,
    fontSize: 11,
    lineHeight: 17,
  },
  footer: {
    flexDirection: "row",
    gap: 11,
    marginBottom: 15,
  },
  cancelButton: {
    minHeight: 53,
    minWidth: 105,
    paddingHorizontal: 18,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelButtonText: {
    color: COLORS.secondaryText,
    fontSize: 14,
    fontWeight: "700",
  },
  saveButton: {
    flex: 1,
    minHeight: 56,
    borderRadius: 17,
    backgroundColor: COLORS.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    paddingHorizontal: 15,
  },
  saveButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
  },
  disabledButton: {
    opacity: 0.55,
  },
  footerNote: {
    color: "#9AA2B5",
    textAlign: "center",
    fontSize: 11,
    marginBottom: 5,
  },
  formatButtonText: {
    color: COLORS.secondaryText,
    fontSize: 13,
    fontWeight: "600",
    flexShrink: 0,
  },
  boldText: {
    fontWeight: "900",
  },
  italicText: {
    fontStyle: "italic",
  },
  underlineText: {
    textDecorationLine: "underline",
  },
  formatButtonTextActive: {
    color: COLORS.primary,
  },
  noteMetaCard: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#DCEAE5",
    borderRadius: 18,
    paddingHorizontal: 15,
    paddingVertical: 8,
    marginTop: 16,
    marginBottom: 16,
    gap: 2,
    shadowColor: "#172F2B",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.035,
    shadowRadius: 8,
    elevation: 2,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    gap: 12,
  },
  metaIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "#E0F4EE",
    alignItems: "center",
    justifyContent: "center",
  },
  metaTextWrap: {
    flex: 1,
  },
  metaLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#8992A8",
    marginBottom: 3,
  },
  noteMetaText: {
    fontSize: 13,
    lineHeight: 19,
    color: "#27314D",
    fontWeight: "500",
  },
  autoSaveText: {
    fontSize: 12,
    lineHeight: 18,
    color: "#15966A",
    fontWeight: "600",
  },
  metaDivider: {
    height: 1,
    backgroundColor: "#EDF4F1",
    marginLeft: 50,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#15966A",
    marginRight: 3,
  },
  fontModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.55)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 22,
  },
  fontModalCard: {
    width: "100%",
    maxWidth: 400,
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 18,
    elevation: 12,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 18,
  },
  fontModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  fontOption: {
    minHeight: 54,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 15,
    paddingVertical: 12,
    marginBottom: 8,
    borderRadius: 14,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  fontOptionActive: {
    backgroundColor: "#EFF6FF",
    borderColor: "#93C5FD",
  },
  fontOptionText: {
    flex: 1,
    fontSize: 15,
    fontWeight: "500",
    color: "#475569",
    marginRight: 12,
  },
  fontOptionTextActive: {
    color: "#176B5D",
    fontWeight: "700",
  },
  drawingIconBackground: {
    backgroundColor: "#E5F8EF",
  },
  drawingPreview: {
    width: "100%",
    height: 220,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  editDrawingButton: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginTop: 10,
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: COLORS.primaryLight,
  },
  editDrawingButtonText: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: "700",
  },

  drawingScrollView: {
    flex: 1,
    width: "100%",
  },
  drawingScrollContent: {
    paddingBottom: 28,
    flexGrow: 1,
  },

  drawingWhiteSwatch: {
    borderColor: "#CBD5E1",
  },
  drawingColorHint: {
    color: "#7A859B",
    fontSize: 10,
    fontWeight: "700",
    marginLeft: "auto",
  },

  handwritingLanguageChoices: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  handwritingLanguageButton: {
    minHeight: 34,
    paddingHorizontal: 11,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#D6DDEB",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  handwritingLanguageButtonActive: {
    borderColor: COLORS.primary,
    backgroundColor: "#E0F4EE",
  },
  handwritingLanguageText: {
    color: "#71809A",
    fontSize: 12,
    fontWeight: "700",
  },
  handwritingLanguageTextActive: {
    color: COLORS.primary,
  },

  handwritingConvertButtonDisabled: {
    opacity: 0.6,
  },

  handwritingTextPanel: {
    backgroundColor: "#FFFFFF",
    borderRadius: 17,
    borderWidth: 1,
    borderColor: "#E2E8F2",
    padding: 12,
    marginBottom: 8,
    shadowColor: "#1E293B",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.035,
    shadowRadius: 6,
    elevation: 1,
  },
  handwritingTextLabel: {
    color: "#172F2B",
    fontSize: 12,
    fontWeight: "800",
    marginBottom: 8,
  },

  fontSizePanel: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: "#E5EFEC",
    gap: 20,
    shadowColor: "#173F38",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.06,
    shadowRadius: 14,
    elevation: 3,
  },

  fontSizeHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
  },

  fontSizeIconBox: {
    width: 52,
    height: 52,
    borderRadius: 17,
    backgroundColor: "#E7F7F2",
    alignItems: "center",
    justifyContent: "center",
  },

  fontSizeCopy: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },

  fontSizeTitle: {
    fontSize: 20,
    lineHeight: 27,
    fontWeight: "800",
    color: "#193D37",
    letterSpacing: -0.4,
  },

  fontSizeSubtitle: {
    fontSize: 15,
    lineHeight: 21,
    color: "#7A8C87",
  },

  fontSizeBadge: {
    width: 36,
    height: 36,
    borderRadius: 13,
    backgroundColor: "#F0F8F5",
    alignItems: "center",
    justifyContent: "center",
  },

  fontSizePreview: {
    backgroundColor: "#F5FAF8",
    borderRadius: 18,
    paddingVertical: 17,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: "#E7F0EC",
    gap: 13,
  },

  fontSizePreviewHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  fontSizePreviewLabel: {
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "800",
    letterSpacing: 1.1,
    color: "#83958F",
  },

  fontSizeValue: {
    fontSize: 15,
    lineHeight: 21,
    fontWeight: "800",
    color: "#138A78",
  },

  fontSizePreviewText: {
    color: "#254740",
    lineHeight: 1.5 * 18,
    fontWeight: "500",
  },

  fontSizeControlRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },

  fontSizeControlCopy: {
    flex: 1,
    gap: 5,
  },

  fontSizeControlTitle: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "800",
    color: "#24443E",
  },

  fontSizeControlSubtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: "#87958F",
  },

  fontSizeControls: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  disabledControl: {
    backgroundColor: "#F1F4F3",
    borderColor: "#E8EEEC",
    opacity: 0.8,
  },

  fontSizeControlValue: {
    minWidth: 34,
    textAlign: "center",
    fontSize: 20,
    lineHeight: 28,
    fontWeight: "800",
    color: "#193D37",
    fontVariant: ["tabular-nums"],
  },

  fontSizeRangeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  fontSizeRangeLabel: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "600",
    color: "#91A09B",
  },

  fontSizeRangeTrack: {
    flex: 1,
    height: 6,
    borderRadius: 99,
    backgroundColor: "#E8F0ED",
    overflow: "hidden",
  },

  fontSizeRangeFill: {
    height: "100%",
    borderRadius: 99,
    backgroundColor: "#20A58B",
  },

  handwritingTextHint: {
    color: "#8AA19A",
    fontSize: 10,
    lineHeight: 14,
    marginTop: 7,
  },
  handwritingLivePreview: {
    backgroundColor: "#EEF3FF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#DCEAE5",
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginBottom: 8,
    maxHeight: 78,
  },
  handwritingLivePreviewLabel: {
    color: "#71827D",
    fontSize: 10,
    fontWeight: "800",
    marginBottom: 4,
    textTransform: "uppercase",
    letterSpacing: 0.35,
  },
  handwritingLivePreviewText: {
    color: "#172F2B",
    fontSize: 14,
    lineHeight: 20,
    minHeight: 20,
  },

  drawingFooterHint: {
    color: "#8AA19A",
    fontSize: 10,
    lineHeight: 15,
    textAlign: "center",
    paddingTop: 7,
    paddingBottom: 10,
  },
});
