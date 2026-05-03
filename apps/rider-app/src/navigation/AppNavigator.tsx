import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, Text, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../store/AuthContext';

import LoginScreen          from '../screens/LoginScreen';
import HomeScreen           from '../screens/HomeScreen';
import ActiveDeliveryScreen from '../screens/ActiveDeliveryScreen';
import EarningsScreen       from '../screens/EarningsScreen';

const Stack = createNativeStackNavigator();
const Tab   = createBottomTabNavigator();

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#111',
          borderTopColor: '#222',
          height: 60,
          paddingBottom: 8,
        },
        tabBarActiveTintColor: '#22C55E',
        tabBarInactiveTintColor: '#555',
        tabBarIcon: ({ color, size, focused }) => {
          const icons: Record<string, any> = {
            Home:     focused ? 'home'     : 'home-outline',
            Earnings: focused ? 'wallet'   : 'wallet-outline',
          };
          return <Ionicons name={icons[route.name]} size={size} color={color} />;
        },
        tabBarLabel: ({ color, children }) => (
          <Text style={{ fontSize: 11, fontWeight: '600', color }}>{children}</Text>
        ),
      })}
    >
      <Tab.Screen name="Home"     component={HomeScreen}     />
      <Tab.Screen name="Earnings" component={EarningsScreen} />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  const { token, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0A0A0A', alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color="#22C55E" size="large" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
        {!token ? (
          <Stack.Screen name="Login" component={LoginScreen} />
        ) : (
          <>
            <Stack.Screen name="Main"           component={MainTabs}           />
            <Stack.Screen name="ActiveDelivery" component={ActiveDeliveryScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
