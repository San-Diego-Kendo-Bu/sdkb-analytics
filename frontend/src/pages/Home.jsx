import { useState, useEffect } from 'react';
import { renderTable, layoutShelf, setupEventListeners } from '../js/nafudaManager.js';

import * as buttonLogic from '../js/buttonLogic.js';
import { userManager } from '../js/cognitoManager.js';
import AdminControl from './AdminControl.jsx';
import EventsSignup from './EventsSignup.jsx';
import Pay from './Pay.jsx';
import AnnouncementsView from './AnnouncementsView.jsx';
import Profile from './Profile.jsx';
import Overview from './Overview.jsx';
import ResultsSummary from './ResultsSummary.jsx';

const BASE_TABS = ['Nafudakake', 'Pay', 'Events', 'Announcements', 'Results'];

const Placeholder = ({ title }) => (
  <div className='p-4 bg-white border rounded shadow-sm text-center text-muted'>
    <h4 className='mb-2'>{title}</h4>
    <p className='mb-0'>Coming soon.</p>
  </div>
);

const Content = ({ activeTab, setActiveTab, pendingPaymentId, setPendingPaymentId }) => {
  if (activeTab === 'Nafudakake') {
    return null;
  }
  if (activeTab === 'Overview') {
    return <Overview onNavigate={setActiveTab} />;
  }
  if (activeTab === 'Admin Control') {
    return <AdminControl />;
  }
  if (activeTab === 'Events') {
    return (
      <EventsSignup
        onPayNavigate={(pid) => { setPendingPaymentId(pid); setActiveTab('Pay'); }}
      />
    );
  }
  if (activeTab === 'Pay') {
    return (
      <Pay
        autoPaymentId={pendingPaymentId}
        onAutoPayConsumed={() => setPendingPaymentId(null)}
      />
    );
  }
  if (activeTab === 'Announcements') {
    return <AnnouncementsView />;
  }
  if (activeTab === 'Results') {
    return <ResultsSummary />;
  }
  if (activeTab === 'My Profile') {
    return <Profile />;
  }
  return <Placeholder title={activeTab} />;
};

