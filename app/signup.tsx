import React, { useState } from 'react';
import { View, Text, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useRouter, Link } from 'expo-router';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { BlobBackground } from '../components/BlobBackground';
import { Card } from '../components/Card';

export default function SignUpScreen() {
    const router = useRouter();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    const handleSignUp = () => {
        // Scaffold redirect to main screen
        router.replace('/(main)');
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

                        <Button label="Create Identity" onPress={handleSignUp} className="w-full mb-4" />

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
