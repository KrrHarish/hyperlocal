import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useCart } from '../store/CartContext';

const MOCK_PRODUCTS = [
  { id: 'p1', name: 'Amul Milk 500ml', price: 28, category: 'Dairy', emoji: '🥛', in_stock: true },
  { id: 'p2', name: 'Britannia Bread', price: 42, category: 'Bakery', emoji: '🍞', in_stock: true },
  { id: 'p3', name: 'Tata Salt 1kg', price: 22, category: 'Grocery', emoji: '🧂', in_stock: true },
  { id: 'p4', name: 'Lays Classic Salted', price: 20, category: 'Snacks', emoji: '🍿', in_stock: true },
  { id: 'p5', name: 'Parle-G Biscuits', price: 10, category: 'Snacks', emoji: '🍪', in_stock: false },
  { id: 'p6', name: 'Tropicana Orange 1L', price: 85, category: 'Beverages', emoji: '🧃', in_stock: true },
  { id: 'p7', name: 'Surf Excel 500g', price: 78, category: 'Household', emoji: '🧺', in_stock: true },
  { id: 'p8', name: 'Colgate Toothpaste', price: 65, category: 'Personal Care', emoji: '🪥', in_stock: true },
];

export default function ShopScreen({ route, navigation }: any) {
  const { shop } = route.params;
  const { addItem, items, itemCount, total } = useCart();

  const getQty = (pid: string) => items.find(i => i.product_id === pid)?.quantity || 0;

  const grouped = MOCK_PRODUCTS.reduce((acc: any, p) => {
    if (!acc[p.category]) acc[p.category] = [];
    acc[p.category].push(p);
    return acc;
  }, {});

  return (
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient colors={['#FF8A00', '#FF5C00']} style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.shopName}>{shop.name}</Text>
          <View style={styles.metaRow}>
            <Ionicons name="star" size={13} color="rgba(255,255,255,0.9)" />
            <Text style={styles.metaText}>{shop.rating} · {shop.eta} · {shop.distance}</Text>
          </View>
        </View>
        <View style={[styles.statusDot, { backgroundColor: shop.is_open ? '#22C55E' : '#EF4444' }]} />
      </LinearGradient>

      <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
        {Object.entries(grouped).map(([category, products]: any) => (
          <View key={category} style={styles.section}>
            <Text style={styles.catTitle}>{category}</Text>
            {products.map((product: any) => {
              const qty = getQty(product.id);
              return (
                <View key={product.id} style={[styles.productCard, !product.in_stock && styles.productCardDisabled]}>
                  <View style={styles.productImg}>
                    <Text style={styles.productEmoji}>{product.emoji}</Text>
                  </View>
                  <View style={styles.productInfo}>
                    <Text style={styles.productName}>{product.name}</Text>
                    <Text style={styles.productPrice}>₹{product.price}</Text>
                    {!product.in_stock && <Text style={styles.outOfStock}>Out of stock</Text>}
                  </View>
                  {product.in_stock && (
                    <View style={styles.qtyControl}>
                      {qty === 0 ? (
                        <TouchableOpacity
                          style={styles.addBtn}
                          onPress={() => addItem(
                            { product_id: product.id, name: product.name, price: product.price, quantity: 1 },
                            shop.id, shop.name
                          )}
                        >
                          <Text style={styles.addBtnText}>ADD</Text>
                        </TouchableOpacity>
                      ) : (
                        <View style={styles.counter}>
                          <TouchableOpacity
                            style={styles.countBtn}
                            onPress={() => addItem(
                              { product_id: product.id, name: product.name, price: product.price, quantity: 1 },
                              shop.id, shop.name
                            )}
                          >
                            <Text style={styles.countBtnText}>+</Text>
                          </TouchableOpacity>
                          <Text style={styles.countNum}>{qty}</Text>
                          <TouchableOpacity
                            style={styles.countBtn}
                            onPress={() => {/* decrease handled by CartContext */}}
                          >
                            <Text style={styles.countBtnText}>−</Text>
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        ))}
        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Cart bar */}
      {itemCount > 0 && (
        <TouchableOpacity
          style={styles.cartBar}
          onPress={() => navigation.navigate('Cart')}
          activeOpacity={0.9}
        >
          <LinearGradient colors={['#FF8A00', '#FF5C00']} style={styles.cartGrad}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
            <View style={styles.cartLeft}>
              <View style={styles.cartBadge}>
                <Text style={styles.cartBadgeText}>{itemCount}</Text>
              </View>
              <Text style={styles.cartText}>View Cart · {shop.name}</Text>
            </View>
            <Text style={styles.cartTotal}>₹{total}</Text>
          </LinearGradient>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: '#F5F5F5' },
  header:      { paddingTop: 52, paddingBottom: 18, paddingHorizontal: 20,
                  flexDirection: 'row', alignItems: 'center', gap: 14 },
  backBtn:     { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.2)',
                  alignItems: 'center', justifyContent: 'center' },
  headerInfo:  { flex: 1 },
  shopName:    { fontSize: 18, fontWeight: '800', color: '#fff', marginBottom: 3 },
  metaRow:     { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText:    { fontSize: 12, color: 'rgba(255,255,255,0.85)', fontWeight: '500' },
  statusDot:   { width: 10, height: 10, borderRadius: 5 },

  body:        { flex: 1 },
  section:     { paddingHorizontal: 16, marginTop: 20 },
  catTitle:    { fontSize: 16, fontWeight: '800', color: '#111', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 },

  productCard: { backgroundColor: '#fff', borderRadius: 14, marginBottom: 10, padding: 14,
                  flexDirection: 'row', alignItems: 'center', gap: 12,
                  shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
  productCardDisabled: { opacity: 0.5 },
  productImg:  { width: 56, height: 56, borderRadius: 12, backgroundColor: '#FFF4E6',
                  alignItems: 'center', justifyContent: 'center' },
  productEmoji:{ fontSize: 28 },
  productInfo: { flex: 1 },
  productName: { fontSize: 15, fontWeight: '600', color: '#111', marginBottom: 4 },
  productPrice:{ fontSize: 16, fontWeight: '800', color: '#FF8A00' },
  outOfStock:  { fontSize: 11, color: '#EF4444', fontWeight: '600', marginTop: 2 },

  qtyControl:  { flexShrink: 0 },
  addBtn:      { backgroundColor: '#FF8A00', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 8 },
  addBtnText:  { color: '#fff', fontSize: 13, fontWeight: '800', letterSpacing: 1 },
  counter:     { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FF8A00',
                  borderRadius: 10, overflow: 'hidden' },
  countBtn:    { width: 34, height: 36, alignItems: 'center', justifyContent: 'center' },
  countBtnText:{ color: '#fff', fontSize: 20, fontWeight: '700' },
  countNum:    { color: '#fff', fontSize: 16, fontWeight: '800', minWidth: 24, textAlign: 'center' },

  cartBar:     { position: 'absolute', bottom: 20, left: 16, right: 16, borderRadius: 18, overflow: 'hidden',
                  shadowColor: '#FF8A00', shadowOpacity: 0.4, shadowRadius: 20, shadowOffset: { width: 0, height: 6 } },
  cartGrad:    { paddingHorizontal: 20, paddingVertical: 16, flexDirection: 'row',
                  alignItems: 'center', justifyContent: 'space-between' },
  cartLeft:    { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cartBadge:   { width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.25)',
                  alignItems: 'center', justifyContent: 'center' },
  cartBadgeText:{ color: '#fff', fontSize: 13, fontWeight: '800' },
  cartText:    { color: '#fff', fontSize: 15, fontWeight: '700' },
  cartTotal:   { color: '#fff', fontSize: 18, fontWeight: '800' },
});
