// Web: localStorage-backed shim with the same API as expo-secure-store

export async function getItemAsync(key: string): Promise<string | null> {
    try {
        return localStorage.getItem(key);
    } catch {
        return null;
    }
}

export async function setItemAsync(key: string, value: string): Promise<void> {
    localStorage.setItem(key, value);
}

export async function deleteItemAsync(key: string): Promise<void> {
    localStorage.removeItem(key);
}
