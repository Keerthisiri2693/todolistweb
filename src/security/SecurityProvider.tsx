import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

import * as LocalAuthentication from "expo-local-authentication";
import { AppState, Platform } from "react-native";

import {
  type SecurityConfig,
  readLockedNoteIds,
  readSecurityConfig,
  removePattern,
  saveNewPattern,
  saveNewPin,
  verifyPattern as verifyStoredPattern,
  verifyPin as verifyStoredPin,
  writeLockedNoteIds,
  writeSecurityConfig,
} from "./security-store";

type SecurityContextValue = {
  ready: boolean;
  config: SecurityConfig;
  isLocked: boolean;
  lockedNoteIds: string[];
  isNoteLocked: (id: string) => boolean;

  setPin: (pin: string) => Promise<void>;
  unlockWithPin: (pin: string) => Promise<boolean>;
  unlockWithBiometrics: () => Promise<boolean>;
  changePin: (oldPin: string, newPin: string) => Promise<boolean>;

  setPattern: (pattern: number[]) => Promise<void>;
  unlockWithPattern: (pattern: number[]) => Promise<boolean>;
  removeAppPattern: () => Promise<void>;

  lockNote: (id: string) => Promise<void>;
  unlockNoteWithPin: (id: string, pin: string) => Promise<boolean>;

  updateSettings: (changes: Partial<SecurityConfig>) => Promise<void>;

  enableAppLock: () => Promise<void>;
  disableAppLock: () => Promise<void>;
  lockApp: () => void;

  // Temporarily suppress auto-lock for external activities.
  beginExternalActivity: () => void;
  endExternalActivity: () => void;
};

const SecurityContext = createContext<SecurityContextValue | null>(null);

const DEFAULT_CONFIG: SecurityConfig = {
  pinSalt: "",
  pinHash: "",
  patternSalt: "",
  patternHash: "",
  appLockEnabled: false,
  biometricEnabled: false,
  hidePrivatePreviews: true,
  autoLockEnabled: true,
};

