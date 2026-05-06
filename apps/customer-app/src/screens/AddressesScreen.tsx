import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, TextInput, Platform,
  KeyboardAvoidingView, ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { getAddresses, createAddress, deleteAddress, setDefaultAddress } from '../services/api';

const EMPTY_FORM = { label: '', full_address: '', lat: '', lng: '' };

export default function AddressesScreen({ navigation, route }: any) {
  const [addresses, setAddresses]       = useState<any[]>([]);
  const [loading, setLoading]           = useState(true);
  const [showForm, setShowForm]         = useState(false);
  const [form, setForm]                 = useState(EMPTY_FORM);
  const [saving, setSaving]             = useState(false);
  const [deletingId, setDeletingId]     = useState<string | null>(null);
  const [defaultingId, setDefaultingId] = useState<string | null>(null);

  // Optional: picker mode for CartScreen
  const pickerMode = route?.params?.pickerMode === true;
  const onPick     = route?.params?.onPick;

  const fetchAddresses = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getAddresses();
      const list = res.data?.addresses || res.data?.data || res.data || [];
      setAddresses(Array.isArray(list) ? list : []);
    } catch {
      setAddresses([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAddresses(); }, [fetchAddresses]);

  const handleAdd = async () => {
    if (!form.label.trim() || !form.full_address.trim()) {
      Alert.alert('Missing fields', 'Label and full address are required');
      return;
    }
    setSaving(true);
    try {
      await createAddress({
        label: form.label.trim(),
        full_address: form.full_address.trim(),
        lat: form.lat ? parseFloat(form.lat) : undefined,
        lng: form.lng ? parseFloat(form.lng) : undefined,
      });
      setForm(EMPTY_FORM);
      setShowForm(false);
      fetchAddresses();
    } catch (err: any) {
      Alert.alert('Failed to save', err?.response?.data?.error || err?.message || 'Please try again');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (id: string, label: string) => {
    Alert.alert(
      'Delete Address',
      `Remove "${label}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeletingId(id);
            try {
              await deleteAddress(id);
              fetchAddresses();
            } catch {
              Alert.alert('Failed', 'Could not delete address');
            } finally {
              setDeletingId(null);
            }
          },
        },
      ]
    );
  };

  const handleSetDefault = async (id: string) => {
    setDefaultingId(id);
    try {
      await setDefaultAddress(id);
      fetchAddresses();
    } catch {
      Alert.alert('Failed', 'Could not set default address');
    } finally {
      setDefaultingId(null);
    }
  };

  const handlePickAddress = (addr: any) => {
    if (pickerMode && onPick) {
      onPick(addr);
      navigation.goBack();
    }
  };

  const renderAddress = ({ item }: { item: any }) => (
    <TouchableOpacity
      style={[s.addrCard, item.is_default && s.addrCardDefault]}
      activeOpacity={pickerMode ? 0.8 : 1}
      onPress={() => pickerMode && handlePickAddress(item)}
    >
      <View style={s.addrTop}>
        <View style={s.addrIconWrap}>
          <Ionicons
            name={item.label?.toLowerCase().includes('home') ? 'home-outline'
              : item.label?.toLowerCase().includes('work') ? 'briefcase-outline'
              : 'location-outline'}
            size={18}
            color={item.is_default ? '#FF8A00' : '#888'}
          />
        </View>
        <View style={{ flex: 1 }}>
          <View style={s.addrLabelRow}>
            <Text style={s.addrLabel}>{item.label}</Text>
            {item.is_default && (
              <View style={s.defaultBadge}>
                <Ionicons name="star" size={10} color="#FF8A00" />
                <Text style={s.defaultBadgeTxt}>Default</Text>
              </View>
            )}
          </View>
          <Text style={s.addrFull} numberOfLines={2}>{item.full_address}</Text>
          {item.lat && item.lng ? (
            <Text style={s.addrCoords}>{parseFloat(item.lat).toFixed(4)}, {parseFloat(item.lng).toFixed(4)}</Text>
          ) : null}
        </View>
      </View>

      {!pickerMode && (
        <View style={s.addrActions}>
          {!item.is_default && (
            <TouchableOpacity
              style={s.setDefaultBtn}
              onPress={() => handleSetDefault(item.id)}
              disabled={defaultingId === item.id}
            >
              {defaultingId === item.id
                ? <ActivityIndicator size="small" color="#FF8A00" />
                : <>
                    <Ionicons name="star-outline" size={14} color="#FF8A00" />
                    <Text style={s.setDefaultTxt}>Set Default</Text>
                  </>
              }
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={s.deleteBtn}
            onPress={() => handleDelete(item.id, item.label)}
            disabled={deletingId === item.id}
          >
            {deletingId === item.id
              ? <ActivityIndicator size="small" color="#EF4444" />
              : <Ionicons name="trash-outline" size={16} color="#EF4444" />
            }
          </TouchableOpacity>
        </View>
      )}

      {pickerMode && (
        <Ionicons name="chevron-forward" size={18} color="#CCC" />
      )}
    </TouchableOpacity>
  );

  return (
    <KeyboardAvoidingView
      style={s.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Header */}
      <LinearGradient colors={['#FF8A00', '#FF5C00']} style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={20} color="#fff" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>{pickerMode ? 'Select Address' : 'Saved Addresses'}</Text>
        <TouchableOpacity
          style={s.addBtn}
          onPress={() => setShowForm(v => !v)}
        >
          <Ionicons name={showForm ? 'close' : 'add'} size={20} color="#fff" />
        </TouchableOpacity>
      </LinearGradient>

      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

        {/* Add Address Form */}
        {showForm && (
          <View style={s.formCard}>
            <Text style={s.formTitle}>Add New Address</Text>

            <Text style={s.inputLabel}>Label</Text>
            <TextInput
              style={s.textInput}
              placeholder="e.g. Home, Work, Parents…"
              placeholderTextColor="#AAA"
              value={form.label}
              onChangeText={v => setForm(f => ({ ...f, label: v }))}
            />

            <Text style={s.inputLabel}>Full Address</Text>
            <TextInput
              style={[s.textInput, { minHeight: 72, textAlignVertical: 'top' }]}
              placeholder="Street, Area, City, Pincode"
              placeholderTextColor="#AAA"
              multiline
              value={form.full_address}
              onChangeText={v => setForm(f => ({ ...f, full_address: v }))}
            />

            <View style={s.coordsRow}>
              <View style={{ flex: 1 }}>
                <Text style={s.inputLabel}>Latitude (opt.)</Text>
                <TextInput
                  style={s.textInput}
                  placeholder="12.9116"
                  placeholderTextColor="#AAA"
                  keyboardType="decimal-pad"
                  value={form.lat}
                  onChangeText={v => setForm(f => ({ ...f, lat: v }))}
                />
              </View>
              <View style={{ width: 12 }} />
              <View style={{ flex: 1 }}>
                <Text style={s.inputLabel}>Longitude (opt.)</Text>
                <TextInput
                  style={s.textInput}
                  placeholder="77.6389"
                  placeholderTextColor="#AAA"
                  keyboardType="decimal-pad"
                  value={form.lng}
                  onChangeText={v => setForm(f => ({ ...f, lng: v }))}
                />
              </View>
            </View>

            <TouchableOpacity
              style={[s.saveBtn, saving && { opacity: 0.6 }]}
              onPress={handleAdd}
              disabled={saving}
            >
              {saving
                ? <ActivityIndicator color="#fff" />
                : <Text style={s.saveBtnTxt}>Save Address</Text>
              }
            </TouchableOpacity>
          </View>
        )}

        {/* Address List */}
        {loading ? (
          <View style={s.center}>
            <ActivityIndicator size="large" color="#FF8A00" />
            <Text style={s.loadTxt}>Loading addresses…</Text>
          </View>
        ) : addresses.length === 0 ? (
          <View style={s.empty}>
            <Text style={{ fontSize: 48, marginBottom: 12 }}>📍</Text>
            <Text style={s.emptyTitle}>No saved addresses</Text>
            <Text style={s.emptySub}>Add your home or work address for faster checkout</Text>
            {!showForm && (
              <TouchableOpacity onPress={() => setShowForm(true)} style={{ marginTop: 12 }}>
                <LinearGradient colors={['#FF8A00', '#FF5C00']} style={s.addFirstBtn}
                  start={{ x:0,y:0 }} end={{ x:1,y:0 }}>
                  <Text style={s.addFirstTxt}>Add Address</Text>
                </LinearGradient>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <View style={{ padding: 16, gap: 12 }}>
            {addresses.map(item => (
              <React.Fragment key={item.id}>
                {renderAddress({ item })}
              </React.Fragment>
            ))}
          </View>
        )}

        <View style={{ height: 60 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root:        { flex: 1, backgroundColor: '#F7F8FA' },
  header:      { paddingTop: Platform.OS === 'ios' ? 56 : 36, paddingBottom: 16,
                  paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  backBtn:     { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.2)',
                  alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '800', color: '#fff' },
  addBtn:      { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.2)',
                  alignItems: 'center', justifyContent: 'center' },

  formCard:    { backgroundColor: '#fff', margin: 16, borderRadius: 20, padding: 18,
                  shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width:0, height:3 } },
  formTitle:   { fontSize: 16, fontWeight: '800', color: '#111', marginBottom: 16 },
  inputLabel:  { fontSize: 12, fontWeight: '700', color: '#888', marginBottom: 6,
                  textTransform: 'uppercase', letterSpacing: 0.5 },
  textInput:   { backgroundColor: '#F7F8FA', borderRadius: 12, padding: 12, fontSize: 14,
                  color: '#111', borderWidth: 1, borderColor: '#E5E7EB', marginBottom: 14 },
  coordsRow:   { flexDirection: 'row' },
  saveBtn:     { backgroundColor: '#FF8A00', borderRadius: 14, height: 50,
                  alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  saveBtnTxt:  { color: '#fff', fontSize: 15, fontWeight: '800' },

  center:      { padding: 40, alignItems: 'center', gap: 8 },
  loadTxt:     { fontSize: 13, color: '#888' },
  empty:       { padding: 40, alignItems: 'center', gap: 8 },
  emptyTitle:  { fontSize: 18, fontWeight: '700', color: '#333' },
  emptySub:    { fontSize: 13, color: '#999', textAlign: 'center', lineHeight: 20 },
  addFirstBtn: { borderRadius: 14, paddingHorizontal: 32, paddingVertical: 13 },
  addFirstTxt: { color: '#fff', fontSize: 15, fontWeight: '700' },

  addrCard:    { backgroundColor: '#fff', borderRadius: 18, padding: 16,
                  shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width:0, height:2 } },
  addrCardDefault: { borderWidth: 1.5, borderColor: '#FF8A00' },
  addrTop:     { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 10 },
  addrIconWrap:{ width: 40, height: 40, borderRadius: 12, backgroundColor: '#FFF4E6',
                  alignItems: 'center', justifyContent: 'center' },
  addrLabelRow:{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  addrLabel:   { fontSize: 15, fontWeight: '700', color: '#111' },
  defaultBadge:{ flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#FFF4E6',
                  borderRadius: 99, paddingHorizontal: 8, paddingVertical: 3 },
  defaultBadgeTxt:{ fontSize: 11, fontWeight: '700', color: '#FF8A00' },
  addrFull:    { fontSize: 13, color: '#555', lineHeight: 18 },
  addrCoords:  { fontSize: 11, color: '#BBB', marginTop: 4 },
  addrActions: { flexDirection: 'row', alignItems: 'center', gap: 8,
                  borderTopWidth: 0.5, borderTopColor: '#F5F5F5', paddingTop: 10 },
  setDefaultBtn:{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                  gap: 5, borderRadius: 10, borderWidth: 1.5, borderColor: '#FF8A00',
                  paddingVertical: 8, backgroundColor: '#FFF4E6' },
  setDefaultTxt:{ fontSize: 13, fontWeight: '700', color: '#FF8A00' },
  deleteBtn:   { width: 40, height: 38, borderRadius: 10, borderWidth: 1.5,
                  borderColor: '#FECACA', backgroundColor: '#FEF2F2',
                  alignItems: 'center', justifyContent: 'center' },
});
