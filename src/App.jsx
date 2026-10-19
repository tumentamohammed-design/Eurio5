import { useEffect, useState, Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useApp } from './context/AppContext.jsx';
import { SocialProvider } from './context/SocialContext.jsx';
import { BrokersProvider } from './context/BrokersContext.jsx';
import { MessagesProvider } from './context/MessagesContext.jsx';
import LandingPage from './components/Landing/LandingPage.jsx';
import Login from './components/Auth/Login.jsx';
import Header from './components/Layout/Header.jsx';
import { Sidebar, BottomNav } from './components/Layout/NavTabs.jsx';
import CommandPalette from './components/Layout/CommandPalette.jsx';
import TradeList from './components/Journal/TradeList.jsx';

// Lazy-loaded: keeps recharts/Stripe/social/chart data out of the initial
// bundle until the user actually opens a tab that needs them.
const Dashboard = lazy(() => import('./components/Dashboard/Dashboard.jsx'));
const TradeForm = lazy(() => import('./components/Journal/TradeForm.jsx'));
const LiquidityClock = lazy(() => import('./components/LiquidityClock/LiquidityClock.jsx'));
const FxCalendar = lazy(() => import('./components/Calendar/FxCalendar.jsx'));
const RulesManager = lazy(() => import('./components/Rules/RulesManager.jsx'));
const WeeklyReport = lazy(() => import('./components/WeeklyReport/WeeklyReport.jsx'));
const BillingPanel = lazy(() => import('./components/Billing/BillingPanel.jsx'));
const ReferralPage = lazy(() => import('./components/Referral/ReferralPage.jsx'));
const AdminDashboard = lazy(() => import('./components/Admin/AdminDashboard.jsx'));
const TradersPage = lazy(() => import('./components/Traders/TradersPage.jsx'));
const Feed = lazy(() => import('./components/Feed/Feed.jsx'));
const BrokerDirectory = lazy(() => import('./components/Brokers/BrokerDirectory.jsx'));
const PropFirmDirectory = lazy(() => import('./components/Brokers/PropFirmDirectory.jsx'));
const Messages = lazy(() => import('./components/Messages/Messages.jsx'));
const ChartPage = lazy(() => import('./components/Chart/ChartPage.jsx'));
const BacktestPage = lazy(() => import('./components/Backtest/BacktestPage.jsx'));
const SettingsPage = lazy(() => import('./components/Settings/SettingsPage.jsx'));

function TabFallback() {
  return <div className="text-sm text-slate-500 py-16 text-center font-data">Loading…</div>;
}

function FullScreenLoading() {
  return <div className="min-h-screen flex items-center justify-center text-slate-500 font-data text-sm">Loading…</div>;
}

function AppShell() {
  const { isAdmin, loadProfile } = useApp();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [editingTrade, setEditingTrade] = useState(null);
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.has('upgraded') || params.has('upgrade_cancelled')) {
      if (params.get('upgraded') === '1') loadProfile();
      window.history.replaceState({}, '', '/app');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keyboard shortcut: Ctrl/Cmd+K opens search, same convention as most
  // command palettes (Slack, Linear, VS Code).
  useEffect(() => {
    function handleKey(e) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, []);

  function goToTab(id) {
    if (id === 'add') setEditingTrade(null);
    setActiveTab(id);
  }

  function openEdit(trade) {
    setEditingTrade(trade);
    setActiveTab('add');
  }

  function finishForm() {
    setEditingTrade(null);
    setActiveTab('journal');
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <Header onOpenSearch={() => setSearchOpen(true)} />
      <CommandPalette open={searchOpen} onClose={() => setSearchOpen(false)} onNavigate={goToTab} isAdmin={isAdmin} />
      <div className="max-w-6xl mx-auto flex">
        <Sidebar activeTab={activeTab} onSelect={goToTab} isAdmin={isAdmin} />
        <main className="flex-1 p-4 md:p-8 pb-24 md:pb-8 min-w-0">
          <Suspense fallback={<TabFallback />}>
            {activeTab === 'dashboard' && <Dashboard onLogTrade={() => goToTab('add')} />}
            {activeTab === 'journal' && <TradeList onAdd={() => goToTab('add')} onEdit={openEdit} />}
            {activeTab === 'add' && <TradeForm editingTrade={editingTrade} onDone={finishForm} />}
            {activeTab === 'chart' && <ChartPage />}
            {activeTab === 'backtest' && <BacktestPage />}
            {activeTab === 'clock' && <LiquidityClock />}
            {activeTab === 'calendar' && <FxCalendar />}
            {activeTab === 'rules' && <RulesManager />}
            {activeTab === 'weekly' && <WeeklyReport />}
            {activeTab === 'traders' && <TradersPage onMessage={() => goToTab('messages')} />}
            {activeTab === 'messages' && <Messages />}
            {activeTab === 'feed' && <Feed />}
            {activeTab === 'brokers' && <BrokerDirectory />}
            {activeTab === 'funded' && <PropFirmDirectory />}
            {activeTab === 'billing' && <BillingPanel />}
            {activeTab === 'referral' && <ReferralPage />}
            {activeTab === 'settings' && <SettingsPage />}
            {activeTab === 'admin' && isAdmin && <AdminDashboard />}
          </Suspense>
        </main>
      </div>
      <BottomNav activeTab={activeTab} onSelect={goToTab} isAdmin={isAdmin} />
    </div>
  );
}

function RequireAuth({ children }) {
  const { user, authLoading } = useApp();
  if (authLoading) return <FullScreenLoading />;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function LoginRoute() {
  const { user, authLoading } = useApp();
  if (authLoading) return <FullScreenLoading />;
  if (user) return <Navigate to="/app" replace />;
  return <Login />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginRoute />} />
        <Route
          path="/app"
          element={
            <RequireAuth>
              <SocialProvider>
                <BrokersProvider>
                  <MessagesProvider>
                    <AppShell />
                  </MessagesProvider>
                </BrokersProvider>
              </SocialProvider>
            </RequireAuth>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