export function SecurityProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);

  const [config, setConfig] = useState<SecurityConfig>(DEFAULT_CONFIG);

  const [isLocked, setIsLocked] = useState(false);

  const [lockedNoteIds, setLockedNoteIds] = useState<string[]>([]);

  const [unlockedNoteIds, setUnlockedNoteIds] = useState<string[]>([]);

  const configRef = useRef<SecurityConfig>(DEFAULT_CONFIG);

  const biometricInProgress = useRef(false);

  const appStateRef = useRef(AppState.currentState);

  // Prevent auto-lock while a system picker is open.
  const externalActivityInProgress = useRef(false);

  const beginExternalActivity = useCallback(() => {
    externalActivityInProgress.current = true;
  }, []);

  const endExternalActivity = useCallback(() => {
    externalActivityInProgress.current = false;
    appStateRef.current = AppState.currentState;
  }, []);

  // Keep the latest configuration available to callbacks.
  useEffect(() => {
    configRef.current = config;
  }, [config]);

  // A PIN or a pattern can unlock the app.
  const hasUnlockMethod = useCallback(
    (value: SecurityConfig) =>
      Boolean(
        (value.pinHash && value.pinSalt) ||
        (value.patternHash && value.patternSalt),
      ),
    [],
  );

  // Load saved security settings and note locks.
  useEffect(() => {
    let mounted = true;

    async function initialize() {
      try {
        const [savedConfig, savedNoteIds] = await Promise.all([
          readSecurityConfig(),
          readLockedNoteIds(),
        ]);

        if (!mounted) return;

        const initialConfig: SecurityConfig = {
          ...DEFAULT_CONFIG,
          ...savedConfig,
        };

        configRef.current = initialConfig;
        setConfig(initialConfig);

        setLockedNoteIds(Array.isArray(savedNoteIds) ? savedNoteIds : []);

        setIsLocked(
          Boolean(
            initialConfig.appLockEnabled && hasUnlockMethod(initialConfig),
          ),
        );
      } catch (error) {
        console.error("Failed to load security settings:", error);
      } finally {
        if (mounted) setReady(true);
      }
    }

    void initialize();

    return () => {
      mounted = false;
    };
  }, [hasUnlockMethod]);

  // Auto-lock when the app leaves the foreground,
  // except while the gallery or another external picker is open.
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      const previousState = appStateRef.current;

      const leavingForeground =
        previousState === "active" && nextState !== "active";

      if (leavingForeground) {
        const current = configRef.current;

        const shouldAutoLock =
          !externalActivityInProgress.current &&
          !biometricInProgress.current &&
          current.appLockEnabled &&
          current.autoLockEnabled &&
          hasUnlockMethod(current);

        if (shouldAutoLock) {
          setIsLocked(true);
        }

        if (!externalActivityInProgress.current) {
          setUnlockedNoteIds([]);
        }
      }

      appStateRef.current = nextState;
    });

    return () => subscription.remove();
  }, [hasUnlockMethod]);

  // Save configuration changes.
  const updateSettings = useCallback(
    async (changes: Partial<SecurityConfig>) => {
      const current = configRef.current;

      const next: SecurityConfig = {
        ...current,
        ...changes,
      };

      if (changes.appLockEnabled === true && !hasUnlockMethod(next)) {
        throw new Error(
          "Create a security PIN or pattern before enabling App Lock.",
        );
      }

      await writeSecurityConfig(next);

      configRef.current = next;
      setConfig(next);

      if (!next.appLockEnabled) {
        setIsLocked(false);
      }
    },
    [hasUnlockMethod],
  );

  // Enable app lock.
  const enableAppLock = useCallback(async () => {
    const current = configRef.current;

    if (!hasUnlockMethod(current)) {
      throw new Error("Please create a security PIN or pattern first.");
    }

    const next: SecurityConfig = {
      ...current,
      appLockEnabled: true,
    };

    await writeSecurityConfig(next);

    configRef.current = next;
    setConfig(next);
    setIsLocked(true);
  }, [hasUnlockMethod]);

  // Disable app lock without removing individual note locks.
  const disableAppLock = useCallback(async () => {
    const next: SecurityConfig = {
      ...configRef.current,
      appLockEnabled: false,
    };

    await writeSecurityConfig(next);

    configRef.current = next;
    setConfig(next);
    setIsLocked(false);
  }, []);

  // Set a new PIN.
  const setPin = useCallback(async (pin: string) => {
    if (!/^\d{6,8}$/.test(pin)) {
      throw new Error("PIN must contain 6–8 digits.");
    }

    await saveNewPin(pin);

    const next = await readSecurityConfig();

    configRef.current = next;
    setConfig(next);
    setIsLocked(false);
  }, []);

  // Unlock app with PIN.
  const unlockWithPin = useCallback(async (pin: string) => {
    const correct = await verifyStoredPin(pin);

    if (correct) {
      setIsLocked(false);
    }

    return correct;
  }, []);

  // Set or replace the pattern.
  const setPattern = useCallback(async (pattern: number[]) => {
    await saveNewPattern(pattern);

    const next = await readSecurityConfig();

    configRef.current = next;
    setConfig(next);
  }, []);

  // Unlock app with pattern.
  const unlockWithPattern = useCallback(async (pattern: number[]) => {
    const correct = await verifyStoredPattern(pattern);

    if (correct) {
      setIsLocked(false);
    }

    return correct;
  }, []);

  // Remove pattern. Disable app lock if no PIN remains.
  const removeAppPattern = useCallback(async () => {
    await removePattern();

    const saved = await readSecurityConfig();

    const hasPin = Boolean(saved.pinHash && saved.pinSalt);

    const next: SecurityConfig = {
      ...saved,
      appLockEnabled: hasPin ? saved.appLockEnabled : false,
      biometricEnabled: hasPin ? saved.biometricEnabled : false,
    };

    await writeSecurityConfig(next);

    configRef.current = next;
    setConfig(next);

    if (!next.appLockEnabled) {
      setIsLocked(false);
    }
  }, []);

  // Unlock app using device biometrics.
  const unlockWithBiometrics = useCallback(async () => {
    // Electron/Web does not provide Expo device biometrics.
    // Keep biometric authentication available on supported native devices.
    if (Platform.OS === "web") return false;

    const current = configRef.current;

    if (
      !current.biometricEnabled ||
      !current.appLockEnabled ||
      !(current.pinHash && current.pinSalt)
    ) {
      return false;
    }

    try {
      const hardwareAvailable = await LocalAuthentication.hasHardwareAsync();

      const enrolled = await LocalAuthentication.isEnrolledAsync();

      if (!hardwareAvailable || !enrolled) {
        return false;
      }

      biometricInProgress.current = true;

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: "Unlock your private notes",
        cancelLabel: "Use PIN",
        disableDeviceFallback: true,
        biometricsSecurityLevel: "strong",
      });

      if (result.success) {
        setIsLocked(false);
        return true;
      }

      return false;
    } catch (error) {
      console.warn("Biometric authentication failed:", error);

      return false;
    } finally {
      biometricInProgress.current = false;
    }
  }, []);

  // Change PIN after verifying the current PIN.
  const changePin = useCallback(async (oldPin: string, newPin: string) => {
    if (!/^\d{6,8}$/.test(newPin)) {
      throw new Error("PIN must contain 6–8 digits.");
    }

    const correct = await verifyStoredPin(oldPin);

    if (!correct) return false;

    await saveNewPin(newPin);

    const next = await readSecurityConfig();

    configRef.current = next;
    setConfig(next);

    return true;
  }, []);

  // Lock an individual note.
  const lockNote = useCallback(
    async (id: string) => {
      const noteId = String(id).trim();

      if (!noteId) {
        throw new Error("A valid note ID is required.");
      }

      const next = [...new Set([...lockedNoteIds, noteId])];

      await writeLockedNoteIds(next);
      setLockedNoteIds(next);

      setUnlockedNoteIds((previous) =>
        previous.filter((item) => item !== noteId),
      );
    },
    [lockedNoteIds],
  );

  // Unlock an individual note using the PIN.
  const unlockNoteWithPin = useCallback(async (id: string, pin: string) => {
    const correct = await verifyStoredPin(pin);

    if (!correct) return false;

    setUnlockedNoteIds((previous) =>
      previous.includes(id) ? previous : [...previous, id],
    );

    return true;
  }, []);

  const isNoteLocked = useCallback(
    (id: string) => lockedNoteIds.includes(id) && !unlockedNoteIds.includes(id),
    [lockedNoteIds, unlockedNoteIds],
  );

  // Manually lock the app.
  const lockApp = useCallback(() => {
    const current = configRef.current;

    if (current.appLockEnabled && hasUnlockMethod(current)) {
      setIsLocked(true);
    }

    setUnlockedNoteIds([]);
  }, [hasUnlockMethod]);

  const value: SecurityContextValue = {
    ready,
    config,
    isLocked,
    lockedNoteIds,
    isNoteLocked,

    setPin,
    unlockWithPin,
    unlockWithBiometrics,
    changePin,

    setPattern,
    unlockWithPattern,
    removeAppPattern,

    lockNote,
    unlockNoteWithPin,

    updateSettings,
    enableAppLock,
    disableAppLock,
    lockApp,

    beginExternalActivity,
    endExternalActivity,
  };

  return (
    <SecurityContext.Provider value={value}>
      {children}
    </SecurityContext.Provider>
  );
}

export function useSecurity() {
  const value = useContext(SecurityContext);

  if (!value) {
    throw new Error("useSecurity must be used inside SecurityProvider.");
  }

  return value;
}
