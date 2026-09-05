import { expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
const verify = vi.hoisted(() => vi.fn());
vi.mock('./firebase', () => ({ adminAuth: () => ({ verifyIdToken: verify }) }));
import { authenticated } from './http';

it('converts revoked/invalid token rejection to an anonymous 401 error', async () => {
  verify.mockRejectedValueOnce(new Error('private SDK failure detail'));
  try {
    await authenticated(new Request('http://localhost:1234', { headers: { Authorization: 'Bearer revoked' } }));
    expect.unreachable('Revoked token must be rejected');
  } catch (error) {
    expect(error).toMatchObject({ status: 401, message: 'Your session is invalid or expired. Sign in again.' });
  }
  expect(verify).toHaveBeenCalledWith('revoked', true);
});
