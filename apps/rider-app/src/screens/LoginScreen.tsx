import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Platform, KeyboardAvoidingView, ScrollView, ActivityIndicator, Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { riderLogin, riderRegister } from '../api/client';
import { useAuth } from '../store/AuthContext';

type Step = 'phone' | 'register';

export default function LoginScreen() {
  const { login } = useAuth();
  const [step,        setStep]        = useState<Step>('phone');
  const [phone,       setPhone]       = useState('');
  const [name,        setName]        = useState('');
  const [vehicleType, setVehicleType] = useState<'bike' | 'scooter' | 'bicycle'>('bike');
  const [loading,     setLoading]     = useState(false);

  const handlePhoneSubmit = async () => {
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length !== 10) {
      Alert.alert('Invalid number', 'Enter a valid 10-digit mobile number');
      return;
    }
    setLoading(true);
    try {
      const res = await riderLogin(cleaned);
      await login(res.data.token, res.data.rider);
    } catch (err: any) {
      if (err.response?.status === 404) {
        // Rider not found — show registration form
        setStep('register');
      } else {
        Alert.alert('Error', err.response?.data?.error || 'Login failed');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    if (!name.trim()) {
      Alert.alert('Required', 'Please enter your full name');
      return;
    }
    const cleaned = phone.replace(/\D/g, '');
    setLoading(true);
    try {
      await riderRegister(cleaned, name.trim(), vehicleType);
      const res = await riderLogin(cleaned);
      await login(res.data.token, res.data.rider);
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.error || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const vehicles: { key: 'bike' | 'scooter' | 'bicycle'; icon: string; label: string }[] = [
    { key: 'bike',    icon: '🏍️', label: 'Bike'    },
    { key: 'scooter', icon: '🛵', label: 'Scooter' },
    { key: 'bicycle', icon: '🚲', label: 'Bicycle' },
  ];

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <LinearGradient colors={['#0A0A0A', '#111827']} style={s.root}>
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">

          {/* Logo */}
          <View style={s.logoWrap}>
            <LinearGradient colors={['#16A34A', '#15803D']} style={s.logoCircle}>
              <Text style={s.logoIcon}>🛵</Text>
            </LinearGradient>
            <Text style={s.appName}>Zuqu Rider</Text>
            <Text style={s.tagline}>Deliver with confidence</Text>
          </View>

          {/* Card */}
          <View style={s.card}>
            {step === 'phone' ? (
              <>
                <Text style={s.cardTitle}>Welcome back</Text>
                <Text style={s.cardSub}>Enter your registered mobile number</Text>

                <View style={s.inputWrap}>
                  <View style={s.prefix}>
                    <Text style={s.prefixTxt}>🇮🇳 +91</Text>
                  </View>
                  <TextInput
                    style={s.input}
                    placeholder="10-digit mobile number"
                    placeholderTextColor="#555"
                    keyboardType="phone-pad"
                    maxLength={10}
                    value={phone}
                    onChangeText={setPhone}
                    onSubmitEditing={handlePhoneSubmit}
                  />
                </View>

                <TouchableOpacity style={s.btn} onPress={handlePhoneSubmit} disabled={loading}>
                  <LinearGradient colors={['#16A34A', '#15803D']} style={s.btnGrad}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                    {loading
                      ? <ActivityIndicator color="#fff" />
                      : <Text style={s.btnTxt}>Continue →</Text>
                    }
                  </LinearGradient>
                </TouchableOpacity>

                <Text style={s.newRider}>New rider? Enter your number and we'll register you.</Text>
              </>
            ) : (
              <>
                <TouchableOpacity onPress={() => setStep('phone')} style={s.back}>
                  <Ionicons name="arrow-back" size={18} color="#22C55E" />
                  <Text style={s.backTxt}>Back</Text>
                </TouchableOpacity>

                <Text style={s.cardTitle}>Create account</Text>
                <Text style={s.cardSub}>+91 {phone} · Tell us about yourself</Text>

                <Text style={s.label}>Full Name</Text>
                <TextInput
                  style={s.plainInput}
                  placeholder="Your full name"
                  placeholderTextColor="#555"
                  value={name}
                  onChangeText={setName}
                  autoCapitalize="words"
                />

                <Text style={s.label}>Vehicle Type</Text>
                <View style={s.vehicleRow}>
                  {vehicles.map(v => (
                    <TouchableOpacity
                      key={v.key}
                      style={[s.vehicleBtn, vehicleType === v.key && s.vehicleBtnActive]}
                      onPress={() => setVehicleType(v.key)}
                    >
                      <Text style={s.vehicleIcon}>{v.icon}</Text>
                      <Text style={[s.vehicleLbl, vehicleType === v.key && s.vehicleLblActive]}>
                        {v.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <TouchableOpacity style={s.btn} onPress={handleRegister} disabled={loading}>
                  <LinearGradient colors={['#16A34A', '#15803D']} style={s.btnGrad}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                    {loading
                      ? <ActivityIndicator color="#fff" />
                      : <Text style={s.btnTxt}>Start Delivering 🚀</Text>
                    }
                  </LinearGradient>
                </TouchableOpacity>
              </>
            )}
          </View>

        </ScrollView>
      </LinearGradient>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root:        { flex: 1 },
  scroll:      { flexGrow: 1, justifyContent: 'center', padding: 24 },
  logoWrap:    { alignItems: 'center', marginBottom: 36 },
  logoCircle:  { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  logoIcon:    { fontSize: 38 },
  appName:     { fontSize: 28, fontWeight: '800', color: '#fff', letterSpacing: 0.5 },
  tagline:     { fontSize: 14, color: '#555', marginTop: 4 },
  card:        { backgroundColor: '#1A1A1A', borderRadius: 24, padding: 24, borderWidth: 1, borderColor: '#2A2A2A' },
  cardTitle:   { fontSize: 22, fontWeight: '800', color: '#fff', marginBottom: 4 },
  cardSub:     { fontSize: 13, color: '#777', marginBottom: 24 },
  inputWrap:   { flexDirection: 'row', backgroundColor: '#111', borderRadius: 14, borderWidth: 1, borderColor: '#333', marginBottom: 16, overflow: 'hidden' },
  prefix:      { paddingHorizontal: 14, justifyContent: 'center', borderRightWidth: 1, borderRightColor: '#333' },
  prefixTxt:   { fontSize: 14, color: '#aaa', fontWeight: '600' },
  input:       { flex: 1, paddingHorizontal: 14, paddingVertical: 14, fontSize: 16, color: '#fff', fontWeight: '600' },
  plainInput:  { backgroundColor: '#111', borderRadius: 14, borderWidth: 1, borderColor: '#333', paddingHorizontal: 14, paddingVertical: 14, fontSize: 16, color: '#fff', marginBottom: 16 },
  label:       { fontSize: 12, fontWeight: '700', color: '#666', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  vehicleRow:  { flexDirection: 'row', gap: 10, marginBottom: 20 },
  vehicleBtn:  { flex: 1, backgroundColor: '#111', borderRadius: 14, borderWidth: 1.5, borderColor: '#333', alignItems: 'center', paddingVertical: 14, gap: 4 },
  vehicleBtnActive: { borderColor: '#22C55E', backgroundColor: '#052e16' },
  vehicleIcon: { fontSize: 24 },
  vehicleLbl:  { fontSize: 12, fontWeight: '700', color: '#555' },
  vehicleLblActive: { color: '#22C55E' },
  btn:         { borderRadius: 16, overflow: 'hidden', marginTop: 4 },
  btnGrad:     { paddingVertical: 16, alignItems: 'center', justifyContent: 'center' },
  btnTxt:      { color: '#fff', fontSize: 16, fontWeight: '800' },
  newRider:    { textAlign: 'center', fontSize: 12, color: '#444', marginTop: 16 },
  back:        { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 16 },
  backTxt:     { color: '#22C55E', fontSize: 14, fontWeight: '600' },
});
