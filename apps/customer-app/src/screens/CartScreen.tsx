import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Platform, Alert, Animated, PanResponder,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useCart } from '../store/CartContext';
import { placeOrder, checkRiderAvailability, WS_URL, API_BASE } from '../services/api';

interface Deal {
  id: string; shop_id: string | null; title: string;
  deal_type: 'flat' | 'percent'; deal_value: number;
  min_order: number; max_discount?: number | null;
}
interface PlatformOffer {
  id: string; title: string; offer_type: string;
  value: number; min_order: number; max_discount?: number | null;
}

const isPercent = (t: string) => t === 'percent' || t === 'percent_off';

function calcOfferDiscount(subtotal: number, offerType: string, value: number, maxDiscount?: number | null) {
  let disc = isPercent(offerType) ? (subtotal * value) / 100 : value;
  if (maxDiscount) disc = Math.min(disc, maxDiscount);
  return Math.min(Math.round(disc * 100) / 100, subtotal);
}

function calcDiscount(subtotal: number, shopDeals: Deal[], platformOffers: PlatformOffer[]) {
  let shopBest = 0; let shopLabel = '';
  for (const d of shopDeals) {
    if (subtotal < d.min_order) continue;
    const disc = calcOfferDiscount(subtotal, d.deal_type, d.deal_value, d.max_discount);
    if (disc > shopBest) { shopBest = disc; shopLabel = d.title; }
  }
  let platBest = 0; let platLabel = '';
  for (const o of platformOffers) {
    if (subtotal < (o.min_order || 0)) continue;
    const disc = calcOfferDiscount(subtotal, o.offer_type, o.value, o.max_discount);
    if (disc > platBest) { platBest = disc; platLabel = o.title; }
  }
  const total = shopBest + platBest;
  return { discount: total, shopDiscount: shopBest, platformDiscount: platBest,
           label: [shopLabel, platLabel].filter(Boolean).join(' + ') };
}

function nearlyUnlockedOffers(subtotal: number, platformOffers: PlatformOffer[]) {
  return platformOffers
    .filter(o => { const gap = (o.min_order || 0) - subtotal; return gap > 0 && gap <= 150; })
    .map(o => ({ ...o, gap: Math.ceil((o.min_order || 0) - subtotal),
      saving: calcOfferDiscount(o.min_order || 0, o.offer_type, o.value, o.max_discount) }))
    .sort((a, b) => a.gap - b.gap);
}

const DEFAULT_DELIVERY_ADDRESS = {
  line1: '123, 5th Cross', city: 'Bengaluru', pincode: '560102', lat: 12.9116, lng: 77.6389,
};

// Avatar palette — vivid gradient pairs
const AVATAR_GRADIENTS: [string, string][] = [
  ['#FF8A00', '#FF5C00'],
  ['#7C3AED', '#A855F7'],
  ['#059669', '#34D399'],
  ['#2563EB', '#60A5FA'],
  ['#DB2777', '#F472B6'],
  ['#D97706', '#FCD34D'],
];

// ─── Swipeable item row ────────────────────────────────────────────────────────
function SwipeableItemRow({
  item, shopId, isFirst, onUpdateQty, onRemove,
}: {
  item: { product_id: string; name: string; price: number; quantity: number };
  shopId: string; isFirst: boolean;
  onUpdateQty: (id: string, shopId: string, qty: number) => void;
  onRemove: () => void;
}) {
  const translateX = useRef(new Animated.Value(0)).current;

  const panResponder = useRef(PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) =>
      Math.abs(g.dx) > Math.abs(g.dy) && Math.abs(g.dx) > 8,
    onPanResponderMove: (_, g) => {
      if (g.dx < 0) translateX.setValue(Math.max(g.dx, -90));
    },
    onPanResponderRelease: (_, g) => {
      if (g.dx < -50) {
        Animated.spring(translateX, { toValue: -82, useNativeDriver: true }).start();
      } else {
        Animated.spring(translateX, { toValue: 0, useNativeDriver: true, bounciness: 10 }).start();
      }
    },
  })).current;

  const close = () =>
    Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start();

  const gradIdx = item.name.charCodeAt(0) % AVATAR_GRADIENTS.length;
  const [gradStart, gradEnd] = AVATAR_GRADIENTS[gradIdx];
  const initial = item.name.charAt(0).toUpperCase();

  return (
    <View style={sw.wrapper}>
      {/* Red delete zone */}
      <TouchableOpacity style={sw.deleteZone} onPress={() => { close(); onRemove(); }}>
        <LinearGradient colors={['#EF4444', '#DC2626']} style={sw.deleteGrad}>
          <Ionicons name="trash-outline" size={20} color="#fff" />
          <Text style={sw.deleteTxt}>Remove</Text>
        </LinearGradient>
      </TouchableOpacity>

      <Animated.View style={[sw.row, { transform: [{ translateX }] }]} {...panResponder.panHandlers}>
        {/* Gradient avatar */}
        <LinearGradient colors={[gradStart, gradEnd]} style={sw.avatar} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
          <Text style={sw.avatarTxt}>{initial}</Text>
        </LinearGradient>

        <View style={{ flex: 1 }}>
          <Text style={sw.name} numberOfLines={2}>{item.name}</Text>
          <Text style={sw.priceEach}>₹{item.price} per unit</Text>
          {isFirst && <Text style={sw.swipeHint}>← swipe left to remove</Text>}
        </View>

        <View style={sw.rightCol}>
          <Text style={sw.lineTotal}>₹{item.price * item.quantity}</Text>
          <View style={sw.stepper}>
            <TouchableOpacity style={sw.stepBtn}
              onPress={() => { close(); onUpdateQty(item.product_id, shopId, item.quantity - 1); }}>
              <Ionicons name={item.quantity === 1 ? 'trash-outline' : 'remove'} size={14} color="#FF6B00" />
            </TouchableOpacity>
            <Text style={sw.stepNum}>{item.quantity}</Text>
            <TouchableOpacity style={sw.stepBtn}
              onPress={() => { close(); onUpdateQty(item.product_id, shopId, item.quantity + 1); }}>
              <Ionicons name="add" size={14} color="#FF6B00" />
            </TouchableOpacity>
          </View>
        </View>
      </Animated.View>
    </View>
  );
}

