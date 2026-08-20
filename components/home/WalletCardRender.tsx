import React from 'react';
import { StyleSheet, View, Text, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import Svg, { Path, Rect, Circle, G, Defs, Pattern, LinearGradient as SvgGradient, Stop } from 'react-native-svg';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { CardStyle } from '@/lib/storage';

interface WalletCardRenderProps {
  name: string;
  balanceFormatted: string;
  currencySymbol: string;
  cardStyle: CardStyle;
  color: string;
  icon?: string;
  cardNumber?: string;
  expiry?: string;
  isShared?: boolean;
  sharedLabel?: string;
  height?: number;
}

export default function WalletCardRender({
  name,
  balanceFormatted,
  currencySymbol,
  cardStyle = 'classic',
  color = '#0D7C66',
  icon = 'account-balance-wallet',
  cardNumber = '••••  ••••  ••••  4829',
  expiry = '07/31',
  isShared,
  sharedLabel,
  height = 180,
}: WalletCardRenderProps) {
  const isMinimal = cardStyle === 'minimal';
  const textColor = isMinimal ? color : '#FFFFFF';
  const subTextColor = isMinimal ? color + 'AA' : 'rgba(255, 255, 255, 0.75)';

  return (
    <View style={[styles.cardOuter, { height, borderRadius: 22 }]}>
      {/* --- 1. BACKGROUND LAYER PER THEME --- */}
      {cardStyle === 'classic' && (
        <LinearGradient
          colors={[color, '#0A0F1D', '#04070F']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />
      )}

      {cardStyle === 'glass' && (
        <>
          <LinearGradient
            colors={[color + '60', 'rgba(255,255,255,0.05)', '#060A14']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFillObject}
          />
          {Platform.OS === 'ios' ? (
            <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFillObject} />
          ) : (
            <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(15, 23, 42, 0.85)' }]} />
          )}
          <View style={styles.glassBorderGlow} />
        </>
      )}

      {cardStyle === 'futuristic' && (
        <>
          <LinearGradient
            colors={['#090D1A', '#0F172A', '#05070E']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFillObject}
          />
          <View style={[styles.cyberBorderGlow, { borderColor: color }]} />
        </>
      )}

      {cardStyle === 'royal' && (
        <LinearGradient
          colors={['#1E1B4B', color, '#090514']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />
      )}

      {cardStyle === 'cosmic' && (
        <LinearGradient
          colors={['#4C1D95', '#0284C7', '#0F172A']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />
      )}

      {cardStyle === 'minimal' && (
        <View style={[styles.minimalCardBg, { borderColor: color }]} />
      )}

      {/* --- 2. ARTISTIC SVG PATTERNS & ENGRAVINGS --- */}
      <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
        {cardStyle === 'royal' && (
          /* Royal Gold Damask & Arabesque Filigree Pattern */
          <Svg height="100%" width="100%" style={StyleSheet.absoluteFillObject}>
            <G opacity={0.22}>
              <Path
                d="M-20,-20 Q60,40 140,-20 T300,-20 T460,-20"
                stroke="#F59E0B"
                strokeWidth={1.5}
                fill="none"
              />
              <Path
                d="M-20,40 Q60,100 140,40 T300,40 T460,40"
                stroke="#D4AF37"
                strokeWidth={1.2}
                fill="none"
              />
              <Path
                d="M-20,100 Q60,160 140,100 T300,100 T460,100"
                stroke="#F59E0B"
                strokeWidth={1.5}
                fill="none"
              />
              <Circle cx="280" cy="40" r="60" stroke="#F59E0B" strokeWidth="1" strokeDasharray="4 4" fill="none" />
              <Circle cx="280" cy="40" r="45" stroke="#D4AF37" strokeWidth="0.8" fill="none" />
              <Circle cx="50" cy="140" r="50" stroke="#F59E0B" strokeWidth="1" strokeDasharray="6 3" fill="none" />
            </G>
          </Svg>
        )}

        {cardStyle === 'futuristic' && (
          /* Cyber Laser Circuitry Lines */
          <Svg height="100%" width="100%" style={StyleSheet.absoluteFillObject}>
            <G opacity={0.28}>
              <Path d="M0,30 H80 L110,60 H220 L240,40 H350" stroke={color} strokeWidth={1.5} fill="none" />
              <Path d="M0,110 H140 L160,90 H300 L320,110 H400" stroke={color} strokeWidth={1.5} fill="none" />
              <Circle cx="110" cy="60" r="3" fill={color} />
              <Circle cx="160" cy="90" r="3" fill={color} />
              <Circle cx="240" cy="40" r="3" fill={color} />
              <Rect x="260" y="120" width="80" height="40" stroke={color} strokeWidth="1" strokeDasharray="3 3" fill="none" />
            </G>
          </Svg>
        )}

        {cardStyle === 'cosmic' && (
          /* Cosmic Galaxy Stardust & Orbital Rings */
          <Svg height="100%" width="100%" style={StyleSheet.absoluteFillObject}>
            <G opacity={0.35}>
              <Circle cx="260" cy="30" r="70" stroke="#38BDF8" strokeWidth="1" fill="none" />
              <Circle cx="260" cy="30" r="100" stroke="#EC4899" strokeWidth="0.8" strokeDasharray="5 5" fill="none" />
              <Circle cx="40" cy="150" r="30" stroke="#F43F5E" strokeWidth="1" fill="none" />
              {/* Twinkling Stars */}
              <Path d="M120,20 L122,25 L127,27 L122,29 L120,34 L118,29 L113,27 L118,25 Z" fill="#FFF" opacity={0.8} />
              <Path d="M220,130 L221,133 L224,134 L221,135 L220,138 L219,135 L216,134 L219,133 Z" fill="#FFF" opacity={0.9} />
              <Path d="M40,30 L41,32 L43,33 L41,34 L40,36 L39,34 L37,33 L39,32 Z" fill="#FFF" opacity={0.7} />
            </G>
          </Svg>
        )}

        {cardStyle === 'classic' && (
          /* Micro-Brushed Metallic Waves Pattern */
          <Svg height="100%" width="100%" style={StyleSheet.absoluteFillObject}>
            <G opacity={0.15}>
              <Path d="M-50,0 Q100,120 350,-20 T600,0" stroke="#FFFFFF" strokeWidth={1} fill="none" />
              <Path d="M-50,40 Q100,160 350,20 T600,40" stroke="#FFFFFF" strokeWidth={1} fill="none" />
              <Path d="M-50,80 Q100,200 350,60 T600,80" stroke="#FFFFFF" strokeWidth={1} fill="none" />
              <Circle cx="300" cy="130" r="110" stroke="#FFFFFF" strokeWidth="0.8" fill="none" />
            </G>
          </Svg>
        )}

        {cardStyle === 'glass' && (
          /* Geometric Diamond Glass Grid Overlay */
          <Svg height="100%" width="100%" style={StyleSheet.absoluteFillObject}>
            <G opacity={0.12}>
              <Path d="M0,0 L200,200 M50,-50 L250,150 M100,-100 L300,100" stroke="#FFFFFF" strokeWidth={1.5} />
              <Path d="M200,0 L0,200 M250,-50 L50,150 M300,-100 L100,100" stroke="#FFFFFF" strokeWidth={1.5} />
            </G>
          </Svg>
        )}
      </View>

      {/* --- 3. CARD CONTENT & REALISTIC ELEMENTS --- */}
      <View style={styles.cardContentContainer}>
        {/* TOP ROW: Card Title & EMV Chip / Contactless Wave */}
        <View style={styles.headerRow}>
          <View style={{ flex: 1, paddingRight: 8 }}>
            <Text style={[styles.cardTitleText, { color: textColor }]} numberOfLines={1}>
              {name.toUpperCase()}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
              <Text style={[styles.cardTierText, { color: subTextColor }]}>
                {cardStyle === 'royal' ? 'ROYAL CROWN VIP' :
                 cardStyle === 'cosmic' ? 'COSMIC HOLOGRAPHIC' :
                 cardStyle === 'futuristic' ? 'CYBER PLATINUM' :
                 cardStyle === 'glass' ? 'FROSTED GLASS VIP' :
                 'MIZAN PLATINUM'}
              </Text>
              {isShared && sharedLabel && (
                <View style={styles.sharedBadge}>
                  <Ionicons name="people" size={10} color="#10B981" />
                  <Text style={styles.sharedBadgeText} numberOfLines={1}>{sharedLabel}</Text>
                </View>
              )}
            </View>
          </View>

          {/* Right Icon & Contactless Wave */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            {/* Contactless Wi-Fi Icon Waves */}
            <View style={{ opacity: isMinimal ? 0.7 : 0.9 }}>
              <Ionicons name="wifi" size={18} color={textColor} style={{ transform: [{ rotate: '90deg' }] }} />
            </View>
            <MaterialIcons name={icon as any} size={24} color={textColor} />
          </View>
        </View>

        {/* MIDDLE ROW: Real EMV Gold Chip + Available Balance */}
        <View style={styles.middleRow}>
          {/* Authentic Metallic Gold EMV Chip */}
          {!isMinimal && (
            <View style={styles.emvChipWrap}>
              <LinearGradient
                colors={['#FFE259', '#FFA751', '#D4AF37']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.emvChipGradient}
              >
                <View style={styles.emvChipLineHorizontal} />
                <View style={styles.emvChipLineVertical} />
                <View style={styles.emvChipCenterBox} />
              </LinearGradient>
            </View>
          )}

          <View style={{ flex: 1, alignItems: 'flex-start' }}>
            <Text style={[styles.balanceLabelText, { color: subTextColor }]}>
              {currencySymbol ? 'AVAILABLE BALANCE' : 'BALANCE'}
            </Text>
            <Text style={[styles.balanceValueText, { color: textColor }]} numberOfLines={1}>
              {balanceFormatted} <Text style={styles.currencySubText}>{currencySymbol}</Text>
            </Text>
          </View>
        </View>

        {/* BOTTOM ROW: Embossed Engraved Card Number & Expiry */}
        <View style={styles.footerRow}>
          <Text style={[styles.cardNumberText, { color: textColor }]}>
            {cardNumber}
          </Text>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={[styles.expiryLabelText, { color: subTextColor }]}>EXPIRES</Text>
            <Text style={[styles.expiryValueText, { color: textColor }]}>{expiry}</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  cardOuter: {
    width: '100%',
    position: 'relative',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
  },
  glassBorderGlow: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.25)',
  },
  cyberBorderGlow: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 22,
    borderWidth: 2,
  },
  minimalCardBg: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 22,
    borderWidth: 1.5,
    backgroundColor: 'transparent',
  },
  cardContentContainer: {
    flex: 1,
    padding: 18,
    justifyContent: 'space-between',
  },

  /* Header Row */
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  cardTitleText: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 17,
    letterSpacing: 0.5,
    textAlign: 'left',
  },
  cardTierText: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 8,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  sharedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    maxWidth: 160,
    flexShrink: 1,
  },
  sharedBadgeText: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 8,
    color: '#10B981',
    flexShrink: 1,
  },

  /* Middle Row & EMV Chip */
  middleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginVertical: 4,
  },
  emvChipWrap: {
    width: 38,
    height: 28,
    borderRadius: 6,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  emvChipGradient: {
    flex: 1,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  emvChipLineHorizontal: {
    position: 'absolute',
    width: '100%',
    height: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  emvChipLineVertical: {
    position: 'absolute',
    width: 1,
    height: '100%',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  emvChipCenterBox: {
    width: 16,
    height: 12,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.35)',
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  balanceLabelText: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 8,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  balanceValueText: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 22,
    lineHeight: 28,
  },
  currencySubText: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 12,
  },

  /* Footer Row */
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardNumberText: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 12,
    letterSpacing: 2,
    textShadowColor: 'rgba(0, 0, 0, 0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  expiryLabelText: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 7,
    letterSpacing: 0.8,
  },
  expiryValueText: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 10,
    letterSpacing: 1,
  },
});
