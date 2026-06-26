import '@testing-library/jest-dom';

beforeEach(() => {
  jest.restoreAllMocks();
  localStorage.clear();
  global.fetch = jest.fn();
});
