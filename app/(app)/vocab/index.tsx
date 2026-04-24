import { Redirect } from "expo-router";

/**
 * /vocab has no hub screen of its own; browse is the most useful landing.
 * This file exists so expo-router can register the "vocab" route group
 * when the Tabs layout lists it with `href: null`.
 */
export default function VocabIndex() {
  return <Redirect href="/(app)/vocab/browse" />;
}
