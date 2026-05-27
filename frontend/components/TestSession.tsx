import React, { useState, useEffect, useRef } from "react";
import {
  ArrowRight,
  CheckCircle2,
  XCircle,
  RotateCcw,
  BookMarked,
  Home,
  Volume2,
  Sparkles,
  ChevronLeft,
  HelpCircle,
  ThumbsDown,
} from "lucide-react";
import { Word, TestConfig } from "../types";
import { shuffleArray, normalizeWord } from "../utils";

const WordInputDisplay: React.FC<{
  displayWord: string;
  currentInput: string;
  isShaking: boolean;
  feedbackState: "idle" | "correct" | "incorrect";
}> = ({ displayWord, currentInput, isShaking, feedbackState }) => {
  const isStaticChar = (ch: string) => /[()./\-…]/.test(ch) || ch === ".";

  const elements = [];
  let inputCharIndex = 0;
  for (let i = 0; i < displayWord.length; i++) {
    const char = displayWord[i];
    if (isStaticChar(char)) {
      elements.push(
        <span key={`static-${i}`} className="text-stone-400">
          {char}
        </span>,
      );
    } else if (char === " ") {
      elements.push(<div key={`space-${i}`} className="w-4 h-14" />);
    } else {
      const displayChar = currentInput[inputCharIndex];
      const isCursorPosition = inputCharIndex === currentInput.length;

      let charColor = "text-stone-800";
      let bgColor = "bg-transparent";
      if (feedbackState === "correct") {
        charColor = "text-white";
        bgColor = "bg-success-500";
      } else if (feedbackState === "incorrect" && displayChar) {
        const isCharCorrect = normalizeWord(displayChar) === normalizeWord(char);
        charColor = "text-white";
        bgColor = isCharCorrect ? "bg-success-500" : "bg-rose-500";
      }

      elements.push(
        <div
          key={`input-${i}`}
          className={`relative w-10 h-14 flex items-center justify-center rounded-lg transition-all duration-150 ${bgColor}`}
        >
          <span className={`z-10 font-bold text-xl ${charColor}`}>
            {displayChar ?? ""}
          </span>
          {isCursorPosition && feedbackState === "idle" && (
            <span className="absolute w-0.5 h-7 bg-brand-500 animate-blink z-20 rounded-full" />
          )}
          <span className="absolute bottom-1 w-6 h-0.5 bg-stone-300 rounded-full" />
        </div>,
      );
      inputCharIndex++;
    }
  }

  return (
    <div
      className={`flex flex-nowrap justify-start items-center gap-1 overflow-x-auto pb-2 scrollbar-hide ${isShaking ? "animate-shake" : ""}`}
      style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
    >
      {elements}
    </div>
  );
};

interface TestSessionProps {
  config: TestConfig;
  onFinish: (results: { wordId: string; isCorrect: boolean }[]) => void;
  onAddMistakes: (wordIds: string[]) => void;
  onNavigateHome: () => void;
}

