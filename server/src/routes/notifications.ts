import { Hono } from 'hono'
import { eq, and } from 'drizzle-orm'
import { db } from '../db'
import { deviceTokens } from '../db/schema'
import { requireAuth } from '../middleware/auth'

const notificationsRouter = new Hono()

// POST /notifications/device-tokens — register a push token for the authenticated user
notificationsRouter.post('/device-tokens', requireAuth, async (c) => {
    const userId = c.get('userId')
    const body = await c.req.json<{ token: string }>()
    const { token } = body

    if (!token) return c.json({ error: 'Missing token' }, 400)

    // Upsert: if token already exists for any user, update the userId; otherwise insert
    await db
        .insert(deviceTokens)
        .values({ userId, token })
        .onConflictDoUpdate({ target: deviceTokens.token, set: { userId } })

    return c.json({ ok: true }, 201)
})

// DELETE /notifications/device-tokens — unregister a push token
notificationsRouter.delete('/device-tokens', requireAuth, async (c) => {
    const userId = c.get('userId')
    const body = await c.req.json<{ token: string }>()
    const { token } = body

    if (!token) return c.json({ error: 'Missing token' }, 400)

    await db
        .delete(deviceTokens)
        .where(and(eq(deviceTokens.token, token), eq(deviceTokens.userId, userId)))

    return c.json({ ok: true })
})

export default notificationsRouter
