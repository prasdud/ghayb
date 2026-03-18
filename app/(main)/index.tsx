import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, Pressable, Modal, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Plus, X } from 'lucide-react-native';
import { BlobBackground } from '../../components/BlobBackground';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { Card } from '../../components/Card';

const DUMMY_CHATS = [
    { id: '1', name: 'cipher_wolf', lastMessage: 'The package is secured.', time: '10:42 AM', unread: 2 },
    { id: '2', name: 'echo_base', lastMessage: 'Meeting at the coordinates.', time: 'Yesterday', unread: 0 },
    { id: '3', name: 'shadow_ghost', lastMessage: 'Understood.', time: 'Tuesday', unread: 0 },
];

export default function ChatListScreen() {
    const router = useRouter();
    const [isOverlayVisible, setOverlayVisible] = useState(false);
    const [uauid, setUauid] = useState('');
    const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
    const [progress, setProgress] = useState(0);

    const handleOpenChat = (id: string, name: string) => {
        router.push({ pathname: '/(main)/chat/[id]', params: { id, name } });
    };

    const renderItem = ({ item }: { item: typeof DUMMY_CHATS[0] }) => (
        <Pressable
            onPress={() => handleOpenChat(item.id, item.name)}
            className="flex-row items-center p-4 mb-4 bg-white/60 rounded-[2rem] border border-timber/30 shadow-[0_4px_20px_-2px_rgba(93,112,82,0.05)]"
        >
            <View className="w-14 h-14 rounded-[2rem] bg-moss/20 flex items-center justify-center mr-4">
                <Text className="font-serif text-xl font-bold text-moss">{item.name.charAt(0).toUpperCase()}</Text>
            </View>
            <View className="flex-1">
                <View className="flex-row justify-between items-center mb-1">
                    <Text className="font-serif font-bold text-lg text-foreground">{item.name}</Text>
                    <Text className="font-sans text-xs text-muted-foreground">{item.time}</Text>
                </View>
                <Text className="font-sans text-sm text-foreground/80" numberOfLines={1}>
                    {item.lastMessage}
                </Text>
            </View>
            {item.unread > 0 && (
                <View className="ml-3 bg-moss px-3 py-1 rounded-full">
                    <Text className="font-sans text-xs text-primary-foreground font-bold">{item.unread}</Text>
                </View>
            )}
        </Pressable>
    );

    const handleOpenOverlay = () => {
        setOverlayVisible(true);
        setUauid('');
        setStatus('idle');
        setProgress(0);
    };

    const handleCloseOverlay = () => {
        setOverlayVisible(false);
    };

    useEffect(() => {
        if (status === 'loading') {
            const interval = setInterval(() => {
                setProgress(p => (p < 85 ? p + 15 : p));
            }, 200);
            return () => clearInterval(interval);
        }
    }, [status]);

    const handleSendRequest = () => {
        if (!uauid.trim()) return;
        setStatus('loading');
        setProgress(10);

        setTimeout(() => {
            setProgress(100);
            setTimeout(() => {
                const id = uauid.trim().toLowerCase();
                if (id === 'abdul') {
                    setStatus('error');
                } else if (id === 'prasdud') {
                    setStatus('success');
                } else {
                    // Treat others as missing as well for this prototype
                    setStatus('error');
                }
            }, 300);
        }, 1500);
    };

    return (
        <View className="flex-1 bg-background">
            <BlobBackground />

            {/* Header */}
            <View className="px-6 pt-16 pb-6 flex-row justify-between items-center z-10">
                <Text className="font-serif text-4xl font-bold text-foreground tracking-tight">ghayb.</Text>
                <Pressable className="w-12 h-12 rounded-full border border-timber/50 bg-white/50 flex items-center justify-center shadow-[0_4px_20px_-2px_rgba(93,112,82,0.1)] hover:bg-white/80 transition-colors">
                    <Text className="font-serif font-bold text-foreground">{'...'}</Text>
                </Pressable>
            </View>

            {/* Chat List */}
            <FlatList
                data={DUMMY_CHATS}
                keyExtractor={item => item.id}
                renderItem={renderItem}
                contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 100 }}
                showsVerticalScrollIndicator={false}
            />

            {/* FAB */}
            <Pressable
                onPress={handleOpenOverlay}
                className="absolute bottom-8 right-6 w-16 h-16 rounded-full bg-moss flex items-center justify-center shadow-[0_10px_40px_-10px_rgba(93,112,82,0.5)] active:scale-95 transition-transform z-20"
            >
                <Plus color="#F3F4F1" size={28} strokeWidth={2.5} />
            </Pressable>

            {/* Connection Overlay */}
            <Modal visible={isOverlayVisible} transparent animationType="fade">
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    className="flex-1 bg-[#2C2C24]/40 justify-center items-center px-6"
                >
                    <Card className="w-full max-w-sm relative shadow-[0_20px_40px_-10px_rgba(44,44,36,0.3)]">
                        <Pressable
                            onPress={handleCloseOverlay}
                            className="absolute top-4 right-4 z-10 w-8 h-8 flex items-center justify-center rounded-full bg-timber/20 active:bg-timber/40"
                        >
                            <X color="#78786C" size={18} />
                        </Pressable>

                        <View className="mt-2 mb-6">
                            <Text className="font-serif text-3xl font-bold text-foreground mb-2">Connect.</Text>
                            <Text className="font-sans text-sm text-muted-foreground leading-relaxed">
                                Enter a Unique Anonymous User ID (UAUID) to safely establish a secure channel.
                            </Text>
                        </View>

                        <View className="mb-4">
                            <Text className="font-sans text-sm font-semibold text-foreground mb-2 ml-2">Target UAUID</Text>
                            <Input
                                placeholder="e.g. echo_base"
                                value={uauid}
                                onChangeText={(t) => { setUauid(t); setStatus('idle'); }}
                                autoCapitalize="none"
                                editable={status !== 'loading' && status !== 'success'}
                            />
                        </View>

                        {status === 'loading' && (
                            <View className="mb-6">
                                <View className="flex-row justify-between items-center mb-2 px-1">
                                    <Text className="font-sans text-xs font-bold text-moss">Generating keys...</Text>
                                    <Text className="font-sans text-xs text-muted-foreground">{progress}%</Text>
                                </View>
                                <View className="h-2 w-full bg-timber/30 rounded-full overflow-hidden">
                                    <View className="h-full bg-moss rounded-full" style={{ width: `${progress}%`, transitionDuration: '300ms' }} />
                                </View>
                            </View>
                        )}

                        {status === 'error' && (
                            <View className="mb-6 bg-destructive/10 border border-destructive/20 p-4 rounded-[1.5rem]">
                                <Text className="font-sans text-sm font-bold text-destructive text-center">
                                    Connection Failed
                                </Text>
                                <Text className="font-sans text-xs text-destructive/80 text-center mt-1">
                                    This user does not exist on the network.
                                </Text>
                            </View>
                        )}

                        {status === 'success' && (
                            <View className="mb-6 bg-moss/10 border border-moss/20 p-4 rounded-[1.5rem]">
                                <Text className="font-sans text-base font-bold text-moss text-center">
                                    Success
                                </Text>
                                <Text className="font-sans text-xs text-moss/80 text-center mt-1">
                                    Secure connection request sent to "{uauid}".
                                </Text>
                            </View>
                        )}

                        {status !== 'success' ? (
                            <Button
                                label={status === 'loading' ? 'Encrypting...' : 'Send Request'}
                                onPress={handleSendRequest}
                                className={`w-full mt-2 ${status === 'loading' ? 'opacity-50' : ''}`}
                                disabled={status === 'loading'}
                                variant={status === 'loading' ? 'outline' : 'primary'}
                            />
                        ) : (
                            <Button
                                label="Done"
                                onPress={handleCloseOverlay}
                                className="w-full mt-2"
                                variant="outline"
                            />
                        )}
                    </Card>
                </KeyboardAvoidingView>
            </Modal>
        </View>
    );
}
