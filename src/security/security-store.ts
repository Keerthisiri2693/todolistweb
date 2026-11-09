import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Crypto from "expo-crypto";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const CONFIG_KEY = "notes.security.config.v1";
const LOCKED_NOTES_KEY = "notes.security.locked-ids.v1";

export type SecurityConfig = {
  pinSalt: string;
  pinHash: string;

  patternSalt: string;
  patternHash: string;

  appLockEnabled: boolean;
  biometricEnabled: boolean;
  hidePrivatePreviews: boolean;
  autoLockEnabled: boolean;
};

const DEFAULT_CONFIG: SecurityConfig = {
  pinSalt: "",
  pinHash: "",
  patternSalt: "",
  patternHash: "",
  appLockEnabled: true,
  biometricEnabled: false,
  hidePrivatePreviews: true,
  autoLockEnabled: true,
};

// =====================================================
// PLATFORM-AWARE STORAGE
// Android: Expo SecureStore
// Electron / Expo Web: AsyncStorage
// =====================================================

const SecurityStorage = {
  async getItem(key: string): Promise<string | null> {
    try {
      if (Platform.OS === "web") {
        return await AsyncStorage.getItem(key);
      }

      return await SecureStore.getItemAsync(key);
    } catch (error) {
      console.error("Security storage read failed:", error);
      throw error;
    }
  },

  async setItem(key: string, value: string): Promise<void> {
    try {
      if (Platform.OS === "web") {
        await AsyncStorage.setItem(key, value);
        return;
      }

      await SecureStore.setItemAsync(key, value);
    } catch (error) {
      console.error("Security storage write failed:", error);
      throw error;
    }
  },

  async removeItem(key: string): Promise<void> {
    try {
      if (Platform.OS === "web") {
        await AsyncStorage.removeItem(key);
        return;
      }

      await SecureStore.deleteItemAsync(key);
    } catch (error) {
      console.error("Security storage delete failed:", error);
      throw error;
    }
  },
};

// =====================================================
// SECURITY CONFIG
// =====================================================

export async function readSecurityConfig(): Promise<SecurityConfig> {
  try {
    const raw = await SecurityStorage.getItem(CONFIG_KEY);

    if (!raw) {
      return { ...DEFAULT_CONFIG };
    }

    const parsed = JSON.parse(raw) as Partial<SecurityConfig>;

    return {
      ...DEFAULT_CONFIG,
      ...parsed,
      pinSalt: parsed.pinSalt ?? "",
      pinHash: parsed.pinHash ?? "",
      patternSalt: parsed.patternSalt ?? "",
      patternHash: parsed.patternHash ?? "",
    };
  } catch (error) {
    console.error("Unable to read security settings:", error);
    throw error;
  }
}

export async function writeSecurityConfig(
  config: SecurityConfig,
): Promise<void> {
  await SecurityStorage.setItem(CONFIG_KEY, JSON.stringify(config));
}

// =====================================================
// CRYPTOGRAPHY
// =====================================================

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function createVerifier(
  value: string,
  salt?: string,
): Promise<{ salt: string; hash: string }> {
  const actualSalt = salt ?? bytesToHex(await Crypto.getRandomBytesAsync(16));

  const hash = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    `${actualSalt}:${value}`,
  );

  return {
    salt: actualSalt,
    hash,
  };
}

// =====================================================
// PIN PROTECTION
// =====================================================

export async function createPinVerifier(
  pin: string,
  salt?: string,
): Promise<{ salt: string; hash: string }> {
  return createVerifier(pin, salt);
}

export async function verifyPin(pin: string): Promise<boolean> {
  const config = await readSecurityConfig();

  if (!config.pinHash || !config.pinSalt) {
    return false;
  }

  const result = await createPinVerifier(pin, config.pinSalt);

  return result.hash === config.pinHash;
}

export async function saveNewPin(pin: string): Promise<void> {
  if (!/^\d{6,8}$/.test(pin)) {
    throw new Error("PIN must contain 6–8 digits.");
  }

  const result = await createPinVerifier(pin);

  const previous = await readSecurityConfig();

  await writeSecurityConfig({
    ...previous,
    pinSalt: result.salt,
    pinHash: result.hash,
    appLockEnabled: true,
  });
}

// =====================================================
// PATTERN LOCK
// =====================================================

function normalizePattern(pattern: number[]): string {
  if (
    !Array.isArray(pattern) ||
    pattern.length < 4 ||
    pattern.length > 9 ||
    pattern.some(
      (point) => !Number.isInteger(point) || point < 0 || point > 8,
    ) ||
    new Set(pattern).size !== pattern.length
  ) {
    throw new Error("Draw a pattern using at least 4 different dots.");
  }

  return pattern.join("-");
}

export async function saveNewPattern(pattern: number[]): Promise<void> {
  const normalized = normalizePattern(pattern);

  const result = await createVerifier(normalized);

  const previous = await readSecurityConfig();

  await writeSecurityConfig({
    ...previous,
    patternSalt: result.salt,
    patternHash: result.hash,
    appLockEnabled: true,
  });
}

export async function verifyPattern(pattern: number[]): Promise<boolean> {
  let normalized: string;

  try {
    normalized = normalizePattern(pattern);
  } catch {
    return false;
  }

  const config = await readSecurityConfig();

  if (!config.patternSalt || !config.patternHash) {
    return false;
  }

  const result = await createVerifier(normalized, config.patternSalt);

  return result.hash === config.patternHash;
}

export async function removePattern(): Promise<void> {
  const previous = await readSecurityConfig();

  await writeSecurityConfig({
    ...previous,
    patternSalt: "",
    patternHash: "",
  });
}

// =====================================================
// LOCKED NOTES
// =====================================================

export async function readLockedNoteIds(): Promise<string[]> {
  try {
    const raw = await SecurityStorage.getItem(LOCKED_NOTES_KEY);

    const parsed: unknown = raw ? JSON.parse(raw) : [];

    return Array.isArray(parsed)
      ? parsed.filter((id): id is string => typeof id === "string")
      : [];
  } catch (error) {
    console.error("Unable to read locked notes:", error);
    throw error;
  }
}

export async function writeLockedNoteIds(ids: string[]): Promise<void> {
  const uniqueIds = [...new Set(ids)];

  await SecurityStorage.setItem(LOCKED_NOTES_KEY, JSON.stringify(uniqueIds));
}
