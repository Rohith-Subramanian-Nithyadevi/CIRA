export type DraftForm = Record<string, unknown>;

const STORAGE_PREFIX = 'cira:faculty';

export const getStoredUserKey = (): string => {
  try {
    const rawUser = localStorage.getItem('cira_user');
    const user = rawUser ? JSON.parse(rawUser) as { id?: string; email?: string } : null;
    return user?.id || user?.email || 'anonymous';
  } catch {
    return 'anonymous';
  }
};

export const getDraftStorageKey = (form: string, recordId: string, userKey = getStoredUserKey()): string =>
  `${STORAGE_PREFIX}:draft:${userKey}:${form}:${recordId}`;

export const readDraft = <T extends DraftForm>(key: string): T | null => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as T : null;
  } catch {
    return null;
  }
};

export const writeDraft = (key: string, draft: DraftForm): void => {
  try {
    localStorage.setItem(key, JSON.stringify(draft));
  } catch {
    // Draft persistence is best effort when storage is unavailable or full.
  }
};

export const clearDraft = (key: string): void => {
  try {
    localStorage.removeItem(key);
  } catch {
    // Draft persistence is best effort when storage is unavailable.
  }
};