const sw = StyleSheet.create({
  wrapper:    { position: 'relative', overflow: 'hidden', backgroundColor: '#fff' },
  deleteZone: { position: 'absolute', right: 0, top: 0, bottom: 0, width: 82 },
  deleteGrad: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4 },
  deleteTxt:  { color: '#fff', fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  row:        { flexDirection: 'row', alignItems: 'center', gap: 12,
                 paddingHorizontal: 16, paddingVertical: 14, backgroundColor: '#fff' },
  avatar:     { width: 48, height: 48, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  avatarTxt:  { fontSize: 21, fontWeight: '900', color: '#fff' },
  name:       { fontSize: 14, fontWeight: '700', color: '#111', marginBottom: 3, lineHeight: 19 },
  priceEach:  { fontSize: 12, color: '#9CA3AF' },
  swipeHint:  { fontSize: 10, color: '#D1D5DB', marginTop: 3 },
  rightCol:   { alignItems: 'flex-end', gap: 8 },
  lineTotal:  { fontSize: 16, fontWeight: '900', color: '#111' },
  stepper:    { flexDirection: 'row', alignItems: 'center',
                 borderWidth: 1.5, borderColor: '#FF6B00', borderRadius: 10, overflow: 'hidden' },
  stepBtn:    { width: 30, height: 30, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFF4E6' },
  stepNum:    { minWidth: 28, textAlign: 'center', fontSize: 13, fontWeight: '900', color: '#FF6B00' },
});

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function CartScreen({ navigation }: any) {
  const { shops, grandTotal, itemCount, updateQty, removeItem, clearCart, clearShop } = useCart();
  const shopBuckets = Object.values(shops);
  const firstShop = shopBuckets[0] ?? null;

  const [loading, setLoading]                 = useState(false);
  const [tip, setTip]                         = useState(0);
  const [deliveryAddress, setDeliveryAddress] = useState(DEFAULT_DELIVERY_ADDRESS);
  const [ridersAvailable, setRidersAvailable] = useState<boolean | null>(null);
  const [availChecking, setAvailChecking]     = useState(false);
  const [shopDeals, setShopDeals]             = useState<Deal[]>([]);
  const [platformOffers, setPlatformOffers]   = useState<PlatformOffer[]>([]);

  const checkAvailability = useCallback(async () => {
    if (!firstShop) return;
    setAvailChecking(true);
    try {
      const res = await checkRiderAvailability(firstShop.shopId);
      setRidersAvailable(res.data?.available ?? true);
    } catch { setRidersAvailable(true); }
    finally { setAvailChecking(false); }
  }, [firstShop?.shopId]);

  useEffect(() => {
    if (!firstShop) return;
    checkAvailability();
    let ws: WebSocket | null = null, reconnectTimer: any = null, destroyed = false;
    const connect = () => {
      if (destroyed) return;
      ws = new WebSocket(WS_URL);
      ws.onmessage = (e) => {
        try { const ev = JSON.parse(e.data); if (ev.type === 'rider_online' || ev.type === 'rider_offline') checkAvailability(); } catch {}
      };
      ws.onclose = () => { if (!destroyed) reconnectTimer = setTimeout(connect, 3000); };
      ws.onerror = () => ws?.close();
    };
    connect();
    const fallback = setInterval(checkAvailability, 60000);
    return () => { destroyed = true; if (reconnectTimer) clearTimeout(reconnectTimer); ws?.close(); clearInterval(fallback); };
  }, [firstShop?.shopId, checkAvailability]);

  useEffect(() => {
    if (shopBuckets.length === 0) return;
    Promise.allSettled(shopBuckets.map(b => fetch(`${API_BASE}/shops/${b.shopId}/deals`).then(r => r.json())))
      .then(results => setShopDeals(results.filter(r => r.status === 'fulfilled').flatMap(r => (r as any).value.deals ?? [])));
    fetch(`${API_BASE}/platform-offers`).then(r => r.json()).then(d => setPlatformOffers(d.offers ?? [])).catch(() => {});
  }, [shopBuckets.map(b => b.shopId).join(',')]);

  // Matches backend: <₹150=₹49, ₹150–₹399=₹25, ₹400+=free
  const deliveryFee = grandTotal >= 400 ? 0 : grandTotal >= 150 ? 25 : 49;
  const { discount, shopDiscount, platformDiscount, label: discountLabel } =
    shopBuckets.length > 0 ? calcDiscount(grandTotal, shopDeals, platformOffers)
    : { discount: 0, shopDiscount: 0, platformDiscount: 0, label: '' };
  const orderTotal = Math.max(0, grandTotal + deliveryFee + tip - discount);
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  const handleOpenAddressPicker = () =>
    navigation.navigate('Addresses', {
      pickerMode: true,
      onPick: (addr: any) => setDeliveryAddress({
        line1: addr.full_address || addr.line1 || '', city: addr.city || 'Bengaluru',
        pincode: addr.pincode || '560000',
        lat: parseFloat(addr.lat) || DEFAULT_DELIVERY_ADDRESS.lat,
        lng: parseFloat(addr.lng) || DEFAULT_DELIVERY_ADDRESS.lng,
      }),
    });

  const handlePlaceOrder = async () => {
    if (!firstShop || ridersAvailable === false) return;
    const bad = shopBuckets.flatMap(b => b.items).filter(i => !UUID_RE.test(i.product_id));
    if (bad.length > 0) {
      Alert.alert('Stale Cart', `${bad.map(i => i.name).join(', ')} can't be ordered. Clear your cart.`,
        [{ text: 'Clear', style: 'destructive', onPress: clearCart }, { text: 'Cancel', style: 'cancel' }]);
      return;
    }
    setLoading(true);
    let lastOrderId: string | null = null;
    try {
      for (const bucket of shopBuckets) {
        const res = await placeOrder({ shop_id: bucket.shopId,
          items: bucket.items.map(i => ({ shop_product_id: i.product_id, quantity: i.quantity })),
          delivery_address: deliveryAddress });
        const id = res.data?.order?.id || res.data?.order_id || res.data?.id;
        if (id) lastOrderId = id;
      }
      clearCart();
      navigation.reset({ index: 0, routes: [{ name: 'OrdersTab', state: {
        routes: [{ name: 'OrdersList' }, ...(lastOrderId ? [{ name: 'OrderTracking', params: { orderId: lastOrderId, status: 'pending' } }] : [])],
        index: lastOrderId ? 1 : 0,
      }}]});
    } catch (err: any) {
      Alert.alert('Order Failed', err?.response?.data?.error || err?.message || 'Could not place order.');
    } finally { setLoading(false); }
  };

  // ── Empty state ──────────────────────────────────────────────────────────
  if (shopBuckets.length === 0) {
    return (
      <LinearGradient colors={['#FFF5F0', '#F0F4FF']} style={s.root}>
        <LinearGradient colors={['#FF8A00', '#FF5C00']} style={s.header}>
          <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
          <Text style={s.headerTitle}>Your Cart</Text>
          <View style={{ width: 36 }} />
        </LinearGradient>
        <View style={s.empty}>
          <LinearGradient colors={['#FFF4E6', '#FFF0F0']} style={s.emptyCircle}>
            <Text style={{ fontSize: 52 }}>🛒</Text>
          </LinearGradient>
          <Text style={s.emptyT}>Your cart is empty</Text>
          <Text style={s.emptySub}>Add items from a nearby shop to get started</Text>
          <TouchableOpacity onPress={() => navigation.navigate('HomeTab')}>
            <LinearGradient colors={['#FF8A00', '#FF5C00']} style={s.browseBtn} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
              <Text style={s.browseBtnTxt}>Browse Shops</Text>
              <Ionicons name="arrow-forward" size={16} color="#fff" />
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    );
  }

  const shopLabel = discountLabel.split(' + ');
  const nearlyUnlocked = nearlyUnlockedOffers(grandTotal, platformOffers).filter(o => o.saving > discount);

  return (
    <LinearGradient colors={['#FFF5EE', '#F0F4FF', '#F5FFF5']} style={s.root}
      start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>

      {/* ── Header ── */}
      <LinearGradient colors={['#FF8A00', '#FF5C00']} style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.headerTitle}>Your Cart</Text>
          <Text style={s.headerSub}>
            {itemCount} item{itemCount !== 1 ? 's' : ''}
            {shopBuckets.length > 1 ? ` · ${shopBuckets.length} shops` : ` · ${firstShop?.shopName ?? ''}`}
          </Text>
        </View>
        <TouchableOpacity style={s.clearBtn}
          onPress={() => Alert.alert('Clear Cart', 'Remove all items?', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Clear', style: 'destructive', onPress: clearCart },
          ])}>
          <Ionicons name="trash-outline" size={15} color="#fff" />
          <Text style={s.clearTxt}>Clear</Text>
        </TouchableOpacity>
      </LinearGradient>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 130 }}>

        {/* ── Shop buckets ── */}
        {shopBuckets.map((bucket, bucketIdx) => {
          const [accentA, accentB] = AVATAR_GRADIENTS[bucketIdx % AVATAR_GRADIENTS.length];
          return (
            <View key={bucket.shopId} style={s.shopSection}>
              {/* Gradient shop header */}
              <LinearGradient colors={[accentA + '18', accentB + '08']} style={s.shopHeader}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                <View style={[s.shopAccentBar, { backgroundColor: accentA }]} />
                <LinearGradient colors={[accentA, accentB]} style={s.shopIconWrap}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                  <Text style={{ fontSize: 18 }}>🏪</Text>
                </LinearGradient>
                <View style={{ flex: 1 }}>
                  <Text style={s.shopName}>{bucket.shopName}</Text>
                  <Text style={s.shopCount}>{bucket.items.length} item{bucket.items.length !== 1 ? 's' : ''}</Text>
                </View>
                <TouchableOpacity style={s.removeShopBtn}
                  onPress={() => Alert.alert('Remove shop?', `Remove all items from ${bucket.shopName}?`, [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Remove', style: 'destructive', onPress: () => clearShop(bucket.shopId) },
                  ])}>
                  <Text style={s.removeShopTxt}>Remove</Text>
                </TouchableOpacity>
              </LinearGradient>

              {/* Items */}
              <View style={s.itemsCard}>
                {bucket.items.map((item, idx) => (
                  <View key={item.product_id}>
                    <SwipeableItemRow item={item} shopId={bucket.shopId} isFirst={idx === 0}
                      onUpdateQty={updateQty} onRemove={() => removeItem(item.product_id, bucket.shopId)} />
                    {idx < bucket.items.length - 1 && <View style={s.itemDivider} />}
                  </View>
                ))}
              </View>
            </View>
          );
        })}

        {/* ── Delivery address ── */}
        <View style={s.sectionCard}>
          <LinearGradient colors={['#EFF6FF', '#F0FDF4']} style={s.sectionCardHeader}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
            <View style={s.addrIconWrap}>
              <Ionicons name="location-sharp" size={17} color="#2563EB" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[s.sectionLabel, { color: '#2563EB' }]}>DELIVERING TO</Text>
              <Text style={s.addrText} numberOfLines={2}>
                {deliveryAddress.line1}, {deliveryAddress.city} – {deliveryAddress.pincode}
              </Text>
            </View>
            <TouchableOpacity style={s.changeBtn} onPress={handleOpenAddressPicker}>
              <Text style={s.changeTxt}>Change</Text>
            </TouchableOpacity>
          </LinearGradient>
          <TouchableOpacity style={s.savedAddrRow} onPress={handleOpenAddressPicker}>
            <Ionicons name="bookmark" size={13} color="#2563EB" />
            <Text style={[s.savedAddrTxt, { color: '#2563EB' }]}>Use a saved address</Text>
            <Ionicons name="chevron-forward" size={13} color="#2563EB" />
          </TouchableOpacity>
        </View>

        {/* ── Tip ── */}
        <View style={s.sectionCard}>
          <LinearGradient colors={['#FFF5F0', '#FFF0F5']} style={s.tipCardHeader}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
            <Text style={s.tipTitle}>🙏  Tip your delivery partner</Text>
            <Text style={s.tipSub}>100% goes to them</Text>
          </LinearGradient>
          <View style={s.tipOptions}>
            {[0, 10, 20, 30].map((t, i) => {
              const tipColors: [string,string][] = [['#9CA3AF','#6B7280'],['#F59E0B','#D97706'],['#10B981','#059669'],['#6366F1','#4F46E5']];
              const isActive = tip === t;
              return (
                <TouchableOpacity key={t} onPress={() => setTip(t)} style={{ flex: 1 }}>
                  {isActive ? (
                    <LinearGradient colors={tipColors[i]} style={s.tipChipActive}
                      start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                      <Text style={s.tipChipTxtActive}>{t === 0 ? 'None' : `₹${t}`}</Text>
                    </LinearGradient>
                  ) : (
                    <View style={s.tipChip}>
                      <Text style={s.tipChipTxt}>{t === 0 ? 'None' : `₹${t}`}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* ── Savings card ── */}
        {discount > 0 && (
          <View style={s.savingsCard}>
            {shopDiscount > 0 && platformDiscount > 0 ? (
              <>
                <LinearGradient colors={['#064E3B', '#065F46']} style={s.savingsTop}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                  <View style={s.savingsIconWrap}>
                    <Text style={{ fontSize: 22 }}>🎉</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.savingsTitle, { color: '#fff' }]}>2 deals stacked!</Text>
                    <Text style={[s.savingsSub, { color: '#6EE7B7' }]}>Both applied at checkout</Text>
                  </View>
                  <View style={s.savingsBadge}>
                    <Text style={s.savingsBadgeLbl}>TOTAL SAVINGS</Text>
                    <Text style={s.savingsBadgeAmt}>₹{discount} off</Text>
                  </View>
                </LinearGradient>
                <View style={s.savingsDivider} />
                <View style={s.savingsRow}>
                  <LinearGradient colors={['#059669', '#34D399']} style={s.savingsDotGrad} />
                  <View style={{ flex: 1 }}>
                    <Text style={s.savingsRowName}>{shopLabel[0]}</Text>
                    <Text style={s.savingsRowType}>Shop deal</Text>
                  </View>
                  <Text style={s.savingsRowAmt}>-₹{shopDiscount}</Text>
                </View>
                <View style={s.savingsRow}>
                  <LinearGradient colors={['#2563EB', '#60A5FA']} style={s.savingsDotGrad} />
                  <View style={{ flex: 1 }}>
                    <Text style={s.savingsRowName}>{shopLabel[1]}</Text>
                    <Text style={s.savingsRowType}>Platform offer</Text>
                  </View>
                  <Text style={s.savingsRowAmt}>-₹{platformDiscount}</Text>
                </View>
              </>
            ) : (
              <LinearGradient
                colors={shopDiscount > 0 ? ['#064E3B', '#065F46'] : ['#1E3A5F', '#2563EB']}
                style={s.savingsTop} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                <View style={s.savingsIconWrap}>
                  <Ionicons name="pricetag" size={20} color="#fff" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.savingsTitle, { color: '#fff' }]}>{discountLabel}</Text>
                  <Text style={[s.savingsSub, { color: 'rgba(255,255,255,0.7)' }]}>
                    {shopDiscount > 0 ? 'Shop deal' : 'Platform offer'} · applied at checkout
                  </Text>
                </View>
                <View style={s.savingsBadge}>
                  <Text style={s.savingsBadgeLbl}>YOU SAVE</Text>
                  <Text style={s.savingsBadgeAmt}>₹{discount} off</Text>
                </View>
              </LinearGradient>
            )}
          </View>
        )}

        {/* ── Nearly unlocked upsell ── */}
        {nearlyUnlocked.map(offer => (
          <LinearGradient key={offer.id} colors={['#FFFBEB', '#FEF9C3']} style={s.upsellCard}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
            <View style={s.upsellLeft}>
              <Text style={{ fontSize: 22 }}>🔓</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.upsellTitle}>
                Add <Text style={{ fontWeight: '900', color: '#B45309' }}>₹{offer.gap}</Text> more to unlock{' '}
                <Text style={{ fontWeight: '900', color: '#B45309' }}>₹{offer.saving} off</Text>
              </Text>
              <Text style={s.upsellSub}>{offer.title}</Text>
            </View>
            <LinearGradient colors={['#F59E0B', '#D97706']} style={s.upsellBadge}>
              <Text style={s.upsellBadgeTxt}>₹{offer.saving} off</Text>
            </LinearGradient>
          </LinearGradient>
        ))}

        {/* ── Bill Details ── */}
        <View style={s.billCard}>
          <LinearGradient colors={['#FFF5EE', '#FFFBF5']} style={s.billHeader}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
            <Ionicons name="receipt-outline" size={16} color="#FF6B00" />
            <Text style={s.billTitle}>Bill Details</Text>
          </LinearGradient>

          <View style={s.billBody}>
            <View style={s.billRow}>
              <Text style={s.billLbl}>Item total</Text>
              <Text style={s.billVal}>₹{grandTotal}</Text>
            </View>
            <View style={s.billRow}>
              <View>
                <Text style={s.billLbl}>Delivery fee</Text>
                {deliveryFee > 0 && (
                  <Text style={s.billHint}>
                    {grandTotal >= 150 ? `Add ₹${400 - grandTotal} more for free delivery` : `Add ₹${150 - grandTotal} more to cut fee to ₹25`}
                  </Text>
                )}
              </View>
              {deliveryFee === 0
                ? <LinearGradient colors={['#059669', '#34D399']} style={s.freePill}>
                    <Text style={s.freeTxt}>FREE</Text>
                  </LinearGradient>
                : <Text style={s.billVal}>₹{deliveryFee}</Text>}
            </View>
            {tip > 0 && (
              <View style={s.billRow}>
                <Text style={s.billLbl}>Delivery tip 🙏</Text>
                <Text style={s.billVal}>₹{tip}</Text>
              </View>
            )}
            {discount > 0 && (
              <View style={s.discountBlock}>
                <View style={s.discountBlockTop}>
                  <Text style={s.discountBlockLbl}>🎁 Savings</Text>
                  <Text style={s.discountBlockAmt}>-₹{discount}</Text>
                </View>
                {shopDiscount > 0 && (
                  <View style={s.discountSubRow}>
                    <View style={[s.discountDot, { backgroundColor: '#059669' }]} />
                    <Text style={s.discountSubName}>{shopLabel[0]}</Text>
                    <Text style={[s.discountSubAmt, { color: '#059669' }]}>-₹{shopDiscount}</Text>
                  </View>
                )}
                {platformDiscount > 0 && (
                  <View style={s.discountSubRow}>
                    <View style={[s.discountDot, { backgroundColor: '#2563EB' }]} />
                    <Text style={s.discountSubName}>{shopDiscount > 0 ? shopLabel[1] : discountLabel}</Text>
                    <Text style={[s.discountSubAmt, { color: '#2563EB' }]}>-₹{platformDiscount}</Text>
                  </View>
                )}
              </View>
            )}
          </View>

          {/* Grand total strip */}
          <LinearGradient colors={['#FF8A00', '#FF5C00']} style={s.grandTotalStrip}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
            <Text style={s.grandTotalLbl}>Grand Total</Text>
            <Text style={s.grandTotalAmt}>₹{orderTotal}</Text>
          </LinearGradient>

          {discount > 0 && (
            <LinearGradient colors={['#F0FDF4', '#DCFCE7']} style={s.youSaveRow}>
              <Ionicons name="checkmark-circle" size={16} color="#059669" />
              <Text style={s.youSaveTxt}>You're saving ₹{discount} on this order 🎉</Text>
            </LinearGradient>
          )}
        </View>

        {/* ── Security note ── */}
        <View style={s.secureRow}>
          <Ionicons name="shield-checkmark" size={15} color="#059669" />
          <Text style={s.secureTxt}>100% secure payments · Cash on delivery</Text>
        </View>

      </ScrollView>

      {/* ── No riders banner ── */}
      {ridersAvailable === false && (
        <LinearGradient colors={['#FFF4E6', '#FFF0E0']} style={s.noRiderBanner}>
          <Text style={{ fontSize: 24 }}>🛵</Text>
          <View style={{ flex: 1 }}>
            <Text style={s.noRiderTitle}>No riders available right now</Text>
            <Text style={s.noRiderSub}>Unlocks automatically when a rider is online</Text>
          </View>
          <TouchableOpacity style={s.retryBtn} onPress={checkAvailability} disabled={availChecking}>
            {availChecking
              ? <ActivityIndicator size="small" color="#FF6B00" />
              : <Text style={s.retryTxt}>Retry</Text>}
          </TouchableOpacity>
        </LinearGradient>
      )}

      {/* ── Footer ── */}
      <View style={s.footer}>
        <View style={s.footerLeft}>
          <Text style={s.footerLbl}>To Pay</Text>
          <Text style={s.footerAmt}>₹{orderTotal}</Text>
          {discount > 0 && (
            <Text style={s.footerSaving}>saving ₹{discount}</Text>
          )}
        </View>
        <TouchableOpacity onPress={handlePlaceOrder}
          disabled={loading || ridersAvailable === false || availChecking}
          style={{ flex: 1 }} activeOpacity={0.88}>
          <LinearGradient
            colors={ridersAvailable === false ? ['#D1D5DB', '#9CA3AF'] : ['#FF8A00', '#FF4500']}
            style={s.placeBtn} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
            {loading ? <ActivityIndicator color="#fff" /> :
             availChecking ? <><ActivityIndicator color="#fff" size="small" /><Text style={s.placeBtnTxt}>Checking…</Text></> :
             ridersAvailable === false ? <Text style={s.placeBtnTxt}>No Riders Available</Text> :
             <>
               <Text style={s.placeBtnTxt}>
                 {shopBuckets.length > 1 ? `Place ${shopBuckets.length} Orders` : 'Place Order'}
               </Text>
               <Ionicons name="arrow-forward" size={18} color="#fff" />
             </>}
          </LinearGradient>
        </TouchableOpacity>
      </View>

    </LinearGradient>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root:   { flex: 1 },

  // Header
  header:      { paddingTop: Platform.OS === 'ios' ? 56 : 36, paddingBottom: 16,
                  paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', gap: 12 },
  backBtn:     { width: 36, height: 36, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.22)',
                  alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 19, fontWeight: '900', color: '#fff' },
  headerSub:   { fontSize: 12, color: 'rgba(255,255,255,0.75)', marginTop: 1 },
  clearBtn:    { flexDirection: 'row', alignItems: 'center', gap: 5,
                  backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 10,
                  paddingHorizontal: 12, paddingVertical: 7 },
  clearTxt:    { color: '#fff', fontSize: 12, fontWeight: '700' },

  // Empty
  empty:       { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, padding: 32 },
  emptyCircle: { width: 120, height: 120, borderRadius: 60, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  emptyT:      { fontSize: 21, fontWeight: '900', color: '#111' },
  emptySub:    { fontSize: 14, color: '#888', textAlign: 'center', lineHeight: 20 },
  browseBtn:   { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8,
                  paddingHorizontal: 36, paddingVertical: 15, borderRadius: 18 },
  browseBtnTxt:{ color: '#fff', fontSize: 15, fontWeight: '800' },

  // Shop section
  shopSection:    { marginTop: 16, marginHorizontal: 16 },
  shopHeader:     { flexDirection: 'row', alignItems: 'center', gap: 10,
                     borderTopLeftRadius: 18, borderTopRightRadius: 18,
                     paddingHorizontal: 14, paddingVertical: 13,
                     borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.05)' },
  shopAccentBar:  { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4,
                     borderTopLeftRadius: 18 },
  shopIconWrap:   { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  shopName:       { fontSize: 14, fontWeight: '800', color: '#111' },
  shopCount:      { fontSize: 11, color: '#6B7280', marginTop: 1 },
  removeShopBtn:  { paddingHorizontal: 11, paddingVertical: 5, borderRadius: 8,
                     backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA' },
  removeShopTxt:  { fontSize: 12, fontWeight: '700', color: '#EF4444' },
  itemsCard:      { backgroundColor: '#fff', borderBottomLeftRadius: 18, borderBottomRightRadius: 18,
                     overflow: 'hidden', marginBottom: 4,
                     shadowColor: '#000', shadowOpacity: 0.07, shadowRadius: 10, shadowOffset: { width:0,height:3 } },
  itemDivider:    { height: 1, backgroundColor: '#F4F4F8', marginHorizontal: 16 },

  // Section card (address, tip)
  sectionCard:    { backgroundColor: '#fff', marginHorizontal: 16, marginTop: 12, borderRadius: 18,
                     overflow: 'hidden',
                     shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width:0,height:2 } },
  sectionCardHeader:{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  sectionLabel:   { fontSize: 10, fontWeight: '800', letterSpacing: 0.8, marginBottom: 3 },
  addrIconWrap:   { width: 38, height: 38, borderRadius: 11, backgroundColor: '#EFF6FF',
                     alignItems: 'center', justifyContent: 'center' },
  addrText:       { fontSize: 13, color: '#111', fontWeight: '500', lineHeight: 18 },
  changeBtn:      { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, backgroundColor: '#EFF6FF' },
  changeTxt:      { fontSize: 12, color: '#2563EB', fontWeight: '700' },
  savedAddrRow:   { flexDirection: 'row', alignItems: 'center', gap: 6,
                     borderTopWidth: 1, borderTopColor: '#F4F4F8',
                     paddingHorizontal: 14, paddingVertical: 10 },
  savedAddrTxt:   { flex: 1, fontSize: 12, fontWeight: '600' },

  // Tip
  tipCardHeader:  { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 12 },
  tipTitle:       { fontSize: 14, fontWeight: '700', color: '#111', marginBottom: 2 },
  tipSub:         { fontSize: 11, color: '#9CA3AF' },
  tipOptions:     { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingBottom: 14 },
  tipChip:        { paddingVertical: 10, borderRadius: 12, borderWidth: 1.5,
                     borderColor: '#E5E7EB', alignItems: 'center', backgroundColor: '#FAFAFA' },
  tipChipActive:  { paddingVertical: 10, borderRadius: 12, alignItems: 'center' },
  tipChipTxt:     { fontSize: 13, fontWeight: '700', color: '#6B7280' },
  tipChipTxtActive:{ fontSize: 13, fontWeight: '800', color: '#fff' },

  // Savings
  savingsCard:      { marginHorizontal: 16, marginTop: 12, borderRadius: 18, overflow: 'hidden',
                       shadowColor: '#059669', shadowOpacity: 0.15, shadowRadius: 12, shadowOffset: { width:0,height:4 } },
  savingsTop:       { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 },
  savingsIconWrap:  { width: 44, height: 44, borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.15)',
                       alignItems: 'center', justifyContent: 'center' },
  savingsTitle:     { fontSize: 15, fontWeight: '900', marginBottom: 2 },
  savingsSub:       { fontSize: 11 },
  savingsBadge:     { alignItems: 'flex-end', backgroundColor: 'rgba(255,255,255,0.15)',
                       borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8 },
  savingsBadgeLbl:  { fontSize: 8, fontWeight: '900', color: 'rgba(255,255,255,0.8)', letterSpacing: 1,
                       textTransform: 'uppercase' },
  savingsBadgeAmt:  { fontSize: 17, fontWeight: '900', color: '#fff', marginTop: 1 },
  savingsDivider:   { height: 1, backgroundColor: 'rgba(0,0,0,0.06)' },
  savingsRow:       { flexDirection: 'row', alignItems: 'center', gap: 12,
                       paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#fff' },
  savingsDotGrad:   { width: 10, height: 10, borderRadius: 5 },
  savingsRowName:   { fontSize: 13, fontWeight: '700', color: '#111' },
  savingsRowType:   { fontSize: 11, color: '#9CA3AF', marginTop: 1 },
  savingsRowAmt:    { fontSize: 14, fontWeight: '900', color: '#059669' },

  // Upsell
  upsellCard:    { flexDirection: 'row', alignItems: 'center', gap: 12,
                    marginHorizontal: 16, marginTop: 10, borderRadius: 16, padding: 14,
                    borderWidth: 1.5, borderColor: '#FDE68A' },
  upsellLeft:    { width: 42, height: 42, borderRadius: 12, backgroundColor: '#FEF3C7',
                    alignItems: 'center', justifyContent: 'center' },
  upsellTitle:   { fontSize: 13, color: '#78350F', lineHeight: 18 },
  upsellSub:     { fontSize: 11, color: '#B45309', marginTop: 2 },
  upsellBadge:   { borderRadius: 10, paddingHorizontal: 11, paddingVertical: 7 },
  upsellBadgeTxt:{ fontSize: 12, fontWeight: '900', color: '#fff' },

  // Bill
  billCard:          { backgroundColor: '#fff', marginHorizontal: 16, marginTop: 12, borderRadius: 18,
                        overflow: 'hidden',
                        shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width:0,height:3 } },
  billHeader:        { flexDirection: 'row', alignItems: 'center', gap: 8,
                        paddingHorizontal: 16, paddingVertical: 14,
                        borderBottomWidth: 1, borderBottomColor: '#FEE2D0' },
  billTitle:         { fontSize: 15, fontWeight: '900', color: '#FF6B00' },
  billBody:          { padding: 16 },
  billRow:           { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 },
  billLbl:           { fontSize: 14, color: '#6B7280' },
  billHint:          { fontSize: 11, color: '#FF6B00', marginTop: 3 },
  billVal:           { fontSize: 14, color: '#111', fontWeight: '600' },
  freePill:          { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  freeTxt:           { fontSize: 11, fontWeight: '900', color: '#fff' },
  discountBlock:     { backgroundColor: '#F0FDF4', borderRadius: 12, padding: 12, marginBottom: 14,
                        borderWidth: 1, borderColor: '#BBF7D0' },
  discountBlockTop:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  discountBlockLbl:  { fontSize: 13, fontWeight: '800', color: '#059669' },
  discountBlockAmt:  { fontSize: 15, fontWeight: '900', color: '#059669' },
  discountSubRow:    { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 5 },
  discountDot:       { width: 7, height: 7, borderRadius: 4 },
  discountSubName:   { flex: 1, fontSize: 12, color: '#374151' },
  discountSubAmt:    { fontSize: 12, fontWeight: '800' },
  grandTotalStrip:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
                        paddingHorizontal: 18, paddingVertical: 16 },
  grandTotalLbl:     { fontSize: 16, fontWeight: '800', color: '#fff' },
  grandTotalAmt:     { fontSize: 24, fontWeight: '900', color: '#fff' },
  youSaveRow:        { flexDirection: 'row', alignItems: 'center', gap: 8,
                        paddingHorizontal: 16, paddingVertical: 12 },
  youSaveTxt:        { fontSize: 13, color: '#059669', fontWeight: '700', flex: 1 },

  // Security
  secureRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                gap: 6, marginTop: 14, marginBottom: 4 },
  secureTxt: { fontSize: 12, color: '#059669', fontWeight: '600' },

  // No riders
  noRiderBanner: { flexDirection: 'row', alignItems: 'center', gap: 12,
                    borderTopWidth: 1, borderTopColor: '#FFE0B2', paddingHorizontal: 16, paddingVertical: 13 },
  noRiderTitle:  { fontSize: 13, fontWeight: '800', color: '#C05600', marginBottom: 2 },
  noRiderSub:    { fontSize: 11, color: '#E07020', lineHeight: 15 },
  retryBtn:      { paddingHorizontal: 14, paddingVertical: 8, backgroundColor: '#fff',
                    borderRadius: 10, borderWidth: 1.5, borderColor: '#FF6B00',
                    minWidth: 56, alignItems: 'center', justifyContent: 'center' },
  retryTxt:      { fontSize: 13, fontWeight: '700', color: '#FF6B00' },

  // Footer
  footer:      { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16,
                  paddingVertical: 12, paddingBottom: Platform.OS === 'ios' ? 30 : 14,
                  backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#F0F0F0',
                  shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 16, shadowOffset: { width:0,height:-6 } },
  footerLeft:  { minWidth: 90 },
  footerLbl:   { fontSize: 11, color: '#9CA3AF', fontWeight: '600', marginBottom: 1 },
  footerAmt:   { fontSize: 24, fontWeight: '900', color: '#111' },
  footerSaving:{ fontSize: 11, color: '#059669', fontWeight: '700', marginTop: 1 },
  placeBtn:    { height: 56, borderRadius: 18, flexDirection: 'row', alignItems: 'center',
                  justifyContent: 'center', gap: 8,
                  shadowColor: '#FF8A00', shadowOpacity: 0.45, shadowRadius: 14, shadowOffset: { width:0,height:5 } },
  placeBtnTxt: { color: '#fff', fontSize: 16, fontWeight: '900', letterSpacing: 0.3 },
});
