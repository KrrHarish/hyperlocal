import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Platform, Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useCart } from '../store/CartContext';
import { placeOrder, checkRiderAvailability, WS_URL } from '../services/api';

const DEFAULT_DELIVERY_ADDRESS = {
  line1:   '123, 5th Cross',
  city:    'Bengaluru',
  pincode: '560102',
  lat:     12.9116,
  lng:     77.6389,
};

export default function CartScreen({ navigation }: any) {
  const { items, shopId, shopName, updateQty, removeItem, clearCart, total, itemCount } = useCart();
  const [loading, setLoading]               = useState(false);
  const [tip, setTip]                       = useState(0);
  const [deliveryAddress, setDeliveryAddress] = useState(DEFAULT_DELIVERY_ADDRESS);
  const [ridersAvailable, setRidersAvailable] = useState<boolean | null>(null);
  const [availChecking, setAvailChecking]     = useState(false);

  // Check rider availability whenever shopId changes or screen mounts
  const checkAvailability = useCallback(async () => {
    if (!shopId) return;
    setAvailChecking(true);
    try {
      const res = await checkRiderAvailability(shopId);
      setRidersAvailable(res.data?.available ?? true);
    } catch {
      setRidersAvailable(true); // fail open — don't block on network error
    } finally {
      setAvailChecking(false);
    }
  }, [shopId]);

  // ── Real-time availability via WebSocket ──────────────────────────────────
  // When any rider goes online or offline the server broadcasts rider_online /
  // rider_offline. We re-check immediately so the button state is instant.
  // A 60s fallback poll covers the case where the socket is disconnected.
  useEffect(() => {
    if (!shopId) return;

    checkAvailability(); // immediate check on mount

    let ws: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let destroyed = false;

    const connect = () => {
      if (destroyed) return;
      ws = new WebSocket(WS_URL);
      ws.onmessage = (e) => {
        try {
          const event = JSON.parse(e.data);
          if (event.type === 'rider_online' || event.type === 'rider_offline') {
            checkAvailability(); // re-check instantly on any rider status change
          }
        } catch {}
      };
      ws.onclose = () => {
        if (!destroyed) reconnectTimer = setTimeout(connect, 3000);
      };
      ws.onerror = () => ws?.close();
    };

    connect();

    // Fallback poll every 60s — catches edge cases where WS message was missed
    const fallback = setInterval(checkAvailability, 60000);

    return () => {
      destroyed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      ws?.close();
      clearInterval(fallback);
    };
  }, [shopId, checkAvailability]);

  const deliveryFee = total >= 500 ? 0 : total >= 200 ? 25 : 40;
  const grandTotal  = total + deliveryFee + tip;

  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  const handleOpenAddressPicker = () => {
    navigation.navigate('Addresses', {
      pickerMode: true,
      onPick: (addr: any) => {
        // Parse saved address into delivery address shape
        setDeliveryAddress({
          line1:   addr.full_address || addr.line1 || '',
          city:    addr.city || 'Bengaluru',
          pincode: addr.pincode || '560000',
          lat:     parseFloat(addr.lat) || DEFAULT_DELIVERY_ADDRESS.lat,
          lng:     parseFloat(addr.lng) || DEFAULT_DELIVERY_ADDRESS.lng,
        });
      },
    });
  };

  const handlePlaceOrder = async () => {
    if (!shopId) return;

    // Hard block — no riders available
    if (ridersAvailable === false) return;

    // Guard: make sure all product IDs are real UUIDs (not leftover mock IDs like "g1", "g2")
    const badItems = items.filter(i => !UUID_RE.test(i.product_id));
    if (badItems.length > 0) {
      Alert.alert(
        'Stale Cart Items',
        `Some items (${badItems.map(i => i.name).join(', ')}) are from old demo data and can't be ordered. Please clear your cart and add fresh items from the shop.`,
        [
          { text: 'Clear Cart', style: 'destructive', onPress: clearCart },
          { text: 'Cancel', style: 'cancel' },
        ]
      );
      return;
    }

    setLoading(true);
    try {
      const res = await placeOrder({
        shop_id: shopId,
        items: items.map(i => ({ shop_product_id: i.product_id, quantity: i.quantity })),
        delivery_address: deliveryAddress,
      });
      const orderId = res.data?.order?.id || res.data?.order_id || res.data?.id;
      if (!orderId) throw new Error('No order ID returned from server');
      clearCart();
      // Navigate to Orders tab so tracking shows under the right tab
      navigation.reset({
        index: 0,
        routes: [{
          name: 'OrdersTab',
          state: {
            routes: [
              { name: 'OrdersList' },
              { name: 'OrderTracking', params: { orderId, status: 'pending' } },
            ],
            index: 1,
          },
        }],
      });
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.message || 'Could not place order. Please try again.';
      Alert.alert('Order Failed', msg);
    } finally {
      setLoading(false);
    }
  };

  const confirmClear = () => {
    Alert.alert('Clear Cart', 'Remove all items?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear', style: 'destructive', onPress: clearCart },
    ]);
  };

  if (items.length === 0) {
    return (
      <View style={s.root}>
        <LinearGradient colors={['#FF8A00','#FF5C00']} style={s.header}>
          <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
          <Text style={s.headerTitle}>Your Cart</Text>
          <View style={{ width: 36 }} />
        </LinearGradient>
        <View style={s.empty}>
          <View style={s.emptyCircle}>
            <Ionicons name="cart-outline" size={52} color="#FF8A00" />
          </View>
          <Text style={s.emptyT}>Your cart is empty</Text>
          <Text style={s.emptySub}>Add items from a nearby shop to get started</Text>
          <TouchableOpacity style={s.browseBtn} onPress={() => navigation.navigate('HomeTab')}>
            <LinearGradient colors={['#FF8A00','#FF5C00']} style={s.browseBtnGrad}
              start={{ x:0,y:0 }} end={{ x:1,y:0 }}>
              <Text style={s.browseBtnTxt}>Browse Shops</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={s.root}>
      {/* Header */}
      <LinearGradient colors={['#FF8A00','#FF5C00']} style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.headerTitle}>Your Cart</Text>
          <Text style={s.headerSub}>{itemCount} items · {shopName}</Text>
        </View>
        <TouchableOpacity style={s.clearBtn} onPress={confirmClear}>
          <Text style={s.clearTxt}>Clear</Text>
        </TouchableOpacity>
      </LinearGradient>

      <ScrollView showsVerticalScrollIndicator={false}>

        {/* Shop banner */}
        <View style={s.shopBanner}>
          <View style={s.shopBannerIcon}>
            <Text style={{ fontSize: 22 }}>🏪</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.shopBannerName}>{shopName}</Text>
            <Text style={s.shopBannerSub}>Items from this shop</Text>
          </View>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={s.addMoreTxt}>+ Add more</Text>
          </TouchableOpacity>
        </View>

        {/* Items */}
        <View style={s.itemsCard}>
          {items.map((item, idx) => (
            <View key={item.product_id}>
              <View style={s.itemRow}>
                <View style={s.itemLeft}>
                  <Text style={s.itemName}>{item.name}</Text>
                  <Text style={s.itemPricePer}>₹{item.price} each</Text>
                </View>
                <View style={s.itemRight}>
                  <View style={s.counter}>
                    <TouchableOpacity style={s.cBtn}
                      onPress={() => updateQty(item.product_id, item.quantity - 1)}>
                      <Ionicons name={item.quantity === 1 ? 'trash-outline' : 'remove'} size={14} color="#FF8A00" />
                    </TouchableOpacity>
                    <Text style={s.cNum}>{item.quantity}</Text>
                    <TouchableOpacity style={s.cBtn}
                      onPress={() => updateQty(item.product_id, item.quantity + 1)}>
                      <Ionicons name="add" size={14} color="#FF8A00" />
                    </TouchableOpacity>
                  </View>
                  <Text style={s.itemTotal}>₹{item.price * item.quantity}</Text>
                </View>
              </View>
              {idx < items.length - 1 && <View style={s.itemDivider} />}
            </View>
          ))}
        </View>

        {/* Delivery address */}
        <View style={s.addressCard}>
          <View style={s.addressIconWrap}>
            <Ionicons name="location-sharp" size={20} color="#FF8A00" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.addressLabel}>Delivering to</Text>
            <Text style={s.addressText}>{deliveryAddress.line1}, {deliveryAddress.city} - {deliveryAddress.pincode}</Text>
          </View>
          <TouchableOpacity style={s.changeBtn} onPress={handleOpenAddressPicker}>
            <Text style={s.changeTxt}>Change</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity style={s.savedAddrBtn} onPress={handleOpenAddressPicker}>
          <Ionicons name="bookmark-outline" size={14} color="#FF8A00" />
          <Text style={s.savedAddrTxt}>Use Saved Address</Text>
        </TouchableOpacity>

        {/* Tip section */}
        <View style={s.tipCard}>
          <View style={s.tipHeader}>
            <Text style={s.tipTitle}>🙏 Tip your delivery partner</Text>
            <Text style={s.tipSub}>100% goes to them</Text>
          </View>
          <View style={s.tipOptions}>
            {[0, 10, 20, 30].map(t => (
              <TouchableOpacity key={t} style={[s.tipChip, tip === t && s.tipChipActive]}
                onPress={() => setTip(t)}>
                <Text style={[s.tipChipTxt, tip === t && s.tipChipTxtActive]}>
                  {t === 0 ? 'None' : `₹${t}`}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Bill details */}
        <View style={s.billCard}>
          <Text style={s.billTitle}>Bill Details</Text>
          <View style={s.billRow}>
            <Text style={s.billLbl}>Item total</Text>
            <Text style={s.billVal}>₹{total}</Text>
          </View>
          <View style={s.billRow}>
            <View>
              <Text style={s.billLbl}>Delivery fee</Text>
              {deliveryFee > 0 && (
                <Text style={s.billHint}>
                  Add ₹{total >= 200 ? 500 - total : 200 - total} more for free delivery
                </Text>
              )}
            </View>
            {deliveryFee === 0
              ? <View style={s.freePill}><Text style={s.freeTxt}>FREE</Text></View>
              : <Text style={s.billVal}>₹{deliveryFee}</Text>
            }
          </View>
          {tip > 0 && (
            <View style={s.billRow}>
              <Text style={s.billLbl}>Delivery tip</Text>
              <Text style={s.billVal}>₹{tip}</Text>
            </View>
          )}
          <View style={s.billDivider} />
          <View style={s.billRow}>
            <Text style={s.billTotal}>Grand Total</Text>
            <Text style={s.billTotalVal}>₹{grandTotal}</Text>
          </View>
        </View>

        {/* Safety note */}
        <View style={s.safetyNote}>
          <Ionicons name="shield-checkmark-outline" size={16} color="#22C55E" />
          <Text style={s.safetyTxt}>All payments are 100% secure</Text>
        </View>

        <View style={{ height: 110 }} />
      </ScrollView>

      {/* No riders banner — shown above footer when unavailable */}
      {ridersAvailable === false && (
        <View style={s.noRiderBanner}>
          <View style={s.noRiderIconWrap}>
            <Text style={{ fontSize: 22 }}>🛵</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.noRiderTitle}>No riders available right now</Text>
            <Text style={s.noRiderSub}>Button unlocks automatically when a rider is available</Text>
          </View>
          <TouchableOpacity onPress={checkAvailability} disabled={availChecking} style={s.retryBtn}>
            {availChecking
              ? <ActivityIndicator size="small" color="#FF8A00" />
              : <Text style={s.retryTxt}>Retry</Text>
            }
          </TouchableOpacity>
        </View>
      )}

      {/* Place order footer */}
      <View style={s.footer}>
        <View>
          <Text style={s.footerLbl}>To Pay</Text>
          <Text style={s.footerTotal}>₹{grandTotal}</Text>
        </View>
        <TouchableOpacity
          onPress={handlePlaceOrder}
          disabled={loading || ridersAvailable === false || availChecking}
          style={{ flex: 1 }} activeOpacity={0.88}>
          <LinearGradient
            colors={ridersAvailable === false ? ['#CCC', '#BBB'] : ['#FF8A00','#FF5C00']}
            style={s.placeBtn} start={{ x:0,y:0 }} end={{ x:1,y:0 }}>
            {loading
              ? <ActivityIndicator color="#fff" />
              : availChecking
              ? <><ActivityIndicator color="#fff" size="small" /><Text style={s.placeBtnTxt}>Checking…</Text></>
              : ridersAvailable === false
              ? <Text style={s.placeBtnTxt}>No Riders Available</Text>
              : <>
                  <Text style={s.placeBtnTxt}>Place Order</Text>
                  <Ionicons name="arrow-forward" size={18} color="#fff" />
                </>
            }
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root:         { flex: 1, backgroundColor: '#F7F8FA' },
  header:       { paddingTop: Platform.OS === 'ios' ? 56 : 36, paddingBottom: 18, paddingHorizontal: 20,
                   flexDirection: 'row', alignItems: 'center', gap: 12 },
  backBtn:      { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.2)',
                   alignItems: 'center', justifyContent: 'center' },
  headerTitle:  { fontSize: 18, fontWeight: '800', color: '#fff' },
  headerSub:    { fontSize: 12, color: 'rgba(255,255,255,0.75)', marginTop: 2 },
  clearBtn:     { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 8,
                   paddingHorizontal: 12, paddingVertical: 6 },
  clearTxt:     { color: '#fff', fontSize: 13, fontWeight: '700' },

  empty:        { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 32 },
  emptyCircle:  { width: 100, height: 100, borderRadius: 50, backgroundColor: '#FFF4E6',
                   alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  emptyT:       { fontSize: 20, fontWeight: '800', color: '#111' },
  emptySub:     { fontSize: 14, color: '#888', textAlign: 'center', lineHeight: 20 },
  browseBtn:    { marginTop: 8, borderRadius: 14, overflow: 'hidden' },
  browseBtnGrad:{ paddingHorizontal: 36, paddingVertical: 14 },
  browseBtnTxt: { color: '#fff', fontSize: 15, fontWeight: '700' },

  shopBanner:   { backgroundColor: '#fff', margin: 16, borderRadius: 18, padding: 14,
                   flexDirection: 'row', alignItems: 'center', gap: 12,
                   shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width:0,height:2 } },
  shopBannerIcon:{ width: 44, height: 44, borderRadius: 12, backgroundColor: '#FFF4E6',
                   alignItems: 'center', justifyContent: 'center' },
  shopBannerName:{ fontSize: 15, fontWeight: '700', color: '#111' },
  shopBannerSub: { fontSize: 12, color: '#999', marginTop: 2 },
  addMoreTxt:   { fontSize: 13, fontWeight: '700', color: '#FF8A00' },

  itemsCard:    { backgroundColor: '#fff', marginHorizontal: 16, marginBottom: 12, borderRadius: 18, padding: 16,
                   shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width:0,height:2 } },
  itemRow:      { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  itemLeft:     { flex: 1 },
  itemName:     { fontSize: 15, fontWeight: '600', color: '#111', marginBottom: 3 },
  itemPricePer: { fontSize: 12, color: '#999' },
  itemRight:    { alignItems: 'flex-end', gap: 8 },
  counter:      { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5,
                   borderColor: '#FF8A00', borderRadius: 10, overflow: 'hidden' },
  cBtn:         { width: 32, height: 32, alignItems: 'center', justifyContent: 'center',
                   backgroundColor: '#FFF4E6' },
  cNum:         { color: '#FF8A00', fontSize: 14, fontWeight: '800', minWidth: 28, textAlign: 'center' },
  itemTotal:    { fontSize: 15, fontWeight: '800', color: '#111' },
  itemDivider:  { height: 0.5, backgroundColor: '#F5F5F5' },

  addressCard:  { backgroundColor: '#fff', marginHorizontal: 16, marginBottom: 12, borderRadius: 18, padding: 16,
                   flexDirection: 'row', alignItems: 'center', gap: 12,
                   shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width:0,height:2 } },
  addressIconWrap:{ width: 40, height: 40, borderRadius: 12, backgroundColor: '#FFF4E6',
                   alignItems: 'center', justifyContent: 'center' },
  addressLabel: { fontSize: 11, fontWeight: '700', color: '#999', textTransform: 'uppercase',
                   letterSpacing: 0.5, marginBottom: 3 },
  addressText:  { fontSize: 13, color: '#333', fontWeight: '500', lineHeight: 18 },
  changeBtn:    { backgroundColor: '#FFF4E6', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  changeTxt:    { fontSize: 12, color: '#FF8A00', fontWeight: '700' },
  savedAddrBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-end',
                   marginHorizontal: 16, marginTop: -6, marginBottom: 6,
                   paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8,
                   backgroundColor: '#FFF4E6' },
  savedAddrTxt: { fontSize: 12, color: '#FF8A00', fontWeight: '700' },

  tipCard:      { backgroundColor: '#fff', marginHorizontal: 16, marginBottom: 12, borderRadius: 18, padding: 16,
                   shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width:0,height:2 } },
  tipHeader:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  tipTitle:     { fontSize: 15, fontWeight: '700', color: '#111' },
  tipSub:       { fontSize: 12, color: '#999' },
  tipOptions:   { flexDirection: 'row', gap: 8 },
  tipChip:      { flex: 1, paddingVertical: 9, borderRadius: 10, borderWidth: 1.5,
                   borderColor: '#E5E7EB', alignItems: 'center' },
  tipChipActive:{ borderColor: '#FF8A00', backgroundColor: '#FFF4E6' },
  tipChipTxt:   { fontSize: 13, fontWeight: '700', color: '#666' },
  tipChipTxtActive:{ color: '#FF8A00' },

  billCard:     { backgroundColor: '#fff', marginHorizontal: 16, marginBottom: 12, borderRadius: 18, padding: 16,
                   shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width:0,height:2 } },
  billTitle:    { fontSize: 16, fontWeight: '800', color: '#111', marginBottom: 14 },
  billRow:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  billLbl:      { fontSize: 14, color: '#666' },
  billHint:     { fontSize: 11, color: '#FF8A00', marginTop: 3 },
  billVal:      { fontSize: 14, color: '#111', fontWeight: '600' },
  freePill:     { backgroundColor: '#DCFCE7', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  freeTxt:      { fontSize: 12, fontWeight: '800', color: '#16A34A' },
  billDivider:  { height: 0.5, backgroundColor: '#F0F0F0', marginBottom: 12 },
  billTotal:    { fontSize: 16, fontWeight: '800', color: '#111' },
  billTotalVal: { fontSize: 18, fontWeight: '800', color: '#FF8A00' },

  safetyNote:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                   gap: 6, marginBottom: 16 },
  safetyTxt:    { fontSize: 12, color: '#22C55E', fontWeight: '600' },

  noRiderBanner:{ flexDirection: 'row', alignItems: 'center', gap: 12,
                   backgroundColor: '#FFF4E6', borderTopWidth: 1, borderTopColor: '#FFE0B2',
                   paddingHorizontal: 16, paddingVertical: 12 },
  noRiderIconWrap:{ width: 44, height: 44, borderRadius: 12, backgroundColor: '#FFE0B2',
                   alignItems: 'center', justifyContent: 'center' },
  noRiderTitle: { fontSize: 13, fontWeight: '700', color: '#C05600', marginBottom: 2 },
  noRiderSub:   { fontSize: 11, color: '#E07020', lineHeight: 15 },
  retryBtn:     { paddingHorizontal: 14, paddingVertical: 8, backgroundColor: '#fff',
                   borderRadius: 10, borderWidth: 1.5, borderColor: '#FF8A00',
                   minWidth: 56, alignItems: 'center', justifyContent: 'center' },
  retryTxt:     { fontSize: 13, fontWeight: '700', color: '#FF8A00' },

  footer:       { flexDirection: 'row', alignItems: 'center', gap: 16, padding: 16,
                   paddingBottom: Platform.OS === 'ios' ? 32 : 16,
                   backgroundColor: '#fff', borderTopWidth: 0.5, borderTopColor: '#F0F0F0' },
  footerLbl:    { fontSize: 11, color: '#888', fontWeight: '600', marginBottom: 2 },
  footerTotal:  { fontSize: 22, fontWeight: '800', color: '#111' },
  placeBtn:     { height: 54, borderRadius: 16, flexDirection: 'row', alignItems: 'center',
                   justifyContent: 'center', gap: 8,
                   shadowColor: '#FF8A00', shadowOpacity: 0.4, shadowRadius: 12, shadowOffset: { width:0,height:4 } },
  placeBtnTxt:  { color: '#fff', fontSize: 16, fontWeight: '800' },
});
