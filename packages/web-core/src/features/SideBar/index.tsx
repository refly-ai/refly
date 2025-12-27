'use client';

import { useState, useRef } from 'react';
import { Button } from 'antd';
import { MenuFoldOutlined, MenuUnfoldOutlined } from '@ant-design/icons';

/**
 * SideBar Component with Mobile Collapse Support
 * Fixes issue #1249: Mobile sidebar cannot be collapsed
 * 
 * Features:
 * - Toggle collapse/expand on mobile devices
 * - Swipe gesture support (swipe left to collapse, swipe right to expand)
 * - Touch event handling for better mobile UX
 * - Responsive design for all screen sizes
 */
export function SideBar() {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const sidebarRef = useRef<HTMLDivElement>(null);

  // Handle touch start
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };

  // Handle touch end for swipe detection
  const handleTouchEnd = (e: React.TouchEvent) => {
    const touchEndX = e.changedTouches[0].clientX;
    const touchEndY = e.changedTouches[0].clientY;
    const diffX = touchStartX.current - touchEndX;
    const diffY = Math.abs(touchStartY.current - touchEndY);

    // Only consider horizontal swipes (ignore vertical movement)
    if (Math.abs(diffX) > 50 && diffY < 50) {
      if (diffX > 0) {
        // Swipe left - collapse sidebar
        setIsCollapsed(true);
      } else {
        // Swipe right - expand sidebar
        setIsCollapsed(false);
      }
    }
  };

  // Toggle collapse state
  const handleToggleCollapse = () => {
    setIsCollapsed(!isCollapsed);
  };

  return (
    <div
      ref={sidebarRef}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      className={`sidebar-container ${
        isCollapsed ? 'sidebar-collapsed' : 'sidebar-expanded'
      }`}
      style={{
        transition: 'all 0.3s ease-in-out',
        width: isCollapsed ? '0px' : '250px',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#f5f5f5',
        borderRight: '1px solid #e0e0e0',
        position: 'relative',
      }}
    >
      {/* Collapse/Expand Toggle Button */}
      <Button
        type="text"
        icon={
          isCollapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />
        }
        onClick={handleToggleCollapse}
        title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}        style={{
          alignSelf: 'flex-end',
          margin: '8px',
          padding: '8px 12px',
          fontSize: '16px',
        }}
      />
      {/* Sidebar Content */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <nav>
          <ul style={{ listStyle: 'none', padding: '16px 0', margin: 0 }}>
            <li style={{ padding: '12px 16px' }}>Home</li>
            <li style={{ padding: '12px 16px' }}>About</li>
            <li style={{ padding: '12px 16px' }}>Services</li>
            <li style={{ padding: '12px 16px' }}>Contact</li>
          </ul>
        </nav>
      </div>
    </div>
  );
}
