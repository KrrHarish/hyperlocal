import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Animated,
  ScrollView, Platform, ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { getOrderById, cancelOrder } from '../services/api';
import CancelOrderModal from '../components/CancelOrderModal';

const STEPS = [
  { key:'placed',    label:'Order Placed',    sub:'We received your order',       color:'#22C55E', icon:'checkmark-circle-outline' },
  { key:'confirmed', label:'Shop Confirmed',  sub:'Shop is preparing your items', color:'#3B82F6', icon:'storefront-outline'       },
  { key:'picked_up', label:'Rider Picked Up', sub:'Rider is heading your way',    color:'#FF8A00', icon:'bicycle-outline'          },
  { key:'delivered', label:'Delivered',        sub:'Order delivered successfully', color:'#8B5CF6', icon:'gift-outline'             },
];

// assigned = rider assigned by shop (maps to "Shop Confirmed" step)
const STEP_INDEX: any = { placed:0, confirmed:1, assigned:1, picked_up:2, delivered:3 };

const PAST_STATUSES   = ['delivered', 'cancelled', 'rejected', 'failed'];

// #ORD-0003 when order_number exists, else last 6 hex chars of UUID
const fmtId = (orderId: any, orderNumber?: number): string => {
  if (orderNumber) return `ORD-${String(orderNumber).padStart(4, '0')}`;
  if (!orderId) return '——';
  return orderId.toString().replace(/-/g, '').slice(-6).toUpperCase();
};

const fmtAddr = (addr: any): string => {
  if (!addr) return 'HSR Layout, Bengaluru';
  if (typeof addr === 'string') return addr;
  return [addr.line1, addr.city, addr.pincode].filter(Boolean).join(', ');
};
const ACTIVE_STATUSES = ['pending', 'placed', 'confirmed', 'assigned', 'picked_up', 'out_for_delivery', 'processing'];

