import React, { useCallback, useEffect, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import { AuthProvider } from './src/store/AuthContext';
import { CartProvider } from './src/store/CartContext';
import Navigation from './src/navigation';
import AnimatedSplash from './src/screens/AnimatedSplash';

// Keep native splash visible until we're ready to show our animated one
SplashScreen.preventAutoHideAsync();

export default function App() {
  const [appReady, setAppReady]       = useState(false);
  const [splashDone, setSplashDone]   = useState(false);

  useEffect(() => {
    // Hide native splash immediately so our animated one takes over
    SplashScreen.hideAsync();
    setAppReady(true);
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
