import React, { useState, useEffect } from "react";
import { useAppStore } from "./store";
import { ViewState, TestConfig, User } from "./types";
import { Home } from "./components/Home";
import { Manager } from "./components/Manager";
import { TestSession } from "./components/TestSession";
import { Login } from "./components/Login";
import { UserManagement } from "./components/UserManagement";
import { ErrorBook } from "./components/ErrorBook";
import { WordLibrary } from "./components/WordLibrary";
import { LogOut, Users, BookX, Library } from "lucide-react";
import { clearSession } from "./db";

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentView, setCurrentView] = useState<ViewState>("home");
  const [testConfig, setTestConfig] = useState<TestConfig | null>(null);

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

  const handleLogin = (user: User, _token: string) => {
    setCurrentUser(user);
    // token 由 db.setSession() 在 login()/register() 内保存
    setCurrentView("home");
  };

  const handleLogout = () => {
    setCurrentUser(null);
    clearSession();
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
    if (testConfig?.mode === "review") {
      // 等待所有 review 结果写入，避免 fire-and-forget 导致数据丢失
      await Promise.all(
        results.map((result) =>
          handleReviewResult(result.wordId, result.isCorrect),
        ),
      );
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
    </div>
  );
};

export default App;
