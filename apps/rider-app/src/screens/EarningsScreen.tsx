import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, ActivityIndicator,
  RefreshControl, Platform, TouchableOpacity, Modal, Pressable,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { getEarnings, getOrderHistory } from '../api/client';

// ─── Types ───────────────────────────────────────────────────────────────────
type Period = 'today' | 'week' | 'month' | 'year' | 'all' | 'custom';

const PERIODS: { key: Period; label: string }[] = [
  { key: 'today',  label: 'Today'  },
  { key: 'week',   label: 'Week'   },
  { key: 'month',  label: 'Month'  },
  { key: 'year',   label: 'Year'   },
  { key: 'all',    label: 'All'    },
  { key: 'custom', label: '📅'     },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────
function fmt(n: number | string) {
  return `₹${parseFloat(String(n || 0)).toFixed(0)}`;
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}
function timeAgo(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60)    return `${Math.floor(diff)}s ago`;
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return fmtDate(iso);
}
function toISO(d: Date) {
  return d.toISOString().split('T')[0]; // YYYY-MM-DD
}
function fmtShort(d: Date) {
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' });
}

// Group orders by date label
function groupByDate(orders: any[]) {
  const groups: Record<string, any[]> = {};
  for (const o of orders) {
    const d       = new Date(o.updated_at || o.created_at);
    const today   = new Date(); today.setHours(0, 0, 0, 0);
    const yest    = new Date(today); yest.setDate(today.getDate() - 1);
    const label   = d >= today ? 'Today'
                  : d >= yest  ? 'Yesterday'
                  : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    if (!groups[label]) groups[label] = [];
    groups[label].push(o);
  }
  return Object.entries(groups);
}

