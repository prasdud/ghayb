import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, Pressable, Switch } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft, Bell } from 'lucide-react-native';
import { BlobBackground } from '../../components/BlobBackground';
import { Card } from '../../components/Card';
import { useSession } from '../context/SessionContext';
import {
    getNotificationsEnabled,
    setNotificationsEnabled,
    registerPushToken,
    unregisterPushToken,
} from '../lib/notifications';

export default function SettingsScreen() {
    const router = useRouter();
    const { session } = useSession();
    const [hasNotifications, setHasNotifications] = useState(false);

    useEffect(() => {
        getNotificationsEnabled().then(setHasNotifications);
    }, []);

    const handleNotificationsToggle = async (enabled: boolean) => {
        setHasNotifications(enabled);
        await setNotificationsEnabled(enabled);
        if (!session?.token) return;
        if (enabled) {
            const ok = await registerPushToken(session.token).catch(() => false);
            if (!ok) {
                setHasNotifications(false);
                await setNotificationsEnabled(false);
            }
        } else {
            await unregisterPushToken(session.token).catch(() => {});
        }
    };

    return (
        <View className="flex-1 bg-background">
            <BlobBackground />
            {/* Header */}
            <View className="px-6 pt-16 pb-4 flex-row items-center z-10 border-b border-timber/20 bg-background/80 backdrop-blur-md">
                <Pressable
                    className="w-10 h-10 rounded-full flex items-center justify-center mr-3 active:bg-timber/20"
                    onPress={() => router.back()}
                >
                    <ArrowLeft color="#2C2C24" size={24} />
                </Pressable>
                <Text className="font-serif text-2xl font-bold text-foreground">Settings</Text>
            </View>

            <ScrollView className="flex-1 z-10" contentContainerStyle={{ padding: 24, paddingBottom: 60 }}>
                {/* Profile */}
                <Card className="mb-6 p-4 flex-col rounded-[2rem]">
                    <View className="flex-row items-center">
                        <View className="w-16 h-16 rounded-[2rem] bg-moss/20 flex items-center justify-center mr-4">
                            <Text className="font-serif text-2xl font-bold text-moss">
                                {session?.username?.charAt(0).toUpperCase() ?? '?'}
                            </Text>
                        </View>
                        <View className="flex-1">
                            <Text className="font-serif text-xl font-bold text-foreground">{session?.username ?? '—'}</Text>
                            <Text className="font-sans text-sm text-moss mt-1 font-bold">E2EE Active</Text>
                        </View>
                    </View>
                </Card>

                {/* Notifications */}
                <Text className="font-sans text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3 ml-2">Preferences</Text>
                <Card className="mb-6 p-2 rounded-[2rem]">
                    <Pressable className="flex-row items-center p-3 active:bg-timber/10 rounded-[1.5rem]">
                        <View className="w-10 h-10 rounded-full bg-timber/20 flex items-center justify-center mr-4">
                            <Bell color="#5D7052" size={20} />
                        </View>
                        <View className="flex-1 mr-4">
                            <Text className="font-sans text-base font-bold text-foreground">Notifications</Text>
                            <Text className="font-sans text-xs text-muted-foreground mt-0.5">Message alerts and sounds</Text>
                        </View>
                        <Switch
                            value={hasNotifications}
                            onValueChange={handleNotificationsToggle}
                            trackColor={{ false: '#DED8CF', true: '#5D7052' }}
                            thumbColor={'#FEFEFA'}
                        />
                    </Pressable>
                </Card>
            </ScrollView>
        </View>
    );
}
