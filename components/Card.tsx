import React from 'react';
import { View, ViewProps } from 'react-native';

interface CardProps extends ViewProps { }

export function Card({ className = '', children, ...props }: CardProps) {
    return (
        <View
            className={`rounded-[2rem] bg-[#FEFEFA] border border-timber/50 shadow-[0_4px_20px_-2px_rgba(93,112,82,0.15)] p-6 overflow-hidden ${className}`}
            {...props}
        >
            {/* Noise Texture layer can be simulated via a dark semi-transparent view or image if needed. For now, we rely on the bg color */}
            <View className="absolute inset-0 bg-[#000000] opacity-[0.03]" pointerEvents="none" />
            {children}
        </View>
    );
}
