import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl, Platform, Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { getMyOrders } from '../services/api';

const WS_URL = Platform.OS === 'android'
  ? 'ws://10.0.2.2:3000/ws'
  : 'ws://localhost:3000/ws';

const ACTIVE_STATUSES = ['pending','confirmed','assigned','picked_up','out_for_delivery','processing'];
const PAST_STATUSES   = ['delivered','cancelled','rejected','failed'];

const STATUS_CONFIG: any = {
  pending:          { bg:'#FFFBEB', txt:'#92400E', border:'#FDE68A', icon:'time-outline',            label:'Waiting for shop'  },
  confirmed:        { bg:'#EFF6FF', txt:'#1D4ED8', border:'#BFDBFE', icon:'storefront-outline',      label:'Shop confirmed'    },
  assigned:         { bg:'#FFF4E6', txt:'#C05621', border:'#FED7AA', icon:'person-outline',           label:'Rider assigned'    },
  picked_up:        { bg:'#FFF4E6', txt:'#C05621', border:'#FED7AA', icon:'bicycle-outline',          label:'On the way'        },
  out_for_delivery: { bg:'#FFF4E6', txt:'#C05621', border:'#FED7AA', icon:'navigate-outline',         label:'Out for delivery'  },
  processing:       { bg:'#F5F3FF', txt:'#5B21B6', border:'#DDD6FE', icon:'refresh-outline',          label:'Processing'        },
  delivered:        { bg:'#DCFCE7', txt:'#15803D', border:'#BBF7D0', icon:'checkmark-circle-outline', label:'Delivered'         },
  cancelled:        { bg:'#FEE2E2', txt:'#B91C1C', border:'#FECACA', icon:'close-circle-outline',     label:'Cancelled'         },
  rejected:         { bg:'#FEE2E2', txt:'#B91C1C', border:'#FECACA', icon:'close-circle-outline',     label:'Rejected'          },
};

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 2)  return 'Just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    const diffHrs = Math.floor(diffMins / 60);
    if (diffHrs < 24)  return `${diffHrs}h ago`;
    const diffDays = Math.floor(diffHrs / 24);
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7)  return `${diffDays} days ago`;
    return d.toLocaleDateString('en-IN', { day:'numeric', month:'short' });
  } catch { return iso; }
}

