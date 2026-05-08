import { ref, readonly } from 'vue';

export interface UndoEntry {
  description: string;
  undoFn: () => void;
  timestamp: number;
}

const current = ref<UndoEntry | null>(null);
let expireTimer: ReturnType<typeof setTimeout> | null = null;

function clearExpireTimer() {
  if (expireTimer) {
    clearTimeout(expireTimer);
    expireTimer = null;
  }
}

function startExpireTimer() {
  clearExpireTimer();
  expireTimer = setTimeout(() => {
    current.value = null;
  }, 4000);
}

function pushUndo(description: string, undoFn: () => void) {
  current.value = {
    description,
    undoFn,
    timestamp: Date.now(),
  };
  startExpireTimer();
}

function executeUndo() {
  if (current.value) {
    const fn = current.value.undoFn;
    current.value = null;
    clearExpireTimer();
    fn();
  }
}

function dismiss() {
  current.value = null;
  clearExpireTimer();
}

export function useUndo() {
  return {
    currentUndo: readonly(current),
    pushUndo,
    executeUndo,
    dismiss,
  };
}
