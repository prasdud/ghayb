import { useEffect } from 'react';
import { View, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { BlobBackground } from '../components/BlobBackground';

export default function SplashScreen() {
  const router = useRouter();

  useEffect(() => {
    const timer = setTimeout(() => {
      router.replace('/signin');
    }, 2500);
    return () => clearTimeout(timer);
  }, [router]);

  return (
    <View className="flex-1 items-center justify-center bg-background">
      <BlobBackground />
      <View className="flex items-center justify-center">
        <View className="w-24 h-24 mb-6 rounded-full bg-moss flex items-center justify-center shadow-[0_10px_40px_-10px_rgba(93,112,82,0.4)]">
          <Text className="text-primary-foreground font-serif text-4xl font-bold">g.</Text>
        </View>
        <Text className="font-serif text-5xl font-bold text-foreground tracking-tight">ghayb</Text>
        <Text className="font-sans text-muted-foreground text-lg mt-2">unseen connection</Text>
      </View>
    </View>
  );
}
