// src/components/Navbar.jsx
"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation'; 
import { Activity, Ticket, LogOut, Phone, ArrowLeft, ArrowRight } from 'lucide-react'; 
import { Group, Avatar, Menu, Stack, Text, Box, Modal, TextInput, Button, Title, PinInput } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks'; 
import { motion, AnimatePresence } from 'framer-motion';

export function Navbar({ user }) {
  const pathname = usePathname();
  const router = useRouter();
  const [opened, { open, close }] = useDisclosure(false); 
  const [loginStep, setLoginStep] = useState('phone'); 
  const [phone, setPhone] = useState('');
  const [otpValue, setOtpValue] = useState('');

  const handleSendOTP = () => {
    if (phone.length >= 10) setLoginStep('otp');
  };

  const handleLogin = () => {
    close();
    setLoginStep('phone');
    setOtpValue('');
    router.push('/myqueue'); 
  };

  const isIndex = pathname === '/';
  const isStaff = !!user;

  return (
    <>
      <nav className="h-20 px-8 lg:px-20 flex items-center justify-between bg-white border-b border-gray-200 sticky top-0 z-50">
        <Link href="/" className="no-underline">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#10B981] rounded-xl flex items-center justify-center shadow-lg">
              <Activity className="text-white" size={24} strokeWidth={3} />
            </div>
            <span className="text-2xl font-black tracking-tighter text-slate-900 uppercase">QueueCare</span>
          </div>
        </Link>

        <div className="flex items-center">
          {/* ... ส่วน Staff Profile เหมือนเดิม ... */}
          {!isStaff && (
            <div className="flex items-center gap-4">
              {!isIndex && (
                <Link href="/myqueue" className="no-underline">
                  <button className="px-6 py-2.5 bg-black text-white font-black rounded-xl flex items-center gap-2 shadow-md">
                    <Ticket size={18} strokeWidth={3} className="text-[#10B981]" />
                    <span className="uppercase tracking-tight text-sm font-black">คิวของฉัน</span>
                  </button>
                </Link>
              )}
              <button onClick={open} className="px-8 py-2.5 bg-[#0096FF] text-white font-black rounded-xl shadow-md uppercase tracking-tight">
                Login
              </button>
            </div>
          )}
        </div>
      </nav>

      <Modal opened={opened} onClose={() => { close(); setLoginStep('phone'); }} centered radius="28px" padding="40px" withCloseButton={false} size="440px">
        <AnimatePresence mode="wait">
          {loginStep === 'phone' ? (
            <motion.div key="phone" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <Stack gap="xl">
                <Box>
                  <Title order={2} className="text-3xl font-black uppercase tracking-tighter text-slate-900">Welcome Back</Title>
                  <Text className="text-slate-400 font-bold text-sm">กรุณาระบุเบอร์โทรศัพท์เพื่อเข้าสู่ระบบ</Text>
                </Box>
                <TextInput value={phone} onChange={(e) => setPhone(e.currentTarget.value)} placeholder="08X-XXX-XXXX" label="Phone Number" size="lg" radius="md" leftSection={<Phone size={18} />} classNames={{ input: "font-black" }} />
                <Stack gap="sm">
                  <Button fullWidth size="lg" radius="xl" color="black" onClick={handleSendOTP} className="h-14 bg-black">
                    <Group gap="xs">
                      <Text className="font-black uppercase">Sent OTP</Text>
                      <ArrowRight size={20} />
                    </Group>
                  </Button>
                  <Link href="/staff" className="no-underline w-full" onClick={close}>
                    <Button fullWidth variant="subtle" color="gray" className="font-black uppercase text-[10px] text-slate-400">
                      Login as Staff
                    </Button>
                  </Link>
                </Stack>
              </Stack>
            </motion.div>
          ) : (
            <motion.div key="otp" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
              <Stack gap="xl" align="center">
                <Box className="w-full">
                  <Title order={2} className="text-3xl font-black uppercase tracking-tighter text-slate-900">Verify OTP</Title>
                  <Text className="text-xl font-black text-slate-900">{phone}</Text>
                </Box>

                <Box className="py-4">
                  <PinInput 
                    length={6} 
                    size="xl" 
                    oneTimeCode // ✅ แก้จาก otp เป็น oneTimeCode
                    value={otpValue}
                    onChange={setOtpValue}
                    type="number"
                    classNames={{ input: "font-black text-2xl h-16 w-12 !rounded-xl border-2 focus:border-[#10B981]" }}
                  />
                </Box>

                <Stack gap="md" className="w-full">
                  <Button fullWidth size="lg" radius="xl" color="#10B981" onClick={handleLogin} disabled={otpValue.length < 6} className="h-14 bg-[#10B981]">
                    <Text className="font-black uppercase text-white">Login</Text>
                  </Button>
                  <Group justify="center">
                    {/* ✅ แก้จาก Button variant="ghost" เป็นปุ่ม HTML ปกติ หรือใช้ variant="subtle" */}
                    <button onClick={() => setLoginStep('phone')} className="bg-transparent border-none cursor-pointer flex items-center gap-2 text-slate-400 hover:text-slate-600">
                      <ArrowLeft size={14} strokeWidth={3} />
                      <Text className="font-black uppercase text-[10px] tracking-widest underline">เปลี่ยนเบอร์โทรศัพท์</Text>
                    </button>
                  </Group>
                </Stack>
              </Stack>
            </motion.div>
          )}
        </AnimatePresence>
      </Modal>
    </>
  );
}