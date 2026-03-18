import React, { useState } from 'react';
import { View, Text, KeyboardAvoidingView, Platform, ScrollView, Pressable, TextInput } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, Send } from 'lucide-react-native';
import { BlobBackground } from '../../../components/BlobBackground';

const DUMMY_MESSAGES = [
    { id: '1', text: 'Are you on the secure channel?', sender: 'them', time: '10:40 AM' },
    { id: '2', text: 'Yes, quantum-resistant keys generated.', sender: 'me', time: '10:41 AM' },
    { id: '3', text: 'The package is secured.', sender: 'them', time: '10:42 AM' },
];

export default function ChatScreen() {
    const { id, name } = useLocalSearchParams();
    const router = useRouter();
    const [messages, setMessages] = useState(DUMMY_MESSAGES);
    const [inputText, setInputText] = useState('');

    const chatName = name || 'Unknown Contact';

    const handleSend = () => {
        if (!inputText.trim()) return;
        setMessages(prev => [
            ...prev,
            { id: Date.now().toString(), text: inputText, sender: 'me', time: 'Now' }
        ]);
        setInputText('');
    };

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            className="flex-1 bg-background"
        >
            <BlobBackground />

            {/* Header */}
            <View className="px-6 pt-16 pb-4 flex-row items-center z-10 border-b border-timber/20 bg-background/80 backdrop-blur-md">
                <Pressable
                    className="w-10 h-10 rounded-full flex items-center justify-center mr-3 active:bg-timber/20"
                    onPress={() => router.back()}
                >
                    <ArrowLeft color="#2C2C24" size={24} />
                </Pressable>
                <View className="flex-1">
                    <Text className="font-serif text-2xl font-bold text-foreground">{chatName}</Text>
                    <Text className="font-sans text-xs text-moss font-bold">E2EE Active</Text>
                </View>
            </View>

            {/* Messages */}
            <ScrollView
                className="flex-1 z-10"
                contentContainerStyle={{ paddingHorizontal: 24, paddingVertical: 16 }}
            >
                {messages.map((msg) => {
                    const isMe = msg.sender === 'me';
                    return (
                        <View
                            key={msg.id}
                            className={`mb-4 max-w-[80%] ${isMe ? 'self-end' : 'self-start'}`}
                        >
                            <View
                                className={`p-4 ${isMe
                                    ? 'bg-moss rounded-[2rem] rounded-tr-lg shadow-[0_4px_20px_-2px_rgba(93,112,82,0.15)]'
                                    : 'bg-white rounded-[2rem] rounded-tl-lg border border-timber/40 shadow-[0_4px_20px_-2px_rgba(222,216,207,0.5)]'}`}
                            >
                                <Text className={`font-sans text-base leading-relaxed ${isMe ? 'text-primary-foreground' : 'text-foreground'}`}>
                                    {msg.text}
                                </Text>
                            </View>
                            <Text className={`font-sans text-[10px] text-muted-foreground mt-1 mx-2 ${isMe ? 'text-right' : 'text-left'}`}>
                                {msg.time}
                            </Text>
                        </View>
                    );
                })}
            </ScrollView>

            {/* Input Area */}
            <View className="p-4 px-6 z-10 bg-background/80 backdrop-blur-md border-t border-timber/20 flex-row items-end">
                <View className="flex-1 min-h-[48px] max-h-32 bg-white/80 border border-timber/60 rounded-[1.5rem] px-5 py-3 mr-3 flex-row items-center">
                    <TextInput
                        className="flex-1 font-sans text-sm text-foreground max-h-24"
                        placeholder="Type a secure message..."
                        placeholderTextColor="#78786C"
                        multiline
                        value={inputText}
                        onChangeText={setInputText}
                    />
                </View>
                <Pressable
                    onPress={handleSend}
                    className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${inputText.trim() ? 'bg-moss shadow-[0_4px_20px_-2px_rgba(93,112,82,0.25)]' : 'bg-timber/50'}`}
                >
                    <Send color={inputText.trim() ? '#F3F4F1' : '#FDFCF8'} size={20} />
                </Pressable>
            </View>
        </KeyboardAvoidingView>
    );
}
