import React, { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';

export default function WidgetsSetupRedirect() {
  useEffect(() => {
    router.replace('/(tabs)');
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: '#090E17', justifyContent: 'center', alignItems: 'center' }}>
      <ActivityIndicator size="large" color="#10B981" />
    </View>
  );
}
