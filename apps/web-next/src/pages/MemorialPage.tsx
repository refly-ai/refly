import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useSiderStoreShallow } from '@refly/stores';
import earlyBirdsData from './early-birds.json';
import { Button, Avatar, Modal, message, Tooltip } from 'antd';
import {
  ShareAltOutlined,
  StarOutlined,
  HeartOutlined,
  ThunderboltOutlined,
  CrownOutlined,
} from '@ant-design/icons';
import {
  motion,
  AnimatePresence,
  useScroll,
  useTransform,
  useSpring,
  useTime,
} from 'framer-motion';
import html2canvas from 'html2canvas';
import {
  PulsatingButton,
  ShimmerButton,
  AnimatedCircularProgressBar,
  OrbitingCircles,
} from '../components/magicui';
import './MemorialPage.css';

// 当前登录用户的名称，实际项目中应该从登录状态获取
const CURRENT_USER_NAME = 'digua'; // 示例：当前登录用户名称

interface Member {
  id: string;
  name: string;
  nickname: string;
  avatar: string;
  isCurrentUser?: boolean;
}

// 生成默认头像的背景色数组
const avatarBgColors = [
  '#F44336',
  '#E91E63',
  '#9C27B0',
  '#673AB7',
  '#3F51B5',
  '#2196F3',
  '#03A9F4',
  '#00BCD4',
  '#009688',
  '#4CAF50',
  '#8BC34A',
  '#CDDC39',
  '#FFEB3B',
  '#FFC107',
  '#FF9800',
  '#FF5722',
  '#795548',
  '#9E9E9E',
  '#607D8B',
];

// 获取文本的简拼（拼音首字母缩写）
function getSimplePinyin(text: string | null | undefined): string {
  if (!text) return 'U';

  // 简单处理：取每个字的第一个字符
  // 对于中文，这不是真正的拼音，但可以作为简单实现
  // 实际项目中可以使用专门的拼音库（如pinyin.js）
  return text
    .split('')
    .map((char) => char.charAt(0).toUpperCase())
    .join('')
    .substring(0, 2); // 最多取两个字符
}

// 检查URL是否有效
function isValidImageUrl(url: string | null | undefined): boolean {
  if (!url) return false;

  // 检查是否是有效的URL格式
  return url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:image/');
}

// 生成基于文本的头像
function generateTextAvatar(name: string | null | undefined): string {
  // 处理空值情况
  const safeName = name || 'User';

  // 基于名字生成一个稳定的索引
  const colorIndex =
    safeName.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % avatarBgColors.length;
  const bgColor = avatarBgColors[colorIndex];

  // 计算文字颜色（浅色背景用深色文字，深色背景用浅色文字）
  const textColor = isLightColor(bgColor) ? '#000000' : '#FFFFFF';

  // 获取昵称的简拼
  const simplePinyin = getSimplePinyin(safeName);
  let fontSize = 40;

  // 根据简拼长度调整字体大小
  if (simplePinyin.length > 1) {
    fontSize = 36; // 两个字符时稍微小一点
  }

  // 创建SVG
  return `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><rect width="100" height="100" fill="${bgColor.replace('#', '%23')}"/><text x="50" y="50" font-family="Arial" font-size="${fontSize}" font-weight="bold" fill="${textColor.replace('#', '%23')}" text-anchor="middle" dominant-baseline="central">${simplePinyin}</text></svg>`;
}

// 判断颜色是否为浅色
function isLightColor(color: string): boolean {
  // 移除#号
  const hex = color.replace('#', '');
  // 转换为RGB
  const r = Number.parseInt(hex.substring(0, 2), 16);
  const g = Number.parseInt(hex.substring(2, 4), 16);
  const b = Number.parseInt(hex.substring(4, 6), 16);
  // 计算亮度
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  // 亮度大于128认为是浅色
  return brightness > 128;
}

