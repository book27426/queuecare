import React from 'react';
import Link from 'next/link';
import { Activity, ArrowRight, LogIn, Clock, ShieldCheck } from 'lucide-react';

export default function IndexPage() {
  return (
    <div className="min-h-screen bg-[#F0F2F5] flex flex-col font-sans antialiased">
      
      {/* 1. NAVIGATION BAR */}
      <nav className="h-20 px-8 lg:px-20 flex items-center justify-between bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-health-green rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <Activity className="text-white" size={24} strokeWidth={3} />
          </div>
          <span className="text-2xl font-black tracking-tighter italic text-slate-900">QueueCare</span>
        </div>
        
        <Link href="/staff">
          <button className="px-8 py-2.5 bg-staff-blue hover:bg-blue-600 text-white font-bold rounded-xl transition-all shadow-md active:scale-95">
            Login
          </button>
        </Link>
      </nav>

      {/* 2. MAIN WORKSPACE SLAB */}
      <main className="flex-1 flex items-center justify-center p-6 lg:p-12">
        <div className="bg-white w-full max-w-7xl rounded-[48px] shadow-sm border border-gray-100 p-10 md:p-20 flex flex-col md:flex-row items-center gap-16">
          
          {/* LEFT: THE CLINICAL VISUAL */}
          <div className="w-full md:w-1/2">
            <div className="relative aspect-[4/3] rounded-[48px] overflow-hidden border-[12px] border-[#F2F4F7] shadow-2xl">
              <img 
                src="https://images.unsplash.com/photo-1576091160550-2173dba999ef?auto=format&fit=crop&w=800" 
                alt="Medical Professional"
                className="w-full h-full object-cover"
              />
            </div>
          </div>

          {/* RIGHT: THE REAL CONTENT */}
          <div className="w-full md:w-1/2 space-y-10">
            <div className="space-y-6">
              <h1 className="text-6xl lg:text-7xl font-black text-slate-900 leading-[1.05] tracking-tight">
                Queue <span className="text-health-green">Care</span>, <br />
                Anywhere.
              </h1>
              
              {/* RESTORED CONTENT: Replacing the boxes with actual copy */}
              <div className="space-y-6 max-w-lg">
                <p className="text-2xl font-semibold text-slate-500 leading-relaxed">
                  Skip the waiting room. Experience real-time transparency in healthcare with your signature queuing partner.
                </p>
                
                <ul className="space-y-4">
                  <li className="flex items-center gap-3 text-slate-600 font-bold text-lg">
                    <div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center text-health-green">
                      <Clock size={20} />
                    </div>
                    Live wait-time estimates & updates
                  </li>
                  <li className="flex items-center gap-3 text-slate-600 font-bold text-lg">
                    <div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center text-health-green">
                      <ShieldCheck size={20} />
                    </div>
                    Verified medical institutions only
                  </li>
                </ul>
              </div>
            </div>

            {/* 3. SIGNATURE 45° ACTIONS */}
            <div className="flex flex-col sm:flex-row items-center gap-10 pt-6">
              
              {/* Join Queue (Green) */}
              <Link href="/join" className="w-full sm:w-auto relative group">
                <div className="absolute inset-0 bg-health-green-depth rounded-3xl translate-x-2 translate-y-2 group-hover:translate-x-4 group-hover:translate-y-4 transition-transform duration-300 ease-out" />
                <button className="relative w-full flex items-center justify-center gap-4 px-12 py-5 bg-health-green text-white text-2xl font-black rounded-3xl border-2 border-emerald-400/20 transition-all duration-300 ease-out transform group-hover:-translate-x-1 group-hover:-translate-y-1 active:translate-x-1 active:translate-y-1">
                  Join Queue <ArrowRight strokeWidth={4} size={28} />
                </button>
              </Link>
              
              {/* Login (Blue) */}
              <Link href="/staff" className="w-full sm:w-auto relative group">
                <div className="absolute inset-0 bg-gray-200 rounded-3xl translate-x-2 translate-y-2 group-hover:translate-x-4 group-hover:translate-y-4 transition-transform duration-300 ease-out" />
                <button className="relative w-full flex items-center justify-center gap-4 px-12 py-5 bg-white border-2 border-gray-100 text-slate-900 group-hover:text-staff-blue group-hover:border-staff-blue text-2xl font-black rounded-3xl transition-all duration-300 ease-out transform group-hover:-translate-x-1 group-hover:-translate-y-1 active:translate-x-1 active:translate-y-1">
                  Login <LogIn size={28} />
                </button>
              </Link>

            </div>
          </div>
        </div>
      </main>

      <footer className="p-10 text-center text-gray-400 font-bold text-xs tracking-widest uppercase border-t border-gray-100/50">
      </footer>
    </div>
  );
}