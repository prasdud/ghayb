import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, Switch } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft, Key, Lock, Bell, Trash2, Smartphone, RefreshCw } from 'lucide-react-native';
import { BlobBackground } from '../../components/BlobBackground';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';

export default function SettingsScreen() {
    const router = useRouter();
    const [isLocked, setIsLocked] = useState(true);
    const [hasNotifications, setHasNotifications] = useState(false);

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
                {/* Profile Details */}
                <Card className="mb-6 p-4 flex-col rounded-[2rem]">
                    <View className="flex-row items-center">
                        <View className="w-16 h-16 rounded-[2rem] bg-moss/20 flex items-center justify-center mr-4">
                            <Text className="font-serif text-2xl font-bold text-moss">S</Text>
                        </View>
                        <View className="flex-1">
                            <Text className="font-serif text-xl font-bold text-foreground">shadow_ghost</Text>
                            <Text className="font-sans text-sm text-moss mt-1 font-bold">Identity Verified</Text>
                        </View>
                    </View>
                </Card>

                {/* Security Section */}
                <Text className="font-sans text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3 ml-2">Security & Privacy</Text>
                <Card className="mb-6 p-2 rounded-[2rem]">
                    <SettingRow icon={Key} title="Encryption Keys" subtitle="Manage your quantum-resistant keys" />
                    <View className="h-[1px] bg-timber/20 mx-4 my-2" />
                    <SettingRow icon={Lock} title="App Lock" subtitle="Require passcode to open ghayb" hasSwitch value={isLocked} onValueChange={setIsLocked} />
                    <View className="h-[1px] bg-timber/20 mx-4 my-2" />
                    <SettingRow icon={RefreshCw} title="Sync Devices" subtitle="Securely sync history via QR code" />
                </Card>

                {/* Preferences Section */}
                <Text className="font-sans text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3 ml-2">Preferences</Text>
                <Card className="mb-6 p-2 rounded-[2rem]">
                    <SettingRow icon={Bell} title="Notifications" subtitle="Message alerts and sounds" hasSwitch value={hasNotifications} onValueChange={setHasNotifications} />
                    <View className="h-[1px] bg-timber/20 mx-4 my-2" />
                    <SettingRow icon={Smartphone} title="Appearance" subtitle="Following system natural theme" />
                </Card>

                {/* Danger Zone */}
                <Text className="font-sans text-xs font-bold text-destructive uppercase tracking-wider mb-3 ml-2">Danger Zone</Text>
                <Card className="mb-6 p-4 rounded-[2rem] border border-destructive/20 bg-destructive/5">
                    <View className="flex-row items-start mb-4">
                        <View className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center mr-4 mt-1">
                            <Trash2 color="#A85448" size={20} />
                        </View>
                        <View className="flex-1">
                            <Text className="font-sans text-base font-bold text-destructive">Destroy Identity</Text>
                            <Text className="font-sans text-xs text-destructive/80 mt-1 leading-relaxed">Permanently delete keys and messages. This action cannot be undone.</Text>
                        </View>
                    </View>
                    <Button label="Delete Account" variant="outline" className="opacity-90 min-h-[44px]" />
                </Card>
            </ScrollView>
        </View>
    );
}

function SettingRow({ icon: Icon, title, subtitle, hasSwitch, value, onValueChange }: any) {
    return (
        <Pressable className="flex-row items-center p-3 active:bg-timber/10 rounded-[1.5rem] transition-colors">
            <View className="w-10 h-10 rounded-full bg-timber/20 flex items-center justify-center mr-4">
                <Icon color="#5D7052" size={20} />
            </View>
            <View className="flex-1 mr-4">
                <Text className="font-sans text-base font-bold text-foreground">{title}</Text>
                <Text className="font-sans text-xs text-muted-foreground mt-0.5">{subtitle}</Text>
            </View>
            {hasSwitch && (
                <Switch
                    value={value}
                    onValueChange={onValueChange}
                    trackColor={{ false: '#DED8CF', true: '#5D7052' }}
                    thumbColor={'#FEFEFA'}
                />
            )}
        </Pressable>
    );
}
