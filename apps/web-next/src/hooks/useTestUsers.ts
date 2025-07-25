import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';

// 测试用户类型定义
export interface TestUser {
  uid: string;
  name: string;
  email: string;
  displayName: string;
  color: string;
}

// 测试用户数据
export const TEST_USERS: TestUser[] = [
  {
    uid: 'u-credit-test-001',
    name: 'alice-heavy-user',
    email: 'alice@credittest.refly.ai',
    displayName: 'Alice (重度用户)',
    color: '#1890ff',
  },
  {
    uid: 'u-credit-test-002',
    name: 'bob-new-user',
    email: 'bob@credittest.refly.ai',
    displayName: 'Bob (新用户)',
    color: '#52c41a',
  },
  {
    uid: 'u-credit-test-003',
    name: 'charlie-expired',
    email: 'charlie@credittest.refly.ai',
    displayName: 'Charlie (过期积分)',
    color: '#faad14',
  },
  {
    uid: 'u-credit-test-004',
    name: 'diana-enterprise',
    email: 'diana@credittest.refly.ai',
    displayName: 'Diana (企业用户)',
    color: '#722ed1',
  },
  {
    uid: 'u-credit-test-005',
    name: 'eve-trial',
    email: 'eve@credittest.refly.ai',
    displayName: 'Eve (试用用户)',
    color: '#eb2f96',
  },
  {
    uid: 'u-credit-test-zero',
    name: 'zero-balance-user',
    email: 'zero@credittest.refly.ai',
    displayName: 'Zero (零余额)',
    color: '#f5222d',
  },
];

interface TestUserState {
  selectedUser: string;
  currentUser: TestUser | undefined;
  isLoading: boolean;
}

interface TestUserActions {
  switchUser: (userUid: string) => void;
  loginAsTestUser: (userUid: string) => Promise<boolean>;
}

/**
 * Test Users Hook
 * 用于快速切换不同的测试用户，避免重复登录
 */
export const useTestUsers = (): TestUserState & TestUserActions => {
  const [selectedUser, setSelectedUser] = useState<string>('u-credit-test-001');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const queryClient = useQueryClient();

  // 使用前端默认数据
  const currentUser = TEST_USERS.find((user) => user.uid === selectedUser);

  useEffect(() => {
    // 从localStorage恢复上次选择的测试用户
    const savedUser = localStorage.getItem('test-user-id');

    if (savedUser && TEST_USERS.find((u) => u.uid === savedUser)) {
      setSelectedUser(savedUser);
    }
  }, []);

  const switchUser = (userUid: string) => {
    // 检查用户是否存在于前端默认用户中
    const userExists = TEST_USERS.some((u) => u.uid === userUid);

    if (userExists) {
      const previousUser = selectedUser;
      setIsLoading(true);

      setSelectedUser(userUid);
      localStorage.setItem('test-user-id', userUid);

      // 清除React Query缓存，强制重新获取新用户的数据
      queryClient.invalidateQueries();

      // 在控制台输出切换信息，方便调试
      console.log(`🔄 Test User Switch: ${previousUser} → ${userUid}`, {
        previousUser: TEST_USERS.find((u) => u.uid === previousUser)?.displayName,
        newUser: TEST_USERS.find((u) => u.uid === userUid)?.displayName,
        timestamp: new Date().toISOString(),
        cacheInvalidated: true,
      });

      // Reset loading state after a short delay to allow queries to start
      setTimeout(() => {
        setIsLoading(false);
      }, 500);
    }
  };

  const loginAsTestUser = async (userUid: string): Promise<boolean> => {
    try {
      // 从前端默认用户中查找
      const user = TEST_USERS.find((u) => u.uid === userUid);
      if (!user) {
        console.error('Test user not found:', userUid);
        return false;
      }

      setIsLoading(true);

      // 调用实际的登录API
      const response = await fetch('http://localhost:5800/v1/auth/email/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // 重要：包含cookies用于认证
        body: JSON.stringify({
          email: user.email,
          password: 'testPassword123', // 测试用户固定密码
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          // 登录成功后，清除所有React Query缓存
          queryClient.clear(); // 清除所有缓存

          // 刷新整个页面的数据
          window.location.reload();

          // 切换到当前用户
          switchUser(userUid);

          console.log('✅ Login successful for test user:', user.email, {
            uid: userUid,
            displayName: user.displayName,
            pageReloaded: true,
            timestamp: new Date().toISOString(),
          });

          setIsLoading(false);
          return true;
        }
      }

      setIsLoading(false);
      console.error('Login failed for test user:', user.email, await response.json());
      return false;
    } catch (error) {
      setIsLoading(false);
      console.error('Login error:', error);
      return false;
    }
  };

  return {
    selectedUser,
    currentUser,
    isLoading,
    switchUser,
    loginAsTestUser,
  };
};

/**
 * 检查当前是否为测试用户
 */
export const isTestUser = (userUid?: string): boolean => {
  if (!userUid) return false;
  return TEST_USERS.some((user) => user.uid === userUid);
};

/**
 * 获取测试用户信息
 */
export const getTestUserInfo = (userUid: string): TestUser | undefined => {
  return TEST_USERS.find((user) => user.uid === userUid);
};
