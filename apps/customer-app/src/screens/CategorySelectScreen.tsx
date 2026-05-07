import React, { useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Dimensions, StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getAppCategories } from '../services/api';
import { useCategory, AppCategory } from '../store/CategoryContext';

const { width: W, height: H } = Dimensions.get('window');

const FALLBACK: AppCategory[] = [
  { id:'1', key:'grocery',   name:'Grocery & Essentials', emoji:'🛒', description:'Groceries, bakery, dairy, personal care & home essentials',  is_active:true, under_construction:false, sort_order:1 },
  { id:'2', key:'food',      name:'Food & Restaurants',   emoji:'🍕', description:'Order from restaurants, home kitchens & tiffin services',    is_active:true, under_construction:false, sort_order:2 },
  { id:'3', key:'medicine',  name:'Medicines & Health',   emoji:'💊', description:'Medicines, wellness products & health essentials',            is_active:true, under_construction:false, sort_order:3 },
  { id:'4', key:'bike_taxi', name:'Bike Taxi',            emoji:'🛵', description:'Quick & affordable rides around your city',                   is_active:true, under_construction:true,  sort_order:4 },
];

// Solid accent colour per category
const ACCENT: Record<string, string> = {
  grocery:   '#FF8A00',
  food:      '#E63946',
  medicine:  '#0096C7',
  bike_taxi: '#6366F1',
};

const LIGHT_BG: Record<string, string> = {
  grocery:   '#FFF4E5',
  food:      '#FFF0F0',
  medicine:  '#E8F6FC',
  bike_taxi: '#EFEFFF',
};

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning ☀️';
  if (h < 17) return 'Good afternoon 👋';
  return 'Good evening 🌙';
}

interface Props {
  onSelect?: (cat: AppCategory) => void;
  navigation?: any;
}

