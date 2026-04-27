import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { useAuth } from '../store/AuthContext';

// Auth screens
import LoginScreen from '../screens/LoginScreen';
import OTPScreen   from '../screens/OTPScreen';

// App screens
import HomeScreen          from '../screens/HomeScreen';
import ShopScreen          from '../screens/ShopScreen';
import CartScreen          from '../screens/CartScreen';
import OrderTrackingScreen from '../screens/OrderTrackingScreen';
import OrdersScreen        from '../screens/OrdersScreen';
import ProfileScreen       from '../screens/ProfileScreen';

import { useCart } from '../store/CartContext';

const Stack = createNativeStackNavigator();
const Tab   = createBottomTabNavigator();

function TabCartIcon({ color, size }: any) {
  const { itemCount } = useCart();
  return (
    <View>
      <Ionicons name="cart-outline" size={size} color={color} />
      {itemCount > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{itemCount}</Text>
        </View>
      )}
    </View>
  );
}

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: '#FF8A00',
        tabBarInactiveTintColor: 'rgba(255,255,255,0.35)',
        tabBarLabelStyle: styles.tabLabel,
        tabBarBackground: () => (
          <LinearGradient colors={['#0B1A2B', '#020A14']} style={{ flex: 1 }} />
        ),
      })}
    >
      <Tab.Screen
        name="Home"
        component={HomeStack}
        options={{ tabBarLabel: 'Home', tabBarIcon: ({ color, size }) => <Ionicons name="home-outline" size={size} color={color} /> }}
      />
      <Tab.Screen
        name="Orders"
        component={OrdersScreen}
        options={{ tabBarLabel: 'Orders', tabBarIcon: ({ color, size }) => <Ionicons name="receipt-outline" size={size} color={color} /> }}
      />
      <Tab.Screen
        name="Cart"
        component={CartScreen}
        options={{ tabBarLabel: 'Cart', tabBarIcon: (props) => <TabCartIcon {...props} /> }}
      />
    </Tab.Navigator>
  );
}

function HomeStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="HomeMain"      component={HomeScreen} />
      <Stack.Screen name="Shop"          component={ShopScreen} />
      <Stack.Screen name="Cart"          component={CartScreen} />
      <Stack.Screen name="OrderTracking" component={OrderTrackingScreen} />
      <Stack.Screen name="Profile"       component={ProfileScreen} />
    </Stack.Navigator>
  );
}

function AuthStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="OTP"   component={OTPScreen} />
    </Stack.Navigator>
  );
}

export default function Navigation() {
  const { token, isLoading } = useAuth();

  if (isLoading) return null;

  return (
    <NavigationContainer>
      {token ? <MainTabs /> : <AuthStack />}
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  tabBar:   {
    borderTopWidth: 0, height: 64, paddingBottom: 8, paddingTop: 8,
    shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 20, shadowOffset: { width: 0, height: -4 },
  },
  tabLabel: { fontSize: 11, fontWeight: '600' },
  badge:    {
    position: 'absolute', top: -6, right: -8,
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: '#FF5C00', alignItems: 'center', justifyContent: 'center',
  },
  badgeText:{ color: '#fff', fontSize: 10, fontWeight: '800' },
});
