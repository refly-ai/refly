import React, { useState } from 'react';
import workflowSnapshot from '@refly-packages/ai-workspace-common/assets/workflow-snapshot.png';

/**
 * Features section component following Figma design specifications
 * - Title: "产品特性"
 * - Capsule tabs: Workflow 编排, 多模态生成, 结果复用与分享, 开放生态
 * - Layout: 1072px width, 24px gap
 * - Visual effects: shadows, rounded corners
 */
const FeaturesSection: React.FC = () => {
  const [activeTab, setActiveTab] = useState('workflow');

  const tabs = [
    { key: 'workflow', label: 'Workflow 编排' },
    { key: 'multimodal', label: '多模态生成' },
    { key: 'reuse', label: '结果复用与分享' },
    { key: 'ecosystem', label: '开放生态' },
  ];

  return (
    <div className="w-full max-w-[1072px] mx-auto px-4 pt-16">
      {/* Title */}
      <h2
        className="text-center mb-6"
        style={{
          fontFamily: 'PingFang SC, -apple-system, BlinkMacSystemFont, sans-serif',
          fontSize: 'clamp(18px, 4vw, 22px)',
          fontWeight: 600,
          lineHeight: '1.455',
          color: '#1C1F23',
        }}
      >
        产品特性
      </h2>

      {/* Capsule tabs */}
      <div className="flex justify-center mb-6">
        <div className="flex flex-wrap justify-center gap-3 max-w-full">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 sm:px-6 py-1.5 rounded-full transition-all duration-200 text-sm sm:text-base ${
                activeTab === tab.key
                  ? 'bg-[#0E9F77] text-white'
                  : 'bg-white text-[#1C1F23] hover:bg-gray-50'
              }`}
              style={{
                fontFamily: 'PingFang SC, -apple-system, BlinkMacSystemFont, sans-serif',
                fontWeight: activeTab === tab.key ? 600 : 400,
                lineHeight: '1.429',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content area */}
      <div className="w-full mt-16">
        {activeTab === 'workflow' && <WorkflowContent />}
        {activeTab === 'multimodal' && <MultimodalContent />}
        {activeTab === 'reuse' && <ReuseContent />}
        {activeTab === 'ecosystem' && <EcosystemContent />}
      </div>
    </div>
  );
};

// Reusable Feature Content Component
interface FeatureContentProps {
  title: string;
  description: string;
  canvasComponent: React.ReactNode;
}

const FeatureContent: React.FC<FeatureContentProps> = ({ title, description, canvasComponent }) => {
  return (
    <div
      className="w-full rounded-[20px] overflow-hidden align-middle"
      style={{
        minHeight: '400px',
      }}
    >
      <div className="flex flex-col lg:flex-row h-full">
        {/* Left content */}
        <div
          className="flex flex-col justify-center"
          style={{
            width: '240px',
            gap: '10px',
          }}
        >
          <h3
            style={{
              fontFamily: 'PingFang SC, -apple-system, BlinkMacSystemFont, sans-serif',
              fontSize: '22px',
              fontWeight: 600,
              lineHeight: '1.4545454545454546em',
              color: '#000000',
              textAlign: 'left',
              margin: 0,
            }}
          >
            {title}
          </h3>
          <p
            style={{
              fontFamily: 'PingFang SC, -apple-system, BlinkMacSystemFont, sans-serif',
              fontSize: '14px',
              fontWeight: 400,
              lineHeight: '1.4285714285714286em',
              color: 'rgba(28, 31, 35, 0.8)',
              textAlign: 'left',
              margin: 0,
              width: '100%',
            }}
          >
            {description}
          </p>
        </div>

        {/* Right content - Canvas placeholder */}
        <div
          className="relative"
          style={{
            display: 'flex',
            // width: '801px',
            height: '480px',
            padding: '0 0.5px',
            justifyContent: 'center',
            alignItems: 'center',
            flexShrink: 0,
          }}
        >
          {canvasComponent}
        </div>
      </div>
    </div>
  );
};

// Workflow content component
const WorkflowContent: React.FC = () => {
  return (
    <FeatureContent
      title="Workflow 编排"
      description="可视化子 Agent 编排，把复杂任务拆解成清晰步骤。"
      canvasComponent={<WorkflowCanvasPlaceholder />}
    />
  );
};

// Workflow Canvas placeholder component
const WorkflowCanvasPlaceholder: React.FC = () => {
  return <CanvasPlaceholder alt="Workflow Canvas" objectFit="cover" />;
};

// Other tab content components with consistent structure
const MultimodalContent: React.FC = () => {
  return (
    <FeatureContent
      title="多模态生成"
      description="支持文本、图像、音频等多种模态的生成能力，让AI工作流更加丰富多样。"
      canvasComponent={<CanvasPlaceholder alt="Multimodal Canvas" objectFit="cover" />}
    />
  );
};

const ReuseContent: React.FC = () => {
  return (
    <FeatureContent
      title="结果复用与分享"
      description="轻松分享和复用工作流结果，让团队协作更加高效便捷。"
      canvasComponent={<CanvasPlaceholder alt="Reuse Canvas" objectFit="cover" />}
    />
  );
};

const EcosystemContent: React.FC = () => {
  return (
    <FeatureContent
      title="开放生态"
      description="构建开放的AI工作流生态系统，连接更多开发者和创新者。"
      canvasComponent={<CanvasPlaceholder alt="Ecosystem Canvas" objectFit="cover" />}
    />
  );
};

// Reusable Canvas Placeholder Component
interface CanvasPlaceholderProps {
  alt: string;
  objectFit?: 'cover' | 'contain';
}

const CanvasPlaceholder: React.FC<CanvasPlaceholderProps> = ({ alt }) => {
  return (
    <div
      className="w-[801px] h-[480px] bg-white rounded-[16px] m-4 relative overflow-hidden"
      style={{
        // Subtle shadow matching Figma design - very light gray shadow
        boxShadow: '0px 2px 8px 0px rgba(0, 0, 0, 0.04)',
      }}
    >
      <img src={workflowSnapshot} alt={alt} className="w-[801px] h-[480px]" />
      {/* Right side gradient overlay */}
      <div
        className="absolute top-0 right-0 w-1/5 h-full"
        style={{
          background: 'linear-gradient(270deg, #EFFCF8 1.6%, rgba(239, 252, 248, 0.00) 100%)',
        }}
      />
    </div>
  );
};

export default FeaturesSection;
