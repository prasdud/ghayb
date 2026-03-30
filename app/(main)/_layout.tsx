import { useEffect } from 'react';
import { Stack, useRouter } from 'expo-router';
import { useSession } from '../context/SessionContext';

export default function MainLayout() {
    const { session } = useSession();
    const router = useRouter();

    useEffect(() => {
        if (!session) {
            router.replace('/signin');
        }
    }, [session]);

    if (!session) return null;

    return <Stack screenOptions={{ headerShown: false }} />;
}
