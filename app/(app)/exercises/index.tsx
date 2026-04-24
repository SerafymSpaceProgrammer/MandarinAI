import { Redirect } from "expo-router";

/**
 * /exercises has no hub — the Learn tab surfaces the exercise tiles, and
 * users land on /exercises/<type> directly. Redirect back to Learn if they
 * somehow reach the bare /exercises path.
 */
export default function ExercisesIndex() {
  return <Redirect href="/(app)/learn" />;
}
