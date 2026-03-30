import React, { useState } from 'react';
import { View, Text, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { useRouter, Link } from 'expo-router';
import {
    decryptPrivateKey,
    hashPassword,
    importBytes,
    bytesToHex,
} from '@dragbin/native-crypto';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { BlobBackground } from '../components/BlobBackground';
import { Card } from '../components/Card';
import { useSession } from './context/SessionContext';
import { API_BASE } from './lib/api';

export default function SignInScreen() {
    const router = useRouter();
    const { setSession } = useSession();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSignIn = async () => {
        if (!username.trim() || !password) {
            Alert.alert('Error', 'Username and password are required');
            return;
        }

        setLoading(true);
        try {
            // 1. Fetch salts for this username
            const saltsRes = await fetch(`${API_BASE}/auth/salts?username=${encodeURIComponent(username.trim())}`);
            if (!saltsRes.ok) {
                Alert.alert('Error', 'Failed to reach server');
                return;
            }
            const { authSalt, vaultSalt } = await saltsRes.json();

            // authSalt null means username not found — return generic error to prevent enumeration
            if (!authSalt) {
                Alert.alert('Error', 'Invalid credentials');
                return;
            }

            // 2. Derive authKey: Argon2id(password, authSalt)
            const authKeyBytes = await hashPassword(password, importBytes(authSalt));
            const authKey = bytesToHex(authKeyBytes);

            // 3. Login
            const loginRes = await fetch(`${API_BASE}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: username.trim(), authKey }),
            });

            if (!loginRes.ok) {
                Alert.alert('Error', 'Invalid credentials');
                return;
            }

            const { userId, vault, publicKey: publicKeyB64, token } = await loginRes.json();

            // 4. Decrypt vault → privateKey
            // vault format: [IV 12 bytes][AES-GCM ciphertext]
            const vaultBytes = importBytes(vault);
            const iv = vaultBytes.slice(0, 12);
            const encryptedPrivateKey = vaultBytes.slice(12);
            const privateKey = await decryptPrivateKey(encryptedPrivateKey, password, importBytes(vaultSalt), iv);
            const publicKey = importBytes(publicKeyB64);

            // 5. Create session and navigate
            setSession({ userId, username: username.trim(), publicKey, privateKey, token });
            router.replace('/(main)');
        } catch (e: any) {
            Alert.alert('Error', e?.message ?? 'Something went wrong');
        } finally {
            setLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            className="flex-1 bg-background"
        >
            <BlobBackground />
            <View className="flex-1 items-center justify-center px-6">
                <View className="w-full max-w-sm">
                    <Text className="font-serif text-4xl font-bold text-foreground mb-2">Welcome back.</Text>
                    <Text className="font-sans text-muted-foreground text-base mb-8">Enter your credentials to connect securely.</Text>

                    <Card className="w-full">
                        <View className="mb-4">
                            <Text className="font-sans text-sm font-semibold text-foreground mb-2 ml-2">Username</Text>
                            <Input
                                placeholder="secret_agent"
                                value={username}
                                onChangeText={setUsername}
                                autoCapitalize="none"
                            />
                        </View>

                        <View className="mb-8">
                            <Text className="font-sans text-sm font-semibold text-foreground mb-2 ml-2">App Password</Text>
                            <Input
                                placeholder="encryption key phrase"
                                secureTextEntry
                                value={password}
                                onChangeText={setPassword}
                            />
                        </View>

                        <Button label={loading ? 'Signing in…' : 'Sign In'} onPress={handleSignIn} disabled={loading} className="w-full mb-4" />

                        <View className="flex-row justify-center items-center mt-2">
                            <Text className="font-sans text-muted-foreground text-sm">New to ghayb? </Text>
                            <Link href="/signup" asChild>
                                <Text className="font-sans text-moss font-bold text-sm">Create account.</Text>
                            </Link>
                        </View>
                    </Card>
                </View>
            </View>
        </KeyboardAvoidingView>
    );
}
