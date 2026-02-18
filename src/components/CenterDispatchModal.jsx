"use client";

import React, { useState } from 'react';
import { Modal, TextInput, Stack, Button, Title, Text, Group, Box } from '@mantine/core';
import { User, Phone, CheckCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { DispenseMachine, PaperTicketContent } from "./QueueTicket"; 

export function CenterDispatchModal({ opened, onClose, sectionName }) {
  const [step, setStep] = useState('form');
  const [formData, setFormData] = useState({ name: '', phone: '' });
  const [newQueueId, setNewQueueId] = useState("A026");

  const handleSubmit = (e) => {
    e.preventDefault();
    if (formData.name && formData.phone) {
      // เปลี่ยนไปหน้า Printing ทันทีเพื่อแก้ปัญหา Page Not Found
      setStep('printing');
    }
  };

  const handleClose = () => {
    setStep('form');
    setFormData({ name: '', phone: '' });
    onClose();
  };

  return (
    <Modal 
      opened={opened} 
      onClose={handleClose} 
      withCloseButton={step === 'form'}
      centered 
      radius={40}
      padding={40}
      size={step === 'form' ? "lg" : "xl"}
      styles={{ content: { overflow: 'visible' } }} // เพื่อให้ตั๋วร่วงพ้น Modal ได้
    >
      <AnimatePresence mode="wait">
        {step === 'form' ? (
          <motion.div 
            key="form"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
          >
            <Stack gap="xl">
              <Stack gap={0}>
                <Title order={2} className="text-2xl font-black text-slate-900 italic uppercase">
                  กระทรวงสาธารณสุข
                </Title>
                <Text className="text-[10px] font-black text-[#34A832] uppercase tracking-[0.2em]">
                  Available Now
                </Text>
              </Stack>

              <form onSubmit={handleSubmit}>
                <Stack gap="md">
                  <Group grow>
                    <TextInput 
                      label="ชื่อ-นามสกุล" 
                      placeholder="กรุณาใส่ชื่อผู้ติดต่อด้วยค่ะ*"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                      leftSection={<User size={16} />}
                      classNames={{ input: "rounded-xl font-bold bg-[#F8FAFC] h-14", label: "font-black text-slate-500 mb-1" }}
                    />
                    <TextInput 
                      label="เบอร์โทรศัพท์" 
                      placeholder="กรุณาใส่เบอร์ผู้ติดต่อด้วยค่ะ*"
                      required
                      value={formData.phone}
                      onChange={(e) => setFormData({...formData, phone: e.target.value})}
                      leftSection={<Phone size={16} />}
                      classNames={{ input: "rounded-xl font-bold bg-[#F8FAFC] h-14", label: "font-black text-slate-500 mb-1" }}
                    />
                  </Group>

                  {/* ลบส่วน รายละเอียดเพิ่มเติม ออกตามบรีฟใหม่ */}

                  <Button 
                    type="submit"
                    fullWidth 
                    size="xl" 
                    radius="xl"
                    className="bg-[#34A832] font-black italic uppercase tracking-widest mt-6 h-16 shadow-lg hover:scale-[1.02] transition-transform"
                  >
                    จองคิว
                  </Button>
                </Stack>
              </form>
            </Stack>
          </motion.div>
        ) : (
          <motion.div 
            key="printing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center py-10"
          >
            {/* แก้ปัญหาหน้า Print หายด้วยการใส่ Animation ลงใน Modal */}
            <Stack align="center" gap={0} className="relative w-full">
              <DispenseMachine />
              <div className="relative h-[380px] w-full flex justify-center">
                <motion.div
                  initial={{ y: -300 }}
                  animate={{ y: 60 }}
                  transition={{ type: "spring", stiffness: 100, damping: 20 }}
                >
                  <PaperTicketContent queueNumber={newQueueId} hospitalName="โรงพยาบาลส่วนกลาง" />
                </motion.div>
              </div>
              
              <Stack align="center" gap="xs" className="mt-10">
                <Text className="font-black text-slate-400 uppercase tracking-widest text-xs">จองคิวสำเร็จ!</Text>
                <Button variant="subtle" color="gray" onClick={handleClose} className="font-bold">
                  ปิดหน้าต่าง
                </Button>
              </Stack>
            </Stack>
          </motion.div>
        )}
      </AnimatePresence>
    </Modal>
  );
}