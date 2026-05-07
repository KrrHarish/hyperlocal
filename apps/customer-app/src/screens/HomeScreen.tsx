import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, RefreshControl, ActivityIndicator,
  Dimensions, FlatList, ViewToken, Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import {
  getNearbyShops, getProductsByCategory, IMAGE_BASE,
  getActiveDeals, getNeighbourhoodFeed, getHomeProducers, getLateNightShops,
  getPlatformOffers,
} from '../services/api';
import { useCart } from '../store/CartContext';
import { useProductSocket } from '../hooks/useProductSocket';

const { width: W } = Dimensions.get('window');

// ─── DATA ────────────────────────────────────────────────────────
const CATEGORIES = [
  { id:'all',           label:'All',        emoji:'🏪' },
  { id:'grocery',       label:'Grocery',    emoji:'🥦' },
  { id:'dairy',         label:'Dairy',      emoji:'🥛' },
  { id:'snacks',        label:'Snacks',     emoji:'🍿' },
  { id:'beverages',     label:'Drinks',     emoji:'🧃' },
  { id:'personal_care', label:'Care',       emoji:'🧴' },
  { id:'pharmacy',      label:'Medicine',   emoji:'💊' },
  { id:'bakery',        label:'Bakery',     emoji:'🍞' },
  { id:'household',     label:'Home',       emoji:'🧹' },
];

const BANNERS = [
  { id:1, title:'⚡ Under 20 Minutes',  sub:'Express delivery from your local shop', color1:'#FF8A00', color2:'#FF5C00', emoji:'🛵', badge:'NEW' },
  { id:2, title:'🎁 First Order Free',  sub:'No delivery fee on your first order',   color1:'#7C3AED', color2:'#6D28D9', emoji:'🎉', badge:'OFFER' },
  { id:3, title:'🏪 Support Local',      sub:'100% revenue goes to neighbourhood shops', color1:'#0F766E', color2:'#0D9488', emoji:'❤️', badge:'MISSION' },
  { id:4, title:'⭐ QuickPass ₹99/mo',  sub:'Unlimited free delivery, every day',    color1:'#0B1A2B', color2:'#1C3A5E', emoji:'✨', badge:'SAVE' },
];

const COLLECTIONS = [
  { id:'breakfast', label:'Breakfast Essentials', emoji:'🍳', count:24, color:'#FFF4E6' },
  { id:'evening',   label:'Evening Snacks',        emoji:'🍿', count:18, color:'#F0FDF4' },
  { id:'cleaning',  label:'Cleaning Supplies',     emoji:'🧹', count:31, color:'#EFF6FF' },
  { id:'baby',      label:'Baby & Kids',            emoji:'👶', count:15, color:'#FDF4FF' },
];

// No mock shops or products — all data comes from the real API

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 +
            Math.cos(lat1 * Math.PI/180) * Math.cos(lat2 * Math.PI/180) * Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

const CATEGORY_EMOJI: Record<string, string> = {
  grocery: '🛒', dairy: '🥛', snacks: '🍿', beverages: '🧃',
  personal_care: '🧴', household: '🧹', bakery: '🍞', pharmacy: '💊', all: '🏪',
};

function productEmoji(name: string, category: string): string {
  const n = name.toLowerCase();
  if (n.includes('milk'))    return '🥛'; if (n.includes('butter'))  return '🧈';
  if (n.includes('curd'))    return '🥣'; if (n.includes('cheese'))  return '🧀';
  if (n.includes('bread'))   return '🍞'; if (n.includes('rice'))    return '🍚';
  if (n.includes('atta'))    return '🌾'; if (n.includes('dal'))     return '🫘';
  if (n.includes('oil'))     return '🫒'; if (n.includes('salt'))    return '🧂';
  if (n.includes('sugar'))   return '🍬'; if (n.includes('maggi'))   return '🍜';
  if (n.includes('biscuit') || n.includes('parle')) return '🍪';
  if (n.includes('chips') || n.includes('lays'))    return '🍿';
  if (n.includes('juice') || n.includes('tropicana')) return '🧃';
  if (n.includes('cola') || n.includes('pepsi'))    return '🥤';
  if (n.includes('red bull')) return '⚡';
  if (n.includes('soap') || n.includes('dettol'))  return '🧼';
  if (n.includes('shampoo')) return '🧴'; if (n.includes('toothpaste')) return '🪥';
  if (n.includes('detergent') || n.includes('surf')) return '🧺';
  if (n.includes('tablet') || n.includes('dolo'))  return '💊';
  return CATEGORY_EMOJI[category?.toLowerCase()] || '📦';
}

