"use client";

import React from 'react';
import Link from 'next/link';
import { TextInput, SimpleGrid, Box, Text, Title, Paper, Group, Stack, ActionIcon } from '@mantine/core';
import { Search, Plus, ExternalLink, Clock, Zap } from 'lucide-react';
import { Navbar } from "@/components/Navbar";

export default function StaffPortalPage() {
  const mockUser = { name: "DR. PATHUM", image: "" };
  
  const managedClinics = [
    { id: 1, name: "ศูนย์บริการทางการแพทย์ปทุมธานี", waitTime: 45, opTime: "8m", logo: "https://upload.wikimedia.org/wikipedia/commons/f/f1/Ministry_of_Public_Health_Thailand_Logo.png" },
    { id: 2, name: "คลินิกเวชกรรมเฉพาะทาง", waitTime: 150, opTime: "12m", logo: "https://upload.wikimedia.org/wikipedia/commons/f/f1/Ministry_of_Public_Health_Thailand_Logo.png" },
    { id: 3, name: "หน่วยบริการสาธารณสุขชุมชน", waitTime: 240, opTime: "15m", logo: "https://upload.wikimedia.org/wikipedia/commons/f/f1/Ministry_of_Public_Health_Thailand_Logo.png" },
    { id: 4, name: "สถาบันวิจัยการแพทย์", waitTime: 30, opTime: "20m", logo: "https://upload.wikimedia.org/wikipedia/commons/f/f1/Ministry_of_Public_Health_Thailand_Logo.png" }
  ];

  const getStatusColor = (waitMinutes) => {
    if (waitMinutes < 60) return "#10B981";
    if (waitMinutes <= 180) return "#F59E0B";
    return "#EF4444";
  };

  return (
    <div className="min-h-screen bg-[#F0F2F5] flex flex-col font-sans antialiased">
      <Navbar user={mockUser} />

      <main className="flex-1 flex items-center justify-center p-6 lg:p-12">
        <div className="bg-white w-full max-w-7xl rounded-[48px] shadow-sm border border-gray-100 p-10 md:p-16 flex flex-col gap-10">
          <div className="flex flex-col lg:flex-row justify-between lg:items-end gap-6 border-b border-gray-50 pb-8">
            <div className="space-y-1">
              <h1 className="text-4xl font-black text-slate-900 tracking-tight">Facility Management</h1>
              <p className="text-lg font-bold text-slate-400 italic">Monitor operational efficiency and queue health.</p>
            </div>

            <div className="flex items-center gap-6">
              <div className="relative group cursor-pointer">
                <div className="absolute inset-0 bg-[#059669] rounded-2xl translate-x-1.5 translate-y-1.5 group-hover:translate-x-4 group-hover:translate-y-4 transition-transform duration-300" />
                <button className="relative px-8 py-3.5 bg-[#34A832] text-white font-black rounded-2xl flex items-center gap-2 transition-transform duration-300 group-hover:-translate-x-1 group-hover:-translate-y-1 active:translate-x-1 active:translate-y-1">
                  Create <Plus size={20} strokeWidth={4} />
                </button>
              </div>

              <div className="relative group w-full md:w-72">
                <div className="absolute inset-0 bg-gray-50 rounded-2xl translate-x-1 translate-y-1" />
                <TextInput
                  size="lg" radius="xl" placeholder="Search..."
                  leftSection={<Search size={20} strokeWidth={4} className="text-slate-300" />}
                  styles={{ input: { backgroundColor: '#F3F4F6', border: 'none', fontWeight: 800, height: '56px' } }}
                />
              </div>
            </div>
          </div>

          <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing={32}>
            {managedClinics.map((clinic) => (
              <Link href={`/staff/${clinic.id}`} key={clinic.id} className="no-underline relative group cursor-pointer">
                <div className="absolute inset-0 bg-black/5 rounded-[32px] translate-x-2 translate-y-2 group-hover:translate-x-5 group-hover:translate-y-5 transition-transform duration-300" />
                <div className="relative h-full w-full bg-white border-2 border-gray-50 rounded-[32px] p-6 flex flex-col gap-8 transition-transform duration-300 group-hover:-translate-x-2 group-hover:-translate-y-2 active:translate-x-1 active:translate-y-1 shadow-sm">
                  <Stack gap={10} className="absolute top-7 right-7" align="center">
                    <Box 
                      className="w-3.5 h-3.5 rounded-full border border-white shadow-lg"
                      style={{ 
                        backgroundColor: getStatusColor(clinic.waitTime),
                        boxShadow: `0 0 12px 2px ${getStatusColor(clinic.waitTime)}66`,
                        filter: 'brightness(1.1)'
                      }}
                    />
                    <ActionIcon variant="transparent" className="text-slate-200 hover:text-[#0091FF] transition-colors" size="md">
                      <ExternalLink size={20} strokeWidth={3} />
                    </ActionIcon>
                  </Stack>

                  <div className="w-16 h-16 bg-white border border-gray-100 rounded-2xl p-3 flex items-center justify-center shadow-sm">
                    <img src={clinic.logo} alt="Logo" className="w-full h-full object-contain grayscale group-hover:grayscale-0 transition-all" />
                  </div>

                  <Text className="text-lg font-black text-slate-900 leading-tight tracking-tight h-12 line-clamp-2">{clinic.name}</Text>

                  <Group grow gap="sm" className="mt-auto">
                    <div className="bg-[#F8FAFC] rounded-2xl p-3 border border-gray-50/50">
                      <Group gap={4} mb={2}>
                        <Clock size={12} className="text-[#34A832]" strokeWidth={3} />
                        <Text className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Wait</Text>
                      </Group>
                      <Text className="text-base font-black text-slate-900">
                        {clinic.waitTime >= 60 ? `${(clinic.waitTime / 60).toFixed(1)}h` : `${clinic.waitTime}m`}
                      </Text>
                    </div>

                    <div className="bg-[#F8FAFC] rounded-2xl p-3 border border-gray-50/50">
                      <Group gap={4} mb={2}>
                        <Zap size={12} className="text-[#0091FF]" strokeWidth={3} />
                        <Text className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Op Time</Text>
                      </Group>
                      <Text className="text-base font-black text-slate-900">{clinic.opTime}</Text>
                    </div>
                  </Group>
                </div>
              </Link>
            ))}
          </SimpleGrid>
        </div>
      </main>

      <footer className="p-10 text-center text-gray-400 font-bold text-xs tracking-widest uppercase border-t border-gray-100/50">
        &copy; 2026 QueueCare Healthcare Solutions &bull; Admin Portal
      </footer>
    </div>
  );
}