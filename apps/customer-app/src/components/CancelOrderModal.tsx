import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Modal, ActivityIndicator, Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { cancelOrder } from '../services/api';

const REASONS = [
  'I changed my mind',
  'Ordered by mistake',
  'Delivery is taking too long',
  'Found a better price elsewhere',
  'Other',
];

interface Props {
  visible:     boolean;
  orderId:     string;
  orderStatus: string;
  createdAt:   string;
  onClose:     () => void;
  onCancelled: () => void;
}

export default function CancelOrderModal({
  visible, orderId, orderStatus, createdAt, onClose, onCancelled,
}: Props) {
  const [reason, setReason]       = useState('');
  const [loading, setLoading]     = useState(false);
  const [cancelled, setCancelled] = useState(false);

  useEffect(() => {
    if (!cancelled) return;
    const t = setTimeout(onCancelled, 1800);
    return () => clearTimeout(t);
  }, [cancelled]);

  const elapsed   = Date.now() - new Date(createdAt).getTime();
  const remaining = Math.max(0, 5 * 60 * 1000 - elapsed);
  const minsLeft  = Math.floor(remaining / 60000);
  const secsLeft  = Math.floor((remaining % 60000) / 1000);
  const canCancel = remaining > 0 || orderStatus === 'pending';
  const isPickedUp = ['picked_up', 'out_for_delivery', 'delivered'].includes(orderStatus);

  const handleCancel = async () => {
    if (!reason) { Alert.alert('Select a reason', 'Please select a reason for cancellation'); return; }
    setLoading(true);
    try {
      await cancelOrder(orderId, reason);
      setCancelled(true);
    } catch (err: any) {
      const msg = err?.response?.data?.error || 'Could not cancel order. Please try again.';
      Alert.alert('Cancellation Failed', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.overlay}>
        <View style={s.sheet}>

          <View style={s.handle} />

          {cancelled ? (
            /* ── Success confirmation ── */
            <View style={s.successCard}>
              <View style={s.successCircle}>
                <Ionicons name="checkmark" size={36} color="#fff" />
              </View>
              <Text style={s.successTitle}>Order Cancelled</Text>
              <Text style={s.successSub}>Your order has been cancelled successfully.</Text>
              {!!reason && <Text style={s.successReason}>Reason: {reason}</Text>}
            </View>
          ) : (
            <>
              {/* Header */}
              <View style={s.header}>
                <Text style={s.title}>Cancel Order</Text>
                <TouchableOpacity onPress={onClose} style={s.closeBtn}>
                  <Ionicons name="close" size={22} color="#666" />
                </TouchableOpacity>
              </View>

              {/* Cannot cancel states */}
              {isPickedUp ? (
                <View style={s.blockedCard}>
                  <Text style={s.blockedEmoji}>🛵</Text>
                  <Text style={s.blockedTitle}>Cannot Cancel</Text>
                  <Text style={s.blockedSub}>
                    Your rider has already picked up the order and is on the way.
                    You can no longer cancel.
                  </Text>
                  <TouchableOpacity style={s.supportBtn} onPress={onClose}>
                    <Text style={s.supportTxt}>Contact Support</Text>
                  </TouchableOpacity>
                </View>
              ) : !canCancel ? (
                <View style={s.blockedCard}>
                  <Text style={s.blockedEmoji}>⏰</Text>
                  <Text style={s.blockedTitle}>Window Expired</Text>
                  <Text style={s.blockedSub}>
                    The 5-minute cancellation window has passed.
                    Please contact support for assistance.
                  </Text>
                  <TouchableOpacity style={s.supportBtn} onPress={onClose}>
                    <Text style={s.supportTxt}>Contact Support</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <>
                  {remaining > 0 && remaining < 5 * 60 * 1000 && (
                    <View style={s.timerCard}>
                      <Ionicons name="time-outline" size={16} color="#D97706" />
                      <Text style={s.timerTxt}>
                        Cancel within <Text style={s.timerBold}>{minsLeft}:{secsLeft.toString().padStart(2, '0')}</Text> to get instant cancellation
                      </Text>
                    </View>
                  )}

                  <Text style={s.sectionLabel}>Why are you cancelling?</Text>
                  <View style={s.reasons}>
                    {REASONS.map(r => (
                      <TouchableOpacity key={r} style={[s.reasonRow, reason === r && s.reasonRowActive]}
                        onPress={() => setReason(r)}>
                        <Text style={[s.reasonTxt, reason === r && s.reasonTxtActive]}>{r}</Text>
                        <View style={[s.radioOuter, reason === r && s.radioOuterActive]}>
                          {reason === r && <View style={s.radioInner} />}
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <View style={s.refundNote}>
                    <Ionicons name="information-circle-outline" size={16} color="#3B82F6" />
                    <Text style={s.refundTxt}>
                      If paid online, refund will be credited within 5-7 business days
                    </Text>
                  </View>

                  <View style={s.btnRow}>
                    <TouchableOpacity style={s.keepBtn} onPress={onClose}>
                      <Text style={s.keepTxt}>Keep Order</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={{ flex: 1, borderRadius: 14, overflow: 'hidden' }}
                      onPress={handleCancel} disabled={loading} activeOpacity={0.88}>
                      <LinearGradient colors={['#EF4444', '#DC2626']} style={s.cancelBtn}
                        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                        {loading
                          ? <ActivityIndicator color="#fff" />
                          : <Text style={s.cancelTxt}>Cancel Order</Text>
                        }
                      </LinearGradient>
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </>
          )}

        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay:          { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet:            { backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28,
                       padding: 24, paddingBottom: 40 },
  handle:           { width: 40, height: 4, borderRadius: 2, backgroundColor: '#E5E7EB',
                       alignSelf: 'center', marginBottom: 20 },

  successCard:      { alignItems: 'center', paddingVertical: 28, gap: 10 },
  successCircle:    { width: 72, height: 72, borderRadius: 36, backgroundColor: '#22C55E',
                       alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  successTitle:     { fontSize: 20, fontWeight: '800', color: '#111' },
  successSub:       { fontSize: 14, color: '#666', textAlign: 'center', lineHeight: 20 },
  successReason:    { fontSize: 13, color: '#999', textAlign: 'center' },

  header:           { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 },
  title:            { fontSize: 20, fontWeight: '800', color: '#111' },
  closeBtn:         { width: 32, height: 32, borderRadius: 16, backgroundColor: '#F5F5F5',
                       alignItems: 'center', justifyContent: 'center' },

  blockedCard:      { alignItems: 'center', paddingVertical: 24, gap: 10 },
  blockedEmoji:     { fontSize: 48 },
  blockedTitle:     { fontSize: 18, fontWeight: '800', color: '#111' },
  blockedSub:       { fontSize: 14, color: '#888', textAlign: 'center', lineHeight: 20 },
  supportBtn:       { backgroundColor: '#F5F5F5', borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 },
  supportTxt:       { fontSize: 14, fontWeight: '700', color: '#333' },

  timerCard:        { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FFFBEB',
                       borderRadius: 12, padding: 12, marginBottom: 16, borderWidth: 1, borderColor: '#FDE68A' },
  timerTxt:         { fontSize: 13, color: '#92400E', flex: 1 },
  timerBold:        { fontWeight: '800', color: '#D97706' },

  sectionLabel:     { fontSize: 14, fontWeight: '700', color: '#333', marginBottom: 10 },
  reasons:          { gap: 8, marginBottom: 18 },
  reasonRow:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                       padding: 14, borderRadius: 12, borderWidth: 1.5, borderColor: '#F0F0F0',
                       backgroundColor: '#FAFAFA' },
  reasonRowActive:  { borderColor: '#EF4444', backgroundColor: '#FEF2F2' },
  reasonTxt:        { fontSize: 14, color: '#444', fontWeight: '500' },
  reasonTxtActive:  { color: '#DC2626', fontWeight: '700' },
  radioOuter:       { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: '#DDD',
                       alignItems: 'center', justifyContent: 'center' },
  radioOuterActive: { borderColor: '#EF4444' },
  radioInner:       { width: 10, height: 10, borderRadius: 5, backgroundColor: '#EF4444' },

  refundNote:       { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#EFF6FF',
                       borderRadius: 12, padding: 12, marginBottom: 20, borderWidth: 1, borderColor: '#BFDBFE' },
  refundTxt:        { fontSize: 12, color: '#1D4ED8', flex: 1, lineHeight: 17 },

  btnRow:           { flexDirection: 'row', gap: 10 },
  keepBtn:          { flex: 1, height: 52, backgroundColor: '#F5F5F5', borderRadius: 14,
                       alignItems: 'center', justifyContent: 'center' },
  keepTxt:          { fontSize: 14, fontWeight: '700', color: '#333' },
  cancelBtn:        { height: 52, alignItems: 'center', justifyContent: 'center' },
  cancelTxt:        { fontSize: 14, fontWeight: '800', color: '#fff' },
});
