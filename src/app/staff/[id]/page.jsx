"use client";

import React, { useState, useEffect } from 'react';
import { Box, Text, Title, Paper, Group, Stack, SimpleGrid, Skeleton } from '@mantine/core';
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
  const [loading, setLoading] = useState(true);

  const [overallStats, setOverallStats] = useState([
    { label: "New Queue / H", value: "+0%", avg: "0", color: "#0091FF" },
    { label: "Complete / H", value: "+0%", avg: "0", color: "#10B981" },
    { label: "Avg Op Time", value: "-0m", avg: "0", color: "#6366F1" },
  ]);
  const [waitlist, setWaitlist] = useState([]);
  const [sections, setSections] = useState([
    { id: 'S1', name: "ทำฟัน", current: "...", status: "#94A3B8", stats: [] },
    { id: 'S2', name: "ผู้ป่วยทั่วไป", current: "B006", status: "#F59E0B", stats: [] },
    { id: 'S3', name: "ผู้ป่วยกระดูกหัก", current: "C006", status: "#EF4444", stats: [] }
  ]);

  const safeJson = async (response) => {
    const contentType = response.headers.get("content-type");
    if (response.ok && contentType && contentType.includes("application/json")) {
      return await response.json();
    }
    return null;
  };

  const fetchData = async () => {
    try {
      const [resOverall, resQueue, resS1] = await Promise.allSettled([
        fetch("/api-proxy/api/v1/static/overall"),
        fetch("/api-proxy/api/v1/static/queue_list"),
        fetch("/api-proxy/api/v1/static/section/1")
      ]);

      if (resOverall.status === 'fulfilled') {
        const data = await safeJson(resOverall.value);
        if (data) {
          setOverallStats([
            { label: "New Queue / H", value: "+12%", avg: data?.est_new_queue_per_hour ?? "0", color: "#0091FF" },
            { label: "Complete / H", value: "+5%", avg: data?.est_complete_case_per_hour ?? "0", color: "#10B981" },
            { label: "Avg Op Time", value: "-2m", avg: data?.est_avg_operation_t ?? "0", color: "#6366F1" },
          ]);
        }
      }

      if (resQueue.status === 'fulfilled') {
        const dataQueue = await safeJson(resQueue.value);
        if (dataQueue) setWaitlist(dataQueue?.queue_list || []);
      }

      if (resS1.status === 'fulfilled') {
        const dataS1 = await safeJson(resS1.value);
        if (dataS1) {
          setSections(prev => {
            const newSections = [...prev];
            newSections[0] = {
              ...newSections[0],
              current: dataS1?.current_queue ?? "N/A",
              status: "#10B981",
              stats: [
                { l: "QUEUE", v: dataS1?.stats?.queue_count ?? "0", u: dataS1?.stats?.queue_trend ?? "0", c: "#0091FF" },
                { l: "CASES", v: dataS1?.stats?.case_count ?? "0", u: dataS1?.stats?.case_trend ?? "0", c: "#10B981" },
                { l: "TIME", v: dataS1?.stats?.avg_time ?? "0m", u: dataS1?.stats?.time_trend ?? "0", c: "#0091FF" }
              ]
            };
            return newSections;
          });
        }
      }
      setLoading(false);
    } catch (error) {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    const timer = setInterval(() => setActiveStatIndex((prev) => (prev + 1) % 3), 8000);
    return () => { clearInterval(interval); clearInterval(timer); };
  }, []);

  const getTrendColor = (trendValue) => {
    if (!trendValue) return "#F59E0B";
    if (trendValue.includes('+')) return "#EF4444"; 
    if (trendValue.includes('-')) return "#10B981"; 
    return "#F59E0B"; 
  };

  if (loading) return <Box p={50}><Stack gap="xl"><Skeleton height={50} radius="xl" /><Skeleton height={200} radius={48} /></Stack></Box>;

  return (
    <div className="min-h-screen bg-[#F0F2F5] flex flex-col font-sans antialiased">
      <Navbar user={{ name: "DR. A" }} />
      <main className="flex-1 flex flex-col lg:flex-row p-5 lg:p-12 gap-10 max-w-[1600px] mx-auto w-full">
        <div className="flex-1 flex flex-col gap-10">
          <Paper radius={48} p={48} withBorder className="bg-white shadow-sm border-gray-100 flex flex-col gap-10">
            <Group justify="space-between" align="flex-end" className="mb-10"> 
              <Stack gap={0}>
                <Title className="text-4xl font-black text-slate-900 uppercase italic">กระทรวงสาธารณสุข</Title>
                <Text className="text-lg font-bold text-slate-400 italic">Facility Control Center</Text>
              </Stack>
            </Group>

            <SimpleGrid cols={{ base: 1, sm: 3 }} spacing={40}>
              {overallStats.map((stat, i) => (
                <Paper key={i} radius={32} p={28} withBorder className="bg-white border-gray-50 flex flex-col gap-6">
                  <Group justify="space-between" align="center">
                    <Text className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">{stat.label}</Text>
                    <Group gap={6} align="baseline">
                      <Text className="text-2xl font-black text-slate-900">{stat.avg}</Text>
                      <Text className="text-[12px] font-bold" style={{ color: getTrendColor(stat.value) }}>({stat.value})</Text>
                    </Group>
                  </Group>
                </Paper>
              ))}
            </SimpleGrid>

            <SimpleGrid cols={{ base: 1, sm: 2, xl: 3 }} spacing={32}>
              {sections.map((section) => (
                <div key={section.id} className="relative group cursor-pointer">
                  <div className="absolute inset-0 bg-black/5 rounded-[44px] translate-x-2 translate-y-2 group-hover:translate-x-4 group-hover:translate-y-4 transition-transform duration-300" />
                  <div className="relative h-full bg-white border-2 border-gray-50 rounded-[44px] overflow-hidden shadow-sm transition-all group-hover:-translate-y-2">
                    <Link href={`/staff/${hospitalId}/${section.id}`} className="no-underline block p-6">
                      <Group justify="space-between" mb="lg">
                        <Text className="text-base font-black text-slate-900 uppercase italic truncate">{section.name}</Text>
                        <Box className="w-4 h-4 rounded-full border-2 border-white animate-pulse" style={{ backgroundColor: section.status }} />
                      </Group>
                      <div className="grid grid-cols-[80px_1fr] gap-3 h-[110px]"> 
                        <Box className="bg-[#F8FAFC] rounded-[24px] flex flex-col items-center justify-center border border-gray-50">
                          <Text className="text-[7px] font-black text-slate-300 uppercase mb-1">Serving</Text>
                          <Text className="text-xl font-black text-slate-900 italic leading-none">{section.current}</Text>
                        </Box>
                        <Box className="bg-[#F8FAFC] rounded-[24px] overflow-hidden">
                          <div className="transition-all duration-700 ease-in-out w-full" style={{ transform: `translateY(-${activeStatIndex * 110}px)` }}>
                            {section.stats.length > 0 ? section.stats.map((m, idx) => (
                              <div key={idx} className="h-[110px] flex flex-col justify-between p-4">
                                <Group justify="space-between" align="flex-start">
                                  <Text className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{m.l}</Text>
                                  <Stack gap={0} align="flex-end">
                                    <Text className="text-base font-black text-slate-900">{m.v}</Text>
                                    <Text className="text-[9px] font-bold" style={{ color: getTrendColor(m.u) }}>({m.u})</Text>
                                  </Stack>
                                </Group>
                              </div>
                            )) : <div className="h-[110px] flex items-center justify-center"><Text size="xs" color="dimmed">No Data</Text></div>}
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

        <div className="w-full lg:w-80 flex flex-col h-fit">
          <Paper radius={40} withBorder className="bg-white border-gray-100 shadow-xl flex flex-col overflow-hidden h-[700px]">
            <div className="p-8 border-b border-gray-50 bg-[#FBFBFC]">
              <Title order={3} className="text-lg font-black text-slate-900 uppercase italic">Next In Line</Title>
              <Text className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Live Active Pool</Text>
            </div>
            <div className="flex-1 p-5 space-y-4 overflow-y-auto bg-slate-50/30">
              {waitlist.length > 0 ? waitlist.map((item, i) => (
                <Box key={i} className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm flex items-center justify-between">
                  <Stack gap={0}>
                    <Text className="text-lg font-black text-slate-900 leading-none italic">{item.id}</Text>
                    <Text className="text-[9px] font-black text-slate-300 uppercase mt-1">{item.name}</Text>
                  </Stack>
                  <Group gap={4} className="bg-emerald-50 px-3 py-1 rounded-full">
                    <Clock size={10} className="text-[#34A832]" strokeWidth={4} />
                    <Text className="text-[10px] font-black text-[#34A832]">{item.est || "15m"}</Text>
                  </Group>
                </Box>
              )) : (
                /* ✅ แก้ไขจุดนี้: เปลี่ยน textAlign เป็น ta */
                <Box p="md" ta="center">
                  <Text size="xs" color="dimmed">Empty Queue List</Text>
                </Box>
              )}
            </div>
          </Paper>
        </div>
      </main>
      <CenterDispatchModal opened={opened} onClose={close} sectionName="" />
    </div>
  );
}