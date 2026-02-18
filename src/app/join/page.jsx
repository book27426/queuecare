"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Container, TextInput, SimpleGrid, Box, Text, Title, Paper, Group, Stack, Modal, Center 
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { Search, Clock, User, Phone, Ticket } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

import { Navbar } from "@/components/Navbar";
import { DispenseMachine, PaperTicketContent } from "@/components/QueueTicket";

export default function JoinQueuePage() {
  const router = useRouter();
  const [opened, { open, close }] = useDisclosure(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedHospital, setSelectedHospital] = useState(null);
  
  const [step, setStep] = useState('form'); 
  const [newQueueId, setNewQueueId] = useState("A026");

  // ✅ 1. ทันทีที่เข้าหน้านี้ ให้สั่ง Navbar เปลี่ยนปุ่มเป็น "คิวของฉัน"
  useEffect(() => {
    // ถ้ายังไม่มีคิวในเครื่อง ให้เซ็ตสถานะเริ่มต้นไว้ก่อนเพื่อให้ปุ่มเปลี่ยน
    if (!localStorage.getItem('user_queue_id')) {
      localStorage.setItem('user_queue_id', 'pending'); 
    }
    
    // ส่งสัญญาณบอก Navbar ให้ตรวจสอบค่าใหม่ทันที
    window.dispatchEvent(new Event('queueUpdated'));
  }, []);

  const hospitals = [
    { 
      id: 1, name: "กระทรวงสาธารณสุข", status: "OPEN", wait: "15 min", color: "#34A832", 
      logo: "https://upload.wikimedia.org/wikipedia/commons/f/f1/Ministry_of_Public_Health_Thailand_Logo.png" 
    },
    { 
      id: 2, name: "โรงพยาบาลปทุมธานี", status: "OPEN", wait: "45 min", color: "#EF4444", 
      logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d4/Red_Cross_icon.svg/1024px-Red_Cross_icon.svg.png" 
    }
  ];

  const filteredHospitals = hospitals.filter(h => 
    h.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleHospitalSelect = (hospital) => {
    setSelectedHospital(hospital);
    setStep('form');
    open();
  };

  const handleJoinQueue = (e) => {
    e.preventDefault();
    // ✅ 2. เมื่อจองสำเร็จ อัปเดตเลขคิวจริงลงไป
    localStorage.setItem('user_queue_id', newQueueId);
    window.dispatchEvent(new Event('queueUpdated'));
    setStep('printing');
  };

  return (
    <Box className="min-h-screen bg-[#F0F2F5] flex flex-col font-sans antialiased overflow-hidden">
      
      {/* Navbar จะรับรู้ Event 'queueUpdated' และเปลี่ยนปุ่มให้มึงเอง */}
      <Navbar user={null} />

      <Container size="xl" className="flex-1 flex items-center justify-center py-12 w-full">
        <Paper radius={48} p={{ base: 30, lg: 60 }} withBorder className="bg-white w-full min-h-[70vh] flex flex-col gap-10 shadow-sm border-gray-100">
          
          <Group justify="space-between" align="center" className="border-b-2 border-gray-50 pb-8">
            <Stack gap={0}>
              <Title order={1} className="text-3xl lg:text-5xl font-black text-slate-900 tracking-tight uppercase ">Select Institution</Title>
              <Text className="text-sm lg:text-lg font-bold text-slate-400">Find your facility to join the live queue.</Text>
            </Stack>

            <Box className="relative group w-full lg:w-[380px]">
              <Box className="absolute inset-0 bg-gray-100 rounded-2xl translate-x-1 translate-y-1" />
              <TextInput
                size="xl"
                radius="xl"
                placeholder="Search facility..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.currentTarget.value)}
                leftSection={<Search size={20} strokeWidth={4} className="text-slate-400" />}
                styles={{ input: { backgroundColor: '#F8FAFC', border: 'none', fontWeight: 900, height: '60px' } }}
              />
            </Box>
          </Group>

          <SimpleGrid cols={{ base: 1, sm: 2, lg: 3, xl: 4 }} spacing={40}>
            {filteredHospitals.map((hospital) => (
              <Box key={hospital.id} onClick={() => handleHospitalSelect(hospital)} className="relative group cursor-pointer">
                <Box className="absolute inset-0 bg-black/5 rounded-[44px] translate-x-2 translate-y-2 transition-transform duration-300" />
                <Box className="relative h-full w-full bg-white border-2 border-gray-50 rounded-[44px] p-8 flex flex-col gap-6 transition-all duration-300 group-hover:-translate-y-2 group-hover:shadow-xl">
                  <Box className="w-full aspect-square bg-white border border-gray-100 rounded-3xl p-6 flex items-center justify-center shadow-sm">
                    <img src={hospital.logo} alt="Logo" className="w-full h-full object-contain grayscale group-hover:grayscale-0 transition-all" />
                  </Box>
                  <Stack gap={4}>
                    <Group justify="space-between" wrap="nowrap">
                      <Text className="text-lg font-black text-slate-900 uppercase line-clamp-1">{hospital.name}</Text>
                      <Box className="px-3 py-1 rounded-full text-[9px] font-black uppercase" style={{ backgroundColor: `${hospital.color}15`, color: hospital.color }}>{hospital.status}</Box>
                    </Group>
                    <Box className="p-4 rounded-2xl bg-[#F8FAFC] flex items-center justify-between mt-2 border border-gray-50">
                      <Group gap={8}><Clock size={16} className="text-[#34A832]" strokeWidth={4} /><Text className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Wait Time</Text></Group>
                      <Text className="text-lg font-black text-slate-900">{hospital.wait}</Text>
                    </Box>
                  </Stack>
                </Box>
              </Box>
            ))}
          </SimpleGrid>
        </Paper>
      </Container>

      <Modal opened={opened} onClose={close} centered radius={48} size={step === 'form' ? "lg" : "xl"} withCloseButton={step === 'form'} padding={40}>
        <AnimatePresence mode="wait">
          {step === 'form' ? (
            <motion.div key="form" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}>
              <Stack gap={40}>
                {selectedHospital && (
                  <Group gap="xl" className="border-b-2 border-gray-50 pb-8">
                    <Box className="w-24 h-24 bg-white border border-gray-100 rounded-3xl p-4 flex items-center justify-center shadow-sm">
                      <img src={selectedHospital.logo} alt="Logo" className="w-full h-full object-contain" />
                    </Box>
                    <Stack gap={0}>
                      <Title order={2} className="text-3xl font-black text-slate-900 uppercase leading-tight ">{selectedHospital.name}</Title>
                      <Text className="text-xs font-black text-[#34A832] uppercase">จองคิว</Text>
                    </Stack>
                  </Group>
                )}

                <form onSubmit={handleJoinQueue} className="space-y-8">
                  <Stack gap="xl">
                    <TextInput required label="ชื่อ-นามสกุล" placeholder="ระบุชื่อของคุณ" size="xl" radius="xl" classNames={{ input: "bg-[#F8FAFC] font-bold h-16", label: "font-black text-slate-500 mb-2 uppercase text-xs tracking-widest" }} leftSection={<User size={18} className="text-slate-400" />} />
                    <TextInput required label="เบอร์โทรศัพท์" placeholder="08X-XXX-XXXX" size="xl" radius="xl" classNames={{ input: "bg-[#F8FAFC] font-bold h-16", label: "font-black text-slate-500 mb-2 uppercase text-xs tracking-widest" }} leftSection={<Phone size={18} className="text-slate-400" />} />
                  </Stack>
                  <Center className="pt-8">
                    <Box className="relative group w-full max-w-[360px]">
                      <Box className="absolute inset-0 bg-slate-300 rounded-3xl translate-x-2 translate-y-2 group-hover:translate-x-3 group-hover:translate-y-3 transition-transform duration-300 ease-out" />
                      <button type="submit" className="relative w-full py-4 bg-black border-2 border-black text-white rounded-3xl transition-all duration-300 transform group-hover:-translate-x-1 group-hover:-translate-y-1 active:translate-x-1 active:translate-y-1 uppercase shadow-2xl overflow-hidden">
                        <span className="text-[25px] font-black tracking-tighter block leading-none">จองคิว</span>
                      </button>
                    </Box>
                  </Center>
                </form>
              </Stack>
            </motion.div>
          ) : (
            <motion.div key="printing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center py-12">
              <Stack align="center" gap={0} className="relative w-full">
                <DispenseMachine />
                <div className="relative h-[330px] w-full flex justify-center">
                  <motion.div initial={{ y: -200 }} animate={{ y: 0 }} transition={{ type: "spring", stiffness: 100, damping: 20 }}>
                    <PaperTicketContent queueNumber={newQueueId} hospitalName={selectedHospital?.name || "QueueCare"} />
                  </motion.div>
                </div>
                
                <Stack align="center" gap="lg" className="mt-12">
                  <Text className="font-black text-slate-400 uppercase text-[10px] tracking-[0.3em] ">จองคิวสำเร็จ! กรุณารับบัตรคิว</Text>

                  <Box className="relative group w-full max-w-[300px]">
                    <Box className="absolute inset-0 bg-slate-200 rounded-2xl translate-x-1.5 translate-y-1.5 group-hover:translate-x-2.5 group-hover:translate-y-2.5 transition-transform duration-300 ease-out" />
                    <button 
                      onClick={() => { close(); router.push(`/myqueue`); }}
                      className="relative w-full py-5 bg-black border-2 border-black text-white text-xl font-black rounded-2xl transition-all duration-300 transform group-hover:-translate-x-1 group-hover:-translate-y-1 active:translate-x-1 active:translate-y-1 uppercase  tracking-tighter shadow-lg"
                    >
                      <Group gap="xs" justify="center">
                        <Ticket size={20} strokeWidth={3} className="text-health-green" />
                        ไปที่ คิวของฉัน
                      </Group>
                    </button>
                  </Box>
                </Stack>
              </Stack>
            </motion.div>
          )}
        </AnimatePresence>
      </Modal>
    </Box>
  );
}