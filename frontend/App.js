import React, { useState } from 'react';
import { SafeAreaView, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { HomeScreen } from './src/screens/HomeScreen';
import { AdminScreen } from './src/screens/AdminScreen';
import { ParticipantScreen } from './src/screens/ParticipantScreen';

export default function App() {
  const [screen, setScreen] = useState('home');
  const [adminKey, setAdminKey] = useState('dev-admin-key');

  const renderScreen = () => {
    switch (screen) {
      case 'admin':
        return (
          <AdminScreen
            adminKey={adminKey}
            onAdminKeyChange={setAdminKey}
            onBack={() => setScreen('home')}
          />
        );
      case 'participant':
        return <ParticipantScreen onBack={() => setScreen('home')} />;
      default:
        return (
          <HomeScreen
            onSelectAdmin={() => setScreen('admin')}
            onSelectParticipant={() => setScreen('participant')}
          />
        );
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <View style={styles.container}>{renderScreen()}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f8fafc'
  },
  container: {
    flex: 1
  }
});
