import React, { useState, useEffect, useRef } from 'react';
import { View, Text, KeyboardAvoidingView, Platform, ScrollView, Animated, Easing, Share } from 'react-native';
import { useRouter, Link } from 'expo-router';
import {
    generateKeyPair,
    encryptPrivateKey,
    hashPassword,
    generateSalt,
    exportBytes,
    bytesToHex,
} from '@dragbin/native-crypto';
import { Shield } from 'lucide-react-native';
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

    // Recovery key flow state
    const [phase, setPhase] = useState<'form' | 'generating' | 'ready'>('form');
    const [recoveryKey, setRecoveryKey] = useState('');
    const [copied, setCopied] = useState(false);
    const [downloaded, setDownloaded] = useState(false);
    // Deferred session — stored until user acknowledges recovery key
    const pendingSessionRef = useRef<{ userId: string; username: string; publicKey: Uint8Array; privateKey: Uint8Array; token: string } | null>(null);

    // Animated progress bar
    const progressAnim = useRef(new Animated.Value(0)).current;

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
            const generatedRecoveryKey = bytesToHex(recoveryKeyBytes);
            const { encryptedPrivateKey: rvCt, salt: rvSalt, iv: rvIv } = await encryptPrivateKey(privateKey, generatedRecoveryKey);
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
                    recoveryKey: generatedRecoveryKey,
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

            // 7. Store session for later (don't set it yet — that would trigger auto-navigation)
            pendingSessionRef.current = { userId, username: username.trim(), publicKey, privateKey, token };

            // New accounts: attempt to enable notifications by default
            const registered = await registerPushToken(token).catch(() => false);
            if (registered) {
                await setNotificationsEnabled(true);
            }

            // 8. Show recovery key screen
            setRecoveryKey(generatedRecoveryKey);
            setPhase('generating');

            // Animate the progress bar
            const duration = 2000 + Math.random() * 2000;
            progressAnim.setValue(0);
            Animated.timing(progressAnim, {
                toValue: 1,
                duration,
                easing: Easing.bezier(0.4, 0, 0.2, 1),
                useNativeDriver: false,
            }).start(() => {
                setPhase('ready');
            });
        } catch (e: any) {
            console.error('[signup] error:', e);
            setError(e?.message ?? 'Something went wrong');
        } finally {
            setLoading(false);
        }
    };

    // ── Recovery key helpers ──────────────────────────────────────────────────

    const handleCopy = async () => {
        if (!recoveryKey) return;
        try {
            if (Platform.OS === 'web') {
                await navigator.clipboard.writeText(recoveryKey);
            } else {
                await Share.share({ message: recoveryKey });
            }
            setCopied(true);
            setTimeout(() => setCopied(false), 3000);
        } catch { }
    };

    const buildFileContent = () => [
        '═══════════════════════════════════════════',
        '  ghayb — Recovery Key',
        '═══════════════════════════════════════════',
        '',
        `  Username: ${username.trim()}`,
        `  Generated: ${new Date().toISOString()}`,
        '',
        '  RECOVERY KEY:',
        `  ${recoveryKey}`,
        '',
        '  ⚠ Keep this file safe and private.',
        '  ⚠ This key is the ONLY way to recover',
        '    your account if you forget your password.',
        '',
        '═══════════════════════════════════════════',
    ].join('\n');

    const handleDownload = async () => {
        if (!recoveryKey) return;
        const content = buildFileContent();

        if (Platform.OS === 'web') {
            const blob = new Blob([content], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `ghayb-recovery-key-${username.trim()}.txt`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } else {
            await Share.share({ message: content, title: 'ghayb Recovery Key' });
        }
        setDownloaded(true);
    };

    // scaleX works on web unlike percentage-based width interpolation
    const progressScale = progressAnim;

    // ── Generating phase ──────────────────────────────────────────────────────

    if (phase === 'generating') {
        return (
            <View className="flex-1 bg-background">
                <BlobBackground />
                <View className="flex-1 justify-center items-center px-8 z-10">
                    <View className="w-20 h-20 rounded-[2rem] bg-moss/15 flex items-center justify-center mb-8">
                        <Shield color="#5D7052" size={36} />
                    </View>

                    <Text className="font-serif text-3xl font-bold text-foreground text-center mb-3">
                        Generating your key…
                    </Text>
                    <Text className="font-sans text-sm text-muted-foreground text-center mb-10 max-w-xs leading-relaxed">
                        Creating a unique recovery key for your identity. This may take a moment.
                    </Text>

                    {/* Progress bar */}
                    <View className="w-full max-w-xs h-3 bg-timber/20 rounded-full overflow-hidden">
                        <Animated.View
                            style={{
                                width: '100%',
                                height: '100%',
                                transform: [{ scaleX: progressScale }],
                                transformOrigin: 'left',
                            }}
                            className="bg-moss rounded-full"
                        />
                    </View>
                    <Text className="font-sans text-xs text-muted-foreground mt-3">
                        Deriving cryptographic material…
                    </Text>
                </View>
            </View>
        );
    }

    // ── Recovery key ready phase ──────────────────────────────────────────────

    if (phase === 'ready') {
        return (
            <View className="flex-1 bg-background">
                <BlobBackground />
                <ScrollView
                    contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 }}
                >
                    <View className="w-full max-w-sm my-12 z-10">
                        <View className="items-center mb-8">
                            <View className="w-20 h-20 rounded-[2rem] bg-moss/15 flex items-center justify-center mb-6">
                                <Shield color="#5D7052" size={36} />
                            </View>
                            <Text className="font-serif text-3xl font-bold text-foreground text-center mb-2">
                                Your Recovery Key
                            </Text>
                            <Text className="font-sans text-sm text-muted-foreground text-center leading-relaxed max-w-xs">
                                This is the only way to recover your account. Save it somewhere safe — it cannot be shown again.
                            </Text>
                        </View>

                        <Card className="w-full mb-6">
                            {/* Key display */}
                            <View className="bg-timber/10 border border-timber/30 rounded-[1.5rem] p-5 mb-5">
                                <Text
                                    className="font-mono text-xs text-foreground leading-relaxed tracking-wider"
                                    selectable
                                >
                                    {recoveryKey}
                                </Text>
                            </View>

                            {/* Action buttons */}
                            <View className="flex-row gap-3 mb-2">
                                <View className="flex-1">
                                    <Button
                                        label={copied ? 'Copied ✓' : 'Copy Key'}
                                        onPress={handleCopy}
                                        variant={copied ? 'ghost' : 'outline'}
                                        size="sm"
                                        className="w-full"
                                    />
                                </View>
                                <View className="flex-1">
                                    <Button
                                        label={downloaded ? 'Saved ✓' : 'Download'}
                                        onPress={handleDownload}
                                        variant="primary"
                                        size="sm"
                                        className="w-full"
                                    />
                                </View>
                            </View>
                        </Card>

                        {/* Warning */}
                        <View className="bg-destructive/8 border border-destructive/15 rounded-[1.5rem] p-5 mb-6">
                            <Text className="font-sans text-xs font-bold text-destructive mb-1">Important</Text>
                            <Text className="font-sans text-xs text-destructive/80 leading-relaxed">
                                If you lose your password and this recovery key, your encrypted data will be permanently inaccessible. No one — not even us — can recover it.
                            </Text>
                        </View>

                        <Button
                            label="I've saved my key — Continue"
                            onPress={() => {
                                if (pendingSessionRef.current) {
                                    setSession(pendingSessionRef.current);
                                }
                                router.replace('/(main)');
                            }}
                            className="w-full"
                        />
                    </View>
                </ScrollView>
            </View>
        );
    }

    // ── Signup form phase ─────────────────────────────────────────────────────

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

                        <Button label={loading ? 'Creating identity…' : 'Create Identity'} onPress={handleSignUp} disabled={loading} className="w-full mb-4" />

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
