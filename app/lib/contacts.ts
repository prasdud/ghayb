import { encryptBlob, decryptBlob } from '@dragbin/native-crypto'
import { API_BASE } from './api'

export interface Contact {
    id: string
    username: string
    publicKey: string // base64
}

export async function fetchAndDecryptContacts(token: string, privateKey: Uint8Array): Promise<Contact[]> {
    const res = await fetch(`${API_BASE}/users/me/contacts`, {
        headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) return []
    const { encryptedContacts } = await res.json()
    if (!encryptedContacts) return []
    try {
        return await decryptBlob<Contact[]>(encryptedContacts, privateKey)
    } catch {
        return []
    }
}

export async function encryptAndSaveContacts(
    contacts: Contact[],
    token: string,
    privateKey: Uint8Array,
): Promise<void> {
    const encryptedContacts = await encryptBlob(contacts, privateKey)
    await fetch(`${API_BASE}/users/me/contacts`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ encryptedContacts }),
    })
}
