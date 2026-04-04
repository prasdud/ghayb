import { Hono } from 'hono'
import { and, eq, or } from 'drizzle-orm'
import { db } from '../db'
import { conversations, messages, users, deviceTokens } from '../db/schema'
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

    // Send push notification to recipient (fire-and-forget, no E2EE content)
    sendPushNotifications(recipientId).catch(() => { })

    return c.json({ id: message.id, conversationId: conversation.id }, 201)
})

// GET /messages/pending?knownUserIds=id1,id2,id3
// Returns conversations where the other participant is NOT in the known list.
// Used by clients to discover incoming connection requests.
messagesRouter.get('/pending', requireAuth, async (c) => {
    const userId = c.get('userId')
    const knownParam = c.req.query('knownUserIds') ?? ''
    const knownUserIds = knownParam ? knownParam.split(',').filter(Boolean) : []

    // Find all conversations involving this user
    const allConversations = await db.query.conversations.findMany({
        where: or(eq(conversations.userAId, userId), eq(conversations.userBId, userId)),
    })

    // Filter to conversations where the other user is NOT in the known list
    const pending = allConversations.filter((conv) => {
        const otherId = conv.userAId === userId ? conv.userBId : conv.userAId
        return !knownUserIds.includes(otherId) && otherId !== userId
    })

    if (pending.length === 0) return c.json([])

    // For each pending conversation, get the other user's info and the first message
    const results = await Promise.all(
        pending.map(async (conv) => {
            const otherId = conv.userAId === userId ? conv.userBId : conv.userAId

            const [otherUser, firstMessage] = await Promise.all([
                db.query.users.findFirst({
                    where: eq(users.id, otherId),
                    columns: { id: true, username: true, publicKey: true },
                }),
                db.query.messages.findFirst({
                    where: eq(messages.conversationId, conv.id),
                    orderBy: (m, { asc }) => [asc(m.createdAt)],
                }),
            ])

            if (!otherUser || !firstMessage) return null

            return {
                conversationId: conv.id,
                user: otherUser,
                firstMessage: {
                    id: firstMessage.id,
                    senderId: firstMessage.senderId,
                    encryptedData: firstMessage.encryptedData,
                    kyberEncryptedSessionKey: firstMessage.kyberEncryptedSessionKey,
                    senderWrappedKey: firstMessage.senderWrappedKey,
                    createdAt: firstMessage.createdAt,
                },
            }
        }),
    )

    return c.json(results.filter(Boolean))
})

// GET /conversations?otherUserId= — find or return null for a conversation between two users
messagesRouter.get('/conversations', requireAuth, async (c) => {
    const userId = c.get('userId')
    const otherUserId = c.req.query('otherUserId')

    if (!otherUserId) return c.json({ error: 'Missing otherUserId' }, 400)

    const [userAId, userBId] = [userId, otherUserId].sort()

    const conversation = await db.query.conversations.findFirst({
        where: and(eq(conversations.userAId, userAId), eq(conversations.userBId, userBId)),
        columns: { id: true },
    })

    return c.json({ conversationId: conversation?.id ?? null })
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

// DELETE /messages/conversations/:id — delete a conversation and all its messages
messagesRouter.delete('/conversations/:id', requireAuth, async (c) => {
    const userId = c.get('userId')
    const conversationId = c.req.param('id')

    // Verify the user is a participant
    const conversation = await db.query.conversations.findFirst({
        where: and(
            eq(conversations.id, conversationId),
            or(eq(conversations.userAId, userId), eq(conversations.userBId, userId)),
        ),
    })

    if (!conversation) {
        return c.json({ error: 'Conversation not found' }, 404)
    }

    // Delete messages first (FK constraint), then the conversation
    await db.delete(messages).where(eq(messages.conversationId, conversationId))
    await db.delete(conversations).where(eq(conversations.id, conversationId))

    return c.json({ ok: true })
})

// ── Push notification helper ──────────────────────────────────────────────────

async function sendPushNotifications(recipientId: string) {
    const tokens = await db.query.deviceTokens.findMany({
        where: eq(deviceTokens.userId, recipientId),
        columns: { token: true },
    })

    if (tokens.length === 0) return

    const messages = tokens.map(({ token }) => ({
        to: token,
        title: 'ghayb',
        body: 'there is a new message in your inbox',
        sound: 'default',
    }))

    await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        },
        body: JSON.stringify(messages),
    })
}

export default messagesRouter
