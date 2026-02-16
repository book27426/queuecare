"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  Container, 
  TextInput, 
  SimpleGrid, 
  Box, 
  Text, 
  Title, 
  Paper,
  Group,
  Stack,
  Modal,
  Textarea,
  Center
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { Activity, Search, Clock, MapPin, Phone, User, XCircle } from 'lucide-react';

export default function JoinQueuePage() {
  const router = useRouter();
  const [opened, { open, close }] = useDisclosure(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedHospital, setSelectedHospital] = useState(null);

  const hospitals = [
    { 
      id: 1, 
      name: "กระทรวงสาธารณสุข", 
      status: "OPEN",
      wait: "15 min",
      color: "#006633", 
      logo: "https://upload.wikimedia.org/wikipedia/commons/f/f1/Ministry_of_Public_Health_Thailand_Logo.png" 
    },
    { 
      id: 2, 
      name: "โรงพยาบาลปทุมธานี", 
      status: "OPEN",
      wait: "45 min",
      color: "#ed1c24", 
      logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d4/Red_Cross_icon.svg/1024px-Red_Cross_icon.svg.png" 
    }
  ];

  const handleHospitalSelect = (hospital) => {
    setSelectedHospital(hospital);
    open();
  };

  const handleJoinQueue = (e) => {
    e.preventDefault();
    if (!selectedHospital) return; 
    
    close();
    router.push(`/queue/${selectedHospital.id}`);
  };

  return (
    <Box className="min-h-screen bg-[#EBEDF0] flex flex-col font-sans">
      {/* NAVBAR */}
      <nav className="h-16 px-6 lg:px-32 flex items-center justify-between bg-white border-b border-gray-200 sticky top-0 z-50">
        <Group gap="xs">
          <Box className="w-8 h-8 bg-health-green rounded-lg flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <Activity className="text-white" size={20} strokeWidth={3} />
          </Box>
          <Text className="text-xl font-black tracking-tighter italic text-slate-900 uppercase">QueueCare</Text>
        </Group>
      </nav>

      {/* WORKSPACE SLAB */}
      <Container size="xl" className="flex-1 flex items-center justify-center py-6 w-full">
        <Paper radius={40} p={{ base: 30, lg: 60 }} withBorder className="bg-white w-full min-h-[75vh] flex flex-col gap-8 shadow-sm">
          
          <Group justify="space-between" align="center" className="border-b-2 border-gray-50 pb-6">
            <Stack gap={0}>
              <Title order={1} className="text-3xl lg:text-4xl font-black text-[#1A1C1E] tracking-tight">Select Institution</Title>
              <Text className="text-sm lg:text-base font-bold text-slate-400 italic">Find your facility to join the live queue.</Text>
            </Stack>

            <Box className="relative group w-full lg:w-[320px]">
              <Box className="absolute inset-0 bg-gray-100 rounded-xl translate-x-1 translate-y-1" />
              <TextInput
                size="md"
                radius="md"
                placeholder="Search"
                leftSection={<Search size={18} strokeWidth={4} className="text-slate-400" />}
                styles={{ input: { backgroundColor: '#F3F4F6', border: 'none', fontWeight: 900, height: '48px' } }}
              />
            </Box>
          </Group>

          {/* HYBRID GRID (Mobile Rectangle / Desktop Vertical) */}
          <SimpleGrid cols={{ base: 1, lg: 4 }} spacing={30}>
            {hospitals.map((hospital) => (
              <Box key={hospital.id} onClick={() => handleHospitalSelect(hospital)} className="relative group cursor-pointer">
                <Box className="absolute inset-0 bg-black/5 rounded-3xl translate-x-2 translate-y-2 transition-transform" />
                <Box className="relative h-full w-full bg-white border-2 border-gray-50 rounded-3xl p-5 flex flex-row lg:flex-col gap-5 transition-transform group-hover:-translate-x-1 group-hover:-translate-y-1">
                  <Box className="w-20 h-20 lg:w-full lg:aspect-square bg-white border border-gray-50 rounded-2xl p-3 flex items-center justify-center shrink-0">
                    <img src={hospital.logo} alt="Logo" className="w-full h-full object-contain grayscale group-hover:grayscale-0 transition-all" />
                  </Box>
                  <Stack gap={2} className="flex-1 justify-center lg:justify-start">
                    <Group justify="space-between" wrap="nowrap">
                      <Text className="text-base lg:text-lg font-black text-slate-900 line-clamp-1">{hospital.name}</Text>
                      <Box className="px-2 py-1 rounded-full text-[8px] font-black uppercase" style={{ backgroundColor: `${hospital.color}10`, color: hospital.color }}>{hospital.status}</Box>
                    </Group>
                    <Box className="p-2.5 rounded-xl bg-[#F8FAFC] border border-gray-50 flex items-center justify-between mt-2">
                      <Group gap={6}><Clock size={12} className="text-health-green" strokeWidth={3} /><Text className="text-[9px] font-black text-slate-400 uppercase">Wait</Text></Group>
                      <Text className="text-sm font-black text-slate-900">{hospital.wait}</Text>
                    </Box>
                  </Stack>
                </Box>
              </Box>
            ))}
          </SimpleGrid>
        </Paper>
      </Container>

      {/* JOIN QUEUE OVERLAY */}
      <Modal opened={opened} onClose={close} centered radius={40} size="lg" withCloseButton={false} padding={0}>
        <Paper p={40} className="relative bg-white">
          <Box onClick={close} className="absolute top-8 right-8 cursor-pointer text-slate-300 hover:text-red-500 z-10">
            <XCircle size={32} strokeWidth={3} />
          </Box>

          <Stack gap={32}>
            {/* Header Guard: Uses optional chaining */}
            {selectedHospital && (
              <Group gap="xl" className="border-b-2 border-gray-50 pb-8">
                <Box className="w-28 h-28 bg-white border border-gray-100 rounded-3xl p-4 flex items-center justify-center shadow-sm">
                  <img src={selectedHospital.logo} alt="Logo" className="w-full h-full object-contain" />
                </Box>
                <Stack gap={4}>
                  <Title order={2} className="text-4xl font-black text-slate-900 leading-tight">{selectedHospital.name}</Title>
                  <Text className="text-base font-bold text-slate-400 uppercase tracking-widest">Available Now</Text>
                </Stack>
              </Group>
            )}

            <form onSubmit={handleJoinQueue} className="space-y-8">
              <Group grow align="flex-start" gap="xl">
                <TextInput required label="ชื่อ-นามสกุล" placeholder="กรุณาใส่ชื่อผู้ป่วยด้วยค่ะ*" size="lg" radius="md" styles={{ input: { backgroundColor: '#F8FAFC', fontWeight: 700 } }} />
                <TextInput required label="เบอร์โทรศัพท์" placeholder="กรุณาใส่เบอร์ผู้ป่วยด้วยค่ะ" size="lg" radius="md" styles={{ input: { backgroundColor: '#F8FAFC', fontWeight: 700 } }} />
              </Group>
              <Textarea label="รายละเอียดเพิ่มเติม" placeholder="รบกวนกรอกรายละเอียดอาการผู้ป่วย (ถ้ามี)" size="lg" radius="md" minRows={4} styles={{ input: { backgroundColor: '#F8FAFC', fontWeight: 700 } }} />

              <Center className="pt-4">
                <Box className="relative group w-full max-w-[240px]">
                  {/* SIGNATURE 45° LIFT */}
                  <Box className="absolute inset-0 bg-gray-200 rounded-2xl translate-x-2 translate-y-2 transition-transform group-hover:translate-x-3 group-hover:translate-y-3" />
                  <button type="submit" className="relative w-full py-5 bg-white border-2 border-gray-100 text-slate-900 text-2xl font-black rounded-2xl transition-all transform group-hover:-translate-x-1 group-hover:-translate-y-1 active:translate-x-1 active:translate-y-1 hover:text-health-green hover:border-health-green">
                    จองคิว
                  </button>
                </Box>
              </Center>
            </form>
          </Stack>
        </Paper>
      </Modal>

      <footer className="p-8 text-center border-t border-gray-100/50">
        <Text className="text-slate-300 font-black text-[9px] tracking-[0.4em] uppercase"></Text>
      </footer>
    </Box>
  );
}