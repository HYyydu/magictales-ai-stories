import { useState, useCallback, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Play, Pause, Square, SkipForward, SkipBack, Mic, MicOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { ProcessedStory, StorySegment } from "@/types/story";
import { useSpeechSynthesis } from "@/hooks/useSpeechSynthesis";

interface InteractivePlayerProps {
  story: ProcessedStory;
  voiceMode: "ai" | "record";
  voiceSample: string | null;
  onStop: () => void;
}

const InteractivePlayer = ({ story, voiceMode, voiceSample, onStop }: InteractivePlayerProps) => {
  const navigate = useNavigate();
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [pulseActive, setPulseActive] = useState(false);

  // Recording mode state
  const [isRecording, setIsRecording] = useState(false);
  const [recordedAudios, setRecordedAudios] = useState<Record<number, string>>({});
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const timerRef = useRef<ReturnType<typeof setInterval>>();
  const speech = useSpeechSynthesis();

  const activeIndex = voiceMode === "record"
    ? speech.currentSegmentIndex < 0 ? 0 : speech.currentSegmentIndex
    : speech.currentSegmentIndex;
  const safeIndex = Math.max(0, activeIndex);
  const totalSegments = story.segments.length;
  const progress = totalSegments > 0 ? Math.round(((safeIndex + 1) / totalSegments) * 100) : 0;
  const currentSegment = story.segments[safeIndex];

  // Estimate total duration (~3s per segment)
  const estimatedTotalSeconds = totalSegments * 3;
  const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  // Timer
  useEffect(() => {
    if (isPlaying && !isPaused) {
      timerRef.current = setInterval(() => setElapsedSeconds((s) => s + 1), 1000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [isPlaying, isPaused]);

  // Pulse animation when speaking
  useEffect(() => {
    setPulseActive(isPlaying && !isPaused);
  }, [isPlaying, isPaused]);

  // Auto-navigate to study card when finished
  useEffect(() => {
    if (isFinished) {
      navigate("/study-card", { state: { story } });
    }
  }, [isFinished, navigate, story]);

  // Auto-start playback
  useEffect(() => {
    if (voiceMode === "ai") {
      setIsPlaying(true);
      speech.play(story.segments, story.characters, 0, () => {
        setIsPlaying(false);
        setIsFinished(true);
      });
    } else {
      setIsPlaying(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePause = useCallback(() => {
    setIsPaused(true);
    if (voiceMode === "ai") speech.pause();
  }, [speech, voiceMode]);

  const handleResume = useCallback(() => {
    setIsPaused(false);
    if (voiceMode === "ai") speech.resume();
  }, [speech, voiceMode]);

  const handleStop = useCallback(() => {
    if (voiceMode === "ai") speech.stop();
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    clearInterval(timerRef.current);
    onStop();
  }, [speech, voiceMode, onStop]);

  const handleSkipForward = useCallback(() => {
    const next = Math.min(safeIndex + 1, totalSegments - 1);
    if (voiceMode === "ai") {
      speech.play(story.segments, story.characters, next, () => {
        setIsPlaying(false);
        setIsFinished(true);
      });
    }
    if (next >= totalSegments - 1) {
      setIsFinished(true);
      setIsPlaying(false);
    }
  }, [safeIndex, totalSegments, voiceMode, speech, story]);

  const handleSkipBack = useCallback(() => {
    const prev = Math.max(safeIndex - 1, 0);
    if (voiceMode === "ai") {
      speech.play(story.segments, story.characters, prev, () => {
        setIsPlaying(false);
        setIsFinished(true);
      });
    }
  }, [safeIndex, voiceMode, speech, story]);

  const handleReplay = useCallback(() => {
    setIsFinished(false);
    setIsPlaying(true);
    setElapsedSeconds(0);
    if (voiceMode === "ai") {
      speech.play(story.segments, story.characters, 0, () => {
        setIsPlaying(false);
        setIsFinished(true);
      });
    }
  }, [voiceMode, speech, story]);

  // Recording handlers
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
        setRecordedAudios((prev) => ({ ...prev, [safeIndex]: url }));
        stream.getTracks().forEach((t) => t.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch {
      console.error("Mic access denied");
    }
  }, [safeIndex]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  }, []);

  // Q&A - interrupt to ask
  const handleAskQuestion = useCallback(async () => {
    if (!question.trim()) return;
    const q = question.trim();
    setQuestion("");
    setQaMessages((prev) => [...prev, { role: "user", text: q }]);
    setIsAskingAI(true);

    // Pause while asking
    if (isPlaying && !isPaused) handlePause();

    try {
      const { data, error } = await supabase.functions.invoke("story-qa", {
        body: {
          question: q,
          storyContext: `Title: ${story.title}. Summary: ${story.summary}`,
          currentSegment: currentSegment?.text || "",
        },
      });
      if (error) throw error;
      setQaMessages((prev) => [...prev, { role: "ai", text: data.answer || "I'm not sure, let's keep reading!" }]);
    } catch (err) {
      console.error("Q&A error:", err);
      setQaMessages((prev) => [...prev, { role: "ai", text: "Oops! I couldn't think of an answer. Try again!" }]);
    } finally {
      setIsAskingAI(false);
    }
  }, [question, story, currentSegment, isPlaying, isPaused, handlePause]);

  return (
    <div className="space-y-6 animate-fade-up">
      {/* Immersive Voice Player */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[hsl(260,50%,15%)] via-[hsl(280,40%,20%)] to-[hsl(230,50%,15%)] p-8 shadow-2xl">
        {/* Glowing orb background */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div
            className={`w-64 h-64 rounded-full transition-all duration-1000 ${
              pulseActive ? "animate-pulse scale-110" : "scale-100"
            }`}
            style={{
              background: "radial-gradient(circle, hsla(280,80%,60%,0.3) 0%, hsla(220,80%,60%,0.15) 50%, transparent 70%)",
              filter: "blur(30px)",
            }}
          />
        </div>

        {/* Content */}
        <div className="relative z-10 flex flex-col items-center text-center">
          {/* Title */}
          <h2 className="font-display font-extrabold text-xl text-white mb-1">
            {story.title}
          </h2>
          <p className="text-sm text-white/50 font-body mb-6">
            {totalSegments} segments
          </p>

          {/* Mic icon with glow ring */}
          <div className="relative mb-6">
            <div
              className={`w-28 h-28 rounded-full flex items-center justify-center transition-all duration-700 ${
                pulseActive ? "shadow-[0_0_60px_hsla(260,80%,60%,0.5)]" : ""
              }`}
              style={{
                background: "radial-gradient(circle, hsla(260,50%,25%,0.8) 0%, hsla(260,50%,15%,0.6) 100%)",
                border: "2px solid hsla(260,60%,60%,0.3)",
              }}
            >
              <Mic className={`w-10 h-10 text-white/90 transition-transform duration-500 ${pulseActive ? "scale-110" : "scale-100"}`} />
            </div>
            {/* Animated ring */}
            {pulseActive && (
              <div className="absolute inset-0 rounded-full animate-ping" style={{
                border: "2px solid hsla(260,60%,60%,0.2)",
                animationDuration: "2s",
              }} />
            )}
          </div>

          {/* Current segment text */}
          {currentSegment && (
            <div className="max-w-md mb-6">
              <p className="text-xs text-white/40 font-body mb-1.5">
                {currentSegment.speaker === "narrator"
                  ? "📖 Narrator"
                  : `${story.characters.find(c => c.name.toLowerCase() === currentSegment.speaker.toLowerCase())?.emoji || "🗣️"} ${currentSegment.speaker}`}
                {" · "}
                <span className="capitalize">{currentSegment.emotion}</span>
              </p>
              <p className="font-body text-white/80 text-sm leading-relaxed italic">
                "{currentSegment.text}"
              </p>
            </div>
          )}

          {/* Record controls for My Voice */}
          {voiceMode === "record" && isPlaying && !isFinished && (
            <div className="flex items-center gap-3 mb-4">
              {isRecording ? (
                <Button variant="destructive" size="sm" onClick={stopRecording} className="bg-red-500/80 hover:bg-red-500">
                  <MicOff className="w-4 h-4 mr-1" />
                  Stop Recording
                </Button>
              ) : (
                <Button size="sm" onClick={startRecording} className="bg-white/10 hover:bg-white/20 text-white border-white/20">
                  <Mic className="w-4 h-4 mr-1" />
                  Read Aloud
                </Button>
              )}
              {recordedAudios[safeIndex] && (
                <audio src={recordedAudios[safeIndex]} controls className="h-8" />
              )}
            </div>
          )}

          {/* Time & Progress */}
          <div className="w-full max-w-sm mb-4">
            <div className="w-full bg-white/10 rounded-full h-1.5 mb-2">
              <div
                className="h-1.5 rounded-full transition-all duration-500"
                style={{
                  width: `${progress}%`,
                  background: "linear-gradient(90deg, hsl(260,60%,60%), hsl(200,80%,55%))",
                }}
              />
            </div>
            <div className="flex justify-between text-xs text-white/40 font-body">
              <span>{formatTime(elapsedSeconds)}</span>
              <span>Segment {safeIndex + 1} / {totalSegments}</span>
              <span>~{formatTime(estimatedTotalSeconds)}</span>
            </div>
          </div>

          {/* Playback controls */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleSkipBack}
              className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
            >
              <SkipBack className="w-4 h-4 text-white/70" />
            </button>

            {isFinished ? (
              <button
                onClick={handleReplay}
                className="w-14 h-14 rounded-full flex items-center justify-center transition-all hover:scale-105"
                style={{ background: "linear-gradient(135deg, hsl(260,60%,55%), hsl(200,80%,55%))" }}
              >
                <Play className="w-6 h-6 text-white ml-0.5" />
              </button>
            ) : isPaused ? (
              <button
                onClick={handleResume}
                className="w-14 h-14 rounded-full flex items-center justify-center transition-all hover:scale-105"
                style={{ background: "linear-gradient(135deg, hsl(260,60%,55%), hsl(200,80%,55%))" }}
              >
                <Play className="w-6 h-6 text-white ml-0.5" />
              </button>
            ) : (
              <button
                onClick={handlePause}
                className="w-14 h-14 rounded-full flex items-center justify-center transition-all hover:scale-105"
                style={{ background: "linear-gradient(135deg, hsl(260,60%,55%), hsl(200,80%,55%))" }}
              >
                <Pause className="w-6 h-6 text-white" />
              </button>
            )}

            <button
              onClick={handleSkipForward}
              className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
            >
              <SkipForward className="w-4 h-4 text-white/70" />
            </button>

            <button
              onClick={handleStop}
              className="w-10 h-10 rounded-full bg-red-500/20 hover:bg-red-500/30 flex items-center justify-center transition-colors"
            >
              <Square className="w-4 h-4 text-red-400" />
            </button>
          </div>

        </div>
      </div>


    </div>
  );
};

export default InteractivePlayer;
