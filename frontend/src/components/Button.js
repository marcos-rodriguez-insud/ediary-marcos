import React from 'react';
import { TouchableOpacity, Text, StyleSheet, Platform } from 'react-native';

export function Button({ title, onPress, variant = 'primary', disabled = false, style, textStyle }) {
  const buttonStyles = [
    styles.base,
    variant === 'secondary' ? styles.secondary : styles.primary,
    disabled && styles.disabled,
    Platform.OS === 'web' && styles.web,
    style,
  ];
  return (
    <TouchableOpacity onPress={onPress} disabled={disabled} style={buttonStyles}>
      <Text style={[styles.text, variant === 'secondary' && styles.textSecondary, textStyle]}>{title}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primary: {
    backgroundColor: '#1f6feb',
  },
  secondary: {
    backgroundColor: '#f0f1f4',
  },
  disabled: {
    opacity: 0.5,
  },
  text: {
    color: '#ffffff',
    fontWeight: '600',
  },
  textSecondary: {
    color: '#0f172a',
  },
  web: {
    alignSelf: 'flex-start',
    minWidth: 160,
    paddingHorizontal: 20,
    cursor: 'pointer',
  },
});
