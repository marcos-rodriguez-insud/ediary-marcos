import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { Button } from '../components/Button';

export function HomeScreen({ onSelectAdmin, onSelectParticipant }) {
  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>e-Diary (Clinical Trials)</Text>
        <Text style={styles.subtitle}>Choose how you want to access the system.</Text>
        <View style={styles.buttons}>
          <Button title="Admin" onPress={onSelectAdmin} />
          <Button title="Participant" onPress={onSelectParticipant} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    backgroundColor: '#f8fafc',
    ...Platform.select({
      web: {
        alignItems: 'center',
      },
    }),
  },
  card: {
    width: '100%',
    borderRadius: 16,
    backgroundColor: '#ffffff',
    padding: 32,
    shadowColor: '#0f172a',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 12,
    elevation: 4,
    gap: 16,
    ...Platform.select({
      web: {
        maxWidth: 520,
        borderWidth: 1,
        borderColor: '#e2e8f0',
      },
    }),
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 12,
    color: '#0f172a'
  },
  subtitle: {
    fontSize: 16,
    color: '#475569',
    marginBottom: 32
  },
  buttons: {
    gap: 16,
    ...Platform.select({
      web: {
        flexDirection: 'row',
        justifyContent: 'flex-start',
      },
    }),
  }
});
