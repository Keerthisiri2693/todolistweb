// quickNoteService.js
// Dedicated Quick Notes API + offline queue.
// Keeps the offline queue and the list displayed by ViewTodolistScreen in sync.

import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";

export const QUICK_NOTE_QUEUE_KEY = "quick-notes-offline-queue";
export const LOCAL_QUICK_NOTES_KEY = "local-quick-notes";

export const DEFAULT_QUICK_NOTE_API_URL =
  "https://todolistbackend-855c.onrender.com/api/createTodolist";

async function readArray(key) {
  const raw = await AsyncStorage.getItem(key);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.warn(`[QuickNoteService] Invalid JSON at "${key}":`, error);
    return [];
  }
}

async function writeArray(key, value) {
  await AsyncStorage.setItem(key, JSON.stringify(value));
}

async function readQueue() {
  return readArray(QUICK_NOTE_QUEUE_KEY);
}

async function upsertLocalQuickNote(note) {
  if (!note?.id && !note?._id) return;

  const id = String(note.id || note._id);
  const existing = await readArray(LOCAL_QUICK_NOTES_KEY);
  const index = existing.findIndex((entry) =>
    [entry?.id, entry?._id, entry?.tdlId]
      .filter(Boolean)
      .some((value) => String(value) === id),
  );

  const merged = {
    ...(index >= 0 ? existing[index] : {}),
    ...note,
    id,
    _id: String(note._id || id),
    isQuickNote: true,
    type: ["quick-note"],
  };

  if (index >= 0) existing[index] = merged;
  else existing.unshift(merged);

  await writeArray(LOCAL_QUICK_NOTES_KEY, existing);
  return merged;
}

async function updateLocalNoteAfterSync(localNote, serverId) {
  const localId = String(localNote.id || localNote._id || "");
  const queueUserId = localNote.userId ? String(localNote.userId) : "";
  const notes = await readArray(LOCAL_QUICK_NOTES_KEY);

  const index = notes.findIndex((entry) => {
    const entryIds = [entry?.id, entry?._id, entry?.tdlId]
      .filter(Boolean)
      .map(String);
    const matchesId = localId && entryIds.includes(localId);
    const matchesUser =
      !queueUserId || !entry?.userId || String(entry.userId) === queueUserId;
    return matchesId && matchesUser;
  });

  // Keep image/theme fields from the local record; servers often omit local file URIs.
  if (index >= 0) {
    notes[index] = {
      ...notes[index],
      ...localNote,
      id: localId || String(serverId),
      _id: localId || String(serverId),
      serverTodoId: String(serverId),
      localOnly: false,
      offlinePending: false,
      syncStatus: "synced",
      isQuickNote: true,
      type: ["quick-note"],
      updatedAt: new Date().toISOString(),
    };
    await writeArray(LOCAL_QUICK_NOTES_KEY, notes);
  } else {
    await upsertLocalQuickNote({
      ...localNote,
      id: localId || String(serverId),
      _id: localId || String(serverId),
      serverTodoId: String(serverId),
      localOnly: false,
      offlinePending: false,
      syncStatus: "synced",
    });
  }
}

export async function getQueuedQuickNotes() {
  return readQueue();
}

// Compatibility alias: older components call getPendingQuickNotes().
export async function getPendingQuickNotes() {
  return getQueuedQuickNotes();
}

export async function removePendingQuickNote(id) {
  try {
    const raw = await AsyncStorage.getItem(QUICK_NOTE_QUEUE_KEY);
    const queue = raw ? JSON.parse(raw) : [];

    if (!Array.isArray(queue)) return;

    const updated = queue.filter(
      (note) => String(note.id || note._id) !== String(id),
    );

    await AsyncStorage.setItem(QUICK_NOTE_QUEUE_KEY, JSON.stringify(updated));
  } catch (error) {
    console.warn("[QuickNote] Failed to remove queued note:", error);
    throw error;
  }
}

export async function queueQuickNote(note) {
  const id = String(note?.id || note?._id || "").trim();
  if (!id) throw new Error("A local Quick Note id is required.");

  const item = {
    ...note,
    id,
    _id: String(note?._id || id),
    isQuickNote: true,
    type: ["quick-note"],
    operation: "create",
    syncStatus: "pending",
    offlinePending: true,
    localOnly: true,
    queuedAt: note?.queuedAt || new Date().toISOString(),
  };

  const queue = await readQueue();
  const index = queue.findIndex(
    (entry) => String(entry?.id || entry?._id) === id,
  );

  if (index >= 0) queue[index] = { ...queue[index], ...item };
  else queue.push(item);

  await writeArray(QUICK_NOTE_QUEUE_KEY, queue);
  await upsertLocalQuickNote(item);
  return item;
}

function getToken(authToken, storedToken) {
  const value = String(authToken || storedToken || "").trim();
  if (!value) return null;
  return value.toLowerCase().startsWith("bearer ") ? value : `Bearer ${value}`;
}

function extractSavedRecord(result) {
  return (
    result?.task ??
    result?.todo ??
    result?.data?.task ??
    result?.data?.todo ??
    result?.data ??
    result?.todolist ??
    result?.result ??
    result
  );
}

function extractServerId(result) {
  const saved = extractSavedRecord(result);
  return String(
    saved?.tdlId ??
      saved?._id ??
      saved?.id ??
      saved?.todoId ??
      result?.tdlId ??
      result?.todoId ??
      result?.id ??
      "",
  ).trim();
}

