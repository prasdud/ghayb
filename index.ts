import { install } from 'react-native-quick-crypto';
install(); // polyfills crypto.subtle for AES-GCM, HKDF, SHA-256 — must run before expo-router

// eslint-disable-next-line import/first
import 'expo-router/entry';
