import { useState, useEffect, useCallback } from "react";

interface TypingHeadlineProps {
  staticText?: string;
  rotatingWords?: string[];
  typingSpeed?: number;
  deletingSpeed?: number;
  pauseTime?: number;
}

export const TypingHeadline = ({
  staticText = "Meta Ads,",
  rotatingWords = ["Simplified.", "Reimagined.", "Lumi-Fied.", "Powered by Psychology."],
  typingSpeed = 80,
  deletingSpeed = 50,
  pauseTime = 1200,
}: TypingHeadlineProps) => {
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [displayedText, setDisplayedText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  const currentWord = rotatingWords[currentWordIndex];

  const tick = useCallback(() => {
    if (isPaused) return;

    if (!isDeleting) {
      // Typing
      if (displayedText.length < currentWord.length) {
        setDisplayedText(currentWord.slice(0, displayedText.length + 1));
      } else {
        // Finished typing, pause before deleting
        setIsPaused(true);
        setTimeout(() => {
          setIsPaused(false);
          setIsDeleting(true);
        }, pauseTime);
      }
    } else {
      // Deleting
      if (displayedText.length > 0) {
        setDisplayedText(currentWord.slice(0, displayedText.length - 1));
      } else {
        // Finished deleting, move to next word
        setIsDeleting(false);
        setCurrentWordIndex((prev) => (prev + 1) % rotatingWords.length);
      }
    }
  }, [currentWord, displayedText, isDeleting, isPaused, pauseTime, rotatingWords.length]);

  useEffect(() => {
    const speed = isDeleting ? deletingSpeed : typingSpeed;
    const timer = setTimeout(tick, speed);
    return () => clearTimeout(timer);
  }, [tick, isDeleting, typingSpeed, deletingSpeed]);

  return (
    <h1 className="typing-headline">
      <span className="static-text">{staticText}</span>{" "}
      <span className="rotating-text">
        {displayedText}
        <span className="cursor" />
      </span>
    </h1>
  );
};

export default TypingHeadline;