export default function CategorySelectScreen({ onSelect }: Props) {
  const { setSelectedCategory } = useCategory();
  const [categories, setCategories] = useState<AppCategory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAppCategories()
      .then(res => setCategories(res.data?.categories?.length ? res.data.categories : FALLBACK))
      .catch(() => setCategories(FALLBACK))
      .finally(() => setLoading(false));
  }, []);

  const handlePick = (cat: AppCategory) => {
    if (cat.under_construction) return;
    setSelectedCategory(cat);
    onSelect?.(cat);
  };

  return (
    <View style={s.root}>
      <StatusBar barStyle="dark-content" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.scroll}
        bounces={false}
      >
        {/* ── TOP HEADER ── */}
        <View style={s.topBar}>
          {/* Zuqu wordmark */}
          <View style={s.logoRow}>
            <View style={s.logoDot} />
            <Text style={s.logoTxt}>zuqu</Text>
          </View>
        </View>

        {/* ── GREETING ── */}
        <View style={s.greetWrap}>
          <Text style={s.greetTxt}>{greeting()}</Text>
          <Text style={s.headline}>What are you{'\n'}looking for?</Text>
          <Text style={s.sub}>Pick a service to get started</Text>
        </View>

        {/* ── CATEGORY CARDS ── */}
        {loading ? (
          <View style={s.loadWrap}>
            <ActivityIndicator size="large" color="#FF8A00" />
          </View>
        ) : (
          <View style={s.cardList}>
            {categories.map((cat, idx) => {
              const accent = ACCENT[cat.key] ?? '#FF8A00';
              const lightBg = LIGHT_BG[cat.key] ?? '#FFF4E5';
              const isUC = cat.under_construction;

              return (
                <TouchableOpacity
                  key={cat.id}
                  activeOpacity={isUC ? 1 : 0.88}
                  onPress={() => handlePick(cat)}
                  style={[s.card, isUC && s.cardUC]}
                >
                  {/* Left icon block */}
                  <View style={[s.iconBlock, { backgroundColor: isUC ? '#F0F0F0' : lightBg }]}>
                    <Text style={[s.cardEmoji, isUC && { opacity: 0.35 }]}>{cat.emoji}</Text>
                    {/* Accent dot */}
                    {!isUC && <View style={[s.accentDot, { backgroundColor: accent }]} />}
                  </View>

                  {/* Text */}
                  <View style={s.cardBody}>
                    {isUC && (
                      <View style={s.ucChip}>
                        <Text style={s.ucChipTxt}>🚧  Coming soon</Text>
                      </View>
                    )}
                    <Text style={[s.cardName, isUC && { color: '#BDBDBD' }]}>
                      {cat.name}
                    </Text>
                    <Text style={[s.cardDesc, isUC && { color: '#D0D0D0' }]} numberOfLines={2}>
                      {cat.description}
                    </Text>
                  </View>

                  {/* Right arrow */}
                  {!isUC ? (
                    <View style={[s.arrowCircle, { backgroundColor: accent }]}>
                      <Ionicons name="arrow-forward" size={16} color="#fff" />
                    </View>
                  ) : (
                    <View style={[s.arrowCircle, { backgroundColor: '#E8E8E8' }]}>
                      <Ionicons name="lock-closed" size={14} color="#BDBDBD" />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* ── FOOTER ── */}
        <Text style={s.footer}>By continuing you agree to our Terms & Privacy Policy</Text>
        <View style={{ height: 32 }} />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root:       { flex: 1, backgroundColor: '#FFFFFF' },
  scroll:     { paddingBottom: 20 },

  // Top bar
  topBar:     { paddingTop: 60, paddingHorizontal: 24, marginBottom: 8 },
  logoRow:    { flexDirection: 'row', alignItems: 'center', gap: 6 },
  logoDot:    { width: 10, height: 10, borderRadius: 5, backgroundColor: '#FF8A00' },
  logoTxt:    { fontSize: 20, fontWeight: '900', color: '#111', letterSpacing: -0.5 },

  // Greeting
  greetWrap:  { paddingHorizontal: 24, paddingTop: 28, paddingBottom: 32 },
  greetTxt:   { fontSize: 14, color: '#FF8A00', fontWeight: '700', marginBottom: 10 },
  headline:   { fontSize: 36, fontWeight: '900', color: '#111', lineHeight: 42, marginBottom: 8, letterSpacing: -0.8 },
  sub:        { fontSize: 15, color: '#AAA', fontWeight: '500' },

  loadWrap:   { height: 200, alignItems: 'center', justifyContent: 'center' },

  // Card list
  cardList:   { paddingHorizontal: 16, gap: 14 },

  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 22,
    padding: 16,
    gap: 16,
    shadowColor: '#000',
    shadowOpacity: 0.07,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
    borderWidth: 1,
    borderColor: '#F2F2F2',
  },
  cardUC: {
    backgroundColor: '#FAFAFA',
    shadowOpacity: 0,
    elevation: 0,
    borderColor: '#EFEFEF',
  },

  // Icon block (left square)
  iconBlock: {
    width: 72,
    height: 72,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    position: 'relative',
  },
  cardEmoji:  { fontSize: 34 },
  accentDot:  {
    position: 'absolute',
    bottom: 8,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: '#fff',
  },

  // Body
  cardBody:   { flex: 1 },
  ucChip:     {
    alignSelf: 'flex-start',
    backgroundColor: '#FFF3CD',
    borderRadius: 99,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginBottom: 6,
  },
  ucChipTxt:  { fontSize: 10, fontWeight: '700', color: '#856404' },
  cardName:   { fontSize: 17, fontWeight: '800', color: '#111', marginBottom: 4, letterSpacing: -0.3 },
  cardDesc:   { fontSize: 12, color: '#999', lineHeight: 17 },

  // Arrow
  arrowCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },

  footer:     {
    textAlign: 'center',
    fontSize: 11,
    color: '#CCC',
    marginTop: 28,
    paddingHorizontal: 32,
    lineHeight: 16,
  },
});
