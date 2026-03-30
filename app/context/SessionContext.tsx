import React, { createContext, useContext, useState } from 'react'

interface Session {
    userId: string
    username: string
    publicKey: Uint8Array
    privateKey: Uint8Array
    token: string
}

interface SessionContextValue {
    session: Session | null
    setSession: (s: Session) => void
    clearSession: () => void
}

const SessionContext = createContext<SessionContextValue | null>(null)

export function SessionProvider({ children }: { children: React.ReactNode }) {
    const [session, setSessionState] = useState<Session | null>(null)

    function setSession(s: Session) {
        setSessionState(s)
    }

    function clearSession() {
        if (session) {
            session.privateKey.fill(0)
        }
        setSessionState(null)
    }

    return (
        <SessionContext.Provider value={{ session, setSession, clearSession }}>
            {children}
        </SessionContext.Provider>
    )
}

export function useSession() {
    const ctx = useContext(SessionContext)
    if (!ctx) throw new Error('useSession must be used within SessionProvider')
    return ctx
}
