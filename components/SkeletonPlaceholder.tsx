import React, { useEffect, useRef } from 'react';
import { StyleSheet, View, Animated } from 'react-native';

interface SkeletonPlaceholderProps {
  width?: number | `${number}%`;
  height?: number;
  borderRadius?: number;
  style?: any;
}

export default function SkeletonPlaceholder({
  width = '100%',
  height = 20,
  borderRadius = 8,
  style,
}: SkeletonPlaceholderProps) {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.7,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        styles.skeleton,
        {
          width: width as any,
          height,
          borderRadius,
          opacity,
        },
        style,
      ]}
    />
  );
}

export function SkeletonCard() {
  return (
    <View style={styles.cardContainer}>
      <SkeletonPlaceholder width={140} height={18} borderRadius={6} />
      <SkeletonPlaceholder width="80%" height={32} borderRadius={8} style={{ marginVertical: 8 }} />
      <SkeletonPlaceholder width="50%" height={14} borderRadius={4} />
    </View>
  );
}

const styles = StyleSheet.create({
  skeleton: {
    backgroundColor: '#334155',
  },
  cardContainer: {
    backgroundColor: 'rgba(30, 41, 59, 0.5)',
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 20,
    marginVertical: 8,
  },
});
