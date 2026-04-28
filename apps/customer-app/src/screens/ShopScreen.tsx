import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Platform, TextInput, StatusBar,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useCart } from '../store/CartContext';
import { getShopProducts } from '../services/api';

// ── Category emoji + colour map ─────────────────────────────────
const CAT_META: Record<string, { emoji: string; color: string }> = {
  grocery:       { emoji: '🛒', color: '#FFF4E6' },
  dairy:         { emoji: '🥛', color: '#EFF6FF' },
  snacks:        { emoji: '🍿', color: '#FFF7ED' },
  beverages:     { emoji: '🧃', color: '#F0FDF4' },
  personal_care: { emoji: '🧴', color: '#FDF4FF' },
  household:     { emoji: '🧹', color: '#F0F9FF' },
  bakery:        { emoji: '🍞', color: '#FFFBEB' },
  pharmacy:      { emoji: '💊', color: '#FEF2F2' },
  general:       { emoji: '📦', color: '#F9FAFB' },
};

// ── Per-product emoji from name keywords ────────────────────────
function productEmoji(name: string, category: string): string {
  const n = name.toLowerCase();
  if (n.includes('milk'))        return '🥛';
  if (n.includes('butter'))      return '🧈';
  if (n.includes('curd') || n.includes('yogurt')) return '🥣';
  if (n.includes('cheese'))      return '🧀';
  if (n.includes('egg'))         return '🥚';
  if (n.includes('bread'))       return '🍞';
  if (n.includes('cake') || n.includes('pastry')) return '🎂';
  if (n.includes('croissant'))   return '🥐';
  if (n.includes('pav') || n.includes('bun'))     return '🫓';
  if (n.includes('rice'))        return '🍚';
  if (n.includes('atta') || n.includes('flour'))  return '🌾';
  if (n.includes('dal') || n.includes('lentil'))  return '🫘';
  if (n.includes('oil'))         return '🫒';
  if (n.includes('salt'))        return '🧂';
  if (n.includes('sugar'))       return '🍬';
  if (n.includes('maggi') || n.includes('noodle')) return '🍜';
  if (n.includes('biscuit') || n.includes('cookie')) return '🍪';
  if (n.includes('chips') || n.includes('lays') || n.includes('kurkure')) return '🍿';
  if (n.includes('chocolate'))   return '🍫';
  if (n.includes('juice') || n.includes('tropicana') || n.includes('minute maid')) return '🧃';
  if (n.includes('cola') || n.includes('pepsi') || n.includes('sprite')) return '🥤';
  if (n.includes('water'))       return '💧';
  if (n.includes('red bull') || n.includes('energy')) return '⚡';
  if (n.includes('coffee'))      return '☕';
  if (n.includes('tea'))         return '🍵';
  if (n.includes('soap') || n.includes('dettol')) return '🧼';
  if (n.includes('shampoo') || n.includes('dove')) return '🧴';
  if (n.includes('toothpaste') || n.includes('colgate')) return '🪥';
  if (n.includes('detergent') || n.includes('surf')) return '🧺';
  if (n.includes('toilet') || n.includes('harpic')) return '🚽';
  if (n.includes('medicine') || n.includes('tablet') || n.includes('dolo')) return '💊';
  if (n.includes('bandage') || n.includes('betadine')) return '🩹';
  return CAT_META[category?.toLowerCase()]?.emoji || '📦';
}

