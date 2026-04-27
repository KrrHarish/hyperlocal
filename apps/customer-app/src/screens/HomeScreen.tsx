import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, ScrollView, TouchableOpacity,
  StyleSheet, RefreshControl, FlatList, ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { getNearbyShops, searchProducts } from '../services/api';
import { colors } from '../theme';

const CATEGORIES = [
  { id: 'all', label: 'All', emoji: '🏪' },
  { id: 'grocery', label: 'Grocery', emoji: '🥦' },
  { id: 'dairy', label: 'Dairy', emoji: '🥛' },
  { id: 'snacks', label: 'Snacks', emoji: '🍿' },
  { id: 'beverages', label: 'Drinks', emoji: '🧃' },
  { id: 'personal_care', label: 'Care', emoji: '🧴' },
];

const MOCK_SHOPS = [
  { id: '1', name: 'Raju General Store', category: 'grocery', distance: '0.3 km',
    eta: '8 min', rating: 4.8, reviews: 124, is_open: true,
    tags: ['Grocery', 'Snacks', 'Dairy'] },
  { id: '2', name: 'Krishna Medicals', category: 'pharmacy', distance: '0.5 km',
    eta: '12 min', rating: 4.6, reviews: 89, is_open: true,
    tags: ['Medicine', 'Personal Care'] },
  { id: '3', name: 'Lakshmi Provisions', category: 'grocery', distance: '0.8 km',
    eta: '15 min', rating: 4.7, reviews: 210, is_open: false,
    tags: ['Grocery', 'Pulses', 'Spices'] },
  { id: '4', name: 'Cool Drinks Corner', category: 'beverages', distance: '0.4 km',
    eta: '10 min', rating: 4.5, reviews: 67, is_open: true,
    tags: ['Beverages', 'Ice cream', 'Snacks'] },
];

