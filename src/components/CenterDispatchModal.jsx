// src/components/CenterDispatchModal.jsx
import { Modal, TextInput, Select, Textarea, Stack, Title, Text, Divider, Group } from '@mantine/core';
import { User, Phone, Forward, UserX, Coffee } from 'lucide-react';

export function CenterDispatchModal({ opened, onClose, sectionName }) {
  return (
    <Modal 
      opened={opened} 
      onClose={onClose} 
      withCloseButton={false}
      centered
      radius={32}
      padding={40}
      size="md"
      overlayProps={{ backgroundOpacity: 0.55, blur: 10 }}
    >
      <Stack gap={32}>
        <div className="text-center">
          <Text className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-1">Active Case Ticket</Text>
          <Title className="text-5xl font-black text-slate-900 italic tracking-tighter leading-none">
            คิวที่ A009
          </Title>
        </div>

        <Divider color="gray.1" />

        {/* EDITABLE FIELDS */}
        <Stack gap="md">
          <TextInput label="ชื่อผู้ติดต่อ*" defaultValue="สมชาย ใจดี" leftSection={<User size={16} />} classNames={{ input: "rounded-xl font-bold bg-[#F8FAFC] h-12" }} />
          <TextInput label="เบอร์โทรผู้ติดต่อ*" defaultValue="081-123-4567" leftSection={<Phone size={16} />} classNames={{ input: "rounded-xl font-bold bg-[#F8FAFC] h-12" }} />
          <Select label="ส่งไปให้ใครต่อ*" placeholder="เลือกแผนก..." data={['ทำฟัน', 'ผู้ป่วยทั่วไป', 'ผู้ป่วยกระดูกหัก']} defaultValue={sectionName} classNames={{ input: "rounded-xl font-bold bg-[#F8FAFC] h-12" }} />
          <Textarea label="รายละเอียด (Optional)" placeholder="บันทึกเพิ่มเติม..." minRows={3} classNames={{ input: "rounded-xl font-bold bg-[#F8FAFC] p-4" }} />
        </Stack>

        {/* SIGNATURE 45° BUTTONS */}
        <Stack gap="xl">
          <Group grow gap="lg">
            <div className="relative group cursor-pointer">
              <div className="absolute inset-0 bg-[#BE123C] rounded-2xl translate-x-1 translate-y-1 group-hover:translate-x-1.5 transition-transform" />
              <button className="relative w-full py-3.5 bg-[#EF4444] text-white rounded-2xl font-black text-[11px] uppercase tracking-widest flex items-center justify-center gap-2 transition-transform group-hover:-translate-x-0.5 active:scale-95">
                ผู้ป่วยไม่มา <UserX size={16} strokeWidth={3} />
              </button>
            </div>
            <div className="relative group cursor-pointer">
              <div className="absolute inset-0 bg-[#059669] rounded-2xl translate-x-1 translate-y-1 group-hover:translate-x-1.5 transition-transform" />
              <button className="relative w-full py-3.5 bg-[#34A832] text-white rounded-2xl font-black text-[11px] uppercase tracking-widest flex items-center justify-center gap-2 transition-transform group-hover:-translate-x-1 active:scale-95">
                ส่งต่อข้อมูล <Forward size={18} strokeWidth={4} />
              </button>
            </div>
          </Group>
          <button className="w-full py-3 bg-[#F1F5F9] text-slate-400 rounded-2xl font-black text-[10px] uppercase tracking-[0.3em] flex items-center justify-center gap-2">
            Center Break Mode <Coffee size={14} />
          </button>
        </Stack>
      </Stack>
    </Modal>
  );
}