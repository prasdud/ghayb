import { Hono } from 'hono'
import { eq } from 'drizzle-orm'
import { db } from '../db'
import { users } from '../db/schema'
import { requireAuth } from '../middleware/auth'

const usersRouter = new Hono()

// GET /users/me/contacts — fetch encrypted contacts blob
usersRouter.get('/me/contacts', requireAuth, async (c) => {
    const userId = c.get('userId')
    const user = await db.query.users.findFirst({
        where: eq(users.id, userId),
        columns: { encryptedContacts: true },
    })
    return c.json({ encryptedContacts: user?.encryptedContacts ?? null })
})

// PUT /users/me/contacts — overwrite encrypted contacts blob
usersRouter.put('/me/contacts', requireAuth, async (c) => {
    const userId = c.get('userId')
    const { encryptedContacts } = await c.req.json<{ encryptedContacts: string }>()
    if (!encryptedContacts) return c.json({ error: 'Missing encryptedContacts' }, 400)
    await db.update(users).set({ encryptedContacts }).where(eq(users.id, userId))
    return c.json({ ok: true })
})

// GET /users/:username — look up a user's public key to initiate a connection
usersRouter.get('/:username', requireAuth, async (c) => {
    const username = c.req.param('username')

    const user = await db.query.users.findFirst({
        where: eq(users.username, username),
        columns: { id: true, username: true, publicKey: true },
    })

    if (!user) {
        return c.json({ error: 'User not found' }, 404)
    }

    return c.json({ id: user.id, username: user.username, publicKey: user.publicKey })
})

export default usersRouter