export default function HomeScreen({ navigation }: any) {
  const [search, setSearch]     = useState('');
  const [category, setCategory] = useState('all');
  const [shops, setShops]       = useState(MOCK_SHOPS);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading]   = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  };

  const filtered = shops.filter(s =>
    (category === 'all' || s.category === category) &&
    (search === '' || s.name.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />

      {/* Header */}
      <LinearGradient colors={['#FF8A00', '#FF5C00']} style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <View style={styles.locationRow}>
              <Ionicons name="location-sharp" size={16} color="rgba(255,255,255,0.9)" />
              <Text style={styles.locationLabel}>Delivering to</Text>
            </View>
            <TouchableOpacity style={styles.locationBtn}>
              <Text style={styles.locationText}>HSR Layout, Bengaluru</Text>
              <Ionicons name="chevron-down" size={16} color="#fff" />
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            style={styles.profileBtn}
            onPress={() => navigation.navigate('Profile')}
          >
            <Text style={styles.profileEmoji}>👤</Text>
          </TouchableOpacity>
        </View>

        {/* Search */}
        <View style={styles.searchWrap}>
          <Ionicons name="search" size={18} color="rgba(0,0,0,0.4)" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search shops or products..."
            placeholderTextColor="rgba(0,0,0,0.35)"
            value={search}
            onChangeText={setSearch}
          />
        </View>
      </LinearGradient>

      <ScrollView
        style={styles.body}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FF8A00" />}
      >
        {/* Categories */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catScroll}
          contentContainerStyle={styles.catContent}>
          {CATEGORIES.map(cat => (
            <TouchableOpacity
              key={cat.id}
              style={[styles.catChip, category === cat.id && styles.catChipActive]}
              onPress={() => setCategory(cat.id)}
            >
              <Text style={styles.catEmoji}>{cat.emoji}</Text>
              <Text style={[styles.catLabel, category === cat.id && styles.catLabelActive]}>
                {cat.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Promo banner */}
        <LinearGradient
          colors={['#0B1A2B', '#0F2236']}
          style={styles.promoBanner}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
        >
          <View>
            <Text style={styles.promoTitle}>⚡ QuickPass</Text>
            <Text style={styles.promoSub}>Free delivery on all orders</Text>
            <TouchableOpacity style={styles.promoBtn}>
              <Text style={styles.promoBtnText}>Try ₹99/month</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.promoEmoji}>🛵</Text>
        </LinearGradient>

        {/* Shops section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {filtered.length} Shops Nearby
          </Text>

          {filtered.map(shop => (
            <TouchableOpacity
              key={shop.id}
              style={styles.shopCard}
              onPress={() => navigation.navigate('Shop', { shop })}
              activeOpacity={0.85}
            >
              <View style={styles.shopImgPlaceholder}>
                <Text style={styles.shopEmoji}>🏪</Text>
              </View>
              <View style={styles.shopInfo}>
                <View style={styles.shopRow}>
                  <Text style={styles.shopName}>{shop.name}</Text>
                  {!shop.is_open && (
                    <View style={styles.closedBadge}>
                      <Text style={styles.closedText}>Closed</Text>
                    </View>
                  )}
                </View>
                <View style={styles.shopTags}>
                  {shop.tags.map(t => (
                    <View key={t} style={styles.tag}>
                      <Text style={styles.tagText}>{t}</Text>
                    </View>
                  ))}
                </View>
                <View style={styles.shopMeta}>
                  <View style={styles.metaItem}>
                    <Ionicons name="star" size={13} color="#FACC15" />
                    <Text style={styles.metaText}>{shop.rating} ({shop.reviews})</Text>
                  </View>
                  <View style={styles.metaDot} />
                  <View style={styles.metaItem}>
                    <Ionicons name="time-outline" size={13} color={colors.muted} />
                    <Text style={styles.metaText}>{shop.eta}</Text>
                  </View>
                  <View style={styles.metaDot} />
                  <View style={styles.metaItem}>
                    <Ionicons name="location-outline" size={13} color={colors.muted} />
                    <Text style={styles.metaText}>{shop.distance}</Text>
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: '#F5F5F5' },

  // Header
  header:       { paddingTop: 52, paddingBottom: 16, paddingHorizontal: 20 },
  headerTop:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 },
  locationRow:  { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 2 },
  locationLabel:{ color: 'rgba(255,255,255,0.8)', fontSize: 12, fontWeight: '500' },
  locationBtn:  { flexDirection: 'row', alignItems: 'center', gap: 4 },
  locationText: { color: '#fff', fontSize: 17, fontWeight: '800' },
  profileBtn:   { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.2)',
                   alignItems: 'center', justifyContent: 'center' },
  profileEmoji: { fontSize: 20 },
  searchWrap:   { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff',
                   borderRadius: 14, paddingHorizontal: 14, height: 46 },
  searchIcon:   { marginRight: 8 },
  searchInput:  { flex: 1, fontSize: 15, color: '#111', fontWeight: '500' },

  // Body
  body:         { flex: 1 },
  catScroll:    { backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  catContent:   { paddingHorizontal: 16, paddingVertical: 12, gap: 8 },
  catChip:      { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14,
                   paddingVertical: 8, borderRadius: 99, backgroundColor: '#F5F5F5', borderWidth: 1.5,
                   borderColor: 'transparent' },
  catChipActive:{ backgroundColor: 'rgba(255,138,0,0.1)', borderColor: '#FF8A00' },
  catEmoji:     { fontSize: 16 },
  catLabel:     { fontSize: 13, fontWeight: '600', color: '#666' },
  catLabelActive:{ color: '#FF8A00' },

  // Promo
  promoBanner:  { margin: 16, borderRadius: 18, padding: 20,
                   flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  promoTitle:   { fontSize: 18, fontWeight: '800', color: '#FF8A00', marginBottom: 4 },
  promoSub:     { fontSize: 13, color: 'rgba(255,255,255,0.6)', marginBottom: 12 },
  promoBtn:     { backgroundColor: '#FF8A00', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 8, alignSelf: 'flex-start' },
  promoBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  promoEmoji:   { fontSize: 52 },

  // Section
  section:      { paddingHorizontal: 16 },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: '#111', marginBottom: 14 },

  // Shop card
  shopCard:     { backgroundColor: '#fff', borderRadius: 18, marginBottom: 14, padding: 14,
                   flexDirection: 'row', gap: 14,
                   shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 3 } },
  shopImgPlaceholder: { width: 72, height: 72, borderRadius: 14, backgroundColor: '#FFF4E6',
                         alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  shopEmoji:    { fontSize: 32 },
  shopInfo:     { flex: 1 },
  shopRow:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  shopName:     { fontSize: 16, fontWeight: '700', color: '#111', flex: 1 },
  closedBadge:  { backgroundColor: '#FEE2E2', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  closedText:   { fontSize: 11, fontWeight: '700', color: '#EF4444' },
  shopTags:     { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginBottom: 8 },
  tag:          { backgroundColor: '#F5F5F5', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  tagText:      { fontSize: 11, color: '#666', fontWeight: '500' },
  shopMeta:     { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaItem:     { flexDirection: 'row', alignItems: 'center', gap: 3 },
  metaText:     { fontSize: 12, color: '#888', fontWeight: '500' },
  metaDot:      { width: 3, height: 3, borderRadius: 1.5, backgroundColor: '#CCC' },
});
