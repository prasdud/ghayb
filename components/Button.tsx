import React from 'react';
import { Pressable, Text, PressableProps } from 'react-native';

interface ButtonProps extends PressableProps {
    label: string;
    variant?: 'primary' | 'outline' | 'ghost';
    size?: 'sm' | 'default' | 'lg';
}

export function Button({ label, variant = 'primary', size = 'default', className = '', disabled, ...props }: ButtonProps) {
    let bgClass = '';
    let textClass = '';
    let shadowClass = '';
    let borderClass = '';

    if (variant === 'primary') {
        bgClass = 'bg-moss';
        textClass = 'text-primary-foreground';
        shadowClass = 'shadow-[0_4px_20px_-2px_rgba(93,112,82,0.15)] active:scale-95';
    } else if (variant === 'outline') {
        bgClass = 'bg-transparent';
        textClass = 'text-clay';
        borderClass = 'border-2 border-clay';
        shadowClass = 'active:scale-95';
    } else if (variant === 'ghost') {
        bgClass = 'bg-transparent active:bg-moss/10';
        textClass = 'text-moss';
        shadowClass = 'active:scale-95';
    }

    let sizeClass = 'h-12 px-8';
    if (size === 'sm') sizeClass = 'h-10 px-6';
    if (size === 'lg') sizeClass = 'h-14 px-10';

    return (
        <Pressable
            className={`rounded-full items-center justify-center ${bgClass} ${borderClass} ${shadowClass} ${sizeClass} ${className} ${disabled ? 'opacity-50' : ''}`}
            disabled={disabled}
            {...props}
        >
            <Text className={`${textClass} font-sans font-bold text-base`}>{label}</Text>
        </Pressable>
    );
}
