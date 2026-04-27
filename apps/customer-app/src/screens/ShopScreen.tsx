import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Platform, TextInput,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useCart } from '../store/CartContext';
import { getShopProducts } from '../services/api';

const MOCK_PRODUCTS = [
  { id: 'p1', name: 'Amul Milk 500ml',      price: 28,  category: 'Dairy',         emoji: '🥛', in_stock: true },
  { id: 'p2', name: 'Britannia Bread',       price: 42,  category: 'Bakery',        emoji: '🍞', in_stock: true },
  { id: 'p3', name: 'Tata Salt 1kg',         price: 22,  category: 'Grocery',       emoji: '🧂', in_stock: true },
  { id: 'p4', name: 'Lays Classic Salted',   price: 20,  category: 'Snacks',        emoji: '🍿', in_stock: true },
  { id: 'p5', name: 'Parle-G Biscuits',      price: 10,  category: 'Snacks',        emoji: '🍪', in_stock: false },
  { id: 'p6', name: 'Tropicana Orange 1L',   price: 85,  category: 'Beverages',     emoji: '🧃', in_stock: true },
  { id: 'p7', name: 'Surf Excel 500g',       price: 78,  category: 'Household',     emoji: '🧺', in_stock: true },
  { id: 'p8', name: 'Colgate Toothpaste',    price: 65,  category: 'Personal Care', emoji: '🪥', in_stock: true },
  { id: 'p9', name: 'Fortune Sunflower Oil', price: 145, category: 'Grocery',       emoji: '🫒', in_stock: true },
  { id: 'p10',name: 'Maggi Noodles 4pk',     price: 60,  category: 'Snacks',        emoji: '🍜', in_stock: true },
];

