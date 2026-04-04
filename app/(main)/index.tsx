import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, FlatList, Pressable, Modal, KeyboardAvoidingView, Platform, Alert, SectionList } from 'react-native';
import { useRouter } from 'expo-router';
import { Plus, X, MoreVertical, UserPlus, Check, XCircle } from 'lucide-react-native';
import { BlobBackground } from '../../components/BlobBackground';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { Card } from '../../components/Card';
import { useSession } from '../context/SessionContext';
import { API_BASE } from '../lib/api';
import { Contact, fetchAndDecryptContacts, encryptAndSaveContacts } from '../lib/contacts';
import { encryptMessage, importBytes, exportBytes } from '@dragbin/native-crypto';

// ── Types ─────────────────────────────────────────────────────────────────────

interface PendingConnection {
    conversationId: string;
    user: { id: string; username: string; publicKey: string };
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ChatListScreen() {
    const router = useRouter();
    const { session, clearSession } = useSession();
    const [contacts, setContacts] = useState<Contact[]>([]);
    const [pendingConnections, setPendingConnections] = useState<PendingConnection[]>([]);
    const [isOverlayVisible, setOverlayVisible] = useState(false);
    const [isMenuVisible, setMenuVisible] = useState(false);
    const [uauid, setUauid] = useState('');
    const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
    const [errorMsg, setErrorMsg] = useState('');
    const contactsRef = useRef<Contact[]>([]);
    const dismissedIdsRef = useRef<Set<string>>(new Set());

    // Keep ref in sync so the polling callback always has current contacts
    useEffect(() => { contactsRef.current = contacts; }, [contacts]);

    // Load contacts from server on mount
    useEffect(() => {
        if (!session) return;
        fetchAndDecryptContacts(session.token, session.privateKey)
            .then((c) => { setContacts(c); contactsRef.current = c; })
            .catch(() => { }); // non-fatal — empty list on failure
    }, [session?.userId]);

    // Poll for pending connections every 5 seconds
    const fetchPending = useCallback(async () => {
        if (!session) return;
        try {
            const knownIds = [
                ...contactsRef.current.map((c) => c.id),
                ...dismissedIdsRef.current,
            ].join(',');
            const res = await fetch(
                `${API_BASE}/messages/pending?knownUserIds=${encodeURIComponent(knownIds)}`,
                { headers: { Authorization: `Bearer ${session.token}` } },
            );
            if (!res.ok) return;
            const data: PendingConnection[] = await res.json();
            setPendingConnections(data);
        } catch {
            // silently retry
        }
    }, [session?.token]);

    useEffect(() => {
        if (!session) return;
        fetchPending();
        const interval = setInterval(fetchPending, 5000);
        return () => clearInterval(interval);
    }, [session?.userId, fetchPending]);

    // ── Handlers ──────────────────────────────────────────────────────────────

    const handleOpenChat = (contact: Contact) => {
        router.push({
            pathname: '/(main)/chat/[id]',
            params: { id: contact.id, name: contact.username, publicKey: contact.publicKey },
        });
    };

    const handleSendRequest = async () => {
        const target = uauid.trim();
        if (!target) return;
        if (!session) {
            Alert.alert('Error', 'Not signed in');
            return;
        }
        if (target.toLowerCase() === session.username.toLowerCase()) {
            setStatus('error');
            setErrorMsg('You cannot connect to yourself.');
            return;
        }
        if (contacts.find(c => c.username.toLowerCase() === target.toLowerCase())) {
            setStatus('error');
            setErrorMsg('Already connected to this user.');
            return;
        }

        setStatus('loading');
        try {
            // 1. Look up the target user
            const res = await fetch(`${API_BASE}/users/${encodeURIComponent(target)}`, {
                headers: { Authorization: `Bearer ${session.token}` },
            });

            if (res.status === 401) {
                setStatus('error');
                setErrorMsg('Session expired. Please sign in again.');
                return;
            }
            if (!res.ok) {
                // Generic success to prevent username enumeration
                setStatus('success');
                return;
            }

            const { id, username, publicKey } = await res.json();

            // 2. Add to contacts
            const newContacts = [...contacts, { id, username, publicKey }];
            setContacts(newContacts);
            await encryptAndSaveContacts(newContacts, session.token, session.privateKey);

            // 3. Auto-send a connection_request message (the recipient will see this as an incoming request)
            const recipientPublicKey = importBytes(publicKey);
            const payload = JSON.stringify({
                type: 'connection_request',
                username: session.username,
                publicKey: exportBytes(session.publicKey),
            });
            const { encryptedData, recipientWrappedKey, senderWrappedKey } = await encryptMessage(
                payload,
                recipientPublicKey,
                session.publicKey,
            );

            await fetch(`${API_BASE}/messages`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${session.token}`,
                },
                body: JSON.stringify({
                    recipientId: id,
                    encryptedData: exportBytes(encryptedData),
                    kyberEncryptedSessionKey: exportBytes(recipientWrappedKey),
                    senderWrappedKey: exportBytes(senderWrappedKey),
                }),
            });

            setStatus('success');
        } catch {
            setStatus('error');
            setErrorMsg('Failed to reach server.');
        }
    };

    const handleAcceptConnection = async (pending: PendingConnection) => {
        if (!session) return;
        try {
            const { id, username, publicKey } = pending.user;
            const newContacts = [...contacts, { id, username, publicKey }];
            setContacts(newContacts);
            await encryptAndSaveContacts(newContacts, session.token, session.privateKey);

            // Remove from pending list
            setPendingConnections((prev) => prev.filter((p) => p.conversationId !== pending.conversationId));
        } catch {
            Alert.alert('Error', 'Failed to accept connection.');
        }
    };

    const handleIgnoreConnection = async (pending: PendingConnection) => {
        dismissedIdsRef.current.add(pending.user.id);
        setPendingConnections((prev) => prev.filter((p) => p.conversationId !== pending.conversationId));
        // Delete conversation + messages from server (fire-and-forget)
        try {
            await fetch(`${API_BASE}/messages/conversations/${pending.conversationId}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${session!.token}` },
            });
        } catch { }
    };

    const handleOpenOverlay = () => {
        setOverlayVisible(true);
        setUauid('');
        setStatus('idle');
        setErrorMsg('');
    };

    const handleLockIdentity = () => {
        clearSession();
        router.replace('/signin');
    };

    // ── Render helpers ────────────────────────────────────────────────────────

    const renderContactItem = ({ item }: { item: Contact }) => (
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

    const renderPendingItem = ({ item }: { item: PendingConnection }) => (
        <View className="flex-row items-center p-4 mb-4 bg-clay/5 rounded-[2rem] border border-clay/20 shadow-[0_4px_20px_-2px_rgba(193,140,93,0.08)]">
            <View className="w-14 h-14 rounded-[2rem] bg-clay/15 flex items-center justify-center mr-4">
                <UserPlus color="#C18C5D" size={22} />
            </View>
            <View className="flex-1 mr-3">
                <Text className="font-serif font-bold text-lg text-foreground">{item.user.username}</Text>
                <Text className="font-sans text-xs text-clay font-bold mt-0.5">Wants to connect</Text>
            </View>
            <Pressable
                onPress={() => handleAcceptConnection(item)}
                className="w-10 h-10 rounded-full bg-moss/15 flex items-center justify-center mr-2 active:scale-95"
            >
                <Check color="#5D7052" size={20} strokeWidth={2.5} />
            </Pressable>
            <Pressable
                onPress={() => handleIgnoreConnection(item)}
                className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center active:scale-95"
            >
                <X color="#A85448" size={18} strokeWidth={2.5} />
            </Pressable>
        </View>
    );

    // Build section data for SectionList
    const sections = [
        ...(pendingConnections.length > 0
            ? [{ title: 'Pending', data: pendingConnections as any[], type: 'pending' as const }]
            : []),
        ...(contacts.length > 0
            ? [{ title: 'Contacts', data: contacts as any[], type: 'contacts' as const }]
            : []),
    ];

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
                                <Text className="font-sans text-sm font-bold text-destructive">Logout</Text>
                            </Pressable>
                        </View>
                    </Pressable>
                </Modal>
            </View>

            {/* Main List */}
            {sections.length > 0 ? (
                <SectionList
                    sections={sections}
                    keyExtractor={(item, index) => item.id ?? item.conversationId ?? String(index)}
                    renderItem={({ item, section }) =>
                        section.type === 'pending'
                            ? renderPendingItem({ item })
                            : renderContactItem({ item })
                    }
                    renderSectionHeader={({ section }) =>
                        section.type === 'pending' ? (
                            <View className="mb-3 ml-1">
                                <Text className="font-sans text-xs font-bold text-clay uppercase tracking-widest">
                                    Incoming Requests
                                </Text>
                            </View>
                        ) : contacts.length > 0 && pendingConnections.length > 0 ? (
                            <View className="mb-3 mt-2 ml-1">
                                <Text className="font-sans text-xs font-bold text-muted-foreground uppercase tracking-widest">
                                    Contacts
                                </Text>
                            </View>
                        ) : null
                    }
                    contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 100, flexGrow: 1 }}
                    showsVerticalScrollIndicator={false}
                    stickySectionHeadersEnabled={false}
                />
            ) : (
                <View className="flex-1 items-center justify-center px-8">
                    <Text className="font-serif text-2xl font-bold text-foreground/40 text-center">No connections yet.</Text>
                    <Text className="font-sans text-sm text-muted-foreground text-center mt-2">Tap + to connect with someone.</Text>
                </View>
            )}

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
                                <Text className="font-sans text-base font-bold text-moss text-center">Request Sent</Text>
                                <Text className="font-sans text-xs text-moss/80 text-center mt-1">
                                    If &ldquo;{uauid}&rdquo; is on the network, they&apos;ll see your request.
                                </Text>
                            </View>
                        )}

                        {status !== 'success' ? (
                            <Button
                                label={status === 'loading' ? 'Sending…' : 'Connect'}
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
