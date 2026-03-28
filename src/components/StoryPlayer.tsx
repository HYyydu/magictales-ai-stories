import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Play, Sparkles, Loader2 } from "lucide-react";
import CharacterPanel from "@/components/CharacterPanel";
import VoiceModeSelector from "@/components/VoiceModeSelector";
import InteractivePlayer from "@/components/InteractivePlayer";
import type { ProcessedStory, VoiceMode } from "@/types/story";

interface StoryPlayerProps {
  story: ProcessedStory;
}

const StoryPlayer = ({ story }: StoryPlayerProps) => {
  const [started, setStarted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [voiceMode, setVoiceMode] = useState<VoiceMode>("ai");
  const [voiceSample, setVoiceSample] = useState<string | null>(null);

  const handleStart = () => {
    setIsLoading(true);
    // Brief loading state before starting playback
    setTimeout(() => {
      setIsLoading(false);
      setStarted(true);
    }, 2500);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="text-center space-y-6 animate-fade-up">
          <div className="w-20 h-20 mx-auto rounded-full flex items-center justify-center" style={{ background: "var(--gradient-magic)" }}>
            <Sparkles className="w-10 h-10 text-primary-foreground animate-sparkle" />
          </div>
          <div>
            <h2 className="font-display font-extrabold text-2xl text-foreground mb-2">
              Creating Your Audiobook...
            </h2>
            <p className="font-body text-muted-foreground">
              AI is extracting characters, emotions, and building your story ✨
            </p>
          </div>
          <Loader2 className="w-8 h-8 mx-auto text-primary animate-spin" />
        </div>
      </div>
    );
  }

  if (started) {
    return (
      <InteractivePlayer
        story={story}
        voiceMode={voiceMode}
        voiceSample={voiceSample}
        onStop={() => setStarted(false)}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Voice Mode Selector */}
      <VoiceModeSelector
        voiceMode={voiceMode}
        onModeChange={setVoiceMode}
        voiceSample={voiceSample}
        onVoiceSampleChange={setVoiceSample}
      />

      {/* Character Panel */}
      <div className="bg-card rounded-2xl border border-border p-6 shadow-sm">
        <CharacterPanel
          characters={story.characters}
          activeCharacter={undefined}
        />
      </div>

      {/* Start To Play */}
      <Button
        variant="magic"
        size="lg"
        className="w-full text-lg py-6"
        onClick={handleStart}
      >
        <Play className="w-5 h-5" />
        Start To Play
      </Button>
    </div>
  );
};

export default StoryPlayer;
