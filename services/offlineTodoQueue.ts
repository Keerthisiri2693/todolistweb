import AsyncStorage from "@react-native-async-storage/async-storage";

const QUEUE_KEY = "offline-todo-queue-v1";

export type PendingTodo = {
  id: string;
  operation: "create" | "update";
  todoId?: string;
  userId: string;
  title: string;
  text: string;
  date: string;
  createdAt: string;
  updatedAt: string;
  alarm: string;
  reminderDate: string;
  reminderTime: string;
  status: "Pending" | "Completed" | "Overdue" | string;
  recurring: "none" | "daily" | "weekly" | "monthly" | string;
  quickNoteColor: string;
  quickNotePinned: boolean;
  notePattern: "plain" | "lined" | "dotted" | "grid" | string;
  imageUri?: string | null;
  videoUri?: string | null;
  voiceUri?: string | null;
  drawingUri?: string | null;
  backgroundImageUri?: string | null;
  queuedAt: string;
};

type PendingTodoInput = Omit<PendingTodo, "id" | "queuedAt"> & {
  id?: string;
  queuedAt?: string;
};

async function readQueue(): Promise<PendingTodo[]> {
  const raw = await AsyncStorage.getItem(QUEUE_KEY);
  if (!raw) return [];

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is PendingTodo =>
        !!item &&
        typeof item === "object" &&
        typeof (item as PendingTodo).id === "string" &&
        typeof (item as PendingTodo).userId === "string" &&
        typeof (item as PendingTodo).title === "string",
    );
  } catch (error) {
    console.error("[offlineTodoQueue] Invalid queue JSON:", error);
    throw new Error(
      "The offline Todo queue is unreadable; local data was not overwritten.",
    );
  }
}

async function writeQueue(items: PendingTodo[]): Promise<void> {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(items));
}

export async function getPendingTodos(userId?: string): Promise<PendingTodo[]> {
  const items = await readQueue();
  return userId ? items.filter((item) => item.userId === userId) : items;
}

export async function queueTodo(input: PendingTodoInput): Promise<PendingTodo> {
  if (!input.userId?.trim()) {
    throw new Error("Cannot queue a Todo without a userId.");
  }
  if (!input.title?.trim()) {
    throw new Error("Cannot queue a Todo without a title.");
  }

  const items = await readQueue();
  const now = new Date().toISOString();

  // Reuse the same queue item for repeated edits to a Todo already pending.
  const existingIndex =
    input.operation === "update" && input.todoId
      ? items.findIndex(
          (item) =>
            item.userId === input.userId &&
            item.operation === "update" &&
            item.todoId === input.todoId,
        )
      : -1;

  const queued: PendingTodo = {
    ...input,
    id:
      existingIndex >= 0
        ? items[existingIndex].id
        : (input.id ??
          `pending-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`),
    queuedAt:
      existingIndex >= 0
        ? items[existingIndex].queuedAt
        : (input.queuedAt ?? now),
    updatedAt: input.updatedAt || now,
  };

  if (existingIndex >= 0) {
    items[existingIndex] = queued;
  } else {
    items.push(queued);
  }

  await writeQueue(items);
  return queued;
}

export async function removePendingTodo(queueItemId: string): Promise<void> {
  const items = await readQueue();
  await writeQueue(items.filter((item) => item.id !== queueItemId));
}

export async function clearPendingTodosForUser(userId: string): Promise<void> {
  const items = await readQueue();
  await writeQueue(items.filter((item) => item.userId !== userId));
}

export async function getPendingTodoCount(userId?: string): Promise<number> {
  return (await getPendingTodos(userId)).length;
}
