import React from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNetwork } from '../context/NetworkContext';

export default function NetworkErrorScreen() {
  const { isChecking, lastError, retryNow } = useNetwork();

  return (
    <LinearGradient colors={['#FF6B35', '#E64A19']} style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.emoji}>📡</Text>
        <Text style={styles.title}>Connection Lost</Text>
        <Text style={styles.message}>Unable to connect to our servers</Text>
        {lastError && <Text style={styles.error}>{lastError}</Text>}
        
        <Pressable style={styles.button} onPress={retryNow} disabled={isChecking}>
          {isChecking ? (
            <ActivityIndicator color="#FF6B35" />
          ) : (
            <Text style={styles.buttonText}>Retry Now</Text>
          )}
        </Pressable>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { alignItems: 'center', padding: 40 },
  emoji: { fontSize: 64, marginBottom: 20 },
  title: { fontSize: 24, fontWeight: '700', color: '#FFF', marginBottom: 8 },
  message: { fontSize: 16, color: 'rgba(255,255,255,0.8)', marginBottom: 8 },
  error: { fontSize: 14, color: '#FFE0B2', marginBottom: 24, backgroundColor: 'rgba(0,0,0,0.2)', padding: 12, borderRadius: 8, textAlign: 'center' },
  button: { backgroundColor: '#FFF', paddingHorizontal: 32, paddingVertical: 14, borderRadius: 25, minWidth: 150, alignItems: 'center' },
  buttonText: { color: '#FF6B35', fontSize: 16, fontWeight: '700' },
});