export default function OrdersScreen({ navigation }: any) {
  const [allOrders, setAllOrders]       = useState<any[]>([]);
  const [loading, setLoading]           = useState(true);
  const [refreshing, setRefreshing]     = useState(false);
  const [tab, setTab]                   = useState<'active'|'past'>('active');
  const [cancelledAlert, setCancelledAlert] = useState<any | null>(null);
  const slideAnim    = useRef(new Animated.Value(-100)).current;
  const mountedRef   = useRef(true);
  const prevStatuses = useRef<Record<string, string>>({});
  const isFirstFetch = useRef(true);

  const fetchOrders = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const res = await getMyOrders();
      const list: any[] = res.data?.orders || res.data?.data || res.data || [];
      if (Array.isArray(list)) {
        // Detect orders that just got cancelled
        if (!isFirstFetch.current) {
          const justCancelled = list.find(
            o => o.status === 'cancelled' && prevStatuses.current[o.id] &&
                 prevStatuses.current[o.id] !== 'cancelled'
          );
          if (justCancelled) setCancelledAlert(justCancelled);
        }
        isFirstFetch.current = false;
        const newStatuses: Record<string, string> = {};
        list.forEach(o => { newStatuses[o.id] = o.status; });
        prevStatuses.current = newStatuses;
        setAllOrders(list);
      }
    } catch {
      setAllOrders([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Initial fetch + real-time WebSocket (replaces 10s polling)
  useEffect(() => {
    mountedRef.current = true;
    fetchOrders();

    let ws: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      if (!mountedRef.current) return;
      ws = new WebSocket(WS_URL);
      ws.onmessage = (e) => {
        try {
          const event = JSON.parse(e.data);
          if (event.type === 'order_created' || event.type === 'order_updated') {
            fetchOrders();
          }
        } catch {}
      };
      ws.onclose = () => {
        if (mountedRef.current) reconnectTimer = setTimeout(connect, 2000);
      };
      ws.onerror = () => ws?.close();
    };

    connect();
    return () => {
      mountedRef.current = false;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      ws?.close();
    };
  }, [fetchOrders]);

  // Refetch immediately whenever the tab comes into focus
  useFocusEffect(useCallback(() => { fetchOrders(); }, [fetchOrders]));

  // Animate cancellation banner in/out
  useEffect(() => {
    if (cancelledAlert) {
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 100, friction: 12 }).start();
      const t = setTimeout(() => {
        Animated.timing(slideAnim, { toValue: -100, duration: 250, useNativeDriver: true }).start(() => setCancelledAlert(null));
      }, 5000);
      return () => clearTimeout(t);
    } else {
      slideAnim.setValue(-100);
    }
  }, [cancelledAlert]);

  // Auto switch to active tab if active orders exist
  useEffect(() => {
    if (allOrders.some(o => ACTIVE_STATUSES.includes(o.status))) setTab('active');
  }, [allOrders]);

  // Sort by last updated (status change), falling back to created_at
  const byNewest = (a: any, b: any) =>
    new Date(b.updated_at || b.created_at || 0).getTime() -
    new Date(a.updated_at || a.created_at || 0).getTime();

  const active = allOrders.filter(o => ACTIVE_STATUSES.includes(o.status)).sort(byNewest);
  const past   = allOrders.filter(o => PAST_STATUSES.includes(o.status)).sort(byNewest);
  const shown  = tab === 'active' ? active : past;

  const getStatus = (status: string) =>
    STATUS_CONFIG[status] || { bg:'#F3F4F6', txt:'#374151', border:'#E5E7EB', icon:'ellipse-outline', label:status };

  // // Navigate to OrderTracking within OrdersStack
  // const goToTracking = (orderId: string) => {
  //   navigation.navigate('OrderTracking', { orderId, status: order.status, orderData: order });
  // };

  return (
    <View style={s.root}>

      {/* Cancellation notification */}
      <Animated.View style={{
        position: 'absolute',
        top: 0, left: 0, right: 0,
        zIndex: 999,
        transform: [{ translateY: slideAnim }],
        elevation: 10,
      }}>
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => {
            setCancelledAlert(null);
            navigation.navigate('OrderTracking', {
              orderId: cancelledAlert?.id,
              status: 'cancelled',
              orderData: cancelledAlert,
            });
          }}
          style={{
            backgroundColor: '#B91C1C',
            paddingTop: Platform.OS === 'ios' ? 52 : 14,
            paddingBottom: 14,
            paddingHorizontal: 16,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <Ionicons name="close-circle" size={28} color="rgba(255,255,255,0.9)" />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 14, fontWeight: '700', color: '#fff' }}>
              Order Cancelled by Shop
            </Text>
            {cancelledAlert?.cancellation_reason ? (
              <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)', marginTop: 2 }} numberOfLines={1}>
                {cancelledAlert.cancellation_reason}
              </Text>
            ) : null}
          </View>
          <TouchableOpacity
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            onPress={() => setCancelledAlert(null)}
          >
            <Ionicons name="close" size={20} color="rgba(255,255,255,0.7)" />
          </TouchableOpacity>
        </TouchableOpacity>
      </Animated.View>

      {/* Header */}
      <LinearGradient colors={['#FF8A00','#FF5C00']} style={s.header}>
        <View style={s.hTop}>
          <Text style={s.title}>My Orders</Text>
          <View style={s.liveBadge}>
            <View style={s.liveDot} />
            <Text style={s.liveTxt}>Live</Text>
          </View>
        </View>
        <View style={s.tabWrap}>
          <TouchableOpacity
            style={[s.tab, tab==='active' && s.tabActive]}
            onPress={() => setTab('active')}
          >
            <Text style={[s.tabTxt, tab==='active' && s.tabTxtActive]}>
              Active{active.length > 0 ? ` (${active.length})` : ''}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.tab, tab==='past' && s.tabActive]}
            onPress={() => setTab('past')}
          >
            <Text style={[s.tabTxt, tab==='past' && s.tabTxtActive]}>
              Past{past.length > 0 ? ` (${past.length})` : ''}
            </Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator size="large" color="#FF8A00" />
          <Text style={s.loadTxt}>Loading orders…</Text>
        </View>
      ) : shown.length === 0 ? (
        <View style={s.empty}>
          <Text style={{ fontSize:52 }}>{tab==='active' ? '🛵' : '📦'}</Text>
          <Text style={s.emptyT}>{tab==='active' ? 'No active orders' : 'No past orders'}</Text>
          <Text style={s.emptySub}>
            {tab==='active'
              ? 'Place an order and track it here in real time'
              : 'Your completed orders will appear here'}
          </Text>
          {tab==='active' && (
            <TouchableOpacity onPress={() => navigation.navigate('HomeTab')} style={{ marginTop:8 }}>
              <LinearGradient colors={['#FF8A00','#FF5C00']} style={s.browseBtn}
                start={{ x:0,y:0 }} end={{ x:1,y:0 }}>
                <Text style={s.browseTxt}>Browse Shops</Text>
              </LinearGradient>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ padding:16, gap:12 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => fetchOrders(true)} tintColor="#FF8A00" />
          }
        >
          {tab==='active' && active.length > 0 && (
            <View style={s.hintCard}>
              <View style={{ width:7, height:7, borderRadius:3.5, backgroundColor:'#22C55E' }} />
              <Text style={s.hintTxt}>Live — order status updates in real time</Text>
            </View>
          )}

          {shown.map(order => {
            const st = getStatus(order.status);
            const isActiveOrder = ACTIVE_STATUSES.includes(order.status);
            return (
              <TouchableOpacity
                key={order.id}
                style={s.card}
                activeOpacity={0.88}
                onPress={() => navigation.navigate('OrderTracking', { orderId: order.id, status: order.status, orderData: order })}
              >
                {/* Orange bar for active orders */}
                {isActiveOrder && (
                  <LinearGradient colors={['#FF8A00','#FF5C00']} style={s.activeBar}
                    start={{ x:0,y:0 }} end={{ x:1,y:0 }} />
                )}

                {/* Shop info */}
                <View style={s.cardTop}>
                  <View style={s.shopIcon}>
                    <Text style={{ fontSize:20 }}>🏪</Text>
                  </View>
                  <View style={{ flex:1 }}>
                    <Text style={s.shopName}>{order.shop_name}</Text>
                    <Text style={s.orderDate}>{formatDate(order.created_at || order.date)}</Text>
                  </View>
                  <View style={[s.statusBadge, { backgroundColor:st.bg, borderColor:st.border }]}>
                    <Ionicons name={st.icon as any} size={12} color={st.txt} />
                    <Text style={[s.statusTxt, { color:st.txt }]}>{st.label}</Text>
                  </View>
                </View>

                <View style={s.divider} />

                {/* Order details */}
                <View style={s.cardBot}>
                  <View style={{ flex:1 }}>
                    <Text style={s.preview} numberOfLines={1}>
                      {order.preview || order.items_preview || `${order.items_count} items`}
                    </Text>
                    <Text style={s.itemCount}>
                      {order.items_count} item{order.items_count !== 1 ? 's' : ''}
                    </Text>
                  </View>
                  <View style={s.cardRight}>
                    <Text style={s.total}>₹{parseFloat(order.total || order.total_amount || '0').toFixed(0)}</Text>
                    {isActiveOrder ? (
                      <TouchableOpacity
                        style={s.trackBtn}
                        onPress={() => navigation.navigate('OrderTracking', { orderId: order.id, status: order.status, orderData: order })}
                      >
                        <Text style={s.trackTxt}>Track →</Text>
                      </TouchableOpacity>
                    ) : order.status === 'delivered' ? (
                      <TouchableOpacity style={s.reorderBtn}>
                        <Ionicons name="refresh-outline" size={12} color="#FF8A00" />
                        <Text style={s.reorderTxt}>Reorder</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}

          <View style={{ height:80 }} />
        </ScrollView>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root:        { flex:1, backgroundColor:'#F7F8FA' },
  header:      { paddingTop: Platform.OS==='ios' ? 56 : 36, paddingBottom:16, paddingHorizontal:20 },
  hTop:        { flexDirection:'row', alignItems:'center', justifyContent:'space-between', marginBottom:14 },
  title:       { fontSize:26, fontWeight:'800', color:'#fff' },
  liveBadge:   { flexDirection:'row', alignItems:'center', gap:5, backgroundColor:'rgba(255,255,255,0.2)',
                  borderRadius:99, paddingHorizontal:10, paddingVertical:5 },
  liveDot:     { width:7, height:7, borderRadius:3.5, backgroundColor:'#4ADE80' },
  liveTxt:     { fontSize:12, fontWeight:'700', color:'#fff' },
  tabWrap:     { flexDirection:'row', backgroundColor:'rgba(255,255,255,0.2)', borderRadius:99, padding:3 },
  tab:         { flex:1, paddingVertical:8, borderRadius:99, alignItems:'center' },
  tabActive:   { backgroundColor:'#fff' },
  tabTxt:      { fontSize:13, fontWeight:'700', color:'rgba(255,255,255,0.7)' },
  tabTxtActive:{ color:'#FF8A00' },

  center:      { flex:1, alignItems:'center', justifyContent:'center', gap:10 },
  loadTxt:     { fontSize:14, color:'#888' },

  empty:       { flex:1, alignItems:'center', justifyContent:'center', gap:10, padding:32 },
  emptyT:      { fontSize:18, fontWeight:'700', color:'#333' },
  emptySub:    { fontSize:13, color:'#999', textAlign:'center', lineHeight:20 },
  browseBtn:   { borderRadius:14, paddingHorizontal:32, paddingVertical:14 },
  browseTxt:   { color:'#fff', fontSize:15, fontWeight:'700' },

  hintCard:    { flexDirection:'row', alignItems:'center', gap:8, backgroundColor:'#F0FDF4',
                  borderRadius:12, padding:12, borderWidth:1, borderColor:'#BBF7D0' },
  hintTxt:     { fontSize:12, color:'#15803D', flex:1 },

  card:        { backgroundColor:'#fff', borderRadius:18, overflow:'hidden',
                  shadowColor:'#000', shadowOpacity:0.06, shadowRadius:10, shadowOffset:{width:0,height:3} },
  activeBar:   { height:4 },
  cardTop:     { flexDirection:'row', alignItems:'center', gap:12, padding:14, paddingBottom:10 },
  shopIcon:    { width:42, height:42, borderRadius:12, backgroundColor:'#FFF4E6',
                  alignItems:'center', justifyContent:'center' },
  shopName:    { fontSize:15, fontWeight:'700', color:'#111', marginBottom:2 },
  orderDate:   { fontSize:12, color:'#999' },
  statusBadge: { flexDirection:'row', alignItems:'center', gap:4, borderRadius:99,
                  paddingHorizontal:10, paddingVertical:5, borderWidth:1 },
  statusTxt:   { fontSize:11, fontWeight:'700' },
  divider:     { height:0.5, backgroundColor:'#F5F5F5', marginHorizontal:14 },
  cardBot:     { flexDirection:'row', alignItems:'center', padding:14, paddingTop:10 },
  preview:     { fontSize:13, color:'#555', marginBottom:2 },
  itemCount:   { fontSize:11, color:'#BBB' },
  cardRight:   { alignItems:'flex-end', gap:6 },
  total:       { fontSize:17, fontWeight:'800', color:'#FF8A00' },
  trackBtn:    { backgroundColor:'#FF8A00', borderRadius:99, paddingHorizontal:14, paddingVertical:6 },
  trackTxt:    { fontSize:12, color:'#fff', fontWeight:'700' },
  reorderBtn:  { flexDirection:'row', alignItems:'center', gap:4, backgroundColor:'#FFF4E6',
                  borderRadius:99, paddingHorizontal:12, paddingVertical:6 },
  reorderTxt:  { fontSize:12, color:'#FF8A00', fontWeight:'700' },
});
