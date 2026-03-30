import { pgTable, uuid, text, timestamp, unique } from 'drizzle-orm/pg-core'

export const users = pgTable('users', {
    id:         uuid('id').primaryKey().defaultRandom(),
    username:   text('username').notNull().unique(),
    authHash:   text('auth_hash').notNull(),
    authSalt:   text('auth_salt').notNull(),
    vault:      text('vault').notNull(),
    vaultSalt:  text('vault_salt').notNull(),
    publicKey:      text('public_key').notNull(),
    recoveryVault:      text('recovery_vault').notNull(),
    recoveryVaultSalt:  text('recovery_vault_salt').notNull(),
    recoveryHash:       text('recovery_hash').notNull(),
    encryptedContacts:  text('encrypted_contacts'),
    createdAt:          timestamp('created_at').notNull().defaultNow(),
})

export const conversations = pgTable('conversations', {
    id:        uuid('id').primaryKey().defaultRandom(),
    userAId:   uuid('user_a_id').notNull().references(() => users.id),
    userBId:   uuid('user_b_id').notNull().references(() => users.id),
    createdAt: timestamp('created_at').notNull().defaultNow(),
}, (t) => [
    unique().on(t.userAId, t.userBId),
])

export const messages = pgTable('messages', {
    id:                       uuid('id').primaryKey().defaultRandom(),
    conversationId:           uuid('conversation_id').notNull().references(() => conversations.id),
    senderId:                 uuid('sender_id').notNull().references(() => users.id),
    encryptedData:            text('encrypted_data').notNull(),
    kyberEncryptedSessionKey: text('kyber_encrypted_session_key').notNull(), // recipient's wrapped key
    senderWrappedKey:         text('sender_wrapped_key'),                    // sender's wrapped key (null on pre-migration rows)
    createdAt:                timestamp('created_at').notNull().defaultNow(),
})

export const deviceTokens = pgTable('device_tokens', {
    id:        uuid('id').primaryKey().defaultRandom(),
    userId:    uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    token:     text('token').notNull().unique(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
})

// ── Types ──────────────────────────────────────────────────────────────────

export type User         = typeof users.$inferSelect
export type Conversation = typeof conversations.$inferSelect
export type Message      = typeof messages.$inferSelect
export type DeviceToken  = typeof deviceTokens.$inferSelect

export type NewUser         = typeof users.$inferInsert
export type NewConversation = typeof conversations.$inferInsert
export type NewMessage      = typeof messages.$inferInsert
export type NewDeviceToken  = typeof deviceTokens.$inferInsert
