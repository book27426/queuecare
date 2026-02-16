"use client";

import { Menu, UnstyledButton, Group, Avatar, Text, rem, Box } from '@mantine/core';
import { User, LogOut, ChevronDown } from 'lucide-react';

export function UserMenu({ user }) {
  return (
    <Menu width={200} position="bottom-end" transitionProps={{ transition: 'pop-top-right' }} withinPortal>
      <Menu.Target>
        <UnstyledButton className="px-3 py-2 rounded-xl hover:bg-gray-50 transition-colors">
          <Group gap="sm">
            <Avatar src={user?.image} radius="xl" size="sm" className="border-2 border-health-green" />
            <Box className="hidden md:block">
              <Text fw={900} size="xs" className="text-slate-900 uppercase tracking-tighter">
                {user?.name || "DR. PATHUM"}
              </Text>
            </Box>
            <ChevronDown size={14} strokeWidth={3} className="text-slate-400" />
          </Group>
        </UnstyledButton>
      </Menu.Target>

      <Menu.Dropdown className="rounded-2xl border-2 border-gray-100 shadow-xl p-2">
        <Menu.Label className="font-black text-[9px] uppercase tracking-widest text-slate-400 p-2">Account</Menu.Label>
        <Menu.Item leftSection={<User style={{ width: rem(14) }} strokeWidth={3} />} className="font-bold text-slate-700">Profile</Menu.Item>
        <Menu.Divider />
        <Menu.Item color="red" leftSection={<LogOut style={{ width: rem(14) }} strokeWidth={3} />} className="font-bold">Logout</Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}