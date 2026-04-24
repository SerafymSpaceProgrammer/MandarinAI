import { BarChart3 } from "lucide-react-native";

import { ComingSoon } from "@/components/ComingSoon";

export default function Stats() {
  return (
    <ComingSoon
      Icon={BarChart3}
      title="Stats"
      hint="90-day heatmap, HSK mastery bars, skills radar, and AI-analyzed weak spots."
      phase="Phase 8"
    />
  );
}
