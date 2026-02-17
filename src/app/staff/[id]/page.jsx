"use client";

import React, { useState, useEffect } from 'react';
import { Box, Text, Title, Paper, Group, Stack, SimpleGrid } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { Clock, Plus, Activity } from 'lucide-react';
import { Navbar } from "@/components/Navbar";
import { CenterDispatchModal } from "@/components/CenterDispatchModal";
import Link from 'next/link';
import { useParams } from 'next/navigation';

export default function FacilityStationPage() {
  const params = useParams();
  const hospitalId = params.id;
  const [activeStatIndex, setActiveStatIndex] = useState(0);
  const [opened, { open, close }] = useDisclosure(false);
  const [selectedSection, setSelectedSection] = useState("");
  
  const mockUser = { name: "DR. A" };

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveStatIndex((prev) => (prev + 1) % 3);
    }, 8000);
    return () => clearInterval(timer);
  }, []);

  const getTrendColor = (trendValue) => {
    if (!trendValue) return "#F59E0B";
    if (trendValue.includes('+')) return "#EF4444"; 
    if (trendValue.includes('-')) return "#10B981"; 
    return "#F59E0B"; 
  };

  const overallStats = [
    { label: "New Queue / H", value: "+12%", avg: "45.2", color: "#0091FF" },
    { label: "Complete / H", value: "+5%", avg: "36.8", color: "#10B981" },
    { label: "Avg Op Time", value: "-2m", avg: "14m", color: "#6366F1" },
  ];

  const sections = [
    { 
      id: 'S1', name: "ทำฟัน", current: "A006", status: "#10B981",
      stats: [
        { l: "QUEUE", v: "42", u: "+5", c: "#0091FF" },
        { l: "CASES", v: "38", u: "+8", c: "#10B981" },
        { l: "TIME", v: "10m", u: "-2m", c: "#0091FF" }
      ] 
    },
    { 
      id: 'S2', name: "ผู้ป่วยทั่วไป", current: "B006", status: "#F59E0B",
      stats: [
        { l: "QUEUE", v: "12", u: "+2", c: "#0091FF" },
        { l: "CASES", v: "10", u: "+1", c: "#10B981" },
        { l: "TIME", v: "15m", u: "+3m", c: "#F59E0B" }
      ]
    },
    { 
      id: 'S3', name: "ผู้ป่วยกระดูกหัก", current: "C006", status: "#EF4444",
      stats: [
        { l: "QUEUE", v: "8", u: "-1", c: "#0091FF" },
        { l: "CASES", v: "6", u: "+0", c: "#10B981" },
        { l: "TIME", v: "20m", u: "-5m", c: "#EF4444" }
      ]
    }
  ];

  const waitlist = Array(12).fill({ id: "A007", name: "PATIENT NAME", est: "15m" });

  return (
    <div className="min-h-screen bg-[#F0F2F5] flex flex-col font-sans antialiased">
      <Navbar user={mockUser} />

      <main className="flex-1 flex flex-col lg:flex-row p-5 md:p-6 lg:p-12 gap-6 lg:gap-10 max-w-[1600px] mx-auto w-full">
        
        {/* LEFT COLUMN: PRIMARY WORKSPACE */}
        <div className="flex-1 flex flex-col gap-6 lg:gap-10">
          <Paper 
            radius={{ base: 24, sm: 48 }} 
            p={{ base: 20, sm: 32, md: 48 }} 
            withBorder 
            className="bg-white shadow-sm border-gray-100 flex flex-col gap-6 lg:gap-10">

            {/* HEADER GROUP: Clinical Identity */}
            <Group justify="space-between" align="flex-end" className="mb-6 lg:mb-10"> 
              <Stack gap={0}>
                <Title className="text-2xl md:text-4xl font-black text-slate-900 tracking-tight leading-none uppercase italic">กระทรวงสาธารณสุข</Title>
                <Text className="text-sm md:text-lg font-bold text-slate-400 italic">Facility Control Center</Text>
              </Stack>
              <div className="relative group cursor-pointer">
                <div className="absolute inset-0 bg-[#059669] rounded-2xl translate-x-1 translate-y-1 lg:translate-x-2 lg:translate-y-2 group-hover:translate-x-3 group-hover:translate-y-3 transition-transform duration-300" />
                <button className="relative px-6 py-2.5 lg:px-8 lg:py-3.5 bg-[#34A832] text-white text-sm lg:text-base font-black rounded-2xl flex items-center gap-2 transition-transform duration-300 group-hover:-translate-x-1 group-hover:-translate-y-1 active:translate-x-0.5 active:translate-y-0.5 shadow-lg">
                  New Section <Plus size={20} strokeWidth={4} />
                </button>
              </div>
            </Group>

              {/* Overall Analytics Belt */}
              <Box mb={40}> {/* Added margin bottom to separate from sections */}
                <SimpleGrid 
                  cols={{ base: 1, sm: 3 }} 
                  spacing={40} // Increased gap between cards
                >
                  {overallStats.map((stat, i) => (
                    <Paper key={i} radius={32} p={28} withBorder className="bg-white shadow-sm border-gray-50 flex flex-col gap-6">
                      <Group justify="space-between" align="center">
                        <Text className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400 leading-none">{stat.label}</Text>
                        <Group gap={6} align="baseline">
                          <Text className="text-2xl font-black text-slate-900 leading-none">{stat.avg}</Text>
                          <Text className="text-[12px] font-bold leading-none" style={{ color: getTrendColor(stat.value) }}>({stat.value})</Text>
                        </Group>
                      </Group>
                      
                      {/* Graph Container with internal padding */}
                      <Box 
                        p="md" // Added padding inside the gray box
                        className="bg-[#F8FAFC] rounded-[24px] h-24 flex items-center justify-center border border-gray-100 shadow-[inset_0_2px_8px_rgba(0,0,0,0.06)] overflow-hidden"
                      >
                        <svg viewBox="-10 0 170 40" className="w-full h-full overflow-visible">
                          <path d="M0,35 Q20,10 40,25 T80,5 T120,25 T160,15" fill="none" stroke={stat.color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                          <circle cx="160" cy="15" r="4" fill={stat.color} stroke="white" strokeWidth="2.5" />
                        </svg>
                      </Box>
                    </Paper>
                  ))}
                </SimpleGrid>
              </Box>

            {/* SECTION GRID: Monitor Only Cards (Hoverable & Navigable) */}
            <SimpleGrid cols={{ base: 1, sm: 2, lg: 2, xl: 3 }} spacing={32}>
              {sections.map((section) => (
                <div key={section.id} className="relative group cursor-pointer">
                  {/* Signature Shadow Lift */}
                  <div className="absolute inset-0 bg-black/5 rounded-[44px] translate-x-2 translate-y-2 transition-transform duration-300 group-hover:translate-x-4 group-hover:translate-y-4" />
                  
                  <div className="relative h-full bg-white border-2 border-gray-50 rounded-[44px] overflow-hidden flex flex-col shadow-sm transition-all duration-300 group-hover:-translate-y-2 group-hover:shadow-xl">
                    <Link href={`/staff/${hospitalId}/${section.id}`} className="no-underline block p-6">
                      <Group justify="space-between" align="center" wrap="nowrap" mb="lg">
                        <Group gap="sm" wrap="nowrap">
                          <Box className="w-9 h-9 min-w-[36px] bg-white border border-gray-100 rounded-xl p-1.5 flex items-center justify-center shadow-sm">
                            <img src="https://upload.wikimedia.org/wikipedia/commons/f/f1/Ministry_of_Public_Health_Thailand_Logo.png" className="w-full h-full object-contain" alt="MOPH" />
                          </Box>
                          <Text className="text-base font-black text-slate-900 leading-none uppercase italic truncate">{section.name}</Text>
                        </Group>
                        <Box className="w-4 h-4 rounded-full border-2 border-white animate-pulse" style={{ backgroundColor: section.status }} />
                      </Group>
                      
                      <div className="grid grid-cols-[80px_1fr] gap-3 h-[110px]"> 
                        <Box className="bg-[#F8FAFC] rounded-[24px] flex flex-col items-center justify-center border border-gray-50 shadow-[inset_0_2px_6px_rgba(0,0,0,0.05)]">
                          <Text className="text-[7px] font-black text-slate-300 uppercase tracking-widest mb-1">Serving</Text>
                          <Text className="text-xl font-black text-slate-900 italic leading-none">{section.current}</Text>
                        </Box>
                        <Box className="bg-[#F8FAFC] rounded-[24px] border border-gray-50 shadow-[inset_0_2px_6px_rgba(0,0,0,0.05)] overflow-hidden">
                          <div className="transition-all duration-700 ease-in-out w-full" style={{ transform: `translateY(-${activeStatIndex * 110}px)` }}>
                            {section.stats.map((m, idx) => (
                              <div key={idx} className="h-[110px] flex flex-col justify-between p-4">
                                <Group justify="space-between" align="flex-start" wrap="nowrap">
                                  <Text className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{m.l}</Text>
                                  <Stack gap={0} align="flex-end">
                                    <Text className="text-base font-black text-slate-900 leading-none">{m.v}</Text>
                                    <Text className="text-[9px] font-bold" style={{ color: getTrendColor(m.u) }}>({m.u})</Text>
                                  </Stack>
                                </Group>
                                <Box className="w-full h-8">
                                  <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="w-full h-full overflow-visible">
                                    <path d="M0,35 Q20,33 40,15 T70,25 T100,12" fill="none" stroke={m.c} strokeWidth="3" strokeLinecap="round" />
                                  </svg>
                                </Box>
                              </div>
                            ))}
                          </div>
                        </Box>
                      </div>
                    </Link>
                  </div>
                </div>
              ))}
            </SimpleGrid>
          </Paper>
        </div>

        {/* RIGHT SIDEBAR: COMMAND CENTER & SCROLLABLE ACTIVE POOL */}
        <div className="w-full lg:w-80 flex flex-col h-fit">
          <Paper radius={40} withBorder className="bg-white flex-1 border-gray-100 shadow-sm flex flex-col overflow-hidden">
            
            {/* 1. MASTER COMMAND ZONE */}
            <div className="p-6 md:p-8 border-b border-gray-50 bg-[#FBFBFC] flex flex-col gap-6">
              <div>
                <Title order={3} className="text-lg font-black text-slate-900 uppercase">Queue List</Title>
                <Text className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Active Pool</Text>
              </div>

              <div className="relative group cursor-pointer">
                <div className="absolute inset-0 bg-[#059669] rounded-2xl translate-x-1 translate-y-1 group-hover:translate-x-2 group-hover:translate-y-2 transition-transform duration-300" />
                <button 
                  onClick={() => open()}
                  className="relative w-full py-4 bg-[#34A832] text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] flex items-center justify-center gap-3 transition-transform group-hover:-translate-x-1 group-hover:-translate-y-1 active:scale-95 shadow-lg"
                >
                  Call Next Patient <Activity size={18} strokeWidth={4} />
                </button>
              </div>
            </div>

            {/* 2. SCROLLABLE POOL: Visual Limit 5 */}
            <div 
              className="flex-1 p-4 space-y-3 overflow-y-auto bg-slate-50/30" 
              style={{ maxHeight: '480px' }} // Lock height to show ~5 cards
            >
              {waitlist.map((item, i) => (
                <Box 
                  key={i} 
                  className="bg-white rounded-2xl p-4 border border-gray-100 flex items-center justify-between shadow-sm select-none" // Unclickable
                >
                  <Stack gap={0}>
                    <Text className="text-lg font-black text-slate-900 leading-none">{item.id}</Text>
                    <Text className="text-[9px] font-black text-slate-300 uppercase">{item.name}</Text>
                  </Stack>
                  <Group gap={4} className="bg-emerald-50 px-3 py-1 rounded-full">
                    <Clock size={10} className="text-[#34A832]" strokeWidth={4} />
                    <Text className="text-xs font-black text-[#34A832]">{item.est}</Text>
                  </Group>
                </Box>
              ))}
            </div>

            {/* Subtle Scroll Indicator */}
            <div className="p-3 bg-white border-t border-gray-50 flex justify-center items-center">
              <div className="w-1.5 h-1.5 rounded-full bg-slate-200 animate-bounce" />
            </div>
          </Paper>
        </div>
      </main>

      <CenterDispatchModal opened={opened} onClose={close} sectionName={selectedSection} />
    </div>
  );
}