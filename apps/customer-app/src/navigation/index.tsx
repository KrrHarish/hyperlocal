import React, { useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../store/AuthContext';
import { useCart } from '../store/CartContext';
import { CategoryProvider, AppCategory, useCategory } from '../store/CategoryContext';

import LoginScreen            from '../screens/LoginScreen';
import OTPScreen              from '../screens/OTPScreen';
import CategorySelectScreen   from '../screens/CategorySelectScreen';
import HomeScreen             from '../screens/HomeScreen';
import ShopScreen             from '../screens/ShopScreen';
import CartScreen             from '../screens/CartScreen';
import OrderTrackingScreen    from '../screens/OrderTrackingScreen';
import OrdersScreen           from '../screens/OrdersScreen';
import ProfileScreen          from '../screens/ProfileScreen';
import ProductDetailScreen    from '../screens/ProductDetailScreen';
import SearchScreen           from '../screens/SearchScreen';
import AddressesScreen        from '../screens/AddressesScreen';
import ChatScreen             from '../screens/ChatScreen';

const Stack = createNativeStackNavigator();
const Tab   = createBottomTabNavigator();

function CartTabIcon({ color, size }: any) {
  const { itemCount } = useCart();
  return (
    <View>
      <Ionicons name="cart-outline" size={size} color={color} />
      {itemCount > 0 && (
        <View style={s.badge}>
          <Text style={s.badgeTxt}>{itemCount > 9 ? '9+' : itemCount}</Text>
        </View>
      )}
    </View>
  );
}

// ── HOME STACK ─────────────────────────────────────────
function HomeStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="HomeMain"      component={HomeScreen} />
      <Stack.Screen name="Shop"          component={ShopScreen} />
      <Stack.Screen name="Cart"          component={CartScreen} />
      <Stack.Screen name="OrderTracking" component={OrderTrackingScreen} />
      <Stack.Screen name="Profile"       component={ProfileScreen} />
      <Stack.Screen name="ProductDetail" component={ProductDetailScreen} />
      <Stack.Screen name="Search"        component={SearchScreen} />
      <Stack.Screen name="Addresses"     component={AddressesScreen} />
      <Stack.Screen name="Chat"          component={ChatScreen} />
    </Stack.Navigator>
  );
}

// ── ORDERS STACK ────────────────────────────────────────
function OrdersStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="OrdersList"    component={OrdersScreen} />
      <Stack.Screen name="OrderTracking" component={OrderTrackingScreen} />
      <Stack.Screen name="Shop"          component={ShopScreen} />
      <Stack.Screen name="Cart"          component={CartScreen} />
      <Stack.Screen name="ProductDetail" component={ProductDetailScreen} />
      <Stack.Screen name="Addresses"     component={AddressesScreen} />
    </Stack.Navigator>
  );
}

// ── CART STACK ──────────────────────────────────────────
function CartStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="CartMain"      component={CartScreen} />
      <Stack.Screen name="OrderTracking" component={OrderTrackingScreen} />
      <Stack.Screen name="Addresses"     component={AddressesScreen} />
    </Stack.Navigator>
  );
}

// ── BOTTOM TABS ─────────────────────────────────────────
function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown:             false,
        tabBarStyle:             s.tabBar,
        tabBarActiveTintColor:   '#FF8A00',
        tabBarInactiveTintColor: 'rgba(255,255,255,0.4)',
        tabBarLabelStyle:        s.tabLabel,
        tabBarBackground: () => (
          <LinearGradient colors={['#0D1B2A','#020A14']} style={{ flex: 1 }} />
        ),
      }}
    >
      <Tab.Screen
        name="HomeTab"
        component={HomeStack}
        options={{
          tabBarLabel: 'Home',
          tabBarIcon: ({ color, size }) =>
            <Ionicons name="home-outline" size={size} color={color} />,
        }}
      />
      <Tab.Screen
        name="OrdersTab"
        component={OrdersStack}
        options={{
          tabBarLabel: 'Orders',
          tabBarIcon: ({ color, size }) =>
            <Ionicons name="receipt-outline" size={size} color={color} />,
        }}
      />
      <Tab.Screen
        name="CartTab"
        component={CartStack}
        options={{
          tabBarLabel: 'Cart',
          tabBarIcon: (props) => <CartTabIcon {...props} />,
        }}
      />
    </Tab.Navigator>
  );
}

// ── AUTH STACK ──────────────────────────────────────────
function AuthStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, animation: 'fade' }}>
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="OTP"   component={OTPScreen} />
    </Stack.Navigator>
  );
}

// ── ROOT NAVIGATOR — handles category gate ──────────────
// selectedCategory is NULL on every cold start (force-close + reopen resets JS state).
// Once the user picks a category the main tabs show. The hamburger in HomeScreen
// calls setSelectedCategory(null) to pop back to CategorySelect.
function RootNavigator() {
  const { token, isLoading } = useAuth();
  const { selectedCategory, setSelectedCategory } = useCategory();

  if (isLoading) return null;

  if (!token) {
    return (
      <Stack.Navigator screenOptions={{ headerShown: false, animation: 'fade' }}>
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="OTP"   component={OTPScreen} />
      </Stack.Navigator>
    );
  }

  // Logged in but no category selected yet (every cold start)
  if (!selectedCategory) {
    return (
      <Stack.Navigator screenOptions={{ headerShown: false, animation: 'fade' }}>
        <Stack.Screen name="CategorySelect">
          {() => (
            <CategorySelectScreen
              onSelect={(cat: AppCategory) => setSelectedCategory(cat)}
            />
          )}
        </Stack.Screen>
      </Stack.Navigator>
    );
  }

  // Category selected — show main app
  return <MainTabs />;
}

export default function Navigation() {
  return (
    <CategoryProvider>
      <NavigationContainer>
        <RootNavigator />
      </NavigationContainer>
    </CategoryProvider>
  );
}

const s = StyleSheet.create({
  tabBar: {
    borderTopWidth: 0,
    height: Platform.OS === 'ios' ? 82 : 64,
    paddingBottom: Platform.OS === 'ios' ? 24 : 8,
    paddingTop: 8,
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: -4 },
    elevation: 20,
  },
  tabLabel:  { fontSize: 11, fontWeight: '600' },
  badge: {
    position: 'absolute', top: -5, right: -8,
    minWidth: 18, height: 18, borderRadius: 9,
    backgroundColor: '#FF5C00',
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeTxt:  { color: '#fff', fontSize: 10, fontWeight: '800' },
});
