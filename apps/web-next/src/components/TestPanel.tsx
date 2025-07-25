import React from 'react';
import { Drawer, Button, Select, message, Avatar } from 'antd';
import { UserOutlined } from '@ant-design/icons';
import { useTestUsers, TEST_USERS } from '../hooks/useTestUsers';

interface TestPanelProps {
  visible: boolean;
  onClose: () => void;
}

/**
 * 测试面板组件
 * 提供快速切换测试用户的功能，可在任何页面使用
 */
const TestPanel: React.FC<TestPanelProps> = ({ visible, onClose }) => {
  const { selectedUser, currentUser, isLoading, loginAsTestUser } = useTestUsers();

  // 切换用户处理函数
  const handleUserSwitch = async (userUid: string) => {
    const newUser = TEST_USERS.find((u) => u.uid === userUid);
    message.loading(`正在切换到 ${newUser?.displayName}...`, 1);

    try {
      // 直接调用登录功能
      const success = await loginAsTestUser(userUid);
      if (success) {
        message.success(`已成功切换到 ${newUser?.displayName}`);
      } else {
        message.error('切换用户失败');
      }
    } catch (error) {
      message.error('切换用户时发生错误');
      console.error('Login error:', error);
    }
  };

  // 直接登录处理函数
  const handleDirectLogin = async () => {
    if (!currentUser) return;
    message.loading('正在登录...', 1);

    try {
      const success = await loginAsTestUser(selectedUser);
      if (success) {
        message.success('登录成功，页面将刷新');
      } else {
        message.error('登录失败');
      }
    } catch (error) {
      message.error('登录时发生错误');
      console.error('Login error:', error);
    }
  };

  return (
    <Drawer
      title="测试账号"
      placement="right"
      closable={true}
      onClose={onClose}
      open={visible}
      width={300}
    >
      <div>
        {/* 用户选择器 */}
        <div style={{ marginBottom: 16 }}>
          <Select
            value={selectedUser}
            onChange={handleUserSwitch}
            style={{ width: '100%' }}
            loading={isLoading}
            placeholder="选择测试用户"
            optionLabelProp="label"
            dropdownRender={(menu) => menu}
          >
            {TEST_USERS.map((user) => (
              <Select.Option key={user.uid} value={user.uid} label={user.displayName}>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <Avatar
                    size="small"
                    style={{ backgroundColor: user.color, marginRight: '8px' }}
                    icon={<UserOutlined />}
                  />
                  <div>
                    <div>{user.displayName}</div>
                    <div style={{ fontSize: '12px', color: '#666' }}>{user.email}</div>
                  </div>
                </div>
              </Select.Option>
            ))}
          </Select>
        </div>

        {/* 登录按钮 */}
        <Button
          type="primary"
          onClick={handleDirectLogin}
          loading={isLoading}
          disabled={!currentUser}
          style={{ width: '100%', marginBottom: 16 }}
        >
          登录并刷新
        </Button>

        {/* 当前用户信息 */}
        {currentUser && (
          <div style={{ fontSize: '12px', color: '#666', marginTop: '16px' }}>
            <div style={{ marginBottom: '4px' }}>
              <b>用户ID:</b> {currentUser.uid}
            </div>
            <div style={{ marginBottom: '4px' }}>
              <b>用户名:</b> {currentUser.name}
            </div>
            <div style={{ marginBottom: '4px' }}>
              <b>邮箱:</b> {currentUser.email}
            </div>
            <div>
              <b>显示名:</b> {currentUser.displayName}
            </div>
          </div>
        )}
      </div>
    </Drawer>
  );
};

export default TestPanel;
