import { useState, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Play, Pause, Square, SkipForward, SkipBack, Mic, MicOff } from "lucide-react";
import { useSpeechSynthesis } from "@/hooks/useSpeechSynthesis";
import CharacterPanel from "@/components/CharacterPanel";
import VoiceModeSelector from "@/components/VoiceModeSelector";
import type { ProcessedStory, PlayerState, VoiceMode } from "@/types/story";

interface StoryPlayerProps {
  story: ProcessedStory;
}

const StoryPlayer = ({ story }: StoryPlayerProps) => {
  const [playerState, setPlayerState] = useState<PlayerState>("ready");
  const [voiceMode, setVoiceMode] = useState<VoiceMode>("ai");
  const [recordingSegmentIndex, setRecordingSegmentIndex] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [recordedAudios, setRecordedAudios] = useState<Record<number, string>>({});
  const [voiceSample, setVoiceSample] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const speech = useSpeechSynthesis();

  // --- AI Voice handlers ---
  const handlePlay = useCallback(() => {
    if (voiceMode === "record") {
      setPlayerState("playing");
      setRecordingSegmentIndex(0);
      return;
    }
    setPlayerState("playing");
    speech.play(story.segments, story.characters, 0, () => {
      setPlayerState("finished");
    });
  }, [story, speech, voiceMode]);

  const handleResume = useCallback(() => {
    setPlayerState("playing");
    if (voiceMode === "ai") speech.resume();
  }, [speech, voiceMode]);

  const handlePause = useCallback(() => {
    setPlayerState("paused");
    if (voiceMode === "ai") speech.pause();
  }, [speech, voiceMode]);

  const handleStop = useCallback(() => {
    setPlayerState("ready");
    if (voiceMode === "ai") speech.stop();
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    setRecordingSegmentIndex(0);
  }, [speech, voiceMode]);

  const handleSkipForward = useCallback(() => {
    if (voiceMode === "record") {
      const next = Math.min(recordingSegmentIndex + 1, story.segments.length - 1);
      setRecordingSegmentIndex(next);
      if (next >= story.segments.length - 1) setPlayerState("finished");
      return;
    }
    const next = Math.min(speech.currentSegmentIndex + 1, story.segments.length - 1);
    speech.play(story.segments, story.characters, next, () => setPlayerState("finished"));
  }, [speech, story, voiceMode, recordingSegmentIndex]);

  const handleSkipBack = useCallback(() => {
    if (voiceMode === "record") {
      setRecordingSegmentIndex(Math.max(recordingSegmentIndex - 1, 0));
      return;
    }
    const prev = Math.max(speech.currentSegmentIndex - 1, 0);
    speech.play(story.segments, story.characters, prev, () => setPlayerState("finished"));
  }, [speech, story, voiceMode, recordingSegmentIndex]);

  // --- Recording handlers ---
  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        const url = URL.createObjectURL(blob);
        setRecordedAudios((prev) => ({ ...prev, [recordingSegmentIndex]: url }));
        stream.getTracks().forEach((t) => t.stop());

        // Auto-advance to next segment
        if (recordingSegmentIndex < story.segments.length - 1) {
          setRecordingSegmentIndex((i) => i + 1);
        } else {
          setPlayerState("finished");
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch {
      console.error("Mic access denied");
    }
  }, [recordingSegmentIndex, story.segments.length]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  }, []);

  // --- Derived state ---
  const activeIndex = voiceMode === "record" ? recordingSegmentIndex : speech.currentSegmentIndex;
  const progress = story.segments.length > 0
    ? Math.round(((activeIndex + 1) / story.segments.length) * 100)
    : 0;
  const currentSegment = story.segments[activeIndex];
  const isPlaying = playerState === "playing" || playerState === "paused" || playerState === "recording";

  return (
    <div className="space-y-6">
      {/* Now Playing - only visible when actively playing */}
      {playerState !== "ready" && (
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
          {currentSegment && isPlaying && (
            <div className="bg-muted/50 rounded-xl p-4 mb-4 animate-fade-up">
              <p className="text-xs text-muted-foreground font-body mb-1">
                {currentSegment.speaker === "narrator" ? "📖 Narrator" : `${story.characters.find(c => c.name.toLowerCase() === currentSegment.speaker.toLowerCase())?.emoji || "🗣️"} ${currentSegment.speaker}`}
                {" · "}
                <span className="capitalize">{currentSegment.emotion}</span>
              </p>
              <p className="font-body text-foreground text-sm leading-relaxed">
                "{currentSegment.text}"
              </p>

              {/* Record controls for My Voice mode */}
              {voiceMode === "record" && playerState === "playing" && (
                <div className="mt-3 flex items-center gap-2">
                  {isRecording ? (
                    <Button variant="destructive" size="sm" onClick={stopRecording}>
                      <MicOff className="w-4 h-4 mr-1" />
                      Stop Recording
                    </Button>
                  ) : (
                    <Button variant="magic" size="sm" onClick={startRecording}>
                      <Mic className="w-4 h-4 mr-1" />
                      Read Aloud
                    </Button>
                  )}
                  {recordedAudios[activeIndex] && (
                    <audio src={recordedAudios[activeIndex]} controls className="h-8" />
                  )}
                </div>
              )}
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
            <Button variant="outline" size="icon" onClick={handleSkipBack}>
              <SkipBack className="w-4 h-4" />
            </Button>

            {playerState === "finished" ? (
              <Button variant="magic" size="lg" onClick={handlePlay}>
                <Play className="w-5 h-5" />
                Replay
              </Button>
            ) : playerState === "playing" && voiceMode === "ai" ? (
              <Button variant="magic" size="lg" onClick={handlePause}>
                <Pause className="w-5 h-5" />
                Pause
              </Button>
            ) : playerState === "paused" ? (
              <Button variant="magic" size="lg" onClick={handleResume}>
                <Play className="w-5 h-5" />
                Resume
              </Button>
            ) : null}

            <Button variant="outline" size="icon" onClick={handleSkipForward}>
              <SkipForward className="w-4 h-4" />
            </Button>

            <Button variant="destructive" size="icon" onClick={handleStop}>
              <Square className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Voice Mode Selector (shown before playing) */}
      {playerState === "ready" && (
        <VoiceModeSelector voiceMode={voiceMode} onModeChange={setVoiceMode} voiceSample={voiceSample} onVoiceSampleChange={setVoiceSample} />
      )}

      {/* Character Panel */}
      <div className="bg-card rounded-2xl border border-border p-6 shadow-sm">
        <CharacterPanel
          characters={story.characters}
          activeCharacter={currentSegment?.speaker}
        />
      </div>

      {/* Start To Play button (shown in ready state) */}
      {playerState === "ready" && (
        <Button variant="magic" size="lg" className="w-full text-lg py-6" onClick={handlePlay}>
          <Play className="w-5 h-5" />
          Start To Play
        </Button>
      )}

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