export default function ShopScreen({ route, navigation }: any) {
  const { shop } = route.params;
  const { addItem, updateQty, items, itemCount, total } = useCart();
  const [products, setProducts]   = useState<any[]>([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState('');
  const [activeTab, setActiveTab] = useState('All');

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await getShopProducts(shop.id);
        const list = res.data?.products || res.data || [];
        if (Array.isArray(list) && list.length > 0) {
          setProducts(list.map((p: any) => ({
            id: p.id, name: p.name,
            price: p.price || p.selling_price || 0,
            category: p.category || 'General',
            emoji: '📦', in_stock: p.in_stock !== false,
          })));
        } else { setProducts(MOCK_PRODUCTS); }
      } catch { setProducts(MOCK_PRODUCTS); }
      finally { setLoading(false); }
    })();
  }, [shop.id]);

  const getQty = (pid: string) => items.find(i => i.product_id === pid)?.quantity || 0;

  const categories = ['All', ...Array.from(new Set(products.map(p => p.category)))];

  const visible = products.filter(p =>
    (activeTab === 'All' || p.category === activeTab) &&
    (!search || p.name.toLowerCase().includes(search.toLowerCase()))
  );

  const grouped = visible.reduce((acc: any, p) => {
    const k = activeTab === 'All' ? p.category : 'Products';
    acc[k] = acc[k] ? [...acc[k], p] : [p];
    return acc;
  }, {});

  return (
    <View style={s.root}>
      {/* Header */}
      <LinearGradient colors={['#FF8A00','#FF5C00']} style={s.header}>
        <View style={s.hRow}>
          <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={s.shopName} numberOfLines={1}>{shop.name}</Text>
            <View style={s.metaRow}>
              <Ionicons name="star" size={12} color="rgba(255,255,255,0.9)" />
              <Text style={s.metaTxt}>{shop.rating}  ·  {shop.eta}  ·  {shop.distance}</Text>
            </View>
          </View>
          <View style={[s.statusDot, { backgroundColor: shop.is_open ? '#4ADE80' : '#F87171' }]} />
        </View>

        {/* Search inside shop */}
        <View style={s.searchBox}>
          <Ionicons name="search-outline" size={16} color="#999" style={{ marginRight: 8 }} />
          <TextInput
            style={s.searchInput}
            placeholder={`Search in ${shop.name}…`}
            placeholderTextColor="#BBB"
            value={search}
            onChangeText={setSearch}
          />
        </View>
      </LinearGradient>

      {/* Category tabs */}
      <View style={s.tabBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.tabContent}>
          {categories.map(cat => (
            <TouchableOpacity key={cat} style={[s.tab, activeTab === cat && s.tabActive]}
              onPress={() => setActiveTab(cat)}>
              <Text style={[s.tabTxt, activeTab === cat && s.tabTxtActive]}>{cat}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {loading ? (
        <View style={s.center}><ActivityIndicator size="large" color="#FF8A00" /></View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false}>
          {Object.entries(grouped).map(([cat, prods]: any) => (
            <View key={cat}>
              <Text style={s.catHeader}>{cat}</Text>
              {prods.map((p: any) => {
                const qty = getQty(p.id);
                return (
                  <View key={p.id} style={[s.pCard, !p.in_stock && s.pCardFaded]}>
                    {/* Product image */}
                    <View style={s.pImg}>
                      <Text style={{ fontSize: 30 }}>{p.emoji}</Text>
                    </View>

                    {/* Info */}
                    <View style={{ flex: 1 }}>
                      <Text style={s.pName}>{p.name}</Text>
                      <Text style={s.pUnit}>{p.unit || '1 piece'}</Text>
                      <Text style={s.pPrice}>₹{p.price}</Text>
                    </View>

                    {/* Add / counter */}
                    {!p.in_stock ? (
                      <View style={s.outBtn}>
                        <Text style={s.outTxt}>Out of stock</Text>
                      </View>
                    ) : qty === 0 ? (
                      <TouchableOpacity style={s.addBtn}
                        onPress={() => addItem(
                          { product_id: p.id, name: p.name, price: p.price, quantity: 1 },
                          shop.id, shop.name
                        )}>
                        <Ionicons name="add" size={18} color="#FF8A00" />
                        <Text style={s.addTxt}>ADD</Text>
                      </TouchableOpacity>
                    ) : (
                      <View style={s.counter}>
                        <TouchableOpacity style={s.cBtn}
                          onPress={() => updateQty(p.id, qty - 1)}>
                          <Ionicons name="remove" size={16} color="#fff" />
                        </TouchableOpacity>
                        <Text style={s.cNum}>{qty}</Text>
                        <TouchableOpacity style={s.cBtn}
                          onPress={() => addItem(
                            { product_id: p.id, name: p.name, price: p.price, quantity: 1 },
                            shop.id, shop.name
                          )}>
                          <Ionicons name="add" size={16} color="#fff" />
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          ))}
          <View style={{ height: 120 }} />
        </ScrollView>
      )}

      {/* Cart bar */}
      {itemCount > 0 && (
        <TouchableOpacity style={s.cartBar} onPress={() => navigation.navigate('Cart')} activeOpacity={0.9}>
          <LinearGradient colors={['#FF8A00','#FF5C00']} style={s.cartGrad}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
            <View style={s.cartLeft}>
              <View style={s.cartBadge}>
                <Text style={s.cartBadgeTxt}>{itemCount}</Text>
              </View>
              <View>
                <Text style={s.cartLabel}>View Cart</Text>
                <Text style={s.cartShop}>{shop.name}</Text>
              </View>
            </View>
            <View style={s.cartRight}>
              <Text style={s.cartTotal}>₹{total}</Text>
              <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.8)" />
            </View>
          </LinearGradient>
        </TouchableOpacity>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root:        { flex: 1, backgroundColor: '#F7F8FA' },
  header:      { paddingTop: Platform.OS === 'ios' ? 56 : 36, paddingBottom: 14, paddingHorizontal: 20 },
  hRow:        { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  backBtn:     { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.2)',
                  alignItems: 'center', justifyContent: 'center' },
  shopName:    { fontSize: 18, fontWeight: '800', color: '#fff' },
  metaRow:     { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  metaTxt:     { fontSize: 12, color: 'rgba(255,255,255,0.85)' },
  statusDot:   { width: 10, height: 10, borderRadius: 5 },
  searchBox:   { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff',
                  borderRadius: 12, paddingHorizontal: 12, height: 40 },
  searchInput: { flex: 1, fontSize: 14, color: '#111' },

  tabBar:      { backgroundColor: '#fff', borderBottomWidth: 0.5, borderBottomColor: '#ECECEC' },
  tabContent:  { paddingHorizontal: 16, paddingVertical: 8, gap: 6 },
  tab:         { paddingHorizontal: 16, paddingVertical: 7, borderRadius: 99,
                  backgroundColor: '#F2F3F5' },
  tabActive:   { backgroundColor: '#FF8A00' },
  tabTxt:      { fontSize: 13, fontWeight: '600', color: '#666' },
  tabTxtActive:{ color: '#fff' },

  center:      { flex: 1, alignItems: 'center', justifyContent: 'center' },

  catHeader:   { fontSize: 14, fontWeight: '800', color: '#333', paddingHorizontal: 16,
                  paddingTop: 20, paddingBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },

  pCard:       { backgroundColor: '#fff', marginHorizontal: 16, marginBottom: 10, borderRadius: 16,
                  padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12,
                  shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
  pCardFaded:  { opacity: 0.5 },
  pImg:        { width: 60, height: 60, borderRadius: 12, backgroundColor: '#FFF4E6',
                  alignItems: 'center', justifyContent: 'center' },
  pName:       { fontSize: 15, fontWeight: '600', color: '#111', marginBottom: 2 },
  pUnit:       { fontSize: 12, color: '#999', marginBottom: 4 },
  pPrice:      { fontSize: 16, fontWeight: '800', color: '#FF8A00' },

  outBtn:      { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8,
                  backgroundColor: '#F5F5F5', alignItems: 'center' },
  outTxt:      { fontSize: 11, color: '#999', fontWeight: '600' },

  addBtn:      { flexDirection: 'column', alignItems: 'center', borderRadius: 12,
                  paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1.5,
                  borderColor: '#FF8A00', gap: 2 },
  addTxt:      { fontSize: 11, fontWeight: '800', color: '#FF8A00', letterSpacing: 0.5 },

  counter:     { flexDirection: 'row', alignItems: 'center', borderRadius: 12,
                  overflow: 'hidden', backgroundColor: '#FF8A00' },
  cBtn:        { width: 34, height: 38, alignItems: 'center', justifyContent: 'center' },
  cNum:        { color: '#fff', fontSize: 15, fontWeight: '800', minWidth: 26, textAlign: 'center' },

  cartBar:     { position: 'absolute', bottom: 20, left: 16, right: 16, borderRadius: 18,
                  overflow: 'hidden',
                  shadowColor: '#FF8A00', shadowOpacity: 0.45, shadowRadius: 20, shadowOffset: { width: 0, height: 6 } },
  cartGrad:    { paddingHorizontal: 18, paddingVertical: 14, flexDirection: 'row',
                  alignItems: 'center', justifyContent: 'space-between' },
  cartLeft:    { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cartBadge:   { width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.25)',
                  alignItems: 'center', justifyContent: 'center' },
  cartBadgeTxt:{ color: '#fff', fontSize: 13, fontWeight: '800' },
  cartLabel:   { color: '#fff', fontSize: 15, fontWeight: '700' },
  cartShop:    { color: 'rgba(255,255,255,0.7)', fontSize: 11 },
  cartRight:   { flexDirection: 'row', alignItems: 'center', gap: 4 },
  cartTotal:   { color: '#fff', fontSize: 18, fontWeight: '800' },
});
