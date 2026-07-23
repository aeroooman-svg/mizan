import React, { useEffect, useRef, useMemo } from 'react';
import { StyleSheet, Text, View, Animated, Dimensions, Platform, Image, Easing } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/lib/ThemeContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface SplashLoadingScreenProps {
  isDone?: boolean;
  onFinish?: () => void;
}

export default function SplashLoadingScreen({ isDone, onFinish }: SplashLoadingScreenProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  // Animation values
  const logoScale = useRef(new Animated.Value(0.3)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const logoFloat = useRef(new Animated.Value(0)).current;
  
  const glowScale = useRef(new Animated.Value(0.8)).current;
  const glowOpacity = useRef(new Animated.Value(0.3)).current;
  const glowRotation = useRef(new Animated.Value(0)).current;

  const textOpacity = useRef(new Animated.Value(0)).current;
  const textSlide = useRef(new Animated.Value(20)).current;
  
  const progressAnim = useRef(new Animated.Value(0)).current;
  
  const exitOpacity = useRef(new Animated.Value(1)).current;
  const exitScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isDone) {
      Animated.parallel([
        Animated.timing(exitOpacity, {
          toValue: 0,
          duration: 500,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(exitScale, {
          toValue: 1.08,
          duration: 500,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start(() => {
        if (onFinish) onFinish();
      });
    }
  }, [isDone, onFinish]);

  useEffect(() => {
    // 1. Initial entrance animation for logo and text
    Animated.sequence([
      Animated.parallel([
        Animated.spring(logoScale, {
          toValue: 1.0,
          tension: 30,
          friction: 6,
          useNativeDriver: true,
        }),
        Animated.timing(logoOpacity, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
      ]),
      // Slide up text and fade in
      Animated.parallel([
        Animated.timing(textOpacity, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.spring(textSlide, {
          toValue: 0,
          tension: 20,
          friction: 6,
          useNativeDriver: true,
        }),
      ]),
    ]).start();

    // 2. Loop: Gentle floating animation for logo (up and down)
    Animated.loop(
      Animated.sequence([
        Animated.timing(logoFloat, {
          toValue: -8,
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(logoFloat, {
          toValue: 8,
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();

    // 3. Loop: Pulsating glow expansion
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowScale, {
          toValue: 1.25,
          duration: 1800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(glowScale, {
          toValue: 0.85,
          duration: 1800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(glowOpacity, {
          toValue: 0.8,
          duration: 1800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(glowOpacity, {
          toValue: 0.3,
          duration: 1800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();

    // 4. Loop: Rotation of the glow ring
    Animated.loop(
      Animated.timing(glowRotation, {
        toValue: 1,
        duration: 8000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();

    // 5. Loading progress bar
    Animated.timing(progressAnim, {
      toValue: 1,
      duration: 2500,
      easing: Easing.out(Easing.ease),
      useNativeDriver: false,
    }).start();
  }, []);

  // Interpolate rotation
  const spin = glowRotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  // Interpolate progress width
  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <Animated.View style={[styles.container, { opacity: exitOpacity, transform: [{ scale: exitScale }] }]}>
      {/* Background Gradient */}
      <LinearGradient
        colors={['#070B14', '#0D1424', '#05070B']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.1, y: 0.1 }}
        end={{ x: 0.9, y: 0.9 }}
      />

      {/* Ambient background glow */}
      <Animated.View 
        style={[
          styles.ambientGlow, 
          { 
            transform: [
              { scale: glowScale },
              { rotate: spin }
            ],
            opacity: glowOpacity.interpolate({
              inputRange: [0.3, 0.8],
              outputRange: [0.12, 0.22],
            })
          }
        ]} 
      />

      {/* Main Logo Container */}
      <Animated.View 
        style={[
          styles.content, 
          { 
            opacity: logoOpacity,
            transform: [
              { scale: logoScale },
              { translateY: logoFloat }
            ]
          }
        ]}
      >
        <View style={styles.logoWrapper}>
          {/* Animated glow behind logo */}
          <Animated.View 
            style={[
              styles.logoGlow, 
              { 
                transform: [{ scale: glowScale }],
                opacity: glowOpacity
              }
            ]} 
          />
          {/* Custom logo image with correct relative path */}
          <Image 
            source={require('../assets/images/splash-icon.png')} 
            style={styles.logoImage} 
            resizeMode="contain"
          />
        </View>
      </Animated.View>

      {/* Animated Text Section */}
      <Animated.View 
        style={[
          styles.textContainer, 
          { 
            opacity: textOpacity,
            transform: [{ translateY: textSlide }]
          }
        ]}
      >
        <Text style={styles.titleAr}>مِـيـزَان</Text>
        <Text style={styles.titleEn}>MIZAN</Text>
        <Text style={styles.tagline}>إدارة مالية ذكية بلمسة واحدة</Text>
      </Animated.View>

      {/* Loading Progress Bar */}
      <View style={styles.loaderWrapper}>
        <View style={styles.loaderBg}>
          <Animated.View style={[styles.loaderFill, { width: progressWidth }]} />
        </View>
        <Text style={styles.loadingText}>جاري تحميل البيانات...</Text>
      </View>
    </Animated.View>
  );
}

const getStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#090E17',
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  logoWrapper: {
    width: 140,
    height: 140,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoImage: {
    width: 115,
    height: 115,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
  },
  ambientGlow: {
    position: 'absolute',
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: colors.primary,
    opacity: 0.15,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 120,
    zIndex: 1,
    ...Platform.select({
      web: {
        filter: 'blur(100px)',
      },
    }),
  },
  logoGlow: {
    position: 'absolute',
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: colors.primary,
    opacity: 0.5,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 35,
    zIndex: -1,
    ...Platform.select({
      web: {
        filter: 'blur(30px)',
      },
    }),
  },
  textContainer: {
    alignItems: 'center',
    marginTop: 25,
    zIndex: 2,
  },
  titleAr: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 34,
    color: '#FFFFFF',
    textAlign: 'center',
    textShadowColor: 'rgba(16, 185, 129, 0.5)',
    textShadowOffset: { width: 0, height: 4 },
    textShadowRadius: 12,
  },
  titleEn: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 16,
    color: colors.textSecondary,
    letterSpacing: 7,
    marginTop: 4,
    textAlign: 'center',
  },
  tagline: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 13,
    color: 'rgba(255,255,255,0.4)',
    marginTop: 15,
    textAlign: 'center',
  },
  loaderWrapper: {
    position: 'absolute',
    bottom: 80,
    width: SCREEN_WIDTH * 0.65,
    maxWidth: 240,
    alignItems: 'center',
    zIndex: 2,
  },
  loaderBg: {
    width: '100%',
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 10,
  },
  loaderFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 2,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 5,
  },
  loadingText: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 11,
    color: colors.textSecondary,
    opacity: 0.6,
  },
});
