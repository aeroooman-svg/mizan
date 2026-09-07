import React, { useEffect, useState, useRef } from 'react';
import { StyleSheet, Text, TouchableOpacity, View, Platform, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function WebUpdateBanner() {
  if (Platform.OS !== 'web') {
    return null;
  }

  const [hasUpdate, setHasUpdate] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const initialVersionRef = useRef<string | number | null>(null);
  const slideAnim = useRef(new Animated.Value(-100)).current;

  useEffect(() => {
    let isMounted = true;

    const checkVersion = async () => {
      try {
        const response = await fetch('/version.json?_=' + Date.now(), {
          cache: 'no-store',
          headers: {
            'Pragma': 'no-cache',
            'Cache-Control': 'no-cache'
          }
        });

        if (!response.ok) return;

        const data = await response.json();
        if (!data || !data.version) return;

        if (initialVersionRef.current === null) {
          initialVersionRef.current = data.version;
        } else if (initialVersionRef.current !== data.version) {
          if (isMounted) {
            setHasUpdate(true);
            Animated.spring(slideAnim, {
              toValue: 0,
              useNativeDriver: false,
              friction: 8,
            }).start();
          }
        }
      } catch (err) {
        // Silently ignore network errors during background check
      }
    };

    // Initial check
    checkVersion();

    // Periodic check every 3 minutes
    const interval = setInterval(checkVersion, 3 * 60 * 1000);

    // Check when user returns to tab
    const handleVisibilityChange = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        checkVersion();
      }
    };

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityChange);
      window.addEventListener('focus', checkVersion);
    }

    return () => {
      isMounted = false;
      clearInterval(interval);
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        window.removeEventListener('focus', checkVersion);
      }
    };
  }, []);

  const handleReload = () => {
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  if (!hasUpdate || dismissed) {
    return null;
  }

  return (
    <Animated.View style={[styles.container, { transform: [{ translateY: slideAnim }] }]}>
      <View style={styles.content}>
        <View style={styles.iconCircle}>
          <Ionicons name="sparkles" size={16} color="#10B981" />
        </View>
        <Text style={styles.text}>يتوفر تحديث جديد لتطبيق ميزان</Text>
        
        <TouchableOpacity style={styles.button} onPress={handleReload} activeOpacity={0.8}>
          <Ionicons name="refresh" size={14} color="#FFFFFF" style={{ marginLeft: 4 }} />
          <Text style={styles.buttonText}>تحديث الآن</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.closeButton} 
          onPress={() => setDismissed(true)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="close" size={18} color="#94A3B8" />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
 container: {
 position: 'absolute',
 top: 16,
 left: 16,
 right: 16,
 zIndex: 99999,
 alignItems: 'center',
 },
 content: {
 flexDirection: 'row',
 alignItems: 'center',
 backgroundColor: 'rgba(15, 23, 42, 0.96)',
 borderColor: '#10B981',
 borderWidth: 1,
 paddingVertical: 10,
 paddingHorizontal: 16,
 borderRadius: 14,
 shadowColor: '#10B981',
 shadowOffset: { width: 0, height: 4 },
 shadowOpacity: 0.25,
 shadowRadius: 12,
 elevation: 8,
 gap: 12,
 maxWidth: 520,
 width: '100%',
 },
 iconCircle: {
 width: 28,
 height: 28,
 borderRadius: 14,
 backgroundColor: 'rgba(16, 185, 129, 0.15)',
 alignItems: 'center',
 justifyContent: 'center',
 },
 text: {
 flex: 1,
 color: '#F8FAFC',
 fontSize: 13,
 fontWeight: '600',
 fontFamily: 'Cairo',
 textAlign: 'right',
 },
 button: {
 flexDirection: 'row',
 alignItems: 'center',
 backgroundColor: '#10B981',
 paddingVertical: 6,
 paddingHorizontal: 12,
 borderRadius: 8,
 },
 buttonText: {
 color: '#FFFFFF',
 fontSize: 12,
 fontWeight: '700',
 fontFamily: 'Cairo',
 },
 closeButton: {
 padding: 4,
 },
});
