import React, { useState, useEffect, useRef } from "react";
import {
  CheckCircle2,
  XCircle,
  RotateCcw,
  Home,
  ChevronLeft,
  HelpCircle,
  X,
} from "lucide-react";
import { irregularVerbs, IrregularVerb } from "../data/irregular-verbs";
import { shuffleArray, normalizeWord } from "../utils";

interface IrregularVerbsTestProps {
  onNavigateHome: () => void;
}

export const IrregularVerbsTest: React.FC<IrregularVerbsTestProps> = ({
  onNavigateHome,
}) => {
  const [questions, setQuestions] = useState<IrregularVerb[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [inputValue, setInputValue] = useState("");
  const [answers, setAnswers] = useState<
    Record<number, { input: string; isCorrect: boolean }>
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

  useEffect(() => {
    const shuffled = shuffleArray([...irregularVerbs]);
    setQuestions(shuffled);
    setCurrentIndex(0);
    setAnswers({});
    setIsFinished(false);
    setAttemptsLeft(3);
    setInputValue("");
  }, []);

  useEffect(() => {
    if (feedbackState === "idle" && !isFinished) {
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 10);
      return () => clearTimeout(timer);
    }
  }, [feedbackState, isFinished, currentIndex]);

  const currentVerb = questions[currentIndex];

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

  const checkAnswer = (input: string, correctAnswer: string): boolean => {
    const normalizedInput = normalizeWord(input);
    const answers = correctAnswer.split("/").map((a) => normalizeWord(a.trim()));
    return answers.includes(normalizedInput);
  };

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (
      !currentVerb ||
      !inputValue.trim() ||
      feedbackState !== "idle" ||
      showCorrectAnswer
    )
      return;

    const isCorrect = checkAnswer(inputValue, currentVerb.pastTense);

    if (isCorrect) {
      playSound("correct");
      setFeedbackState("correct");
      setAnswers((prev) => ({
        ...prev,
        [currentIndex]: { input: inputValue.trim(), isCorrect: true },
      }));
      setTimeout(() => {
        moveToNextVerb();
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
          [currentIndex]: { input: inputValue.trim(), isCorrect: false },
        }));
        setShowCorrectAnswer(true);
        setTimeout(() => {
          moveToNextVerb();
        }, 2000);
      }
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (feedbackState !== "idle") return;
    playSound("keypress");
    const sanitized = e.target.value.replace(/[^a-zA-Z\s',\-\/]/g, "");
    setInputValue(sanitized);
  };

  const moveToNextVerb = () => {
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

  const handleFinishSession = () => {
    setIsFinished(false);
    setQuestions(shuffleArray([...irregularVerbs]));
    setCurrentIndex(0);
    setAnswers({});
    setAttemptsLeft(3);
    setInputValue("");
  };

  const wrongCount = Object.values(answers).filter((a) => !a.isCorrect).length;
  const answeredCount = Object.keys(answers).length;

  if (!currentVerb && !isFinished)
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
    const incorrectVerbs = questions.filter(
      (_, idx) => !answers[idx]?.isCorrect,
    );

    return (
      <div className="max-w-lg mx-auto">
        <div className="text-center mb-8">
          <div
            className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 ${
              accuracy >= 80 ? "bg-success-50" : "bg-amber-50"
            }`}
          >
            {accuracy >= 80 ? (
              <CheckCircle2 className="w-10 h-10 text-success-500" />
            ) : (
              <XCircle className="w-10 h-10 text-amber-500" />
            )}
          </div>
          <h2 className="text-2xl font-bold text-stone-800 mb-1">
            Irregular Verbs Test Complete
          </h2>
          <p className="text-stone-500">
            <span className="text-3xl font-bold text-brand-600">
              {accuracy}%
            </span>
            <span className="mx-1">accuracy</span>
            <span className="text-stone-400">
              ({correctCount}/{questions.length})
            </span>
          </p>
        </div>

        {incorrectVerbs.length > 0 && (
          <div className="mb-8">
            <h3 className="font-bold text-stone-700 mb-3 flex items-center gap-2">
              <XCircle className="w-4 h-4 text-rose-500" />
              Verbs to Review
            </h3>
            <div className="space-y-2">
              {incorrectVerbs.map((verb, idx) => (
                <div
                  key={idx}
                  className="flex items-start p-4 bg-white rounded-2xl border border-stone-200 shadow-card"
                >
                  <div className="flex-1">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-bold text-stone-900">{verb.base}</p>
                      </div>
                      <p className="text-stone-600 font-medium text-right">
                        {verb.pastTense}
                      </p>
                    </div>
                    <div className="mt-2 text-sm">
                      <span className="text-stone-400">Your answer: </span>
                      <span className="text-rose-500 line-through">
                        {answers[questions.indexOf(verb)]?.input || "(skipped)"}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-col gap-3">
          <button
            onClick={handleFinishSession}
            className="w-full py-3.5 bg-brand-500 text-white rounded-2xl font-semibold hover:bg-brand-600 active:scale-[0.98] transition-all shadow-bubble flex items-center justify-center gap-2"
          >
            <RotateCcw className="w-5 h-5" />
            Try Again
          </button>
          <button
            onClick={onNavigateHome}
            className="w-full py-3.5 bg-white text-stone-700 rounded-2xl font-semibold border border-stone-300 hover:bg-stone-50 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
          >
            <Home className="w-5 h-5" />
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  const progress = ((currentIndex + 1) / questions.length) * 100;

  return (
    <div className="max-w-lg mx-auto">
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={onNavigateHome}
          className="flex items-center gap-1.5 text-stone-400 hover:text-stone-600 transition-colors"
          title="Exit"
        >
          <ChevronLeft className="w-5 h-5" />
          <span className="text-sm font-medium">Exit</span>
        </button>
        <span className="text-xs text-stone-400 font-medium bg-stone-100 px-2.5 py-1 rounded-full">
          Irregular Verbs
        </span>
      </div>

      <div className="mb-8">
        <div className="flex items-center justify-between text-sm text-stone-400 mb-2">
          <span>
            {currentIndex + 1} of {questions.length}
          </span>
          <div className="flex items-center gap-3">
            {wrongCount > 0 && (
              <span className="text-rose-500 font-medium flex items-center gap-1">
                <XCircle className="w-3.5 h-3.5" />
                {wrongCount} wrong
              </span>
            )}
            {answeredCount > 0 && (
              <span className="text-stone-400 text-xs">{answeredCount} done</span>
            )}
          </div>
        </div>
        <div className="w-full bg-stone-200 rounded-full h-2 overflow-hidden">
          <div
            className="bg-brand-500 h-full rounded-full transition-all duration-300 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-stone-200 shadow-card p-8 mb-6">
        <div className="text-center mb-6">
          <p className="text-sm text-stone-400 mb-2">Base Form</p>
          <p className="text-4xl font-bold text-stone-800 mb-2">
            {currentVerb.base}
          </p>
        </div>

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
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={handleInputChange}
              onFocus={() => setInputHasFocus(true)}
              onBlur={() => setInputHasFocus(false)}
              placeholder="Type the past tense..."
              className="w-full text-center text-xl font-bold text-stone-800 placeholder-stone-300 outline-none"
              autoComplete="off"
              autoCorrect="off"
              spellCheck="false"
              disabled={feedbackState !== "idle" || showCorrectAnswer}
            />
          </div>
        </form>

        <div className="text-center mt-4 h-12">
          {showCorrectAnswer ? (
            <div className="animate-slide-down">
              <p className="text-sm text-stone-400">Correct answer:</p>
              <p className="text-xl font-bold text-brand-600">
                {currentVerb.pastTense}
              </p>
            </div>
          ) : feedbackState === "correct" ? (
            <div className="flex items-center justify-center gap-1.5 text-success-600 font-semibold animate-bounce-in">
              <CheckCircle2 className="w-5 h-5" />
              Correct!
            </div>
          ) : feedbackState === "incorrect" ? (
            <div className="flex items-center justify-center gap-1.5 text-rose-500 font-semibold">
              <XCircle className="w-5 h-5" />
              {attemptsLeft > 0
                ? `${attemptsLeft} ${attemptsLeft > 1 ? "attempts" : "attempt"} left`
                : "No more attempts"}
            </div>
          ) : (
            <p className="text-stone-400 text-sm">
              Type the past tense. Press Enter to submit.
            </p>
          )}
        </div>

        {feedbackState === "idle" && !showCorrectAnswer && (
          <div className="flex gap-3 mt-6">
            <button
              type="button"
              onClick={() => {
                setInputValue("");
                setAnswers((prev) => ({
                  ...prev,
                  [currentIndex]: { input: "(skipped)", isCorrect: false },
                }));
                setShowCorrectAnswer(true);
                setTimeout(() => {
                  moveToNextVerb();
                }, 2000);
              }}
              className="flex-1 py-2.5 flex items-center justify-center gap-2 bg-rose-50 text-rose-600 rounded-xl font-medium text-sm border border-rose-200 hover:bg-rose-100 active:scale-[0.97] transition-all"
            >
              <HelpCircle className="w-4 h-4" />
              Don't Know
            </button>
          </div>
        )}
      </div>

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
        <span className="text-xs text-stone-400">3 attempts per verb</span>
      </div>
    </div>
  );
};
