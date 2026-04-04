import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, KeyboardAvoidingView, Platform, Pressable, TextInput, Alert, FlatList, Animated, Easing } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, Send } from 'lucide-react-native';
import { BlobBackground } from '../../../components/BlobBackground';
import { encryptMessage, decryptMessage, importBytes, exportBytes } from '@dragbin/native-crypto';
import { useSession } from '../../context/SessionContext';
import { API_BASE } from '../../lib/api';

interface Message {
    id: string
    senderId: string
    text: string
    time: string
}

// ── Animated chat bubble ──────────────────────────────────────────────────────

function ChatBubble({ msg, isMe, isNew }: { msg: Message; isMe: boolean; isNew: boolean }) {
    const animValue = useRef(new Animated.Value(isNew ? 0 : 1)).current;

    useEffect(() => {
        if (!isNew) return;
        Animated.timing(animValue, {
            toValue: 1,
            duration: 280,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
        }).start();
    }, []);

    return (
        <Animated.View
            style={{
                opacity: animValue,
                transform: [
                    {
                        translateY: animValue.interpolate({
                            inputRange: [0, 1],
                            outputRange: [16, 0],
                        }),
                    },
                    {
                        scale: animValue.interpolate({
                            inputRange: [0, 1],
                            outputRange: [0.95, 1],
                        }),
                    },
                ],
                alignSelf: isMe ? 'flex-end' : 'flex-start',
                maxWidth: '80%',
                marginBottom: 12,
            }}
        >
            <View
                className={`px-4 py-3 ${isMe
                    ? 'bg-moss rounded-[1.5rem] rounded-br-md shadow-[0_2px_12px_-2px_rgba(93,112,82,0.2)]'
                    : 'bg-white rounded-[1.5rem] rounded-bl-md border border-timber/30 shadow-[0_2px_12px_-2px_rgba(222,216,207,0.4)]'}`}
            >
                <Text className={`font-sans text-[15px] leading-relaxed ${isMe ? 'text-primary-foreground' : 'text-foreground'}`}>
                    {msg.text}
                </Text>
            </View>
            <Text className={`font-sans text-[10px] text-muted-foreground mt-1 mx-3 ${isMe ? 'text-right' : 'text-left'}`}>
                {msg.time}
            </Text>
        </Animated.View>
    );
}

// ── Chat screen ───────────────────────────────────────────────────────────────

