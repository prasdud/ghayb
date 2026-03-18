import React from 'react';
import { TextInput, TextInputProps } from 'react-native';

interface InputProps extends TextInputProps { }

export function Input({ className = '', ...props }: InputProps) {
    return (
        <TextInput
            className={`h-12 rounded-full border border-timber bg-white/50 px-5 font-sans text-sm text-foreground mb-4 w-full focus:border-moss/30 ${className}`}
            placeholderTextColor="#78786C"
            {...props}
        />
    );
}
