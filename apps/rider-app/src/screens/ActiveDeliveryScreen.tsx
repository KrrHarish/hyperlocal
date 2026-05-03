import React, { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Platform,
  ScrollView, TextInput, ActivityIndicator, Alert, Linking,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { confirmPickup, deliverWithOtp } from '../api/client';

const STEPS = [
  { key: 'assigned',  icon: '🏪', label: 'Head to Shop',   sub: 'Pick up the order from the shop' },
  { key: 'picked_up', icon: '🛵', label: 'On the Way',     sub: 'Deliver to customer address'      },
  { key: 'delivered', icon: '🎉', label: 'Delivered',       sub: 'Order handed to customer'         },
];

const STEP_IDX: Record<string, number> = {
  assigned: 0, confirmed: 0, picked_up: 1, delivered: 2,
};

function fmtAddr(addr: any): string {
  if (!addr) return '—';
  if (typeof addr === 'string') {
    try { addr = JSON.parse(addr); } catch { return addr; }
  }
  return [addr.line1, addr.city, addr.pincode].filter(Boolean).join(', ');
}

function openMaps(address: string) {
  const url = Platform.OS === 'ios'
    ? `maps:?q=${encodeURIComponent(address)}`
    : `geo:0,0?q=${encodeURIComponent(address)}`;
  Linking.openURL(url).catch(() => {
    Linking.openURL(`https://maps.google.com?q=${encodeURIComponent(address)}`);
  });
}

export default function ActiveDeliveryScreen({ route, navigation }: any) {
  const { order: initialOrder } = route.params || {};
  const [order,    setOrder]    = useState<any>(initialOrder);
  const [otp,      setOtp]      = useState('');
  const [loading,  setLoading]  = useState(false);
  const [otpError, setOtpError] = useState('');

  const currentStep = STEP_IDX[order?.status] ?? 0;
  const deliveryAddr = fmtAddr(order?.delivery_address);
  const shopName    = order?.shop_name || 'Shop';

  const handlePickup = async () => {
    Alert.alert(
      'Confirm Pickup',
      `Have you collected all items from ${shopName}?`,
      [
        { text: 'Not yet', style: 'cancel' },
        {
          text: 'Yes, Picked Up ✓',
          style: 'default',
          onPress: async () => {
            setLoading(true);
            try {
              const res = await confirmPickup(order.id);
              setOrder(res.data.order);
            } catch (err: any) {
              Alert.alert('Error', err.response?.data?.error || 'Failed to update status');
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleDeliver = async () => {
    setOtpError('');
    if (otp.length !== 4) {
      setOtpError('Please enter the 4-digit OTP from the customer');
      return;
    }
    setLoading(true);
    try {
      const res = await deliverWithOtp(order.id, otp);
      setOrder(res.data.order);
      // Brief celebration then go back to home
      setTimeout(() => {
        if (navigation.canGoBack()) navigation.goBack();
        else navigation.navigate('Main');
      }, 2000);
    } catch (err: any) {
      setOtpError(err.response?.data?.error || 'Wrong OTP. Try again.');
    } finally {
      setLoading(false);
    }
  };

  if (order?.status === 'delivered') {
    return (
      <LinearGradient colors={['#0A0A0A', '#0F1117']} style={s.root}>
        <View style={s.deliveredWrap}>
          <Text style={s.deliveredEmoji}>🎉</Text>
          <Text style={s.deliveredTitle}>Order Delivered!</Text>
          <Text style={s.deliveredSub}>Great job! Delivery fee has been added to your wallet.</Text>
          <TouchableOpacity style={s.doneBtn} onPress={() => navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Main')}>
            <LinearGradient colors={['#16A34A', '#15803D']} style={s.doneBtnGrad}>
              <Text style={s.doneBtnTxt}>Back to Home</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={['#0A0A0A', '#0F1117']} style={s.root}>

      {/* Header */}
      <LinearGradient colors={['#14532D', '#166534']} style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Main')}>
          <Ionicons name="arrow-back" size={20} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.headerTitle}>Active Delivery</Text>
          <Text style={s.headerSub}>
            #{order?.id?.slice(0, 8).toUpperCase() ?? '—'}
          </Text>
        </View>
        <View style={s.earningBadge}>
          <Text style={s.earningTxt}>₹{parseFloat(order?.delivery_fee || '0').toFixed(0)}</Text>
          <Text style={s.earningLbl}>Your fee</Text>
        </View>
      </LinearGradient>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* Step Tracker */}
        <View style={s.stepsCard}>
          {STEPS.map((step, i) => {
            const done    = i < currentStep;
            const active  = i === currentStep;
            const future  = i > currentStep;
            return (
              <View key={step.key} style={s.stepRow}>
                <View style={s.stepLeft}>
                  {i > 0 && (
                    <View style={[s.connector, done && s.connectorDone]} />
                  )}
                  <View style={[
                    s.circle,
                    done   && s.circleDone,
                    active && s.circleActive,
                    future && s.circleFuture,
                  ]}>
                    {done
                      ? <Ionicons name="checkmark" size={16} color="#fff" />
                      : <Text style={s.circleIcon}>{step.icon}</Text>
                    }
                  </View>
                </View>
                <View style={s.stepRight}>
                  <Text style={[s.stepLabel, active && s.stepLabelActive, future && s.stepLabelFuture]}>
                    {step.label}
                  </Text>
                  <Text style={[s.stepSub, future && s.stepSubFuture]}>{step.sub}</Text>
                  {active && (
                    <View style={s.inProgressBadge}>
                      <View style={s.inProgressDot} />
                      <Text style={s.inProgressTxt}>In progress</Text>
                    </View>
                  )}
                </View>
              </View>
            );
          })}
        </View>

        {/* Shop Info — show while heading to shop */}
        {currentStep === 0 && (
          <View style={s.infoCard}>
            <View style={s.infoHeader}>
              <Text style={s.infoEmoji}>🏪</Text>
              <View style={{ flex: 1 }}>
                <Text style={s.infoTitle}>Pickup from</Text>
                <Text style={s.infoName}>{shopName}</Text>
              </View>
              <TouchableOpacity
                style={s.navBtn}
                onPress={() => openMaps(shopName)}
              >
                <Ionicons name="navigate" size={18} color="#22C55E" />
                <Text style={s.navTxt}>Navigate</Text>
              </TouchableOpacity>
            </View>

            {/* Items */}
            {order?.items && order.items.length > 0 && (
              <View style={s.itemsSection}>
                <Text style={s.itemsTitle}>Items to collect</Text>
                {order.items.map((item: any, i: number) => (
                  <View key={i} style={s.itemRow}>
                    <View style={s.itemBullet} />
                    <Text style={s.itemTxt}>
                      {item.product_name}
                      {item.product_unit ? ` (${item.product_unit})` : ''}
                    </Text>
                    <Text style={s.itemQty}>×{item.quantity}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {/* Delivery Address — show once picked up */}
        {currentStep === 1 && (
          <View style={s.infoCard}>
            <View style={s.infoHeader}>
              <Text style={s.infoEmoji}>📍</Text>
              <View style={{ flex: 1 }}>
                <Text style={s.infoTitle}>Deliver to</Text>
                <Text style={s.infoName}>{deliveryAddr}</Text>
              </View>
              <TouchableOpacity
                style={s.navBtn}
                onPress={() => openMaps(deliveryAddr)}
              >
                <Ionicons name="navigate" size={18} color="#22C55E" />
                <Text style={s.navTxt}>Navigate</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* OTP Entry — show once picked up */}
        {currentStep === 1 && (
          <View style={s.otpCard}>
            <Text style={s.otpTitle}>🔐 Enter Delivery OTP</Text>
            <Text style={s.otpSub}>Ask the customer for the 4-digit OTP shown in their app</Text>
            <View style={s.otpInputRow}>
              <TextInput
                style={[s.otpInput, otpError ? s.otpInputError : null]}
                placeholder="• • • •"
                placeholderTextColor="#333"
                keyboardType="number-pad"
                maxLength={4}
                value={otp}
                onChangeText={v => { setOtp(v); setOtpError(''); }}
                textAlign="center"
              />
            </View>
            {otpError ? <Text style={s.otpError}>{otpError}</Text> : null}
            <TouchableOpacity
              style={s.deliverBtn}
              onPress={handleDeliver}
              disabled={loading || otp.length !== 4}
            >
              <LinearGradient
                colors={otp.length === 4 ? ['#16A34A', '#15803D'] : ['#1A1A1A', '#222']}
                style={s.deliverBtnGrad}
              >
                {loading
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={s.deliverBtnTxt}>Confirm Delivery ✓</Text>
                }
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}

        {/* Pickup CTA */}
        {currentStep === 0 && (
          <TouchableOpacity style={s.pickupBtn} onPress={handlePickup} disabled={loading}>
            <LinearGradient colors={['#16A34A', '#15803D']} style={s.pickupBtnGrad}>
              {loading
                ? <ActivityIndicator color="#fff" />
                : <>
                    <Ionicons name="checkmark-circle-outline" size={22} color="#fff" />
                    <Text style={s.pickupBtnTxt}>I've Picked Up the Order</Text>
                  </>
              }
            </LinearGradient>
          </TouchableOpacity>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </LinearGradient>
  );
}

const s = StyleSheet.create({
  root:           { flex: 1 },
  header:         { paddingTop: Platform.OS === 'ios' ? 56 : 36, paddingBottom: 18,
                     paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', gap: 14 },
  backBtn:        { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.15)',
                     alignItems: 'center', justifyContent: 'center' },
  headerTitle:    { fontSize: 18, fontWeight: '800', color: '#fff' },
  headerSub:      { fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 1 },
  earningBadge:   { backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, alignItems: 'center' },
  earningTxt:     { fontSize: 18, fontWeight: '800', color: '#fff' },
  earningLbl:     { fontSize: 10, color: 'rgba(255,255,255,0.6)', marginTop: 1 },

  scroll:         { padding: 16, gap: 14 },

  stepsCard:      { backgroundColor: '#161616', borderRadius: 20, padding: 20, borderWidth: 1, borderColor: '#222' },
  stepRow:        { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
  stepLeft:       { alignItems: 'center', width: 44 },
  connector:      { width: 2, height: 20, backgroundColor: '#2A2A2A', marginBottom: 4 },
  connectorDone:  { backgroundColor: '#16A34A' },
  circle:         { width: 44, height: 44, borderRadius: 22, borderWidth: 2, borderColor: '#2A2A2A',
                     backgroundColor: '#111', alignItems: 'center', justifyContent: 'center' },
  circleDone:     { backgroundColor: '#16A34A', borderColor: '#16A34A' },
  circleActive:   { borderColor: '#22C55E', backgroundColor: '#052e16', borderWidth: 2 },
  circleFuture:   { opacity: 0.35 },
  circleIcon:     { fontSize: 20 },
  stepRight:      { flex: 1, paddingBottom: 20, paddingTop: 4 },
  stepLabel:      { fontSize: 15, fontWeight: '700', color: '#fff', marginBottom: 2 },
  stepLabelActive:{ color: '#22C55E' },
  stepLabelFuture:{ color: '#444' },
  stepSub:        { fontSize: 12, color: '#555' },
  stepSubFuture:  { color: '#333' },
  inProgressBadge:{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6,
                     alignSelf: 'flex-start', backgroundColor: '#052e16', borderRadius: 99,
                     paddingHorizontal: 10, paddingVertical: 4 },
  inProgressDot:  { width: 6, height: 6, borderRadius: 3, backgroundColor: '#22C55E' },
  inProgressTxt:  { fontSize: 11, fontWeight: '700', color: '#22C55E' },

  infoCard:       { backgroundColor: '#161616', borderRadius: 18, padding: 16, borderWidth: 1, borderColor: '#222' },
  infoHeader:     { flexDirection: 'row', alignItems: 'center', gap: 12 },
  infoEmoji:      { fontSize: 28 },
  infoTitle:      { fontSize: 11, color: '#555', fontWeight: '600', textTransform: 'uppercase', marginBottom: 2 },
  infoName:       { fontSize: 16, fontWeight: '700', color: '#fff' },
  navBtn:         { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#052e16',
                     borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: '#16A34A' },
  navTxt:         { fontSize: 13, fontWeight: '700', color: '#22C55E' },
  itemsSection:   { marginTop: 14, borderTopWidth: 1, borderTopColor: '#222', paddingTop: 12 },
  itemsTitle:     { fontSize: 12, fontWeight: '700', color: '#555', textTransform: 'uppercase', marginBottom: 8 },
  itemRow:        { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  itemBullet:     { width: 6, height: 6, borderRadius: 3, backgroundColor: '#22C55E' },
  itemTxt:        { flex: 1, fontSize: 14, color: '#ccc' },
  itemQty:        { fontSize: 13, fontWeight: '700', color: '#666' },

  otpCard:        { backgroundColor: '#161616', borderRadius: 18, padding: 18, borderWidth: 1, borderColor: '#222' },
  otpTitle:       { fontSize: 17, fontWeight: '800', color: '#fff', marginBottom: 4 },
  otpSub:         { fontSize: 13, color: '#666', marginBottom: 16, lineHeight: 18 },
  otpInputRow:    { marginBottom: 8 },
  otpInput:       { backgroundColor: '#111', borderRadius: 16, borderWidth: 2, borderColor: '#333',
                     paddingVertical: 18, fontSize: 32, fontWeight: '800', color: '#fff',
                     letterSpacing: 16 },
  otpInputError:  { borderColor: '#EF4444' },
  otpError:       { fontSize: 13, color: '#EF4444', marginBottom: 12 },
  deliverBtn:     { borderRadius: 16, overflow: 'hidden', marginTop: 4 },
  deliverBtnGrad: { paddingVertical: 16, alignItems: 'center', justifyContent: 'center' },
  deliverBtnTxt:  { color: '#fff', fontSize: 15, fontWeight: '800' },

  pickupBtn:      { borderRadius: 18, overflow: 'hidden' },
  pickupBtnGrad:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                     gap: 10, paddingVertical: 18 },
  pickupBtnTxt:   { color: '#fff', fontSize: 16, fontWeight: '800' },

  deliveredWrap:  { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 14 },
  deliveredEmoji: { fontSize: 72 },
  deliveredTitle: { fontSize: 28, fontWeight: '800', color: '#fff' },
  deliveredSub:   { fontSize: 15, color: '#555', textAlign: 'center', lineHeight: 22 },
  doneBtn:        { marginTop: 8, borderRadius: 16, overflow: 'hidden', width: '100%' },
  doneBtnGrad:    { paddingVertical: 16, alignItems: 'center' },
  doneBtnTxt:     { color: '#fff', fontSize: 16, fontWeight: '800' },
});
