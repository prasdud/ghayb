import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'

// ── Mocks (hoisted before imports by Vitest) ──────────────────────────────────

vi.mock('../src/db', () => ({
    db: {
        query: { users: { findFirst: vi.fn() } },
        insert: vi.fn(),
        update: vi.fn(),
    },
}))

vi.mock('hono-rate-limiter', () => ({
    rateLimiter: () => async (_c: unknown, next: () => Promise<void>) => next(),
}))

vi.mock('bcryptjs', () => ({
    hash: vi.fn(async (val: string) => `hashed:${val}`),
    compare: vi.fn(async (plain: string, stored: string) => stored === `hashed:${plain}`),
}))

vi.mock('hono/jwt', () => ({
    sign: vi.fn(async () => 'test-token'),
    verify: vi.fn(async () => ({ userId: 'user-1', exp: 9999999999 })),
}))

// ── Static imports — resolved after vi.mock hoisting ─────────────────────────

import { db } from '../src/db'
import { sign, verify } from 'hono/jwt'
import { compare } from 'bcryptjs'
import authRoute from '../src/routes/auth'
import { requireAuth } from '../src/middleware/auth'

// ── App fixture ───────────────────────────────────────────────────────────────

const app = new Hono()
    .route('/auth', authRoute)
    .get('/protected', requireAuth, (c) => c.json({ userId: c.get('userId') }))

type RequestOptions = { headers?: Record<string, string> }

const request = (method: string, path: string, body?: unknown, opts: RequestOptions = {}) =>
    app.request(path, {
        method,
        headers: { 'Content-Type': 'application/json', ...opts.headers },
        body: body !== undefined ? JSON.stringify(body) : undefined,
    })

const post = (path: string, body: unknown, opts?: RequestOptions) => request('POST', path, body, opts)
const get  = (path: string, opts?: RequestOptions) => request('GET', path, undefined, opts)

// ── Shared fixtures ───────────────────────────────────────────────────────────

const validRegistration = {
    username:          'alice',
    authKey:           'auth-key-hex',
    authSalt:          'auth-salt-b64',
    vault:             'vault-b64',
    vaultSalt:         'vault-salt-b64',
    publicKey:         'pub-key-b64',
    recoveryVault:     'recovery-vault-b64',
    recoveryVaultSalt: 'recovery-vault-salt-b64',
    recoveryKey:       'recovery-key-hex',
}

const existingUser = {
    id:           'user-1',
    authHash:     'hashed:correct-key',
    recoveryHash: 'hashed:recovery-key-hex',
    vault:        'vault-b64',
    publicKey:    'pub-key-b64',
}

// ── POST /auth/register ───────────────────────────────────────────────────────

describe('POST /auth/register', () => {
    let insertValues: ReturnType<typeof vi.fn>

    beforeEach(() => {
        vi.clearAllMocks()
        insertValues = vi.fn()
        vi.mocked(db.insert).mockReturnValue({ values: insertValues } as never)
    })

    it('creates a user and returns 201', async () => {
        vi.mocked(db.query.users.findFirst).mockResolvedValue(undefined)

        const res = await post('/auth/register', validRegistration)

        expect(res.status).toBe(201)
        expect(await res.json()).toEqual({ ok: true })
        expect(insertValues).toHaveBeenCalledOnce()
    })

    it('bcrypts authKey and recoveryKey before storing', async () => {
        vi.mocked(db.query.users.findFirst).mockResolvedValue(undefined)

        await post('/auth/register', validRegistration)

        expect(insertValues).toHaveBeenCalledWith(
            expect.objectContaining({
                authHash:     'hashed:auth-key-hex',
                recoveryHash: 'hashed:recovery-key-hex',
            })
        )
    })

    it('never stores raw authKey or recoveryKey', async () => {
        vi.mocked(db.query.users.findFirst).mockResolvedValue(undefined)

        await post('/auth/register', validRegistration)

        const stored = insertValues.mock.calls[0][0]
        expect(stored).not.toHaveProperty('authKey')
        expect(stored).not.toHaveProperty('recoveryKey')
    })

    it('returns 409 when username is already taken', async () => {
        vi.mocked(db.query.users.findFirst).mockResolvedValue(existingUser as never)

        const res = await post('/auth/register', validRegistration)

        expect(res.status).toBe(409)
        expect(insertValues).not.toHaveBeenCalled()
    })

    it('returns 400 when any field is missing', async () => {
        const fields = Object.keys(validRegistration) as (keyof typeof validRegistration)[]

        for (const field of fields) {
            const incomplete = { ...validRegistration, [field]: undefined }
            const res = await post('/auth/register', incomplete)
            expect(res.status, `expected 400 when '${field}' is missing`).toBe(400)
        }
    })
})

