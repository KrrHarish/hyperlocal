import * as Notifications from 'expo-notifications'
import { Platform } from 'react-native'
import api from '../services/api'

// Detect simulator without expo-device
const isSimulator = Platform.OS === 'ios'
  ? !!(Platform as any).constants?.systemName?.includes('Simulator')
  : false

export async function registerPushToken() {
  // Push only works on real devices — skip simulator silently
  if (isSimulator) {
    console.log('[Push] Simulator detected — skipping push token registration')
    return
  }

  const { status: existing } = await Notifications.getPermissionsAsync()
  let finalStatus = existing
  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync()
    finalStatus = status
  }
  if (finalStatus !== 'granted') return

  const tokenData = await Notifications.getExpoPushTokenAsync()
  const token = tokenData.data
  const platform = Platform.OS

  try {
    await api.post('/customers/push-token', { token, platform })
    console.log('[Push] Token registered:', token)
  } catch (e) {
    console.error('[Push] Failed to register token:', e)
  }

  // Android notification channel
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('orders', {
      name: 'Order Updates',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF8A00',
    })
  }
}
