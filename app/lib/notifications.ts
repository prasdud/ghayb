import * as Notifications from 'expo-notifications'
import * as SecureStore from './secure-store'
import { Platform } from 'react-native'
import { API_BASE } from './api'

const NOTIF_ENABLED_KEY = 'notifications_enabled'
const NOTIF_TOKEN_KEY = 'push_token'

Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
    }),
})

export async function getNotificationsEnabled(): Promise<boolean> {
    const val = await SecureStore.getItemAsync(NOTIF_ENABLED_KEY)
    return val === 'true'
}

export async function setNotificationsEnabled(enabled: boolean): Promise<void> {
    await SecureStore.setItemAsync(NOTIF_ENABLED_KEY, enabled ? 'true' : 'false')
}

async function getExpoPushToken(): Promise<string | null> {
    if (Platform.OS === 'web') return null

    const { status: existingStatus } = await Notifications.getPermissionsAsync()
    let finalStatus = existingStatus

    if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync()
        finalStatus = status
    }

    if (finalStatus !== 'granted') return null

    const tokenData = await Notifications.getExpoPushTokenAsync()
    return tokenData.data
}

export async function registerPushToken(authToken: string): Promise<boolean> {
    const pushToken = await getExpoPushToken()
    if (!pushToken) return false

    await SecureStore.setItemAsync(NOTIF_TOKEN_KEY, pushToken)

    await fetch(`${API_BASE}/notifications/device-tokens`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({ token: pushToken }),
    })

    return true
}

export async function unregisterPushToken(authToken: string): Promise<void> {
    const pushToken = await SecureStore.getItemAsync(NOTIF_TOKEN_KEY)
    if (!pushToken) return

    await fetch(`${API_BASE}/notifications/device-tokens`, {
        method: 'DELETE',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({ token: pushToken }),
    })

    await SecureStore.deleteItemAsync(NOTIF_TOKEN_KEY)
}