export default function OrderTrackingScreen({ route, navigation }: any) {
  const { orderId, status: passedStatus, orderData: passedOrderData } = route.params || {};

  // Determine immediately if this is a past order from passed params
  const isPastOrder = passedStatus && PAST_STATUSES.includes(passedStatus);

  const [step, setStep]       = useState(() => STEP_INDEX[passedStatus] ?? 0);
  const [order, setOrder]     = useState<any>(passedOrderData || null);
  const [loading, setLoading] = useState(!passedOrderData);
  const [showCancel, setShowCancel] = useState(false);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pollRef   = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchOrder = useCallback(async () => {
    try {
      const res = await getOrderById(orderId);
      const o = res.data?.order || res.data;
      if (o) {
        setOrder(o);
        setStep(STEP_INDEX[o.status] ?? 0);
        if (PAST_STATUSES.includes(o.status)) {
          if (pollRef.current) clearInterval(pollRef.current);
        }
      }
    } catch {}
    finally { setLoading(false); }
  }, [orderId]);

  useEffect(() => {
    if (isPastOrder && passedOrderData) {
      // Past order — no polling needed, we already have data
      setLoading(false);
      return;
    }
    // Active order — fetch immediately and poll every 5s
    fetchOrder();
    pollRef.current = setInterval(fetchOrder, 5000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [fetchOrder, isPastOrder, passedOrderData]);

  // Pulse animation only for active orders
  useEffect(() => {
    if (isPastOrder) return;
    const a = Animated.loop(Animated.sequence([
      Animated.timing(pulseAnim, { toValue:1.2, duration:900, useNativeDriver:true }),
      Animated.timing(pulseAnim, { toValue:1,   duration:900, useNativeDriver:true }),
    ]));
    a.start();
    return () => a.stop();
  }, [isPastOrder]);

  const isCancelled = passedStatus === 'cancelled' || order?.status === 'cancelled';
  const isDelivered = step === 3 && !isCancelled;
  const finalStep   = isCancelled ? -1 : step;

  if (loading) {
    return (
      <View style={s.root}>
        <LinearGradient colors={['#FF8A00','#FF5C00']} style={s.header}>
          <TouchableOpacity style={s.iconBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={20} color="#fff" />
          </TouchableOpacity>
          <Text style={s.headerTitle}>Order Details</Text>
          <View style={{ width:36 }} />
        </LinearGradient>
        <View style={s.center}>
          <ActivityIndicator size="large" color="#FF8A00" />
          <Text style={s.loadTxt}>Loading order…</Text>
        </View>
      </View>
    );
  }

  // ── PAST ORDER VIEW (delivered or cancelled) ──
  if (isPastOrder) {
    return (
      <View style={s.root}>
        <LinearGradient
          colors={isCancelled ? ['#EF4444','#DC2626'] : ['#8B5CF6','#7C3AED']}
          style={s.header}
        >
          <TouchableOpacity style={s.iconBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={20} color="#fff" />
          </TouchableOpacity>
          <View style={{ flex:1 }}>
            <Text style={s.headerTitle}>{isCancelled ? 'Order Cancelled' : 'Order Delivered'}</Text>
            <Text style={s.headerSub}>#{fmtId(orderId, order?.order_number)}</Text>
          </View>
          <View style={{ width:36 }} />
        </LinearGradient>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding:16, gap:12 }}>

          {/* Status banner */}
          <View style={[s.pastBanner, isCancelled && s.pastBannerCancelled]}>
            <Text style={s.pastBannerEmoji}>{isCancelled ? '❌' : '✅'}</Text>
            <View style={{ flex: 1 }}>
              <Text style={[s.pastBannerTitle, isCancelled && { color:'#B91C1C' }]}>
                {isCancelled ? 'Order was cancelled' : 'Successfully delivered'}
              </Text>
              <Text style={s.pastBannerSub}>
                {order?.created_at || passedOrderData?.created_at || 'Previously'}
              </Text>
              {isCancelled && (order?.cancellation_reason || passedOrderData?.cancellation_reason) && (
                <View style={{ marginTop: 8, backgroundColor: '#FEE2E2', borderRadius: 8, padding: 10 }}>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: '#991B1B', marginBottom: 2, textTransform: 'uppercase', letterSpacing: 0.4 }}>
                    Reason
                  </Text>
                  <Text style={{ fontSize: 13, color: '#B91C1C', fontWeight: '600' }}>
                    {order?.cancellation_reason || passedOrderData?.cancellation_reason}
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* Order details */}
          <View style={s.detailCard}>
            <Text style={s.detailTitle}>Order Details</Text>

            <View style={s.detailRow}>
              <Text style={s.detailLbl}>Order ID</Text>
              <Text style={s.detailVal}>#{fmtId(orderId, order?.order_number)}</Text>
            </View>
            <View style={s.detailDivider} />

            <View style={s.detailRow}>
              <Text style={s.detailLbl}>Shop</Text>
              <Text style={s.detailVal}>{order?.shop_name || passedOrderData?.shop_name || '—'}</Text>
            </View>
            <View style={s.detailDivider} />

            <View style={s.detailRow}>
              <Text style={s.detailLbl}>Items</Text>
              <Text style={s.detailVal}>
                {passedOrderData?.preview || order?.preview || `${order?.items_count || passedOrderData?.items_count || '—'} items`}
              </Text>
            </View>
            <View style={s.detailDivider} />

            <View style={s.detailRow}>
              <Text style={s.detailLbl}>Total Paid</Text>
              <Text style={[s.detailVal, { color:'#FF8A00', fontWeight:'800' }]}>
                ₹{order?.total || passedOrderData?.total || '—'}
              </Text>
            </View>
            <View style={s.detailDivider} />

            <View style={s.detailRow}>
              <Text style={s.detailLbl}>Delivery Address</Text>
              <Text style={[s.detailVal, { maxWidth:180, textAlign:'right' }]}>
                {fmtAddr(order?.delivery_address)}
              </Text>
            </View>
          </View>

          {/* Actions */}
          {!isCancelled && (
            <View style={s.actionsRow}>
              <TouchableOpacity style={s.rateBtn}>
                <Ionicons name="star-outline" size={17} color="#FF8A00" />
                <Text style={s.rateTxt}>Rate Order</Text>
              </TouchableOpacity>
              <TouchableOpacity style={{ flex:1, borderRadius:16, overflow:'hidden' }}
                onPress={() => navigation.goBack()}>
                <LinearGradient colors={['#FF8A00','#FF5C00']} style={s.reorderBtn}
                  start={{ x:0,y:0 }} end={{ x:1,y:0 }}>
                  <Ionicons name="refresh-outline" size={17} color="#fff" />
                  <Text style={s.reorderTxt}>Reorder</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          )}

          {isCancelled && (
            <TouchableOpacity onPress={() => navigation.goBack()}
              style={{ borderRadius:16, overflow:'hidden' }}>
              <LinearGradient colors={['#FF8A00','#FF5C00']} style={[s.reorderBtn, { height:52 }]}
                start={{ x:0,y:0 }} end={{ x:1,y:0 }}>
                <Text style={s.reorderTxt}>Browse Shops Again</Text>
              </LinearGradient>
            </TouchableOpacity>
          )}

          <View style={{ height:40 }} />
        </ScrollView>
      </View>
    );
  }

  // ── ACTIVE ORDER LIVE TRACKING VIEW ──
  const ETA = ['18 min','13 min','6 min','Arrived'];

  return (
    <View style={s.root}>
      <LinearGradient colors={['#FF8A00','#FF5C00']} style={s.header}>
        <TouchableOpacity style={s.iconBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={20} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex:1 }}>
          <Text style={s.headerTitle}>Live Tracking</Text>
          <Text style={s.headerSub}>#{fmtId(orderId, order?.order_number)}</Text>
        </View>
        <TouchableOpacity style={s.iconBtn} onPress={() => setShowCancel(true)}>
          <Ionicons name="close-circle-outline" size={22} color="#fff" />
        </TouchableOpacity>
      </LinearGradient>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding:16, gap:12 }}>

        {/* ETA card */}
        {isDelivered ? (
          <View style={s.deliveredCard}>
            <Text style={s.deliveredEmoji}>🎉</Text>
            <Text style={s.deliveredTitle}>Order Delivered!</Text>
            <Text style={s.deliveredSub}>We hope you love it. See you next time!</Text>
          </View>
        ) : (
          <LinearGradient colors={['#0B1A2B','#0F2236']} style={s.etaCard}>
            <View>
              <Text style={s.etaLbl}>Arriving in</Text>
              <Text style={s.etaTime}>{ETA[step]}</Text>
              <Text style={s.etaAddr}>HSR Layout, Bengaluru</Text>
            </View>
            <Animated.View style={{ transform:[{ scale:pulseAnim }] }}>
              <View style={s.riderBubble}>
                <Text style={{ fontSize:34 }}>🛵</Text>
              </View>
            </Animated.View>
          </LinearGradient>
        )}

        {/* Waiting notices */}
        {step === 0 && (
          <View style={s.noticeCard}>
            <Ionicons name="time-outline" size={18} color="#D97706" />
            <Text style={s.noticeTxt}>
              Waiting for <Text style={{ fontWeight:'700' }}>{order?.shop_name || 'the shop'}</Text> to confirm your order
            </Text>
          </View>
        )}
        {step === 1 && !order?.rider_name && (
          <View style={[s.noticeCard, { backgroundColor:'#EFF6FF', borderColor:'#BFDBFE' }]}>
            <Ionicons name="bicycle-outline" size={18} color="#3B82F6" />
            <Text style={[s.noticeTxt, { color:'#1D4ED8' }]}>
              Shop confirmed! Looking for a nearby rider…
            </Text>
          </View>
        )}
        {step === 1 && order?.rider_name && (
          <View style={[s.noticeCard, { backgroundColor:'#F0FDF4', borderColor:'#BBF7D0' }]}>
            <Ionicons name="checkmark-circle-outline" size={18} color="#16A34A" />
            <Text style={[s.noticeTxt, { color:'#15803D' }]}>
              Shop confirmed! <Text style={{ fontWeight:'700' }}>{order.rider_name}</Text> has been assigned to your order
            </Text>
          </View>
        )}

        {/* Cancel button — only for pending/confirmed */}
        {(step === 0 || step === 1) && (
          <TouchableOpacity style={s.cancelOrderBtn} onPress={() => setShowCancel(true)}>
            <Ionicons name="close-circle-outline" size={16} color="#EF4444" />
            <Text style={s.cancelOrderTxt}>Cancel Order</Text>
          </TouchableOpacity>
        )}

        {/* Steps */}
        <View style={s.stepsCard}>
          <Text style={s.stepsTitle}>Order Status</Text>
          {STEPS.map((st, idx) => {
            const isDone   = idx < step;
            const isActive = idx === step;
            const isFuture = idx > step;
            return (
              <View key={st.key} style={s.stepRow}>
                <View style={s.stepLeft}>
                  <View style={[s.line, idx === 0 && { opacity:0 },
                    (isDone || isActive) && idx > 0 && { backgroundColor: STEPS[idx-1].color }]} />
                  <Animated.View style={[
                    s.circle,
                    isDone   && { backgroundColor:st.color, borderColor:st.color },
                    isActive && { backgroundColor:st.color, borderColor:st.color,
                                  transform:[{ scale:pulseAnim }] },
                    isFuture && { backgroundColor:'#F3F4F6', borderColor:'#E5E7EB' },
                  ]}>
                    {isDone   ? <Ionicons name="checkmark" size={14} color="#fff" />
                    : isActive ? <Ionicons name={st.icon as any} size={13} color="#fff" />
                    : <View style={s.greyDot} />}
                  </Animated.View>
                  <View style={[s.line, idx === STEPS.length-1 && { opacity:0 },
                    isDone && { backgroundColor:st.color }]} />
                </View>
                <View style={s.stepRight}>
                  <Text style={[s.stepLabel,
                    isDone   && { color:'#111' },
                    isActive && { color:st.color, fontWeight:'800' },
                    isFuture && { color:'#C0C0C0' },
                  ]}>{st.label}</Text>
                  <Text style={[s.stepSub, isFuture && { color:'#E0E0E0' }]}>{st.sub}</Text>
                  {isActive && (
                    <View style={[s.nowBadge, { backgroundColor:st.color+'18' }]}>
                      <View style={[s.nowDot, { backgroundColor:st.color }]} />
                      <Text style={[s.nowTxt, { color:st.color }]}>In progress</Text>
                    </View>
                  )}
                </View>
              </View>
            );
          })}
        </View>

        {/* Rider card — show as soon as rider is assigned */}
        {step >= 1 && !isDelivered && order?.rider_name && (
          <View style={s.riderCard}>
            <View style={s.riderAvatar}>
              <Text style={{ fontSize:26 }}>🛵</Text>
            </View>
            <View style={{ flex:1 }}>
              <Text style={s.riderName}>{order.rider_name}</Text>
              <View style={s.riderMeta}>
                <Ionicons name="call-outline" size={12} color="#888" />
                <Text style={s.riderSub}>{order.rider_phone}</Text>
              </View>
            </View>
            <TouchableOpacity style={s.callBtn}>
              <LinearGradient colors={['#FF8A00','#FF5C00']} style={s.callGrad}>
                <Ionicons name="call" size={17} color="#fff" />
              </LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity style={s.chatBtn}>
              <Ionicons name="chatbubble-ellipses-outline" size={17} color="#FF8A00" />
            </TouchableOpacity>
          </View>
        )}

        {/* Summary */}
        <View style={s.stepsCard}>
          <Text style={s.stepsTitle}>Order Summary</Text>
          {[
            { icon:'storefront-outline', txt: order?.shop_name || 'Raju General Store' },
            { icon:'receipt-outline',    txt: `₹${order?.total || '—'}  ·  ${order?.items_count || '—'} items` },
            { icon:'location-outline',   txt: 'HSR Layout, Bengaluru - 560102' },
          ].map((r, i) => (
            <View key={i} style={s.summaryRow}>
              <Ionicons name={r.icon as any} size={16} color="#AAA" />
              <Text style={s.summaryTxt} numberOfLines={1}>{r.txt}</Text>
            </View>
          ))}
        </View>

        {/* Delivered actions */}
        {isDelivered && (
          <View style={s.actionsRow}>
            <TouchableOpacity style={s.rateBtn}>
              <Ionicons name="star-outline" size={17} color="#FF8A00" />
              <Text style={s.rateTxt}>Rate Order</Text>
            </TouchableOpacity>
            <TouchableOpacity style={{ flex:1, borderRadius:16, overflow:'hidden' }}
              onPress={() => navigation.goBack()}>
              <LinearGradient colors={['#FF8A00','#FF5C00']} style={s.reorderBtn}
                start={{ x:0,y:0 }} end={{ x:1,y:0 }}>
                <Ionicons name="arrow-back-outline" size={17} color="#fff" />
                <Text style={s.reorderTxt}>Back to Orders</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}

        <View style={{ height:40 }} />
      </ScrollView>

      {/* Cancel Order Modal */}
      <CancelOrderModal
        visible={showCancel}
        orderId={orderId}
        orderStatus={order?.status || 'pending'}
        createdAt={order?.created_at || new Date().toISOString()}
        onClose={() => setShowCancel(false)}
        onCancelled={() => {
          setShowCancel(false);
          setStep(-1); // show cancelled state
          if (pollRef.current) clearInterval(pollRef.current);
          navigation.goBack();
        }}
      />
    </View>
  );
}

