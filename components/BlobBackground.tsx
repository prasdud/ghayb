import React from 'react';
import { View } from 'react-native';

export function BlobBackground() {
    return (
        <View className="absolute inset-0 overflow-hidden" pointerEvents="none">
            <View
                className="absolute w-[400px] h-[400px] bg-moss/20 rounded-[60%_40%_30%_70%/60%_30%_70%_40%] -top-20 -left-20"
                style={{ transform: [{ rotate: '15deg' }] }}
            />
            <View
                className="absolute w-[500px] h-[500px] bg-clay/15 rounded-[40%_60%_70%_30%/50%_40%_60%_50%] top-60 -right-40"
            />
            <View className="absolute inset-0 bg-[#000000] opacity-[0.03]" />
        </View>
    );
}
