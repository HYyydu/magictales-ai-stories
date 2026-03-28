import { Mic, Sparkles } from "lucide-react";
import type { VoiceMode } from "@/types/story";

interface VoiceModeSelectorProps {
  voiceMode: VoiceMode;
  onModeChange: (mode: VoiceMode) => void;
}

const VoiceModeSelector = ({ voiceMode, onModeChange }: VoiceModeSelectorProps) => {
  return (
    <div className="bg-card rounded-2xl border border-border p-6 shadow-sm">
      <h3 className="font-display font-bold text-lg text-foreground mb-3">
        🎙️ Choose Narrator Voice
      </h3>
      <p className="text-sm text-muted-foreground font-body mb-4">
        How would you like the story to be narrated?
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <button
          onClick={() => onModeChange("record")}
          className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all text-left ${
            voiceMode === "record"
              ? "border-primary bg-primary/10 shadow-md shadow-primary/10"
              : "border-border bg-card hover:border-primary/30"
          }`}
        >
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <Mic className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="font-display font-bold text-sm text-foreground">My Voice</p>
            <p className="text-xs text-muted-foreground">Read aloud into the mic</p>
          </div>
        </button>

        <button
          onClick={() => onModeChange("ai")}
          className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all text-left ${
            voiceMode === "ai"
              ? "border-primary bg-primary/10 shadow-md shadow-primary/10"
              : "border-border bg-card hover:border-primary/30"
          }`}
        >
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <Sparkles className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="font-display font-bold text-sm text-foreground">AI Voice</p>
            <p className="text-xs text-muted-foreground">AI reads the story for you</p>
          </div>
        </button>
      </div>
    </div>
  );
};

export default VoiceModeSelector;
