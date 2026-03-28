import kidListening from "@/assets/kid-listening.png";

const StoryMagicSection = () => {
  return (
    <section className="py-20 bg-background">
      <div className="container mx-auto px-4 max-w-6xl">
        <div className="flex flex-col md:flex-row items-center gap-12">
          {/* Text */}
          <div className="flex-1 space-y-4">
            <p className="font-body font-semibold text-primary text-sm uppercase tracking-wide">
              Listen, learn, imagine
            </p>
            <h2 className="font-display font-extrabold text-3xl sm:text-4xl md:text-5xl text-foreground leading-tight">
              Create stories with AI magic
            </h2>
            <p className="font-body text-lg text-muted-foreground leading-relaxed max-w-lg">
              With MagicTales, turn any story into a rich audio experience with
              voices, emotions, &amp; sound effects, and parents' narration — all
              generated instantly.
            </p>
          </div>

          {/* Image */}
          <div className="flex-1">
            <img
              src={kidListening}
              alt="Child listening to an audiobook on a tablet"
              className="w-full rounded-2xl shadow-lg object-cover"
              width={640}
              height={427}
            />
          </div>
        </div>
      </div>
    </section>
  );
};

export default StoryMagicSection;
