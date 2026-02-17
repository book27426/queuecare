"use client";

import React, { useState } from 'react';
import { useParams } from 'next/navigation';
import { Box, Text, Title, Paper, Group, Stack, TextInput, Textarea } from '@mantine/core';
import { CheckCircle, UserX, User, Phone } from 'lucide-react';
import { Navbar } from "@/components/Navbar";
import { DispenseMachine, PaperTicketContent } from "@/components/QueueTicket";
import { motion, AnimatePresence } from 'framer-motion';

export default function SectionDetailPage() {
  const { id, sectionId } = useParams();
  const [currentNumber, setCurrentNumber] = useState(24);
  const [isAnimating, setIsAnimating] = useState(false);
  const [patient, setPatient] = useState({ name: "สมชาย ใจดี", tel: "081-123-4567" });

  const sectionLabel = sectionId === "S1" ? "ทำฟัน" : "ผู้ป่วยทั่วไป";
  const displayId = `A${String(currentNumber).padStart(3, '0')}`;

  const handleFinishCase = () => {
    if (isAnimating) return;
    setIsAnimating(true);
    // แอนิเมชันฉีกร่วงหล่นลงพื้น
    setTimeout(() => {
      setCurrentNumber(prev => prev + 1);
      setIsAnimating(false);
    }, 850);
  };

  return (
    <div className="min-h-screen bg-[#F0F2F5] flex flex-col font-sans antialiased overflow-hidden">
      <Navbar user={{ name: "DR. A" }} />

      <main className="flex-1 p-6 lg:p-12 max-w-[1800px] mx-auto w-full">
        <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr_320px] gap-10 items-stretch">
          
          {/* 1. LEFT COLUMN: PATIENT DATA */}
          <Paper radius={40} p={40} withBorder className="bg-white shadow-sm border-gray-100 h-fit">
            <Stack gap="xl">
              <Title order={2} className="text-2xl font-black italic uppercase">ข้อมูลผู้ป่วย</Title>
              <Stack gap="md">
                <TextInput label="ชื่อผู้ติดต่อ" value={patient.name} onChange={(e) => setPatient({...patient, name: e.target.value})} leftSection={<User size={16} />} classNames={{ input: "rounded-xl font-bold bg-[#F8FAFC] h-14" }} />
                <TextInput label="เบอร์โทร" value={patient.tel} onChange={(e) => setPatient({...patient, tel: e.target.value})} leftSection={<Phone size={16} />} classNames={{ input: "rounded-xl font-bold bg-[#F8FAFC] h-14" }} />
                <Box>
                  <Text className="text-[11px] font-black text-slate-400 mb-1.5 uppercase tracking-widest">แผนก</Text>
                  <div className="h-14 bg-slate-50 rounded-xl px-5 flex items-center border-2 border-dashed border-slate-200">
                    <Text className="font-black text-slate-400 italic uppercase">{sectionLabel}</Text>
                  </div>
                </Box>
                <Textarea label="รายละเอียด" placeholder="บันทึก..." minRows={4} classNames={{ input: "rounded-xl font-bold bg-[#F8FAFC] p-5" }} />
              </Stack>
            </Stack>
          </Paper>

          {/* ✅ 2. CENTER: THE SURGICAL DISPENSER TERMINAL */}
          <Stack justify="center" align="center" gap={0} className="relative py-20">
            
            {/* FRONT PLATE: เครื่องจ่ายที่ทับอยู่ด้านหน้า (z-30) */}
            <DispenseMachine />

            {/* ANIMATION CONTAINER: ควบคุมการลอดออกมา */}
            <div className="relative w-full flex justify-center h-[350px] overflow-hidden">
              <AnimatePresence mode="wait">
                <motion.div
                  key={displayId}
                  // ✅ เริ่มต้น: ซ่อนตัวอยู่ด้านหลังเครื่องจ่ายแบบ 100%
                  initial={{ y: -350, opacity: 1 }} 
                  animate={{ y: 0, opacity: 1 }}
                  // ✅ ออก: ฉีกขาดร่วงหล่น (ต้องขยายขอบเขต overflow เพื่อให้เห็นตอนร่วง)
                  exit={{ 
                    y: 800, 
                    rotate: 15, 
                    opacity: 0, 
                    transition: { duration: 0.7, ease: "circIn" } 
                  }}
                  transition={{ type: "spring", stiffness: 100, damping: 20 }}
                  className="absolute z-10"
                >
                  <PaperTicketContent queueNumber={displayId} hospitalName="โรงพยาบาลส่วนกลาง" />
                </motion.div>
              </AnimatePresence>
            </div>

            {/* ACTION BUTTONS: 45° Shadow */}
            <Group grow className="w-full max-w-[500px] mt-16" gap="xl">
               <div className="relative group cursor-pointer">
                <div className="absolute inset-0 bg-[#059669] rounded-2xl translate-x-1 translate-y-1" />
                <button onClick={handleFinishCase} disabled={isAnimating} className="relative w-full py-5 bg-[#34A832] text-white rounded-2xl font-black text-sm uppercase tracking-widest flex items-center justify-center gap-3 transition-transform group-hover:-translate-x-1 group-hover:-translate-y-1 active:scale-95 shadow-lg">
                  เสร็จสิ้น <CheckCircle size={20} strokeWidth={3} />
                </button>
              </div>
              <div className="relative group cursor-pointer">
                <div className="absolute inset-0 bg-[#BE123C] rounded-2xl translate-x-1 translate-y-1" />
                <button className="relative w-full py-5 bg-[#EF4444] text-white rounded-2xl font-black text-sm uppercase tracking-widest flex items-center justify-center gap-2 transition-transform group-hover:-translate-x-1 group-hover:-translate-y-1 active:scale-95 shadow-lg">
                  ผู้ป่วยไม่มา <UserX size={20} strokeWidth={3} />
                </button>
              </div>
            </Group>
          </Stack>

          {/* 3. RIGHT COLUMN: QUEUE LIST (คงเดิม) */}
          <Paper radius={40} withBorder className="bg-white border-gray-100 shadow-xl flex flex-col h-[700px] overflow-hidden">
             <div className="p-8 border-b border-gray-50 bg-[#FBFBFC]">
                <Title order={4} className="text-sm font-black text-slate-900 uppercase italic">Next In Line</Title>
              </div>
              <div className="flex-1 p-5 space-y-4 overflow-y-auto bg-slate-50/30">
                {Array(6).fill(null).map((_, i) => (
                  <Box key={i} style={{ opacity: i === 0 ? 1 : i === 1 ? 0.6 : 0.3 }} className="relative bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
                    <Text className="text-2xl font-black text-slate-900 italic tracking-tighter">A0{25 + i}</Text>
                    <Text className="text-[10px] font-black text-slate-400 uppercase mt-2">NAME: PATIENT</Text>
                  </Box>
                ))}
              </div>
          </Paper>

        </div>
      </main>
    </div>
  );
}