// ─── Bar Chart ───────────────────────────────────────────────────────────────
function BarChart({ daily }: { daily: { date: string; earned: number }[] }) {
  if (!daily || daily.length === 0) return null;
  const max  = Math.max(...daily.map(d => d.earned), 1);
  const show = daily.slice(-14);
  return (
    <View style={bc.wrap}>
      <View style={bc.bars}>
        {show.map((d, i) => {
          const h = Math.max((d.earned / max) * 80, d.earned > 0 ? 6 : 2);
          return (
            <View key={i} style={bc.barCol}>
              <Text style={bc.barVal}>{d.earned > 0 ? `₹${d.earned.toFixed(0)}` : ''}</Text>
              <View style={[bc.bar, { height: h, opacity: d.earned > 0 ? 1 : 0.2 }]} />
              <Text style={bc.barLabel}>
                {new Date(d.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }).split(' ')[0]}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}
const bc = StyleSheet.create({
  wrap:     { marginTop: 4, marginBottom: 2 },
  bars:     { flexDirection: 'row', alignItems: 'flex-end', gap: 4, height: 110 },
  barCol:   { flex: 1, alignItems: 'center', gap: 3 },
  barVal:   { fontSize: 7, color: '#4ade80', fontWeight: '700', textAlign: 'center' },
  bar:      { width: '100%', backgroundColor: '#22C55E', borderRadius: 4, minHeight: 2 },
  barLabel: { fontSize: 8, color: '#555', textAlign: 'center' },
});

// ─── Calendar Picker ─────────────────────────────────────────────────────────
const DAYS   = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function CalendarPicker({
  visible,
  onClose,
  onApply,
  initialFrom,
  initialTo,
}: {
  visible: boolean;
  onClose: () => void;
  onApply: (from: Date, to: Date) => void;
  initialFrom: Date | null;
  initialTo:   Date | null;
}) {
  const today = new Date(); today.setHours(0, 0, 0, 0);

  const [viewYear,  setViewYear]  = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selFrom,   setSelFrom]   = useState<Date | null>(initialFrom);
  const [selTo,     setSelTo]     = useState<Date | null>(initialTo);
  const [picking,   setPicking]   = useState<'from' | 'to'>('from');

  // Reset when opened
  useEffect(() => {
    if (visible) {
      setSelFrom(initialFrom);
      setSelTo(initialTo);
      setPicking('from');
      const ref = initialFrom ?? today;
      setViewYear(ref.getFullYear());
      setViewMonth(ref.getMonth());
    }
  }, [visible]);

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  }

  function handleDayPress(d: Date) {
    if (picking === 'from') {
      setSelFrom(d);
      setSelTo(null);
      setPicking('to');
    } else {
      if (selFrom && d < selFrom) {
        // Swap
        setSelFrom(d);
        setSelTo(selFrom);
      } else {
        setSelTo(d);
      }
      setPicking('from');
    }
  }

  function isBetween(d: Date) {
    return !!(selFrom && selTo && d > selFrom && d < selTo);
  }
  function isFrom(d: Date) { return !!selFrom && d.getTime() === selFrom.getTime(); }
  function isTo(d:   Date) { return !!selTo   && d.getTime() === selTo.getTime(); }
  function isFuture(d: Date) { return d > today; }

  // Build calendar grid
  const firstDay  = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMo  = new Date(viewYear, viewMonth + 1, 0).getDate();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMo; d++) {
    const dt = new Date(viewYear, viewMonth, d);
    cells.push(dt);
  }
  while (cells.length % 7 !== 0) cells.push(null);

  const canApply = !!(selFrom && selTo);

  // Quick shortcuts
  function quickSelect(type: 'today' | 'yesterday' | 'last7' | 'last30') {
    const t = new Date(today);
    let f: Date, to: Date;
    if (type === 'today') {
      f = new Date(t); to = new Date(t);
    } else if (type === 'yesterday') {
      f = new Date(t); f.setDate(t.getDate() - 1);
      to = new Date(f);
    } else if (type === 'last7') {
      f = new Date(t); f.setDate(t.getDate() - 6);
      to = new Date(t);
    } else {
      f = new Date(t); f.setDate(t.getDate() - 29);
      to = new Date(t);
    }
    setSelFrom(f); setSelTo(to);
    setViewYear(f.getFullYear()); setViewMonth(f.getMonth());
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={cal.backdrop} onPress={onClose} />
      <View style={cal.sheet}>

        {/* Header */}
        <View style={cal.sheetHeader}>
          <Text style={cal.sheetTitle}>Select Date Range</Text>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={22} color="#aaa" />
          </TouchableOpacity>
        </View>

        {/* Selected range display */}
        <View style={cal.rangeRow}>
          <TouchableOpacity
            style={[cal.rangeBox, picking === 'from' && cal.rangeBoxActive]}
            onPress={() => setPicking('from')}
          >
            <Text style={cal.rangeLabel}>FROM</Text>
            <Text style={cal.rangeVal}>{selFrom ? fmtShort(selFrom) : '—'}</Text>
          </TouchableOpacity>
          <Ionicons name="arrow-forward" size={16} color="#555" style={{ marginHorizontal: 8 }} />
          <TouchableOpacity
            style={[cal.rangeBox, picking === 'to' && cal.rangeBoxActive]}
            onPress={() => setPicking('to')}
          >
            <Text style={cal.rangeLabel}>TO</Text>
            <Text style={cal.rangeVal}>{selTo ? fmtShort(selTo) : '—'}</Text>
          </TouchableOpacity>
        </View>

        {/* Quick shortcuts */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={cal.quickScroll}
          contentContainerStyle={cal.quickRow}>
          {([
            { label: 'Today',     key: 'today'     },
            { label: 'Yesterday', key: 'yesterday' },
            { label: 'Last 7d',   key: 'last7'     },
            { label: 'Last 30d',  key: 'last30'    },
          ] as const).map(q => (
            <TouchableOpacity key={q.key} style={cal.quickBtn} onPress={() => quickSelect(q.key)}>
              <Text style={cal.quickTxt}>{q.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Month navigation */}
        <View style={cal.monthNav}>
          <TouchableOpacity onPress={prevMonth} style={cal.navBtn}>
            <Ionicons name="chevron-back" size={20} color="#22C55E" />
          </TouchableOpacity>
          <Text style={cal.monthLabel}>{MONTHS[viewMonth]} {viewYear}</Text>
          <TouchableOpacity onPress={nextMonth} style={cal.navBtn}
            disabled={viewYear === today.getFullYear() && viewMonth === today.getMonth()}>
            <Ionicons name="chevron-forward" size={20}
              color={viewYear === today.getFullYear() && viewMonth === today.getMonth() ? '#333' : '#22C55E'} />
          </TouchableOpacity>
        </View>

        {/* Day headers */}
        <View style={cal.dayHeaders}>
          {DAYS.map(d => <Text key={d} style={cal.dayHead}>{d}</Text>)}
        </View>

        {/* Calendar grid */}
        <View style={cal.grid}>
          {cells.map((d, i) => {
            if (!d) return <View key={i} style={cal.cell} />;
            const from    = isFrom(d);
            const to      = isTo(d);
            const between = isBetween(d);
            const future  = isFuture(d);
            const endcap  = from || to;
            return (
              <TouchableOpacity
                key={i}
                style={[
                  cal.cell,
                  between && cal.cellBetween,
                  from    && cal.cellFrom,
                  to      && cal.cellTo,
                ]}
                onPress={() => !future && handleDayPress(d)}
                disabled={future}
              >
                <View style={[endcap && cal.endcap]}>
                  <Text style={[
                    cal.cellTxt,
                    between && cal.cellTxtBetween,
                    endcap  && cal.cellTxtEndcap,
                    future  && cal.cellTxtFuture,
                  ]}>
                    {d.getDate()}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Picking hint */}
        <Text style={cal.hint}>
          {picking === 'from' ? 'Tap a start date' : 'Tap an end date'}
        </Text>

        {/* Apply */}
        <TouchableOpacity
          style={[cal.applyBtn, !canApply && cal.applyBtnDisabled]}
          disabled={!canApply}
          onPress={() => canApply && onApply(selFrom!, selTo!)}
        >
          <Text style={cal.applyTxt}>Apply</Text>
        </TouchableOpacity>

      </View>
    </Modal>
  );
}

const CELL = 42;
const cal = StyleSheet.create({
  backdrop:         { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet:            { position: 'absolute', bottom: 0, left: 0, right: 0,
                       backgroundColor: '#111', borderTopLeftRadius: 24, borderTopRightRadius: 24,
                       padding: 20, paddingBottom: Platform.OS === 'ios' ? 36 : 24 },
  sheetHeader:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  sheetTitle:       { fontSize: 16, fontWeight: '800', color: '#fff' },

  rangeRow:         { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  rangeBox:         { flex: 1, backgroundColor: '#1a1a1a', borderRadius: 10, padding: 10,
                       borderWidth: 1, borderColor: '#2a2a2a' },
  rangeBoxActive:   { borderColor: '#22C55E' },
  rangeLabel:       { fontSize: 9, color: '#555', fontWeight: '700', marginBottom: 2 },
  rangeVal:         { fontSize: 14, color: '#fff', fontWeight: '700' },

  quickScroll:      { marginBottom: 14 },
  quickRow:         { flexDirection: 'row', gap: 8 },
  quickBtn:         { backgroundColor: '#1e3a2f', borderRadius: 99, paddingHorizontal: 14, paddingVertical: 7,
                       borderWidth: 1, borderColor: '#2d5a3e' },
  quickTxt:         { fontSize: 12, color: '#4ade80', fontWeight: '700' },

  monthNav:         { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  navBtn:           { padding: 6 },
  monthLabel:       { fontSize: 15, fontWeight: '800', color: '#fff' },

  dayHeaders:       { flexDirection: 'row', marginBottom: 6 },
  dayHead:          { width: CELL, textAlign: 'center', fontSize: 11, color: '#555', fontWeight: '700' },

  grid:             { flexDirection: 'row', flexWrap: 'wrap' },
  cell:             { width: CELL, height: CELL, alignItems: 'center', justifyContent: 'center' },
  cellBetween:      { backgroundColor: '#1e3a2f' },
  cellFrom:         { backgroundColor: '#1e3a2f', borderTopLeftRadius: CELL/2, borderBottomLeftRadius: CELL/2 },
  cellTo:           { backgroundColor: '#1e3a2f', borderTopRightRadius: CELL/2, borderBottomRightRadius: CELL/2 },
  endcap:           { width: 34, height: 34, borderRadius: 17, backgroundColor: '#22C55E',
                       alignItems: 'center', justifyContent: 'center' },
  cellTxt:          { fontSize: 14, color: '#ccc', fontWeight: '600' },
  cellTxtBetween:   { color: '#4ade80' },
  cellTxtEndcap:    { color: '#000', fontWeight: '800' },
  cellTxtFuture:    { color: '#333' },

  hint:             { textAlign: 'center', fontSize: 12, color: '#555', marginTop: 10, marginBottom: 8 },
  applyBtn:         { backgroundColor: '#22C55E', borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  applyBtnDisabled: { backgroundColor: '#1a2e1a' },
  applyTxt:         { fontSize: 15, fontWeight: '800', color: '#000' },
});

// ─── Main Screen ─────────────────────────────────────────────────────────────
export default function EarningsScreen() {
  const [period,      setPeriod]      = useState<Period>('month');
  const [customFrom,  setCustomFrom]  = useState<Date | null>(null);
  const [customTo,    setCustomTo]    = useState<Date | null>(null);
  const [showCal,     setShowCal]     = useState(false);
  const [earnings,    setEarnings]    = useState<any>(null);
  const [history,     setHistory]     = useState<any[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [refreshing,  setRefreshing]  = useState(false);

  const fetchData = useCallback(async (
    p: Period = period,
    from: Date | null = customFrom,
    to:   Date | null = customTo,
    isRefresh = false,
  ) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const fromStr = (p === 'custom' && from) ? toISO(from) : undefined;
      const toStr   = (p === 'custom' && to)   ? toISO(to)   : undefined;
      const [earRes, histRes] = await Promise.all([
        getEarnings(p === 'custom' ? 'all' : p, fromStr, toStr),
        getOrderHistory(),
      ]);
      setEarnings(earRes.data.earnings);
      setHistory(histRes.data.orders || []);
    } catch {}
    finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [period, customFrom, customTo]);

  useEffect(() => { fetchData(period, customFrom, customTo); }, [period, customFrom, customTo]);

  function handleApply(from: Date, to: Date) {
    setShowCal(false);
    setCustomFrom(from);
    setCustomTo(to);
    setPeriod('custom');
  }

  // Filter history client-side
  const filterByPeriod = (orders: any[]) => {
    if (period === 'custom' && customFrom && customTo) {
      const f = new Date(customFrom); f.setHours(0, 0, 0, 0);
      const t = new Date(customTo);   t.setHours(23, 59, 59, 999);
      return orders.filter(o => {
        const d = new Date(o.updated_at || o.created_at);
        return d >= f && d <= t;
      });
    }
    const now = new Date(); const start = new Date(now);
    if      (period === 'today') { start.setHours(0,0,0,0); }
    else if (period === 'week')  { start.setDate(now.getDate() - now.getDay()); start.setHours(0,0,0,0); }
    else if (period === 'month') { start.setDate(1); start.setHours(0,0,0,0); }
    else if (period === 'year')  { start.setMonth(0,1); start.setHours(0,0,0,0); }
    else return orders;
    return orders.filter(o => new Date(o.updated_at || o.created_at) >= start);
  };

  const filtered   = filterByPeriod(history);
  const delivered  = filtered.filter(o => o.status === 'delivered');
  const cancelled  = filtered.filter(o => o.status === 'cancelled');
  const avgEarning = delivered.length > 0
    ? delivered.reduce((s, o) => s + parseFloat(o.delivery_fee || 0), 0) / delivered.length
    : 0;
  const grouped = groupByDate(filtered);

  // Label shown in hero card
  const periodLabel = period === 'custom' && customFrom && customTo
    ? `${fmtShort(customFrom)} – ${fmtShort(customTo)}`
    : (PERIODS.find(p => p.key === period)?.label ?? '');

  if (loading) {
    return (
      <LinearGradient colors={['#0A0A0A', '#0F1117']} style={[s.root, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator color="#22C55E" size="large" />
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={['#0A0A0A', '#0F1117']} style={s.root}>

      {/* Header */}
      <LinearGradient colors={['#052e16', '#14532D']} style={s.header}>
        <Text style={s.title}>Earnings</Text>
        <Text style={s.sub}>Your delivery income</Text>

        {/* Period tabs */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={s.tabs}>
            {PERIODS.map(p => {
              const isActive = period === p.key;
              const isCustomActive = p.key === 'custom' && period === 'custom';
              return (
                <TouchableOpacity
                  key={p.key}
                  style={[s.tab, isActive && s.tabActive]}
                  onPress={() => {
                    if (p.key === 'custom') {
                      setShowCal(true);
                    } else {
                      setPeriod(p.key);
                      setCustomFrom(null);
                      setCustomTo(null);
                    }
                  }}
                >
                  {isCustomActive && customFrom && customTo ? (
                    <Text style={[s.tabTxt, s.tabTxtActive]} numberOfLines={1}>
                      {fmtShort(customFrom).split(' ').slice(0,2).join(' ')} – {fmtShort(customTo).split(' ').slice(0,2).join(' ')}
                    </Text>
                  ) : (
                    <Text style={[s.tabTxt, isActive && s.tabTxtActive]}>{p.label}</Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>
      </LinearGradient>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchData(period, customFrom, customTo, true)}
            tintColor="#22C55E"
          />
        }
      >
        {/* Hero Earnings Card */}
        <LinearGradient colors={['#14532D', '#166534']} style={s.heroCard} start={{ x:0,y:0 }} end={{ x:1,y:1 }}>
          <Text style={s.heroLabel}>{periodLabel} Earnings</Text>
          <Text style={s.heroAmount}>{fmt(earnings?.total_earned ?? 0)}</Text>
          <View style={s.heroMeta}>
            <View style={s.heroMetaItem}>
              <Ionicons name="bag-check-outline" size={14} color="rgba(255,255,255,0.7)" />
              <Text style={s.heroMetaTxt}>{earnings?.total_deliveries ?? 0} deliveries</Text>
            </View>
            {avgEarning > 0 && (
              <View style={s.heroMetaItem}>
                <Ionicons name="trending-up-outline" size={14} color="rgba(255,255,255,0.7)" />
                <Text style={s.heroMetaTxt}>{fmt(avgEarning)} avg / delivery</Text>
              </View>
            )}
          </View>
        </LinearGradient>

        {/* Stats Row */}
        <View style={s.statsRow}>
          <View style={s.statBox}>
            <Text style={s.statVal}>{delivered.length}</Text>
            <Text style={s.statLbl}>Delivered</Text>
          </View>
          <View style={[s.statBox, s.statBoxMid]}>
            <Text style={[s.statVal, { color: '#EF4444' }]}>{cancelled.length}</Text>
            <Text style={s.statLbl}>Cancelled</Text>
          </View>
          <View style={s.statBox}>
            <Text style={[s.statVal, { color: '#FBBF24' }]}>{fmt(earnings?.wallet_balance ?? 0)}</Text>
            <Text style={s.statLbl}>Wallet</Text>
          </View>
        </View>

        {/* Bar Chart */}
        {earnings?.daily?.length > 1 && (
          <View style={s.chartCard}>
            <Text style={s.chartTitle}>Daily Breakdown</Text>
            <BarChart daily={earnings.daily} />
          </View>
        )}

        {/* History */}
        <View style={s.sectionHeader}>
          <Text style={s.sectionTitle}>Delivery History</Text>
          <Text style={s.sectionCount}>{filtered.length} orders</Text>
        </View>

        {filtered.length === 0 ? (
          <View style={s.empty}>
            <Text style={s.emptyEmoji}>🛵</Text>
            <Text style={s.emptyTitle}>
              {period === 'custom'
                ? 'No deliveries in this range'
                : `No deliveries ${period === 'all' ? 'yet' : `this ${PERIODS.find(p=>p.key===period)?.label.toLowerCase()}`}`}
            </Text>
            <Text style={s.emptySub}>Complete deliveries to see your earnings here</Text>
          </View>
        ) : (
          grouped.map(([dateLabel, orders]) => (
            <View key={dateLabel}>
              <View style={s.groupHeader}>
                <Text style={s.groupLabel}>{dateLabel}</Text>
                <Text style={s.groupEarned}>
                  {fmt(orders.filter(o=>o.status==='delivered').reduce((sum,o)=>sum+parseFloat(o.delivery_fee||0),0))}
                </Text>
              </View>
              {orders.map((order) => {
                const isDelivered = order.status === 'delivered';
                return (
                  <View key={order.id} style={s.histCard}>
                    <View style={[s.histIcon, !isDelivered && s.histIconCancelled]}>
                      <Text style={{ fontSize: 18 }}>{isDelivered ? '✅' : '❌'}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.histShop} numberOfLines={1}>{order.shop_name || 'Shop'}</Text>
                      <Text style={s.histTime}>{timeAgo(order.updated_at || order.created_at)}</Text>
                      <View style={[s.pill, !isDelivered && s.pillCancelled]}>
                        <Text style={[s.pillTxt, !isDelivered && s.pillTxtCancelled]}>
                          {isDelivered ? '✓ Delivered' : '✕ Cancelled'}
                        </Text>
                      </View>
                    </View>
                    {isDelivered && (
                      <View style={s.earnCol}>
                        <Text style={s.earnAmt}>{fmt(order.delivery_fee || 0)}</Text>
                        <Text style={s.earnLbl}>earned</Text>
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          ))
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Calendar Picker Modal */}
      <CalendarPicker
        visible={showCal}
        onClose={() => setShowCal(false)}
        onApply={handleApply}
        initialFrom={customFrom}
        initialTo={customTo}
      />

    </LinearGradient>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root:         { flex: 1 },
  header:       { paddingTop: Platform.OS === 'ios' ? 60 : 40, paddingBottom: 16, paddingHorizontal: 20 },
  title:        { fontSize: 26, fontWeight: '800', color: '#fff' },
  sub:          { fontSize: 13, color: 'rgba(255,255,255,0.45)', marginTop: 2, marginBottom: 16 },

  tabs:         { flexDirection: 'row', gap: 6 },
  tab:          { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 99,
                   backgroundColor: 'rgba(255,255,255,0.08)' },
  tabActive:    { backgroundColor: '#22C55E' },
  tabTxt:       { fontSize: 13, fontWeight: '700', color: 'rgba(255,255,255,0.45)' },
  tabTxtActive: { color: '#fff' },

  scroll:       { padding: 16, gap: 12 },

  heroCard:     { borderRadius: 20, padding: 22, gap: 6 },
  heroLabel:    { fontSize: 13, color: 'rgba(255,255,255,0.6)', fontWeight: '600' },
  heroAmount:   { fontSize: 42, fontWeight: '900', color: '#fff', letterSpacing: -1 },
  heroMeta:     { flexDirection: 'row', gap: 16, marginTop: 4 },
  heroMetaItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  heroMetaTxt:  { fontSize: 12, color: 'rgba(255,255,255,0.7)', fontWeight: '600' },

  statsRow:     { flexDirection: 'row', gap: 1 },
  statBox:      { flex: 1, backgroundColor: '#161616', padding: 14, alignItems: 'center', gap: 3,
                   borderWidth: 1, borderColor: '#222', borderRadius: 0 },
  statBoxMid:   { borderLeftWidth: 0, borderRightWidth: 0 },
  statVal:      { fontSize: 20, fontWeight: '800', color: '#22C55E' },
  statLbl:      { fontSize: 11, color: '#555', fontWeight: '600' },

  chartCard:    { backgroundColor: '#161616', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#222' },
  chartTitle:   { fontSize: 14, fontWeight: '700', color: '#fff', marginBottom: 10 },

  sectionHeader:{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: '#fff' },
  sectionCount: { fontSize: 13, color: '#555' },

  groupHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
                   paddingVertical: 8, paddingHorizontal: 2, marginTop: 4 },
  groupLabel:   { fontSize: 13, fontWeight: '700', color: '#555' },
  groupEarned:  { fontSize: 13, fontWeight: '700', color: '#22C55E' },

  histCard:     { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#161616',
                   borderRadius: 14, padding: 12, borderWidth: 1, borderColor: '#222', marginBottom: 8 },
  histIcon:     { width: 40, height: 40, borderRadius: 20, backgroundColor: '#052e16',
                   alignItems: 'center', justifyContent: 'center' },
  histIconCancelled: { backgroundColor: '#2D0A0A' },
  histShop:     { fontSize: 14, fontWeight: '700', color: '#fff', marginBottom: 2 },
  histTime:     { fontSize: 11, color: '#555', marginBottom: 5 },
  pill:         { alignSelf: 'flex-start', backgroundColor: '#052e16', borderRadius: 99,
                   paddingHorizontal: 8, paddingVertical: 3 },
  pillCancelled:{ backgroundColor: '#2D0A0A' },
  pillTxt:      { fontSize: 11, fontWeight: '700', color: '#22C55E' },
  pillTxtCancelled: { color: '#EF4444' },
  earnCol:      { alignItems: 'flex-end', gap: 2 },
  earnAmt:      { fontSize: 17, fontWeight: '800', color: '#22C55E' },
  earnLbl:      { fontSize: 10, color: '#555', fontWeight: '600' },

  empty:        { alignItems: 'center', paddingVertical: 40, gap: 10 },
  emptyEmoji:   { fontSize: 52 },
  emptyTitle:   { fontSize: 17, fontWeight: '700', color: '#fff' },
  emptySub:     { fontSize: 13, color: '#555', textAlign: 'center' },
});
