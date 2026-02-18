"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Ticket, Clock, ShieldCheck } from 'lucide-react';
import { Navbar } from "@/components/Navbar";

export default function IndexPage() {
  const router = useRouter();
  const [activeQueueId, setActiveQueueId] = useState(null);

  useEffect(() => {
    const savedQueue = localStorage.getItem('user_queue_id');
    if (savedQueue) {
      setActiveQueueId(savedQueue);
    }
  }, []);

  return (
    <div className="min-h-screen bg-[#F0F2F5] flex flex-col font-sans antialiased">
      <Navbar user={null} /> 

      <main className="flex-1 flex items-center justify-center p-6 lg:p-12">
        <div className="bg-white w-full max-w-7xl rounded-[48px] shadow-sm border border-gray-100 p-10 md:p-20 flex flex-col md:flex-row items-center gap-16">
          <div className="w-full md:w-1/2">
            <div className="relative aspect-[1/1] rounded-[48px] overflow-hidden border-[12px] border-[#F2F4F7] shadow-2xl">
              <img 
                src="https://images.unsplash.com/photo-1576091160550-2173dba999ef?auto=format&fit=crop&w=800" 
                alt="Medical Care" className="w-full h-full object-cover"
              />
            </div>
          </div>

          {/* RIGHT: CONTENT AREA */}
          <div className="w-full md:w-1/2 space-y-12">
            <div className="space-y-6">
              <h1 className="text-6xl lg:text-7xl font-black text-slate-900 leading-[1.05] tracking-tight italic uppercase">
                Queue <span className="text-[#10B981]">Care</span>, <br /> Anywhere.
              </h1>
              
              <div className="space-y-8 max-w-lg">
                <p className="text-2xl font-semibold text-slate-500 italic leading-relaxed">
                  Skip the waiting room. Experience real-time transparency in healthcare.
                </p>
                <ul className="space-y-4">
                  <li className="flex items-center gap-3 text-slate-600 font-bold text-lg">
                    <div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center text-[#10B981]">
                      <Clock size={20} strokeWidth={3} />
                    </div>
                    Live wait-time estimates & updates
                  </li>
                  <li className="flex items-center gap-3 text-slate-600 font-bold text-lg">
                    <div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center text-[#10B981]">
                      <ShieldCheck size={20} strokeWidth={3} />
                    </div>
                    Verified medical institutions only
                  </li>
                </ul>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-8 pt-4">
              <div className="w-full sm:w-auto relative group">
                <div className="absolute inset-0 bg-[#065f46] rounded-3xl translate-x-2 translate-y-2 group-hover:translate-x-3 group-hover:translate-y-3 transition-transform duration-300" />
                <button 
                  onClick={() => router.push('/join')}
                  className="relative w-full flex items-center justify-center gap-4 px-13 py-6 bg-[#10B981] text-white text-2xl font-black rounded-3xl uppercase transition-all group-hover:-translate-x-1 group-hover:-translate-y-1"
                >
                  Join Queue <ArrowRight strokeWidth={4} size={28} />
                </button>
              </div>
              {activeQueueId && (
                <div className="w-full sm:w-auto relative group">
                  <div className="absolute inset-0 bg-slate-200 rounded-3xl translate-x-2 translate-y-2 group-hover:translate-x-3 group-hover:translate-y-3 transition-transform duration-300" />
                  <button 
                    onClick={() => router.push(`/myqueue`)}
                    className="relative w-full flex items-center justify-center gap-4 px-10 py-5 bg-black text-white text-2xl font-black rounded-3xl border-2 border-black uppercase transition-all group-hover:-translate-x-1 group-hover:-translate-y-1 active:translate-x-1 active:translate-y-1 shadow-xl"
                  >
                    <Ticket size={24} strokeWidth={3} className="text-[#10B981]" />
                    คิวของฉัน
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}