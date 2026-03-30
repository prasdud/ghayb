import { Hono } from 'hono'
import { and, eq, or } from 'drizzle-orm'
import { db } from '../db'
import { conversations, messages, users } from '../db/schema'
import { requireAuth } from '../middleware/auth'

const messagesRouter = new Hono()

// POST /messages — send an encrypted message to a recipient
// Body: { recipientId, encryptedData, kyberEncryptedSessionKey }
messagesRouter.post('/', requireAuth, async (c) => {
    const senderId = c.get('userId')
    const body = await c.req.json<{
        recipientId: string
        encryptedData: string
        kyberEncryptedSessionKey: string  // recipient's wrapped key
        senderWrappedKey: string          // sender's wrapped key
    }>()

    const { recipientId, encryptedData, kyberEncryptedSessionKey, senderWrappedKey } = body

    if (!recipientId || !encryptedData || !kyberEncryptedSessionKey || !senderWrappedKey) {
        return c.json({ error: 'Missing fields' }, 400)
    }

    if (senderId === recipientId) {
        return c.json({ error: 'Cannot message yourself' }, 400)
    }

    // Verify recipient exists
    const recipient = await db.query.users.findFirst({
        where: eq(users.id, recipientId),
        columns: { id: true },
    })
    if (!recipient) {
        return c.json({ error: 'Recipient not found' }, 404)
    }

    // Find or create conversation (canonical order: lower UUID first)
    const [userAId, userBId] = [senderId, recipientId].sort()

    let conversation = await db.query.conversations.findFirst({
        where: and(eq(conversations.userAId, userAId), eq(conversations.userBId, userBId)),
    })

    if (!conversation) {
        const [created] = await db.insert(conversations).values({ userAId, userBId }).returning()
        conversation = created
    }

    const [message] = await db.insert(messages).values({
        conversationId: conversation.id,
        senderId,
        encryptedData,
        kyberEncryptedSessionKey,
        senderWrappedKey,
    }).returning()

    return c.json({ id: message.id, conversationId: conversation.id }, 201)
})

// GET /messages?conversationId= — fetch encrypted messages for a conversation
messagesRouter.get('/', requireAuth, async (c) => {
    const userId = c.get('userId')
    const conversationId = c.req.query('conversationId')

    if (!conversationId) {
        return c.json({ error: 'Missing conversationId' }, 400)
    }

    // Verify the requesting user is part of this conversation
    const conversation = await db.query.conversations.findFirst({
        where: and(
            eq(conversations.id, conversationId),
            or(eq(conversations.userAId, userId), eq(conversations.userBId, userId)),
        ),
    })

    if (!conversation) {
        return c.json({ error: 'Conversation not found' }, 404)
    }

    const msgs = await db.query.messages.findMany({
        where: eq(messages.conversationId, conversationId),
        columns: {
            id: true,
            senderId: true,
            encryptedData: true,
            kyberEncryptedSessionKey: true,
            senderWrappedKey: true,
            createdAt: true,
        },
        orderBy: (m, { asc }) => [asc(m.createdAt)],
    })

    return c.json(msgs)
})

export default messagesRouter
