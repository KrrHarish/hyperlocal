import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

const STEPS = [
  { key: 'placed',    label: 'Order Placed',      emoji: '✅', sub: 'We received your order' },
  { key: 'confirmed', label: 'Shop Confirmed',     emoji: '🏪', sub: 'Shop is preparing your items' },
  { key: 'picked',    label: 'Rider Picked Up',    emoji: '🛵', sub: 'Rider is heading your way' },
  { key: 'delivered', label: 'Delivered',          emoji: '🎉', sub: 'Enjoy your order!' },
];

export default function OrderTrackingScreen({ route, navigation }: any) {
  const { orderId } = route.params;
  const [currentStep, setCurrentStep] = useState(0);
  const [pulseAnim]  = useState(new Animated.Value(1));

  // Simulate order progress for demo
  useEffect(() => {
    const timers = [
      setTimeout(() => setCurrentStep(1), 3000),
      setTimeout(() => setCurrentStep(2), 7000),
      setTimeout(() => setCurrentStep(3), 12000),
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  // Pulse animation for active step
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.2, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1,   duration: 800, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const eta = currentStep === 0 ? '18 min' : currentStep === 1 ? '14 min' : currentStep === 2 ? '6 min' : '0 min';

  return (
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient colors={['#FF8A00', '#FF5C00']} style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.navigate('Home')}>
          <Ionicons name="home" size={20} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle}>Order Tracking</Text>
          <Text style={styles.orderId}>#{orderId.slice(-8).toUpperCase()}</Text>
        </View>
        <TouchableOpacity style={styles.callBtn}>
          <Ionicons name="call" size={20} color="#fff" />
        </TouchableOpacity>
      </LinearGradient>

      {/* ETA card */}
      {currentStep < 3 ? (
        <LinearGradient colors={['#0B1A2B', '#0F2236']} style={styles.etaCard}>
          <View>
            <Text style={styles.etaLabel}>Estimated arrival</Text>
            <Text style={styles.etaTime}>{eta}</Text>
          </View>
          <Animated.View style={[styles.riderEmoji, { transform: [{ scale: pulseAnim }] }]}>
            <Text style={{ fontSize: 40 }}>🛵</Text>
          </Animated.View>
        </LinearGradient>
      ) : (
        <View style={styles.deliveredCard}>
          <Text style={styles.deliveredEmoji}>🎉</Text>
          <Text style={styles.deliveredTitle}>Order Delivered!</Text>
          <Text style={styles.deliveredSub}>Hope you enjoy your items</Text>
        </View>
      )}

      {/* Progress steps */}
      <View style={styles.stepsContainer}>
        {STEPS.map((step, idx) => {
          const isDone   = idx < currentStep;
          const isActive = idx === currentStep;
          return (
            <View key={step.key} style={styles.stepRow}>
              {/* Line */}
              {idx < STEPS.length - 1 && (
                <View style={[styles.stepLine, isDone && styles.stepLineDone]} />
              )}
              {/* Dot */}
              <View style={[
                styles.stepDot,
                isDone   && styles.stepDotDone,
                isActive && styles.stepDotActive,
              ]}>
                {isDone ? (
                  <Ionicons name="checkmark" size={16} color="#fff" />
                ) : (
                  <Text style={styles.stepDotNum}>{idx + 1}</Text>
                )}
              </View>
              {/* Content */}
              <View style={styles.stepContent}>
                <Text style={[styles.stepLabel, (isDone || isActive) && styles.stepLabelActive]}>
                  {step.emoji} {step.label}
                </Text>
                <Text style={styles.stepSub}>{step.sub}</Text>
              </View>
            </View>
          );
        })}
      </View>

      {/* Rider info */}
      {currentStep >= 2 && currentStep < 3 && (
        <View style={styles.riderCard}>
          <View style={styles.riderAvatar}>
            <Text style={{ fontSize: 28 }}>👨‍🦱</Text>
          </View>
          <View style={styles.riderInfo}>
            <Text style={styles.riderName}>Ravi Kumar</Text>
            <Text style={styles.riderSub}>⭐ 4.9 · KA 01 AB 1234</Text>
          </View>
          <TouchableOpacity style={styles.riderCallBtn}>
            <LinearGradient colors={['#FF8A00', '#FF5C00']} style={styles.riderCallGrad}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
              <Ionicons name="call" size={18} color="#fff" />
            </LinearGradient>
          </TouchableOpacity>
        </View>
      )}

      {/* Rate & reorder */}
      {currentStep === 3 && (
        <View style={styles.actions}>
          <TouchableOpacity style={styles.rateBtn}>
            <Text style={styles.rateBtnText}>⭐ Rate Order</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.reorderBtn}
            onPress={() => navigation.navigate('Home')}
          >
            <LinearGradient colors={['#FF8A00', '#FF5C00']} style={styles.reorderGrad}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
              <Text style={styles.reorderText}>Order Again</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container:      { flex: 1, backgroundColor: '#F5F5F5' },
  header:         { paddingTop: 52, paddingBottom: 18, paddingHorizontal: 20,
                     flexDirection: 'row', alignItems: 'center', gap: 14 },
  backBtn:        { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.2)',
                     alignItems: 'center', justifyContent: 'center' },
  headerInfo:     { flex: 1 },
  headerTitle:    { fontSize: 18, fontWeight: '800', color: '#fff' },
  orderId:        { fontSize: 12, color: 'rgba(255,255,255,0.7)', fontWeight: '600', marginTop: 2 },
  callBtn:        { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.2)',
                     alignItems: 'center', justifyContent: 'center' },

  etaCard:        { margin: 16, borderRadius: 18, padding: 20, flexDirection: 'row',
                     alignItems: 'center', justifyContent: 'space-between' },
  etaLabel:       { fontSize: 13, color: 'rgba(255,255,255,0.5)', marginBottom: 4 },
  etaTime:        { fontSize: 36, fontWeight: '800', color: '#FF8A00' },
  riderEmoji:     {},

  deliveredCard:  { margin: 16, backgroundColor: '#fff', borderRadius: 18, padding: 24,
                     alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 3 } },
  deliveredEmoji: { fontSize: 52, marginBottom: 8 },
  deliveredTitle: { fontSize: 22, fontWeight: '800', color: '#111', marginBottom: 4 },
  deliveredSub:   { fontSize: 14, color: '#888' },

  stepsContainer: { backgroundColor: '#fff', margin: 16, borderRadius: 18, padding: 20,
                     shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
  stepRow:        { flexDirection: 'row', alignItems: 'flex-start', gap: 14, marginBottom: 24, position: 'relative' },
  stepLine:       { position: 'absolute', left: 15, top: 32, width: 2, height: 28, backgroundColor: '#E5E5E5' },
  stepLineDone:   { backgroundColor: '#FF8A00' },
  stepDot:        { width: 32, height: 32, borderRadius: 16, backgroundColor: '#E5E5E5',
                     alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  stepDotDone:    { backgroundColor: '#FF8A00' },
  stepDotActive:  { backgroundColor: '#FF8A00', shadowColor: '#FF8A00', shadowOpacity: 0.5, shadowRadius: 8, shadowOffset: { width: 0, height: 0 } },
  stepDotNum:     { fontSize: 13, fontWeight: '700', color: '#999' },
  stepContent:    { flex: 1, paddingTop: 4 },
  stepLabel:      { fontSize: 15, fontWeight: '600', color: '#999', marginBottom: 2 },
  stepLabelActive:{ color: '#111' },
  stepSub:        { fontSize: 12, color: '#AAA' },

  riderCard:      { backgroundColor: '#fff', marginHorizontal: 16, borderRadius: 18, padding: 16,
                     flexDirection: 'row', alignItems: 'center', gap: 14,
                     shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
  riderAvatar:    { width: 52, height: 52, borderRadius: 26, backgroundColor: '#FFF4E6',
                     alignItems: 'center', justifyContent: 'center' },
  riderInfo:      { flex: 1 },
  riderName:      { fontSize: 16, fontWeight: '700', color: '#111', marginBottom: 3 },
  riderSub:       { fontSize: 13, color: '#888' },
  riderCallBtn:   { borderRadius: 12, overflow: 'hidden' },
  riderCallGrad:  { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },

  actions:        { flexDirection: 'row', gap: 12, marginHorizontal: 16, marginTop: 16 },
  rateBtn:        { flex: 1, height: 52, backgroundColor: '#fff', borderRadius: 14,
                     alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: '#FF8A00' },
  rateBtnText:    { fontSize: 15, fontWeight: '700', color: '#FF8A00' },
  reorderBtn:     { flex: 1, borderRadius: 14, overflow: 'hidden' },
  reorderGrad:    { height: 52, alignItems: 'center', justifyContent: 'center' },
  reorderText:    { fontSize: 15, fontWeight: '700', color: '#fff' },
});
