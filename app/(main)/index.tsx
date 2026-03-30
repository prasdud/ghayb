import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, Pressable, Modal, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Plus, X, MoreVertical } from 'lucide-react-native';
import { BlobBackground } from '../../components/BlobBackground';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { Card } from '../../components/Card';
import { useSession } from '../context/SessionContext';
import { API_BASE } from '../lib/api';
import { Contact, fetchAndDecryptContacts, encryptAndSaveContacts } from '../lib/contacts';

export default function ChatListScreen() {
    const router = useRouter();
    const { session, clearSession } = useSession();
    const [contacts, setContacts] = useState<Contact[]>([]);
    const [isOverlayVisible, setOverlayVisible] = useState(false);
    const [isMenuVisible, setMenuVisible] = useState(false);
    const [uauid, setUauid] = useState('');
    const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
    const [errorMsg, setErrorMsg] = useState('');

    // Load contacts from server on mount
    useEffect(() => {
        if (!session) return;
        fetchAndDecryptContacts(session.token, session.privateKey)
            .then(setContacts)
            .catch(() => {}); // non-fatal — empty list on failure
    }, [session?.userId]); // re-run only on user change, not every render

    const handleOpenChat = (contact: Contact) => {
        router.push({
            pathname: '/(main)/chat/[id]',
            params: { id: contact.id, name: contact.username, publicKey: contact.publicKey },
        });
    };

    const renderItem = ({ item }: { item: Contact }) => (
        <Pressable
            onPress={() => handleOpenChat(item)}
            className="flex-row items-center p-4 mb-4 bg-white/60 rounded-[2rem] border border-timber/30 shadow-[0_4px_20px_-2px_rgba(93,112,82,0.05)]"
        >
            <View className="w-14 h-14 rounded-[2rem] bg-moss/20 flex items-center justify-center mr-4">
                <Text className="font-serif text-xl font-bold text-moss">{item.username.charAt(0).toUpperCase()}</Text>
            </View>
            <View className="flex-1">
                <Text className="font-serif font-bold text-lg text-foreground">{item.username}</Text>
                <Text className="font-sans text-xs text-moss font-bold mt-0.5">E2EE Active</Text>
            </View>
        </Pressable>
    );

    const handleOpenOverlay = () => {
        setOverlayVisible(true);
        setUauid('');
        setStatus('idle');
        setErrorMsg('');
    };

    const handleSendRequest = async () => {
        const target = uauid.trim().toLowerCase();
        if (!target) return;
        if (!session) {
            Alert.alert('Error', 'Not signed in');
            return;
        }
        if (target === session.username) {
            setStatus('error');
            setErrorMsg('You cannot connect to yourself.');
            return;
        }
        if (contacts.find(c => c.username === target)) {
            setStatus('error');
            setErrorMsg('Already connected to this user.');
            return;
        }

        setStatus('loading');
        try {
            const res = await fetch(`${API_BASE}/users/${encodeURIComponent(target)}`, {
                headers: { Authorization: `Bearer ${session.token}` },
            });

            if (!res.ok) {
                setStatus('error');
                setErrorMsg('This user does not exist on the network.');
                return;
            }

            const { id, username, publicKey } = await res.json();
            const newContacts = [...contacts, { id, username, publicKey }];

            // Update state and persist encrypted blob to server
            setContacts(newContacts);
            await encryptAndSaveContacts(newContacts, session.token, session.privateKey);
            setStatus('success');
        } catch {
            setStatus('error');
            setErrorMsg('Failed to reach server.');
        }
    };

    const handleLockIdentity = () => {
        clearSession();
        router.replace('/signin');
    };

    return (
        <View className="flex-1 bg-background">
            <BlobBackground />

            {/* Header */}
            <View className="px-6 pt-16 pb-6 flex-row justify-between items-center z-10 relative">
                <Text className="font-serif text-4xl font-bold text-foreground tracking-tight">ghayb.</Text>
                <Pressable
                    onPress={() => setMenuVisible(true)}
                    className="w-12 h-12 rounded-full border border-timber/50 bg-white/50 flex items-center justify-center shadow-[0_4px_20px_-2px_rgba(93,112,82,0.1)] hover:bg-white/80 active:scale-95 transition-all"
                >
                    <MoreVertical color="#2C2C24" size={20} />
                </Pressable>

                <Modal visible={isMenuVisible} transparent animationType="fade">
                    <Pressable
                        className="flex-1 bg-[#2C2C24]/10 backdrop-blur-sm"
                        onPress={() => setMenuVisible(false)}
                    >
                        <View className="absolute top-28 right-6 w-48 bg-[#FEFEFA] rounded-[1.5rem] border border-timber/40 shadow-[0_10px_40px_-5px_rgba(93,112,82,0.2)] overflow-hidden">
                            <Pressable
                                onPress={() => { setMenuVisible(false); router.push('/(main)/settings'); }}
                                className="p-4 border-b border-timber/20 active:bg-moss/10"
                            >
                                <Text className="font-sans text-sm font-bold text-foreground">Settings</Text>
                            </Pressable>
                            <Pressable
                                onPress={() => { setMenuVisible(false); handleLockIdentity(); }}
                                className="p-4 active:bg-destructive/10"
                            >
                                <Text className="font-sans text-sm font-bold text-destructive">Lock Identity</Text>
                            </Pressable>
                        </View>
                    </Pressable>
                </Modal>
            </View>

            {/* Chat List */}
            <FlatList
                data={contacts}
                keyExtractor={item => item.id}
                renderItem={renderItem}
                ListEmptyComponent={
                    <View className="flex-1 items-center justify-center mt-24 px-8">
                        <Text className="font-serif text-2xl font-bold text-foreground/40 text-center">No connections yet.</Text>
                        <Text className="font-sans text-sm text-muted-foreground text-center mt-2">Tap + to connect with someone.</Text>
                    </View>
                }
                contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 100, flexGrow: 1 }}
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
                            onPress={() => setOverlayVisible(false)}
                            className="absolute top-4 right-4 z-10 w-8 h-8 flex items-center justify-center rounded-full bg-timber/20 active:bg-timber/40"
                        >
                            <X color="#78786C" size={18} />
                        </Pressable>

                        <View className="mt-2 mb-6">
                            <Text className="font-serif text-3xl font-bold text-foreground mb-2">Connect.</Text>
                            <Text className="font-sans text-sm text-muted-foreground leading-relaxed">
                                Enter a username to establish a secure channel.
                            </Text>
                        </View>

                        <View className="mb-4">
                            <Text className="font-sans text-sm font-semibold text-foreground mb-2 ml-2">Username</Text>
                            <Input
                                placeholder="e.g. echo_base"
                                value={uauid}
                                onChangeText={(t) => { setUauid(t); setStatus('idle'); }}
                                autoCapitalize="none"
                                editable={status !== 'loading' && status !== 'success'}
                            />
                        </View>

                        {status === 'error' && (
                            <View className="mb-4 bg-destructive/10 border border-destructive/20 p-4 rounded-[1.5rem]">
                                <Text className="font-sans text-sm font-bold text-destructive text-center">Connection Failed</Text>
                                <Text className="font-sans text-xs text-destructive/80 text-center mt-1">{errorMsg}</Text>
                            </View>
                        )}

                        {status === 'success' && (
                            <View className="mb-4 bg-moss/10 border border-moss/20 p-4 rounded-[1.5rem]">
                                <Text className="font-sans text-base font-bold text-moss text-center">Connected</Text>
                                <Text className="font-sans text-xs text-moss/80 text-center mt-1">
                                    Secure channel established with "{uauid}".
                                </Text>
                            </View>
                        )}

                        {status !== 'success' ? (
                            <Button
                                label={status === 'loading' ? 'Looking up…' : 'Connect'}
                                onPress={handleSendRequest}
                                className={`w-full mt-2 ${status === 'loading' ? 'opacity-50' : ''}`}
                                disabled={status === 'loading'}
                                variant={status === 'loading' ? 'outline' : 'primary'}
                            />
                        ) : (
                            <Button
                                label="Done"
                                onPress={() => setOverlayVisible(false)}
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
