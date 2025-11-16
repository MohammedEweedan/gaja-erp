import createCache from '@emotion/cache';

export default function createEmotionCacheLTR() {
  return createCache({
    key: 'mui-ltr',
    prepend: true, // put MUI styles first
    // NOTE: no RTL stylis plugin here; nothing will be flipped
  });
}
