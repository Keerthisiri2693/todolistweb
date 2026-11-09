
import React, { useState, useCallback } from "react";

import {
  Pressable,
  Text,
  TextInput,
  View,
  StyleSheet,
  Platform,
  Keyboard,
} from "react-native";

import { Ionicons } from "@expo/vector-icons";
import { useSecurity } from "./SecurityProvider";

export default function ProtectedNoteContent({
  noteId,
  children,
}: {
  noteId: string;
  children: React.ReactNode;
}) {
  const { isNoteLocked, unlockNoteWithPin } = useSecurity();

  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const isDesktop = Platform.OS === "web";

  const locked = isNoteLocked(noteId);

  const handlePinChange = useCallback((value: string) => {
    setPin(value.replace(/\D/g, "").slice(0, 8));
    setError("");
  }, []);

  const unlock = async () => {
    if (busy) return;

    if (!/^\d{6,8}$/.test(pin)) {
      setError("Please enter your 6–8 digit security PIN.");
      return;
    }

    try {
      setBusy(true);
      setError("");

      const success = await unlockNoteWithPin(noteId, pin);

      if (!success) {
        setPin("");
        setError("Incorrect PIN. Please try again.");
        return;
      }

      setPin("");
      setError("");
      Keyboard.dismiss();

    } catch (err) {
      console.error("Protected note unlock error:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Unable to unlock note. Please try again."
      );
    } finally {
      setBusy(false);
    }
  };

  // Show protected content only after successful verification.
  if (!locked) {
    return <>{children}</>;
  }

  return (
    <View style={styles.container}>
      <View style={styles.lockIconContainer}>
        <Ionicons
          name="lock-closed"
          size={32}
          color="#059669"
        />
      </View>

      <Text style={styles.title}>
        Private note
      </Text>

      <Text style={styles.description}>
        This note is protected. Enter your security PIN
        to view its contents.
      </Text>

      <View style={styles.inputContainer}>
        <Ionicons
          name="keypad-outline"
          size={20}
          color="#718278"
        />

        <TextInput
          value={pin}
          onChangeText={handlePinChange}
          placeholder="Enter 6–8 digit PIN"
          placeholderTextColor="#94A3A8"
          keyboardType="number-pad"
          secureTextEntry
          maxLength={8}
          editable={!busy}
          autoComplete="off"
          textContentType="none"
          autoCorrect={false}
          style={styles.input}
          accessibilityLabel="Security PIN"
          onSubmitEditing={() => void unlock()}
          returnKeyType="done"
        />
      </View>

      {!!error && (
        <View style={styles.errorContainer}>
          <Ionicons
            name="alert-circle-outline"
            size={17}
            color="#DC2626"
          />

          <Text style={styles.errorText}>
            {error}
          </Text>
        </View>
      )}

      <Pressable
        onPress={() => void unlock()}
        disabled={busy}
        accessibilityRole="button"
        accessibilityLabel="Unlock private note"
        style={({ pressed }) => [
          styles.unlockButton,
          pressed && !busy && styles.pressedButton,
          busy && styles.disabledButton,
        ]}
      >
        {busy ? (
          <Text style={styles.buttonText}>
            Verifying PIN...
          </Text>
        ) : (
          <>
            <Ionicons
              name="lock-open-outline"
              size={19}
              color="#FFFFFF"
            />

            <Text style={styles.buttonText}>
              Unlock note
            </Text>
          </>
        )}
      </Pressable>

      <Text style={styles.footer}>
        Your private content will appear after verification.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    maxWidth: 480,
    alignSelf: "center",
    padding: 28,
    borderRadius: 18,
    backgroundColor: "#F3F8F5",
    borderWidth: 1,
    borderColor: "#DCEBE2",
    alignItems: "center",
    marginVertical: 16,
    marginHorizontal: 8,
  },

  lockIconContainer: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: "#DDF7EA",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },

  title: {
    fontSize: 21,
    fontWeight: "800",
    color: "#172B22",
    marginTop: 4,
  },

  description: {
    color: "#718278",
    textAlign: "center",
    marginTop: 9,
    lineHeight: 21,
    fontSize: 14,
  },

  inputContainer: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#DCEBE2",
    borderRadius: 12,
    paddingHorizontal: 14,
    marginTop: 22,
  },

  input: {
    flex: 1,
    paddingVertical: 15,
    paddingHorizontal: 12,
    color: "#172B22",
    fontSize: 16,
    textAlign: "center",
    outlineStyle: "none" as any,
  },

  errorContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    width: "100%",
    marginTop: 10,
  },

  errorText: {
    color: "#DC2626",
    fontSize: 13,
    flex: 1,
  },

  unlockButton: {
    width: "100%",
    backgroundColor: "#059669",
    padding: 15,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    marginTop: 18,
  },

  pressedButton: {
    opacity: 0.85,
  },

  disabledButton: {
    opacity: 0.6,
  },

  buttonText: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 15,
  },

  footer: {
    color: "#8A9A90",
    fontSize: 11,
    textAlign: "center",
    marginTop: 16,
  },
});
