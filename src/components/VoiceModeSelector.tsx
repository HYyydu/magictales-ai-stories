import { useState, useCallback, useRef } from "react";
import { Mic, MicOff, Sparkles, Upload, Trash2, Play, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { VoiceMode } from "@/types/story";

interface VoiceModeSelectorProps {
  voiceMode: VoiceMode;
  onModeChange: (mode: VoiceMode) => void;
  voiceSample: string | null;
  onVoiceSampleChange: (sample: string | null) => void;
}

const VoiceModeSelector = ({ voiceMode, onModeChange, voiceSample, onVoiceSampleChange }: VoiceModeSelectorProps) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
        onVoiceSampleChange(url);
        stream.getTracks().forEach((t) => t.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch {
      console.error("Mic access denied");
    }
  }, [onVoiceSampleChange]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  }, []);

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    onVoiceSampleChange(url);
  }, [onVoiceSampleChange]);

  const handlePlaySample = useCallback(() => {
    if (!voiceSample) return;
    if (isPlaying && audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setIsPlaying(false);
      return;
    }
    const audio = new Audio(voiceSample);
    audioRef.current = audio;
    audio.onended = () => setIsPlaying(false);
    audio.play();
    setIsPlaying(true);
  }, [voiceSample, isPlaying]);

  const handleRemoveSample = useCallback(() => {
    onVoiceSampleChange(null);
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
    }
  }, [onVoiceSampleChange]);

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
            <p className="text-xs text-muted-foreground">Clone your voice for narration</p>
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

      {/* Voice Sample Section - shown when My Voice is selected */}
      {voiceMode === "record" && (
        <div className="mt-4 p-4 rounded-xl border border-border bg-muted/30 space-y-3 animate-fade-up">
          <p className="font-display font-bold text-sm text-foreground">
            1 · VOICE SAMPLE
          </p>

          {voiceSample ? (
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handlePlaySample}>
                {isPlaying ? <Square className="w-4 h-4 mr-1" /> : <Play className="w-4 h-4 mr-1" />}
                {isPlaying ? "Stop" : "Preview"}
              </Button>
              <span className="text-xs text-muted-foreground font-body flex-1">
                ✅ Voice sample ready
              </span>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleRemoveSample}>
                <Trash2 className="w-4 h-4 text-destructive" />
              </Button>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              <Button
                variant="default"
                size="sm"
                className="relative"
                asChild
              >
                <label>
                  <Upload className="w-4 h-4 mr-1" />
                  Upload recording
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="audio/*"
                    className="absolute inset-0 opacity-0 cursor-pointer"
                    onChange={handleFileUpload}
                  />
                </label>
              </Button>

              {isRecording ? (
                <Button variant="destructive" size="sm" onClick={stopRecording}>
                  <MicOff className="w-4 h-4 mr-1" />
                  Stop Recording
                </Button>
              ) : (
                <Button variant="outline" size="sm" onClick={startRecording}>
                  <Mic className="w-4 h-4 mr-1" />
                  Record from mic
                </Button>
              )}
            </div>
          )}

          <p className="text-xs text-muted-foreground font-body">
            For best results, use 1+ minutes of clean speech (WAV/MP3 ideal). Short clips may work but quality varies.
          </p>
        </div>
      )}
    </div>
  );
};

export default VoiceModeSelector;
