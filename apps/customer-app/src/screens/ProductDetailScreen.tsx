import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Platform, Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useCart } from '../store/CartContext';
import { getShopProducts } from '../services/api';

const { width: W } = Dimensions.get('window');

const MOCK_SHOP = {
  id: '341e69d3',
  name: 'Raju General Store',
  address: '12, 5th Cross, HSR Layout, Bengaluru - 560102',
  rating: 4.8,
  reviews: 124,
  eta: '8 min',
  distance: '0.3 km',
  is_open: true,
  phone: '+91 98765 43210',
};

const SIMILAR = [
  { id:'s1', name:'Haldirams Bhujia 200g', price:60,  emoji:'🥜' },
  { id:'s2', name:'Too Yumm Chips 80g',    price:25,  emoji:'🍟' },
  { id:'s3', name:'Bingo Mad Angles 130g', price:30,  emoji:'🍿' },
];

export default function ProductDetailScreen({ route, navigation }: any) {
  const { product: passedProduct, shop: passedShop } = route.params || {};
  const { addItem, updateQty, items } = useCart();
  const [activeTab, setActiveTab] = useState<'details'|'nutrition'>('details');
  const [liveProduct, setLiveProduct] = useState<any>(passedProduct);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const shop    = passedShop || MOCK_SHOP;
  const product = liveProduct || passedProduct;

  // ── Poll for live stock status every 10 seconds
  useEffect(() => {
    const fetchLive = async () => {
      if (!shop?.id || !passedProduct?.id) return;
      try {
        const res = await getShopProducts(shop.id);
        const found = (res.data?.products ?? []).find((p: any) => p.id === passedProduct.id);
        if (found) setLiveProduct({ ...passedProduct, ...found, emoji: passedProduct.emoji });
      } catch { /* silently keep showing stale data */ }
    };
    fetchLive(); // immediate fetch on mount
    pollRef.current = setInterval(fetchLive, 10_000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [shop?.id, passedProduct?.id]);

  const qty    = items.find(i => i.product_id === product?.id)?.quantity || 0;
  // API uses 'low' for low stock (not 'low_stock')
  const isOos  = product?.stock_status === 'out_of_stock';
  const isLow  = product?.stock_status === 'low' || product?.stock_status === 'low_stock';

  const handleAdd = () => {
    addItem(
      { product_id: product.id, name: product.name, price: product.price, quantity: 1 },
      shop.id, shop.name
    );
  };

  const handleInc = () => handleAdd();
  const handleDec = () => updateQty(product.id, qty - 1);

  if (!product) {
    return (
      <View style={s.root}>
        <Text style={{ color:'#fff', textAlign:'center', marginTop:100 }}>Product not found</Text>
      </View>
    );
  }

  return (
    <View style={s.root}>
      {/* Header */}
      <LinearGradient colors={['#FF8A00','#FF5C00']} style={s.header}>
        <TouchableOpacity style={s.iconBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={s.headerTitle} numberOfLines={1}>{product.name}</Text>
        <TouchableOpacity style={s.iconBtn}>
          <Ionicons name="share-outline" size={22} color="#fff" />
        </TouchableOpacity>
      </LinearGradient>

      <ScrollView showsVerticalScrollIndicator={false}>

        {/* Product image hero */}
        <View style={s.heroWrap}>
          <LinearGradient colors={['#FFF4E6','#FFE8CC']} style={s.heroImg}>
            <Text style={s.heroEmoji}>{product.emoji || '📦'}</Text>
          </LinearGradient>
          {isOos && (
            <View style={[s.heroBadge, { backgroundColor:'#EF4444' }]}>
              <Text style={s.heroBadgeTxt}>OUT OF STOCK</Text>
            </View>
          )}
          {isLow && !isOos && (
            <View style={[s.heroBadge, { backgroundColor:'#F59E0B' }]}>
              <Text style={s.heroBadgeTxt}>LOW STOCK</Text>
            </View>
          )}
        </View>

        {/* Product info card */}
        <View style={s.infoCard}>
          <View style={s.infoTop}>
            <View style={{ flex:1 }}>
              <Text style={s.productName}>{product.name}</Text>
              <Text style={s.productUnit}>{product.unit || product.brand || '1 piece'}</Text>
            </View>
            <Text style={s.productPrice}>₹{parseFloat(product.price).toFixed(0)}</Text>
          </View>

          {/* Rating + stock row */}
          <View style={s.ratingRow}>
            <View style={s.ratingPill}>
              <Ionicons name="star" size={13} color="#F59E0B" />
              <Text style={s.ratingTxt}>4.5</Text>
            </View>
            <Text style={s.ratingCount}>128 ratings</Text>
            <View style={s.dot} />
            {isOos
              ? <Text style={[s.inStockTxt, { color:'#EF4444' }]}>❌ Out of Stock</Text>
              : isLow
              ? <Text style={[s.inStockTxt, { color:'#F59E0B' }]}>⚠️ Low Stock</Text>
              : <Text style={s.inStockTxt}>✅ In Stock</Text>
            }
          </View>

          {/* Add to cart */}
          <View style={s.cartRow}>
            {isOos ? (
              <View style={[s.addBtn, { opacity: 0.5 }]}>
                <View style={[s.addBtnGrad, { backgroundColor:'#9CA3AF', borderRadius:16, justifyContent:'center', alignItems:'center', flexDirection:'row', gap:8 }]}>
                  <Ionicons name="close-circle-outline" size={20} color="#fff" />
                  <Text style={s.addBtnTxt}>Out of Stock</Text>
                </View>
              </View>
            ) : qty === 0 ? (
              <TouchableOpacity style={s.addBtn} onPress={handleAdd} activeOpacity={0.85}>
                <LinearGradient colors={['#FF8A00','#FF5C00']} style={s.addBtnGrad}
                  start={{ x:0,y:0 }} end={{ x:1,y:0 }}>
                  <Ionicons name="cart-outline" size={20} color="#fff" />
                  <Text style={s.addBtnTxt}>Add to Cart</Text>
                </LinearGradient>
              </TouchableOpacity>
            ) : (
              <View style={s.counterWrap}>
                <View style={s.counter}>
                  <TouchableOpacity style={s.cBtn} onPress={handleDec}>
                    <Ionicons name={qty === 1 ? 'trash-outline' : 'remove'} size={18} color="#fff" />
                  </TouchableOpacity>
                  <Text style={s.cNum}>{qty}</Text>
                  <TouchableOpacity style={s.cBtn} onPress={handleInc}>
                    <Ionicons name="add" size={18} color="#fff" />
                  </TouchableOpacity>
                </View>
                <Text style={s.totalInCart}>₹{product.price * qty} in cart</Text>
              </View>
            )}
          </View>
        </View>

        {/* Tabs */}
        <View style={s.tabs}>
          {(['details','nutrition'] as const).map(t => (
            <TouchableOpacity key={t} style={[s.tab, activeTab===t && s.tabActive]}
              onPress={() => setActiveTab(t)}>
              <Text style={[s.tabTxt, activeTab===t && s.tabTxtActive]}>
                {t === 'details' ? 'Details' : 'Nutrition'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Tab content */}
        <View style={s.tabContent}>
          {activeTab === 'details' ? (
            <>
              <View style={s.detailRow}>
                <Text style={s.detailLbl}>Category</Text>
                <Text style={s.detailVal}>{product.category || '—'}</Text>
              </View>
              <View style={s.divider} />
              <View style={s.detailRow}>
                <Text style={s.detailLbl}>Net Weight</Text>
                <Text style={s.detailVal}>{product.unit || '1 piece'}</Text>
              </View>
              <View style={s.divider} />
              <View style={s.detailRow}>
                <Text style={s.detailLbl}>Brand</Text>
                <Text style={s.detailVal}>{product.brand || 'Standard'}</Text>
              </View>
              <View style={s.divider} />
              <View style={s.detailRow}>
                <Text style={s.detailLbl}>MRP</Text>
                <Text style={s.detailVal}>₹{product.price}</Text>
              </View>
            </>
          ) : (
            <>
              {[
                { label:'Energy',      value:'120 kcal' },
                { label:'Protein',     value:'3.2g'     },
                { label:'Carbs',       value:'18.5g'    },
                { label:'Fat',         value:'4.1g'     },
                { label:'Sodium',      value:'180mg'    },
              ].map((n, i, arr) => (
                <View key={n.label}>
                  <View style={s.detailRow}>
                    <Text style={s.detailLbl}>{n.label}</Text>
                    <Text style={s.detailVal}>{n.value}</Text>
                  </View>
                  {i < arr.length-1 && <View style={s.divider} />}
                </View>
              ))}
              <Text style={s.nutritionNote}>*Per 100g serving</Text>
            </>
          )}
        </View>

        {/* Shop card */}
        <View style={s.sectionTitle}>
          <Text style={s.secTxt}>Available at</Text>
        </View>
        <TouchableOpacity style={s.shopCard}
          onPress={() => navigation.navigate('Shop', { shop })}
          activeOpacity={0.88}>
          <LinearGradient colors={['#FFF4E6','#FFE8CC']} style={s.shopIcon}>
            <Text style={{ fontSize:24 }}>🏪</Text>
          </LinearGradient>
          <View style={{ flex:1 }}>
            <Text style={s.shopName}>{shop.name}</Text>
            <View style={s.shopMeta}>
              <Ionicons name="star" size={12} color="#F59E0B" />
              <Text style={s.shopMetaTxt}>{shop.rating}  ·  {shop.eta}  ·  {shop.distance}</Text>
            </View>
            <View style={s.shopAddr}>
              <Ionicons name="location-outline" size={12} color="#999" />
              <Text style={s.shopAddrTxt} numberOfLines={1}>{shop.address}</Text>
            </View>
          </View>
          <View style={[s.openBadge, !shop.is_open && s.closedBadge]}>
            <Text style={[s.openTxt, !shop.is_open && { color:'#DC2626' }]}>
              {shop.is_open ? 'Open' : 'Closed'}
            </Text>
          </View>
        </TouchableOpacity>

        {/* Delivery info */}
        <View style={s.deliveryCard}>
          {[
            { icon:'time-outline',     txt:`Delivered in ${shop.eta}`,       sub:'Express from local shop'  },
            { icon:'bicycle-outline',  txt:'Free delivery above ₹199',       sub:'₹25 delivery fee below'   },
            { icon:'shield-checkmark-outline', txt:'Fresh & quality assured', sub:'100% authentic products'  },
          ].map((d, i) => (
            <View key={i} style={[s.deliveryRow, i < 2 && s.deliveryRowBorder]}>
              <View style={s.deliveryIcon}>
                <Ionicons name={d.icon as any} size={18} color="#FF8A00" />
              </View>
              <View>
                <Text style={s.deliveryTxt}>{d.txt}</Text>
                <Text style={s.deliverySub}>{d.sub}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Similar products */}
        <View style={s.sectionTitle}>
          <Text style={s.secTxt}>Similar Products</Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.similarContent}>
          {SIMILAR.map(p => (
            <TouchableOpacity key={p.id} style={s.similarCard} activeOpacity={0.85}>
              <View style={s.similarImg}>
                <Text style={{ fontSize:28 }}>{p.emoji}</Text>
              </View>
              <Text style={s.similarName} numberOfLines={2}>{p.name}</Text>
              <Text style={s.similarPrice}>₹{p.price}</Text>
              <TouchableOpacity style={s.similarAdd}
                onPress={() => addItem(
                  { product_id: p.id, name: p.name, price: p.price, quantity: 1 },
                  shop.id, shop.name
                )}>
                <Ionicons name="add" size={16} color="#FF8A00" />
              </TouchableOpacity>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={{ height:120 }} />
      </ScrollView>

      {/* Sticky bottom bar */}
      {qty > 0 && (
        <View style={s.stickyBar}>
          <View>
            <Text style={s.stickyLbl}>Cart Total</Text>
            <Text style={s.stickyTotal}>₹{items.reduce((t,i) => t + i.price * i.quantity, 0)}</Text>
          </View>
          <TouchableOpacity style={{ flex:1, borderRadius:14, overflow:'hidden', marginLeft:16 }}
            onPress={() => navigation.navigate('Cart')}>
            <LinearGradient colors={['#FF8A00','#FF5C00']} style={s.stickyBtn}
              start={{ x:0,y:0 }} end={{ x:1,y:0 }}>
              <Text style={s.stickyBtnTxt}>View Cart</Text>
              <Ionicons name="arrow-forward" size={18} color="#fff" />
            </LinearGradient>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root:           { flex:1, backgroundColor:'#F7F8FA' },
  header:         { paddingTop:Platform.OS==='ios'?56:36, paddingBottom:16, paddingHorizontal:20,
                     flexDirection:'row', alignItems:'center', gap:14 },
  iconBtn:        { width:36, height:36, borderRadius:18, backgroundColor:'rgba(255,255,255,0.2)',
                     alignItems:'center', justifyContent:'center' },
  headerTitle:    { flex:1, fontSize:17, fontWeight:'700', color:'#fff' },

  heroWrap:       { backgroundColor:'#fff', alignItems:'center', paddingVertical:32, position:'relative' },
  heroImg:        { width:W*0.5, height:W*0.5, borderRadius:24, alignItems:'center', justifyContent:'center' },
  heroEmoji:      { fontSize:W*0.22 },
  heroBadge:      { position:'absolute', top:20, right:20, backgroundColor:'#FF8A00',
                     borderRadius:8, paddingHorizontal:10, paddingVertical:4 },
  heroBadgeTxt:   { fontSize:11, fontWeight:'800', color:'#fff', letterSpacing:0.5 },

  infoCard:       { backgroundColor:'#fff', marginHorizontal:16, marginTop:12, borderRadius:18, padding:18,
                     shadowColor:'#000', shadowOpacity:0.05, shadowRadius:10, shadowOffset:{width:0,height:3} },
  infoTop:        { flexDirection:'row', alignItems:'flex-start', marginBottom:10 },
  productName:    { fontSize:18, fontWeight:'800', color:'#111', marginBottom:4 },
  productUnit:    { fontSize:13, color:'#999' },
  productPrice:   { fontSize:24, fontWeight:'900', color:'#FF8A00', marginLeft:10 },
  ratingRow:      { flexDirection:'row', alignItems:'center', gap:8, marginBottom:18 },
  ratingPill:     { flexDirection:'row', alignItems:'center', gap:3, backgroundColor:'#FEF9C3',
                     borderRadius:99, paddingHorizontal:8, paddingVertical:3 },
  ratingTxt:      { fontSize:12, fontWeight:'700', color:'#92400E' },
  ratingCount:    { fontSize:12, color:'#888' },
  dot:            { width:3, height:3, borderRadius:1.5, backgroundColor:'#DDD' },
  inStockTxt:     { fontSize:12, color:'#555', fontWeight:'500' },

  cartRow:        { },
  addBtn:         { borderRadius:14, overflow:'hidden' },
  addBtnGrad:     { flexDirection:'row', alignItems:'center', justifyContent:'center',
                     gap:8, paddingVertical:14 },
  addBtnTxt:      { fontSize:16, fontWeight:'800', color:'#fff' },
  counterWrap:    { alignItems:'center', gap:8 },
  counter:        { flexDirection:'row', alignItems:'center', backgroundColor:'#FF8A00',
                     borderRadius:14, overflow:'hidden', alignSelf:'stretch' },
  cBtn:           { flex:1, paddingVertical:13, alignItems:'center' },
  cNum:           { fontSize:18, fontWeight:'900', color:'#fff', minWidth:40, textAlign:'center' },
  totalInCart:    { fontSize:12, color:'#888', fontWeight:'600' },

  tabs:           { flexDirection:'row', backgroundColor:'#fff', marginHorizontal:16, marginTop:12,
                     borderRadius:14, padding:4,
                     shadowColor:'#000', shadowOpacity:0.04, shadowRadius:6, shadowOffset:{width:0,height:2} },
  tab:            { flex:1, paddingVertical:9, borderRadius:10, alignItems:'center' },
  tabActive:      { backgroundColor:'#FF8A00' },
  tabTxt:         { fontSize:13, fontWeight:'700', color:'#999' },
  tabTxtActive:   { color:'#fff' },

  tabContent:     { backgroundColor:'#fff', marginHorizontal:16, marginTop:2, borderRadius:14, padding:16,
                     shadowColor:'#000', shadowOpacity:0.04, shadowRadius:6, shadowOffset:{width:0,height:2} },
  detailRow:      { flexDirection:'row', justifyContent:'space-between', paddingVertical:10 },
  detailLbl:      { fontSize:14, color:'#888' },
  detailVal:      { fontSize:14, color:'#111', fontWeight:'600' },
  divider:        { height:0.5, backgroundColor:'#F5F5F5' },
  nutritionNote:  { fontSize:11, color:'#BBB', marginTop:10, textAlign:'right' },

  sectionTitle:   { paddingHorizontal:16, marginTop:20, marginBottom:10 },
  secTxt:         { fontSize:17, fontWeight:'800', color:'#111' },

  shopCard:       { backgroundColor:'#fff', marginHorizontal:16, borderRadius:18, padding:16,
                     flexDirection:'row', alignItems:'center', gap:12,
                     shadowColor:'#000', shadowOpacity:0.05, shadowRadius:10, shadowOffset:{width:0,height:3} },
  shopIcon:       { width:52, height:52, borderRadius:14, alignItems:'center', justifyContent:'center' },
  shopName:       { fontSize:15, fontWeight:'700', color:'#111', marginBottom:4 },
  shopMeta:       { flexDirection:'row', alignItems:'center', gap:4, marginBottom:3 },
  shopMetaTxt:    { fontSize:12, color:'#888' },
  shopAddr:       { flexDirection:'row', alignItems:'center', gap:4 },
  shopAddrTxt:    { fontSize:11, color:'#AAA', flex:1 },
  openBadge:      { backgroundColor:'#DCFCE7', borderRadius:99, paddingHorizontal:10, paddingVertical:5 },
  closedBadge:    { backgroundColor:'#FEE2E2' },
  openTxt:        { fontSize:11, fontWeight:'700', color:'#16A34A' },

  deliveryCard:   { backgroundColor:'#fff', marginHorizontal:16, marginTop:12, borderRadius:18,
                     overflow:'hidden',
                     shadowColor:'#000', shadowOpacity:0.05, shadowRadius:10, shadowOffset:{width:0,height:3} },
  deliveryRow:    { flexDirection:'row', alignItems:'center', gap:14, padding:14 },
  deliveryRowBorder:{ borderBottomWidth:0.5, borderBottomColor:'#F5F5F5' },
  deliveryIcon:   { width:38, height:38, borderRadius:10, backgroundColor:'#FFF4E6',
                     alignItems:'center', justifyContent:'center' },
  deliveryTxt:    { fontSize:14, fontWeight:'600', color:'#111', marginBottom:2 },
  deliverySub:    { fontSize:12, color:'#AAA' },

  similarContent: { paddingHorizontal:16, gap:10 },
  similarCard:    { width:130, backgroundColor:'#fff', borderRadius:16, padding:12,
                     shadowColor:'#000', shadowOpacity:0.05, shadowRadius:8, shadowOffset:{width:0,height:2} },
  similarImg:     { height:70, backgroundColor:'#FFF4E6', borderRadius:12,
                     alignItems:'center', justifyContent:'center', marginBottom:8 },
  similarName:    { fontSize:12, fontWeight:'600', color:'#111', marginBottom:4, lineHeight:17 },
  similarPrice:   { fontSize:14, fontWeight:'800', color:'#FF8A00', marginBottom:6 },
  similarAdd:     { width:28, height:28, borderRadius:8, borderWidth:1.5, borderColor:'#FF8A00',
                     alignItems:'center', justifyContent:'center', alignSelf:'flex-end' },

  stickyBar:      { position:'absolute', bottom:0, left:0, right:0, backgroundColor:'#fff',
                     flexDirection:'row', alignItems:'center', padding:16,
                     paddingBottom:Platform.OS==='ios'?32:16,
                     borderTopWidth:0.5, borderTopColor:'#F0F0F0',
                     shadowColor:'#000', shadowOpacity:0.1, shadowRadius:12, shadowOffset:{width:0,height:-4} },
  stickyLbl:      { fontSize:11, color:'#888', fontWeight:'600' },
  stickyTotal:    { fontSize:20, fontWeight:'900', color:'#111' },
  stickyBtn:      { flexDirection:'row', alignItems:'center', justifyContent:'center',
                     gap:8, paddingVertical:14, borderRadius:14 },
  stickyBtnTxt:   { fontSize:15, fontWeight:'800', color:'#fff' },
});
