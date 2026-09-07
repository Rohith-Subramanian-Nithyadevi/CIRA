import { ApiError, apiClient } from './apiClient';

describe('apiClient error handling', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('surfaces validation code and details from the standardized envelope', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({
        error: {
          code: 'ERR_VALIDATION',
          message: 'Validation Error',
          details: [{ path: ['email'], message: 'Invalid email' }],
        },
      }),
    } as Response);

    await expect(apiClient.fetch('/api/v1/auth/login')).rejects.toMatchObject({
      status: 400,
      code: 'ERR_VALIDATION',
      message: 'Validation Error (ERR_VALIDATION)',
      details: [{ path: ['email'], message: 'Invalid email' }],
    });
  });

  it('uses a distinct server error code when the backend fails', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({
        error: {
          code: 'ERR_INTERNAL_SERVER',
          message: 'An unexpected error occurred.',
        },
      }),
    } as Response);

    try {
      await apiClient.fetch('/api/v1/student/dashboard');
      throw new Error('Expected apiClient.fetch to reject');
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      expect(error).toMatchObject({
        status: 500,
        code: 'ERR_INTERNAL_SERVER',
        message: 'An unexpected error occurred. (ERR_INTERNAL_SERVER)',
      });
    }
  });
});
