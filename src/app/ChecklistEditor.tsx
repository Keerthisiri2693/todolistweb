import { Ionicons } from "@expo/vector-icons";
import { useRef } from "react";
import {
    Platform,
    Pressable,
    StyleSheet,
    TextInput,
    useWindowDimensions,
    View,
} from "react-native";

type Props = {
  value: string;
  onChangeText: (value: string) => void;
  fontSize: number;
  textColor: string;
  lineHeight: number;
  fontFamily?: string;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strikethrough: boolean;
  alignment: "left" | "center" | "right" | "justify";
  placeholder?: string;
};

export default function ChecklistEditor({
  value,
  onChangeText,
  fontSize,
  textColor,
  lineHeight,
  fontFamily,
  bold,
  italic,
  underline,
  strikethrough,
  alignment,
  placeholder = "Write your note here...",
}: Props) {
  const refs = useRef<Record<number, TextInput | null>>({});
  const { width } = useWindowDimensions();

  const isDesktop = Platform.OS === "web" && width >= 900;
  const isWideDesktop = Platform.OS === "web" && width >= 1400;

  const lines = value.split("\n");

  const isItem = (line: string) => /^[ \t]*[☐☑] /.test(line);

  const toggleItem = (index: number) => {
    const next = [...lines];
    const line = next[index];

    if (!isItem(line)) return;

    next[index] = line.replace(/^([ \t]*)☐ /, "$1☑ ");

    if (next[index] === line) {
      next[index] = line.replace(/^([ \t]*)☑ /, "$1☐ ");
    }

    onChangeText(next.join("\n"));
  };

  const updateLine = (index: number, text: string) => {
    const next = [...lines];
    const oldLine = next[index];

    if (isItem(oldLine)) {
      const prefix = oldLine.match(/^[ \t]*[☐☑] /)?.[0] ?? "☐ ";

      next[index] = prefix + text;
    } else {
      next[index] = text;
    }

    onChangeText(next.join("\n"));
  };

  const submitLine = (index: number) => {
    const next = [...lines];

    if (isItem(next[index])) {
      next.splice(index + 1, 0, "☐ ");
    } else {
      next.splice(index + 1, 0, "");
    }

    onChangeText(next.join("\n"));

    requestAnimationFrame(() => {
      refs.current[index + 1]?.focus();
    });
  };

  return (
    <View
      style={[
        styles.container,
        isDesktop && styles.desktopContainer,
        isWideDesktop && styles.wideDesktopContainer,
      ]}
    >
      {lines.map((line, index) => {
        const checklist = isItem(line);
        const checked = /^[ \t]*☑ /.test(line);

        const text = checklist ? line.replace(/^[ \t]*[☐☑] /, "") : line;

        return (
          <View
            key={index}
            style={[
              styles.row,
              isDesktop && styles.desktopRow,
              isWideDesktop && styles.wideDesktopRow,
              checked && isDesktop && styles.checkedRow,
            ]}
          >
            {checklist && (
              <Pressable
                style={[styles.checkbox, isDesktop && styles.desktopCheckbox]}
                onPress={() => toggleItem(index)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked }}
                accessibilityLabel={`Checklist item ${index + 1}`}
              >
                <View
                  style={[
                    styles.checkboxIconWrapper,
                    isDesktop && styles.desktopCheckboxIconWrapper,
                    checked && styles.checkedCheckboxWrapper,
                  ]}
                >
                  <Ionicons
                    name={checked ? "checkbox" : "square-outline"}
                    size={isDesktop ? 23 : 22}
                    color={checked ? "#16866A" : "#87929E"}
                  />
                </View>
              </Pressable>
            )}

            <TextInput
              ref={(ref) => {
                refs.current[index] = ref;
              }}
              value={text}
              onChangeText={(v) => updateLine(index, v)}
              onSubmitEditing={() => submitLine(index)}
              placeholder={index === 0 && !checklist ? placeholder : ""}
              placeholderTextColor="#A0A8B4"
              returnKeyType="next"
              blurOnSubmit={false}
              multiline={false}
              style={[
                styles.input,
                isDesktop && styles.desktopInput,
                {
                  fontSize: isDesktop ? Math.max(fontSize, 16) : fontSize,
                  color: textColor,
                  lineHeight: isDesktop ? Math.max(lineHeight, 26) : lineHeight,
                  fontFamily:
                    !fontFamily || fontFamily === "System"
                      ? undefined
                      : fontFamily,
                  fontWeight: bold ? "700" : "400",
                  fontStyle: italic ? "italic" : "normal",
                  textDecorationLine: checked
                    ? "line-through"
                    : underline
                      ? "underline"
                      : strikethrough
                        ? "line-through"
                        : "none",
                  textAlign: alignment,
                },
              ]}
            />
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: "100%",
  },

  desktopContainer: {
    width: "100%",
    maxWidth: 1080,
    alignSelf: "center",
    paddingHorizontal: 8,
    paddingVertical: 8,
    gap: 5,
  },

  wideDesktopContainer: {
    maxWidth: 1240,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 7,
  },

  row: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 42,
  },

  desktopRow: {
    minHeight: 50,
    paddingHorizontal: 9,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: "#E3F0E9",
    backgroundColor: "#FBFEFC",
  },

  wideDesktopRow: {
    minHeight: 54,
    paddingHorizontal: 12,
    borderRadius: 11,
  },

  checkedRow: {
    backgroundColor: "#F0F8F3",
    borderColor: "#DCEEE3",
  },

  checkbox: {
    width: 36,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
  },

  desktopCheckbox: {
    width: 46,
    height: 50,
    marginRight: 5,
  },

  checkboxIconWrapper: {
    width: 30,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 7,
  },

  desktopCheckboxIconWrapper: {
    width: 34,
    height: 34,
    borderRadius: 9,
  },

  checkedCheckboxWrapper: {
    backgroundColor: "#E2F5EA",
  },

  input: {
    flex: 1,
    minHeight: 42,
    paddingHorizontal: 3,
    paddingVertical: 7,
    textAlignVertical: "center",
    outlineStyle: "none",
  } as any,

  desktopInput: {
    minHeight: 48,
    paddingHorizontal: 9,
    paddingVertical: 10,
  },
});
