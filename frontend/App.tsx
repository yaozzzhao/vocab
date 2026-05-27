import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useAppStore } from "./store";
import { ViewState, TestConfig, User, UserStats, Word } from "./types";
import { Home } from "./components/Home";
import { Manager } from "./components/Manager";
import { TestSession } from "./components/TestSession";
import { Login } from "./components/Login";
import { UserManagement } from "./components/UserManagement";
import { ErrorBook } from "./components/ErrorBook";
import { WordLibrary } from "./components/WordLibrary";
import { GamificationHub, XpPopup } from "./components/GamificationHub";
import { LeftSidebar, RightSidebar } from "./components/Sidebar";
import { LogOut, Users, BookX, Library, Trophy, HomeIcon, Settings, Sparkles, ChevronDown } from "lucide-react";
import { clearSession, getUserStats, updateUserStats } from "./db";

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentView, setCurrentView] = useState<ViewState>("home");
  const [testConfig, setTestConfig] = useState<TestConfig | null>(null);

  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [showGamification, setShowGamification] = useState(false);
  const [xpPopupVisible, setXpPopupVisible] = useState(false);
  const [xpEarned, setXpEarned] = useState(0);
  const [achievementToasts, setAchievementToasts] = useState<
    { id: string; message: string; icon: string }[]
  >([]);
  const [showUserMenu, setShowUserMenu] = useState(false);

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
    } catch {}
  }, []);

  useEffect(() => {
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
    setShowUserMenu(false);
  };

  const dismissToast = (id: string) => {
    setAchievementToasts((prev) => prev.filter((t) => t.id !== id));
  };

  if (!currentUser) {
    return <Login onLogin={handleLogin} />;
  }

  if (!isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-brand-200 border-t-brand-500 rounded-full animate-spin" />
          <p className="text-stone-400 font-medium">Loading...</p>
        </div>
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
      } catch {}
    }

    setCurrentView("home");
    setTestConfig(null);
  };

  const navigateToHome = () => {
    setCurrentView("home");
    setShowUserMenu(false);
  };

  const navigateTo = (view: ViewState) => {
    setCurrentView(view);
    setShowUserMenu(false);
  };

  const isTestView = currentView === "test";

  const dueReviews = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const today = now.getTime();
    return mistakes.filter((m) => m.nextReviewDate <= today).length;
  }, [mistakes]);

  const handleSidebarReview = () => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const reviewWords = mistakes
      .filter((m) => m.nextReviewDate <= now.getTime())
      .map((m) => words.find((w) => w.id === m.wordId))
      .filter((w): w is Word => w !== undefined);
    if (reviewWords.length > 0) {
      setTestConfig({ mode: "review", words: reviewWords });
      setCurrentView("test");
    }
  };

  const unitsCount = useMemo(() => {
    const unitSet = new Set(words.map((w) => w.unit));
    return unitSet.size;
  }, [words]);

  return (
    <div className="min-h-screen bg-stone-50 flex flex-col">
      {/* Thin Top Bar - Duolingo style */}
      {!isTestView && (
        <header className="bg-white/90 backdrop-blur-md border-b border-stone-200 sticky top-0 z-20">
          <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
            <button onClick={navigateToHome} className="flex items-center gap-2">
              <div className="w-8 h-8 bg-brand-500 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">V</span>
              </div>
              <span className="font-bold text-stone-800 hidden sm:inline">VocabMaster</span>
            </button>

            <div className="flex items-center gap-2">
              {/* Streak */}
              <div className="flex items-center gap-1 bg-amber-50 px-2.5 py-1.5 rounded-lg border border-amber-200">
                <svg className="w-4 h-4 text-amber-500" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C12 2 7 8 7 13C7 17.4183 9.23858 21 12 21C14.7614 21 17 17.4183 17 13C17 8 12 2 12 2Z" />
                </svg>
                <span className="text-xs font-bold text-amber-700">{userStats?.streakCount ?? 0}</span>
              </div>

              {/* XP */}
              <div className="flex items-center gap-1 bg-brand-50 px-2.5 py-1.5 rounded-lg border border-brand-200">
                <Sparkles className="w-3.5 h-3.5 text-brand-500" />
                <span className="text-xs font-bold text-brand-700">{userStats?.xp ?? 0}</span>
              </div>

              {/* Trophy */}
              <button
                onClick={() => setShowGamification(true)}
                className="p-2 rounded-lg hover:bg-stone-100 transition-colors text-stone-500"
                title="Progress"
              >
                <Trophy className="w-5 h-5" />
              </button>

              {/* User Menu */}
              <div className="relative">
                <button
                  onClick={() => setShowUserMenu((v) => !v)}
                  className="flex items-center gap-1.5 p-1.5 rounded-lg hover:bg-stone-100 transition-colors"
                >
                  <div className="w-7 h-7 bg-brand-200 rounded-full flex items-center justify-center">
                    <span className="text-xs font-bold text-brand-700">
                      {currentUser.username[0].toUpperCase()}
                    </span>
                  </div>
                  <ChevronDown className="w-3.5 h-3.5 text-stone-400" />
                </button>

                {showUserMenu && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setShowUserMenu(false)} />
                    <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-xl border border-stone-200 shadow-lg py-1 z-20 animate-slide-down">
                      <div className="px-4 py-2 border-b border-stone-100">
                        <p className="text-sm font-medium text-stone-800">{currentUser.username}</p>
                        <p className="text-xs text-stone-400 capitalize">{currentUser.role}</p>
                      </div>
                      {currentUser.role === "admin" && (
                        <>
                          <button
                            onClick={() => navigateTo("manage")}
                            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-stone-600 hover:bg-stone-50"
                          >
                            <Settings className="w-4 h-4" />
                            Manage Vocab
                          </button>
                          <button
                            onClick={() => navigateTo("word_library")}
                            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-stone-600 hover:bg-stone-50"
                          >
                            <Library className="w-4 h-4" />
                            Word Library
                          </button>
                          <button
                            onClick={() => navigateTo("user_management")}
                            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-stone-600 hover:bg-stone-50"
                          >
                            <Users className="w-4 h-4" />
                            User Management
                          </button>
                        </>
                      )}
                      <div className="border-t border-stone-100 mt-1 pt-1">
                        <button
                          onClick={handleLogout}
                          className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-rose-600 hover:bg-rose-50"
                        >
                          <LogOut className="w-4 h-4" />
                          Sign Out
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </header>
      )}

      {/* Main Content with Sidebars */}
      <div className="flex-1 flex max-w-7xl mx-auto w-full">
        {/* Left Sidebar - Desktop */}
        {!isTestView && (
          <aside className="hidden lg:block w-60 shrink-0 border-r border-stone-200 p-4 overflow-y-auto">
            <LeftSidebar user={currentUser} stats={userStats} />
          </aside>
        )}

        {/* Main Content Area */}
        <main className={`flex-1 min-w-0 px-4 py-6 sm:py-8 ${!isTestView ? '' : 'max-w-lg mx-auto'}`}>
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

        {/* Right Sidebar - Desktop */}
        {!isTestView && (
          <aside className="hidden xl:block w-60 shrink-0 border-l border-stone-200 p-4 overflow-y-auto">
            <RightSidebar
              view={currentView}
              totalWords={words.length}
              totalMistakes={mistakes.length}
              dueReviews={dueReviews}
              unitsCount={unitsCount}
              onStartReview={handleSidebarReview}
            />
          </aside>
        )}
      </div>

      {/* Bottom Tab Bar - Mobile */}
      {!isTestView && (
        <nav className="sm:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-stone-200 z-20 safe-area-bottom">
          <div className="flex items-center justify-around h-16 px-2">
            <TabButton
              icon={<HomeIcon className="w-5 h-5" />}
              label="Home"
              active={currentView === "home"}
              onClick={() => navigateTo("home")}
            />
            <TabButton
              icon={
                <div className="relative">
                  <BookX className="w-5 h-5" />
                  {mistakes.length > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-rose-500 text-[9px] font-bold text-white">
                      {mistakes.length}
                    </span>
                  )}
                </div>
              }
              label="Error Book"
              active={currentView === "error_book"}
              onClick={() => navigateTo("error_book")}
            />
            <TabButton
              icon={<Trophy className="w-5 h-5" />}
              label="Progress"
              active={false}
              onClick={() => setShowGamification(true)}
            />
          </div>
        </nav>
      )}

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

const TabButton: React.FC<{
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}> = ({ icon, label, active, onClick }) => (
  <button
    onClick={onClick}
    className={`flex flex-col items-center justify-center gap-0.5 px-4 py-2 rounded-xl transition-colors ${
      active ? "text-brand-600" : "text-stone-400 hover:text-stone-600"
    }`}
  >
    {icon}
    <span className="text-[10px] font-medium">{label}</span>
  </button>
);

export default App;