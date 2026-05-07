import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput,
  TouchableOpacity, KeyboardAvoidingView, Platform,
  ActivityIndicator, StatusBar, Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getChatMessages, sendChatMessage, WS_URL } from '../services/api';

interface Msg {
  id: string;
  sender_role: 'customer' | 'shop';
  body: string;
  created_at: string;
  is_read: boolean;
  _pending?: boolean;   // optimistic — shown while awaiting server confirm
  _failed?: boolean;    // shown when send failed
}

export default function ChatScreen({ route, navigation }: any) {
  const { shopId, shopName } = route.params as { shopId: string; shopName: string };
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input,    setInput]    = useState('');
  const [loading,  setLoading]  = useState(true);
  const [sending,  setSending]  = useState(false);
  const [errMsg,   setErrMsg]   = useState('');
  const errOpacity = useRef(new Animated.Value(0)).current;
  const flatRef    = useRef<FlatList>(null);
  const wsRef      = useRef<WebSocket | null>(null);
  const destroyed  = useRef(false);

  // ── Show a brief error toast ──────────────────────────────────────
  const showError = (msg: string) => {
    setErrMsg(msg);
    Animated.sequence([
      Animated.timing(errOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.delay(2800),
      Animated.timing(errOpacity, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start(() => setErrMsg(''));
  };

  // ── Load history ─────────────────────────────────────────────────
  const load = useCallback(async () => {
    try {
      const res = await getChatMessages(shopId);
      setMessages(res.data?.messages ?? []);
    } catch (e: any) {
      const code = e?.response?.status;
      if (code === 401) showError('Session expired — please log in again');
      else showError('Could not load messages');
    } finally {
      setLoading(false);
    }
  }, [shopId]);

  // ── WebSocket subscription ────────────────────────────────────────
  useEffect(() => {
    load();
    destroyed.current = false;

    const connect = () => {
      if (destroyed.current) return;
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;
      ws.onmessage = (e) => {
        try {
          const event = JSON.parse(e.data);
          if (event.type === 'chat_message' && event.room?.startsWith(shopId)) {
            const incoming: Msg = event.message;
            // Replace matching pending message or append
            setMessages(prev => {
              const alreadyHave = prev.some(m => m.id === incoming.id);
              if (alreadyHave) return prev.map(m => m.id === incoming.id ? incoming : m);
              // Remove pending placeholder if bodies match (optimistic → confirmed)
              const withoutPending = prev.filter(m => !(m._pending && m.body === incoming.body));
              return [...withoutPending, incoming];
            });
            setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 80);
          }
        } catch {}
      };
      ws.onclose = () => { if (!destroyed.current) setTimeout(connect, 3000); };
      ws.onerror = () => ws.close();
    };
    connect();

    return () => {
      destroyed.current = true;
      wsRef.current?.close();
    };
  }, [shopId, load]);

  // ── Send message ─────────────────────────────────────────────────
  const send = async () => {
    const body = input.trim();
    if (!body || sending) return;

    // Optimistic message — visible immediately
    const tempId = `tmp-${Date.now()}`;
    const optimistic: Msg = {
      id: tempId,
      sender_role: 'customer',
      body,
      created_at: new Date().toISOString(),
      is_read: false,
      _pending: true,
    };
    setMessages(prev => [...prev, optimistic]);
    setInput('');
    setSending(true);
    setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 80);

    try {
      const res = await sendChatMessage(shopId, body);
      const confirmed: Msg = res.data?.message;
      if (confirmed) {
        // Swap optimistic for confirmed
        setMessages(prev => prev.map(m => m.id === tempId ? confirmed : m));
      } else {
        // No message returned — just mark confirmed
        setMessages(prev => prev.map(m => m.id === tempId ? { ...m, _pending: false } : m));
      }
    } catch (e: any) {
      // Mark as failed + restore input
      setMessages(prev => prev.map(m => m.id === tempId ? { ...m, _pending: false, _failed: true } : m));
      setInput(body);
      const code = e?.response?.status;
      if (code === 401)        showError('Session expired — please log in again');
      else if (code === 404)   showError('Shop not found');
      else                     showError('Failed to send — tap ↺ to retry');
    } finally {
      setSending(false);
    }
  };

  // ── Render bubble ─────────────────────────────────────────────────
  const renderItem = ({ item }: { item: Msg }) => {
    const isMe = item.sender_role === 'customer';
    return (
      <View style={[s.bubble, isMe ? s.bubbleMe : s.bubbleThem, item._failed && s.bubbleFailed]}>
        <Text style={[s.bubbleTxt, isMe ? s.bubbleTxtMe : s.bubbleTxtThem]}>{item.body}</Text>
        <View style={s.bubbleFooter}>
          {item._pending && <ActivityIndicator size={10} color="rgba(255,255,255,0.6)" style={{ marginRight: 4 }} />}
          {item._failed  && <Text style={{ fontSize: 10, color: '#ff9999', marginRight: 4 }}>⚠ Failed</Text>}
          <Text style={[s.bubbleTime, isMe ? { color: 'rgba(255,255,255,0.6)' } : { color: '#999' }]}>
            {new Date(item.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>
      </View>
    );
  };

  // ─────────────────────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView
      style={s.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
      <StatusBar barStyle="dark-content" />

      {/* Error toast */}
      {errMsg ? (
        <Animated.View style={[s.errToast, { opacity: errOpacity }]}>
          <Text style={s.errToastTxt}>{errMsg}</Text>
        </Animated.View>
      ) : null}

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#111" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.headerTitle}>{shopName}</Text>
          <Text style={s.headerSub}>Ask the shop anything</Text>
        </View>
        <View style={s.onlineDot} />
      </View>

      {/* Messages */}
      {loading ? (
        <View style={s.center}><ActivityIndicator color="#FF8A00" /></View>
      ) : (
        <FlatList
          ref={flatRef}
          data={messages}
          keyExtractor={m => m.id}
          renderItem={renderItem}
          contentContainerStyle={s.list}
          onContentSizeChange={() => flatRef.current?.scrollToEnd({ animated: false })}
          ListEmptyComponent={
            <View style={s.empty}>
              <Text style={{ fontSize: 36, marginBottom: 10 }}>💬</Text>
              <Text style={s.emptyTxt}>No messages yet</Text>
              <Text style={s.emptySub}>Ask about stock, opening hours, or custom orders</Text>
            </View>
          }
        />
      )}

      {/* Input row */}
      <View style={s.inputRow}>
        <TextInput
          style={s.input}
          value={input}
          onChangeText={setInput}
          placeholder="Type a message…"
          placeholderTextColor="#bbb"
          multiline
          maxLength={500}
          returnKeyType="send"
          enablesReturnKeyAutomatically
          blurOnSubmit={false}
          onSubmitEditing={send}
        />
        <TouchableOpacity
          style={[s.sendBtn, (!input.trim() || sending) && s.sendBtnDisabled]}
          onPress={send}
          activeOpacity={0.75}
          disabled={!input.trim() || sending}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          {sending
            ? <ActivityIndicator size={16} color="#fff" />
            : <Ionicons name="send" size={18} color="#fff" />
          }
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root:           { flex: 1, backgroundColor: '#f5f5f5' },
  header:         { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16,
                     paddingTop: Platform.OS === 'ios' ? 52 : 16,
                     backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  backBtn:        { padding: 4 },
  headerTitle:    { fontSize: 16, fontWeight: '700', color: '#111' },
  headerSub:      { fontSize: 12, color: '#999', marginTop: 1 },
  onlineDot:      { width: 8, height: 8, borderRadius: 4, backgroundColor: '#22C55E' },
  center:         { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list:           { padding: 16, gap: 8, paddingBottom: 8 },

  // Bubbles
  bubble:         { maxWidth: '78%', borderRadius: 18, padding: 12, marginBottom: 4 },
  bubbleMe:       { alignSelf: 'flex-end', backgroundColor: '#FF8A00', borderBottomRightRadius: 4 },
  bubbleThem:     { alignSelf: 'flex-start', backgroundColor: '#fff', borderBottomLeftRadius: 4,
                     shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 1 } },
  bubbleFailed:   { opacity: 0.7 },
  bubbleTxt:      { fontSize: 15, lineHeight: 20 },
  bubbleTxtMe:    { color: '#fff' },
  bubbleTxtThem:  { color: '#111' },
  bubbleFooter:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginTop: 4 },
  bubbleTime:     { fontSize: 10 },

  // Input
  inputRow:       { flexDirection: 'row', alignItems: 'flex-end', gap: 10,
                     padding: 12, paddingBottom: Platform.OS === 'ios' ? 16 : 12,
                     backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#f0f0f0' },
  input:          { flex: 1, backgroundColor: '#f5f5f5', borderRadius: 22,
                     paddingHorizontal: 16, paddingVertical: 10,
                     fontSize: 15, maxHeight: 100, color: '#111' },
  sendBtn:        { width: 44, height: 44, borderRadius: 22, backgroundColor: '#FF8A00',
                     alignItems: 'center', justifyContent: 'center' },
  sendBtnDisabled:{ opacity: 0.4 },

  // Empty state
  empty:          { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
  emptyTxt:       { fontSize: 16, fontWeight: '600', color: '#333', marginBottom: 6 },
  emptySub:       { fontSize: 13, color: '#999', textAlign: 'center', paddingHorizontal: 40 },

  // Error toast
  errToast:       { position: 'absolute', top: Platform.OS === 'ios' ? 110 : 80,
                     alignSelf: 'center', zIndex: 99, backgroundColor: '#1f1f1f',
                     borderRadius: 10, paddingHorizontal: 18, paddingVertical: 10,
                     shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 8, shadowOffset: { width: 0, height: 3 } },
  errToastTxt:    { color: '#fff', fontSize: 13, fontWeight: '600' },
});
