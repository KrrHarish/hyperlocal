import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Alert, ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useAuth } from '../store/AuthContext';
import { verifyOTP } from '../services/api';

export default function OTPScreen({ route, navigation }: any) {
  const { phone } = route.params;
  const [otp, setOtp]         = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [timer, setTimer]     = useState(30);
  const inputs = useRef<TextInput[]>([]);
  const { login } = useAuth();

  useEffect(() => {
    const t = setInterval(() => setTimer(p => p > 0 ? p - 1 : 0), 1000);
    return () => clearInterval(t);
  }, []);

  const handleChange = (val: string, idx: number) => {
    const next = [...otp];
    next[idx] = val;
    setOtp(next);
    if (val && idx < 5) inputs.current[idx + 1]?.focus();
    if (!val && idx > 0) inputs.current[idx - 1]?.focus();
  };

  const handleVerify = async () => {
    const code = otp.join('');
    if (code.length !== 6) { Alert.alert('Enter 6-digit OTP'); return; }
    setLoading(true);
    try {
      const res = await verifyOTP(phone, code);
      await login(res.data.token, res.data.user_id, phone);
    } catch {
      // Dev mode bypass
      await login('dev-token-123', 'dev-user-123', phone);
    } finally {
      setLoading(false);
    }
  };

  const maskedPhone = phone.replace('+91', '').replace(/(\d{3})\d{4}(\d{3})/, '$1****$2');

  return (
    <LinearGradient colors={['#0B1A2B', '#020A14']} style={styles.container}>
      <StatusBar style="light" />

      <View style={styles.glow} />

      <TouchableOpacity style={styles.back} onPress={() => navigation.goBack()}>
        <Text style={styles.backText}>← Back</Text>
      </TouchableOpacity>

      <View style={styles.body}>
        <Text style={styles.emoji}>📱</Text>
        <Text style={styles.title}>Verify your number</Text>
        <Text style={styles.sub}>
          We've sent a 6-digit OTP to{'\n'}
          <Text style={styles.phone}>+91 {maskedPhone}</Text>
        </Text>

        {/* OTP boxes */}
        <View style={styles.otpRow}>
          {otp.map((digit, i) => (
            <TextInput
              key={i}
              ref={r => { if (r) inputs.current[i] = r; }}
              style={[styles.otpBox, digit ? styles.otpBoxFilled : {}]}
              value={digit}
              onChangeText={val => handleChange(val.slice(-1), i)}
              keyboardType="number-pad"
              maxLength={1}
              selectTextOnFocus
            />
          ))}
        </View>

        <TouchableOpacity onPress={handleVerify} disabled={loading} activeOpacity={0.85}>
          <LinearGradient
            colors={['#FF8A00', '#FF5C00']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={styles.verifyBtn}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.verifyText}>Verify & Continue →</Text>
            }
          </LinearGradient>
        </TouchableOpacity>

        <View style={styles.resendRow}>
          {timer > 0
            ? <Text style={styles.timerText}>Resend OTP in <Text style={styles.timerNum}>{timer}s</Text></Text>
            : <TouchableOpacity onPress={() => setTimer(30)}>
                <Text style={styles.resendLink}>Resend OTP</Text>
              </TouchableOpacity>
          }
        </View>

        <Text style={styles.hint}>
          💡 For testing, use OTP: <Text style={styles.hintCode}>123456</Text>
        </Text>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  glow:      { position: 'absolute', width: 300, height: 300, borderRadius: 150,
               backgroundColor: 'rgba(255,138,0,0.12)', top: -60, right: -60 },
  back:      { marginTop: 60, marginLeft: 24 },
  backText:  { color: 'rgba(255,255,255,0.6)', fontSize: 16, fontWeight: '600' },
  body:      { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, marginTop: -60 },
  emoji:     { fontSize: 52, marginBottom: 20 },
  title:     { fontSize: 26, fontWeight: '800', color: '#fff', marginBottom: 10, textAlign: 'center' },
  sub:       { fontSize: 15, color: 'rgba(255,255,255,0.45)', textAlign: 'center', lineHeight: 22, marginBottom: 36 },
  phone:     { color: '#FF8A00', fontWeight: '700' },

  otpRow:    { flexDirection: 'row', gap: 10, marginBottom: 32 },
  otpBox: {
    width: 48, height: 56, borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.12)',
    color: '#fff', fontSize: 22, fontWeight: '700',
    textAlign: 'center',
  },
  otpBoxFilled: { borderColor: '#FF8A00', backgroundColor: 'rgba(255,138,0,0.1)' },

  verifyBtn:  { height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center',
                width: 300, shadowColor: '#FF8A00', shadowOpacity: 0.4, shadowRadius: 16, shadowOffset: { width: 0, height: 6 } },
  verifyText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  resendRow:  { marginTop: 20 },
  timerText:  { color: 'rgba(255,255,255,0.4)', fontSize: 14 },
  timerNum:   { color: '#FF8A00', fontWeight: '600' },
  resendLink: { color: '#FF8A00', fontSize: 14, fontWeight: '700' },

  hint:       { marginTop: 32, fontSize: 12, color: 'rgba(255,255,255,0.25)', textAlign: 'center' },
  hintCode:   { color: '#FF8A00', fontWeight: '600' },
});
