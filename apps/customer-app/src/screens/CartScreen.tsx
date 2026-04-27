import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Alert, ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useCart } from '../store/CartContext';
import { placeOrder } from '../services/api';

const DELIVERY_ADDRESS = '123, 5th Cross, HSR Layout, Bengaluru - 560102';

export default function CartScreen({ navigation }: any) {
  const { items, shopId, shopName, updateQty, removeItem, clearCart, total, itemCount } = useCart();
  const [loading, setLoading] = useState(false);

  const deliveryFee = total >= 500 ? 0 : total >= 200 ? 25 : 40;
  const grandTotal  = total + deliveryFee;

  const handlePlaceOrder = async () => {
    if (!shopId) return;
    setLoading(true);
    try {
      const res = await placeOrder({
        shop_id: shopId,
        items: items.map(i => ({ product_id: i.product_id, quantity: i.quantity })),
        delivery_address: DELIVERY_ADDRESS,
        delivery_lat: 12.9116,
        delivery_lng: 77.6389,
      });
      clearCart();
      navigation.navigate('OrderTracking', { orderId: res.data.order_id || 'mock-order-001' });
    } catch {
      // Dev bypass
      clearCart();
      navigation.navigate('OrderTracking', { orderId: 'mock-order-001' });
    } finally {
      setLoading(false);
    }
  };

  if (items.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyEmoji}>🛒</Text>
        <Text style={styles.emptyTitle}>Your cart is empty</Text>
        <Text style={styles.emptySub}>Add items from a nearby shop</Text>
        <TouchableOpacity style={styles.shopNowBtn} onPress={() => navigation.goBack()}>
          <LinearGradient colors={['#FF8A00', '#FF5C00']} style={styles.shopNowGrad}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
            <Text style={styles.shopNowText}>Browse Shops</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient colors={['#FF8A00', '#FF5C00']} style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Your Cart</Text>
        <TouchableOpacity onPress={() => { clearCart(); navigation.goBack(); }}>
          <Text style={styles.clearText}>Clear</Text>
        </TouchableOpacity>
      </LinearGradient>

      <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
        {/* Shop name */}
        <View style={styles.shopBanner}>
          <Text style={styles.shopBannerEmoji}>🏪</Text>
          <Text style={styles.shopBannerName}>{shopName}</Text>
        </View>

        {/* Items */}
        {items.map(item => (
          <View key={item.product_id} style={styles.itemRow}>
            <View style={styles.itemLeft}>
              <Text style={styles.itemName}>{item.name}</Text>
              <Text style={styles.itemPrice}>₹{item.price} × {item.quantity}</Text>
            </View>
            <View style={styles.itemRight}>
              <View style={styles.counter}>
                <TouchableOpacity
                  style={styles.countBtn}
                  onPress={() => updateQty(item.product_id, item.quantity - 1)}
                >
                  <Text style={styles.countBtnText}>−</Text>
                </TouchableOpacity>
                <Text style={styles.countNum}>{item.quantity}</Text>
                <TouchableOpacity
                  style={styles.countBtn}
                  onPress={() => updateQty(item.product_id, item.quantity + 1)}
                >
                  <Text style={styles.countBtnText}>+</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.itemTotal}>₹{item.price * item.quantity}</Text>
            </View>
          </View>
        ))}

        {/* Delivery address */}
        <View style={styles.addressCard}>
          <Ionicons name="location-sharp" size={18} color="#FF8A00" />
          <View style={styles.addressInfo}>
            <Text style={styles.addressLabel}>Delivering to</Text>
            <Text style={styles.addressText}>{DELIVERY_ADDRESS}</Text>
          </View>
          <TouchableOpacity>
            <Text style={styles.changeText}>Change</Text>
          </TouchableOpacity>
        </View>

        {/* Bill details */}
        <View style={styles.billCard}>
          <Text style={styles.billTitle}>Bill Details</Text>
          <View style={styles.billRow}>
            <Text style={styles.billLabel}>Item total ({itemCount} items)</Text>
            <Text style={styles.billValue}>₹{total}</Text>
          </View>
          <View style={styles.billRow}>
            <Text style={styles.billLabel}>Delivery fee</Text>
            <Text style={[styles.billValue, deliveryFee === 0 && { color: '#22C55E' }]}>
              {deliveryFee === 0 ? 'FREE' : `₹${deliveryFee}`}
            </Text>
          </View>
          {deliveryFee > 0 && (
            <Text style={styles.freeHint}>
              Add ₹{total >= 200 ? 500 - total : 200 - total} more for free delivery
            </Text>
          )}
          <View style={styles.billDivider} />
          <View style={styles.billRow}>
            <Text style={styles.billTotalLabel}>Grand Total</Text>
            <Text style={styles.billTotalValue}>₹{grandTotal}</Text>
          </View>
        </View>

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Place order */}
      <View style={styles.footer}>
        <View style={styles.footerTotal}>
          <Text style={styles.footerLabel}>Total</Text>
          <Text style={styles.footerAmount}>₹{grandTotal}</Text>
        </View>
        <TouchableOpacity onPress={handlePlaceOrder} disabled={loading} style={{ flex: 1 }} activeOpacity={0.85}>
          <LinearGradient colors={['#FF8A00', '#FF5C00']} style={styles.placeBtn}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.placeBtnText}>Place Order →</Text>
            }
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: '#F5F5F5' },
  empty:        { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F5F5F5', gap: 12 },
  emptyEmoji:   { fontSize: 64 },
  emptyTitle:   { fontSize: 22, fontWeight: '800', color: '#111' },
  emptySub:     { fontSize: 14, color: '#888' },
  shopNowBtn:   { marginTop: 8, borderRadius: 14, overflow: 'hidden' },
  shopNowGrad:  { paddingHorizontal: 32, paddingVertical: 14 },
  shopNowText:  { color: '#fff', fontSize: 16, fontWeight: '700' },

  header:       { paddingTop: 52, paddingBottom: 18, paddingHorizontal: 20,
                   flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backBtn:      { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.2)',
                   alignItems: 'center', justifyContent: 'center' },
  headerTitle:  { fontSize: 18, fontWeight: '800', color: '#fff' },
  clearText:    { color: 'rgba(255,255,255,0.8)', fontSize: 14, fontWeight: '600' },

  body:         { flex: 1, paddingHorizontal: 16, paddingTop: 16 },

  shopBanner:   { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#fff',
                   borderRadius: 14, padding: 14, marginBottom: 12,
                   shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
  shopBannerEmoji:{ fontSize: 24 },
  shopBannerName: { fontSize: 16, fontWeight: '700', color: '#111' },

  itemRow:      { backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 10,
                   flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                   shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
  itemLeft:     { flex: 1 },
  itemName:     { fontSize: 15, fontWeight: '600', color: '#111', marginBottom: 4 },
  itemPrice:    { fontSize: 13, color: '#888' },
  itemRight:    { alignItems: 'flex-end', gap: 8 },
  counter:      { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FF8A00', borderRadius: 10, overflow: 'hidden' },
  countBtn:     { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  countBtnText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  countNum:     { color: '#fff', fontSize: 15, fontWeight: '800', minWidth: 22, textAlign: 'center' },
  itemTotal:    { fontSize: 16, fontWeight: '800', color: '#FF8A00' },

  addressCard:  { backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 12,
                   flexDirection: 'row', alignItems: 'center', gap: 12,
                   shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
  addressInfo:  { flex: 1 },
  addressLabel: { fontSize: 11, fontWeight: '700', color: '#888', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 },
  addressText:  { fontSize: 13, color: '#111', fontWeight: '500', lineHeight: 18 },
  changeText:   { color: '#FF8A00', fontWeight: '700', fontSize: 13 },

  billCard:     { backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 12,
                   shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
  billTitle:    { fontSize: 16, fontWeight: '800', color: '#111', marginBottom: 14 },
  billRow:      { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  billLabel:    { fontSize: 14, color: '#666', fontWeight: '500' },
  billValue:    { fontSize: 14, color: '#111', fontWeight: '600' },
  freeHint:     { fontSize: 12, color: '#FF8A00', fontWeight: '500', marginBottom: 8 },
  billDivider:  { height: 1, backgroundColor: '#F0F0F0', marginVertical: 10 },
  billTotalLabel:{ fontSize: 16, fontWeight: '800', color: '#111' },
  billTotalValue:{ fontSize: 18, fontWeight: '800', color: '#FF8A00' },

  footer:       { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16,
                   backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#F0F0F0' },
  footerTotal:  {},
  footerLabel:  { fontSize: 11, color: '#888', fontWeight: '600' },
  footerAmount: { fontSize: 20, fontWeight: '800', color: '#111' },
  placeBtn:     { height: 54, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
                   shadowColor: '#FF8A00', shadowOpacity: 0.4, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
  placeBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
});
