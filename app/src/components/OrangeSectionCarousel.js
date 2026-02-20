import React, { useState } from 'react';
import { View, ScrollView, StyleSheet, Dimensions } from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const NUM_PAGES = 2;

export default function OrangeSectionCarousel({ slide1, slide2 }) {
  const [page, setPage] = useState(0);

  const onScroll = (e) => {
    const offsetX = e.nativeEvent.contentOffset.x;
    const index = Math.round(offsetX / SCREEN_WIDTH);
    if (index >= 0 && index < NUM_PAGES) setPage(index);
  };

  return (
    <View style={styles.wrapper}>
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScroll}
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.slide}>{slide1}</View>
        <View style={styles.slide}>{slide2}</View>
      </ScrollView>
      <View style={styles.dots}>
        {[0, 1].map((i) => (
          <View
            key={i}
            style={[styles.dot, i === page && styles.dotActive]}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
    alignItems: 'center',
    marginTop: 5,
  },
  scrollContent: {
    alignItems: 'center',
  },
  slide: {
    width: SCREEN_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dots: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  dotActive: {
    backgroundColor: '#FFFFFF',
    width: 10,
    height: 10,
    borderRadius: 5,
  },
});
