import * as FileSystem from "expo-file-system/legacy";
import * as SQLite from "expo-sqlite";
import { Platform } from "react-native";

const dbPromise = SQLite.openDatabaseAsync("appOffline.db");

export type PendingRegistration = {
  id: string;
  userId: string;
  userName: string;
  email: string;
  description: string;
  imageUri: string | null;
  createdAt: string;
};

export type SavePendingRegistrationInput = {
  userId: string;
  userName: string;
  email: string;
  description?: string;
  imageUri?: string | null;
};

let initialized = false;

export async function initOfflineRegistration(): Promise<void> {
  if (initialized) return;

  const db = await dbPromise;

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS pending_registrations (
      id TEXT PRIMARY KEY NOT NULL,
      userId TEXT NOT NULL,
      userName TEXT NOT NULL,
      email TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      imageUri TEXT,
      createdAt TEXT NOT NULL
    );
  `);

  initialized = true;
}

async function persistImage(
  imageUri: string | null | undefined,
  id: string,
): Promise<string | null> {
  if (!imageUri) return null;

  // Web/Desktop browser: keep the URI supplied by the picker.
  // Blob/data URLs may not persist after a page reload, so for
  // durable offline images, store image bytes in IndexedDB or
  // another persistent file store.
  if (Platform.OS === "web") {
    return imageUri;
  }

  const directory = `${FileSystem.documentDirectory}pendingProfiles/`;

  await FileSystem.makeDirectoryAsync(directory, {
    intermediates: true,
  });

  const extension = imageUri.split("?")[0].split(".").pop()?.toLowerCase();
  const safeExtension =
    extension && /^[a-z0-9]{1,5}$/.test(extension) ? extension : "jpg";

  const destination = `${directory}${id}.${safeExtension}`;

  await FileSystem.copyAsync({
    from: imageUri,
    to: destination,
  });

  return destination;
}

export async function savePendingRegistration(
  data: SavePendingRegistrationInput,
): Promise<string> {
  await initOfflineRegistration();

  const userId = data.userId.trim();
  const userName = data.userName.trim();
  const email = data.email.trim().toLowerCase();

  if (!userId || !userName || !email) {
    throw new Error("User ID, name and email are required.");
  }

  const db = await dbPromise;
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

  const savedImageUri = await persistImage(data.imageUri, id);

  await db.runAsync(
    `INSERT INTO pending_registrations
      (id, userId, userName, email, description, imageUri, createdAt)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      userId,
      userName,
      email,
      data.description?.trim() ?? "",
      savedImageUri,
      new Date().toISOString(),
    ],
  );

  return id;
}

export async function getPendingRegistrations(): Promise<
  PendingRegistration[]
> {
  await initOfflineRegistration();

  const db = await dbPromise;

  return db.getAllAsync<PendingRegistration>(
    `SELECT id, userId, userName, email, description, imageUri, createdAt
     FROM pending_registrations
     ORDER BY createdAt ASC`,
  );
}

export async function removePendingRegistration(id: string): Promise<void> {
  await initOfflineRegistration();

  const db = await dbPromise;

  await db.runAsync("DELETE FROM pending_registrations WHERE id = ?", [id]);
}
