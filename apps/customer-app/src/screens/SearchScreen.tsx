import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TextInput, FlatList, TouchableOpacity,
  StyleSheet, ActivityIndicator, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { searchProducts } from '../services/api';

const RECENT_KEY = 'zuqu_recent_searches';
const MAX_RECENT = 8;

function useDebounce(value: string, delay: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

async function loadRecent(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(RECENT_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

async function saveRecent(query: string, current: string[]): Promise<string[]> {
  const trimmed = query.trim();
  if (!trimmed) return current;
  const next = [trimmed, ...current.filter(q => q.toLowerCase() !== trimmed.toLowerCase())].slice(0, MAX_RECENT);
  await AsyncStorage.setItem(RECENT_KEY, JSON.stringify(next));
  return next;
}

async function removeRecent(query: string, current: string[]): Promise<string[]> {
  const next = current.filter(q => q !== query);
  await AsyncStorage.setItem(RECENT_KEY, JSON.stringify(next));
  return next;
}

async function clearAllRecent(): Promise<void> {
  await AsyncStorage.removeItem(RECENT_KEY);
}

export default function SearchScreen({ navigation }: any) {
  const [query, setQuery]           = useState('');
  const [results, setResults]       = useState<any[]>([]);
  const [loading, setLoading]       = useState(false);
  const [searched, setSearched]     = useState(false);
  const [recentSearches, setRecent] = useState<string[]>([]);
  const inputRef = useRef<TextInput>(null);

  const debouncedQuery = useDebounce(query, 400);

  // Load recent searches on mount
  useEffect(() => {
    loadRecent().then(setRecent);
  }, []);

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([]);
      setSearched(false);
      return;
    }
    setLoading(true);
    setSearched(true);
    try {
      const res = await searchProducts(q.trim());
      const data = res.data?.products || res.data?.data || res.data || [];
      const list = Array.isArray(data) ? data : [];
      setResults(list);
      // Save to recent only when results come back (real search)
      if (list.length >= 0) {
        const updated = await saveRecent(q.trim(), recentSearches);
        setRecent(updated);
      }
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [recentSearches]);

  useEffect(() => {
    doSearch(debouncedQuery);
  }, [debouncedQuery]);

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 200);
    return () => clearTimeout(t);
  }, []);

  const handleRecentTap = (term: string) => {
    setQuery(term);
    inputRef.current?.blur();
  };

  const handleRemoveRecent = async (term: string) => {
    const updated = await removeRecent(term, recentSearches);
    setRecent(updated);
  };

  const handleClearAll = async () => {
    await clearAllRecent();
    setRecent([]);
  };

  const renderResult = ({ item }: { item: any }) => (
    <TouchableOpacity
      style={s.card}
      activeOpacity={0.88}
      onPress={() => navigation.navigate('ProductDetail', {
        product: {
          id:           item.id,
          name:         item.name,
          brand:        item.brand || '',
          price:        item.price,
          unit:         item.unit || '',
          category:     item.category || 'grocery',
          stock_status: item.stock_status || 'in_stock',
          custom_image_url: item.custom_image_url || null,
        },
        shop: {
          id:       item.shop_id,
          name:     item.shop_name || 'Shop',
          category: item.category || 'grocery',
          is_open:  true,
          address:  '',
          rating:   4.5,
          eta:      '15–20 min',
          distance: 'Nearby',
        },
      })}
    >
      <View style={s.cardLeft}>
        <View style={s.productIconWrap}>
          <Text style={{ fontSize: 22 }}>🛒</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.productName} numberOfLines={1}>{item.name}</Text>
          {item.brand ? (
            <Text style={s.productBrand} numberOfLines={1}>{item.brand}</Text>
          ) : null}
          <Text style={s.productMeta} numberOfLines={1}>
            {item.unit ? `${item.unit}  ·  ` : ''}{item.shop_name || 'Unknown Shop'}
          </Text>
        </View>
      </View>
      <View style={s.cardRight}>
        <Text style={s.price}>₹{item.price}</Text>
        <Ionicons name="chevron-forward" size={14} color="#CCC" style={{ marginTop: 2 }} />
      </View>
    </TouchableOpacity>
  );

  const showRecent = !searched && !loading && recentSearches.length > 0;
  const showEmpty  = !searched && !loading && recentSearches.length === 0;

  return (
    <View style={s.root}>
      {/* Header */}
      <LinearGradient colors={['#FF8A00', '#FF5C00']} style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={20} color="#fff" />
        </TouchableOpacity>
        <View style={s.inputWrap}>
          <Ionicons name="search" size={16} color="#999" style={{ marginLeft: 10 }} />
          <TextInput
            ref={inputRef}
            style={s.input}
            placeholder="Search products, brands…"
            placeholderTextColor="#999"
            value={query}
            onChangeText={setQuery}
            returnKeyType="search"
            autoCorrect={false}
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => { setQuery(''); setResults([]); setSearched(false); }}>
              <Ionicons name="close-circle" size={18} color="#CCC" style={{ marginRight: 10 }} />
            </TouchableOpacity>
          )}
        </View>
      </LinearGradient>

      {/* Content */}
      {loading ? (
        <View style={s.center}>
          <ActivityIndicator size="large" color="#FF8A00" />
          <Text style={s.hintTxt}>Searching…</Text>
        </View>

      ) : showRecent ? (
        <View style={s.recentWrap}>
          {/* Header row */}
          <View style={s.recentHeader}>
            <Text style={s.recentTitle}>Recent Searches</Text>
            <TouchableOpacity onPress={handleClearAll}>
              <Text style={s.clearAllTxt}>Clear all</Text>
            </TouchableOpacity>
          </View>
          {recentSearches.map(term => (
            <TouchableOpacity
              key={term}
              style={s.recentRow}
              activeOpacity={0.7}
              onPress={() => handleRecentTap(term)}
            >
              <View style={s.recentIconWrap}>
                <Ionicons name="time-outline" size={17} color="#999" />
              </View>
              <Text style={s.recentTerm} numberOfLines={1}>{term}</Text>
              <TouchableOpacity
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                onPress={() => handleRemoveRecent(term)}
              >
                <Ionicons name="close" size={16} color="#CCC" />
              </TouchableOpacity>
            </TouchableOpacity>
          ))}
        </View>

      ) : showEmpty ? (
        <View style={s.center}>
          <Text style={{ fontSize: 48, marginBottom: 12 }}>🔍</Text>
          <Text style={s.emptyTitle}>Find products near you</Text>
          <Text style={s.emptySubtitle}>Search by name, brand, or category</Text>
        </View>

      ) : results.length === 0 ? (
        <View style={s.center}>
          <Text style={{ fontSize: 48, marginBottom: 12 }}>😕</Text>
          <Text style={s.emptyTitle}>No results found</Text>
          <Text style={s.emptySubtitle}>Try a different search term</Text>
        </View>

      ) : (
        <FlatList
          data={results}
          keyExtractor={(item, idx) => item.id?.toString() || idx.toString()}
          renderItem={renderResult}
          contentContainerStyle={{ padding: 16, gap: 10 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={
            <Text style={s.resultCount}>{results.length} result{results.length !== 1 ? 's' : ''} for "{debouncedQuery}"</Text>
          }
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root:        { flex: 1, backgroundColor: '#F7F8FA' },
  header:      { paddingTop: Platform.OS === 'ios' ? 56 : 36, paddingBottom: 14,
                  paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 10 },
  backBtn:     { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.2)',
                  alignItems: 'center', justifyContent: 'center' },
  inputWrap:   { flex: 1, flexDirection: 'row', alignItems: 'center',
                  backgroundColor: '#fff', borderRadius: 14, height: 42, gap: 6 },
  input:       { flex: 1, fontSize: 15, color: '#111', paddingVertical: 0 },

  center:      { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 32 },
  hintTxt:     { fontSize: 13, color: '#888', marginTop: 6 },
  emptyTitle:  { fontSize: 18, fontWeight: '700', color: '#333' },
  emptySubtitle:{ fontSize: 13, color: '#999', textAlign: 'center', lineHeight: 20 },

  resultCount: { fontSize: 12, color: '#999', marginBottom: 4 },

  // Recent searches
  recentWrap:   { paddingHorizontal: 16, paddingTop: 20 },
  recentHeader: { flexDirection: 'row', justifyContent: 'space-between',
                   alignItems: 'center', marginBottom: 12 },
  recentTitle:  { fontSize: 15, fontWeight: '800', color: '#111' },
  clearAllTxt:  { fontSize: 13, color: '#FF8A00', fontWeight: '600' },
  recentRow:    { flexDirection: 'row', alignItems: 'center', gap: 12,
                   backgroundColor: '#fff', borderRadius: 14, paddingVertical: 12,
                   paddingHorizontal: 14, marginBottom: 8,
                   shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6,
                   shadowOffset: { width: 0, height: 1 } },
  recentIconWrap:{ width: 34, height: 34, borderRadius: 10, backgroundColor: '#F5F5F5',
                   alignItems: 'center', justifyContent: 'center' },
  recentTerm:   { flex: 1, fontSize: 14, color: '#222', fontWeight: '500' },

  card:        { backgroundColor: '#fff', borderRadius: 16, padding: 14,
                  flexDirection: 'row', alignItems: 'center',
                  shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width:0, height:2 } },
  cardLeft:    { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  productIconWrap:{ width: 44, height: 44, borderRadius: 12, backgroundColor: '#FFF4E6',
                    alignItems: 'center', justifyContent: 'center' },
  productName: { fontSize: 15, fontWeight: '700', color: '#111', marginBottom: 2 },
  productBrand:{ fontSize: 12, color: '#888', marginBottom: 2 },
  productMeta: { fontSize: 12, color: '#BBB' },
  cardRight:   { alignItems: 'flex-end', gap: 2 },
  price:       { fontSize: 16, fontWeight: '800', color: '#FF8A00' },
});