const s = StyleSheet.create({
  root:            { flex:1, backgroundColor:'#F7F8FA' },
  center:          { flex:1, alignItems:'center', justifyContent:'center', gap:10 },
  loadTxt:         { fontSize:14, color:'#888' },
  header:          { paddingTop:Platform.OS==='ios'?56:36, paddingBottom:18,
                      paddingHorizontal:20, flexDirection:'row', alignItems:'center', gap:14 },
  iconBtn:         { width:36, height:36, borderRadius:18, backgroundColor:'rgba(255,255,255,0.2)',
                      alignItems:'center', justifyContent:'center' },
  headerTitle:     { fontSize:18, fontWeight:'800', color:'#fff' },
  headerSub:       { fontSize:12, color:'rgba(255,255,255,0.7)', marginTop:1 },

  // Past order styles
  pastBanner:      { backgroundColor:'#F0FDF4', borderRadius:18, padding:18,
                      flexDirection:'row', alignItems:'center', gap:14,
                      borderWidth:1, borderColor:'#BBF7D0' },
  pastBannerCancelled:{ backgroundColor:'#FEF2F2', borderColor:'#FECACA' },
  pastBannerEmoji: { fontSize:36 },
  pastBannerTitle: { fontSize:17, fontWeight:'800', color:'#15803D', marginBottom:3 },
  pastBannerSub:   { fontSize:13, color:'#888' },
  detailCard:      { backgroundColor:'#fff', borderRadius:18, padding:18,
                      shadowColor:'#000', shadowOpacity:0.05, shadowRadius:10, shadowOffset:{width:0,height:3} },
  detailTitle:     { fontSize:16, fontWeight:'800', color:'#111', marginBottom:16 },
  detailRow:       { flexDirection:'row', justifyContent:'space-between', alignItems:'flex-start', paddingVertical:10 },
  detailLbl:       { fontSize:14, color:'#888' },
  detailVal:       { fontSize:14, color:'#111', fontWeight:'600', flex:1, textAlign:'right', marginLeft:16 },
  detailDivider:   { height:0.5, backgroundColor:'#F0F0F0' },

  // Active order styles
  deliveredCard:   { backgroundColor:'#fff', borderRadius:20, padding:28, alignItems:'center', gap:6,
                      shadowColor:'#000', shadowOpacity:0.06, shadowRadius:12, shadowOffset:{width:0,height:3} },
  deliveredEmoji:  { fontSize:52, marginBottom:4 },
  deliveredTitle:  { fontSize:22, fontWeight:'800', color:'#111' },
  deliveredSub:    { fontSize:14, color:'#888', textAlign:'center' },
  etaCard:         { borderRadius:20, padding:22, flexDirection:'row',
                      justifyContent:'space-between', alignItems:'center' },
  etaLbl:          { fontSize:13, color:'rgba(255,255,255,0.45)', marginBottom:4 },
  etaTime:         { fontSize:40, fontWeight:'800', color:'#FF8A00', marginBottom:3 },
  etaAddr:         { fontSize:12, color:'rgba(255,255,255,0.4)' },
  riderBubble:     { width:72, height:72, borderRadius:36, backgroundColor:'rgba(255,138,0,0.15)',
                      alignItems:'center', justifyContent:'center' },
  noticeCard:      { flexDirection:'row', alignItems:'center', gap:10, backgroundColor:'#FFFBEB',
                      borderRadius:14, padding:14, borderWidth:1, borderColor:'#FDE68A' },
  noticeTxt:       { fontSize:13, color:'#92400E', flex:1, lineHeight:18 },
  stepsCard:       { backgroundColor:'#fff', borderRadius:20, padding:20,
                      shadowColor:'#000', shadowOpacity:0.05, shadowRadius:10, shadowOffset:{width:0,height:3} },
  stepsTitle:      { fontSize:16, fontWeight:'800', color:'#111', marginBottom:16 },
  stepRow:         { flexDirection:'row', alignItems:'stretch', minHeight:64 },
  stepLeft:        { width:36, alignItems:'center', marginRight:14 },
  line:            { flex:1, width:2, backgroundColor:'#EBEBEB', minHeight:10 },
  circle:          { width:36, height:36, borderRadius:18, borderWidth:2,
                      borderColor:'#E5E7EB', backgroundColor:'#F9FAFB',
                      alignItems:'center', justifyContent:'center', flexShrink:0 },
  greyDot:         { width:8, height:8, borderRadius:4, backgroundColor:'#D1D5DB' },
  stepRight:       { flex:1, paddingBottom:16, justifyContent:'center' },
  stepLabel:       { fontSize:15, fontWeight:'700', color:'#888', marginBottom:2 },
  stepSub:         { fontSize:12, color:'#AAA', lineHeight:17 },
  nowBadge:        { flexDirection:'row', alignItems:'center', gap:5, marginTop:6,
                      alignSelf:'flex-start', borderRadius:99, paddingHorizontal:10, paddingVertical:4 },
  nowDot:          { width:6, height:6, borderRadius:3 },
  nowTxt:          { fontSize:11, fontWeight:'700' },
  riderCard:       { backgroundColor:'#fff', borderRadius:20, padding:16,
                      flexDirection:'row', alignItems:'center', gap:12,
                      shadowColor:'#000', shadowOpacity:0.05, shadowRadius:10, shadowOffset:{width:0,height:3} },
  riderAvatar:     { width:50, height:50, borderRadius:25, backgroundColor:'#FFF4E6',
                      alignItems:'center', justifyContent:'center' },
  riderName:       { fontSize:15, fontWeight:'700', color:'#111', marginBottom:4 },
  riderMeta:       { flexDirection:'row', alignItems:'center', gap:4 },
  riderSub:        { fontSize:12, color:'#888' },
  callBtn:         { borderRadius:12, overflow:'hidden' },
  callGrad:        { width:42, height:42, alignItems:'center', justifyContent:'center' },
  chatBtn:         { width:42, height:42, borderRadius:12, borderWidth:1.5,
                      borderColor:'#FF8A00', alignItems:'center', justifyContent:'center' },
  summaryRow:      { flexDirection:'row', alignItems:'center', gap:10, marginBottom:10 },
  summaryTxt:      { fontSize:14, color:'#444', flex:1 },
  actionsRow:      { flexDirection:'row', gap:10 },
  rateBtn:         { flex:1, height:52, backgroundColor:'#fff', borderRadius:16,
                      flexDirection:'row', alignItems:'center', justifyContent:'center', gap:8,
                      borderWidth:1.5, borderColor:'#FF8A00' },
  rateTxt:         { fontSize:14, fontWeight:'700', color:'#FF8A00' },
  reorderBtn:      { height:52, flexDirection:'row', alignItems:'center', justifyContent:'center', gap:8 },
  reorderTxt:      { color:'#fff', fontSize:14, fontWeight:'700' },
   cancelOrderBtn:  { flexDirection:'row', alignItems:'center', gap:6, alignSelf:'center',
                      marginTop:8, paddingHorizontal:18, paddingVertical:10,
                      borderRadius:99, borderWidth:1.5, borderColor:'#EF4444',
                      backgroundColor:'#FEF2F2' },
  cancelOrderTxt:  { fontSize:13, fontWeight:'700', color:'#EF4444' },
});
