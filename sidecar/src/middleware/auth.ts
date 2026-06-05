import type { Context, Next } from 'hono';

export function bearerAuth(token: string) {
  return async (c: Context, next: Next) => {
    const auth = c.req.header('authorization');
    if (auth !== `Bearer ${token}`) {
      return c.json({ error: 'unauthorized' }, 401);
    }
    await next();
  };
}
