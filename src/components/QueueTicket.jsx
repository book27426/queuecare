import React from 'react';
import { Box } from '@mantine/core';

// ส่วนที่ 1: เครื่องจ่ายตั๋ว (Dispense Machine)
export const DispenseMachine = () => (
  <Box className="relative z-30">
    <svg width="420" height="100" viewBox="0 0 500 80" fill="none" xmlns="http://www.w3.org/2000/svg" className="drop-shadow-2xl">
      {/* Machine Body */}
      <path 
        d="M40 20C40 8.95431 48.9543 0 60 0H440C451.046 0 460 8.95431 460 20V80C460 91.0457 451.046 100 440 100H60C48.9543 100 40 91.0457 40 80V20Z" 
        fill="#E5E7EB" 
        stroke="#D1D5DB" 
        strokeWidth="2" 
      />
      {/* The Dispense Slot */}
      <rect x="80" y="70" width="340" height="16" rx="8" fill="#1F2937" />
      <path d="M80 78H420" stroke="#111827" strokeWidth="2" strokeLinecap="round" opacity="0.6" />
      <rect x="85" y="70" width="330" height="4" rx="2" fill="black" opacity="0.2" />
    </svg>
  </Box>
);

// ส่วนที่ 2: ใบตั๋ว (Paper Ticket)
export const PaperTicketContent = ({ queueNumber, hospitalName }) => (
  <Box className="relative z-10">
    <svg width="400" height="320" viewBox="0 0 500 400" fill="none" xmlns="http://www.w3.org/2000/svg" className="drop-shadow-xl">
      <path 
        d="M75 0H425V320L400 300L375 320L350 300L325 320L300 300L275 320L250 300L225 320L200 300L175 320L150 300L125 320L100 300L75 320V0Z" 
        fill="#FFFFFF" 
        stroke="#F3F4F6" 
        strokeWidth="1" 
      />
      <text x="250" y="100" textAnchor="middle" className="font-black" style={{ fontSize: '20px', fill: '#94A3B8', textTransform: 'uppercase' }}>คิวของคุณคือ</text>
      <text x="250" y="130" textAnchor="middle" className="font-black" style={{ fontSize: '20px', fill: '#94A3B8', textTransform: 'uppercase' }}>{hospitalName}</text>
      <text x="250" y="240" textAnchor="middle" className="font-black italic" style={{ fontSize: '110px', fill: '#1E293B', letterSpacing: '-0.05em' }}>{queueNumber}</text>
    </svg>
  </Box>
);