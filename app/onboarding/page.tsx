"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

type Slide = {
  title: string;
  subtitle: string;
  image: string;
  cta?: boolean;
};

const STORAGE_KEY = "bearfit_onboarded_v1";
const START_PAGE = "/get-started";

export default function OnboardingPage() {
  const slides: Slide[] = useMemo(
    () => [
      { title: "Welcome to BearFitPH", subtitle: "", image: "/onboarding/welcome.jpg" },
      { title: "Better Form", subtitle: "Train smarter with coach-guided movement.", image: "/onboarding/better-form.jpg" },
      { title: "Better Function", subtitle: "Move better in everyday life, not just in the gym.", image: "/onboarding/better-function.jpg" },
      { title: "Better Fitness", subtitle: "Build strength, confidence, and consistency.", image: "/onboarding/better-fitness.jpg" },
      { title: "Free Assessment", subtitle: "Your journey starts here. Let’s get moving.", image: "/onboarding/cta.jpg", cta: true },
    ],
    []
  );

  const [index, setIndex] = useState(0);
  const [faqOpen, setFaqOpen] = useState(false);
  const [ready, setReady] = useState(false);

  // ✅ preview + reset + redirect logic
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    if (params.get("reset") === "1") {
      localStorage.removeItem(STORAGE_KEY);
    }

    if (params.get("preview") === "1") {
      setReady(true);
      return;
    }

    const done = localStorage.getItem(STORAGE_KEY) === "1";
    if (done) {
      window.location.replace(START_PAGE);
      return;
    }

    setReady(true);
  }, []);

  const isLast = index === slides.length - 1;
  const goTo = (i: number) =>
    setIndex(Math.max(0, Math.min(slides.length - 1, i)));
  const next = () => !isLast && goTo(index + 1);
  const prev = () => index > 0 && goTo(index - 1);
  const skip = () => goTo(slides.length - 1);

  const completeOnboarding = () => {
    localStorage.setItem(STORAGE_KEY, "1");
    window.location.href = START_PAGE;
  };

  // Swipe (disabled while FAQ open)
  const startX = useRef<number | null>(null);
  const onTouchStart = (e: React.TouchEvent) => {
    if (faqOpen) return;
    startX.current = e.touches[0].clientX;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (faqOpen || startX.current === null) return;
    const diff = e.changedTouches[0].clientX - startX.current;
    startX.current = null;
    if (diff < -50) next();
    if (diff > 50) prev();
  };

  if (!ready) return null;

  return (
    <div
      className="fixed inset-0 bg-black flex justify-center items-center"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <style>{`
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(14px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .fade-slide { animation: fadeSlideUp .5s ease-out; }
      `}</style>

      <div className="relative w-full h-full bg-black overflow-hidden md:max-w-[430px] md:mx-auto md:rounded-2xl">
        {/* SLIDER */}
        <div
          className="flex h-full transition-transform duration-500 ease-out"
          style={{ transform: `translateX(-${index * 100}%)` }}
        >
          {slides.map((slide, i) => (
            <div key={i} className="relative w-full h-full flex-shrink-0">
              <Image src={slide.image} alt={slide.title} fill className="object-cover" priority={i === 0} />
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-black/10" />

              <div className="absolute inset-x-0 bottom-24 px-6 text-center text-white">
                <div key={index} className="fade-slide">
                  <h1 className="text-3xl font-bold mb-1">{slide.title}</h1>

                  {/* Welcome slide */}
                  {i === 0 && (
                    <>
                      <p className="font-bold italic mb-2">
                        Better Form | Better Function | Better Fitness
                      </p>
                      <p className="text-white/85 mb-2">
                        No guesswork — just coach-guided, science-based results.
                      </p>
                      <p className="text-white/85">
                        Book your free{" "}
                        <button
                          onClick={() => goTo(slides.length - 1)}
                          className="underline font-semibold"
                        >
                          assessment
                        </button>
                        .
                      </p>
                    </>
                  )}

                  {/* Middle slides */}
                  {i !== 0 && !slide.cta && (
                    <p className="text-white/85">{slide.subtitle}</p>
                  )}

                  {/* CTA slide */}
                  {slide.cta && (
                    <>
                      <p className="text-white/85">{slide.subtitle}</p>

                      <button
                        onClick={() => setFaqOpen(true)}
                        className="mt-3 text-sm underline text-white/80"
                        type="button"
                      >
                        No guesswork, just gains. Get the facts here.
                      </button>

                      <button
                        onClick={completeOnboarding}
                        className="block mt-6 w-full rounded-full bg-[#F37120] px-6 py-3 font-semibold text-black"
                        type="button"
                      >
                        Get Started – Free Assessment
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Bottom nav */}
        <div className="absolute bottom-6 inset-x-0 px-6 flex justify-between text-white">
          <button onClick={skip} type="button">Skip</button>

          <div className="flex gap-2">
            {slides.map((_, i) => (
              <span
                key={i}
                className={`h-2 w-2 rounded-full ${i === index ? "bg-white" : "bg-white/40"}`}
              />
            ))}
          </div>

          <button onClick={next} disabled={isLast} type="button" className={isLast ? "opacity-40" : ""}>
            Next
          </button>
        </div>

        {/* ✅ FULL FAQ MODAL (1–6 complete) + Close works */}
        {faqOpen && (
          <div className="absolute inset-0 z-50">
            {/* backdrop (tap to close) */}
            <div
              className="absolute inset-0 bg-black/70"
              onClick={() => setFaqOpen(false)}
            />

            {/* panel */}
            <div className="absolute inset-x-0 bottom-0 md:bottom-auto md:inset-y-0 md:right-0 md:left-0 md:m-auto md:h-[80%] md:max-w-[430px]">
              <div className="relative h-[78vh] md:h-full w-full rounded-t-2xl md:rounded-2xl bg-[#0b0b0b] border border-white/10 overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
                  <div>
                    <div className="text-white font-semibold text-lg">
                      Getting Started with BearFit
                    </div>
                    <div className="text-white/60 text-sm">
                      Quick answers before you book.
                    </div>
                  </div>

                  {/* ✅ CLOSE BUTTON */}
                  <button
                    type="button"
                    onClick={() => setFaqOpen(false)}
                    className="text-white/70 hover:text-white text-sm px-3 py-2 rounded-lg underline underline-offset-4"
                  >
                    Close
                  </button>
                </div>

                <div className="p-5 space-y-3 overflow-y-auto h-[calc(78vh-64px)] md:h-[calc(100%-64px)]">
                  <FaqItem q="1. What can I expect from BearFit and what services do you offer?">
                    <ul className="list-disc pl-5 space-y-2">
                      <li>BearFit is all about science-based personalized training.</li>
                      <li>You’ll get exclusive workout sessions with our team of certified coaches.</li>
                      <li>We offer both in-house and online workout packages so you can train wherever works best for you.</li>
                    </ul>
                  </FaqItem>

                  <FaqItem q="2. How much are the monthly fees and are there any hidden costs?">
                    <ul className="list-disc pl-5 space-y-2">
                      <li>The great news is that BearFit doesn’t charge monthly fees at all!</li>
                      <li>You don’t have to worry about joining fees or being stuck in a 12-month lock-in contract.</li>
                    </ul>
                  </FaqItem>

                  <FaqItem q="3. What do I actually get when I sign up for a workout package?">
                    <ul className="list-disc pl-5 space-y-2">
                      <li>Each package is fully inclusive, giving you complete access to all gym equipment and amenities.</li>
                      <li>You’ll receive a personalized workout program tailored specifically to you.</li>
                      <li>Your sessions are exclusive and by-appointment-only, so you always have dedicated time with your assigned coach.</li>
                    </ul>
                  </FaqItem>

                  <FaqItem q="4. Where exactly are your branches located?">
                    <div className="space-y-2">
                      <div className="text-white/85">
                        We have two spots in <b>Quezon City</b>:
                      </div>
                      <ul className="list-disc pl-5 space-y-2">
                        <li><b>Sikatuna Village:</b> You can find us at 48 Malingap Street.</li>
                        <li><b>E. Rodriguez:</b> We are also on the G/F of the Puzon Building, 1118 E. Rodriguez Sr. Avenue.</li>
                      </ul>

                      <div className="text-white/85 mt-3">
                        We also have a location in <b>Cainta</b>:
                      </div>
                      <ul className="list-disc pl-5 space-y-2">
                        <li><b>Primark Town Center Cainta:</b> 271 Ortigas Ave Ext, Cainta, Rizal.</li>
                      </ul>
                    </div>
                  </FaqItem>

                  <FaqItem q="5. What are your opening hours, and do I need to book ahead?">
                    <ul className="list-disc pl-5 space-y-2">
                      <li>We are open Monday through Saturday to fit your schedule.</li>
                      <li>From Monday to Friday, we’re open from 7 AM to 10 PM, and on Saturdays, we’re here from 7 AM to 2 PM.</li>
                      <li><b>Pro tip:</b> It’s best to schedule your sessions in advance to make sure you get the time slot you want!</li>
                    </ul>
                  </FaqItem>

                  <FaqItem q="6. What kind of equipment and extra perks do you have?">
                    <ul className="list-disc pl-5 space-y-2">
                      <li>We’re well-equipped with a variety of strength and resistance training gear, plus equipment for Muay Thai and boxing.</li>
                      <li>If you want the full list of what’s on the floor, feel free to send us a DM!</li>
                      <li>For your comfort, we have shower rooms, a lounge area, a bicycle rack, drinking water, and even free WiFi.</li>
                    </ul>
                  </FaqItem>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function FaqItem({ q, children }: { q: string; children: ReactNode }) {
  return (
    <details className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
      <summary className="cursor-pointer text-white font-semibold">{q}</summary>
      <div className="mt-3 text-white/80 text-sm leading-relaxed">{children}</div>
    </details>
  );
}
