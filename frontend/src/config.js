import { Platform } from 'react-native';

const envUrl = process.env.EXPO_PUBLIC_API_BASE_URL || process.env.API_BASE_URL;

const defaultBase = Platform.select({
  ios: 'http://localhost:8003',
  android: 'http://10.0.2.2:8003',
  default: 'http://localhost:8003'
});

export const API_BASE = (envUrl && envUrl.trim().length > 0 ? envUrl : defaultBase).replace(/\/$/, '');

export const withAdminHeaders = (adminKey) => ({
  'Content-Type': 'application/json',
  'X-Admin-Key': adminKey || 'dev-admin-key'
});
