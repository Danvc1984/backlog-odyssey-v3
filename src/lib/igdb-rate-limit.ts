const MAX_STARTS_PER_WINDOW = 4;
const MAX_CONCURRENT_REQUESTS = 8;
const WINDOW_MS = 1_000;

interface QueueEntry {
  resolve: (release: () => void) => void;
}

const queue: QueueEntry[] = [];
const startTimes: number[] = [];
let activeRequests = 0;
let wakeTimer: ReturnType<typeof setTimeout> | null = null;

function pruneStartTimes(now: number): void {
  while (startTimes[0] !== undefined && startTimes[0] <= now - WINDOW_MS) {
    startTimes.shift();
  }
}

function scheduleWake(at: number): void {
  if (wakeTimer !== null) return;
  wakeTimer = setTimeout(() => {
    wakeTimer = null;
    pumpQueue();
  }, Math.max(0, at - Date.now()));
}

function pumpQueue(): void {
  const now = Date.now();
  pruneStartTimes(now);

  while (
    queue.length > 0 &&
    activeRequests < MAX_CONCURRENT_REQUESTS &&
    startTimes.length < MAX_STARTS_PER_WINDOW
  ) {
    const entry = queue.shift();
    if (!entry) return;

    const startedAt = Date.now();
    startTimes.push(startedAt);
    activeRequests += 1;
    let released = false;
    entry.resolve(() => {
      if (released) return;
      released = true;
      activeRequests -= 1;
      pumpQueue();
    });
  }

  if (queue.length > 0 && startTimes.length >= MAX_STARTS_PER_WINDOW) {
    scheduleWake(startTimes[0] + WINDOW_MS);
  }
}

export function acquireIgdbRateLimit(): Promise<() => void> {
  return new Promise((resolve) => {
    queue.push({ resolve });
    pumpQueue();
  });
}

export async function withIgdbRateLimit<T>(
  operation: () => Promise<T>,
): Promise<T> {
  const release = await acquireIgdbRateLimit();
  try {
    return await operation();
  } finally {
    release();
  }
}
