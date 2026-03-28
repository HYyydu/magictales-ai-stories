import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Play, Pause, Square, SkipForward, SkipBack, Mic, MessageCircle, Loader2, Send } from "lucide-react";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useSpeechSynthesis } from "@/hooks/useSpeechSynthesis";
import CharacterPanel from "@/components/CharacterPanel";
import type { ProcessedStory, PlayerState } from "@/types/story";

interface StoryPlayerProps {
  story: ProcessedStory;
}

const StoryPlayer = ({ story }: StoryPlayerProps) => {
  const [playerState, setPlayerState] = useState<PlayerState>("ready");
  const [qaQuestion, setQaQuestion] = useState("");
  const [qaAnswer, setQaAnswer] = useState("");
  const [qaLoading, setQaLoading] = useState(false);
  const speech = useSpeechSynthesis();

  const handlePlay = useCallback(() => {
    setPlayerState("playing");
    setQaAnswer("");
    speech.play(story.segments, story.characters, 0, () => {
      setPlayerState("finished");
    });
  }, [story, speech]);

  const handleResume = useCallback(() => {
    setPlayerState("playing");
    speech.resume();
  }, [speech]);

  const handlePause = useCallback(() => {
    setPlayerState("paused");
    speech.pause();
  }, [speech]);

  const handleStop = useCallback(() => {
    setPlayerState("ready");
    speech.stop();
    setQaAnswer("");
  }, [speech]);

  const handleSkipForward = useCallback(() => {
    const next = Math.min(speech.currentSegmentIndex + 1, story.segments.length - 1);
    speech.play(story.segments, story.characters, next, () => {
      setPlayerState("finished");
    });
  }, [speech, story]);

  const handleSkipBack = useCallback(() => {
    const prev = Math.max(speech.currentSegmentIndex - 1, 0);
    speech.play(story.segments, story.characters, prev, () => {
      setPlayerState("finished");
    });
  }, [speech, story]);

  const handleAskQuestion = useCallback(async () => {
    if (!qaQuestion.trim()) return;

    // Pause story
    speech.pause();
    setPlayerState("asking");
    setQaLoading(true);

    try {
      const currentSegment = story.segments[speech.currentSegmentIndex]?.text || "";
      const storyContext = `"${story.title}" - ${story.summary}`;

      const { data, error } = await supabase.functions.invoke("story-qa", {
        body: { question: qaQuestion, storyContext, currentSegment },
      });

      if (error) throw error;
      setQaAnswer(data.answer);
    } catch (e) {
      console.error("Q&A error:", e);
      setQaAnswer("Oops! I couldn't answer that right now. Let's keep listening to the story! 📖");
    } finally {
      setQaLoading(false);
      setQaQuestion("");
    }
  }, [qaQuestion, story, speech]);

  const handleDismissAnswer = useCallback(() => {
    setQaAnswer("");
    setPlayerState("playing");
    speech.resume();
  }, [speech]);

  const progress = story.segments.length > 0
    ? Math.round(((speech.currentSegmentIndex + 1) / story.segments.length) * 100)
    : 0;

  const currentSegment = story.segments[speech.currentSegmentIndex];

  return (
    <div className="space-y-6">
      {/* Now Playing */}
      <div className="bg-card rounded-2xl border border-border p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display font-extrabold text-xl text-foreground">
            🎧 {story.title}
          </h2>
          <span className="text-sm text-muted-foreground font-body">
            {story.segments.length} segments
          </span>
        </div>

        {/* Current segment display */}
        {currentSegment && (playerState === "playing" || playerState === "paused" || playerState === "asking") && (
          <div className="bg-muted/50 rounded-xl p-4 mb-4 animate-fade-up">
            <p className="text-xs text-muted-foreground font-body mb-1">
              {currentSegment.speaker === "narrator" ? "📖 Narrator" : `${story.characters.find(c => c.name.toLowerCase() === currentSegment.speaker.toLowerCase())?.emoji || "🗣️"} ${currentSegment.speaker}`}
              {" · "}
              <span className="capitalize">{currentSegment.emotion}</span>
            </p>
            <p className="font-body text-foreground text-sm leading-relaxed">
              "{currentSegment.text}"
            </p>
          </div>
        )}

        {/* Progress bar */}
        <div className="w-full bg-muted rounded-full h-2 mb-4">
          <div
            className="h-2 rounded-full transition-all duration-500"
            style={{
              width: `${progress}%`,
              background: "var(--gradient-magic)",
            }}
          />
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center gap-3">
          <Button
            variant="outline"
            size="icon"
            onClick={handleSkipBack}
            disabled={playerState === "idle" || playerState === "processing" || playerState === "ready"}
          >
            <SkipBack className="w-4 h-4" />
          </Button>

          {playerState === "ready" || playerState === "finished" ? (
            <Button variant="magic" size="lg" onClick={handlePlay}>
              <Play className="w-5 h-5" />
              {playerState === "finished" ? "Replay" : "Play Story"}
            </Button>
          ) : playerState === "playing" ? (
            <Button variant="magic" size="lg" onClick={handlePause}>
              <Pause className="w-5 h-5" />
              Pause
            </Button>
          ) : playerState === "paused" || playerState === "asking" ? (
            <Button variant="magic" size="lg" onClick={handleResume}>
              <Play className="w-5 h-5" />
              Resume
            </Button>
          ) : null}

          <Button
            variant="outline"
            size="icon"
            onClick={handleSkipForward}
            disabled={playerState === "idle" || playerState === "processing" || playerState === "ready"}
          >
            <SkipForward className="w-4 h-4" />
          </Button>

          <Button
            variant="destructive"
            size="icon"
            onClick={handleStop}
            disabled={playerState === "idle" || playerState === "processing" || playerState === "ready"}
          >
            <Square className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Voice Mode Selector (shown before playing) */}
      {playerState === "ready" && (
        <VoiceModeSelector voiceMode={voiceMode} onModeChange={setVoiceMode} />
      )}

      {/* Character Panel */}
      <div className="bg-card rounded-2xl border border-border p-6 shadow-sm">
        <CharacterPanel
          characters={story.characters}
          activeCharacter={currentSegment?.speaker}
        />
      </div>

      {/* Story finished: Summary & Learning */}
      {playerState === "finished" && (
        <div className="space-y-4 animate-fade-up">
          <div className="bg-card rounded-2xl border border-accent/30 p-6 shadow-sm">
            <h3 className="font-display font-bold text-lg text-foreground mb-2">
              ✨ Story Summary
            </h3>
            <p className="font-body text-foreground/80">{story.summary}</p>
          </div>

          <div className="bg-card rounded-2xl border border-primary/30 p-6 shadow-sm">
            <h3 className="font-display font-bold text-lg text-foreground mb-3">
              🧠 What You Learned
            </h3>
            <ul className="space-y-2">
              {story.learningInsights.map((insight, i) => (
                <li key={i} className="flex items-start gap-2 font-body text-sm text-foreground/80">
                  <span className="text-primary mt-0.5">✔</span>
                  {insight}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};

export default StoryPlayer;
