import React, { useState, useEffect } from 'react';
import { renderTable, layoutShelf, setupEventListeners } from '../js/nafudaManager.js';

import * as buttonLogic from '../js/buttonLogic.js';
import { userManager } from '../js/cognitoManager.js';
import AdminDashboard from './AdminDashboard.jsx';
import AdminControl from './AdminControl.jsx';
import EventsSignup from './EventsSignup.jsx';
import Pay from './Pay.jsx';
import AnnouncementsView from './AnnouncementsView.jsx';

const BASE_TABS = ['Nafudakake', 'Pay', 'Events', 'Announcements'];

const Placeholder = ({ title }) => (
  <div className='p-4 bg-white border rounded shadow-sm text-center text-muted'>
    <h4 className='mb-2'>{title}</h4>
    <p className='mb-0'>Coming soon.</p>
  </div>
);

const Content = ({ activeTab }) => {
  if (activeTab === 'Nafudakake') {
    return null;
  }
  if (activeTab === 'Admin Control') {
    return <AdminControl />;
  }
  if (activeTab === 'Events') {
    return <EventsSignup />;
  }
  if (activeTab === 'Pay') {
    return <Pay />;
  }
  if (activeTab === 'Announcements') {
    return <AnnouncementsView />;
  }
  return <Placeholder title={activeTab} />;
};

export default function App() {
  const [activeTab, setActiveTab] = useState('Nafudakake');
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    async function checkAdmin() {
      const user = await userManager.getUser();
      if (!user || user.expired) return;
      try {
        const res = await fetch('https://qh3c0tz6s9.execute-api.us-east-2.amazonaws.com/admins', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${user.id_token}`
          }
        });
        const data = await res.json();
        console.log('[checkAdmin] status:', res.status, '| email:', user.profile?.email, '| isAdmin:', !!data.isAdmin);
        if (!res.ok) return;
        setIsAdmin(!!data.isAdmin);
      } catch {
        // not admin
      }
    }
    checkAdmin();
  }, []);

  const tabs = isAdmin ? [...BASE_TABS, 'Admin Control'] : BASE_TABS;

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
    <div style={{ background: '#1a1a2e', minHeight: activeTab === 'Nafudakake' ? 0 : '100vh' }}>
      <nav style={{ background: '#87CEEB', borderBottom: '1px solid #5ba8cc', padding: '0.5rem 0', marginBottom: 0 }} className='navbar navbar-expand-lg'>
        <div className='container-fluid'>
          <a className='navbar-brand' href='#' style={{ color: '#1a1a2e', fontWeight: 700, fontSize: '1.1rem' }}>
            SDKB Portal
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
            <div className='d-flex gap-2'>
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
      {activeTab !== 'Nafudakake' && <Content activeTab={activeTab} />}
    </div>
  );
}