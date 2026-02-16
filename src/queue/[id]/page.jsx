"use client";

import React from 'react';
import { useParams } from 'next/navigation'; // Use this to get the ID
import { Container, Box, Text, Paper, Stack, Title, Group } from '@mantine/core';
import { Activity, AlertCircle } from 'lucide-react';
import Link from 'next/link';

export default function QueueStatusPage() {
  const params = useParams();
  const ticketId = params?.id || "---"; // This grabs "A006" from the URL

  return (
    <Box className="min-h-screen bg-[#EBEDF0] flex flex-col font-sans">
      <nav className="h-16 px-8 lg:px-32 flex items-center bg-white border-b border-gray-200 sticky top-0 z-50">
        <Group gap="xs">
          <Box className="w-8 h-8 bg-health-green rounded-lg flex items-center justify-center">
            <Activity className="text-white" size={20} strokeWidth={3} />
          </Box>
          <Text className="text-xl font-black tracking-tighter italic text-slate-900 uppercase">QueueCare</Text>
        </Group>
      </nav>

      <Container size="sm" className="flex-1 flex items-center justify-center py-10 w-full">
        <Paper radius={40} p={60} withBorder className="bg-white w-full flex flex-col items-center gap-12 shadow-sm border-gray-100">
          <Box className="relative w-full max-w-[340px]">
            <Box className="absolute inset-0 bg-black/5 translate-x-3 translate-y-3" style={{ clipPath: 'polygon(0% 0%, 100% 0%, 100% 95%, 95% 100%, 90% 95%, 85% 100%, 80% 95%, 75% 100%, 70% 95%, 65% 100%, 60% 95%, 55% 100%, 50% 95%, 45% 100%, 40% 95%, 35% 100%, 30% 95%, 25% 100%, 20% 95%, 15% 100%, 10% 95%, 5% 100%, 0% 95%)' }} />
            <Box className="relative bg-white border-2 border-gray-200 p-10 flex flex-col items-center text-center shadow-sm" style={{ borderRadius: '16px 16px 0 0', clipPath: 'polygon(0% 0%, 100% 0%, 100% 95%, 95% 100%, 90% 95%, 85% 100%, 80% 95%, 75% 100%, 70% 95%, 65% 100%, 60% 95%, 55% 100%, 50% 95%, 45% 100%, 40% 95%, 35% 100%, 30% 95%, 25% 100%, 20% 95%, 15% 100%, 10% 95%, 5% 100%, 0% 95%)' }}>
              <Stack gap={0} className="mb-10">
                <Text className="text-slate-400 font-black text-xs uppercase tracking-[0.2em] mb-2">คิวของคุณคือ</Text>
                <Text className="text-xl font-black text-slate-800 leading-tight">โรงพยาบาลปทุมธานี</Text>
              </Stack>
              <Title className="text-[96px] font-black text-slate-900 leading-none tracking-tighter mb-14">{ticketId}</Title>
              <Box className="relative w-full">
                <Box className="absolute inset-0 bg-emerald-900 rounded-2xl translate-x-2 translate-y-2" />
                <Box className="relative bg-health-green py-5 px-6 rounded-2xl flex flex-col items-center justify-center text-white border border-emerald-400/20">
                  <Text className="text-[10px] font-black uppercase tracking-[0.3em] opacity-80 mb-1">เวลารอ ประมาณ</Text>
                  <Text className="text-2xl font-black">20 นาที</Text>
                </Box>
              </Box>
            </Box>
          </Box>
          <Box className="relative group w-full max-w-[200px] mt-4">
            <Box className="absolute inset-0 bg-red-900 rounded-2xl translate-x-1.5 translate-y-1.5" />
            <Link href="/join">
              <button className="relative w-full py-4 bg-[#FF0000] text-white font-black rounded-2xl flex items-center justify-center gap-2 transition-transform active:translate-x-1 active:translate-y-1">
                <AlertCircle size={18} strokeWidth={3} />
                ยกเลิกคิว
              </button>
            </Link>
          </Box>
        </Paper>
      </Container>
    </Box>
  );
}