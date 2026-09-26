import React, { useEffect, useRef } from 'react';
import { StyleSheet, View, Animated, Dimensions } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const CONFETTI_COLORS = [
  '#F59E0B', // Amber
  '#10B981', // Emerald
  '#3B82F6', // Blue
  '#EC4899', // Pink
  '#8B5CF6', // Purple
  '#F43F5E', // Rose
  '#FBBF24', // Gold
  '#14B8A6', // Teal
];

interface Particle {
  x: number;
  color: string;
  size: number;
  rotation: Animated.Value;
  translateY: Animated.Value;
  translateX: Animated.Value;
  opacity: Animated.Value;
}

interface CelebrationConfettiProps {
  active: boolean;
  onFinish?: () => void;
  count?: number;
}

export default function CelebrationConfetti({ active, onFinish, count = 45 }: CelebrationConfettiProps) {
  const particles = useRef<Particle[]>([]);

  if (particles.current.length === 0) {
    for (let i = 0; i < count; i++) {
      particles.current.push({
        x: Math.random() * SCREEN_WIDTH,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        size: Math.random() * 8 + 6,
        rotation: new Animated.Value(0),
        translateY: new Animated.Value(-30),
        translateX: new Animated.Value(0),
        opacity: new Animated.Value(1),
      });
    }
  }

  useEffect(() => {
    if (!active) return;

    // Reset and trigger animations
    const animations = particles.current.map((p) => {
      p.translateY.setValue(-30);
      p.translateX.setValue(0);
      p.opacity.setValue(1);
      p.rotation.setValue(0);

      const delay = Math.random() * 300;
      const duration = 2200 + Math.random() * 1200;
      const targetX = (Math.random() - 0.5) * 160;

      return Animated.parallel([
        Animated.timing(p.translateY, {
          toValue: SCREEN_HEIGHT + 50,
          duration,
          delay,
          useNativeDriver: true,
        }),
        Animated.timing(p.translateX, {
          toValue: targetX,
          duration,
          delay,
          useNativeDriver: true,
        }),
        Animated.timing(p.rotation, {
          toValue: Math.random() > 0.5 ? 720 : -720,
          duration,
          delay,
          useNativeDriver: true,
        }),
        Animated.timing(p.opacity, {
          toValue: 0,
          duration: duration * 0.4,
          delay: delay + duration * 0.6,
          useNativeDriver: true,
        }),
      ]);
    });

    Animated.parallel(animations).start(() => {
      onFinish?.();
    });
  }, [active, onFinish]);

  if (!active) return null;

  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
      {particles.current.map((p, idx) => {
        const spin = p.rotation.interpolate({
          inputRange: [-720, 720],
          outputRange: ['-720deg', '720deg'],
        });

        return (
          <Animated.View
            key={idx}
            style={[
              styles.confettiPiece,
              {
                left: p.x,
                width: p.size,
                height: p.size * (idx % 2 === 0 ? 1.6 : 1),
                borderRadius: idx % 3 === 0 ? p.size / 2 : 2,
                backgroundColor: p.color,
                opacity: p.opacity,
                transform: [
                  { translateY: p.translateY },
                  { translateX: p.translateX },
                  { rotate: spin },
                ],
              },
            ]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  confettiPiece: {
    position: 'absolute',
    top: 0,
    zIndex: 9999,
  },
});