function productBg(category: string): string {
  return CAT_META[category?.toLowerCase()]?.color || '#F9FAFB';
}

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
            id:       p.id,
            name:     p.name,
            brand:    p.brand || '',
            price:    parseFloat(p.price || p.selling_price || '0'),
            category: (p.category || 'general').toLowerCase(),
            unit:     p.unit || '',
            in_stock: p.stock_status !== 'out_of_stock',
            stock_status: p.stock_status || 'in_stock',
          })));
        } else {
          setProducts([]);
        }
      } catch {
        setProducts([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [shop.id]);

  const getQty = (pid: string) => items.find(i => i.product_id === pid)?.quantity || 0;

  const rawCategories = Array.from(new Set(products.map(p => p.category)));
  const categories    = ['All', ...rawCategories];

  const visible = products.filter(p =>
    (activeTab === 'All' || p.category === activeTab) &&
    (!search || p.name.toLowerCase().includes(search.toLowerCase()) ||
                p.brand.toLowerCase().includes(search.toLowerCase()))
  );

  const grouped = visible.reduce((acc: any, p) => {
    const k = p.category; // always group by real category
    acc[k] = acc[k] ? [...acc[k], p] : [p];
    return acc;
  }, {});

  const deliveryFee  = total >= 200 ? 0 : 40;
  const deliveryTime = shop.eta || '15–20 min';
  const rating       = shop.rating || 4.5;
  const distance     = shop.distance || '—';

  return (
    <View style={s.root}>
      <StatusBar barStyle="dark-content" />

      {/* ── HEADER ── */}
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={20} color="#111" />
        </TouchableOpacity>

        {/* Search bar */}
        <View style={s.searchBox}>
          <Ionicons name="search-outline" size={15} color="#AAA" />
          <TextInput
            style={s.searchInput}
            placeholder={`Search in ${shop.name}…`}
            placeholderTextColor="#BBB"
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={16} color="#CCC" />
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity style={s.cartIconBtn} onPress={() => navigation.navigate('Cart')}>
          <Ionicons name="cart-outline" size={22} color="#111" />
          {itemCount > 0 && (
            <View style={s.cartDot}>
              <Text style={s.cartDotTxt}>{itemCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* ── SHOP INFO CARD ── */}
      <View style={s.shopCard}>
        {/* Shop banner / icon */}
        <LinearGradient colors={['#FFF4E6', '#FFE0B2']} style={s.shopBanner}>
          <Text style={s.shopBannerEmoji}>🏪</Text>
          <View style={[s.openBadge, { backgroundColor: shop.is_open ? '#DCFCE7' : '#FEE2E2' }]}>
            <View style={[s.openDot, { backgroundColor: shop.is_open ? '#22C55E' : '#EF4444' }]} />
            <Text style={[s.openTxt, { color: shop.is_open ? '#15803D' : '#B91C1C' }]}>
              {shop.is_open ? 'Open' : 'Closed'}
            </Text>
          </View>
        </LinearGradient>

        {/* Shop name & category */}
        <View style={s.shopInfo}>
          <Text style={s.shopName}>{shop.name}</Text>
          <Text style={s.shopCategory}>
            {(shop.category || 'grocery').charAt(0).toUpperCase() + (shop.category || 'grocery').slice(1)} · Local Store
          </Text>

          {/* Rating + stats row */}
          <View style={s.statsRow}>
            <View style={s.statChip}>
              <Ionicons name="star" size={13} color="#F59E0B" />
              <Text style={s.statTxt}>{rating}</Text>
            </View>
            <View style={s.statDivider} />
            <View style={s.statChip}>
              <Ionicons name="time-outline" size={13} color="#FF8A00" />
              <Text style={s.statTxt}>{deliveryTime}</Text>
            </View>
            <View style={s.statDivider} />
            <View style={s.statChip}>
              <Ionicons name="location-outline" size={13} color="#3B82F6" />
              <Text style={s.statTxt}>{distance}</Text>
            </View>
          </View>

          {/* Info pills */}
          <View style={s.pillRow}>
            <View style={s.pill}>
              <Ionicons name="bicycle-outline" size={12} color="#16A34A" />
              <Text style={s.pillTxt}>
                {deliveryFee === 0 ? 'Free delivery' : `₹${deliveryFee} delivery`}
              </Text>
            </View>
            <View style={[s.pill, { backgroundColor: '#EFF6FF' }]}>
              <Ionicons name="bag-outline" size={12} color="#1D4ED8" />
              <Text style={[s.pillTxt, { color: '#1D4ED8' }]}>Min ₹99</Text>
            </View>
            <View style={[s.pill, { backgroundColor: '#FDF4FF' }]}>
              <Ionicons name="shield-checkmark-outline" size={12} color="#7C3AED" />
              <Text style={[s.pillTxt, { color: '#7C3AED' }]}>100% Local</Text>
            </View>
          </View>

          {/* Address */}
          {shop.address && (
            <View style={s.addrRow}>
              <Ionicons name="location-sharp" size={13} color="#AAA" />
              <Text style={s.addrTxt} numberOfLines={1}>{shop.address}</Text>
            </View>
          )}
        </View>
      </View>

      {/* ── CATEGORY TABS ── */}
      <View style={s.tabBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.tabContent}>
          {categories.map(cat => {
            const meta = CAT_META[cat.toLowerCase()];
            return (
              <TouchableOpacity
                key={cat}
                style={[s.tab, activeTab === cat && s.tabActive]}
                onPress={() => setActiveTab(cat)}
              >
                {meta && <Text style={s.tabEmoji}>{meta.emoji}</Text>}
                <Text style={[s.tabTxt, activeTab === cat && s.tabTxtActive]}>
                  {cat === 'All' ? 'All' : cat.charAt(0).toUpperCase() + cat.slice(1).replace('_', ' ')}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* ── PRODUCT LIST ── */}
      {loading ? (
        <View style={s.center}>
          <ActivityIndicator size="large" color="#FF8A00" />
          <Text style={s.loadTxt}>Loading products…</Text>
        </View>
      ) : visible.length === 0 ? (
        <View style={s.empty}>
          <Text style={{ fontSize: 48 }}>🔍</Text>
          <Text style={s.emptyT}>{search ? 'No results found' : 'No products available'}</Text>
          <Text style={s.emptySub}>{search ? `Try searching something else` : 'Check back later'}</Text>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
          {Object.entries(grouped).map(([cat, prods]: any) => (
            <View key={cat}>
              {/* Category header */}
              <View style={s.catHeader}>
                <Text style={s.catEmoji}>{CAT_META[cat.toLowerCase()]?.emoji || '📦'}</Text>
                <Text style={s.catTitle}>
                  {cat === 'Products' ? 'Products' : cat.charAt(0).toUpperCase() + cat.slice(1).replace('_', ' ')}
                </Text>
                <Text style={s.catCount}>{prods.length} items</Text>
              </View>

              {prods.map((p: any) => {
                const qty   = getQty(p.id);
                const emoji = productEmoji(p.name, p.category);
                const bg    = productBg(p.category);
                return (
                  <TouchableOpacity
                    key={p.id}
                    style={[s.pCard, !p.in_stock && s.pCardFaded]}
                    activeOpacity={0.85}
                    onPress={() => navigation.navigate('ProductDetail', { product: { ...p, emoji }, shop })}
                  >
                    {/* Product image */}
                    <View style={[s.pImg, { backgroundColor: bg }]}>
                      <Text style={s.pEmoji}>{emoji}</Text>
                      {p.stock_status === 'low' && (
                        <View style={s.lowBadge}>
                          <Text style={s.lowTxt}>Low</Text>
                        </View>
                      )}
                    </View>

                    {/* Info */}
                    <View style={s.pInfo}>
                      <Text style={s.pName} numberOfLines={2}>{p.name}</Text>
                      {p.brand ? (
                        <Text style={s.pBrand}>{p.brand}</Text>
                      ) : null}
                      <Text style={s.pUnit}>{p.unit || '1 pc'}</Text>
                      <Text style={s.pPrice}>₹{p.price}</Text>
                    </View>

                    {/* Add / counter */}
                    <View style={s.pAction}>
                      {!p.in_stock ? (
                        <View style={s.outBtn}>
                          <Text style={s.outTxt}>Out of{'\n'}stock</Text>
                        </View>
                      ) : qty === 0 ? (
                        <TouchableOpacity
                          style={s.addBtn}
                          onPress={() => addItem(
                            { product_id: p.id, name: p.name, price: p.price, quantity: 1 },
                            shop.id, shop.name
                          )}
                        >
                          <Ionicons name="add" size={20} color="#FF8A00" />
                          <Text style={s.addTxt}>ADD</Text>
                        </TouchableOpacity>
                      ) : (
                        <View style={s.counter}>
                          <TouchableOpacity style={s.cBtn} onPress={() => updateQty(p.id, qty - 1)}>
                            <Ionicons name={qty === 1 ? 'trash-outline' : 'remove'} size={15} color="#fff" />
                          </TouchableOpacity>
                          <Text style={s.cNum}>{qty}</Text>
                          <TouchableOpacity style={s.cBtn}
                            onPress={() => addItem(
                              { product_id: p.id, name: p.name, price: p.price, quantity: 1 },
                              shop.id, shop.name
                            )}
                          >
                            <Ionicons name="add" size={15} color="#fff" />
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}
        </ScrollView>
      )}

      {/* ── VIEW CART BAR ── */}
      {itemCount > 0 && (
        <TouchableOpacity
          style={s.cartBar}
          onPress={() => navigation.navigate('Cart')}
          activeOpacity={0.9}
        >
          <LinearGradient colors={['#FF8A00', '#FF5C00']} style={s.cartGrad}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
            <View style={s.cartLeft}>
              <View style={s.cartBadge}>
                <Text style={s.cartBadgeTxt}>{itemCount}</Text>
              </View>
              <View>
                <Text style={s.cartLabel}>View Cart</Text>
                <Text style={s.cartSub}>{shop.name}</Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
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
  root:          { flex: 1, backgroundColor: '#F7F8FA' },

  // Header
  header:        { flexDirection: 'row', alignItems: 'center', gap: 10,
                    paddingTop: Platform.OS === 'ios' ? 56 : 36,
                    paddingBottom: 12, paddingHorizontal: 16,
                    backgroundColor: '#fff',
                    borderBottomWidth: 0.5, borderBottomColor: '#F0F0F0' },
  backBtn:       { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F5F5F5',
                    alignItems: 'center', justifyContent: 'center' },
  searchBox:     { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8,
                    backgroundColor: '#F5F5F5', borderRadius: 12,
                    paddingHorizontal: 12, height: 40 },
  searchInput:   { flex: 1, fontSize: 14, color: '#111' },
  cartIconBtn:   { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  cartDot:       { position: 'absolute', top: -2, right: -2, width: 16, height: 16,
                    borderRadius: 8, backgroundColor: '#FF8A00',
                    alignItems: 'center', justifyContent: 'center' },
  cartDotTxt:    { color: '#fff', fontSize: 9, fontWeight: '800' },

  // Shop info card
  shopCard:      { backgroundColor: '#fff', marginBottom: 2 },
  shopBanner:    { height: 110, alignItems: 'center', justifyContent: 'center' },
  shopBannerEmoji:{ fontSize: 52 },
  openBadge:     { position: 'absolute', top: 12, right: 12, flexDirection: 'row',
                    alignItems: 'center', gap: 5, borderRadius: 99,
                    paddingHorizontal: 10, paddingVertical: 5 },
  openDot:       { width: 7, height: 7, borderRadius: 3.5 },
  openTxt:       { fontSize: 12, fontWeight: '700' },
  shopInfo:      { padding: 16, paddingTop: 12 },
  shopName:      { fontSize: 20, fontWeight: '800', color: '#111', marginBottom: 3 },
  shopCategory:  { fontSize: 13, color: '#888', marginBottom: 12 },

  statsRow:      { flexDirection: 'row', alignItems: 'center', marginBottom: 12,
                    backgroundColor: '#F9FAFB', borderRadius: 12, padding: 12 },
  statChip:      { flex: 1, flexDirection: 'row', alignItems: 'center',
                    justifyContent: 'center', gap: 5 },
  statTxt:       { fontSize: 13, fontWeight: '700', color: '#333' },
  statDivider:   { width: 1, height: 20, backgroundColor: '#E5E7EB' },

  pillRow:       { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 10 },
  pill:          { flexDirection: 'row', alignItems: 'center', gap: 5,
                    backgroundColor: '#DCFCE7', borderRadius: 99,
                    paddingHorizontal: 10, paddingVertical: 5 },
  pillTxt:       { fontSize: 11, fontWeight: '700', color: '#16A34A' },

  addrRow:       { flexDirection: 'row', alignItems: 'center', gap: 5 },
  addrTxt:       { fontSize: 12, color: '#999', flex: 1 },

  // Category tabs
  tabBar:        { backgroundColor: '#fff', borderBottomWidth: 0.5, borderBottomColor: '#ECECEC' },
  tabContent:    { paddingHorizontal: 12, paddingVertical: 8, gap: 6 },
  tab:           { flexDirection: 'row', alignItems: 'center', gap: 5,
                    paddingHorizontal: 14, paddingVertical: 8,
                    borderRadius: 99, backgroundColor: '#F2F3F5' },
  tabActive:     { backgroundColor: '#FF8A00' },
  tabEmoji:      { fontSize: 13 },
  tabTxt:        { fontSize: 13, fontWeight: '600', color: '#666' },
  tabTxtActive:  { color: '#fff' },

  // States
  center:        { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  loadTxt:       { fontSize: 14, color: '#888' },
  empty:         { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 40 },
  emptyT:        { fontSize: 17, fontWeight: '700', color: '#333' },
  emptySub:      { fontSize: 13, color: '#999', textAlign: 'center' },

  // Category section header
  catHeader:     { flexDirection: 'row', alignItems: 'center', gap: 8,
                    paddingHorizontal: 16, paddingTop: 20, paddingBottom: 10 },
  catEmoji:      { fontSize: 18 },
  catTitle:      { fontSize: 16, fontWeight: '800', color: '#111', flex: 1 },
  catCount:      { fontSize: 12, color: '#AAA', fontWeight: '600' },

  // Product card (Blinkit-style list)
  pCard:         { backgroundColor: '#fff', marginHorizontal: 16, marginBottom: 10,
                    borderRadius: 16, padding: 14,
                    flexDirection: 'row', alignItems: 'center', gap: 14,
                    shadowColor: '#000', shadowOpacity: 0.04,
                    shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
  pCardFaded:    { opacity: 0.5 },
  pImg:          { width: 72, height: 72, borderRadius: 14,
                    alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  pEmoji:        { fontSize: 36 },
  lowBadge:      { position: 'absolute', bottom: 4, right: 4, backgroundColor: '#FEF3C7',
                    borderRadius: 4, paddingHorizontal: 4, paddingVertical: 1 },
  lowTxt:        { fontSize: 9, fontWeight: '800', color: '#D97706' },
  pInfo:         { flex: 1, gap: 2 },
  pName:         { fontSize: 14, fontWeight: '700', color: '#111', lineHeight: 19 },
  pBrand:        { fontSize: 11, color: '#FF8A00', fontWeight: '600' },
  pUnit:         { fontSize: 11, color: '#999' },
  pPrice:        { fontSize: 16, fontWeight: '800', color: '#111', marginTop: 4 },
  pAction:       { alignItems: 'center', flexShrink: 0 },

  outBtn:        { width: 72, borderRadius: 10, paddingVertical: 8,
                    backgroundColor: '#F5F5F5', alignItems: 'center' },
  outTxt:        { fontSize: 10, color: '#999', fontWeight: '600', textAlign: 'center', lineHeight: 15 },

  addBtn:        { width: 72, alignItems: 'center', borderRadius: 12,
                    paddingVertical: 8, borderWidth: 1.5, borderColor: '#FF8A00', gap: 1 },
  addTxt:        { fontSize: 11, fontWeight: '800', color: '#FF8A00', letterSpacing: 0.5 },

  counter:       { flexDirection: 'row', alignItems: 'center',
                    borderRadius: 12, overflow: 'hidden', backgroundColor: '#FF8A00', width: 96 },
  cBtn:          { width: 30, height: 36, alignItems: 'center', justifyContent: 'center' },
  cNum:          { flex: 1, color: '#fff', fontSize: 14, fontWeight: '800', textAlign: 'center' },

  // Cart bar
  cartBar:       { position: 'absolute', bottom: 20, left: 16, right: 16,
                    borderRadius: 18, overflow: 'hidden',
                    shadowColor: '#FF8A00', shadowOpacity: 0.45,
                    shadowRadius: 20, shadowOffset: { width: 0, height: 6 } },
  cartGrad:      { paddingHorizontal: 18, paddingVertical: 14,
                    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cartLeft:      { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cartBadge:     { width: 30, height: 30, borderRadius: 15,
                    backgroundColor: 'rgba(255,255,255,0.25)',
                    alignItems: 'center', justifyContent: 'center' },
  cartBadgeTxt:  { color: '#fff', fontSize: 13, fontWeight: '800' },
  cartLabel:     { color: '#fff', fontSize: 15, fontWeight: '700' },
  cartSub:       { color: 'rgba(255,255,255,0.7)', fontSize: 11 },
  cartTotal:     { color: '#fff', fontSize: 18, fontWeight: '800' },
});
