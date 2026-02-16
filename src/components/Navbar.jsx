"use client";

import React from 'react';
import { Activity, LogIn } from 'lucide-react';
import { UserMenu } from "./UserMenu";

export function Navbar({ user }) {
  return (
    <nav className="h-20 px-8 lg:px-20 flex items-center justify-between bg-white border-b border-gray-200 sticky top-0 z-50">
      {/* Branding Section */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-[#34A832] rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/20">
          <Activity className="text-white" size={24} strokeWidth={3} />
        </div>
        <span className="text-2xl font-black tracking-tighter italic text-slate-900 uppercase">
          QueueCare
        </span>
      </div>
      
      {/* Dynamic Action Area: Menu for Staff / Login for Customers */}
      <div className="relative group">
        {user ? (
          <>
            <div className="absolute inset-0 bg-gray-100 rounded-xl translate-x-1 translate-y-1 group-hover:translate-x-2 group-hover:translate-y-2 transition-transform duration-300" />
            <div className="relative transition-transform duration-300 group-hover:-translate-x-0.5 group-hover:-translate-y-0.5">
              <UserMenu user={user} />
            </div>
          </>
        ) : (
          <button className="relative group/btn">
            <div className="absolute inset-0 bg-slate-900 rounded-xl translate-x-1 translate-y-1 group-hover/btn:translate-x-2 group-hover/btn:translate-y-2 transition-transform duration-300" />
            <div className="relative bg-[#34A832] text-white px-6 py-2.5 rounded-xl font-black uppercase text-xs tracking-widest flex items-center gap-2 transition-transform duration-300 group-hover/btn:-translate-x-0.5 group-hover/btn:-translate-y-0.5 shadow-lg">
              <span>Login</span>
              <LogIn size={14} strokeWidth={3} />
            </div>
          </button>
        )}
      </div>
    </nav>
  );
}