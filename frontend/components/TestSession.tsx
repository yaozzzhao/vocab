import React, { useState, useEffect, useRef } from "react";
import {
  ArrowRight,
  CheckCircle2,
  XCircle,
  RotateCcw,
  BookMarked,
  Home,
  Volume2,
} from "lucide-react";
import { Word, TestConfig } from "../types";
import { shuffleArray, normalizeWord } from "../utils";

// This component renders the interactive word input display
const WordInputDisplay: React.FC<{
  displayWord: string; // The original word, e.g., "(be) on time"
  currentInput: string;
  isShaking: boolean;
  feedbackState: "idle" | "correct" | "incorrect";
}> = ({ displayWord, currentInput, isShaking, feedbackState }) => {
  // 静态字符：括号、省略号、斜杠、连字符等不需要用户输入的标点
  const isStaticChar = (ch: string) => /[()./\-…]/.test(ch) || ch === ".";

  const elements = [];
  let inputCharIndex = 0;
  for (let i = 0; i < displayWord.length; i++) {
    const char = displayWord[i];
    if (isStaticChar(char)) {
      elements.push(
        <span key={`static-${i}`} className="text-stone-500">
          {char}
        </span>,
      );
    } else if (char === " ") {
      elements.push(<div key={`space-${i}`} className="w-4 h-12"></div>);
    } else {
      const displayChar = currentInput[inputCharIndex];
      const isCursorPosition = inputCharIndex === currentInput.length;

      let charColor = "text-stone-800";
      if (feedbackState === "correct") {
        charColor = "text-green-600";
      } else if (feedbackState === "incorrect" && displayChar) {
        charColor =
          normalizeWord(displayChar) === normalizeWord(char)
            ? "text-green-600"
            : "text-red-500";
      }

      elements.push(
        <div
          key={`input-${i}`}
          className="relative w-8 h-12 flex items-center justify-center"
        >
          <span
            className={`z-10 transition-colors duration-150 font-bold ${charColor}`}
          >
            {displayChar}
          </span>
          {isCursorPosition && feedbackState === "idle" && (
            <span className="absolute w-0.5 h-8 bg-slate-700 animate-blink z-20"></span>
          )}
          <span className="absolute bottom-0 w-full h-0.5 bg-stone-400"></span>
        </div>,
      );
      inputCharIndex++;
    }
  }

  return (
    <div
      className={`flex flex-wrap justify-center items-center gap-x-1 text-3xl md:text-4xl font-serif ${isShaking ? "animate-shake" : ""}`}
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

  // Declarative focus management
  useEffect(() => {
    if (feedbackState === "idle" && !isFinished) {
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 10); // Use a small delay to ensure the input is ready for focus.

      return () => clearTimeout(timer);
    }
  }, [feedbackState, isFinished, currentIndex]);

  const moveToNextWord = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      setIsFinished(true);
    }
    setInputValue("");
    setAttemptsLeft(3);
    setFeedbackState("idle");
    setShowCorrectAnswer(false); // Ensure this is reset for the new word
  };

  // 从单词中去掉所有静态标点（括号、省略号、斜杠、连字符等），只保留需要用户输入的字母部分
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
      }, 1200);
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
        }, 1500);
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
        }, 2500);
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
    } else {
      alert("Sorry, your browser doesn't support text-to-speech.");
    }
  };

  if (!currentWord && !isFinished)
    return <div className="text-center text-stone-500">Loading test...</div>;

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
      <div className="max-w-3xl mx-auto bg-white rounded-lg border border-stone-200 p-8 sm:p-12">
        <div className="text-center mb-10">
          <h2 className="text-4xl font-serif font-bold text-stone-900 mb-2">
            Session Complete
          </h2>
          <p className="text-stone-600 text-lg">
            Your accuracy was{" "}
            <span className="font-bold text-slate-800">{accuracy}%</span> (
            {correctCount} / {questions.length})
          </p>
        </div>

        {incorrectWords.length > 0 && (
          <div className="mb-10">
            <h3 className="text-2xl font-serif font-semibold text-stone-800 mb-5 pb-3 border-b border-stone-200">
              Words to Review
            </h3>
            <div className="space-y-4">
              {incorrectWords.map((word) => (
                <div
                  key={word.id}
                  className="flex items-start p-4 bg-stone-50 rounded-lg border border-stone-200"
                >
                  <div className="flex-1">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-bold text-lg text-stone-900">
                          {word.word}
                        </p>
                        <p className="text-sm text-stone-500">
                          {word.phonetic}
                          {word.page && (
                            <span className="ml-2 text-stone-400">
                              ({word.page})
                            </span>
                          )}
                        </p>
                      </div>
                      <p className="text-stone-700 font-medium text-right">
                        {word.meaning}
                      </p>
                    </div>
                    <div className="mt-2 text-sm">
                      <span className="text-stone-500">Your answer: </span>
                      <span className="text-red-600 line-through">
                        {answers[word.id]?.input || "(skipped)"}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {config.mode === "unit" && (
              <p className="text-sm text-stone-500 mt-4 flex items-center">
                <BookMarked className="w-4 h-4 mr-2 flex-shrink-0" />
                Incorrect words have been automatically added to your Mistake
                Book.
              </p>
            )}
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button
            onClick={handleFinishSession}
            className="px-6 py-3 bg-slate-800 text-white rounded-lg font-medium hover:bg-slate-900 transition-colors flex items-center justify-center"
          >
            <CheckCircle2 className="w-5 h-5 mr-2" />
            Finish Session
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
            className="px-6 py-3 bg-stone-200 text-stone-700 rounded-lg font-medium hover:bg-stone-300 transition-colors flex items-center justify-center"
          >
            <RotateCcw className="w-5 h-5 mr-2" />
            Retry Session
          </button>
          <button
            onClick={onNavigateHome}
            className="px-6 py-3 text-stone-600 rounded-lg font-medium hover:bg-stone-100 transition-colors flex items-center justify-center"
          >
            <Home className="w-5 h-5 mr-2" />
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  const progress = (currentIndex / questions.length) * 100;

  return (
    <div className="max-w-2xl mx-auto">
      <div className="w-full bg-stone-200 rounded-full h-1 mb-12">
        <div
          className="bg-slate-700 h-1 rounded-full transition-all duration-300 ease-out"
          style={{ width: `${progress}%` }}
        ></div>
      </div>

      <div className="text-center mb-8">
        <p className="text-4xl md:text-5xl font-serif font-bold text-stone-900 mb-4">
          {currentWord.meaning}
        </p>
        <div className="flex items-center justify-center gap-3 h-8">
          {currentWord.phonetic && (
            <>
              <p className="text-xl text-stone-500 font-mono">
                {currentWord.phonetic}
              </p>
              <button
                onClick={() => handlePlayAudio(currentWord.word)}
                className="text-stone-400 hover:text-slate-600 transition-colors"
                title="Listen to pronunciation"
                type="button"
              >
                <Volume2 className="w-6 h-6" />
              </button>
            </>
          )}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="relative mt-12">
        <div
          className="relative cursor-text"
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
            className="absolute top-0 left-0 w-full h-full opacity-0 cursor-text"
            autoComplete="off"
            autoCorrect="off"
            spellCheck="false"
            disabled={feedbackState !== "idle" || showCorrectAnswer}
          />
        </div>
      </form>

      <div className="text-center text-sm mt-4 h-12">
        {showCorrectAnswer ? (
          <div>
            <p className="text-stone-500">Correct Answer:</p>
            <p className="text-2xl font-serif font-bold text-green-600">
              {currentWord.word}
            </p>
          </div>
        ) : (
          <p className="text-stone-500 h-5">
            {feedbackState === "idle" && attemptsLeft < 3 && (
              <span className="text-red-500 font-bold">
                Incorrect. {attemptsLeft}{" "}
                {attemptsLeft > 1 ? "attempts" : "attempt"} left.
              </span>
            )}
            {feedbackState === "idle" && attemptsLeft === 3 && (
              <span>Type the word above. Press Enter to submit.</span>
            )}
          </p>
        )}
      </div>
    </div>
  );
};
