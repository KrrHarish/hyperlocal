import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Platform,
  ScrollView, ActivityIndicator, Vibration, Alert, RefreshControl,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { Audio } from 'expo-av';
import { useAuth } from '../store/AuthContext';
import {
  toggleOnline, updateLocation, getActiveOrder,
  getEarnings, acceptOrder, rejectOrder,
} from '../api/client';
import { WS_URL } from '../api/client';

// Show notifications even when app is foregrounded
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const OFFER_TIMEOUT_SEC = 30;

interface IncomingOrder {
  orderId: string;
  shopId: string;
  shopName?: string;
  total: number;
  deliveryFee: number;
  preview: string;
  distanceKm?: number;
}

export default function HomeScreen({ navigation }: any) {
  const { rider, updateRider, logout } = useAuth();
  const [isOnline,      setIsOnline]      = useState(rider?.is_online ?? false);
  const [toggling,      setToggling]      = useState(false);
  const [earnings,      setEarnings]      = useState<any>(null);
  const [activeOrder,   setActiveOrder]   = useState<any>(null);
  const [incomingOrder, setIncomingOrder] = useState<IncomingOrder | null>(null);
  const [accepting,     setAccepting]     = useState(false);
  const [rejecting,     setRejecting]     = useState(false);
  const [refreshing,    setRefreshing]    = useState(false);
  const [countdown,     setCountdown]     = useState(OFFER_TIMEOUT_SEC);

  const locationRef   = useRef<any>(null);
  const mountedRef    = useRef(true);
  const countdownRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const incomingRef   = useRef<IncomingOrder | null>(null); // stable ref for timer callback

  // Keep ref in sync
  useEffect(() => { incomingRef.current = incomingOrder; }, [incomingOrder]);

  const playChime = useCallback(async () => {
    try {
      await Audio.setAudioModeAsync({ playsInSilentModeIOS: true, staysActiveInBackground: true });
      // Play the 4-note chime twice for urgency
      for (let i = 0; i < 2; i++) {
        if (i > 0) await new Promise<void>(r => setTimeout(r, 400));
        const { sound } = await Audio.Sound.createAsync(
          require('../../assets/new_order.wav'),
          { shouldPlay: true, volume: 1.0 }
        );
        sound.setOnPlaybackStatusUpdate(status => {
          if (status.isLoaded && status.didJustFinish) sound.unloadAsync().catch(() => {});
        });
      }
    } catch {}
  }, []);

  const fireOrderNotification = useCallback((offer: IncomingOrder) => {
    Notifications.scheduleNotificationAsync({
      content: {
        title: '🛵 New Delivery Order!',
        body: `${offer.shopName || 'Nearby Shop'} · ₹${offer.deliveryFee.toFixed(0)} delivery fee · ${offer.distanceKm?.toFixed(1) ?? '?'} km away`,
        sound: true,
        priority: Notifications.AndroidNotificationPriority.MAX,
        vibrate: [0, 400, 200, 400],
        data: { orderId: offer.orderId },
      },
      trigger: null, // fire immediately
    }).catch(() => {});
  }, []);

  const clearCountdown = useCallback(() => {
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
  }, []);

  const startCountdown = useCallback((orderId: string) => {
    clearCountdown();
    setCountdown(OFFER_TIMEOUT_SEC);

    countdownRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearCountdown();
          // Auto-reject when timer expires
          if (incomingRef.current?.orderId === orderId) {
            rejectOrder(orderId).catch(() => {});
            if (mountedRef.current) setIncomingOrder(null);
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [clearCountdown]);

  // ── Fetch earnings + active order ─────────────────────────
  const refresh = useCallback(async () => {
    try {
      const [earRes, activeRes] = await Promise.all([getEarnings(), getActiveOrder()]);
      if (mountedRef.current) {
        setEarnings(earRes.data.earnings);
        setActiveOrder(activeRes.data.order);
        if (activeRes.data.order && ['assigned', 'picked_up'].includes(activeRes.data.order.status)) {
          navigation.navigate('ActiveDelivery', { order: activeRes.data.order });
        }
      }
    } catch {}
  }, [navigation]);

  useEffect(() => {
    mountedRef.current = true;
    refresh();
    // Request notification permission
    Notifications.requestPermissionsAsync();
    return () => {
      mountedRef.current = false;
      clearCountdown();
    };
  }, [refresh, clearCountdown]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }, [refresh]);

  // ── WebSocket ──────────────────────────────────────────────
  useEffect(() => {
    if (!rider) return;
    let ws: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let destroyed = false;

    const connect = () => {
      if (destroyed) return;
      ws = new WebSocket(WS_URL);

      ws.onmessage = (e) => {
        try {
          const event = JSON.parse(e.data);

          // ── Order offered to THIS rider ──
          if (event.type === 'order_offered' && event.riderId === rider.id) {
            playChime();
            Vibration.vibrate([0, 400, 200, 400, 200, 400]);

            const offer: IncomingOrder = {
              orderId:     event.orderId,
              shopId:      event.shopId,
              shopName:    event.shopName,
              total:       parseFloat(event.total ?? '0'),
              deliveryFee: parseFloat(event.deliveryFee ?? '0'),
              preview:     event.preview ?? '',
              distanceKm:  event.distanceKm,
            };

            // Fire local notification so sound plays in background too
            fireOrderNotification(offer);

            if (mountedRef.current) {
              setIncomingOrder(offer);
              startCountdown(event.orderId);
            }
          }

          // ── Rider accepted → navigate to delivery ──
          if (event.type === 'order_assigned' && event.riderId === rider.id) {
            clearCountdown();
            if (mountedRef.current) setIncomingOrder(null);
            getActiveOrder().then(res => {
              const o = res.data.order;
              if (o && mountedRef.current) {
                setActiveOrder(o);
                navigation.navigate('ActiveDelivery', { order: o });
              }
            }).catch(() => {});
          }

          // ── Generic order update ──
          if (event.type === 'order_updated' && activeOrder?.id === event.orderId) {
            refresh();
          }
        } catch {}
      };

      ws.onclose = () => { if (!destroyed) reconnectTimer = setTimeout(connect, 2000); };
      ws.onerror = () => ws?.close();
    };

    connect();
    return () => {
      destroyed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      ws?.close();
    };
  }, [rider, activeOrder, refresh, playChime, fireOrderNotification, startCountdown, clearCountdown, navigation]);

  // ── Location tracking while online ────────────────────────
  useEffect(() => {
    if (!isOnline) {
      locationRef.current?.remove?.();
      locationRef.current = null;
      return;
    }

    let sub: any = null;
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;

      sub = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, timeInterval: 15000, distanceInterval: 50 },
        (loc) => {
          updateLocation(loc.coords.latitude, loc.coords.longitude).catch(() => {});
        }
      );
      locationRef.current = sub;
    })();

    return () => { sub?.remove?.(); };
  }, [isOnline]);

  // ── Toggle online / offline ────────────────────────────────
  const handleToggle = async () => {
    setToggling(true);
    try {
      if (!isOnline) {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Location required', 'Please enable location access to go online.');
          setToggling(false);
          return;
        }
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        await toggleOnline(true, loc.coords.latitude, loc.coords.longitude);
        setIsOnline(true);
        updateRider({ is_online: true });
      } else {
        await toggleOnline(false);
        setIsOnline(false);
        setIncomingOrder(null);
        clearCountdown();
        updateRider({ is_online: false });
      }
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.error || 'Failed to update status');
    } finally {
      setToggling(false);
    }
  };

  // ── Accept ─────────────────────────────────────────────────
  const handleAccept = async () => {
    if (!incomingOrder) return;
    setAccepting(true);
    clearCountdown();
    try {
      // Accept returns the assigned order directly
      const res = await acceptOrder(incomingOrder.orderId);
      const order = res.data.order;
      if (mountedRef.current) {
        setIncomingOrder(null);
        setActiveOrder(order);
        navigation.navigate('ActiveDelivery', { order });
      }
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.error || 'Could not accept order');
    } finally {
      if (mountedRef.current) setAccepting(false);
    }
  };

  // ── Reject ─────────────────────────────────────────────────
  const handleReject = async () => {
    if (!incomingOrder) return;
    setRejecting(true);
    clearCountdown();
    try {
      await rejectOrder(incomingOrder.orderId);
    } catch {}
    if (mountedRef.current) {
      setIncomingOrder(null);
      setRejecting(false);
    }
  };

  const fmt = (n: number | string) =>
    `₹${parseFloat(String(n || 0)).toFixed(0)}`;

  const countdownColor = countdown <= 10 ? '#EF4444' : countdown <= 20 ? '#F59E0B' : '#4ade80';

  return (
    <LinearGradient colors={['#0A0A0A', '#0F1117']} style={s.root}>
      {/* Header */}
      <View style={s.header}>
        <View>
          <Text style={s.greeting}>Hey, {rider?.name?.split(' ')[0] ?? 'Rider'} 👋</Text>
          <View style={s.statusRow}>
            <View style={[s.statusDot, { backgroundColor: isOnline ? '#22C55E' : '#444' }]} />
            <Text style={[s.statusTxt, { color: isOnline ? '#22C55E' : '#555' }]}>
              {isOnline ? 'Online — accepting orders' : 'Offline'}
            </Text>
          </View>
        </View>
        <TouchableOpacity onPress={logout} style={s.logoutBtn}>
          <Ionicons name="log-out-outline" size={22} color="#444" />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#22C55E" />}
      >

        {/* Big Online Toggle */}
        <View style={s.toggleSection}>
          <TouchableOpacity onPress={handleToggle} disabled={toggling} activeOpacity={0.85}>
            <LinearGradient
              colors={isOnline ? ['#15803D', '#166534'] : ['#1A1A1A', '#222']}
              style={[s.toggleBtn, isOnline && s.toggleBtnOnline]}
            >
              {toggling ? (
                <ActivityIndicator color="#fff" size="large" />
              ) : (
                <>
                  <View style={[s.toggleInner, isOnline && s.toggleInnerOnline]}>
                    <Text style={s.toggleIcon}>{isOnline ? '🟢' : '⚫'}</Text>
                  </View>
                  <Text style={s.toggleLabel}>{isOnline ? 'GO OFFLINE' : 'GO ONLINE'}</Text>
                  <Text style={s.toggleSub}>
                    {isOnline ? 'Tap to stop receiving orders' : 'Tap to start receiving orders'}
                  </Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* ── Incoming Order Offer ── */}
        {incomingOrder && (
          <View style={s.incomingCard}>
            <LinearGradient colors={['#14532D', '#166534']} style={s.incomingGrad}>

              {/* Header row with countdown */}
              <View style={s.incomingHeader}>
                <View style={s.pulseDot} />
                <Text style={s.incomingTitle}>New Order!</Text>
                <View style={[s.countdownBadge, { borderColor: countdownColor }]}>
                  <Text style={[s.countdownTxt, { color: countdownColor }]}>{countdown}s</Text>
                </View>
              </View>

              {/* Delivery fee highlight */}
              <View style={s.feeRow}>
                <Ionicons name="cash-outline" size={16} color="#4ade80" />
                <Text style={s.feeTxt}>Delivery Fee: {fmt(incomingOrder.deliveryFee)}</Text>
                {incomingOrder.distanceKm != null && (
                  <Text style={s.distTxt}> · {incomingOrder.distanceKm.toFixed(1)} km away</Text>
                )}
              </View>

              {/* Order details */}
              <View style={s.incomingBody}>
                <View style={s.incomingRow}>
                  <Ionicons name="storefront-outline" size={16} color="#86efac" />
                  <Text style={s.incomingShop}>{incomingOrder.shopName || 'Nearby Shop'}</Text>
                </View>
                <View style={s.incomingRow}>
                  <Ionicons name="receipt-outline" size={14} color="#86efac" />
                  <Text style={s.incomingPreview} numberOfLines={1}>{incomingOrder.preview}</Text>
                </View>
                <Text style={s.incomingTotal}>Order Total: {fmt(incomingOrder.total)}</Text>
              </View>

              {/* Actions */}
              <View style={s.incomingActions}>
                <TouchableOpacity
                  style={s.declineBtn}
                  onPress={handleReject}
                  disabled={rejecting || accepting}
                >
                  {rejecting
                    ? <ActivityIndicator color="#aaa" size="small" />
                    : <Text style={s.declineTxt}>✕  Skip</Text>
                  }
                </TouchableOpacity>
                <TouchableOpacity
                  style={s.acceptBtn}
                  onPress={handleAccept}
                  disabled={accepting || rejecting}
                >
                  {accepting
                    ? <ActivityIndicator color="#fff" size="small" />
                    : <Text style={s.acceptTxt}>Accept →</Text>
                  }
                </TouchableOpacity>
              </View>

            </LinearGradient>
          </View>
        )}

        {/* Active Order Banner */}
        {activeOrder && !incomingOrder && (
          <TouchableOpacity
            style={s.activeOrderBanner}
            onPress={() => navigation.navigate('ActiveDelivery', { order: activeOrder })}
          >
            <LinearGradient colors={['#1e3a5f', '#1e40af']} style={s.activeOrderGrad}>
              <Ionicons name="bicycle-outline" size={24} color="#93c5fd" />
              <View style={{ flex: 1 }}>
                <Text style={s.activeOrderTitle}>Active Delivery in Progress</Text>
                <Text style={s.activeOrderSub}>
                  {activeOrder.status === 'picked_up' ? '📦 Heading to customer' : '🏪 Heading to shop'}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#93c5fd" />
            </LinearGradient>
          </TouchableOpacity>
        )}

        {/* Today's Stats */}
        <View style={s.statsGrid}>
          <View style={s.statCard}>
            <Text style={s.statIcon}>💰</Text>
            <Text style={s.statValue}>{fmt(earnings?.total_earned ?? 0)}</Text>
            <Text style={s.statLabel}>Total Earned</Text>
          </View>
          <View style={s.statCard}>
            <Text style={s.statIcon}>📦</Text>
            <Text style={s.statValue}>{earnings?.total_deliveries ?? 0}</Text>
            <Text style={s.statLabel}>Deliveries</Text>
          </View>
          <View style={s.statCard}>
            <Text style={s.statIcon}>⭐</Text>
            <Text style={s.statValue}>{rider?.trust_score ?? 70}</Text>
            <Text style={s.statLabel}>Trust Score</Text>
          </View>
        </View>

        {/* Tips / waiting state */}
        {!isOnline && (
          <View style={s.tipCard}>
            <Ionicons name="bulb-outline" size={18} color="#FBBF24" />
            <Text style={s.tipTxt}>Go online to start receiving delivery requests in your area.</Text>
          </View>
        )}
        {isOnline && !incomingOrder && !activeOrder && (
          <View style={s.waitCard}>
            <Text style={s.waitEmoji}>🛵</Text>
            <Text style={s.waitTitle}>Waiting for orders…</Text>
            <Text style={s.waitSub}>You'll be notified instantly when an order is nearby</Text>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </LinearGradient>
  );
}

const s = StyleSheet.create({
  root:         { flex: 1 },
  header:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
                   paddingTop: Platform.OS === 'ios' ? 60 : 40, paddingHorizontal: 20, paddingBottom: 12 },
  greeting:     { fontSize: 22, fontWeight: '800', color: '#fff' },
  statusRow:    { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  statusDot:    { width: 8, height: 8, borderRadius: 4 },
  statusTxt:    { fontSize: 13, fontWeight: '600' },
  logoutBtn:    { padding: 8 },

  scroll:       { paddingHorizontal: 20, paddingTop: 10 },

  toggleSection:{ marginBottom: 20 },
  toggleBtn:    { borderRadius: 24, padding: 32, alignItems: 'center', gap: 10,
                   borderWidth: 1.5, borderColor: '#2A2A2A' },
  toggleBtnOnline: { borderColor: '#166534' },
  toggleInner:  { width: 72, height: 72, borderRadius: 36, backgroundColor: '#222',
                   alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  toggleInnerOnline: { backgroundColor: '#052e16' },
  toggleIcon:   { fontSize: 36 },
  toggleLabel:  { fontSize: 22, fontWeight: '900', color: '#fff', letterSpacing: 1 },
  toggleSub:    { fontSize: 13, color: '#666', textAlign: 'center' },

  // Incoming order card
  incomingCard: { marginBottom: 16, borderRadius: 20, overflow: 'hidden' },
  incomingGrad: { padding: 18, borderRadius: 20 },
  incomingHeader:{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  pulseDot:     { width: 10, height: 10, borderRadius: 5, backgroundColor: '#4ade80' },
  incomingTitle:{ fontSize: 18, fontWeight: '800', color: '#fff', flex: 1 },
  countdownBadge:{ borderWidth: 2, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 },
  countdownTxt: { fontSize: 14, fontWeight: '800' },
  feeRow:       { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10,
                   backgroundColor: 'rgba(0,0,0,0.25)', borderRadius: 10, padding: 10 },
  feeTxt:       { fontSize: 15, fontWeight: '800', color: '#4ade80' },
  distTxt:      { fontSize: 13, color: '#86efac' },
  incomingBody: { backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: 12, padding: 12, marginBottom: 14, gap: 6 },
  incomingRow:  { flexDirection: 'row', alignItems: 'center', gap: 8 },
  incomingShop: { fontSize: 15, fontWeight: '700', color: '#fff' },
  incomingPreview:{ fontSize: 13, color: '#86efac', flex: 1 },
  incomingTotal:{ fontSize: 14, fontWeight: '700', color: '#fff', marginTop: 4 },
  incomingActions:{ flexDirection: 'row', gap: 10 },
  declineBtn:   { flex: 1, paddingVertical: 14, borderRadius: 14, backgroundColor: 'rgba(0,0,0,0.35)',
                   alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  declineTxt:   { color: '#aaa', fontWeight: '700', fontSize: 14 },
  acceptBtn:    { flex: 2, paddingVertical: 14, borderRadius: 14, backgroundColor: '#16A34A',
                   alignItems: 'center' },
  acceptTxt:    { color: '#fff', fontWeight: '800', fontSize: 16 },

  activeOrderBanner:{ marginBottom: 16, borderRadius: 16, overflow: 'hidden' },
  activeOrderGrad:{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: 16 },
  activeOrderTitle:{ fontSize: 15, fontWeight: '700', color: '#fff' },
  activeOrderSub:{ fontSize: 12, color: '#93c5fd', marginTop: 2 },

  statsGrid:    { flexDirection: 'row', gap: 10, marginBottom: 20 },
  statCard:     { flex: 1, backgroundColor: '#161616', borderRadius: 16, padding: 14,
                   alignItems: 'center', gap: 4, borderWidth: 1, borderColor: '#222' },
  statIcon:     { fontSize: 22 },
  statValue:    { fontSize: 18, fontWeight: '800', color: '#fff' },
  statLabel:    { fontSize: 11, color: '#555', fontWeight: '600' },

  tipCard:      { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#1C1800',
                   borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#3D2E00' },
  tipTxt:       { fontSize: 13, color: '#FBBF24', flex: 1, lineHeight: 18 },

  waitCard:     { alignItems: 'center', paddingVertical: 32, gap: 8 },
  waitEmoji:    { fontSize: 52 },
  waitTitle:    { fontSize: 18, fontWeight: '700', color: '#fff' },
  waitSub:      { fontSize: 13, color: '#555', textAlign: 'center', lineHeight: 20 },
});
