import { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { TbActivityHeartbeat } from 'react-icons/tb';
import { AiOutlineExperiment } from 'react-icons/ai';
import { FaRegPaperPlane } from 'react-icons/fa';
import { HiOutlineDocumentDownload } from 'react-icons/hi';
import { LuSearch } from 'react-icons/lu';
import { MdOutlineNoteAlt } from 'react-icons/md';

// Feature type definition for better type safety
interface Workflow {
  tag: string;
  tagIcon?: string | ReactNode;
  title: string;
  bulletPoints: string[];
  imageSrc: string;
  isReversed?: boolean;
  background?: string;
  color?: string;
  tagShadow?: string;
}

interface WorkflowCardProps {
  isReversed?: boolean;
  background?: string;
}

const WorkflowCard = ({
  workflow,
  isReversed = false,
  background = 'linear-gradient(180deg, #F3EEFC 0%, #FFFFFF 100%)',
}: WorkflowCardProps & { workflow: Workflow }) => (
  <div className="relative mx-auto mt-[40px] w-full max-w-7xl md:w-[65%]">
    <div
      className="min-h-[360px] w-full overflow-visible rounded-[20px] md:h-[600px]"
      style={{
        background,
        border: '1px solid rgba(0, 0, 0, 0.05)',
      }}
    >
      <div
        className={`flex h-full flex-col gap-6 p-6 md:flex-row ${
          isReversed ? 'md:flex-row-reverse' : ''
        }`}
      >
        {/* Image Section - Updated with hover animation */}
        <div className="relative h-[260px] cursor-pointer overflow-visible transition-transform duration-300 ease-out hover:scale-95 md:h-auto md:w-1/2">
          <img
            src={workflow?.imageSrc ?? '/fallback-image.png'}
            alt={`${workflow?.title ?? 'Workflow'} visualization`}
            className="absolute h-full w-[130%] rounded-[20px] object-contain"
            style={{
              [isReversed ? 'right' : 'left']: '-30%',
              opacity: 1,
              boxSizing: 'border-box',
              transformOrigin: 'center',
            }}
          />
        </div>

        {/* Content Section */}
        <div className="flex flex-col justify-center md:w-1/2">
          <span
            className="mb-3 inline-flex w-fit items-center rounded-lg px-4 py-1 font-['Alibaba_PuHuiTi_Bold',system-ui,-apple-system,sans-serif] text-sm"
            style={{
              background: '#FFFFFF',
              border: `1px solid ${workflow?.color ?? '#000000'}`,
              boxShadow: workflow?.tagShadow ?? '0 3px 20px 0 rgba(0,0,0,0.10)',
              borderRadius: '8px',
              color: workflow?.color ?? '#000000',
            }}
          >
            {workflow?.tagIcon && (
              <span
                className="mr-2 flex items-center"
                style={{ color: workflow?.color ?? '#000000' }}
              >
                {typeof workflow.tagIcon === 'string' ? workflow.tagIcon : workflow.tagIcon}
              </span>
            )}
            <span className="font-['Alibaba_PuHuiTi_Bold',system-ui,-apple-system,sans-serif]">
              {workflow?.tag}
            </span>
          </span>
          <h2 className="mb-4 font-['Alibaba_PuHuiTi_Bold',system-ui,-apple-system,sans-serif] text-2xl md:text-3xl">
            {workflow?.title}
          </h2>
          <ul className="space-y-3">
            {workflow?.bulletPoints?.map((point, index) => (
              <li key={index} className="flex items-center gap-3">
                <span
                  className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-white"
                  style={{ backgroundColor: workflow?.color ?? '#37C390' }}
                >
                  ✓
                </span>
                <span className="font-['Alibaba_PuHuiTi_Light',system-ui,-apple-system,sans-serif] leading-6 text-gray-700">
                  {point}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  </div>
);

function WorkflowBlocks() {
  const { t, i18n } = useTranslation();
  const header = {
    tag: t('landingPage.workflow.tag'),
    tagIcon: <TbActivityHeartbeat />,
    title: t('landingPage.workflow.title'),
    color: '#000000',
    tagShadow:
      '0 3px 20px 0 rgba(0,0,0,0.10), 0 2px 4px 0 rgba(0,0,0,0.10), inset 0 -4px 0 0 rgba(227,227,227,0.50)',
  };

  // Sample feature data
  const workflows: Workflow[] = [
    {
      tag: t('landingPage.workflow.workflowOne.tag'),
      tagIcon: <FaRegPaperPlane className="inline-block" />,
      title: t('landingPage.workflow.workflowOne.title'),
      bulletPoints: t('landingPage.workflow.workflowOne.bulletPoints', {
        returnObjects: true,
      }) as string[],
      imageSrc: 'https://static.refly.ai/landing/generateOutline.webp',
      isReversed: false,
      background: 'linear-gradient(180deg, #F3EEFC 0%, #FFFFFF 100%)',
      color: '#6E3FF3',
      tagShadow: '0 2px 4px 0 rgba(0,0,0,0.10), inset 0 -4px 0 0 rgba(131,98,223,0.12)',
    },
    {
      tag: t('landingPage.workflow.workflowTwo.tag'),
      tagIcon: <LuSearch className="inline-block" />,
      title: t('landingPage.workflow.workflowTwo.title'),
      bulletPoints: t('landingPage.workflow.workflowTwo.bulletPoints', {
        returnObjects: true,
      }) as string[],
      imageSrc: 'https://static.refly.ai/landing/importResource.webp',
      isReversed: true,
      background: 'linear-gradient(180deg, #EAF6FF 0%, #FFFFFF 100%)',
      color: '#3B82F6',
      tagShadow: '0 2px 4px 0 rgba(0,0,0,0.10), inset 0 -4px 0 0 rgba(59,130,246,0.20)',
    },
    {
      tag: t('landingPage.workflow.workflowFive.tag'),
      tagIcon: <HiOutlineDocumentDownload className="inline-block" />,
      title: t('landingPage.workflow.workflowFive.title'),
      bulletPoints: t('landingPage.workflow.workflowFive.bulletPoints', {
        returnObjects: true,
      }) as string[],
      imageSrc: 'https://static.refly.ai/landing/features-clip.webp',
      isReversed: false,
      background: 'linear-gradient(180deg, #E8F5E9 0%, #FFFFFF 100%)',
      color: '#4CAF50',
      tagShadow: '0 2px 4px 0 rgba(0,0,0,0.10), inset 0 -4px 0 0 rgba(76,175,80,0.20)',
    },
    {
      tag: t('landingPage.workflow.workflowThree.tag'),
      tagIcon: <AiOutlineExperiment className="inline-block" />,
      title: t('landingPage.workflow.workflowThree.title'),
      bulletPoints: t('landingPage.workflow.workflowThree.bulletPoints', {
        returnObjects: true,
      }) as string[],
      imageSrc: 'https://static.refly.ai/landing/research.webp',
      isReversed: false,
      background: 'linear-gradient(180deg, #FFF3F3 0%, #FFFFFF 100%)',
      color: '#F17B2C',
      tagShadow: '0 2px 4px 0 rgba(0,0,0,0.10), inset 0 -4px 0 0 rgba(241,123,44,0.10)',
    },
    {
      tag: t('landingPage.workflow.workflowFour.tag'),
      tagIcon: <MdOutlineNoteAlt className="inline-block" />,
      title: t('landingPage.workflow.workflowFour.title'),
      bulletPoints: t('landingPage.workflow.workflowFour.bulletPoints', {
        returnObjects: true,
      }) as string[],
      imageSrc: 'https://static.refly.ai/landing/generateArticle.webp',
      isReversed: true,
      background: 'linear-gradient(180deg, #FCEDCE 0%, #FCFCFC 74%, #FFFFFF 100%)',
      color: '#F1A62D',
      tagShadow: '0 2px 4px 0 rgba(0,0,0,0.10), inset 0 -4px 0 0 rgba(200,140,44,0.20)',
    },
  ];

  return (
    <section className="mt-[98px] px-6 sm:px-6 md:px-6 lg:px-0">
      {/* Header Section */}
      <div className="mb-16 text-center">
        <span
          className="mb-8 inline-flex items-center justify-center rounded-lg border border-solid border-black/10 bg-white px-6 py-2 font-['Alibaba_PuHuiTi_Bold',system-ui,-apple-system,sans-serif] text-sm"
          style={{
            color: header?.color ?? '#000000',
            boxShadow: header?.tagShadow ?? '0 3px 20px 0 rgba(0,0,0,0.10)',
          }}
        >
          {header?.tagIcon && (
            <span className="mr-2 flex items-center" style={{ color: header?.color ?? '#000000' }}>
              {typeof header.tagIcon === 'string' ? header.tagIcon : header.tagIcon}
            </span>
          )}
          <span>{header?.tag}</span>
        </span>
        <section className="text-center">
          <h1 className="font-['Alibaba_PuHuiTi_Bold',system-ui,-apple-system,sans-serif] text-3xl md:text-4xl">
            {i18n.language === 'zh-CN' ? (
              <>
                Refly
                <div className="mt-2">
                  <span className="relative text-[#F17B2C]">
                    主要工作流总览
                    <span className="absolute bottom-0 left-0 h-1 w-full bg-[#F17B2C]" />
                  </span>
                </div>
              </>
            ) : (
              <>
                {header?.title?.split('Primary Features')[0]}
                <div className="mt-2">
                  <span className="relative text-[#F17B2C]">
                    Primary Workflow
                    <span className="absolute bottom-0 left-0 h-1 w-full bg-[#F17B2C]" />
                  </span>
                </div>
              </>
            )}
          </h1>
        </section>
      </div>

      {/* Feature Cards */}
      {workflows?.map((workflow, index) => (
        <WorkflowCard
          key={workflow.tag}
          workflow={workflow}
          isReversed={index % 2 !== 0}
          background={
            workflow.background ??
            `linear-gradient(180deg, ${
              ['#F3EEFC', '#EAF6FF', '#FFF3F3', '#F3FFF3'][index % 4]
            } 0%, #FFFFFF 100%)`
          }
        />
      ))}
    </section>
  );
}

export default WorkflowBlocks;
