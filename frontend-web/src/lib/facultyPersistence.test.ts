import {
  clearDraft,
  dropStaleFilterValue,
  getDraftStorageKey,
  getFilterStorageKey,
  readDraft,
  readSavedFilters,
  writeDraft,
  writeSavedFilters,
} from './facultyPersistence';

describe('faculty draft persistence', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('stores, restores, and clears a draft by user, form, and record', () => {
    const key = getDraftStorageKey('assignment', 'assignment-1', 'faculty-1');
    const draft = { title: 'Draft title', description: '<p>Draft</p>' };

    writeDraft(key, draft);
    expect(readDraft<typeof draft>(key)).toEqual(draft);

    clearDraft(key);
    expect(readDraft(key)).toBeNull();
  });

  it('does not throw when storage is unavailable', () => {
    const originalSetItem = localStorage.setItem;
    localStorage.setItem = (() => {
      throw new DOMException('Storage full', 'QuotaExceededError');
    }) as typeof localStorage.setItem;

    expect(() => writeDraft('draft-key', { title: 'Draft' })).not.toThrow();

    localStorage.setItem = originalSetItem;
  });

  it('scopes saved filters to the faculty user and screen', () => {
    const key = getFilterStorageKey('reports', 'faculty-1');
    writeSavedFilters(key, { batch: 'batch-1', section: 'section-1' });
    expect(readSavedFilters(key)).toEqual({ batch: 'batch-1', section: 'section-1' });
    expect(readSavedFilters(getFilterStorageKey('reports', 'faculty-2'))).toBeNull();
  });

  it('drops a saved filter when its ID is no longer returned', () => {
    expect(dropStaleFilterValue('missing', ['current'])).toBeNull();
    expect(dropStaleFilterValue('current', ['current'])).toBe('current');
  });
});
