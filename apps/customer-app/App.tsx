import React, { useCallback, useEffect, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import * as Notifications from 'expo-notifications';
import { AuthProvider } from './src/store/AuthContext';
import { CartProvider } from './src/store/CartContext';
import Navigation from './src/navigation';
import AnimatedSplash from './src/screens/AnimatedSplash';

// Keep native splash visible until we're ready to show our animated one
SplashScreen.preventAutoHideAsync();

// Show alerts and play sound while app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export default function App() {
  const [appReady, setAppReady]       = useState(false);
  const [splashDone, setSplashDone]   = useState(false);

  useEffect(() => {
    // Hide native splash immediately so our animated one takes over
    SplashScreen.hideAsync();
    setAppReady(true);
  }, []);

  useEffect(() => {
    // Handle tapping a push notification — navigate to the relevant order
    const sub = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data as any
      if (data?.orderId) {
        // navigationRef.navigate('OrdersTab', { screen: 'OrderTracking', params: { orderId: data.orderId } })
        console.log('[Push] Notification tapped for order:', data.orderId)
      }
    })
    return () => sub.remove()
  }, []);

  const handleSplashFinish = useCallback(() => {
    setSplashDone(true);
  }, []);

  if (!appReady) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <CartProvider>
            <Navigation />
            {!splashDone && <AnimatedSplash onFinish={handleSplashFinish} />}
          </CartProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
