import React from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../store/AuthContext';

const MENU_ITEMS = [
  { icon: 'location-outline',  label: 'Saved Addresses',  sub: 'Manage delivery locations' },
  { icon: 'card-outline',      label: 'Payment Methods',  sub: 'Cards, UPI, Wallets' },
  { icon: 'gift-outline',      label: 'Refer & Earn',     sub: 'Invite friends, get ₹50' },
  { icon: 'help-circle-outline',label: 'Help & Support',  sub: 'Chat with us 24/7' },
  { icon: 'shield-outline',    label: 'Privacy Policy',   sub: 'Read our terms' },
];

export default function ProfileScreen({ navigation }: any) {
  const { phone, logout } = useAuth();

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', style: 'destructive', onPress: logout },
    ]);
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient colors={['#FF8A00', '#FF5C00']} style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Profile</Text>
        <View style={{ width: 36 }} />
      </LinearGradient>

      <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
        {/* Avatar card */}
        <View style={styles.avatarCard}>
          <LinearGradient colors={['#0B1A2B', '#0F2236']} style={styles.avatarCircle}>
            <Text style={styles.avatarEmoji}>👤</Text>
          </LinearGradient>
          <View>
            <Text style={styles.userName}>Zuqu User</Text>
            <Text style={styles.userPhone}>{phone || '+91 98765 43210'}</Text>
          </View>
          <TouchableOpacity style={styles.editBtn}>
            <Ionicons name="pencil" size={16} color="#FF8A00" />
          </TouchableOpacity>
        </View>

        {/* QuickPass card */}
        <LinearGradient colors={['#0B1A2B', '#0F2236']} style={styles.passCard}>
          <View>
            <Text style={styles.passTitle}>⚡ QuickPass</Text>
            <Text style={styles.passSub}>Unlimited free delivery · ₹99/month</Text>
          </View>
          <TouchableOpacity style={styles.passBtn}>
            <LinearGradient colors={['#FF8A00', '#FF5C00']} style={styles.passBtnGrad}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
              <Text style={styles.passBtnText}>Activate</Text>
            </LinearGradient>
          </TouchableOpacity>
        </LinearGradient>

        {/* Stats */}
        <View style={styles.statsRow}>
          {[
            { label: 'Orders', value: '12' },
            { label: 'Saved', value: '₹340' },
            { label: 'Points', value: '850' },
          ].map(s => (
            <View key={s.label} style={styles.statBox}>
              <Text style={styles.statVal}>{s.value}</Text>
              <Text style={styles.statLbl}>{s.label}</Text>
            </View>
          ))}
        </View>

        {/* Menu */}
        <View style={styles.menu}>
          {MENU_ITEMS.map((item, idx) => (
            <TouchableOpacity key={idx} style={styles.menuItem} activeOpacity={0.7}>
              <View style={styles.menuIcon}>
                <Ionicons name={item.icon as any} size={20} color="#FF8A00" />
              </View>
              <View style={styles.menuText}>
                <Text style={styles.menuLabel}>{item.label}</Text>
                <Text style={styles.menuSub}>{item.sub}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#CCC" />
            </TouchableOpacity>
          ))}
        </View>

        {/* Logout */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={20} color="#EF4444" />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>

        <Text style={styles.version}>Zuqu v1.0.0 · Made with ❤️ in Bengaluru</Text>
        <View style={{ height: 60 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: '#F5F5F5' },
  header:       { paddingTop: 52, paddingBottom: 18, paddingHorizontal: 20,
                   flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backBtn:      { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.2)',
                   alignItems: 'center', justifyContent: 'center' },
  headerTitle:  { fontSize: 20, fontWeight: '800', color: '#fff' },

  body:         { flex: 1, padding: 16 },

  avatarCard:   { backgroundColor: '#fff', borderRadius: 18, padding: 16, flexDirection: 'row',
                   alignItems: 'center', gap: 14, marginBottom: 14,
                   shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: 3 } },
  avatarCircle: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center' },
  avatarEmoji:  { fontSize: 28 },
  userName:     { fontSize: 18, fontWeight: '800', color: '#111', marginBottom: 3 },
  userPhone:    { fontSize: 14, color: '#888', fontWeight: '500' },
  editBtn:      { marginLeft: 'auto', width: 36, height: 36, borderRadius: 18,
                   backgroundColor: '#FFF4E6', alignItems: 'center', justifyContent: 'center' },

  passCard:     { borderRadius: 18, padding: 18, flexDirection: 'row', alignItems: 'center',
                   justifyContent: 'space-between', marginBottom: 14 },
  passTitle:    { fontSize: 16, fontWeight: '800', color: '#FF8A00', marginBottom: 4 },
  passSub:      { fontSize: 12, color: 'rgba(255,255,255,0.5)' },
  passBtn:      { borderRadius: 10, overflow: 'hidden' },
  passBtnGrad:  { paddingHorizontal: 16, paddingVertical: 10 },
  passBtnText:  { color: '#fff', fontSize: 14, fontWeight: '700' },

  statsRow:     { flexDirection: 'row', gap: 12, marginBottom: 14 },
  statBox:      { flex: 1, backgroundColor: '#fff', borderRadius: 14, padding: 16, alignItems: 'center',
                   shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
  statVal:      { fontSize: 22, fontWeight: '800', color: '#FF8A00', marginBottom: 4 },
  statLbl:      { fontSize: 12, color: '#888', fontWeight: '500' },

  menu:         { backgroundColor: '#fff', borderRadius: 18, overflow: 'hidden', marginBottom: 14,
                   shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
  menuItem:     { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 14,
                   borderBottomWidth: 1, borderBottomColor: '#F5F5F5' },
  menuIcon:     { width: 40, height: 40, borderRadius: 12, backgroundColor: '#FFF4E6',
                   alignItems: 'center', justifyContent: 'center' },
  menuText:     { flex: 1 },
  menuLabel:    { fontSize: 15, fontWeight: '600', color: '#111', marginBottom: 2 },
  menuSub:      { fontSize: 12, color: '#888' },

  logoutBtn:    { backgroundColor: '#fff', borderRadius: 18, padding: 16, flexDirection: 'row',
                   alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 16,
                   borderWidth: 1.5, borderColor: '#FEE2E2',
                   shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
  logoutText:   { fontSize: 16, fontWeight: '700', color: '#EF4444' },

  version:      { textAlign: 'center', fontSize: 12, color: '#BBB', fontWeight: '500' },
});
