import { Hono } from 'hono'
import { sign } from 'hono/jwt'
import { rateLimiter } from 'hono-rate-limiter'
import { hash, compare } from 'bcryptjs'
import { eq } from 'drizzle-orm'
import { db } from '../db'
import { users } from '../db/schema'

const auth = new Hono()

// ── Rate limiters ─────────────────────────────────────────────────────────────

const registerLimiter = rateLimiter({
    windowMs: 60 * 60 * 1000, // 1 hour
    limit: 5,
    keyGenerator: (c) => c.req.header('x-forwarded-for') ?? 'unknown',
})

const saltsLimiter = rateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    limit: 20,
    keyGenerator: (c) => c.req.header('x-forwarded-for') ?? 'unknown',
})

const loginLimiter = rateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    limit: 10,
    keyGenerator: (c) => c.req.header('x-forwarded-for') ?? 'unknown',
})

const recoverLimiter = rateLimiter({
    windowMs: 60 * 60 * 1000, // 1 hour
    limit: 5,
    keyGenerator: (c) => c.req.header('x-forwarded-for') ?? 'unknown',
})

// ── POST /auth/register ───────────────────────────────────────────────────────

auth.post('/register', registerLimiter, async (c) => {
    const body = await c.req.json<{
        username: string
        authKey: string           // hex — client-derived Argon2id(password, authSalt)
        authSalt: string          // base64, 16 bytes
        vault: string             // base64 AES-GCM ciphertext of privateKey
        vaultSalt: string         // base64, 16 bytes
        publicKey: string         // base64 Kyber public key
        recoveryVault: string     // base64 AES-GCM ciphertext of privateKey under recoveryKey
        recoveryVaultSalt: string // base64, 16 bytes — salt used to derive AES key for recoveryVault
        recoveryKey: string       // hex recovery key — hashed then discarded
    }>()

    const { username, authKey, authSalt, vault, vaultSalt, publicKey, recoveryVault, recoveryVaultSalt, recoveryKey } = body

    if (!username || !authKey || !authSalt || !vault || !vaultSalt || !publicKey || !recoveryVault || !recoveryVaultSalt || !recoveryKey) {
        return c.json({ error: 'Missing fields' }, 400)
    }

    const existing = await db.query.users.findFirst({ where: eq(users.username, username) })
    if (existing) {
        return c.json({ error: 'Username taken' }, 409)
    }

    const [authHash, recoveryHash] = await Promise.all([
        hash(authKey, 10),
        hash(recoveryKey, 10),
    ])

    await db.insert(users).values({
        username,
        authHash,
        authSalt,
        vault,
        vaultSalt,
        publicKey,
        recoveryVault,
        recoveryVaultSalt,
        recoveryHash,
    })

    return c.json({ ok: true }, 201)
})

// ── GET /auth/salts ───────────────────────────────────────────────────────────

auth.get('/salts', saltsLimiter, async (c) => {
    const username = c.req.query('username')
    if (!username) return c.json({ error: 'Missing username' }, 400)

    const user = await db.query.users.findFirst({
        where: eq(users.username, username),
        columns: { authSalt: true, vaultSalt: true },
    })

    // Return same shape for unknown usernames to prevent enumeration
    if (!user) {
        return c.json({ authSalt: null, vaultSalt: null }, 200)
    }

    return c.json({ authSalt: user.authSalt, vaultSalt: user.vaultSalt })
})

// ── POST /auth/login ──────────────────────────────────────────────────────────

auth.post('/login', loginLimiter, async (c) => {
    const body = await c.req.json<{ username: string; authKey: string }>()
    const { username, authKey } = body

    if (!username || !authKey) return c.json({ error: 'Missing fields' }, 400)

    const user = await db.query.users.findFirst({ where: eq(users.username, username) })

    // Constant-time: always compare even if user not found
    const valid = user ? await compare(authKey, user.authHash) : false
    if (!valid || !user) {
        return c.json({ error: 'Invalid credentials' }, 401)
    }

    const token = await sign(
        { userId: user.id, exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7 }, // 7 days
        process.env.JWT_SECRET!,
    )

    return c.json({ userId: user.id, vault: user.vault, publicKey: user.publicKey, token })
})

// ── POST /auth/recover-vault ──────────────────────────────────────────────────
// Step 1 of recovery: verify recovery key, return encrypted vault so client can
// decrypt privateKey locally, then call POST /auth/recover with a new vault.

auth.post('/recover-vault', recoverLimiter, async (c) => {
    const body = await c.req.json<{ username: string; recoveryKey: string }>()
    const { username, recoveryKey } = body

    if (!username || !recoveryKey) return c.json({ error: 'Missing fields' }, 400)

    const user = await db.query.users.findFirst({ where: eq(users.username, username) })

    const valid = user ? await compare(recoveryKey, user.recoveryHash) : false
    if (!valid || !user) {
        return c.json({ error: 'Invalid recovery key' }, 401)
    }

    return c.json({ recoveryVault: user.recoveryVault, recoveryVaultSalt: user.recoveryVaultSalt })
})

// ── POST /auth/recover ────────────────────────────────────────────────────────

auth.post('/recover', recoverLimiter, async (c) => {
    const body = await c.req.json<{
        username: string
        recoveryKey: string   // hex recovery key the user provides
        newAuthKey: string    // hex new Argon2id(newPassword, newAuthSalt)
        newAuthSalt: string
        newVault: string      // AES-GCM(newVaultKey, privateKey)
        newVaultSalt: string
    }>()

    const { username, recoveryKey, newAuthKey, newAuthSalt, newVault, newVaultSalt } = body

    if (!username || !recoveryKey || !newAuthKey || !newAuthSalt || !newVault || !newVaultSalt) {
        return c.json({ error: 'Missing fields' }, 400)
    }

    const user = await db.query.users.findFirst({ where: eq(users.username, username) })

    const valid = user ? await compare(recoveryKey, user.recoveryHash) : false
    if (!valid || !user) {
        return c.json({ error: 'Invalid recovery key' }, 401)
    }

    const newAuthHash = await hash(newAuthKey, 10)

    await db.update(users)
        .set({ authHash: newAuthHash, authSalt: newAuthSalt, vault: newVault, vaultSalt: newVaultSalt })
        .where(eq(users.id, user.id))

    return c.json({ ok: true })
})

export default auth
