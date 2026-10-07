const KEY = "zeeboard-pending-action";

export type PendingAction = "new-commission" | "new-client";

export const requestAction = (action: PendingAction) => sessionStorage.setItem(KEY, action);

/** True once if `action` was requested before this screen mounted. */
export function takeAction(action: PendingAction): boolean {
  const pending = sessionStorage.getItem(KEY) === action;

  if (pending) {
    sessionStorage.removeItem(KEY);
  }

  return pending;
}
