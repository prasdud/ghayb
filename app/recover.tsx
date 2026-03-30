import React, { useState } from 'react';
import { View, Text, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useRouter, Link } from 'expo-router';
import {
    decryptPrivateKey,
    encryptPrivateKey,
    hashPassword,
    generateSalt,
    exportBytes,
    importBytes,
    bytesToHex,
} from '@dragbin/native-crypto';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { BlobBackground } from '../components/BlobBackground';
import { Card } from '../components/Card';
import { API_BASE } from './lib/api';

export default function RecoverScreen() {
    const router = useRouter();
    const [username, setUsername] = useState('');
    const [recoveryKey, setRecoveryKey] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [recovered, setRecovered] = useState(false);

    const handleRecover = async () => {
        setError('');
        if (!username.trim() || !recoveryKey.trim() || !newPassword || !confirmPassword) {
            setError('All fields are required');
            return;
        }
        if (newPassword !== confirmPassword) {
            setError('Passwords do not match');
            return;
        }

        setLoading(true);
        try {
            // 1. Verify recovery key + fetch encrypted recovery vault
            const vaultRes = await fetch(`${API_BASE}/auth/recover-vault`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: username.trim(), recoveryKey: recoveryKey.trim() }),
            });

            if (!vaultRes.ok) {
                setError('Invalid username or recovery key');
                return;
            }

            const { recoveryVault, recoveryVaultSalt } = await vaultRes.json();

            // 2. Decrypt privateKey from recoveryVault
            // recoveryVault format: [IV 12 bytes][AES-GCM ciphertext]
            const rvBytes = importBytes(recoveryVault);
            const rvIv = rvBytes.slice(0, 12);
            const rvCt = rvBytes.slice(12);
            const privateKey = await decryptPrivateKey(rvCt, recoveryKey.trim(), importBytes(recoveryVaultSalt), rvIv);

            // 3. Re-encrypt privateKey under new password
            const { encryptedPrivateKey, salt: newVaultSalt, iv: newIv } = await encryptPrivateKey(privateKey, newPassword);
            const newVaultBytes = new Uint8Array(newIv.length + encryptedPrivateKey.length);
            newVaultBytes.set(newIv);
            newVaultBytes.set(encryptedPrivateKey, newIv.length);

            // 4. Derive new authKey
            const newAuthSalt = generateSalt();
            const newAuthKeyBytes = await hashPassword(newPassword, newAuthSalt);
            const newAuthKey = bytesToHex(newAuthKeyBytes);

            // 5. Submit new credentials
            const recoverRes = await fetch(`${API_BASE}/auth/recover`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username: username.trim(),
                    recoveryKey: recoveryKey.trim(),
                    newAuthKey,
                    newAuthSalt: exportBytes(newAuthSalt),
                    newVault: exportBytes(newVaultBytes),
                    newVaultSalt: exportBytes(newVaultSalt),
                }),
            });

            if (!recoverRes.ok) {
                setError('Recovery failed. Please try again.');
                return;
            }

            setRecovered(true);
        } catch (e: any) {
            console.error('[recover] error:', e);
            setError(e?.message || 'Something went wrong');
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
                    <Text className="font-serif text-4xl font-bold text-foreground mb-2">Recover.</Text>
                    <Text className="font-sans text-muted-foreground text-base mb-8">
                        Enter your recovery key to reset your password. Your messages stay intact.
                    </Text>

                    <Card className="w-full">
                        {recovered ? (
                            <View className="items-center py-4">
                                <Text className="font-sans text-base font-bold text-moss mb-2">Password reset successfully.</Text>
                                <Text className="font-sans text-sm text-muted-foreground mb-6 text-center">Sign in with your new password.</Text>
                                <Button label="Sign In" onPress={() => router.replace('/signin')} className="w-full" />
                            </View>
                        ) : (
                            <>
                                <View className="mb-4">
                                    <Text className="font-sans text-sm font-semibold text-foreground mb-2 ml-2">Username</Text>
                                    <Input
                                        placeholder="your_username"
                                        value={username}
                                        onChangeText={setUsername}
                                        autoCapitalize="none"
                                    />
                                </View>

                                <View className="mb-4">
                                    <Text className="font-sans text-sm font-semibold text-foreground mb-2 ml-2">Recovery Key</Text>
                                    <Input
                                        placeholder="64-character hex key"
                                        value={recoveryKey}
                                        onChangeText={setRecoveryKey}
                                        autoCapitalize="none"
                                        autoCorrect={false}
                                    />
                                </View>

                                <View className="mb-4">
                                    <Text className="font-sans text-sm font-semibold text-foreground mb-2 ml-2">New Password</Text>
                                    <Input
                                        placeholder="New master password"
                                        secureTextEntry
                                        value={newPassword}
                                        onChangeText={setNewPassword}
                                    />
                                </View>

                                <View className="mb-8">
                                    <Text className="font-sans text-sm font-semibold text-foreground mb-2 ml-2">Confirm New Password</Text>
                                    <Input
                                        placeholder="Repeat new password"
                                        secureTextEntry
                                        value={confirmPassword}
                                        onChangeText={setConfirmPassword}
                                    />
                                </View>

                                {error ? (
                                    <Text className="font-sans text-sm text-destructive mb-4 text-center">{error}</Text>
                                ) : null}

                                <Button
                                    label={loading ? 'Recovering…' : 'Recover Account'}
                                    onPress={handleRecover}
                                    disabled={loading}
                                    className="w-full mb-4"
                                />

                                <View className="flex-row justify-center items-center mt-2">
                                    <Text className="font-sans text-muted-foreground text-sm">Remember your password? </Text>
                                    <Link href="/signin" asChild>
                                        <Text className="font-sans text-moss font-bold text-sm">Sign in.</Text>
                                    </Link>
                                </View>
                            </>
                        )}
                    </Card>
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}
