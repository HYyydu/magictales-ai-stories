import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { BookOpen, Sparkles, Loader2, ArrowLeft, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { STORY_LIBRARY } from "@/lib/stories";
import StoryPlayer from "@/components/StoryPlayer";
import type { ProcessedStory } from "@/types/story";
import { Link } from "react-router-dom";

const CreateAudiobook = () => {
  const [storyText, setStoryText] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [processedStory, setProcessedStory] = useState<ProcessedStory | null>(null);
  const [mode, setMode] = useState<"select" | "custom" | "player">("select");
  const { toast } = useToast();

  const processStory = async (text: string) => {
    setIsProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke("process-story", {
        body: { storyText: text },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      setProcessedStory(data as ProcessedStory);
      setMode("player");
    } catch (e: any) {
      console.error("Process error:", e);
      toast({
        variant: "destructive",
        title: "Processing Failed",
        description: e.message || "Could not process the story. Please try again.",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const name = file.name.toLowerCase();
    const type = file.type;

    try {
      let text = "";

      if (type === "text/plain" || name.endsWith(".txt")) {
        text = await file.text();
      } else if (name.endsWith(".epub") || type === "application/epub+zip") {
        const ePub = (await import("epubjs")).default;
        const arrayBuffer = await file.arrayBuffer();
        const book = ePub(arrayBuffer);
        await book.ready;
        const spine = book.spine as any;
        const sections: string[] = [];
        for (const item of spine.items) {
          const doc = await book.load(item.href);
          const body = (doc as Document).querySelector("body");
          if (body) sections.push(body.textContent?.trim() || "");
        }
        text = sections.filter(Boolean).join("\n\n");
        book.destroy();
      } else if (type === "application/pdf" || name.endsWith(".pdf")) {
        text = await file.text();
        toast({
          title: "PDF Note",
          description: "PDF text extraction is basic. For best results, use .txt or .epub files.",
        });
      } else {
        toast({
          variant: "destructive",
          title: "Unsupported File",
          description: "Please upload a .txt, .epub, or .pdf file.",
        });
        return;
      }

      if (!text.trim()) {
        toast({
          variant: "destructive",
          title: "Empty File",
          description: "Could not extract text from this file.",
        });
        return;
      }

      setStoryText(text);
      setMode("custom");
    } catch (err) {
      console.error("File parse error:", err);
      toast({
        variant: "destructive",
        title: "Parse Error",
        description: "Failed to read the file. Try a different format.",
      });
    }
  };

  if (isProcessing) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
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

  if (mode === "player" && processedStory) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8 max-w-3xl">
          <div className="flex items-center gap-3 mb-8">
            <Button variant="outline" size="sm" onClick={() => setMode("select")} asChild>
              <Link to="/create">
                <ArrowLeft className="w-4 h-4" />
                New Story
              </Link>
            </Button>
            <h1 className="font-display font-extrabold text-2xl text-foreground">
              Now Playing
            </h1>
          </div>
          <StoryPlayer story={processedStory} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-3xl">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <Button variant="outline" size="sm" asChild>
            <Link to="/">
              <ArrowLeft className="w-4 h-4" />
              Home
            </Link>
          </Button>
          <h1 className="font-display font-extrabold text-2xl text-foreground">
            Create Audiobook
          </h1>
        </div>

        {mode === "select" && (
          <div className="space-y-8 animate-fade-up">
            {/* Quick Start */}
            <div>
              <h2 className="font-display font-bold text-lg text-foreground mb-4">
                Quick Start — Pick a Story
              </h2>
              <div className="grid gap-3">
                {STORY_LIBRARY.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => processStory(s.text)}
                    className="flex items-center gap-4 p-4 rounded-2xl border border-border bg-card hover:border-primary/50 hover:shadow-md hover:shadow-primary/5 transition-all text-left group"
                  >
                    <span className="text-4xl group-hover:scale-110 transition-transform">
                      {s.emoji}
                    </span>
                    <div>
                      <p className="font-display font-bold text-foreground">{s.title}</p>
                      <p className="font-body text-sm text-muted-foreground">{s.description}</p>
                    </div>
                    <Sparkles className="w-5 h-5 text-primary ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                ))}
              </div>
            </div>

            {/* Divider */}
            <div className="flex items-center gap-4">
              <div className="flex-1 h-px bg-border" />
              <span className="text-sm text-muted-foreground font-body">or</span>
              <div className="flex-1 h-px bg-border" />
            </div>

            {/* Upload */}
            <Button variant="outline" size="lg" className="w-full relative" asChild>
              <label>
                <Upload className="w-5 h-5" />
                Upload
                <input
                  type="file"
                  accept=".txt,.epub,.pdf,text/plain,application/epub+zip,application/pdf"
                  className="absolute inset-0 opacity-0 cursor-pointer"
                  onChange={handleFileUpload}
                />
              </label>
            </Button>
          </div>
        )}

        {mode === "custom" && (
          <div className="space-y-4 animate-fade-up">
            <div className="flex items-center justify-between">
              <h2 className="font-display font-bold text-lg text-foreground">
                ✍️ Paste or Write Your Story
              </h2>
              <Button variant="ghost" size="sm" onClick={() => setMode("select")}>
                ← Back
              </Button>
            </div>
            <Textarea
              value={storyText}
              onChange={(e) => setStoryText(e.target.value)}
              placeholder="Once upon a time..."
              className="min-h-[300px] font-body text-base"
            />
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground font-body">
                {storyText.length} / 20,000 characters
              </p>
              <Button
                variant="magic"
                size="lg"
                onClick={() => processStory(storyText)}
                disabled={storyText.trim().length < 50}
              >
                <Sparkles className="w-5 h-5" />
                Generate Audiobook
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CreateAudiobook;
