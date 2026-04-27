import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { getMyOrders } from '../services/api';

const MOCK_ORDERS = [
  { id: 'ord-001', shop_name: 'Raju General Store', status: 'delivered',
    total: 156, items: 4, date: '2 hours ago', items_preview: 'Milk, Bread, Salt...' },
  { id: 'ord-002', shop_name: 'Cool Drinks Corner', status: 'delivered',
    total: 85, items: 1, date: 'Yesterday', items_preview: 'Tropicana Orange 1L' },
  { id: 'ord-003', shop_name: 'Lakshmi Provisions', status: 'cancelled',
    total: 240, items: 5, date: '3 days ago', items_preview: 'Rice, Dal, Oil...' },
];

const STATUS_COLORS: any = {
  delivered: { bg: '#DCFCE7', text: '#16A34A' },
  cancelled:  { bg: '#FEE2E2', text: '#DC2626' },
  pending:    { bg: '#FEF9C3', text: '#CA8A04' },
  active:     { bg: '#FFF4E6', text: '#FF8A00' },
};

export default function OrdersScreen({ navigation }: any) {
  const [orders, setOrders] = useState(MOCK_ORDERS);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await getMyOrders();
        if (res.data?.orders?.length) setOrders(res.data.orders);
      } catch { /* use mock */ }
      setLoading(false);
    })();
  }, []);

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#FF8A00', '#FF5C00']} style={styles.header}>
        <Text style={styles.headerTitle}>My Orders</Text>
      </LinearGradient>

      {loading ? (
        <ActivityIndicator color="#FF8A00" style={{ marginTop: 40 }} />
      ) : orders.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyEmoji}>📦</Text>
          <Text style={styles.emptyTitle}>No orders yet</Text>
          <Text style={styles.emptySub}>Your order history will appear here</Text>
        </View>
      ) : (
        <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
          {orders.map(order => {
            const statusStyle = STATUS_COLORS[order.status] || STATUS_COLORS.pending;
            return (
              <TouchableOpacity
                key={order.id}
                style={styles.orderCard}
                onPress={() => navigation.navigate('OrderTracking', { orderId: order.id })}
                activeOpacity={0.85}
              >
                <View style={styles.orderTop}>
                  <View style={styles.shopInfo}>
                    <Text style={styles.shopEmoji}>🏪</Text>
                    <View>
                      <Text style={styles.shopName}>{order.shop_name}</Text>
                      <Text style={styles.orderDate}>{order.date}</Text>
                    </View>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: statusStyle.bg }]}>
                    <Text style={[styles.statusText, { color: statusStyle.text }]}>
                      {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                    </Text>
                  </View>
                </View>

                <View style={styles.orderDivider} />

                <View style={styles.orderBottom}>
                  <Text style={styles.itemsPreview}>{order.items_preview}</Text>
                  <View style={styles.orderRight}>
                    <Text style={styles.orderTotal}>₹{order.total}</Text>
                    <Text style={styles.orderItems}>{order.items} items</Text>
                  </View>
                </View>

                {order.status === 'delivered' && (
                  <TouchableOpacity style={styles.reorderBtn}>
                    <Text style={styles.reorderText}>🔄 Reorder</Text>
                  </TouchableOpacity>
                )}
              </TouchableOpacity>
            );
          })}
          <View style={{ height: 100 }} />
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: '#F5F5F5' },
  header:       { paddingTop: 52, paddingBottom: 18, paddingHorizontal: 20 },
  headerTitle:  { fontSize: 24, fontWeight: '800', color: '#fff' },

  empty:        { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  emptyEmoji:   { fontSize: 52 },
  emptyTitle:   { fontSize: 20, fontWeight: '800', color: '#111' },
  emptySub:     { fontSize: 14, color: '#888' },

  body:         { flex: 1, padding: 16 },
  orderCard:    { backgroundColor: '#fff', borderRadius: 18, padding: 16, marginBottom: 14,
                   shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: 3 } },
  orderTop:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  shopInfo:     { flexDirection: 'row', alignItems: 'center', gap: 10 },
  shopEmoji:    { fontSize: 28, width: 40, height: 40, textAlign: 'center', lineHeight: 40 },
  shopName:     { fontSize: 16, fontWeight: '700', color: '#111', marginBottom: 2 },
  orderDate:    { fontSize: 12, color: '#888', fontWeight: '500' },
  statusBadge:  { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  statusText:   { fontSize: 12, fontWeight: '700' },
  orderDivider: { height: 1, backgroundColor: '#F0F0F0', marginBottom: 12 },
  orderBottom:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  itemsPreview: { fontSize: 13, color: '#666', flex: 1, marginRight: 10 },
  orderRight:   { alignItems: 'flex-end' },
  orderTotal:   { fontSize: 18, fontWeight: '800', color: '#FF8A00' },
  orderItems:   { fontSize: 12, color: '#888', marginTop: 2 },
  reorderBtn:   { marginTop: 12, backgroundColor: '#FFF4E6', borderRadius: 10,
                   paddingVertical: 10, alignItems: 'center' },
  reorderText:  { color: '#FF8A00', fontSize: 14, fontWeight: '700' },
});
