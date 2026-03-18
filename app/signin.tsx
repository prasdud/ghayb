import React, { useState } from 'react';
import { View, Text, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter, Link } from 'expo-router';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { BlobBackground } from '../components/BlobBackground';
import { Card } from '../components/Card';

export default function SignInScreen() {
    const router = useRouter();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');

    const handleSignIn = () => {
        // Scaffold redirect to main screen
        router.replace('/(main)');
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

                        <Button label="Sign In" onPress={handleSignIn} className="w-full mb-4" />

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