const MemorialPage: React.FC = () => {
  const [visibleAvatars, setVisibleAvatars] = useState<Member[]>([]);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [shareModalVisible, setShareModalVisible] = useState(false);
  const [hoveredAvatar, setHoveredAvatar] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const shareImageRef = useRef<HTMLDivElement>(null);

  // 获取 setCollapse 方法用于控制侧边栏
  const { setCollapse } = useSiderStoreShallow((state) => ({
    setCollapse: state.setCollapse,
  }));

  // 在组件加载时自动收起侧边栏
  useEffect(() => {
    setCollapse(true);
  }, []);

  // Generate mock early bird users
  const earlyBirdUsers = useMemo(() => generateEarlyBirdUsers(), []);

  // Find current user
  const currentUser = useMemo(
    () => earlyBirdUsers.find((user) => user.isCurrentUser) || earlyBirdUsers[0],
    [earlyBirdUsers],
  );

  // Advanced scroll-based animations
  const { scrollY } = useScroll();
  const headerY = useTransform(scrollY, [0, 300], [0, -50]);
  const headerScale = useTransform(scrollY, [0, 200], [1, 0.95]);
  const headerOpacity = useTransform(scrollY, [0, 150], [1, 0.8]);

  // Premium mouse parallax with multiple layers
  const mouseX = useSpring(0, { stiffness: 50, damping: 30 });
  const mouseY = useSpring(0, { stiffness: 50, damping: 30 });
  const mouseXFast = useSpring(0, { stiffness: 100, damping: 25 });
  const mouseYFast = useSpring(0, { stiffness: 100, damping: 25 });

  // Time-based animations
  const time = useTime();
  const rotateX = useTransform(time, [0, 4000], [0, 360], { clamp: false });
  const rotateY = useTransform(time, [0, 6000], [0, 360], { clamp: false });

  // 注意：由于简化了Member接口，不再需要这些样式了
  // 保留注释以便将来可能需要时可以参考

  // Premium animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        duration: 1.2,
        staggerChildren: 0.08,
        delayChildren: 0.2,
      },
    },
  };

  const heroVariants = {
    hidden: {
      opacity: 0,
      y: 60,
      scale: 0.8,
      rotateX: -15,
    },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      rotateX: 0,
      transition: {
        type: 'spring' as const,
        stiffness: 120,
        damping: 20,
        duration: 1.5,
      },
    },
  };

  const avatarVariants = {
    hidden: {
      opacity: 0,
      scale: 0,
      y: 100,
      rotateY: 180,
    },
    visible: {
      opacity: 1,
      scale: 1,
      y: 0,
      rotateY: 0,
      transition: {
        type: 'spring' as const,
        stiffness: 200,
        damping: 20,
        duration: 0.8,
      },
    },
    hover: {
      scale: 1.2,
      y: -8,
      rotateY: 10,
      rotateX: 5,
      transition: {
        type: 'spring' as const,
        stiffness: 400,
        damping: 15,
      },
    },
  };

  function generateEarlyBirdUsers(): Member[] {
    // 使用真实的早鸟数据
    const users = earlyBirdsData.map((user, index) => {
      // 处理空值情况
      if (!user || (!user.name && !user.nickname)) {
        return {
          id: `user-${index}`, // 使用索引作为ID
          name: `用户${index}`,
          nickname: `用户${index}`,
          avatar: generateTextAvatar(null),
          isCurrentUser: false,
        };
      }

      // 根据name字段匹配当前用户
      const isCurrentUser = user.name === CURRENT_USER_NAME;
      const displayName = user.nickname || user.name;

      // 直接使用name作为ID，如果name为空则使用索引
      // 对于当前用户，使用'current-user'作为ID
      const uniqueId = isCurrentUser ? 'current-user' : user.name || `user-${index}`;

      // 检查头像URL是否有效
      const avatar = isValidImageUrl(user.avatar) ? user.avatar : generateTextAvatar(displayName);

      return {
        id: uniqueId,
        name: user.name || `用户${index}`,
        nickname: displayName || `用户${index}`,
        avatar,
        isCurrentUser,
      };
    });

    // 确保当前用户排在第一位
    return users.sort((a, b) => {
      if (a.isCurrentUser) return -1;
      if (b.isCurrentUser) return 1;
      return 0;
    });
  }

  // Enhanced mouse move handler with multiple parallax layers
  const handleMouseMove = useCallback(
    (event: React.MouseEvent) => {
      if (!containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      const x = (event.clientX - rect.left - rect.width / 2) / rect.width;
      const y = (event.clientY - rect.top - rect.height / 2) / rect.height;

      mouseX.set(x * 20);
      mouseY.set(y * 20);
      mouseXFast.set(x * 40);
      mouseYFast.set(y * 40);
    },
    [mouseX, mouseY, mouseXFast, mouseYFast],
  );

  // Enhanced avatar loading with wave animation
  useEffect(() => {
    const loadAvatars = async () => {
      // 预处理头像，检查URL是否有效
      const processedUsers = earlyBirdUsers.map((user) => {
        // 如果头像URL不是以http或data:开头，可能是无效URL，直接使用文本头像
        if (user.avatar && !(user.avatar.startsWith('http') || user.avatar.startsWith('data:'))) {
          return {
            ...user,
            avatar: generateTextAvatar(user.nickname || user.name),
          };
        }
        return user;
      });
      setVisibleAvatars(processedUsers);
    };
    loadAvatars();
  }, [earlyBirdUsers]);

  const _getBadgeIcon = (badge: string) => {
    switch (badge) {
      case 'legendary':
        return <CrownOutlined className="text-amber-600" />;
      case 'founder':
        return <StarOutlined className="text-teal-600" />;
      case 'pioneer':
        return <ThunderboltOutlined className="text-blue-600" />;
      default:
        return <HeartOutlined className="text-pink-600" />;
    }
  };

  const generateShareImage = async () => {
    if (!shareImageRef.current) return;

    try {
      const canvas = await html2canvas(shareImageRef.current, {
        backgroundColor: '#ffffff',
        scale: 2,
        useCORS: true,
      });

      const link = document.createElement('a');
      // 使用名字生成一个唯一的编号，替代之前的wallNumber
      const uniqueNumber =
        Array.from(currentUser.name).reduce((acc, char) => acc + char.charCodeAt(0), 0) % 1000;
      link.download = `refly-early-bird-${uniqueNumber}.png`;
      link.href = canvas.toDataURL();
      link.click();

      message.success('分享图片已生成并下载！');
    } catch (error) {
      console.error('生成分享图片失败:', error);
      message.error('生成分享图片失败，请重试');
    }
  };

  const shareToSocial = (platform: string) => {
    message.info(`分享到${platform}功能即将开放`);
  };

  return (
    <motion.div
      ref={containerRef}
      className="min-h-screen bg-gradient-to-br from-white via-slate-50/30 to-white relative overflow-hidden"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      onMouseMove={handleMouseMove}
    >
      {/* Enhanced Background Effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Premium gradient orbs with enhanced effects */}
        <motion.div
          className="absolute w-96 h-96 bg-gradient-to-r from-teal-200/60 via-emerald-200/60 to-green-200/60 rounded-full blur-3xl"
          style={{
            top: '5%',
            right: '10%',
            x: mouseX,
            y: mouseY,
            rotateX,
          }}
          animate={{
            scale: [1, 1.3, 1],
            opacity: [0.3, 0.7, 0.3],
          }}
          transition={{
            scale: { duration: 8, repeat: Number.POSITIVE_INFINITY, ease: 'easeInOut' },
            opacity: { duration: 5, repeat: Number.POSITIVE_INFINITY, ease: 'easeInOut' },
          }}
        />

        <motion.div
          className="absolute w-80 h-80 bg-gradient-to-r from-purple-200/50 via-pink-200/50 to-rose-200/50 rounded-full blur-3xl"
          style={{
            bottom: '10%',
            left: '5%',
            x: mouseXFast,
            y: mouseYFast,
            rotateY,
          }}
          animate={{
            scale: [1, 1.4, 1],
            opacity: [0.2, 0.6, 0.2],
          }}
          transition={{
            scale: { duration: 12, repeat: Number.POSITIVE_INFINITY, ease: 'easeInOut' },
            opacity: { duration: 8, repeat: Number.POSITIVE_INFINITY, ease: 'easeInOut' },
          }}
        />

        {/* Enhanced floating particles system */}
        {Array.from({ length: 15 }).map((_, i) => (
          <motion.div
            key={i}
            className={`absolute w-2 h-2 rounded-full ${
              i % 3 === 0 ? 'bg-teal-400/40' : i % 3 === 1 ? 'bg-emerald-400/40' : 'bg-green-400/40'
            }`}
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
            }}
            animate={{
              y: [-30, -60, -30],
              x: [-10, 10, -10],
              opacity: [0.2, 0.8, 0.2],
              scale: [0.5, 1.5, 0.5],
            }}
            transition={{
              duration: 4 + Math.random() * 4,
              repeat: Number.POSITIVE_INFINITY,
              ease: 'easeInOut',
              delay: Math.random() * 3,
            }}
          />
        ))}

        {/* Premium light rays */}
        <motion.div
          className="absolute top-0 left-1/2 w-1 h-full bg-gradient-to-b from-teal-400/20 via-transparent to-transparent"
          style={{ x: mouseX }}
          animate={{
            opacity: [0.1, 0.3, 0.1],
          }}
          transition={{
            duration: 6,
            repeat: Number.POSITIVE_INFINITY,
            ease: 'easeInOut',
          }}
        />
      </div>

      <motion.div
        className="relative z-10 max-w-7xl mx-auto px-6 py-16"
        style={{
          y: headerY,
          scale: headerScale,
          opacity: headerOpacity,
        }}
      >
        {/* Enhanced Header Section */}
        <motion.div className="text-center mb-20" variants={heroVariants}>
          {/* Premium Hero Icon with orbiting elements */}
          <motion.div
            className="inline-flex items-center justify-center mb-12"
            initial={{ scale: 0, rotate: -180, opacity: 0 }}
            animate={{ scale: 1, rotate: 0, opacity: 1 }}
            transition={{
              type: 'spring' as const,
              stiffness: 100,
              damping: 15,
              delay: 0.5,
              duration: 1.5,
            }}
          >
            <div className="relative">
              <motion.div
                className="w-24 h-24 bg-gradient-to-r from-teal-500 via-emerald-500 to-green-500 rounded-2xl flex items-center justify-center shadow-2xl"
                animate={{
                  boxShadow: [
                    '0 10px 40px -10px rgba(0, 212, 170, 0.3)',
                    '0 30px 60px -15px rgba(0, 212, 170, 0.5)',
                    '0 10px 40px -10px rgba(0, 212, 170, 0.3)',
                  ],
                  rotateY: [0, 360],
                }}
                transition={{
                  boxShadow: { duration: 4, repeat: Number.POSITIVE_INFINITY, ease: 'easeInOut' },
                  rotateY: { duration: 20, repeat: Number.POSITIVE_INFINITY, ease: 'linear' },
                }}
                whileHover={{ scale: 1.1, rotateX: 15 }}
              >
                <StarOutlined className="text-3xl text-white" />
              </motion.div>

              {/* Orbiting elements */}
              <OrbitingCircles
                className="w-3 h-3 border-none bg-teal-400"
                radius={50}
                duration={10}
              >
                <motion.div
                  className="w-3 h-3 bg-gradient-to-r from-teal-400 to-emerald-400 rounded-full"
                  animate={{ scale: [1, 1.5, 1] }}
                  transition={{ duration: 2, repeat: Number.POSITIVE_INFINITY }}
                />
              </OrbitingCircles>
              <OrbitingCircles
                className="w-2 h-2 border-none bg-emerald-400"
                radius={65}
                duration={15}
                reverse
                delay={5}
              >
                <motion.div
                  className="w-2 h-2 bg-gradient-to-r from-emerald-400 to-green-400 rounded-full"
                  animate={{ scale: [1, 1.3, 1] }}
                  transition={{ duration: 1.5, repeat: Number.POSITIVE_INFINITY, delay: 1 }}
                />
              </OrbitingCircles>
            </div>
          </motion.div>

          {/* Enhanced Title with 3D text effects */}
          <motion.h1
            className="text-5xl md:text-7xl font-bold mb-8 leading-tight perspective-1000"
            initial={{ opacity: 0, y: 50, rotateX: 30 }}
            animate={{ opacity: 1, y: 0, rotateX: 0 }}
            transition={{
              type: 'spring' as const,
              stiffness: 60,
              damping: 20,
              delay: 0.8,
              duration: 1.5,
            }}
          >
            <motion.span
              className="bg-gradient-to-r from-gray-800 via-gray-900 to-black bg-clip-text text-transparent block transform-gpu"
              animate={{
                backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'],
              }}
              transition={{
                duration: 8,
                repeat: Number.POSITIVE_INFINITY,
                ease: 'linear',
              }}
              style={{ backgroundSize: '300% 100%' }}
              whileHover={{
                scale: 1.05,
                textShadow: '0 0 20px rgba(0,0,0,0.3)',
              }}
            >
              🎉 有些名字，写在最初
            </motion.span>
            <motion.span
              className="bg-gradient-to-r from-teal-600 via-emerald-600 to-green-600 bg-clip-text text-transparent block transform-gpu"
              animate={{
                backgroundPosition: ['100% 50%', '0% 50%', '100% 50%'],
              }}
              transition={{
                duration: 8,
                repeat: Number.POSITIVE_INFINITY,
                ease: 'linear',
                delay: 1,
              }}
              style={{ backgroundSize: '300% 100%' }}
              whileHover={{
                scale: 1.05,
                textShadow: '0 0 20px rgba(0,212,170,0.3)',
              }}
            >
              就不会被忘记
            </motion.span>
          </motion.h1>

          {/* Enhanced intro text with stagger animation */}
          <motion.div
            className="space-y-4 text-gray-600 text-lg max-w-2xl mx-auto mb-12"
            variants={{
              hidden: { opacity: 0 },
              visible: {
                opacity: 1,
                transition: {
                  staggerChildren: 0.3,
                  delayChildren: 1.2,
                },
              },
            }}
          >
            <motion.p
              className="font-medium text-xl"
              variants={{
                hidden: { opacity: 0, y: 30 },
                visible: { opacity: 1, y: 0 },
              }}
              whileHover={{ scale: 1.02, color: '#0d9488' }}
            >
              他们是最早相信 Refly 的一群人，我们在此铭刻他们的名字
            </motion.p>
            <motion.p
              variants={{
                hidden: { opacity: 0, y: 30 },
                visible: { opacity: 1, y: 0 },
              }}
              whileHover={{ scale: 1.02, color: '#059669' }}
            >
              感谢这些早期创作者共同启航 Refly
            </motion.p>
          </motion.div>

          {/* Enhanced Progress Stats with 3D effects */}
          <motion.div
            className="flex flex-col sm:flex-row items-center justify-center gap-12 mb-12"
            initial={{ opacity: 0, scale: 0.8, rotateX: 20 }}
            animate={{ opacity: 1, scale: 1, rotateX: 0 }}
            transition={{ delay: 1.5, duration: 1, type: 'spring' as const }}
          >
            <motion.div
              className="flex items-center gap-6"
              whileHover={{ scale: 1.05, rotateY: 5 }}
              animate={{
                y: [-20, -30, -20],
                x: [-5, 5, -5],
                rotate: [-2, 2, -2],
              }}
              transition={{
                duration: 6,
                repeat: Number.POSITIVE_INFINITY,
                ease: 'easeInOut',
              }}
            >
              <div className="relative">
                <AnimatedCircularProgressBar
                  max={1000}
                  value={215}
                  min={0}
                  gaugePrimaryColor="#00D4AA"
                  gaugeSecondaryColor="#e5e7eb"
                  className="w-24 h-24"
                />
                <motion.div
                  className="absolute inset-0 rounded-full"
                  animate={{
                    boxShadow: [
                      '0 0 20px rgba(0, 212, 170, 0.3)',
                      '0 0 40px rgba(0, 212, 170, 0.6)',
                      '0 0 20px rgba(0, 212, 170, 0.3)',
                    ],
                  }}
                  transition={{
                    duration: 3,
                    repeat: Number.POSITIVE_INFINITY,
                    ease: 'easeInOut',
                  }}
                />
              </div>
              <div className="text-left">
                <motion.div
                  className="text-3xl font-bold text-gray-900"
                  animate={{ scale: [1, 1.05, 1] }}
                  transition={{ duration: 2, repeat: Number.POSITIVE_INFINITY }}
                >
                  215
                </motion.div>
                <div className="text-sm text-gray-500">早鸟用户</div>
              </div>
            </motion.div>

            <motion.div
              className="text-center"
              whileHover={{ scale: 1.05, rotateY: -5 }}
              animate={{
                y: [-20, -30, -20],
                x: [-5, 5, -5],
                rotate: [-2, 2, -2],
              }}
              transition={{
                duration: 6,
                repeat: Number.POSITIVE_INFINITY,
                ease: 'easeInOut',
                delay: 1,
              }}
            >
              <motion.div
                className="text-2xl font-semibold text-teal-600"
                animate={{
                  color: ['#0d9488', '#10b981', '#059669', '#0d9488'],
                }}
                transition={{
                  duration: 4,
                  repeat: Number.POSITIVE_INFINITY,
                }}
              >
                21.5%
              </motion.div>
              <div className="text-sm text-gray-500">完成度</div>
            </motion.div>
          </motion.div>
        </motion.div>

        {/* Enhanced Current User Highlight */}
        {currentUser && (
          <motion.div
            className="bg-gradient-to-r from-teal-50/80 via-emerald-50/80 to-green-50/80 backdrop-blur-sm rounded-3xl p-8 mb-16 max-w-3xl mx-auto border border-teal-200/50 shadow-2xl"
            initial={{ opacity: 0, y: 40, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ delay: 1.8, duration: 1, type: 'spring' as const }}
            whileHover={{
              scale: 1.02,
              boxShadow: '0 25px 50px -12px rgba(0, 212, 170, 0.25)',
            }}
          >
            <div className="flex items-center gap-6">
              <motion.div
                whileHover={{ scale: 1.1, rotateY: 10 }}
                transition={{ type: 'spring' as const, stiffness: 300 }}
              >
                <Avatar
                  size={80}
                  src={currentUser.avatar}
                  className={'transition-all duration-500 hover:shadow-2xl'}
                  // 添加默认文本作为备选
                  icon={<span>{getSimplePinyin(currentUser.nickname || currentUser.name)}</span>}
                  onError={() => {
                    // 当头像加载失败时，将选中成员的头像替换为生成的文本头像
                    setSelectedMember((prev) =>
                      prev
                        ? {
                            ...prev,
                            avatar: generateTextAvatar(prev.nickname || prev.name),
                          }
                        : null,
                    );
                    return true; // 返回true表示使用Ant Design的内置fallback
                  }}
                />
              </motion.div>
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <motion.span
                    className="font-bold text-xl text-gray-900"
                    whileHover={{ scale: 1.05, color: '#0d9488' }}
                  >
                    {currentUser.name}
                  </motion.span>
                </div>
                <motion.div className="text-gray-600" whileHover={{ color: '#374151' }}>
                  <span className="font-bold text-teal-600">{currentUser.nickname}</span>
                </motion.div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Enhanced Avatar Wall with wave animation */}
        <motion.div
          className="mb-16"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 2, duration: 1.5 }}
        >
          <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12 xl:grid-cols-14 2xl:grid-cols-15 gap-4 max-w-6xl mx-auto">
            <AnimatePresence>
              {visibleAvatars.map((member, index) => (
                <motion.div
                  key={member.id}
                  layoutId={member.id}
                  variants={avatarVariants}
                  initial="hidden"
                  animate="visible"
                  whileHover="hover"
                  className="relative cursor-pointer group flex flex-col items-center"
                  style={{
                    animationDelay: `${Math.floor(index / 12) * 0.1 + (index % 12) * 0.05}s`,
                  }}
                  onClick={() => setSelectedMember(member)}
                  onHoverStart={() => setHoveredAvatar(member.id)}
                  onHoverEnd={() => setHoveredAvatar(null)}
                >
                  <Tooltip
                    title={
                      <motion.div
                        className="text-center p-2"
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ type: 'spring' as const, stiffness: 200 }}
                      >
                        <div className="font-medium text-lg">{member.name}</div>
                        <div className="text-xs opacity-75">{member.nickname}</div>
                      </motion.div>
                    }
                    placement="top"
                  >
                    <div className="relative">
                      {/* Enhanced avatar with ripple effect */}
                      <motion.div
                        className="relative overflow-hidden rounded-full"
                        whileHover={{
                          boxShadow: '0 20px 40px -10px rgba(0, 212, 170, 0.4)',
                        }}
                      >
                        <Avatar
                          size={56}
                          src={member.avatar}
                          className={'transition-all duration-500 hover:shadow-2xl'}
                          // 添加默认文本作为备选
                          icon={<span>{getSimplePinyin(member.nickname || member.name)}</span>}
                          onError={() => {
                            // 当头像加载失败时，将该成员的头像替换为生成的文本头像
                            const index = visibleAvatars.findIndex((m) => m.id === member.id);
                            if (index !== -1) {
                              const updatedAvatars = [...visibleAvatars];
                              updatedAvatars[index] = {
                                ...updatedAvatars[index],
                                avatar: generateTextAvatar(member.nickname || member.name),
                              };
                              setVisibleAvatars(updatedAvatars);
                            }
                            return true; // 返回true表示使用Ant Design的内置fallback
                          }}
                        />

                        {/* Ripple effect on hover */}
                        {hoveredAvatar === member.id && (
                          <motion.div
                            className="absolute inset-0 rounded-full border-2 border-teal-400"
                            initial={{ scale: 1, opacity: 1 }}
                            animate={{ scale: 2, opacity: 0 }}
                            transition={{ duration: 0.6, ease: 'easeOut' }}
                          />
                        )}
                      </motion.div>

                      {/* Current user indicator with pulse */}
                      {member.isCurrentUser && (
                        <motion.div
                          className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 bg-gradient-to-r from-teal-500 to-emerald-500 text-white text-xs px-3 py-1 rounded-full shadow-lg"
                          animate={{
                            scale: [1, 1.1, 1],
                            boxShadow: [
                              '0 0 0 0 rgba(0, 212, 170, 0.7)',
                              '0 0 0 10px rgba(0, 212, 170, 0)',
                              '0 0 0 0 rgba(0, 212, 170, 0)',
                            ],
                          }}
                          transition={{
                            duration: 2,
                            repeat: Number.POSITIVE_INFINITY,
                            ease: 'easeInOut',
                          }}
                        >
                          你
                        </motion.div>
                      )}
                    </div>
                  </Tooltip>

                  {/* 头像下方显示昵称 */}
                  <div className="mt-2 text-xs text-center text-gray-600 font-medium truncate w-full">
                    {member.nickname}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </motion.div>

        {/* Enhanced Share Section */}
        <motion.div
          className="text-center"
          initial={{ opacity: 0, y: 50, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{
            delay: 2.5,
            duration: 1,
            type: 'spring' as const,
            stiffness: 100,
          }}
        >
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <PulsatingButton
              className="bg-gradient-to-r from-teal-500 via-emerald-500 to-green-500 hover:from-teal-600 hover:via-emerald-600 hover:to-green-600 text-white font-semibold px-10 py-4 rounded-2xl shadow-2xl transition-all duration-300 text-lg"
              pulseColor="0, 212, 170"
              onClick={() => setShareModalVisible(true)}
            >
              <motion.div
                animate={{ rotate: [0, 10, -10, 0] }}
                transition={{ duration: 4, repeat: Number.POSITIVE_INFINITY }}
                className="inline-block mr-3"
              >
                <ShareAltOutlined className="text-xl" />
              </motion.div>
              我的头像也在上面 🎉 去分享！
            </PulsatingButton>
          </motion.div>
        </motion.div>
      </motion.div>

      {/* Member Detail Modal */}
      <Modal
        title={null}
        open={!!selectedMember}
        onCancel={() => setSelectedMember(null)}
        footer={null}
        width={450}
        className="member-detail-modal"
        styles={{
          body: { padding: 0 },
          content: {
            background: 'rgba(255,255,255,0.95)',
            backdropFilter: 'blur(30px)',
            borderRadius: '24px',
            border: '1px solid rgba(0,212,170,0.2)',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          },
        }}
        destroyOnClose
      >
        <AnimatePresence>
          {selectedMember && (
            <motion.div
              className="p-8"
              initial={{ opacity: 0, scale: 0.8, rotateY: 90 }}
              animate={{ opacity: 1, scale: 1, rotateY: 0 }}
              exit={{ opacity: 0, scale: 0.8, rotateY: -90 }}
              transition={{
                type: 'spring' as const,
                stiffness: 200,
                damping: 20,
                duration: 0.6,
              }}
            >
              <div className="text-center mb-8">
                <motion.div
                  initial={{ scale: 0, rotate: 180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ delay: 0.2, type: 'spring' as const, stiffness: 200 }}
                  whileHover={{ scale: 1.1, rotateY: 15 }}
                >
                  <Avatar
                    size={100}
                    src={selectedMember.avatar}
                    className={'transition-all duration-500 hover:shadow-2xl'}
                    // 添加默认文本作为备选
                    icon={
                      <span>{getSimplePinyin(selectedMember.nickname || selectedMember.name)}</span>
                    }
                    onError={() => {
                      // 当头像加载失败时，将选中成员的头像替换为生成的文本头像
                      setSelectedMember((prev) =>
                        prev
                          ? {
                              ...prev,
                              avatar: generateTextAvatar(prev.nickname || prev.name),
                            }
                          : null,
                      );
                      return true; // 返回true表示使用Ant Design的内置fallback
                    }}
                  />
                </motion.div>
                <motion.h3
                  className="text-2xl font-bold text-gray-900 mb-3"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                >
                  {selectedMember.name}
                </motion.h3>
              </div>

              <motion.div
                className="space-y-4 text-gray-600"
                variants={{
                  hidden: { opacity: 0 },
                  visible: {
                    opacity: 1,
                    transition: {
                      staggerChildren: 0.1,
                      delayChildren: 0.5,
                    },
                  },
                }}
                initial="hidden"
                animate="visible"
              >
                <motion.div
                  className="flex justify-between py-2 px-4 bg-gradient-to-r from-teal-50/50 to-emerald-50/50 rounded-xl"
                  variants={{
                    hidden: { opacity: 0, x: -20 },
                    visible: { opacity: 1, x: 0 },
                  }}
                  whileHover={{
                    scale: 1.02,
                    backgroundColor: 'rgba(0, 212, 170, 0.1)',
                  }}
                >
                  <span className="font-medium">用户名</span>
                  <span className="font-bold text-gray-900">{selectedMember.name}</span>
                </motion.div>
                <motion.div
                  className="flex justify-between py-2 px-4 bg-gradient-to-r from-teal-50/50 to-emerald-50/50 rounded-xl"
                  variants={{
                    hidden: { opacity: 0, x: -20 },
                    visible: { opacity: 1, x: 0 },
                  }}
                  whileHover={{
                    scale: 1.02,
                    backgroundColor: 'rgba(0, 212, 170, 0.1)',
                  }}
                >
                  <span className="font-medium">昵称</span>
                  <span className="font-bold text-gray-900">{selectedMember.nickname}</span>
                </motion.div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </Modal>

      {/* Enhanced Share Modal */}
      <Modal
        title="分享你的早鸟身份"
        open={shareModalVisible}
        onCancel={() => setShareModalVisible(false)}
        footer={null}
        width={550}
        className="share-modal"
        styles={{
          content: {
            background: 'rgba(255,255,255,0.95)',
            backdropFilter: 'blur(30px)',
            borderRadius: '24px',
            border: '1px solid rgba(0,212,170,0.2)',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          },
        }}
      >
        <AnimatePresence>
          {shareModalVisible && (
            <motion.div
              className="space-y-8"
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 40 }}
              transition={{ type: 'spring' as const, stiffness: 200, damping: 20 }}
            >
              {/* Share Image Preview */}
              <motion.div
                ref={shareImageRef}
                className="bg-gradient-to-br from-gray-50 to-slate-100 rounded-3xl p-10 text-center shadow-inner"
                style={{ width: '450px', height: '550px', margin: '0 auto' }}
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.2, type: 'spring' as const }}
                whileHover={{ scale: 1.02 }}
              >
                <div className="mb-8">
                  <motion.div
                    initial={{ scale: 0, rotate: 180 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ delay: 0.4, type: 'spring' as const, stiffness: 200 }}
                  >
                    <Avatar
                      size={120}
                      src={currentUser.avatar}
                      className="mx-auto mb-6 ring-6 ring-teal-400 ring-offset-6 shadow-2xl"
                      onError={() => {
                        // 当分享模态框中头像加载失败时，使用生成的文本头像
                        const updatedUser = {
                          ...currentUser,
                          avatar: generateTextAvatar(currentUser.nickname || currentUser.name),
                        };
                        // 更新当前用户的头像
                        const updatedUsers = visibleAvatars.map((user) =>
                          user.id === currentUser.id ? updatedUser : user,
                        );
                        setVisibleAvatars(updatedUsers);
                        return false; // 返回false以符合Ant Design的要求
                      }}
                    />
                  </motion.div>
                  <motion.h3
                    className="text-3xl font-bold text-gray-900 mb-3"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                  >
                    {currentUser.name}
                  </motion.h3>
                </div>

                <motion.div
                  className="bg-white/90 backdrop-blur-sm rounded-2xl p-6 mb-8 shadow-lg"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.7 }}
                >
                  <div className="text-4xl font-bold text-teal-600 mb-2">
                    #
                    {Array.from(currentUser.name).reduce(
                      (acc, char) => acc + char.charCodeAt(0),
                      0,
                    ) % 1000}
                  </div>
                  <div className="text-gray-600 font-medium">早鸟编号</div>
                </motion.div>

                <motion.div
                  className="text-gray-700 leading-relaxed"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.8 }}
                >
                  <p className="mb-3 font-medium">曾在黎明前按下启动键</p>
                  <p className="mb-3 font-medium">也在无声处埋下信念</p>
                  <p className="mb-6 font-medium">向每一位创造者致敬，未来一起继续飞</p>
                  <p className="font-bold text-teal-600 text-lg">👉 refly.ai</p>
                </motion.div>
              </motion.div>

              {/* Download Button */}
              <motion.div
                className="text-center"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.9 }}
              >
                <ShimmerButton
                  className="bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 text-white px-8 py-4 rounded-2xl font-semibold text-lg shadow-xl"
                  onClick={generateShareImage}
                >
                  <motion.span
                    animate={{ rotate: [0, 360] }}
                    transition={{ duration: 2, repeat: Number.POSITIVE_INFINITY, ease: 'linear' }}
                    className="inline-block mr-2"
                  >
                    💾
                  </motion.span>
                  下载分享图片
                </ShimmerButton>
              </motion.div>

              {/* Social Share Options */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1 }}
              >
                <h4 className="text-xl font-bold text-gray-900 mb-6 text-center">分享到社交平台</h4>
                <motion.div
                  className="grid grid-cols-5 gap-4"
                  variants={{
                    hidden: { opacity: 0 },
                    visible: {
                      opacity: 1,
                      transition: {
                        staggerChildren: 0.1,
                        delayChildren: 1.1,
                      },
                    },
                  }}
                  initial="hidden"
                  animate="visible"
                >
                  {[
                    { name: '微信好友', key: 'wechat', color: 'bg-green-500', emoji: '💬' },
                    { name: '小红书', key: 'xiaohongshu', color: 'bg-red-500', emoji: '📱' },
                    { name: 'X', key: 'twitter', color: 'bg-black', emoji: '🐦' },
                    { name: 'Discord', key: 'discord', color: 'bg-indigo-500', emoji: '🎮' },
                    { name: 'Telegram', key: 'telegram', color: 'bg-blue-500', emoji: '✈️' },
                  ].map((platform) => (
                    <motion.div
                      key={platform.key}
                      variants={{
                        hidden: { opacity: 0, y: 20, scale: 0.8 },
                        visible: { opacity: 1, y: 0, scale: 1 },
                      }}
                      whileHover={{
                        scale: 1.1,
                        y: -5,
                        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.25)',
                      }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <Button
                        className={`${platform.color} text-white border-none hover:opacity-80 transition-all rounded-2xl h-16 flex flex-col items-center justify-center font-medium`}
                        onClick={() => shareToSocial(platform.name)}
                      >
                        <motion.span
                          className="text-xl mb-1"
                          animate={{ rotate: [0, 10, -10, 0] }}
                          transition={{
                            duration: 3,
                            repeat: Number.POSITIVE_INFINITY,
                            delay: Math.random() * 2,
                          }}
                        >
                          {platform.emoji}
                        </motion.span>
                        <span className="text-xs">{platform.name}</span>
                      </Button>
                    </motion.div>
                  ))}
                </motion.div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </Modal>
    </motion.div>
  );
};

export default MemorialPage;
