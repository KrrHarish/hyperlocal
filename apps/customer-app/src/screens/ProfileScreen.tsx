import React from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../store/AuthContext';

const MENU = [
  { section: 'Account', items: [
    { icon:'location-outline',   label:'Saved Addresses',  sub:'Manage delivery locations',  color:'#FF8A00' },
    { icon:'card-outline',       label:'Payment Methods',  sub:'UPI, Cards, Wallets',        color:'#8B5CF6' },
    { icon:'gift-outline',       label:'Refer & Earn',     sub:'Invite friends, get ₹50',    color:'#EC4899' },
  ]},
  { section: 'Support', items: [
    { icon:'help-circle-outline',label:'Help & Support',   sub:'Chat with us 24/7',          color:'#0EA5E9' },
    { icon:'document-text-outline',label:'Terms & Privacy',sub:'Read our policies',          color:'#6B7280' },
  ]},
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
    <View style={s.root}>
      {/* Header */}
      <LinearGradient colors={['#FF8A00','#FF5C00']} style={s.header}>
        <TouchableOpacity style={s.back} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={s.title}>Profile</Text>
        <View style={{ width: 36 }} />
      </LinearGradient>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Avatar card */}
        <View style={s.avatarCard}>
          <LinearGradient colors={['#FF8A00','#FF5C00']} style={s.avatarCircle}>
            <Text style={{ fontSize: 32 }}>👤</Text>
          </LinearGradient>
          <View style={{ flex: 1 }}>
            <Text style={s.userName}>Zuqu User</Text>
            <Text style={s.userPhone}>{phone || '+91 98765 43210'}</Text>
          </View>
          <TouchableOpacity style={s.editBtn}>
            <Ionicons name="pencil" size={16} color="#FF8A00" />
            <Text style={s.editTxt}>Edit</Text>
          </TouchableOpacity>
        </View>

        {/* Stats row */}
        <View style={s.statsRow}>
          {[
            { icon:'receipt-outline', label:'Orders',  value:'12',   color:'#FF8A00' },
            { icon:'cash-outline',    label:'Saved',   value:'₹340', color:'#22C55E' },
            { icon:'star-outline',    label:'Points',  value:'850',  color:'#8B5CF6' },
          ].map(st => (
            <View key={st.label} style={s.statBox}>
              <View style={[s.statIcon, { backgroundColor: st.color + '18' }]}>
                <Ionicons name={st.icon as any} size={20} color={st.color} />
              </View>
              <Text style={s.statVal}>{st.value}</Text>
              <Text style={s.statLbl}>{st.label}</Text>
            </View>
          ))}
        </View>

        {/* QuickPass */}
        <LinearGradient colors={['#0B1A2B','#1C3A5E']} style={s.passCard}>
          <View style={{ flex: 1 }}>
            <View style={s.passRow}>
              <Text style={s.passTitle}>⚡ QuickPass</Text>
              <View style={s.passBadge}><Text style={s.passBadgeTxt}>FREE TRIAL</Text></View>
            </View>
            <Text style={s.passSub}>Unlimited free delivery · ₹99/month</Text>
          </View>
          <TouchableOpacity>
            <LinearGradient colors={['#FF8A00','#FF5C00']} style={s.passBtn}
              start={{ x:0,y:0 }} end={{ x:1,y:0 }}>
              <Text style={s.passBtnTxt}>Activate</Text>
            </LinearGradient>
          </TouchableOpacity>
        </LinearGradient>

        {/* Menu sections */}
        {MENU.map(section => (
          <View key={section.section} style={s.menuSection}>
            <Text style={s.sectionLabel}>{section.section}</Text>
            <View style={s.menuCard}>
              {section.items.map((item, idx) => (
                <TouchableOpacity key={item.label} style={[s.menuItem,
                  idx < section.items.length - 1 && s.menuItemBorder]} activeOpacity={0.7}
                  onPress={() => {
                    if (item.label === 'Saved Addresses') navigation.navigate('Addresses');
                  }}>
                  <View style={[s.menuIcon, { backgroundColor: item.color + '18' }]}>
                    <Ionicons name={item.icon as any} size={20} color={item.color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.menuLabel}>{item.label}</Text>
                    <Text style={s.menuSub}>{item.sub}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color="#DDD" />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}

        {/* Logout */}
        <TouchableOpacity style={s.logoutCard} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={20} color="#EF4444" />
          <Text style={s.logoutTxt}>Logout</Text>
        </TouchableOpacity>

        <Text style={s.version}>Zuqu v1.0.0 · Made with ❤️ in Bengaluru</Text>
        <View style={{ height: 80 }} />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root:       { flex: 1, backgroundColor: '#F7F8FA' },
  header:     { paddingTop: Platform.OS === 'ios' ? 56 : 36, paddingBottom: 18, paddingHorizontal: 20,
                 flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  back:       { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.2)',
                 alignItems: 'center', justifyContent: 'center' },
  title:      { fontSize: 20, fontWeight: '800', color: '#fff' },

  avatarCard: { backgroundColor: '#fff', margin: 16, borderRadius: 20, padding: 18,
                 flexDirection: 'row', alignItems: 'center', gap: 14,
                 shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width:0,height:3 } },
  avatarCircle:{ width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  userName:   { fontSize: 18, fontWeight: '800', color: '#111', marginBottom: 3 },
  userPhone:  { fontSize: 14, color: '#888' },
  editBtn:    { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#FFF4E6',
                 borderRadius: 99, paddingHorizontal: 12, paddingVertical: 7 },
  editTxt:    { fontSize: 13, color: '#FF8A00', fontWeight: '700' },

  statsRow:   { flexDirection: 'row', paddingHorizontal: 16, gap: 10, marginBottom: 16 },
  statBox:    { flex: 1, backgroundColor: '#fff', borderRadius: 16, padding: 14, alignItems: 'center', gap: 6,
                 shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width:0,height:2 } },
  statIcon:   { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  statVal:    { fontSize: 20, fontWeight: '800', color: '#111' },
  statLbl:    { fontSize: 11, color: '#999', fontWeight: '600' },

  passCard:   { marginHorizontal: 16, marginBottom: 16, borderRadius: 20, padding: 18,
                 flexDirection: 'row', alignItems: 'center', gap: 12 },
  passRow:    { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  passTitle:  { fontSize: 16, fontWeight: '800', color: '#FF8A00' },
  passBadge:  { backgroundColor: 'rgba(255,138,0,0.2)', borderRadius: 99, paddingHorizontal: 8, paddingVertical: 3 },
  passBadgeTxt:{ fontSize: 9, color: '#FF8A00', fontWeight: '800', letterSpacing: 1 },
  passSub:    { fontSize: 12, color: 'rgba(255,255,255,0.5)' },
  passBtn:    { borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10 },
  passBtnTxt: { color: '#fff', fontSize: 14, fontWeight: '700' },

  menuSection:{ paddingHorizontal: 16, marginBottom: 14 },
  sectionLabel:{ fontSize: 12, fontWeight: '700', color: '#999', letterSpacing: 1,
                  textTransform: 'uppercase', marginBottom: 8, marginLeft: 4 },
  menuCard:   { backgroundColor: '#fff', borderRadius: 18, overflow: 'hidden',
                 shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width:0,height:2 } },
  menuItem:   { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 14 },
  menuItemBorder:{ borderBottomWidth: 0.5, borderBottomColor: '#F5F5F5' },
  menuIcon:   { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  menuLabel:  { fontSize: 15, fontWeight: '600', color: '#111', marginBottom: 2 },
  menuSub:    { fontSize: 12, color: '#999' },

  logoutCard: { backgroundColor: '#fff', marginHorizontal: 16, marginBottom: 8, borderRadius: 18, padding: 16,
                 flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
                 borderWidth: 1, borderColor: '#FEE2E2' },
  logoutTxt:  { fontSize: 16, fontWeight: '700', color: '#EF4444' },
  version:    { textAlign: 'center', fontSize: 12, color: '#CCC', marginBottom: 16 },
});