export default function ChatScreen() {
    const { id: recipientId, name, publicKey: publicKeyB64 } = useLocalSearchParams<{
        id: string
        name: string
        publicKey: string
    }>();
    const router = useRouter();
    const { session } = useSession();
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputText, setInputText] = useState('');
    const [conversationId, setConversationId] = useState<string | null>(null);
    const [sending, setSending] = useState(false);
    const flatListRef = useRef<FlatList>(null);
    const conversationIdRef = useRef<string | null>(null);
    // Track which message IDs we've already seen so we only animate new ones
    const seenIdsRef = useRef<Set<string>>(new Set());

    // Single poll loop
    useEffect(() => {
        if (!session || !recipientId) return;

        const poll = async () => {
            try {
                let convId = conversationIdRef.current;

                if (!convId) {
                    const r = await fetch(`${API_BASE}/messages/conversations?otherUserId=${recipientId}`, {
                        headers: { Authorization: `Bearer ${session.token}` },
                    });
                    if (!r.ok) return;
                    const { conversationId: cid } = await r.json();
                    if (!cid) return;
                    conversationIdRef.current = cid;
                    setConversationId(cid);
                    convId = cid;
                }

                const res = await fetch(`${API_BASE}/messages?conversationId=${convId}`, {
                    headers: { Authorization: `Bearer ${session.token}` },
                });
                if (!res.ok) return;

                const raw: { id: string; senderId: string; encryptedData: string; kyberEncryptedSessionKey: string; senderWrappedKey: string | null; createdAt: string }[] = await res.json();

                const decrypted: Message[] = (await Promise.all(
                    raw.map(async (m) => {
                        const isMine = m.senderId === session.userId;
                        const wrappedKeyB64 = isMine ? m.senderWrappedKey : m.kyberEncryptedSessionKey;
                        if (!wrappedKeyB64) {
                            return { id: m.id, senderId: m.senderId, text: '[no sender copy]', time: new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) };
                        }
                        try {
                            const text = await decryptMessage(
                                {
                                    encryptedData: importBytes(m.encryptedData),
                                    wrappedKey: importBytes(wrappedKeyB64),
                                },
                                session.privateKey,
                            );
                            // Hide connection_request messages from the chat view
                            try { const parsed = JSON.parse(text); if (parsed?.type === 'connection_request') return null; } catch { }
                            return { id: m.id, senderId: m.senderId, text, time: new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) };
                        } catch {
                            return { id: m.id, senderId: m.senderId, text: '[decryption failed]', time: new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) };
                        }
                    }),
                )).filter((m): m is Message => m !== null);

                setMessages(decrypted);
            } catch {
                // silently retry
            }
        };

        poll();
        const interval = setInterval(poll, 3000);
        return () => clearInterval(interval);
    }, [session?.userId, recipientId]);

    // Auto-scroll when new messages arrive
    useEffect(() => {
        if (messages.length > 0) {
            setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
        }
    }, [messages.length]);

    const handleSend = async () => {
        const text = inputText.trim();
        if (!text || !session || sending) return;

        setSending(true);
        try {
            const recipientPublicKey = importBytes(publicKeyB64);
            const { encryptedData, recipientWrappedKey, senderWrappedKey } = await encryptMessage(
                text,
                recipientPublicKey,
                session.publicKey,
            );

            const res = await fetch(`${API_BASE}/messages`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${session.token}`,
                },
                body: JSON.stringify({
                    recipientId,
                    encryptedData: exportBytes(encryptedData),
                    kyberEncryptedSessionKey: exportBytes(recipientWrappedKey),
                    senderWrappedKey: exportBytes(senderWrappedKey),
                }),
            });

            if (!res.ok) {
                Alert.alert('Error', 'Failed to send message');
                return;
            }

            const { conversationId: convId } = await res.json();
            if (!conversationIdRef.current) {
                conversationIdRef.current = convId;
                setConversationId(convId);
            }

            setInputText('');
        } catch (e: any) {
            Alert.alert('Error', e?.message ?? 'Failed to send message');
        } finally {
            setSending(false);
        }
    };

    const renderMessage = useCallback(({ item }: { item: Message }) => {
        const isMe = item.senderId === session?.userId;
        const isNew = !seenIdsRef.current.has(item.id);
        if (isNew) seenIdsRef.current.add(item.id);
        return <ChatBubble msg={item} isMe={isMe} isNew={isNew} />;
    }, [session?.userId]);

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
                    <Text className="font-serif text-2xl font-bold text-foreground">{name}</Text>
                    <Text className="font-sans text-xs text-moss font-bold">E2EE Active</Text>
                </View>
            </View>

            {/* Messages */}
            <FlatList
                ref={flatListRef}
                data={messages}
                keyExtractor={(item) => item.id}
                renderItem={renderMessage}
                className="flex-1 z-10"
                contentContainerStyle={{ paddingHorizontal: 24, paddingVertical: 16, flexGrow: 1 }}
                showsVerticalScrollIndicator={false}
                ListEmptyComponent={
                    <View className="flex-1 items-center justify-center">
                        <Text className="font-sans text-sm text-muted-foreground text-center mt-8">
                            Send a message to start the conversation.
                        </Text>
                    </View>
                }
            />

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
                    disabled={sending || !inputText.trim()}
                    className={`w-12 h-12 rounded-full flex items-center justify-center ${inputText.trim() && !sending ? 'bg-moss shadow-[0_4px_20px_-2px_rgba(93,112,82,0.25)]' : 'bg-timber/50'}`}
                >
                    <Send color={inputText.trim() && !sending ? '#F3F4F1' : '#FDFCF8'} size={20} />
                </Pressable>
            </View>
        </KeyboardAvoidingView>
    );
}
