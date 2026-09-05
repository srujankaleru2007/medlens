import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
const verify = vi.hoisted(() => vi.fn());
vi.mock('./firebase', () => ({ adminAuth: () => ({ verifyIdToken: verify }) }));
import { authenticated, endpoint, HttpError, limitedBody } from './http';

describe('request security boundaries', () => {
  beforeEach(() => verify.mockReset());
  it('rejects unauthenticated requests without consulting the SDK', async () => {
    await expect(authenticated(new Request('http://localhost:1234/api/patients'))).rejects.toMatchObject({ status: 401 });
    expect(verify).not.toHaveBeenCalled();
  });
  it('takes identity only from the verified token', async () => {
    verify.mockResolvedValue({ uid: 'real-user' });
    expect(await authenticated(new Request('http://localhost:1234', { headers: { Authorization: 'Bearer valid', 'X-User-Id': 'victim' } }))).toBe('real-user');
  });
  it('bounds a body even without content-length', async () => {
    const request = new Request('http://localhost:1234', { method: 'POST', body: 'abcdef' });
    await expect(limitedBody(request, 5)).rejects.toMatchObject({ status: 413 });
  });
  it('returns private, safe error responses', async () => {
    const response = await endpoint(async () => { throw new HttpError(404, 'Report not found.'); });
    expect(response.status).toBe(404); expect(response.headers.get('cache-control')).toContain('no-store');
    expect(await response.json()).toEqual({ error: 'Report not found.' });
  });
});
