import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform,
  Alert, ActivityIndicator, ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { colors, radius, spacing } from '../theme';
import { sendOTP } from '../services/api';

const ZuquWordmark = () => (
  <View style={wm.row}>
    {/* Speed lines */}
    <View style={wm.lines}>
      <View style={[wm.line, { width: 30, opacity: 1.0 }]} />
      <View style={[wm.line, { width: 24, opacity: 0.65 }]} />
      <View style={[wm.line, { width: 18, opacity: 0.35 }]} />
    </View>
    {/* Zu — orange */}
    <Text style={wm.zu}>Zu</Text>
    {/* Qu — white */}
    <Text style={wm.qu}>Qu</Text>
  </View>
);

export default function LoginScreen({ navigation }: any) {
  const [phone, setPhone]     = useState('');
  const [loading, setLoading] = useState(false);

  const handleSendOTP = async () => {
    const cleaned = phone.replace(/\s/g, '');
    if (cleaned.length !== 10) {
      Alert.alert('Invalid number', 'Please enter a valid 10-digit mobile number');
      return;
    }
    setLoading(true);
    try {
      await sendOTP(`+91${cleaned}`);
      navigation.navigate('OTP', { phone: `+91${cleaned}` });
    } catch (err: any) {
      navigation.navigate('OTP', { phone: `+91${cleaned}` });
    } finally {
      setLoading(false);
    }
  };

  return (
    <LinearGradient colors={['#0B1A2B', '#020A14']} style={styles.container}>
      <StatusBar style="light" />

      <View style={styles.glow1} />
      <View style={styles.glow2} />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

          {/* Brand */}
          <View style={styles.brandArea}>
            <ZuquWordmark />
            <Text style={styles.tagline}>YOUR NEIGHBOURHOOD · INSTANT</Text>
          </View>

          {/* Form */}
          <View style={styles.formArea}>
            <Text style={styles.heading}>Welcome back 👋</Text>
            <Text style={styles.subheading}>Enter your mobile number to get started</Text>

            <Text style={styles.label}>MOBILE NUMBER</Text>
            <View style={styles.inputWrap}>
              <Text style={styles.prefix}>+91</Text>
              <TextInput
                style={styles.input}
                placeholder="98765 43210"
                placeholderTextColor="rgba(255,255,255,0.25)"
                keyboardType="number-pad"
                maxLength={10}
                value={phone}
                onChangeText={setPhone}
                returnKeyType="done"
                onSubmitEditing={handleSendOTP}
              />
            </View>

            <TouchableOpacity onPress={handleSendOTP} disabled={loading} activeOpacity={0.85}>
              <LinearGradient
                colors={['#FF8A00', '#FF5C00']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={styles.otpBtn}
              >
                {loading
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.otpBtnText}>Send OTP →</Text>
                }
              </LinearGradient>
            </TouchableOpacity>

            <View style={styles.divider}>
              <View style={styles.divLine} />
              <Text style={styles.divText}>or continue with</Text>
              <View style={styles.divLine} />
            </View>

            <View style={styles.socialRow}>
              <TouchableOpacity style={styles.socialBtn} activeOpacity={0.8}>
                <Text style={styles.socialIcon}>G</Text>
                <Text style={styles.socialText}>Google</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.socialBtn} activeOpacity={0.8}>
                <Text style={styles.socialIcon}></Text>
                <Text style={styles.socialText}>Apple</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.terms}>
              By continuing you agree to our{' '}
              <Text style={styles.link}>Terms of Service</Text> and{' '}
              <Text style={styles.link}>Privacy Policy</Text>
            </Text>

            <Text style={styles.signup}>
              New to Zuqu?{' '}
              <Text style={styles.link}>Create account</Text>
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

// Wordmark sub-styles
const wm = StyleSheet.create({
  row:   { flexDirection: 'row', alignItems: 'center' },
  lines: { marginRight: 10, gap: 7, justifyContent: 'center' },
  line:  { height: 4, borderRadius: 2, backgroundColor: '#FF8A00' },
  zu:    { fontSize: 56, fontWeight: '900', color: '#FF8A00', letterSpacing: -1 },
  qu:    { fontSize: 56, fontWeight: '900', color: '#FFFFFF', letterSpacing: -1 },
});

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll:    { flexGrow: 1, paddingBottom: 40 },
  glow1: {
    position: 'absolute', width: 300, height: 300, borderRadius: 150,
    backgroundColor: 'rgba(255,138,0,0.12)', top: -80, left: -80,
  },
  glow2: {
    position: 'absolute', width: 200, height: 200, borderRadius: 100,
    backgroundColor: 'rgba(255,92,0,0.08)', top: 150, right: -60,
  },

  brandArea: { alignItems: 'center', paddingTop: 72, paddingBottom: 32 },
  tagline:   { marginTop: 8, fontSize: 11, color: 'rgba(255,255,255,0.4)', letterSpacing: 2.5 },

  formArea:   { paddingHorizontal: 28 },
  heading:    { fontSize: 26, fontWeight: '700', color: '#fff', marginBottom: 6 },
  subheading: { fontSize: 14, color: 'rgba(255,255,255,0.45)', marginBottom: 24, lineHeight: 20 },
  label:      { fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.45)', letterSpacing: 1, marginBottom: 8 },
  inputWrap:  {
    flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.1)', borderRadius: 14,
    marginBottom: 14, paddingHorizontal: 16,
  },
  prefix:     { fontSize: 16, fontWeight: '700', color: '#FF8A00', marginRight: 8 },
  input:      { flex: 1, height: 52, color: '#fff', fontSize: 16, fontWeight: '500' },
  otpBtn:     {
    height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center',
    marginBottom: 24, shadowColor: '#FF8A00', shadowOpacity: 0.4, shadowRadius: 16, shadowOffset: { width: 0, height: 6 },
  },
  otpBtnText: { color: '#fff', fontSize: 16, fontWeight: '700', letterSpacing: 0.3 },

  divider:    { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 },
  divLine:    { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.08)' },
  divText:    { color: 'rgba(255,255,255,0.35)', fontSize: 12, fontWeight: '500' },

  socialRow:  { flexDirection: 'row', gap: 12, marginBottom: 24 },
  socialBtn:  {
    flex: 1, height: 52, backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.1)', borderRadius: 14,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  socialIcon: { fontSize: 18, fontWeight: '700', color: '#fff' },
  socialText: { fontSize: 14, fontWeight: '600', color: '#fff' },

  terms:  { textAlign: 'center', fontSize: 12, color: 'rgba(255,255,255,0.35)', lineHeight: 18, marginBottom: 16 },
  link:   { color: '#FF8A00', fontWeight: '600' },
  signup: { textAlign: 'center', fontSize: 14, color: 'rgba(255,255,255,0.45)' },
});
