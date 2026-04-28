import React, { useEffect, useRef } from 'react';
import { Animated, Dimensions, Easing, StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, Line, LinearGradient, Path, Stop } from 'react-native-svg';

const { width: W } = Dimensions.get('window');

// Smaller overall size — fits comfortably on any screen
const H   = W * 0.22;   // letter height
const GAP = W * 0.02;   // gap between letters

// Letter widths
const ZW  = H * 0.74;
const UW  = H * 0.66;
const QW  = H * 1.00;

// Total logo width
const TOTAL = ZW + UW + QW + UW + GAP * 3;

interface Props { onFinish: () => void }

export default function AnimatedSplash({ onFinish }: Props) {
  const l1 = useRef(new Animated.Value(-200)).current;
  const l2 = useRef(new Animated.Value(-200)).current;
  const l3 = useRef(new Animated.Value(-200)).current;
  const zO = useRef(new Animated.Value(0)).current;
  const zX = useRef(new Animated.Value(-36)).current;
  const aO = useRef(new Animated.Value(0)).current;
  const aX = useRef(new Animated.Value(36)).current;
  const qO = useRef(new Animated.Value(0)).current;
  const qX = useRef(new Animated.Value(36)).current;
  const bO = useRef(new Animated.Value(0)).current;
  const bX = useRef(new Animated.Value(36)).current;
  const pY = useRef(new Animated.Value(-28)).current;
  const pO = useRef(new Animated.Value(0)).current;
  const rS = useRef(new Animated.Value(1)).current;
  const rO = useRef(new Animated.Value(0)).current;
  const sO = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const e = Easing.out(Easing.cubic);
    Animated.sequence([
      // Lines
      Animated.stagger(50, [
        Animated.timing(l1, { toValue:0, duration:220, easing:Easing.out(Easing.exp), useNativeDriver:true }),
        Animated.timing(l2, { toValue:0, duration:220, easing:Easing.out(Easing.exp), useNativeDriver:true }),
        Animated.timing(l3, { toValue:0, duration:220, easing:Easing.out(Easing.exp), useNativeDriver:true }),
      ]),
      // All letters together, staggered
      Animated.parallel([
        Animated.parallel([
          Animated.timing(zO, { toValue:1, duration:190, easing:e, useNativeDriver:true }),
          Animated.timing(zX, { toValue:0, duration:230, easing:e, useNativeDriver:true }),
        ]),
        Animated.sequence([ Animated.delay(55),  Animated.parallel([
          Animated.timing(aO, { toValue:1, duration:190, easing:e, useNativeDriver:true }),
          Animated.timing(aX, { toValue:0, duration:230, easing:e, useNativeDriver:true }),
        ])]),
        Animated.sequence([ Animated.delay(110), Animated.parallel([
          Animated.timing(qO, { toValue:1, duration:190, easing:e, useNativeDriver:true }),
          Animated.timing(qX, { toValue:0, duration:230, easing:e, useNativeDriver:true }),
        ])]),
        Animated.sequence([ Animated.delay(165), Animated.parallel([
          Animated.timing(bO, { toValue:1, duration:190, easing:e, useNativeDriver:true }),
          Animated.timing(bX, { toValue:0, duration:230, easing:e, useNativeDriver:true }),
        ])]),
      ]),
      // Pin bounce
      Animated.parallel([
        Animated.timing(pO, { toValue:1, duration:90,  easing:e,            useNativeDriver:true }),
        Animated.timing(pY, { toValue:0, duration:360, easing:Easing.bounce, useNativeDriver:true }),
      ]),
      // Radar
      Animated.parallel([
        Animated.timing(rO, { toValue:0.55, duration:80,  easing:e,                    useNativeDriver:true }),
        Animated.timing(rS, { toValue:2.6,  duration:480, easing:Easing.out(Easing.quad), useNativeDriver:true }),
        Animated.timing(rO, { toValue:0,    duration:480, easing:Easing.in(Easing.quad),  useNativeDriver:true }),
      ]),
      Animated.delay(620),
      Animated.timing(sO, { toValue:0, duration:320, easing:Easing.in(Easing.quad), useNativeDriver:true }),
    ]).start(() => onFinish());
  }, []);

  return (
    <Animated.View style={[s.root, { opacity:sO }]}>

      {/* Speed lines + logo in one row so lines stay flush left of Z */}
      <View style={s.logoWrap}>

        {/* Speed lines column */}
        <View style={s.lines}>
          <Animated.View style={[s.line, { width:60, transform:[{ translateX:l1 }] }]} />
          <Animated.View style={[s.line, { width:46, opacity:0.62, marginTop:12, transform:[{ translateX:l2 }] }]} />
          <Animated.View style={[s.line, { width:30, opacity:0.36, marginTop:10, transform:[{ translateX:l3 }] }]} />
        </View>

        {/* Letters */}
        <View style={s.lettersRow}>

          {/* Z */}
          <Animated.View style={{ opacity:zO, transform:[{ translateX:zX }] }}>
            <Svg width={ZW} height={H} viewBox="0 0 148 220">
              <Defs>
                <LinearGradient id="zg" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0%" stopColor="#FF8A00"/>
                  <Stop offset="100%" stopColor="#FF5C00"/>
                </LinearGradient>
              </Defs>
              <Line x1="12"  y1="24"  x2="136" y2="24"  stroke="url(#zg)" strokeWidth="30" strokeLinecap="round"/>
              <Line x1="126" y1="42"  x2="22"  y2="178" stroke="url(#zg)" strokeWidth="30" strokeLinecap="round"/>
              <Line x1="12"  y1="196" x2="136" y2="196" stroke="url(#zg)" strokeWidth="30" strokeLinecap="round"/>
            </Svg>
          </Animated.View>

          {/* u left — y starts at 56 so bottom (208) ≈ matches Z bottom (196) */}
          <Animated.View style={{ opacity:aO, transform:[{ translateX:aX }], marginLeft:GAP }}>
            <Svg width={UW} height={H} viewBox="0 0 132 240">
              <Line x1="20"  y1="56"  x2="20"  y2="152" stroke="white" strokeWidth="34" strokeLinecap="round"/>
              <Path d="M20 152 Q20 204 66 204 Q112 204 112 152" fill="none" stroke="white" strokeWidth="34" strokeLinecap="round"/>
              <Line x1="112" y1="152" x2="112" y2="56"  stroke="white" strokeWidth="34" strokeLinecap="round"/>
            </Svg>
          </Animated.View>

          {/* Q */}
          <Animated.View style={{ opacity:qO, transform:[{ translateX:qX }], marginLeft:GAP }}>
            <View style={{ width:QW, height:H }}>
              {/* Radar ring */}
              <Animated.View style={[s.radar, {
                width:H*0.54, height:H*0.54, borderRadius:H*0.27,
                top:H*0.08, left:H*0.05,
                opacity:rO, transform:[{ scale:rS }],
              }]}/>
              {/* Q ring + handle */}
              <Svg width={QW} height={H} viewBox="0 0 190 220" style={StyleSheet.absoluteFill}>
                <Circle cx="86" cy="98" r="60" fill="none" stroke="white" strokeWidth="28"/>
                <Line x1="132" y1="146" x2="176" y2="200" stroke="white" strokeWidth="26" strokeLinecap="round"/>
              </Svg>
              {/* Pin */}
              <Animated.View style={[StyleSheet.absoluteFill, { opacity:pO, transform:[{ translateY:pY }] }]}>
                <Svg width={QW} height={H} viewBox="0 0 190 220">
                  <Circle cx="86" cy="88" r="16" fill="#FF8A00"/>
                  <Circle cx="86" cy="88" r="6.5" fill="white"/>
                  <Path d="M86 104 Q74 124 86 142 Q98 124 86 104" fill="#FF8A00"/>
                </Svg>
              </Animated.View>
            </View>
          </Animated.View>

          {/* u right */}
          <Animated.View style={{ opacity:bO, transform:[{ translateX:bX }], marginLeft:GAP }}>
            <Svg width={UW} height={H} viewBox="0 0 132 240">
              <Line x1="20"  y1="56"  x2="20"  y2="152" stroke="white" strokeWidth="34" strokeLinecap="round"/>
              <Path d="M20 152 Q20 204 66 204 Q112 204 112 152" fill="none" stroke="white" strokeWidth="34" strokeLinecap="round"/>
              <Line x1="112" y1="152" x2="112" y2="56"  stroke="white" strokeWidth="34" strokeLinecap="round"/>
            </Svg>
          </Animated.View>

        </View>
      </View>

      {/* Tagline */}
      <Animated.Text style={[s.tagline, {
        opacity: bO,
        transform:[{ translateY: bO.interpolate({ inputRange:[0,1], outputRange:[8,0] }) }],
      }]}>
        YOUR NEIGHBOURHOOD · INSTANT
      </Animated.Text>

    </Animated.View>
  );
}

const s = StyleSheet.create({
  root:       { ...StyleSheet.absoluteFillObject, backgroundColor:'#020A14',
                 alignItems:'center', justifyContent:'center', zIndex:999 },
  logoWrap:   { flexDirection:'row', alignItems:'center' },
  lines:      { alignItems:'flex-end', marginRight:14, marginTop:H*0.15 },
  line:       { height:11, borderRadius:6, backgroundColor:'#FF8A00' },
  lettersRow: { flexDirection:'row', alignItems:'flex-end' },
  radar:      { position:'absolute', borderWidth:2, borderColor:'#FF8A00' },
  tagline:    { marginTop:24, color:'rgba(255,255,255,0.25)',
                 fontSize:10, fontWeight:'500', letterSpacing:4 },
});
