import { FlatList, ScrollView, SectionList } from "react-native";

/**
 * Hide native scroll indicators app-wide.
 *
 * Android's stock scrollbar overlays the right edge of content — so a line
 * of pinyin or a chip's text can be partially eclipsed by the thumb while
 * scrolling, which looks broken. Hiding the indicators yields a cleaner
 * Material 3-style scroll feel that matches the brand surface elsewhere.
 *
 * We patch the React component classes themselves once at app boot so we
 * don't have to remember `showsVerticalScrollIndicator={false}` on every
 * single ScrollView / FlatList in the tree (~80 occurrences across screens).
 */
type WithDefaults<T> = T & { defaultProps?: Record<string, unknown> };

function patch(component: WithDefaults<unknown>): void {
  component.defaultProps = {
    ...(component.defaultProps ?? {}),
    showsVerticalScrollIndicator: false,
    showsHorizontalScrollIndicator: false,
  };
}

export function applyScrollDefaults(): void {
  patch(ScrollView as WithDefaults<typeof ScrollView>);
  patch(FlatList as WithDefaults<typeof FlatList>);
  patch(SectionList as WithDefaults<typeof SectionList>);
}
