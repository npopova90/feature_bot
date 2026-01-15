export interface UserState {
  topic?: string;
  selectedCategories?: string[];
  step?: "topic" | "categories" | "generating";
}

export interface StateStore {
  getState(userId: number): UserState | undefined;
  setState(userId: number, state: UserState): void;
  clearState(userId: number): void;
}

// In-memory implementation
class MemoryStateStore implements StateStore {
  private states: Map<number, UserState> = new Map();

  getState(userId: number): UserState | undefined {
    return this.states.get(userId);
  }

  setState(userId: number, state: UserState): void {
    this.states.set(userId, state);
  }

  clearState(userId: number): void {
    this.states.delete(userId);
  }
}

// Singleton instance
let storeInstance: StateStore | null = null;

export function getStateStore(): StateStore {
  if (!storeInstance) {
    storeInstance = new MemoryStateStore();
  }
  return storeInstance;
}
