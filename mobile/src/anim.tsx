import React from "react";
import { useEffect } from "react";
import { View, Text, StyleSheet, Animated } from "react-native";
import { Easing } from "react-native";

export function FadeIn({ children, delay = 0, style }: { children: React.ReactNode; delay?: number; style?: any }) {
  const opacity = React.useRef(new Animated.Value(0)).current;
  const y = React.useRef(new Animated.Value(18)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 420, delay, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(y, { toValue: 0, duration: 420, delay, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, []);
  return <Animated.View style={[{ opacity, transform: [{ translateY: y }] }, style]}>{children}</Animated.View>;
}

export function ScaleIn({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const scale = React.useRef(new Animated.Value(0.92)).current;
  const opacity = React.useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, delay, useNativeDriver: true, friction: 7, tension: 60 }),
      Animated.timing(opacity, { toValue: 1, duration: 320, delay, useNativeDriver: true }),
    ]).start();
  }, []);
  return <Animated.View style={{ opacity, transform: [{ scale }] }}>{children}</Animated.View>;
}

export function Pulse({ children }: { children: React.ReactNode }) {
  const scale = React.useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.08, duration: 900, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1, duration: 900, useNativeDriver: true }),
      ]),
    ).start();
  }, []);
  return <Animated.View style={{ transform: [{ scale }] }}>{children}</Animated.View>;
}

export function ShimmerBar({ width = "100%", height = 12 }: { width?: any; height?: number }) {
  const x = React.useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(Animated.timing(x, { toValue: 1, duration: 1400, useNativeDriver: true })).start();
  }, []);
  const translate = x.interpolate({ inputRange: [0, 1], outputRange: [-120, 240] });
  return (
    <View style={{ width, height, borderRadius: 6, backgroundColor: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
      <Animated.View style={{ position: "absolute", top: 0, bottom: 0, width: 120, transform: [{ translateX: translate }], backgroundColor: "rgba(255,255,255,0.18)" }} />
    </View>
  );
}