import React, { useState } from 'react';
import { View, Text, KeyboardAvoidingView, Platform, ScrollView, Alert } from 'react-native';
import { useRouter, Link } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import {
    generateKeyPair,
    encryptPrivateKey,
    hashPassword,
    generateSalt,
    exportBytes,
    bytesToHex,
} from '@dragbin/native-crypto';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { BlobBackground } from '../components/BlobBackground';
import { Card } from '../components/Card';
import { useSession } from './context/SessionContext';
import { API_BASE } from './lib/api';
import { registerPushToken, setNotificationsEnabled } from './lib/notifications';

export default function SignUpScreen() {
    const router = useRouter();
    const { setSession } = useSession();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [recoveryKey, setRecoveryKey] = useState('');

    const handleSignUp = async () => {
        setError('');
        if (!username.trim() || !password || !confirmPassword) {
            setError('All fields are required');
            return;
        }
        if (password !== confirmPassword) {
            setError('Passwords do not match');
            return;
        }

        setLoading(true);
        try {
            // 1. Generate Kyber1024 key pair
            const { publicKey, privateKey } = await generateKeyPair();

            // 2. Derive authKey: Argon2id(password, authSalt) as hex for server-side auth
            const authSalt = generateSalt();
            const authKeyBytes = await hashPassword(password, authSalt);
            const authKey = bytesToHex(authKeyBytes);

            // 3. Encrypt privateKey → vault (IV prepended to ciphertext)
            const { encryptedPrivateKey, salt: vaultSalt, iv } = await encryptPrivateKey(privateKey, password);
            const vaultBytes = new Uint8Array(iv.length + encryptedPrivateKey.length);
            vaultBytes.set(iv);
            vaultBytes.set(encryptedPrivateKey, iv.length);
            const vault = exportBytes(vaultBytes);

            // 4. Generate random recovery key, encrypt privateKey under it
            const recoveryKeyBytes = crypto.getRandomValues(new Uint8Array(32));
            const recoveryKey = bytesToHex(recoveryKeyBytes);
            const { encryptedPrivateKey: rvCt, salt: rvSalt, iv: rvIv } = await encryptPrivateKey(privateKey, recoveryKey);
            const recoveryVaultBytes = new Uint8Array(rvIv.length + rvCt.length);
            recoveryVaultBytes.set(rvIv);
            recoveryVaultBytes.set(rvCt, rvIv.length);
            const recoveryVault = exportBytes(recoveryVaultBytes);

            // 5. Register with server
            const res = await fetch(`${API_BASE}/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username: username.trim(),
                    authKey,
                    authSalt: exportBytes(authSalt),
                    vault,
                    vaultSalt: exportBytes(vaultSalt),
                    publicKey: exportBytes(publicKey),
                    recoveryVault,
                    recoveryVaultSalt: exportBytes(rvSalt),
                    recoveryKey,
                }),
            });

            if (!res.ok) {
                const text = await res.text();
                let msg = 'Registration failed';
                try { msg = JSON.parse(text).error ?? msg; } catch { msg = text || msg; }
                console.error('[signup] register failed:', res.status, text);
                setError(msg);
                return;
            }

            // 6. Auto-login to get a token
            const loginRes = await fetch(`${API_BASE}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: username.trim(), authKey }),
            });

            if (!loginRes.ok) {
                setError('Registered but login failed. Please sign in.');
                router.replace('/signin');
                return;
            }

            const { userId, token } = await loginRes.json();

            // 7. Persist salts locally for future logins
            await SecureStore.setItemAsync('authSalt', exportBytes(authSalt));
            await SecureStore.setItemAsync('username', username.trim());

            // 8. Create in-memory session and navigate
            setSession({ userId, username: username.trim(), publicKey, privateKey, token });

            // New accounts: attempt to enable notifications by default
            const registered = await registerPushToken(token).catch(() => false);
            if (registered) {
                await setNotificationsEnabled(true);
            }

            // Show recovery key inline before navigating
            setRecoveryKey(recoveryKey);
        } catch (e: any) {
            console.error('[signup] error:', e);
            setError(e?.message ?? 'Something went wrong');
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
            <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 }}>
                <View className="w-full max-w-sm mt-12 mb-12">
                    <Text className="font-serif text-4xl font-bold text-foreground mb-2">Join the unseen.</Text>
                    <Text className="font-sans text-muted-foreground text-base mb-8">Generate an identity for your E2EE communication.</Text>

                    <Card className="w-full">
                        <View className="mb-4">
                            <Text className="font-sans text-sm font-semibold text-foreground mb-2 ml-2">Choose Username</Text>
                            <Input
                                placeholder="e.g. shadow_ghost"
                                value={username}
                                onChangeText={setUsername}
                                autoCapitalize="none"
                            />
                        </View>

                        <View className="mb-4">
                            <Text className="font-sans text-sm font-semibold text-foreground mb-2 ml-2">Master Password</Text>
                            <Input
                                placeholder="Used to encrypt your keys"
                                secureTextEntry
                                value={password}
                                onChangeText={setPassword}
                            />
                        </View>

                        <View className="mb-8">
                            <Text className="font-sans text-sm font-semibold text-foreground mb-2 ml-2">Confirm Master Password</Text>
                            <Input
                                placeholder="Repeat password"
                                secureTextEntry
                                value={confirmPassword}
                                onChangeText={setConfirmPassword}
                            />
                        </View>

                        {error ? (
                            <Text className="font-sans text-sm text-destructive mb-4 text-center">{error}</Text>
                        ) : null}

                        {recoveryKey ? (
                            <View className="mb-4 p-4 bg-moss/10 border border-moss/30 rounded-2xl">
                                <Text className="font-sans text-sm font-bold text-moss mb-2">Save your recovery key</Text>
                                <Text className="font-sans text-xs text-foreground mb-3 leading-relaxed">Write this down — it cannot be shown again:</Text>
                                <Text className="font-mono text-xs text-foreground bg-timber/10 p-2 rounded-xl mb-3 break-all">{recoveryKey}</Text>
                                <Button label="I saved it" onPress={() => router.replace('/(main)')} className="w-full" />
                            </View>
                        ) : null}

                        {!recoveryKey && (
                            <Button label={loading ? 'Creating identity…' : 'Create Identity'} onPress={handleSignUp} disabled={loading} className="w-full mb-4" />
                        )}

                        <View className="flex-row justify-center items-center mt-2">
                            <Text className="font-sans text-muted-foreground text-sm">Already hidden? </Text>
                            <Link href="/signin" asChild>
                                <Text className="font-sans text-moss font-bold text-sm">Sign in.</Text>
                            </Link>
                        </View>
                    </Card>
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}