// ─── COMPONENT ──────────────────────────────────────────────────
export default function HomeScreen({ navigation }: any) {
  const [search]                        = useState(''); // kept for filtered shops logic
  const [category, setCategory]        = useState('all');
  const [shops, setShops]              = useState<any[]>([]);
  const [loading, setLoading]          = useState(true);
  const [refreshing, setRefreshing]    = useState(false);
  const [locationName, setLocationName] = useState('Detecting...');
  const [userLat, setUserLat]          = useState(12.9116);
  const [userLng, setUserLng]          = useState(77.6389);
  const [catProducts, setCatProducts]  = useState<any[]>([]);
  const [catLoading, setCatLoading]    = useState(false);
  const [deals, setDeals]              = useState<any[]>([]);
  const [feed, setFeed]                = useState<any[]>([]);
  const [homeProducers, setHomeProducers] = useState<any[]>([]);
  const [lateNightShops, setLateNightShops] = useState<any[]>([]);
  const [platformOffers, setPlatformOffers] = useState<any[]>([]);
  const [bannerIdx, setBannerIdx]     = useState(0);
  const bannerRef = useRef<FlatList<typeof BANNERS[0]>>(null);
  const bannerTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const { addItem, shops: cartShops, getShopItems, updateQty, removeItem } = useCart();

  const hr = new Date().getHours();
  const showLateNight = hr >= 22 || hr < 6;

  // ── Auto-scroll banners
  useEffect(() => {
    bannerTimer.current = setInterval(() => {
      setBannerIdx(i => {
        const next = (i + 1) % BANNERS.length;
        bannerRef.current?.scrollToIndex({ index: next, animated: true });
        return next;
      });
    }, 3500);
    return () => { if (bannerTimer.current) clearInterval(bannerTimer.current); };
  }, []);

  // ── Fetch shops
  const fetchShops = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      // Default: HSR Layout, Bengaluru
      const DEFAULT_LAT = 12.9116, DEFAULT_LNG = 77.6389;
      let lat = DEFAULT_LAT, lng = DEFAULT_LNG;
      setLocationName('HSR Layout, Bengaluru');
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
            timeInterval: 5000,
          });
          const detectedLat = loc.coords.latitude;
          const detectedLng = loc.coords.longitude;

          // Sanity check: if detected location is outside India's rough bounding box
          // (e.g. iOS Simulator defaulting to San Francisco), fall back to Bengaluru.
          const inIndia = detectedLat >= 6 && detectedLat <= 37
                       && detectedLng >= 68 && detectedLng <= 98;
          if (inIndia) {
            lat = detectedLat;
            lng = detectedLng;
            setUserLat(lat); setUserLng(lng);
            const geo = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
            if (geo[0]) {
              setLocationName(`${geo[0].district || geo[0].subregion || 'Your area'}, ${geo[0].city || ''}`);
            }
          }
          // else: keep default Bengaluru coords + label (simulator is lying)
        }
      } catch (locErr) {
        console.log('Location error, using default:', locErr);
      }
      const res = await getNearbyShops(lat, lng, 5000);
      const list = res.data?.shops || res.data || [];
      setShops(Array.isArray(list)
        ? list.map((s: any) => {
            const distKm = (s.lat && s.lng)
              ? haversineKm(lat, lng, parseFloat(s.lat), parseFloat(s.lng))
              : null;
            return {
              id: s.id, name: s.name, category: s.category || 'grocery',
              address: s.address || '',
              lat: s.lat, lng: s.lng,
              image_url: s.image_url ? `${IMAGE_BASE}${s.image_url}` : null,
              distance: distKm != null
                ? distKm < 1 ? `${Math.round(distKm * 1000)} m` : `${distKm.toFixed(1)} km`
                : 'Nearby',
              eta: distKm != null
                ? `${Math.ceil(distKm * 4 + 5)} min`
                : '10–15 min',
              rating: parseFloat(s.rating) || 4.5,
              reviews: s.total_reviews || 0,
              is_open: s.is_open ?? true,
              tags: s.tags || [s.category || 'General'],
            };
          })
        : []
      );
    } catch { setShops([]); setLocationName('HSR Layout, Bengaluru'); }
    finally { setLoading(false); setRefreshing(false); }

    // Fetch supplemental sections (non-blocking — best effort)
    try {
      const [dealsRes, feedRes, prodRes, lateRes, offersRes] = await Promise.allSettled([
        getActiveDeals(userLat, userLng),
        getNeighbourhoodFeed(userLat, userLng),
        getHomeProducers(userLat, userLng),
        getLateNightShops(),
        getPlatformOffers(),
      ]);
      if (dealsRes.status   === 'fulfilled') setDeals(dealsRes.value.data?.deals ?? []);
      if (feedRes.status    === 'fulfilled') setFeed(feedRes.value.data?.events ?? []);
      if (prodRes.status    === 'fulfilled') setHomeProducers(prodRes.value.data?.shops ?? []);
      if (lateRes.status    === 'fulfilled') setLateNightShops(lateRes.value.data?.shops ?? []);
      if (offersRes.status  === 'fulfilled') setPlatformOffers(offersRes.value.data?.offers ?? []);
    } catch {}
  }, [userLat, userLng]);

  useEffect(() => { fetchShops(); }, [fetchShops]);

  // ── Fetch products for selected category (silent refresh — no spinner on poll)
  const fetchCatProducts = useCallback(async (showSpinner = false) => {
    if (category === 'all') { setCatProducts([]); return; }
    if (showSpinner) setCatLoading(true);
    try {
      const res = await getProductsByCategory(category);
      setCatProducts(res.data?.products || []);
    } catch { /* keep stale data */ }
    finally { if (showSpinner) setCatLoading(false); }
  }, [category]);

  // Re-fetch when category changes (show spinner) or screen comes back into focus
  useEffect(() => { fetchCatProducts(true); }, [category]);

  // Re-fetch immediately when screen comes back into focus
  useFocusEffect(useCallback(() => { fetchCatProducts(false); }, [fetchCatProducts]));

  // WebSocket: instantly re-fetch category products when any product changes
  useProductSocket(useCallback(() => {
    if (category !== 'all') fetchCatProducts(false);
  }, [category, fetchCatProducts]));

  const getCartQty = (productId: string, shopId?: string) => {
    if (shopId) return getShopItems(shopId).find(i => i.product_id === productId)?.quantity || 0;
    return Object.values(cartShops).flatMap(b => b.items).find(i => i.product_id === productId)?.quantity || 0;
  };

  const handleAddToCart = (p: any) =>
    addItem({ product_id: p.id, name: p.name, price: p.price, quantity: 1 }, p.shop_id, p.shop_name);

  const filtered = shops.filter(s => {
    const matchSearch = !search || s.name.toLowerCase().includes(search.toLowerCase());
    if (category === 'all') return matchSearch;
    // Match by category field OR by tags array
    const catLabel = CATEGORIES.find(c => c.id === category)?.label?.toLowerCase() || '';
    const matchCat = s.category === category ||
      (s.tags || []).some((t: string) =>
        t.toLowerCase() === category ||
        t.toLowerCase() === catLabel
      );
    return matchCat && matchSearch;
  });

  return (
    <View style={s.root}>
      <StatusBar style="light" />

      {/* ── STICKY HEADER ── */}
      <LinearGradient colors={['#FF8A00','#FF5C00']} style={s.header}>
        <View style={s.hTop}>
          <TouchableOpacity style={s.locationWrap} activeOpacity={0.7}>
            <View style={s.locationRow}>
              <Ionicons name="location-sharp" size={14} color="rgba(255,255,255,0.9)" />
              <Text style={s.locationLbl}>Delivering to</Text>
              <Ionicons name="chevron-down" size={13} color="rgba(255,255,255,0.8)" />
            </View>
            <Text style={s.locationTxt} numberOfLines={1}>{locationName}</Text>
          </TouchableOpacity>

          <View style={s.hActions}>
            <TouchableOpacity style={s.hBtn}>
              <Ionicons name="notifications-outline" size={22} color="#fff" />
              <View style={s.notifDot} />
            </TouchableOpacity>
            <TouchableOpacity style={s.hBtn} onPress={() => navigation.navigate('Profile')}>
              <View style={s.avatarSmall}>
                <Ionicons name="person" size={18} color="#FF8A00" />
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* Search bar — tapping opens SearchScreen */}
        <TouchableOpacity style={s.searchBar} activeOpacity={0.85}
          onPress={() => navigation.navigate('Search')}>
          <Ionicons name="search-outline" size={18} color="#999" />
          <Text style={s.searchPlaceholder}>Search shops, products, brands…</Text>
          <View style={s.searchFilter}>
            <Ionicons name="options-outline" size={16} color="#FF8A00" />
          </View>
        </TouchableOpacity>
      </LinearGradient>

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator size="large" color="#FF8A00" />
          <Text style={s.loadTxt}>Finding shops near you…</Text>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => fetchShops(true)} tintColor="#FF8A00" />}
        >
          {/* ── CATEGORY TABS ── */}
          <View style={s.catWrap}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.catContent}>
              {CATEGORIES.map(c => (
                <TouchableOpacity key={c.id}
                  style={[s.catChip, category === c.id && s.catChipOn]}
                  onPress={() => setCategory(c.id)}>
                  <Text style={s.catEmoji}>{c.emoji}</Text>
                  <Text style={[s.catTxt, category === c.id && s.catTxtOn]}>{c.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* ── SHOW FULL HOME LAYOUT ONLY WHEN NO FILTER ── */}
          {category === 'all' && (<>
          {/* ── HERO BANNER SLIDER ── */}
          <View style={s.bannerSection}>
            <FlatList
              ref={bannerRef}
              data={BANNERS}
              keyExtractor={b => String(b.id)}
              horizontal
              pagingEnabled
              snapToInterval={W - 32}
              snapToAlignment="start"
              decelerationRate="fast"
              showsHorizontalScrollIndicator={false}
              onViewableItemsChanged={({ viewableItems }: { viewableItems: ViewToken[] }) => {
                if (viewableItems[0]) setBannerIdx(viewableItems[0].index ?? 0);
              }}
              viewabilityConfig={{ itemVisiblePercentThreshold: 50 }}
              getItemLayout={(_: any, index: number) => ({
                length: W - 32, offset: (W - 32) * index, index,
              })}
              renderItem={({ item: b }: { item: typeof BANNERS[0] }) => (
                <LinearGradient colors={[b.color1, b.color2]}
                  style={s.bannerCard} start={{ x:0,y:0 }} end={{ x:1,y:1 }}>
                  <View style={s.bannerBadge}>
                    <Text style={s.bannerBadgeTxt}>{b.badge}</Text>
                  </View>
                  <View style={{ flex:1 }}>
                    <Text style={s.bannerTitle}>{b.title}</Text>
                    <Text style={s.bannerSub}>{b.sub}</Text>
                  </View>
                  <Text style={s.bannerEmoji}>{b.emoji}</Text>
                </LinearGradient>
              )}
            />
            {/* Dot indicators */}
            <View style={s.dots}>
              {BANNERS.map((_, i) => (
                <View key={i} style={[s.dot, i === bannerIdx && s.dotOn]} />
              ))}
            </View>
          </View>

          {/* ── LIVE DEALS STRIP (shop deals + platform offers combined) ── */}
          {(deals.length > 0 || platformOffers.length > 0) && (
            <View style={s.section}>
              <View style={s.secRow}>
                <Text style={s.secTitle}>🔥 Live Deals</Text>
                <TouchableOpacity><Text style={s.secLink}>See all</Text></TouchableOpacity>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 12, paddingRight: 4, paddingBottom: 4 }}>

                {/* Platform offer cards */}
                {platformOffers.map((o: any) => {
                  const colorMap: Record<string,[string,string]> = {
                    orange: ['#FF8A00', '#FF4500'],
                    green:  ['#16A34A', '#14532D'],
                    purple: ['#7C3AED', '#5B21B6'],
                    blue:   ['#2563EB', '#1E3A8A'],
                  };
                  const colors: [string,string] = colorMap[o.color] ?? ['#FF8A00', '#FF4500'];
                  const offLabel =
                    o.offer_type === 'free_delivery' ? 'FREE'
                    : o.offer_type === 'percent_off'  ? `${Math.round(o.value)}%`
                    : `₹${Math.round(o.value)}`;
                  const offSuffix =
                    o.offer_type === 'free_delivery' ? 'DELIVERY'
                    : 'OFF';
                  return (
                    <View key={o.id}>
                      <LinearGradient colors={colors} style={s.dealCard}
                        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>

                        <View style={s.dealCircle1} />
                        <View style={s.dealCircle2} />

                        {/* PLATFORM badge */}
                        <View style={s.dealAutoBadge}>
                          <Text style={s.dealAutoBadgeTxt}>🎁 PLATFORM OFFER</Text>
                        </View>

                        <Text style={s.dealOffAmt}>{offLabel}</Text>
                        <Text style={s.dealOffOff}>{offSuffix}</Text>

                        <Text style={s.dealTitle} numberOfLines={1}>{o.title}</Text>

                        <View style={s.dealDivider} />

                        <View style={s.dealBottom}>
                          <View style={{ flex: 1 }}>
                            <Text style={s.dealShopName} numberOfLines={1}>🏪 All Shops</Text>
                            {o.min_order > 0 && (
                              <Text style={s.dealMinOrder}>Min. ₹{Math.round(o.min_order)}</Text>
                            )}
                          </View>
                          {o.code_label ? (
                            <View style={s.dealShopNow}>
                              <Text style={s.dealShopNowTxt}>{o.code_label}</Text>
                            </View>
                          ) : (
                            <View style={s.dealShopNow}>
                              <Text style={s.dealShopNowTxt}>Auto</Text>
                              <Ionicons name="checkmark" size={11} color="#fff" />
                            </View>
                          )}
                        </View>

                      </LinearGradient>
                    </View>
                  );
                })}

                {/* Shop deal cards */}
                {deals.map((deal: any) => {
                  const isPercent = deal.deal_type === 'percent';
                  const offLabel  = isPercent ? `${Math.round(deal.deal_value)}%` : `₹${Math.round(deal.deal_value)}`;
                  const colors: [string,string] = isPercent
                    ? ['#FF8A00', '#FF4500']
                    : ['#7C3AED', '#5B21B6'];
                  return (
                    <TouchableOpacity key={deal.id} activeOpacity={0.88}
                      onPress={() => navigation.navigate('Shop', {
                        shop: { id: deal.shop_id, name: deal.shop_name, category: deal.shop_category, is_open: true }
                      })}>
                      <LinearGradient colors={colors} style={s.dealCard}
                        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>

                        <View style={s.dealCircle1} />
                        <View style={s.dealCircle2} />

                        <View style={s.dealAutoBadge}>
                          <Text style={s.dealAutoBadgeTxt}>✓ AUTO APPLY</Text>
                        </View>

                        <Text style={s.dealOffAmt}>{offLabel}</Text>
                        <Text style={s.dealOffOff}>OFF</Text>

                        <Text style={s.dealTitle} numberOfLines={1}>{deal.title}</Text>

                        <View style={s.dealDivider} />

                        <View style={s.dealBottom}>
                          <View style={{ flex: 1 }}>
                            <Text style={s.dealShopName} numberOfLines={1}>🏪 {deal.shop_name}</Text>
                            {deal.min_order > 0 && (
                              <Text style={s.dealMinOrder}>Min. ₹{Math.round(deal.min_order)}</Text>
                            )}
                          </View>
                          <View style={s.dealShopNow}>
                            <Text style={s.dealShopNowTxt}>Shop</Text>
                            <Ionicons name="arrow-forward" size={11} color="#fff" />
                          </View>
                        </View>

                      </LinearGradient>
                    </TouchableOpacity>
                  );
                })}

              </ScrollView>
            </View>
          )}

          {/* ── COLLECTIONS GRID ── */}
          <View style={s.section}>
            <View style={s.secRow}>
              <Text style={s.secTitle}>Shop by Category</Text>
              <TouchableOpacity><Text style={s.secLink}>See all</Text></TouchableOpacity>
            </View>
            <View style={s.collectGrid}>
              {COLLECTIONS.map(c => (
                <TouchableOpacity key={c.id} style={[s.collectCard, { backgroundColor: c.color }]}
                  activeOpacity={0.8}>
                  <Text style={s.collectEmoji}>{c.emoji}</Text>
                  <Text style={s.collectLabel}>{c.label}</Text>
                  <Text style={s.collectCount}>{c.count} items</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* ── FEATURED SHOPS HORIZONTAL SCROLL ── */}
          <View style={s.section}>
            <View style={s.secRow}>
              <Text style={s.secTitle}>⭐ Top Rated Nearby</Text>
              <TouchableOpacity><Text style={s.secLink}>See all</Text></TouchableOpacity>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}
              contentContainerStyle={s.featuredContent}>
              {shops.filter(s => s.is_open).slice(0,4).map(shop => (
                <TouchableOpacity key={shop.id} style={s.featuredCard}
                  onPress={() => navigation.navigate('Shop', { shop })} activeOpacity={0.88}>
                  {shop.image_url ? (
                    <Image source={{ uri: shop.image_url }} style={s.featuredImg} resizeMode="cover" />
                  ) : (
                    <LinearGradient colors={['#FFF4E6','#FFE8CC']} style={s.featuredImg}>
                      <Text style={{ fontSize:32 }}>{CATEGORY_EMOJI[shop.category] || '🏪'}</Text>
                    </LinearGradient>
                  )}
                  <View style={s.featuredInfo}>
                    <Text style={s.featuredName} numberOfLines={1}>{shop.name}</Text>
                    <View style={s.featuredMeta}>
                      <Ionicons name="star" size={11} color="#F59E0B" />
                      <Text style={s.featuredMetaTxt}>{shop.rating}</Text>
                      <Text style={s.featuredDot}>·</Text>
                      <Text style={s.featuredMetaTxt}>{shop.eta}</Text>
                    </View>
                    <Text style={s.featuredDist}>{shop.distance}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* ── HOME PRODUCERS ── */}
          {homeProducers.length > 0 && (
            <View style={s.section}>
              <View style={s.secRow}>
                <Text style={s.secTitle}>🏠 Home Producers</Text>
                <Text style={s.secLink}>Homemade &amp; artisan</Text>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 12, paddingRight: 4 }}>
                {homeProducers.map((p: any) => (
                  <TouchableOpacity key={p.id} style={s.producerCard}
                    onPress={() => navigation.navigate('Shop', { shop: p })} activeOpacity={0.88}>
                    <LinearGradient colors={['#FDF4FF','#F3E8FF']} style={s.producerImg}>
                      <Text style={{ fontSize: 28 }}>{p.producer_badge || '👩‍🍳'}</Text>
                    </LinearGradient>
                    <Text style={s.producerName} numberOfLines={1}>{p.name}</Text>
                    <Text style={s.producerSub} numberOfLines={1}>{p.category}</Text>
                    <View style={s.producerRating}>
                      <Ionicons name="star" size={10} color="#F59E0B" />
                      <Text style={s.producerRatingTxt}>{p.rating || '4.5'}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {/* ── PROMO BANNER ── */}
          <View style={s.promoBannerWrap}>
            <LinearGradient colors={['#0B1A2B','#1C3A5E']} style={s.promoBanner}
              start={{ x:0,y:0 }} end={{ x:1,y:0 }}>
              <View>
                <Text style={s.promoTitle}>🛵 Ride with Zuqu</Text>
                <Text style={s.promoSub}>Become a delivery partner & earn ₹800/day</Text>
                <TouchableOpacity style={s.promoBtn}>
                  <Text style={s.promoBtnTxt}>Join Now →</Text>
                </TouchableOpacity>
              </View>
              <Text style={{ fontSize:52 }}>💰</Text>
            </LinearGradient>
          </View>

          {/* ── NEIGHBOURHOOD FEED ── */}
          {feed.length > 0 && (
            <View style={s.section}>
              <View style={s.secRow}>
                <Text style={s.secTitle}>📰 What's Happening</Text>
                <Text style={s.secLink}>{feed.length} updates</Text>
              </View>
              {feed.slice(0, 4).map((event: any) => (
                <TouchableOpacity key={event.id} style={s.feedCard}
                  onPress={() => navigation.navigate('Shop', {
                    shop: { id: event.shop_id, name: event.shop_name, is_open: true }
                  })} activeOpacity={0.85}>
                  <View style={s.feedIconWrap}>
                    <Text style={{ fontSize: 20 }}>
                      {event.event_type === 'new_deal' ? '🏷️'
                        : event.event_type === 'shop_open' ? '🟢'
                        : event.event_type === 'new_product' ? '✨' : '📢'}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.feedTitle} numberOfLines={1}>{event.title}</Text>
                    {event.body ? <Text style={s.feedBody} numberOfLines={1}>{event.body}</Text> : null}
                    <Text style={s.feedShop}>📍 {event.shop_name}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={14} color="#DDD" />
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* ── LATE NIGHT ── */}
          {showLateNight && lateNightShops.length > 0 && (
            <View style={s.section}>
              <View style={s.secRow}>
                <Text style={s.secTitle}>🌙 Open Late Night</Text>
                <Text style={s.secLink}>{lateNightShops.length} open now</Text>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 12, paddingRight: 4 }}>
                {lateNightShops.map((shop: any) => (
                  <TouchableOpacity key={shop.id} style={s.nightCard}
                    onPress={() => navigation.navigate('Shop', { shop })} activeOpacity={0.88}>
                    <LinearGradient colors={['#0B1A2B','#1C3A5E']} style={s.nightCardGrad}>
                      <Text style={{ fontSize: 24, marginBottom: 6 }}>
                        {CATEGORY_EMOJI[shop.category] || '🏪'}
                      </Text>
                      <Text style={s.nightName} numberOfLines={1}>{shop.name}</Text>
                      <Text style={s.nightTag}>{shop.late_night_tag || 'Open Late'}</Text>
                      <View style={s.nightBadge}>
                        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#22C55E' }} />
                        <Text style={s.nightBadgeTxt}>Open now</Text>
                      </View>
                    </LinearGradient>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          </> )}

          {/* ── CATEGORY PRODUCT GRID (shown when a category is selected) ── */}
          {category !== 'all' && (
            <View style={s.section}>
              <View style={s.secRow}>
                <Text style={s.secTitle}>
                  {CATEGORIES.find(c => c.id === category)?.emoji}{' '}
                  {CATEGORIES.find(c => c.id === category)?.label}
                </Text>
                <Text style={s.secLink}>{catProducts.length} items</Text>
              </View>

              {catLoading ? (
                <View style={s.center}>
                  <ActivityIndicator size="large" color="#FF8A00" />
                </View>
              ) : catProducts.length === 0 ? (
                <View style={s.empty}>
                  <Text style={{ fontSize:44 }}>🛒</Text>
                  <Text style={s.emptyT}>No products yet</Text>
                  <Text style={s.emptySub}>Check back soon!</Text>
                </View>
              ) : (
                <View style={s.productGrid}>
                  {catProducts.map((p: any) => {
                    const emoji = productEmoji(p.name, p.category);
                    const qty = getCartQty(p.id, p.shop_id);
                    const isOos  = p.stock_status === 'out_of_stock';
                    const isLow  = p.stock_status === 'low' || p.stock_status === 'low_stock';
                    const shopClosed = p.shop_is_open === false;
                    const imageUri = p.custom_image_url
                      ? `http://localhost:3000${p.custom_image_url}`
                      : p.image_url || null;
                    return (
                      <TouchableOpacity
                        key={p.id}
                        style={[s.productCard, (isOos || shopClosed) && { opacity: 0.55 }]}
                        activeOpacity={0.85}
                        onPress={() => navigation.navigate('ProductDetail', {
                          product: { ...p, emoji, imageUri },
                          shop: { id: p.shop_id, name: p.shop_name, address: p.shop_address,
                                  rating: p.shop_rating, is_open: p.shop_is_open,
                                  eta: '10–15 min', distance: 'Nearby', category: p.category }
                        })}
                      >
                        <View style={s.productImgWrap}>
                          {imageUri ? (
                            <Image
                              source={{ uri: imageUri }}
                              style={s.productImg}
                              resizeMode="cover"
                            />
                          ) : (
                            <Text style={s.productEmoji}>{emoji}</Text>
                          )}
                          {isOos && (
                            <View style={[s.productBadge, { backgroundColor:'#EF4444' }]}>
                              <Text style={s.productBadgeTxt}>OUT OF STOCK</Text>
                            </View>
                          )}
                          {isLow && !isOos && !shopClosed && (
                            <View style={[s.productBadge, { backgroundColor:'#F59E0B' }]}>
                              <Text style={s.productBadgeTxt}>LOW STOCK</Text>
                            </View>
                          )}
                          {shopClosed && !isOos && (
                            <View style={[s.productBadge, { backgroundColor:'#6B7280' }]}>
                              <Text style={s.productBadgeTxt}>SHOP CLOSED</Text>
                            </View>
                          )}
                        </View>
                        <Text style={s.productName} numberOfLines={2}>{p.name}</Text>
                        <Text style={s.productShop} numberOfLines={1}>📍 {p.shop_name}</Text>
                        <View style={s.productBottom}>
                          <Text style={s.productPrice}>₹{p.price}</Text>
                          {!isOos && !shopClosed && (
                            qty > 0 ? (
                              <View style={s.miniCounter}>
                                <TouchableOpacity style={s.miniBtn}
                                  onPress={() => qty === 1 ? removeItem(p.id, p.shop_id) : updateQty(p.id, p.shop_id, qty - 1)}>
                                  <Text style={{ color:'#fff', fontSize:16, fontWeight:'800', lineHeight:20 }}>−</Text>
                                </TouchableOpacity>
                                <Text style={s.miniNum}>{qty}</Text>
                                <TouchableOpacity style={s.miniBtn}
                                  onPress={() => handleAddToCart(p)}>
                                  <Text style={{ color:'#fff', fontSize:16, fontWeight:'800', lineHeight:20 }}>+</Text>
                                </TouchableOpacity>
                              </View>
                            ) : (
                              <TouchableOpacity style={s.productAddBtn}
                                onPress={() => handleAddToCart(p)}>
                                <Ionicons name="add" size={18} color="#FF8A00" />
                              </TouchableOpacity>
                            )
                          )}
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>
          )}

          {/* ── SHOPS LIST (always shown on 'all', hidden when category selected) ── */}
          {category === 'all' && (
          <View style={s.section}>
            <View style={s.secRow}>
              <Text style={s.secTitle}>{filtered.length} Shops Nearby</Text>
              <TouchableOpacity style={s.sortBtn}>
                <Ionicons name="funnel-outline" size={14} color="#FF8A00" />
                <Text style={s.sortTxt}>Filter</Text>
              </TouchableOpacity>
            </View>

            {filtered.length === 0 ? (
              <View style={s.empty}>
                <Text style={{ fontSize:44 }}>🔍</Text>
                <Text style={s.emptyT}>No shops found</Text>
                <Text style={s.emptySub}>Try a different filter</Text>
              </View>
            ) : (
              filtered.map(shop => (
                <TouchableOpacity key={shop.id}
                  style={[s.shopCard, !shop.is_open && s.shopCardFaded]}
                  onPress={() => navigation.navigate('Shop', { shop })} activeOpacity={0.88}>

                  {/* Shop image / icon */}
                  <View style={s.shopImg}>
                    {shop.image_url ? (
                      <Image source={{ uri: shop.image_url }} style={{ width:'100%', height:'100%', borderRadius:14 }} resizeMode="cover" />
                    ) : (
                      <LinearGradient colors={['#FFF4E6','#FFE8CC']} style={{ flex:1, borderRadius:14, alignItems:'center', justifyContent:'center' }}>
                        <Text style={{ fontSize:30 }}>{CATEGORY_EMOJI[shop.category] || '🏪'}</Text>
                      </LinearGradient>
                    )}
                    {!shop.is_open && (
                      <View style={s.closedOverlay}>
                        <Text style={s.closedTxt}>CLOSED</Text>
                      </View>
                    )}
                  </View>

                  {/* Info */}
                  <View style={{ flex:1 }}>
                    <View style={s.shopTopRow}>
                      <Text style={s.shopName} numberOfLines={1}>{shop.name}</Text>
                      {shop.is_open
                        ? <View style={s.openPill}><View style={s.greenDot} /><Text style={s.openTxt}>Open</Text></View>
                        : <View style={s.closedPill}><Text style={s.closedPillTxt}>Closed</Text></View>
                      }
                    </View>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}
                      style={{ marginBottom:8 }} contentContainerStyle={{ gap:5 }}>
                      {(shop.tags||[]).slice(0,4).map((t: string) => (
                        <View key={t} style={s.tag}><Text style={s.tagTxt}>{t}</Text></View>
                      ))}
                    </ScrollView>
                    <View style={s.shopMetaRow}>
                      <Ionicons name="star" size={12} color="#F59E0B" />
                      <Text style={s.shopMetaTxt}>{shop.rating}</Text>
                      <Text style={s.shopMetaSep}>·</Text>
                      <Ionicons name="time-outline" size={12} color="#AAA" />
                      <Text style={s.shopMetaTxt}>{shop.eta}</Text>
                      <Text style={s.shopMetaSep}>·</Text>
                      <Ionicons name="location-outline" size={12} color="#AAA" />
                      <Text style={s.shopMetaTxt}>{shop.distance}</Text>
                    </View>
                    {shop.is_open && (
                      <View style={s.freeDelivery}>
                        <Ionicons name="bicycle-outline" size={11} color="#16A34A" />
                        <Text style={s.freeDeliveryTxt}>Free delivery above ₹199</Text>
                      </View>
                    )}
                  </View>

                  <Ionicons name="chevron-forward" size={16} color="#DDD" />
                </TouchableOpacity>
              ))
            )}
          </View>
          )}

          {/* ── BOTTOM CTA ── */}
          <View style={s.bottomCta}>
            <Text style={s.bottomCtaTitle}>Can't find your shop? 🏪</Text>
            <Text style={s.bottomCtaSub}>Suggest a local shop to add on Zuqu</Text>
            <TouchableOpacity style={s.suggestBtn}>
              <LinearGradient colors={['#FF8A00','#FF5C00']} style={s.suggestGrad}
                start={{ x:0,y:0 }} end={{ x:1,y:0 }}>
                <Text style={s.suggestTxt}>Suggest a Shop</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>

          <View style={{ height:110 }} />
        </ScrollView>
      )}
    </View>
  );
}

// ─── STYLES ──────────────────────────────────────────────────────
const s = StyleSheet.create({
  root:           { flex:1, backgroundColor:'#F7F8FA' },
  center:         { flex:1, alignItems:'center', justifyContent:'center', gap:10 },
  loadTxt:        { fontSize:14, color:'#888' },

  // Header
  header:         { paddingTop:56, paddingBottom:14, paddingHorizontal:16 },
  hTop:           { flexDirection:'row', alignItems:'flex-start', justifyContent:'space-between', marginBottom:12 },
  locationWrap:   { flex:1 },
  locationRow:    { flexDirection:'row', alignItems:'center', gap:4, marginBottom:3 },
  locationLbl:    { color:'rgba(255,255,255,0.8)', fontSize:12 },
  locationTxt:    { color:'#fff', fontSize:18, fontWeight:'800', maxWidth:220 },
  hActions:       { flexDirection:'row', gap:8, alignItems:'center' },
  hBtn:           { width:38, height:38, borderRadius:19, backgroundColor:'rgba(255,255,255,0.2)',
                     alignItems:'center', justifyContent:'center' },
  notifDot:       { position:'absolute', top:6, right:6, width:8, height:8, borderRadius:4,
                     backgroundColor:'#22C55E', borderWidth:1.5, borderColor:'#FF8A00' },
  avatarSmall:    { width:32, height:32, borderRadius:16, backgroundColor:'#fff',
                     alignItems:'center', justifyContent:'center' },
  searchBar:      { flexDirection:'row', alignItems:'center', backgroundColor:'#fff',
                     borderRadius:14, paddingHorizontal:14, height:46, gap:10,
                     shadowColor:'#000', shadowOpacity:0.1, shadowRadius:8, shadowOffset:{width:0,height:2} },
  searchPlaceholder:{ flex:1, fontSize:14, color:'#BBB' },
  searchFilter:   { width:28, height:28, borderRadius:8, backgroundColor:'#FFF4E6',
                     alignItems:'center', justifyContent:'center' },

  // Categories
  catWrap:        { backgroundColor:'#fff', borderBottomWidth:0.5, borderBottomColor:'#F0F0F0' },
  catContent:     { paddingHorizontal:16, paddingVertical:10, gap:8 },
  catChip:        { flexDirection:'row', alignItems:'center', gap:5, paddingHorizontal:14,
                     paddingVertical:8, borderRadius:99, backgroundColor:'#F2F3F5',
                     borderWidth:1.5, borderColor:'transparent' },
  catChipOn:      { backgroundColor:'rgba(255,138,0,0.1)', borderColor:'#FF8A00' },
  catEmoji:       { fontSize:15 },
  catTxt:         { fontSize:13, fontWeight:'600', color:'#666' },
  catTxtOn:       { color:'#FF8A00' },

  // Banner slider
  bannerSection:  { paddingHorizontal:16, paddingTop:16, paddingBottom:4 },

  bannerCard:     { width:W-32, borderRadius:20, padding:20, flexDirection:'row',
                     alignItems:'center', justifyContent:'space-between', height:110 },
  bannerBadge:    { position:'absolute', top:12, right:12, backgroundColor:'rgba(255,255,255,0.25)',
                     borderRadius:99, paddingHorizontal:8, paddingVertical:3 },
  bannerBadgeTxt: { fontSize:10, fontWeight:'800', color:'#fff', letterSpacing:1 },
  bannerTitle:    { fontSize:18, fontWeight:'800', color:'#fff', marginBottom:5 },
  bannerSub:      { fontSize:12, color:'rgba(255,255,255,0.75)', lineHeight:17, maxWidth:180 },
  bannerEmoji:    { fontSize:44 },
  dots:           { flexDirection:'row', justifyContent:'center', gap:5, marginTop:10 },
  dot:            { width:5, height:5, borderRadius:2.5, backgroundColor:'#DDD' },
  dotOn:          { backgroundColor:'#FF8A00', width:16 },

  // Sections
  section:        { paddingHorizontal:16, marginTop:20 },
  secRow:         { flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom:12 },
  secTitle:       { fontSize:18, fontWeight:'800', color:'#111' },
  secLink:        { fontSize:13, fontWeight:'700', color:'#FF8A00' },

  // Collections grid
  collectGrid:    { flexDirection:'row', flexWrap:'wrap', gap:10 },
  collectCard:    { width:(W-42)/2, borderRadius:16, padding:14, minHeight:90 },
  collectEmoji:   { fontSize:28, marginBottom:6 },
  collectLabel:   { fontSize:14, fontWeight:'700', color:'#333', marginBottom:3 },
  collectCount:   { fontSize:11, color:'#888' },

  // Featured horizontal
  featuredContent:{ gap:12, paddingRight:4 },
  featuredCard:   { width:130, backgroundColor:'#fff', borderRadius:16, overflow:'hidden',
                     shadowColor:'#000', shadowOpacity:0.05, shadowRadius:8, shadowOffset:{width:0,height:2} },
  featuredImg:    { height:80, alignItems:'center', justifyContent:'center' },
  featuredInfo:   { padding:10 },
  featuredName:   { fontSize:13, fontWeight:'700', color:'#111', marginBottom:4 },
  featuredMeta:   { flexDirection:'row', alignItems:'center', gap:3, marginBottom:3 },
  featuredMetaTxt:{ fontSize:11, color:'#888' },
  featuredDot:    { color:'#CCC', fontSize:11 },
  featuredDist:   { fontSize:11, color:'#FF8A00', fontWeight:'600' },

  // Promo banner
  promoBannerWrap:{ paddingHorizontal:16, marginTop:20 },
  promoBanner:    { borderRadius:20, padding:20, flexDirection:'row',
                     justifyContent:'space-between', alignItems:'center' },
  promoTitle:     { fontSize:16, fontWeight:'800', color:'#FF8A00', marginBottom:4 },
  promoSub:       { fontSize:12, color:'rgba(255,255,255,0.55)', marginBottom:12, lineHeight:17 },
  promoBtn:       { backgroundColor:'#FF8A00', borderRadius:10, paddingHorizontal:14, paddingVertical:8, alignSelf:'flex-start' },
  promoBtnTxt:    { color:'#fff', fontSize:13, fontWeight:'700' },

  // Sort btn
  sortBtn:        { flexDirection:'row', alignItems:'center', gap:4, backgroundColor:'#FFF4E6',
                     borderRadius:99, paddingHorizontal:12, paddingVertical:6 },
  sortTxt:        { fontSize:12, color:'#FF8A00', fontWeight:'700' },

  // Shop cards
  shopCard:       { backgroundColor:'#fff', borderRadius:18, marginBottom:12, padding:14,
                     flexDirection:'row', alignItems:'center', gap:12,
                     shadowColor:'#000', shadowOpacity:0.05, shadowRadius:10, shadowOffset:{width:0,height:3} },
  shopCardFaded:  { opacity:0.6 },
  shopImg:        { width:76, height:76, borderRadius:16, alignItems:'center', justifyContent:'center',
                     flexShrink:0, overflow:'hidden' },
  closedOverlay:  { position:'absolute', inset:0, backgroundColor:'rgba(0,0,0,0.4)',
                     alignItems:'center', justifyContent:'center', borderRadius:16 },
  closedTxt:      { fontSize:9, fontWeight:'900', color:'#fff', letterSpacing:1 },
  shopTopRow:     { flexDirection:'row', alignItems:'center', justifyContent:'space-between', marginBottom:6 },
  shopName:       { fontSize:15, fontWeight:'700', color:'#111', flex:1 },
  openPill:       { flexDirection:'row', alignItems:'center', gap:4, backgroundColor:'#DCFCE7',
                     borderRadius:99, paddingHorizontal:8, paddingVertical:3 },
  greenDot:       { width:6, height:6, borderRadius:3, backgroundColor:'#22C55E' },
  openTxt:        { fontSize:11, fontWeight:'700', color:'#16A34A' },
  closedPill:     { backgroundColor:'#FEE2E2', borderRadius:99, paddingHorizontal:8, paddingVertical:3 },
  closedPillTxt:  { fontSize:11, fontWeight:'700', color:'#DC2626' },
  tag:            { backgroundColor:'#F2F3F5', borderRadius:99, paddingHorizontal:9, paddingVertical:3 },
  tagTxt:         { fontSize:11, color:'#666', fontWeight:'500' },
  shopMetaRow:    { flexDirection:'row', alignItems:'center', gap:4 },
  shopMetaTxt:    { fontSize:11, color:'#888', fontWeight:'500' },
  shopMetaSep:    { color:'#DDD', fontSize:11 },
  freeDelivery:   { flexDirection:'row', alignItems:'center', gap:3, backgroundColor:'#DCFCE7',
                     borderRadius:99, paddingHorizontal:8, paddingVertical:3, marginTop:6, alignSelf:'flex-start' },
  freeDeliveryTxt:{ fontSize:11, color:'#16A34A', fontWeight:'600' },

  // Empty
  empty:          { alignItems:'center', paddingVertical:40, gap:8 },
  emptyT:         { fontSize:17, fontWeight:'700', color:'#333' },
  emptySub:       { fontSize:13, color:'#999' },

  // Bottom CTA
  productGrid:    { flexDirection:'row', flexWrap:'wrap', gap:10, marginBottom:8 },
  productCard:    { width:(W-42)/2, backgroundColor:'#fff', borderRadius:16, padding:12,
                     shadowColor:'#000', shadowOpacity:0.05, shadowRadius:8, shadowOffset:{width:0,height:2} },
  productImg:     { width:'100%', height:90, borderRadius:12 },
  productImgWrap: { width:'100%', height:90, backgroundColor:'#FFF4E6', borderRadius:12,
                     alignItems:'center', justifyContent:'center', marginBottom:8, overflow:'hidden' },
  productEmoji:   { fontSize:40 },
  productBadge:   { position:'absolute', top:6, left:6, backgroundColor:'#FF8A00',
                     borderRadius:6, paddingHorizontal:6, paddingVertical:2 },
  productBadgeTxt:{ fontSize:9, fontWeight:'800', color:'#fff', letterSpacing:0.5 },
  productName:    { fontSize:13, fontWeight:'700', color:'#111', marginBottom:4, lineHeight:18 },
  productShop:    { fontSize:11, color:'#999', marginBottom:8 },
  productBottom:  { flexDirection:'row', alignItems:'center', justifyContent:'space-between' },
  productPrice:   { fontSize:15, fontWeight:'800', color:'#FF8A00' },
  productAddBtn:  { width:28, height:28, borderRadius:8, borderWidth:1.5, borderColor:'#FF8A00',
                     alignItems:'center', justifyContent:'center' },
  miniCounter:    { flexDirection:'row', alignItems:'center', backgroundColor:'#FF8A00', borderRadius:8, overflow:'hidden' },
  miniBtn:        { width:24, height:26, alignItems:'center', justifyContent:'center' },
  miniNum:        { fontSize:12, fontWeight:'800', color:'#fff', minWidth:20, textAlign:'center' },
  // Deal cards
  dealCard:        { width: 186, borderRadius: 20, padding: 14, overflow: 'hidden',
                      shadowColor: '#7C3AED', shadowOpacity: 0.3, shadowRadius: 12,
                      shadowOffset: { width: 0, height: 4 }, elevation: 6 },
  dealCircle1:     { position: 'absolute', width: 100, height: 100, borderRadius: 50,
                      backgroundColor: 'rgba(255,255,255,0.07)', top: -28, right: -28 },
  dealCircle2:     { position: 'absolute', width: 60, height: 60, borderRadius: 30,
                      backgroundColor: 'rgba(255,255,255,0.06)', bottom: 10, right: 10 },
  dealAutoBadge:   { alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.22)',
                      borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3, marginBottom: 10 },
  dealAutoBadgeTxt:{ fontSize: 9, fontWeight: '800', color: '#fff', letterSpacing: 0.8 },
  dealOffAmt:      { fontSize: 36, fontWeight: '900', color: '#fff', lineHeight: 38 },
  dealOffOff:      { fontSize: 12, fontWeight: '800', color: 'rgba(255,255,255,0.7)',
                      letterSpacing: 2, marginBottom: 8 },
  dealTitle:       { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.85)',
                      lineHeight: 17, marginBottom: 10 },
  dealDivider:     { height: 1, backgroundColor: 'rgba(255,255,255,0.15)', marginBottom: 10 },
  dealBottom:      { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dealShopName:    { fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.85)', marginBottom: 2 },
  dealMinOrder:    { fontSize: 10, color: 'rgba(255,255,255,0.55)' },
  dealShopNow:     { flexDirection: 'row', alignItems: 'center', gap: 3,
                      backgroundColor: 'rgba(255,255,255,0.22)', borderRadius: 8,
                      paddingHorizontal: 8, paddingVertical: 5, flexShrink: 0 },
  dealShopNowTxt:  { fontSize: 11, fontWeight: '800', color: '#fff' },

  // Home producer cards
  producerCard:   { width:110, alignItems:'center' },
  producerImg:    { width:80, height:80, borderRadius:40, alignItems:'center', justifyContent:'center', marginBottom:8 },
  producerName:   { fontSize:12, fontWeight:'700', color:'#111', textAlign:'center', marginBottom:2 },
  producerSub:    { fontSize:11, color:'#888', textAlign:'center', marginBottom:4 },
  producerRating: { flexDirection:'row', alignItems:'center', gap:3 },
  producerRatingTxt:{ fontSize:11, color:'#F59E0B', fontWeight:'700' },

  // Feed cards
  feedCard:       { backgroundColor:'#fff', borderRadius:14, padding:12, marginBottom:10,
                     flexDirection:'row', alignItems:'center', gap:10,
                     shadowColor:'#000', shadowOpacity:0.04, shadowRadius:6, shadowOffset:{width:0,height:2} },
  feedIconWrap:   { width:40, height:40, borderRadius:12, backgroundColor:'#FFF4E6',
                     alignItems:'center', justifyContent:'center', flexShrink:0 },
  feedTitle:      { fontSize:13, fontWeight:'700', color:'#111', marginBottom:2 },
  feedBody:       { fontSize:12, color:'#555', marginBottom:3 },
  feedShop:       { fontSize:11, color:'#AAA' },

  // Late night cards
  nightCard:      { width:130, borderRadius:18, overflow:'hidden' },
  nightCardGrad:  { padding:14, height:150, justifyContent:'flex-end' },
  nightName:      { fontSize:13, fontWeight:'800', color:'#fff', marginBottom:3 },
  nightTag:       { fontSize:10, color:'rgba(255,255,255,0.6)', marginBottom:8 },
  nightBadge:     { flexDirection:'row', alignItems:'center', gap:5 },
  nightBadgeTxt:  { fontSize:11, fontWeight:'700', color:'#22C55E' },

  bottomCta:      { margin:16, backgroundColor:'#fff', borderRadius:20, padding:20, alignItems:'center', gap:6,
                     shadowColor:'#000', shadowOpacity:0.05, shadowRadius:10, shadowOffset:{width:0,height:3} },
  bottomCtaTitle: { fontSize:16, fontWeight:'800', color:'#111' },
  bottomCtaSub:   { fontSize:13, color:'#888', marginBottom:6 },
  suggestBtn:     { borderRadius:12, overflow:'hidden', alignSelf:'stretch' },
  suggestGrad:    { paddingVertical:13, alignItems:'center' },
  suggestTxt:     { color:'#fff', fontSize:14, fontWeight:'700' },
});
