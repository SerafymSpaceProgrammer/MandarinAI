import { GraduationCap } from "lucide-react-native";

import { ComingSoon } from "@/components/ComingSoon";

export default function Learn() {
  return (
    <ComingSoon
      Icon={GraduationCap}
      title="Learn hub"
      hint="Vocabulary trainer, character roadmap, grammar patterns, and drills land here."
      phase="Phase 4 · 5 · 7"
    />
  );
}