export const TestSession: React.FC<TestSessionProps> = ({
  config,
  onFinish,
  onAddMistakes,
  onNavigateHome,
}) => {
  const [questions, setQuestions] = useState<Word[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [inputValue, setInputValue] = useState("");
  const [answers, setAnswers] = useState<
    Record<string, { input: string; isCorrect: boolean }>
  >({});
  const [isFinished, setIsFinished] = useState(false);

  const [attemptsLeft, setAttemptsLeft] = useState(3);
  const [isShaking, setIsShaking] = useState(false);
  const [showCorrectAnswer, setShowCorrectAnswer] = useState(false);
  const [feedbackState, setFeedbackState] = useState<
    "idle" | "correct" | "incorrect"
  >("idle");
  const [inputHasFocus, setInputHasFocus] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const audioCtx = useRef<AudioContext | null>(null);

  useEffect(() => {
    try {
      audioCtx.current = new (
        window.AudioContext || (window as any).webkitAudioContext
      )();
    } catch (e) {
      console.error("Web Audio API is not supported in this browser.", e);
    }
    return () => {
      audioCtx.current?.close();
    };
  }, []);

  const playSound = (type: "keypress" | "error" | "correct") => {
    if (!audioCtx.current) return;
    const oscillator = audioCtx.current.createOscillator();
    const gainNode = audioCtx.current.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.current.destination);

    let duration = 0.1;
    gainNode.gain.setValueAtTime(0.1, audioCtx.current.currentTime);

    switch (type) {
      case "keypress":
        oscillator.type = "triangle";
        oscillator.frequency.setValueAtTime(1200, audioCtx.current.currentTime);
        gainNode.gain.setValueAtTime(0.05, audioCtx.current.currentTime);
        break;
      case "error":
        oscillator.type = "square";
        oscillator.frequency.setValueAtTime(100, audioCtx.current.currentTime);
        duration = 0.2;
        break;
      case "correct":
        oscillator.type = "sine";
        oscillator.frequency.setValueAtTime(600, audioCtx.current.currentTime);
        duration = 0.15;
        break;
    }

    gainNode.gain.exponentialRampToValueAtTime(
      0.0001,
      audioCtx.current.currentTime + duration,
    );
    oscillator.start(audioCtx.current.currentTime);
    oscillator.stop(audioCtx.current.currentTime + duration);
  };

  const currentWord = questions[currentIndex];

  useEffect(() => {
    const shuffled = shuffleArray(config.words);
    setQuestions(shuffled);
    setCurrentIndex(0);
    setAnswers({});
    setIsFinished(false);
    setAttemptsLeft(3);
    setInputValue("");
  }, [config]);

  useEffect(() => {
    if (feedbackState === "idle" && !isFinished) {
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 10);
      return () => clearTimeout(timer);
    }
  }, [feedbackState, isFinished, currentIndex]);

  const wrongCount = Object.values(answers).filter((a) => !a.isCorrect).length;
  const answeredCount = Object.keys(answers).length;

  const moveToNextWord = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      setIsFinished(true);
    }
    setInputValue("");
    setAttemptsLeft(3);
    setFeedbackState("idle");
    setShowCorrectAnswer(false);
  };

  const markAsWrong = () => {
    if (!currentWord || feedbackState !== "idle" || showCorrectAnswer) return;
    setAnswers((prev) => ({
      ...prev,
      [currentWord.id]: { input: inputValue || "(skipped)", isCorrect: false },
    }));
    if (config.mode === "unit") {
      onAddMistakes([currentWord.id]);
    }
    setShowCorrectAnswer(true);
    playSound("error");
    setTimeout(() => {
      moveToNextWord();
    }, 1500);
  };

  const testableWord = currentWord
    ? currentWord.word.replace(/[()./\-…]/g, "")
    : "";

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (
      !currentWord ||
      !inputValue.trim() ||
      feedbackState !== "idle" ||
      showCorrectAnswer
    )
      return;

    const isCorrect = normalizeWord(inputValue) === normalizeWord(testableWord);

    if (isCorrect) {
      playSound("correct");
      setFeedbackState("correct");
      setAnswers((prev) => ({
        ...prev,
        [currentWord.id]: { input: inputValue.trim(), isCorrect: true },
      }));
      setTimeout(() => {
        moveToNextWord();
      }, 800);
    } else {
      playSound("error");
      setIsShaking(true);
      setFeedbackState("incorrect");
      setTimeout(() => setIsShaking(false), 500);

      if (attemptsLeft > 1) {
        setAttemptsLeft((prev) => prev - 1);
        setTimeout(() => {
          setInputValue("");
          setFeedbackState("idle");
        }, 1000);
      } else {
        setAnswers((prev) => ({
          ...prev,
          [currentWord.id]: { input: inputValue.trim(), isCorrect: false },
        }));
        if (config.mode === "unit") {
          onAddMistakes([currentWord.id]);
        }
        setShowCorrectAnswer(true);
        setTimeout(() => {
          moveToNextWord();
        }, 2000);
      }
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (feedbackState !== "idle") return;
    playSound("keypress");
    const sanitized = e.target.value.replace(/[^a-zA-Z\s']/g, "");
    if (sanitized.length <= testableWord.length) {
      setInputValue(sanitized);
    }
  };

  const handleFinishSession = () => {
    const results = questions.map((q) => ({
      wordId: q.id,
      isCorrect: answers[q.id]?.isCorrect ?? false,
    }));
    onFinish(results);
  };

  const handlePlayAudio = (word: string) => {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(word);
      utterance.lang = "en-US";
      window.speechSynthesis.speak(utterance);
    }
  };

  if (!currentWord && !isFinished)
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-brand-200 border-t-brand-500 rounded-full animate-spin" />
      </div>
    );

  if (isFinished) {
    const correctCount = Object.values(answers).filter(
      (a) => a.isCorrect,
    ).length;
    const accuracy =
      questions.length > 0
        ? Math.round((correctCount / questions.length) * 100)
        : 100;
    const incorrectWords = questions.filter((q) => !answers[q.id]?.isCorrect);

    return (
      <div className="max-w-lg mx-auto">
        <div className="text-center mb-8">
          <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 ${
            accuracy >= 80 ? 'bg-success-50' : 'bg-amber-50'
          }`}>
            {accuracy >= 80
              ? <CheckCircle2 className="w-10 h-10 text-success-500" />
              : <XCircle className="w-10 h-10 text-amber-500" />
            }
          </div>
          <h2 className="text-2xl font-bold text-stone-800 mb-1">Session Complete</h2>
          <p className="text-stone-500">
            <span className="text-3xl font-bold text-brand-600">{accuracy}%</span>
            <span className="mx-1">accuracy</span>
            <span className="text-stone-400">({correctCount}/{questions.length})</span>
          </p>
        </div>

        {incorrectWords.length > 0 && (
          <div className="mb-8">
            <h3 className="font-bold text-stone-700 mb-3 flex items-center gap-2">
              <BookMarked className="w-4 h-4 text-rose-500" />
              Words to Review
            </h3>
            <div className="space-y-2">
              {incorrectWords.map((word) => (
                <div
                  key={word.id}
                  className="flex items-start p-4 bg-white rounded-2xl border border-stone-200 shadow-card"
                >
                  <div className="flex-1">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-bold text-stone-900">{word.word}</p>
                        <p className="text-sm text-stone-400">{word.phonetic}</p>
                      </div>
                      <p className="text-stone-600 font-medium text-right">{word.meaning}</p>
                    </div>
                    <div className="mt-2 text-sm">
                      <span className="text-stone-400">Your answer: </span>
                      <span className="text-rose-500 line-through">
                        {answers[word.id]?.input || "(skipped)"}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {config.mode === "unit" && (
              <p className="text-sm text-stone-400 mt-3 flex items-center gap-1.5">
                <BookMarked className="w-4 h-4" />
                Incorrect words added to Error Book
              </p>
            )}
          </div>
        )}

        <div className="flex flex-col gap-3">
          <button
            onClick={handleFinishSession}
            className="w-full py-3.5 bg-brand-500 text-white rounded-2xl font-semibold hover:bg-brand-600 active:scale-[0.98] transition-all shadow-bubble flex items-center justify-center gap-2"
          >
            <CheckCircle2 className="w-5 h-5" />
            Continue
          </button>
          <button
            onClick={() => {
              const shuffled = shuffleArray(config.words);
              setQuestions(shuffled);
              setCurrentIndex(0);
              setAnswers({});
              setIsFinished(false);
              setAttemptsLeft(3);
              setInputValue("");
            }}
            className="w-full py-3.5 bg-white text-stone-700 rounded-2xl font-semibold border border-stone-300 hover:bg-stone-50 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
          >
            <RotateCcw className="w-5 h-5" />
            Retry Session
          </button>
        </div>
      </div>
    );
  }

  const progress = ((currentIndex + 1) / questions.length) * 100;

  return (
    <div className="max-w-lg mx-auto">
      {/* Progress Bar */}
      <div className="mb-8">
        <div className="flex items-center justify-between text-sm text-stone-400 mb-2">
          <span>{currentIndex + 1} of {questions.length}</span>
          <div className="flex items-center gap-3">
            {wrongCount > 0 && (
              <span className="text-rose-500 font-medium flex items-center gap-1">
                <XCircle className="w-3.5 h-3.5" />
                {wrongCount} wrong
              </span>
            )}
            <span>{config.mode === "review" ? "Review" : config.unitName}</span>
          </div>
        </div>
        <div className="w-full bg-stone-200 rounded-full h-2 overflow-hidden">
          <div
            className="bg-brand-500 h-full rounded-full transition-all duration-300 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Question Card */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-card p-8 mb-6">
        {/* Meaning */}
        <div className="text-center mb-6">
          <p className="text-4xl font-bold text-stone-800 mb-2">
            {currentWord.meaning}
          </p>
          <div className="flex items-center justify-center gap-2">
            {currentWord.phonetic && (
              <p className="text-base text-stone-400 font-mono">{currentWord.phonetic}</p>
            )}
            <button
              onClick={() => handlePlayAudio(currentWord.word)}
              className="text-stone-300 hover:text-brand-500 transition-colors"
              title="Listen"
              type="button"
            >
              <Volume2 className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Input Area */}
        <form onSubmit={handleSubmit}>
          <div
            className={`relative p-4 rounded-xl border-2 transition-all ${
              inputHasFocus && feedbackState === "idle"
                ? "border-brand-500 bg-brand-50/30"
                : feedbackState === "correct"
                ? "border-success-500 bg-success-50"
                : feedbackState === "incorrect"
                ? "border-rose-500 bg-rose-50"
                : "border-stone-200 bg-white"
            }`}
            onClick={() => inputRef.current?.focus()}
          >
            {currentWord && (
              <WordInputDisplay
                displayWord={currentWord.word}
                currentInput={inputValue}
                isShaking={isShaking}
                feedbackState={feedbackState}
              />
            )}
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={handleInputChange}
              onFocus={() => setInputHasFocus(true)}
              onBlur={() => setInputHasFocus(false)}
              className="absolute top-0 left-0 w-full h-full opacity-0 cursor-text"
              autoComplete="off"
              autoCorrect="off"
              spellCheck="false"
              disabled={feedbackState !== "idle" || showCorrectAnswer}
            />
          </div>
        </form>

        {/* Feedback Area */}
        <div className="text-center mt-4 h-12">
          {showCorrectAnswer ? (
            <div className="animate-slide-down">
              <p className="text-sm text-stone-400">Correct answer:</p>
              <p className="text-xl font-bold text-brand-600">{currentWord.word}</p>
            </div>
          ) : feedbackState === "correct" ? (
            <div className="flex items-center justify-center gap-1.5 text-success-600 font-semibold animate-bounce-in">
              <CheckCircle2 className="w-5 h-5" />
              Correct!
            </div>
          ) : feedbackState === "incorrect" ? (
            <div className="flex items-center justify-center gap-1.5 text-rose-500 font-semibold">
              <XCircle className="w-5 h-5" />
              {attemptsLeft > 0 ? `${attemptsLeft} ${attemptsLeft > 1 ? 'attempts' : 'attempt'} left` : "No more attempts"}
            </div>
          ) : (
            <p className="text-stone-400 text-sm">Type the word above. Press Enter to submit.</p>
          )}
        </div>

        {/* Quick action buttons */}
        {feedbackState === "idle" && !showCorrectAnswer && (
          <div className="flex gap-3 mt-6">
            <button
              type="button"
              onClick={() => {
                setInputValue("");
                markAsWrong();
              }}
              className="flex-1 py-2.5 flex items-center justify-center gap-2 bg-rose-50 text-rose-600 rounded-xl font-medium text-sm border border-rose-200 hover:bg-rose-100 active:scale-[0.97] transition-all"
            >
              <HelpCircle className="w-4 h-4" />
              Don't Know
            </button>
            <button
              type="button"
              onClick={() => {
                if (!inputValue.trim()) {
                  setInputValue("~");
                }
                markAsWrong();
              }}
              className="flex-1 py-2.5 flex items-center justify-center gap-2 bg-amber-50 text-amber-600 rounded-xl font-medium text-sm border border-amber-200 hover:bg-amber-100 active:scale-[0.97] transition-all"
            >
              <ThumbsDown className="w-4 h-4" />
              Not Sure
            </button>
          </div>
        )}
      </div>

      {/* Attempts remaining */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className={`w-8 h-1.5 rounded-full transition-colors ${
                i <= attemptsLeft ? "bg-brand-300" : "bg-stone-200"
              }`}
            />
          ))}
        </div>
        <div className="flex items-center gap-2">
          {attemptsLeft < 3 && feedbackState === "idle" && (
            <span className="text-xs text-rose-400 font-medium">
              {attemptsLeft} left
            </span>
          )}
          <span className="text-xs text-stone-400">3 attempts per word</span>
        </div>
      </div>
    </div>
  );
};