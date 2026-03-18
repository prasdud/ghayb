import React from 'react';
import { View, Text, FlatList, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Plus, MessageSquare } from 'lucide-react-native';
import { BlobBackground } from '../../components/BlobBackground';

const DUMMY_CHATS = [
    { id: '1', name: 'cipher_wolf', lastMessage: 'The package is secured.', time: '10:42 AM', unread: 2 },
    { id: '2', name: 'echo_base', lastMessage: 'Meeting at the coordinates.', time: 'Yesterday', unread: 0 },
    { id: '3', name: 'shadow_ghost', lastMessage: 'Understood.', time: 'Tuesday', unread: 0 },
];

export default function ChatListScreen() {
    const router = useRouter();

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
            <Pressable className="absolute bottom-8 right-6 w-16 h-16 rounded-full bg-moss flex items-center justify-center shadow-[0_10px_40px_-10px_rgba(93,112,82,0.5)] active:scale-95 transition-transform z-20">
                <Plus color="#F3F4F1" size={28} strokeWidth={2.5} />
            </Pressable>
        </View>
    );
}
