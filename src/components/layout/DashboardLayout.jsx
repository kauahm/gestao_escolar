import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import MobileNav from './MobileNav';

export default function DashboardLayout() {
  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <Topbar />
      <main className="flex-1 md:ml-64 pt-16 pb-16 md:pb-0 overflow-y-auto p-4 md:p-6">
        <Outlet />
      </main>
      <MobileNav />
    </div>
  );
}