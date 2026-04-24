import { Mic } from "lucide-react-native";

import { ComingSoon } from "@/components/ComingSoon";

export default function Practice() {
  return (
    <ComingSoon
      Icon={Mic}
      title="Practice hub"
      hint="Speaking scenarios, listening, reading, and writing — all in one place."
      phase="Phase 6"
    />
  );
}