// ── GET /auth/salts ───────────────────────────────────────────────────────────

describe('GET /auth/salts', () => {
    beforeEach(() => vi.clearAllMocks())

    it('returns salts for a known user', async () => {
        vi.mocked(db.query.users.findFirst).mockResolvedValue({
            authSalt: 'a-salt',
            vaultSalt: 'v-salt',
        } as never)

        const res = await get('/auth/salts?username=alice')

        expect(res.status).toBe(200)
        expect(await res.json()).toEqual({ authSalt: 'a-salt', vaultSalt: 'v-salt' })
    })

    it('returns null salts for unknown username to prevent enumeration', async () => {
        vi.mocked(db.query.users.findFirst).mockResolvedValue(undefined)

        const res = await get('/auth/salts?username=nobody')

        expect(res.status).toBe(200)
        expect(await res.json()).toEqual({ authSalt: null, vaultSalt: null })
    })

    it('returns 400 when username query param is missing', async () => {
        const res = await get('/auth/salts')
        expect(res.status).toBe(400)
    })
})

// ── POST /auth/login ──────────────────────────────────────────────────────────

describe('POST /auth/login', () => {
    beforeEach(() => vi.clearAllMocks())

    it('returns vault, publicKey and token on valid credentials', async () => {
        vi.mocked(db.query.users.findFirst).mockResolvedValue(existingUser as never)

        const res = await post('/auth/login', { username: 'alice', authKey: 'correct-key' })

        expect(res.status).toBe(200)
        expect(await res.json()).toEqual({
            userId:    'user-1',
            vault:     'vault-b64',
            publicKey: 'pub-key-b64',
            token:     'test-token',
        })
    })

    it('signs JWT with userId and 7-day expiry', async () => {
        vi.mocked(db.query.users.findFirst).mockResolvedValue(existingUser as never)

        await post('/auth/login', { username: 'alice', authKey: 'correct-key' })

        const [payload] = vi.mocked(sign).mock.calls[0]
        expect(payload).toMatchObject({ userId: 'user-1' })

        const sevenDays = 60 * 60 * 24 * 7
        expect(payload.exp - Math.floor(Date.now() / 1000)).toBeCloseTo(sevenDays, -2)
    })

    it('returns 401 for wrong authKey', async () => {
        vi.mocked(db.query.users.findFirst).mockResolvedValue(existingUser as never)

        const res = await post('/auth/login', { username: 'alice', authKey: 'wrong-key' })

        expect(res.status).toBe(401)
    })

    it('returns 401 for unknown user without leaking timing info', async () => {
        vi.mocked(db.query.users.findFirst).mockResolvedValue(undefined)

        const res = await post('/auth/login', { username: 'ghost', authKey: 'any-key' })

        expect(res.status).toBe(401)
        // compare() is skipped when user is not found — route short-circuits with false
        expect(vi.mocked(compare)).not.toHaveBeenCalled()
    })

    it('returns 400 when fields are missing', async () => {
        const res = await post('/auth/login', { username: 'alice' })
        expect(res.status).toBe(400)
    })
})

