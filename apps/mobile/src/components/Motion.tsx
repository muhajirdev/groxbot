import { Children, type ReactNode, useEffect, useRef } from "react";
import {
  Animated,
  Easing,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { useReduceMotion } from "../lib/reduce-motion";

const ENTER = {
  damping: 14,
  stiffness: 200,
  mass: 0.8,
} as const;

/** Swift `Motion.appear` — response 0.58, damping 0.88. */
const APPEAR = {
  damping: 20,
  stiffness: 118,
  mass: 1,
} as const;

/** Squash in, overshoot past 1 on release. */
const PRESS = {
  damping: 11,
  stiffness: 360,
  mass: 0.48,
} as const;

const POP = {
  damping: 9,
  stiffness: 200,
  mass: 0.7,
} as const;

function springTo(
  value: Animated.Value,
  toValue: number,
  config: { damping: number; stiffness: number; mass: number },
  delay = 0,
) {
  return Animated.sequence([
    Animated.delay(delay),
    Animated.spring(value, {
      toValue,
      ...config,
      useNativeDriver: true,
    }),
  ]);
}

export function FadeUp({
  children,
  delay = 0,
  distance = 14,
  style,
}: {
  children: ReactNode;
  delay?: number;
  distance?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const reduce = useReduceMotion();
  const progress = useRef(new Animated.Value(reduce ? 1 : 0)).current;

  useEffect(() => {
    if (reduce) {
      progress.setValue(1);
      return;
    }
    progress.setValue(0);
    const anim = springTo(progress, 1, ENTER, delay);
    anim.start();
    return () => anim.stop();
  }, [delay, progress, reduce]);

  return (
    <Animated.View
      style={[
        style,
        {
          opacity: progress,
          transform: [
            {
              translateY: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [distance, 0],
              }),
            },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

export function FadeUpStack({
  children,
  step = 55,
}: {
  children: ReactNode;
  step?: number;
}) {
  return (
    <>
      {Children.toArray(children).map((child, index) => (
        <FadeUp key={index} delay={index * step}>
          {child}
        </FadeUp>
      ))}
    </>
  );
}

export function PopIn({
  children,
  delay = 80,
}: {
  children: ReactNode;
  delay?: number;
}) {
  const reduce = useReduceMotion();
  const scale = useRef(new Animated.Value(reduce ? 1 : 0.78)).current;
  const opacity = useRef(new Animated.Value(reduce ? 1 : 0)).current;

  useEffect(() => {
    if (reduce) {
      scale.setValue(1);
      opacity.setValue(1);
      return;
    }
    scale.setValue(0.78);
    opacity.setValue(0);
    const anim = Animated.parallel([
      springTo(scale, 1, POP, delay),
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 160,
          useNativeDriver: true,
        }),
      ]),
    ]);
    anim.start();
    return () => anim.stop();
  }, [delay, opacity, reduce, scale]);

  return (
    <Animated.View style={{ opacity, transform: [{ scale }] }}>
      {children}
    </Animated.View>
  );
}

export function Float({ children }: { children: ReactNode }) {
  const reduce = useReduceMotion();
  const lift = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reduce) {
      lift.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(lift, {
          toValue: -5,
          duration: 2400,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(lift, {
          toValue: 0,
          duration: 2400,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [lift, reduce]);

  return (
    <Animated.View style={{ transform: [{ translateY: lift }] }}>
      {children}
    </Animated.View>
  );
}

export function Shake({
  trigger,
  children,
}: {
  trigger: string;
  children: ReactNode;
}) {
  const reduce = useReduceMotion();
  const x = useRef(new Animated.Value(0)).current;
  const seen = useRef(true);

  useEffect(() => {
    if (seen.current) {
      seen.current = false;
      return;
    }
    if (!trigger || reduce) return;
    x.setValue(0);
    const anim = Animated.sequence([
      Animated.timing(x, { toValue: 7, duration: 36, useNativeDriver: true }),
      Animated.timing(x, { toValue: -7, duration: 36, useNativeDriver: true }),
      Animated.timing(x, { toValue: 5, duration: 32, useNativeDriver: true }),
      Animated.timing(x, { toValue: -4, duration: 32, useNativeDriver: true }),
      Animated.timing(x, { toValue: 0, duration: 40, useNativeDriver: true }),
    ]);
    anim.start();
    return () => anim.stop();
  }, [reduce, trigger, x]);

  return (
    <Animated.View style={{ transform: [{ translateX: x }] }}>
      {children}
    </Animated.View>
  );
}

export function Appear({
  children,
  delay = 0,
  distance = 16,
  style,
}: {
  children: ReactNode;
  delay?: number;
  distance?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const reduce = useReduceMotion();
  const progress = useRef(new Animated.Value(reduce ? 1 : 0)).current;

  useEffect(() => {
    if (reduce) {
      progress.setValue(1);
      return;
    }
    progress.setValue(0);
    const anim = springTo(progress, 1, APPEAR, delay);
    anim.start();
    return () => anim.stop();
  }, [delay, progress, reduce]);

  return (
    <Animated.View
      style={[
        style,
        {
          opacity: progress,
          transform: [
            {
              translateY: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [distance, 0],
              }),
            },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

export function Breathe({ children }: { children: ReactNode }) {
  const reduce = useReduceMotion();
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reduce) {
      pulse.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 2200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 2200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse, reduce]);

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        ...StyleSheet.absoluteFill,
        transform: [
          {
            scale: pulse.interpolate({
              inputRange: [0, 1],
              outputRange: [0.94, 1.06],
            }),
          },
        ],
      }}
    >
      {children}
    </Animated.View>
  );
}

export function usePressScale(squash = 0.92) {
  const reduce = useReduceMotion();
  const scale = useRef(new Animated.Value(1)).current;

  function to(value: number) {
    if (reduce) {
      scale.setValue(1);
      return;
    }
    Animated.spring(scale, {
      toValue: value,
      ...PRESS,
      useNativeDriver: true,
    }).start();
  }

  return {
    style: { transform: [{ scale }] as const },
    onPressIn: () => to(squash),
    onPressOut: () => to(1),
  };
}