async function postQuickNote({ apiUrl, payload, userId, token }) {
  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: token } : {}),
    },
    body: JSON.stringify({
      ...payload,
      userId,
      noteType: payload?.noteType || "quickNote",
      isQuickNote: true,
    }),
  });

  const body = await response.json().catch(() => ({}));

  if (!response.ok || body?.success !== true) {
    const message = Array.isArray(body?.errors)
      ? body.errors.join("\n")
      : body?.message ||
        body?.error ||
        `Could not save Quick Note (HTTP ${response.status}).`;
    const error = new Error(message);
    error.status = response.status;
    error.responseBody = body;
    throw error;
  }

  return body;
}

/**
 * Save online when possible; queue on offline/network failures.
 * Server/API errors are thrown rather than silently queued.
 */
export async function saveQuickNote({
  note,
  payload = note,
  userId,
  authToken,
  apiUrl = DEFAULT_QUICK_NOTE_API_URL,
}) {
  if (!userId) throw new Error("Sign in before creating a Quick Note.");
  if (!payload) throw new Error("Quick Note payload is required.");

  const localId = String(
    note?.id || note?._id || payload?.id || payload?._id || "",
  ).trim();
  if (!localId) throw new Error("A local Quick Note id is required.");

  const localNote = {
    ...note,
    ...payload,
    id: localId,
    _id: String(note?._id || payload?._id || localId),
    userId: String(userId),
    isQuickNote: true,
    type: ["quick-note"],
    localOnly: true,
    offlinePending: true,
    createdAt:
      note?.createdAt || payload?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const network = await NetInfo.fetch();
  const online =
    network.isConnected === true && network.isInternetReachable !== false;

  if (!online) {
    const queued = await queueQuickNote(localNote);
    return { status: "queued", note: queued };
  }

  const storedToken =
    authToken ||
    (await AsyncStorage.getItem("login_token")) ||
    (await AsyncStorage.getItem("token"));
  const token = getToken(authToken, storedToken);

  if (!token) {
    // Preserve the note locally rather than losing the user's work.
    const queued = await queueQuickNote(localNote);
    return {
      status: "queued",
      note: queued,
      reason: "Sign in again before syncing this Quick Note.",
    };
  }

  let result;
  try {
    result = await postQuickNote({ apiUrl, payload, userId, token });
  } catch (error) {
    // Queue only transport failures. Explicit HTTP/API errors should be shown.
    if (typeof error?.status === "number") throw error;
    const queued = await queueQuickNote(localNote);
    return { status: "queued", note: queued, reason: error?.message };
  }

  const serverId = extractServerId(result);
  if (!serverId) {
    // Avoid losing the local copy if the backend responds without an ID.
    const queued = await queueQuickNote(localNote);
    return {
      status: "queued",
      note: queued,
      reason: "The server returned success without a note ID.",
      response: result,
    };
  }

  const saved = {
    ...localNote,
    ...extractSavedRecord(result),
    id: localId,
    _id: localNote._id,
    serverTodoId: serverId,
    localOnly: false,
    offlinePending: false,
    syncStatus: "synced",
    isQuickNote: true,
    type: ["quick-note"],
  };

  await upsertLocalQuickNote(saved);

  // Remove any stale queued copy for this local ID.
  const queue = await readQueue();
  await writeArray(
    QUICK_NOTE_QUEUE_KEY,
    queue.filter((entry) => String(entry?.id || entry?._id) !== localId),
  );

  return { status: "saved", response: result, note: saved };
}

/** Sync queued notes; failed entries remain queued for a later retry. */
export async function syncQueuedQuickNotes({
  userId,
  authToken,
  apiUrl = DEFAULT_QUICK_NOTE_API_URL,
} = {}) {
  if (!userId) userId = await AsyncStorage.getItem("userId");
  if (!userId) throw new Error("Sign in before syncing Quick Notes.");

  const network = await NetInfo.fetch();
  const queue = await readQueue();

  if (network.isConnected !== true || network.isInternetReachable === false) {
    return { synced: 0, remaining: queue.length, offline: true };
  }

  const storedToken =
    authToken ||
    (await AsyncStorage.getItem("login_token")) ||
    (await AsyncStorage.getItem("token"));
  const token = getToken(authToken, storedToken);

  if (!token) {
    return {
      synced: 0,
      remaining: queue.length,
      offline: false,
      needsLogin: true,
    };
  }

  const remaining = [];
  let synced = 0;

  for (const item of queue) {
    if (!item || (!item.id && !item._id)) continue;

    // Do not sync a note belonging to a different account.
    if (item.userId && String(item.userId) !== String(userId)) {
      remaining.push(item);
      continue;
    }

    try {
      const result = await postQuickNote({
        apiUrl,
        payload: item,
        userId: item.userId || userId,
        token,
      });

      const serverId = extractServerId(result);
      if (!serverId) {
        throw new Error("Server returned success without a note ID.");
      }

      await updateLocalNoteAfterSync(item, serverId);
      synced += 1;
    } catch (error) {
      remaining.push({
        ...item,
        syncStatus: "pending",
        offlinePending: true,
        lastSyncError: error?.message || "Sync failed",
        lastSyncAttemptAt: new Date().toISOString(),
      });

      console.warn("[QuickNoteService] Sync failed:", {
        id: item.id || item._id,
        status: error?.status,
        message: error?.message || String(error),
      });
    }
  }

  await writeArray(QUICK_NOTE_QUEUE_KEY, remaining);
  return { synced, remaining: remaining.length, offline: false };
}