export default function App() {
  const [activeTab, setActiveTab] = useState('Nafudakake');
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [pendingPaymentId, setPendingPaymentId] = useState(null);
  const [showAbout, setShowAbout] = useState(false);
  const [isDark, setIsDark] = useState(() => localStorage.getItem('theme') !== 'light');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
  }, [isDark]);

  useEffect(() => {
    async function checkUser() {
      const user = await userManager.getUser();
      if (!user || user.expired) {
        setIsSignedIn(false);
        setIsAdmin(false);
        return;
      }
      setIsSignedIn(true);
      setActiveTab('Overview');
      try {
        const res = await fetch('https://qh3c0tz6s9.execute-api.us-east-2.amazonaws.com/admins', {
          method: 'GET',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${user.id_token}` }
        });
        const data = await res.json();
        console.log('[checkUser] status:', res.status, '| email:', user.profile?.email, '| isAdmin:', !!data.isAdmin);
        if (res.ok) setIsAdmin(!!data.isAdmin);
      } catch {
        // not admin
      }
    }

    checkUser();

    const onLoaded = () => checkUser();
    const onUnloaded = () => {
      setIsSignedIn(false);
      setIsAdmin(false);
      setActiveTab('Nafudakake');
    };

    userManager.events.addUserLoaded(onLoaded);
    userManager.events.addUserUnloaded(onUnloaded);
    userManager.events.addUserSignedOut(onUnloaded);

    return () => {
      userManager.events.removeUserLoaded(onLoaded);
      userManager.events.removeUserUnloaded(onUnloaded);
      userManager.events.removeUserSignedOut(onUnloaded);
    };
  }, []);

  const tabs = isSignedIn
    ? (isAdmin ? [...BASE_TABS, 'Admin Control', 'My Profile'] : [...BASE_TABS, 'My Profile'])
    : ['Nafudakake'];

  useEffect(() => {
    const nafudakakeContent = document.getElementById('nafudakake-content');
    const handleResize = () => layoutShelf();

    if (activeTab === 'Nafudakake' && nafudakakeContent) {
      nafudakakeContent.classList.add('active');
      renderTable();
      buttonLogic.setButtonsDisplay();
      setupEventListeners();
      window.addEventListener('resize', handleResize);
    } else if (nafudakakeContent) {
      nafudakakeContent.classList.remove('active');
    }

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [activeTab]);

  useEffect(() => {
    const signInBtn = document.getElementById('signIn');
    const signOutBtn = document.getElementById('signOut');

    if (signInBtn) signInBtn.addEventListener('click', buttonLogic.signInLogic);
    if (signOutBtn) signOutBtn.addEventListener('click', buttonLogic.signOutLogic);

    buttonLogic.setButtonsDisplay();

    return () => {
      if (signInBtn) signInBtn.removeEventListener('click', buttonLogic.signInLogic);
      if (signOutBtn) signOutBtn.removeEventListener('click', buttonLogic.signOutLogic);
    };
  }, []);

  return (
    <div style={{ background: 'var(--bg-primary)', minHeight: activeTab === 'Nafudakake' ? 0 : '100vh' }}>
      <nav style={{ background: '#87CEEB', borderBottom: '1px solid #5ba8cc', padding: '0.5rem 0', marginBottom: 0 }} className='navbar navbar-expand-lg'>
        <div className='container-fluid'>
          <a
            className='navbar-brand'
            href='#'
            onClick={(e) => { e.preventDefault(); setActiveTab(isSignedIn ? 'Overview' : 'Nafudakake'); }}
            style={{ padding: 0 }}
          >
            <img src='/assets/icons/SDKB-logo.png' alt='SDKB' style={{ height: 42, width: 'auto', display: 'block' }} />
          </a>
          <button
            className='navbar-toggler'
            type='button'
            data-bs-toggle='collapse'
            data-bs-target='#navbarNav'
            style={{ borderColor: '#1a1a2e' }}
          >
            <span className='navbar-toggler-icon'></span>
          </button>
          <div className='collapse navbar-collapse' id='navbarNav'>
            <ul className='navbar-nav me-auto'>
              {tabs.map((tab) => (
                <li className='nav-item' key={tab}>
                  <a
                    onClick={() => setActiveTab(tab)}
                    style={{
                      cursor: 'pointer',
                      display: 'block',
                      padding: '0.5rem 1rem',
                      color: activeTab === tab ? '#1a1a2e' : '#2a4a5e',
                      fontWeight: activeTab === tab ? 700 : 400,
                      borderBottom: activeTab === tab ? '2px solid #1a1a2e' : '2px solid transparent',
                      textDecoration: 'none',
                      fontSize: '0.9rem',
                    }}
                  >
                    {tab}
                  </a>
                </li>
              ))}
            </ul>
            <div className='d-flex gap-2 align-items-center'>
              <button
                onClick={() => setIsDark(d => !d)}
                title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
                style={{ background: 'transparent', border: '1px solid #1a1a2e', color: '#1a1a2e', borderRadius: '50%', width: 28, height: 28, fontSize: '0.85rem', cursor: 'pointer', lineHeight: 1, padding: 0, flexShrink: 0 }}
              >{isDark ? '☀' : '☾'}</button>
              <button
                onClick={() => setShowAbout(true)}
                style={{ background: 'transparent', border: '1px solid #1a1a2e', color: '#1a1a2e', borderRadius: '50%', width: 28, height: 28, fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', lineHeight: 1, padding: 0, flexShrink: 0 }}
              >?</button>
              <button id='signIn' className='btn' style={{ background: '#1a1a2e', color: '#fff', fontWeight: 600 }}>
                Sign In
              </button>
              <button
                id='signOut'
                className='btn'
                style={{ background: 'transparent', border: '1px solid #1a1a2e', color: '#1a1a2e', display: 'none' }}
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </nav>
      {activeTab !== 'Nafudakake' && <Content activeTab={activeTab} setActiveTab={setActiveTab} pendingPaymentId={pendingPaymentId} setPendingPaymentId={setPendingPaymentId} />}

      {showAbout && (
        <div
          onClick={() => setShowAbout(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 12, padding: '2rem', maxWidth: 480, width: '100%', color: 'var(--text-body)', position: 'relative', lineHeight: 1.7 }}
          >
            <button
              onClick={() => setShowAbout(false)}
              style={{ position: 'absolute', top: '0.75rem', right: '0.75rem', background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '1.2rem', cursor: 'pointer' }}
            >✕</button>
            <p style={{ margin: 0, fontSize: '0.95rem' }}>
              This app was created by a group of students and full-time developers who generously volunteered their free time to give back to their former dojo, San Diego Kendo Bu. I would especially like to thank our UCSD alumni Gabe I., Rahul P., Ben L., and Aidan M. for their invaluable contributions. Whether your contributions were large or small, each of you played an important role in making this app a reality.
            </p>
            <p style={{ margin: '1rem 0 0 0', fontSize: '0.95rem' }}>
              Please forward app inquiries to Isamu Goto.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}