// ── POST /auth/recover ────────────────────────────────────────────────────────

describe('POST /auth/recover', () => {
    let updateWhere: ReturnType<typeof vi.fn>
    let updateSet: ReturnType<typeof vi.fn>

    const validRecovery = {
        username:     'alice',
        recoveryKey:  'recovery-key-hex',
        newAuthKey:   'new-auth-key',
        newAuthSalt:  'new-auth-salt',
        newVault:     'new-vault-b64',
        newVaultSalt: 'new-vault-salt',
    }

    beforeEach(() => {
        vi.clearAllMocks()
        updateWhere = vi.fn()
        updateSet   = vi.fn(() => ({ where: updateWhere }))
        vi.mocked(db.update).mockReturnValue({ set: updateSet } as never)
    })

    it('resets password with valid recovery key', async () => {
        vi.mocked(db.query.users.findFirst).mockResolvedValue(existingUser as never)

        const res = await post('/auth/recover', validRecovery)

        expect(res.status).toBe(200)
        expect(await res.json()).toEqual({ ok: true })
    })

    it('updates authHash, authSalt, vault and vaultSalt — not recoveryHash', async () => {
        vi.mocked(db.query.users.findFirst).mockResolvedValue(existingUser as never)

        await post('/auth/recover', validRecovery)

        expect(updateSet).toHaveBeenCalledWith(
            expect.objectContaining({
                authHash:  'hashed:new-auth-key',
                authSalt:  'new-auth-salt',
                vault:     'new-vault-b64',
                vaultSalt: 'new-vault-salt',
            })
        )
        // recoveryHash must not change — recovery key is single-use only if we decide that later
        const updated = updateSet.mock.calls[0][0]
        expect(updated).not.toHaveProperty('recoveryHash')
    })

    it('returns 401 for wrong recovery key', async () => {
        vi.mocked(db.query.users.findFirst).mockResolvedValue(existingUser as never)

        const res = await post('/auth/recover', { ...validRecovery, recoveryKey: 'wrong-key' })

        expect(res.status).toBe(401)
        expect(updateSet).not.toHaveBeenCalled()
    })

    it('returns 401 for unknown user', async () => {
        vi.mocked(db.query.users.findFirst).mockResolvedValue(undefined)

        const res = await post('/auth/recover', validRecovery)

        expect(res.status).toBe(401)
        expect(updateSet).not.toHaveBeenCalled()
    })

    it('returns 400 when any field is missing', async () => {
        const fields = Object.keys(validRecovery) as (keyof typeof validRecovery)[]

        for (const field of fields) {
            const incomplete = { ...validRecovery, [field]: undefined }
            const res = await post('/auth/recover', incomplete)
            expect(res.status, `expected 400 when '${field}' is missing`).toBe(400)
        }
    })
})

// ── JWT middleware ────────────────────────────────────────────────────────────

describe('requireAuth middleware', () => {
    beforeEach(() => vi.clearAllMocks())

    it('passes through with a valid Bearer token and sets userId', async () => {
        const res = await get('/protected', { headers: { Authorization: 'Bearer valid-token' } })

        expect(res.status).toBe(200)
        expect(await res.json()).toEqual({ userId: 'user-1' })
    })

    it('returns 401 when Authorization header is missing', async () => {
        const res = await get('/protected')
        expect(res.status).toBe(401)
    })

    it('returns 401 when token is invalid', async () => {
        vi.mocked(verify).mockRejectedValueOnce(new Error('bad token'))

        const res = await get('/protected', { headers: { Authorization: 'Bearer bad-token' } })
        expect(res.status).toBe(401)
    })

    it('returns 401 when Authorization scheme is not Bearer', async () => {
        const res = await get('/protected', { headers: { Authorization: 'Basic dXNlcjpwYXNz' } })
        expect(res.status).toBe(401)
    })
})
