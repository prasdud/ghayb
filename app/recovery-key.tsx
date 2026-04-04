import React, { useState, useEffect, useRef } from 'react';
import { View, Text, ScrollView, Platform, Animated, Easing, Share } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Shield } from 'lucide-react-native';
import { BlobBackground } from '../components/BlobBackground';
import { Button } from '../components/Button';
import { Card } from '../components/Card';

export default function RecoveryKeyScreen() {
    const { key, username } = useLocalSearchParams<{ key: string; username: string }>();
    const router = useRouter();
    const [phase, setPhase] = useState<'generating' | 'ready'>('generating');
    const [copied, setCopied] = useState(false);
    const [downloaded, setDownloaded] = useState(false);

    // Animated progress bar
    const progressAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        // Simulate key "generation" with a random duration between 2-4 seconds
        const duration = 2000 + Math.random() * 2000;

        Animated.timing(progressAnim, {
            toValue: 1,
            duration,
            easing: Easing.bezier(0.4, 0, 0.2, 1),
            useNativeDriver: false,
        }).start(() => {
            setPhase('ready');
        });
    }, []);

    const handleCopy = async () => {
        if (!key) return;
        try {
            if (Platform.OS === 'web') {
                await navigator.clipboard.writeText(key);
            } else {
                await Share.share({ message: key });
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
        `  Username: ${username ?? 'unknown'}`,
        `  Generated: ${new Date().toISOString()}`,
        '',
        '  RECOVERY KEY:',
        `  ${key}`,
        '',
        '  ⚠ Keep this file safe and private.',
        '  ⚠ This key is the ONLY way to recover',
        '    your account if you forget your password.',
        '',
        '═══════════════════════════════════════════',
    ].join('\n');

    const handleDownload = async () => {
        if (!key) return;
        const content = buildFileContent();

        if (Platform.OS === 'web') {
            const blob = new Blob([content], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `ghayb-recovery-key-${username ?? 'key'}.txt`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } else {
            await Share.share({ message: content, title: 'ghayb Recovery Key' });
        }
        setDownloaded(true);
    };

    const progressWidth = progressAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ['0%', '100%'],
    });

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
                            style={{ width: progressWidth, height: '100%' }}
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

    // ── Ready phase ───────────────────────────────────────────────────────────

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
                                {key}
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
                        onPress={() => router.replace('/(main)')}
                        className="w-full"
                    />
                </View>
            </ScrollView>
        </View>
    );
}
