import React, { useCallback, useRef, useState } from "react";
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from "react-native";

import { colors } from "@/lib/theme";

const PEEK = 28;
const GAP = 10;

export type SwipeSlide = {
  key: string;
  /** Short label under/near dots, e.g. Identity */
  label: string;
  content: React.ReactNode;
};

/**
 * Horizontal paging with peek of the next slide + large tappable dots.
 * Tuned for iPhone Safari (CSS scroll-snap on web; pagingEnabled on native).
 */
export function SwipePager({
  slides,
  accessibilityPrefix = "Slide",
  minHeight = 96,
}: {
  slides: SwipeSlide[];
  accessibilityPrefix?: string;
  minHeight?: number;
}) {
  const [page, setPage] = useState(0);
  const [trackW, setTrackW] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const n = slides.length;
  const slideW = trackW > 0 ? Math.max(200, trackW - PEEK) : 0;
  const stride = slideW + GAP;

  const onLayout = (e: LayoutChangeEvent) => {
    const w = Math.round(e.nativeEvent.layout.width);
    if (w > 0 && w !== trackW) setTrackW(w);
  };

  const syncPage = useCallback(
    (x: number) => {
      if (stride <= 0) return;
      const next = Math.max(0, Math.min(n - 1, Math.round(x / stride)));
      setPage((p) => (p === next ? p : next));
    },
    [n, stride],
  );

  const goTo = (i: number) => {
    const idx = Math.max(0, Math.min(n - 1, i));
    setPage(idx);
    scrollRef.current?.scrollTo({ x: idx * stride, animated: true });
  };

  const webSnapStyle =
    Platform.OS === "web"
      ? ({
          scrollSnapType: "x mandatory",
          WebkitOverflowScrolling: "touch",
          overflowX: "auto",
        } as any)
      : undefined;

  const webSlideSnap =
    Platform.OS === "web"
      ? ({
          scrollSnapAlign: "start",
          scrollSnapStop: "always",
        } as any)
      : undefined;

  return (
    <View>
      <View onLayout={onLayout} style={[styles.track, { minHeight }]}>
        {slideW > 0 ? (
          <ScrollView
            ref={scrollRef}
            horizontal
            nestedScrollEnabled
            decelerationRate="fast"
            snapToInterval={Platform.OS === "web" ? undefined : stride}
            snapToAlignment="start"
            disableIntervalMomentum
            pagingEnabled={false}
            showsHorizontalScrollIndicator={false}
            style={[{ width: trackW }, webSnapStyle]}
            contentContainerStyle={{ paddingRight: PEEK }}
            onMomentumScrollEnd={(e: NativeSyntheticEvent<NativeScrollEvent>) => {
              syncPage(e.nativeEvent.contentOffset.x);
            }}
            onScrollEndDrag={(e: NativeSyntheticEvent<NativeScrollEvent>) => {
              syncPage(e.nativeEvent.contentOffset.x);
            }}
            onScroll={(e: NativeSyntheticEvent<NativeScrollEvent>) => {
              if (Platform.OS === "web") syncPage(e.nativeEvent.contentOffset.x);
            }}
            scrollEventThrottle={16}
          >
            {slides.map((s, i) => (
              <View
                key={s.key}
                style={[
                  styles.slide,
                  { width: slideW, marginRight: i === n - 1 ? 0 : GAP, minHeight },
                  webSlideSnap,
                ]}
              >
                {s.content}
              </View>
            ))}
          </ScrollView>
        ) : (
          <View style={{ minHeight }}>
            {slides[0]?.content}
          </View>
        )}
      </View>

      <View style={styles.footer} accessibilityRole="tablist">
        <Text style={styles.pageLabel} accessibilityLiveRegion="polite">
          {slides[page]?.label || ""} · {page + 1}/{n}
        </Text>
        <View style={styles.dotsRow}>
          {slides.map((s, i) => (
            <Pressable
              key={s.key}
              onPress={() => goTo(i)}
              hitSlop={10}
              accessibilityRole="tab"
              accessibilityState={{ selected: page === i }}
              accessibilityLabel={`${accessibilityPrefix}: ${s.label}, ${i + 1} of ${n}`}
              style={styles.dotHit}
            >
              <View style={[styles.dot, page === i && styles.dotActive]} />
            </Pressable>
          ))}
        </View>
      </View>
    </View>
  );
}

/** One-line horizontally scrollable action strip (no wrap / no clip). */
export function ActionStrip({ children }: { children: React.ReactNode }) {
  const webStyle =
    Platform.OS === "web"
      ? ({ WebkitOverflowScrolling: "touch", overflowX: "auto" } as any)
      : undefined;
  return (
    <ScrollView
      horizontal
      nestedScrollEnabled
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.stripContent}
      style={[styles.strip, webStyle]}
    >
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  track: {
    width: "100%",
    overflow: "hidden",
  },
  slide: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    backgroundColor: colors.bg,
    padding: 14,
    justifyContent: "center",
  },
  footer: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  pageLabel: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.1,
    color: colors.muted,
    textTransform: "uppercase",
    flexShrink: 1,
  },
  dotsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  dotHit: {
    minWidth: 36,
    minHeight: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.line,
  },
  dotActive: {
    width: 22,
    backgroundColor: colors.gold,
  },
  strip: {
    maxWidth: "100%",
    flexGrow: 1,
    flexShrink: 1,
  },
  stripContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 2,
    paddingRight: 8,
  },
});
