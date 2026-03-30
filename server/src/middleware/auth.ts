import { createMiddleware } from 'hono/factory'
import { verify } from 'hono/jwt'

export type JwtPayload = { userId: string; exp: number }

export const requireAuth = createMiddleware<{
    Variables: { userId: string }
}>(async (c, next) => {
    const header = c.req.header('Authorization')
    if (!header?.startsWith('Bearer ')) {
        return c.json({ error: 'Unauthorized' }, 401)
    }

    const token = header.slice(7)
    try {
        const payload = await verify(token, process.env.JWT_SECRET!, 'HS256') as JwtPayload
        c.set('userId', payload.userId)
    } catch {
        return c.json({ error: 'Unauthorized' }, 401)
    }

    await next()
})
