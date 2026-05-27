import React, { useState, useEffect, useCallback } from "react";
import { useAppStore } from "./store";
import { ViewState, TestConfig, User, UserStats } from "./types";
import { Home } from "./components/Home";
import { Manager } from "./components/Manager";
import { TestSession } from "./components/TestSession";
import { Login } from "./components/Login";
import { UserManagement } from "./components/UserManagement";
import { ErrorBook } from "./components/ErrorBook";
import { WordLibrary } from "./components/WordLibrary";
import { GamificationHub, XpPopup } from "./components/GamificationHub";
import { LogOut, Users, BookX, Library, Trophy } from "lucide-react";
import { clearSession, getUserStats, updateUserStats } from "./db";

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentView, setCurrentView] = useState<ViewState>("home");
  const [testConfig, setTestConfig] = useState<TestConfig | null>(null);

  // Gamification state
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [showGamification, setShowGamification] = useState(false);
  const [xpPopupVisible, setXpPopupVisible] = useState(false);
  const [xpEarned, setXpEarned] = useState(0);
  const [achievementToasts, setAchievementToasts] = useState<
    { id: string; message: string; icon: string }[]
  >([]);

  const {
    words,
    mistakes,
    isLoaded,
    addWords,
    clearAllData,
    addMistakes,
    handleReviewResult,
    removeMistake,
  } = useAppStore(currentUser);

  const loadStats = useCallback(async () => {
    try {
      const stats = await getUserStats();
      setUserStats(stats);
    } catch {
      // stats not available yet
    }
  }, []);

  useEffect(() => {
    // 从 sessionStorage 恢复已登录用户（不含 passwordHash）
    const savedUser = sessionStorage.getItem("currentUser");
    if (savedUser) {
      try {
        setCurrentUser(JSON.parse(savedUser));
      } catch {
        sessionStorage.removeItem("currentUser");
      }
    }
  }, []);

  useEffect(() => {
    if (currentUser) {
      loadStats();
    }
  }, [currentUser, loadStats]);

  const handleLogin = (user: User, _token: string) => {
    setCurrentUser(user);
    setCurrentView("home");
  };

  const handleLogout = () => {
    setCurrentUser(null);
    clearSession();
  };

  const dismissToast = (id: string) => {
    setAchievementToasts((prev) => prev.filter((t) => t.id !== id));
  };

  if (!currentUser) {
    return <Login onLogin={handleLogin} />;
  }

  if (!isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center text-stone-500 font-serif">
        Loading User Data...
      </div>
    );
  }

  const handleStartTest = (config: TestConfig) => {
    setTestConfig(config);
    setCurrentView("test");
  };

  const handleTestFinish = async (
    results: { wordId: string; isCorrect: boolean }[],
  ) => {
    const correctCount = results.filter((r) => r.isCorrect).length;
    const wrongCount = results.length - correctCount;

    if (testConfig?.mode === "review") {
      await Promise.all(
        results.map((result) =>
          handleReviewResult(result.wordId, result.isCorrect),
        ),
      );
    }

    // Update gamification stats
    if (testConfig) {
      try {
        const result = await updateUserStats({
          correctCount,
          wrongCount,
          mode: testConfig.mode,
          wordIds: testConfig.words.map((w) => w.id),
        });
        setUserStats(result.stats);
        setXpEarned(result.xpEarned);
        setXpPopupVisible(true);
        setTimeout(() => setXpPopupVisible(false), 3000);

        if (result.newAchievements.length > 0) {
          const toasts = result.newAchievements.map((a) => ({
            id: a.id,
            message: `Achievement: ${a.name}`,
            icon: a.icon,
          }));
          setAchievementToasts((prev) => [...prev, ...toasts]);
        }
      } catch {
        // stats update failed silently
      }
    }

    setCurrentView("home");
    setTestConfig(null);
  };

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-stone-50/80 backdrop-blur-sm border-b border-stone-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div
            className="flex items-center cursor-pointer group"
            onClick={() => setCurrentView("home")}
          >
            <h1 className="text-2xl font-serif font-bold text-stone-900 tracking-tight">
              VocabMaster
            </h1>
          </div>

          <nav className="flex items-center space-x-2 sm:space-x-4">
            <span className="hidden sm:inline text-sm text-stone-600">
              Welcome, <span className="font-bold">{currentUser.username}</span>
              !
            </span>
            <button
              onClick={() => setCurrentView("home")}
              className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                currentView === "home"
                  ? "bg-stone-200 text-stone-800"
                  : "text-stone-500 hover:bg-stone-100 hover:text-stone-800"
              }`}
              title="Home"
            >
              Home
            </button>
            {currentUser.role === "admin" && (
              <button
                onClick={() => setCurrentView("manage")}
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  currentView === "manage"
                    ? "bg-stone-200 text-stone-800"
                    : "text-stone-500 hover:bg-stone-100 hover:text-stone-800"
                }`}
                title="Manage Vocabulary"
              >
                Manage
              </button>
            )}
            <button
              onClick={() => setCurrentView("error_book")}
              className={`relative p-2 rounded-md text-sm font-medium transition-colors ${
                currentView === "error_book"
                  ? "bg-stone-200 text-stone-800"
                  : "text-stone-500 hover:bg-stone-100 hover:text-stone-800"
              }`}
              title="Error Book"
            >
              <BookX className="w-5 h-5" />
              {mistakes.length > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white">
                  {mistakes.length}
                </span>
              )}
            </button>
            {currentUser.role === "admin" && (
              <>
                <button
                  onClick={() => setCurrentView("word_library")}
                  className={`p-2 rounded-md flex items-center transition-colors ${
                    currentView === "word_library"
                      ? "bg-stone-200 text-stone-800"
                      : "text-stone-500 hover:bg-stone-100"
                  }`}
                  title="Word Library"
                >
                  <Library className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setCurrentView("user_management")}
                  className={`p-2 rounded-md flex items-center transition-colors ${
                    currentView === "user_management"
                      ? "bg-stone-200 text-stone-800"
                      : "text-stone-500 hover:bg-stone-100"
                  }`}
                  title="User Management"
                >
                  <Users className="w-5 h-5" />
                </button>
              </>
            )}
            <button
              onClick={() => setShowGamification(true)}
              className={`relative p-2 rounded-md transition-colors ${
                showGamification
                  ? "bg-stone-200 text-stone-800"
                  : "text-stone-500 hover:bg-stone-100"
              }`}
              title="Progress"
            >
              <Trophy className="w-5 h-5" />
            </button>
            <button
              onClick={handleLogout}
              className="p-2 rounded-md text-stone-500 hover:bg-stone-100"
              title="Logout"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </nav>
        </div>
      </header>

      <main className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-12">
        {currentView === "home" && (
          <Home
            words={words}
            mistakes={mistakes}
            onStartTest={handleStartTest}
            onNavigateManage={() => setCurrentView("manage")}
            isAdmin={currentUser.role === "admin"}
          />
        )}

        {currentView === "manage" && (
          <Manager
            onAddWords={addWords}
            onClearAll={clearAllData}
            totalWords={words.length}
          />
        )}

        {currentView === "test" && testConfig && (
          <TestSession
            config={testConfig}
            onFinish={handleTestFinish}
            onAddMistakes={addMistakes}
            onNavigateHome={() => setCurrentView("home")}
          />
        )}

        {currentView === "user_management" && currentUser.role === "admin" && (
          <UserManagement />
        )}

        {currentView === "error_book" && (
          <ErrorBook
            words={words}
            mistakes={mistakes}
            onStartTest={handleStartTest}
            onRemoveMistake={removeMistake}
          />
        )}

        {currentView === "word_library" && currentUser.role === "admin" && (
          <WordLibrary currentUserId={currentUser.id} />
        )}
      </main>

      {showGamification && (
        <GamificationHub
          stats={userStats}
          onClose={() => setShowGamification(false)}
          newAchievementToasts={achievementToasts}
          onDismissToast={dismissToast}
        />
      )}

      <XpPopup xpEarned={xpEarned} visible={xpPopupVisible} />
    </div>
  );
};

export default App;
