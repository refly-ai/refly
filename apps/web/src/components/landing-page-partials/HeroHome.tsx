import { useTranslation } from 'react-i18next';
import './hero-home.scss';
import '../../styles/fonts.scss';
import { cn } from '@refly-packages/ai-workspace-common/utils/cn';
import AnimatedShinyText from '@refly-packages/ai-workspace-common/components/magicui/animated-shiny-text';
import { ArrowRightIcon } from 'lucide-react';
import { MdOutlinePlayCircleFilled } from 'react-icons/md';
import { FaGithub } from 'react-icons/fa6';

import { Button, Modal } from 'antd';
import BlurImage from '@/components/common/BlurImage';
import { useAuthStoreShallow } from '@refly-packages/ai-workspace-common/stores/auth';
import { useState } from 'react';

function HeroHome() {
  const { t, i18n } = useTranslation();
  const { setLoginModalOpen } = useAuthStoreShallow((state) => ({
    setLoginModalOpen: state.setLoginModalOpen,
  }));
  const [isVideoModalOpen, setIsVideoModalOpen] = useState(false);

  const isZhCN = i18n.language === 'zh-CN';

  return (
    <section className="bg-gradient-to-b from-[#D2EAE1] via-[#FCFCFC] to-[#FFFFFF] pt-24">
      <div className="relative mx-auto max-w-7xl px-4">
        {/* Illustration behind hero content */}
        <div
          className="pointer-events-none absolute bottom-0 left-0 -ml-20 hidden lg:block"
          aria-hidden="true"
          data-aos="fade-up"
          data-aos-delay="400"
        >
          <svg
            className="max-w-full"
            width="564"
            height="552"
            viewBox="0 0 564 552"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              <linearGradient
                id="illustration-02"
                x1="-3.766"
                y1="300.204"
                x2="284.352"
                y2="577.921"
                gradientUnits="userSpaceOnUse"
              >
                <stop stopColor="#00968F" stopOpacity=".01" />
                <stop offset="1" stopColor="#00968F" stopOpacity=".32" />
              </linearGradient>
            </defs>
            <path
              fillRule="evenodd"
              clipRule="evenodd"
              d="M151.631 22.954c19.025-13.987 40.754-20.902 67.157-20.902 18.865 0 40.12 3.534 64.461 10.542 15.855 4.566 30.274 8.448 43.282 11.908-3.117-.73-6.316-1.474-9.604-2.238-13.789-3.205-29.419-6.84-46.941-11.331C153.37-18.963 125.867 40.456 75.939 148.322l-.003.006a7576.221 7576.221 0 01-7.711 16.624c-29.474 63.279-43.616 99.759-44.264 135.927-.659 36.738 12.251 72.311 47.633 131.253 35.391 58.957 60.19 86.192 91.501 100.484.962.439 1.93.865 2.905 1.279-9.73-2.472-18.561-5.625-26.916-9.633-32.753-15.71-57.88-43.982-92.714-104.315-34.834-60.333-46.755-96.23-43.984-132.449 2.732-35.713 20.082-71.213 55.526-132.603a7349.326 7349.326 0 009.317-16.2l.004-.007c29.787-51.892 53.315-92.88 84.398-115.734zm34.507 514.934a241.712 241.712 0 01-5.151-.83c-5.964-1.702-11.607-3.772-17.062-6.262-30.898-14.104-55.459-41.124-90.616-99.693-35.167-58.584-48-93.868-47.349-130.187.642-35.809 14.725-72.101 44.078-135.12 2.513-5.395 4.96-10.683 7.356-15.857l.357-.771.002-.005c24.651-53.256 44.122-95.32 71.478-119.633 18.318-16.282 40.065-24.26 67.588-24.26 15.567 0 32.985 2.554 52.67 7.6 14.706 3.77 28.076 6.935 40.144 9.75-2.797-.558-5.665-1.125-8.609-1.707h-.003l-.003-.001-.053-.01h-.001c-12.823-2.535-27.354-5.407-43.664-9.044C148.495-12.404 126.33 48.27 86.092 158.42l-.004.011-.016.042a8434.991 8434.991 0 01-6.201 16.936c-23.765 64.604-34.847 101.709-33.55 137.844C47.638 349.957 61.359 384.852 96.945 442c35.541 57.077 59.736 83.093 89.193 95.888zm16.598 2.005a338.416 338.416 0 01-8.148-.869 103.656 103.656 0 01-7.5-2.904c-28.737-12.428-53.535-39.114-88.445-95.176-35.381-56.82-49.02-91.447-50.323-127.762-1.285-35.802 9.756-72.729 33.428-137.083 1.94-5.276 3.831-10.449 5.683-15.517l.007-.017.007-.021.522-1.427c19.862-54.372 35.55-97.317 59.408-122.911C172.358 9.403 206.126 2.494 256.864 13.81c13.649 3.043 26.048 5.55 37.243 7.773-2.531-.411-5.124-.828-7.785-1.255l-.071-.011h-.003c-11.906-1.914-25.397-4.082-40.56-6.926C144.349-5.618 127.156 56.06 95.945 168.03l-.003.009a8355.73 8355.73 0 01-4.821 17.248c-18.45 65.652-26.689 103.234-23.608 139.244 3.09 36.109 18.017 71.465 53.24 126.105 33.482 51.938 56.333 76.988 81.983 89.257zm54.655.656c-2.322.006-4.68.009-7.073.009-15.823 0-30.079-.135-43.037-.519-20.923-10.699-42.32-33.928-73.018-78.587-35.393-51.49-50.874-83.93-57.12-119.691-4.907-28.091-5.274-56.21 5.907-140.03.786-5.887 1.544-11.65 2.286-17.287v-.001l.042-.32c7.418-56.4 13.278-100.948 27.923-129.427 13.148-25.57 33.385-37.482 64.556-37.482 5.049 0 10.388.312 16.027.93 13.049 1.43 24.617 2.341 34.829 3.145h.001l.114.009h.001c59.526 4.682 79.579 6.26 136.926 89.687 36.003 52.377 54.831 83.312 64.453 117.449 9.765 34.64 10.139 71.93 1.38 137.589-8.64 64.766-18.645 98.41-35.683 119.994-16.965 21.491-41.268 32.104-86.06 46.46-1.661.532-3.296 1.052-4.905 1.56a1391.5 1391.5 0 01-10.245 2.482 1345.267 1345.267 0 01-11.347 1.958 1812.762 1812.762 0 01-12.481 1.367 2129.386 2129.386 0 01-13.476.705zm27.18 1.709c50.448-1.039 82.218-5.164 109.211-18.112 33.159-15.904 58.522-44.394 93.581-105.118 35.06-60.724 47.051-96.934 44.246-133.603-2.762-36.096-20.19-71.792-55.788-133.449-56.949-98.64-86.21-106.404-173.068-129.448l-.056-.014c-14.774-3.92-31.516-8.363-50.261-13.76C159.031-25.254 125.808 32.624 65.497 137.694l-.002.003a6915.634 6915.634 0 01-9.316 16.197C20.581 215.552 3.154 251.247.392 287.344c-2.806 36.669 9.186 72.879 44.245 133.603 35.06 60.724 60.423 89.214 93.582 105.118 12.593 6.04 26.224 10.16 42.307 12.943 6.906 1.966 14.23 3.443 22.172 4.508 6.442 1.628 13.241 2.748 20.583 3.429 5.999 1.314 12.297 2.105 19.071 2.433 5.603 1.028 11.455 1.517 17.722 1.517l.314-.001c3.67.505 7.416.742 11.25.742 13.466 0 28.027-2.926 44.299-7.459zm18.196-2.551c42.427-3.518 69.755-9.295 92.704-22.832 29.646-17.487 51.462-47.164 80.495-109.498 29.027-62.318 38.148-99.046 33.653-135.513-4.425-35.901-22.303-70.703-58.23-130.556-39.939-66.535-65.307-89.912-104.239-104.3 53.844 16.863 81.528 37.31 126.939 115.968 35.443 61.39 52.793 96.891 55.525 132.603 2.772 36.219-9.149 72.116-43.983 132.449-34.834 60.333-59.962 88.605-92.714 104.315-23.296 11.175-50.3 15.706-90.15 17.364zm93.883-30.185c-20.416 14.652-45.267 21.74-84.153 27.302 36.558-3.571 61.14-9.392 81.957-21.671 29.256-17.257 50.857-46.697 79.7-108.619 28.849-61.94 37.924-98.373 33.479-134.425-4.381-35.543-22.179-70.166-57.959-129.772-45.707-76.146-72.185-95.334-122.253-109.565 36.374 12.515 60.888 34.697 100.963 99.056 36.138 58.035 54.382 91.924 60.326 127.553 6.035 36.185-.421 73.291-23.824 136.909-23.412 63.646-41.906 94.334-68.236 113.232zm-75.097 23.912c35.377-7.423 57.817-15.704 75.801-31.314 23.206-20.143 38.593-51.68 56.77-116.363 18.167-64.644 22.158-101.999 14.722-137.83-7.323-35.285-25.856-68.245-62.092-124.454-40.109-62.219-63.784-83.239-97.755-94.01 46.513 11.797 71.824 29.769 117.688 103.423 35.995 57.806 54.162 91.528 60.05 126.824 5.972 35.804-.459 72.634-23.728 135.889-22.96 62.416-41.892 93.9-67.525 112.298-18.433 13.228-40.651 20.217-73.931 25.537zm76.065-38.742c-16.398 17.18-38.639 26.625-66.953 34.691 29.631-6.852 49.359-14.869 65.378-28.773 22.583-19.603 38.327-51.956 56.156-115.394 18.071-64.301 22.052-101.4 14.688-136.882-7.258-34.975-25.716-67.78-61.814-123.777-45.857-71.136-70.036-87.963-113.146-97.515 31.663 9.156 54.508 29.065 94.518 89.127 36.23 54.385 54.981 86.404 63.553 121.278 8.703 35.411 6.992 72.898-6.313 138.315-13.314 64.216-25.834 97.286-46.067 117.947-13.941 14.607-31.58 23.548-58.315 31.795z"
              fill="url(#illustration-02)"
            />
          </svg>
        </div>

        {/* Hero content */}
        <div className="relative pb-10 pt-32 md:pb-16 md:pt-24">
          {/* Section header */}
          <div className="scroll-tag mx-auto max-w-3xl pb-8 text-center">
            <div className="mb-7 flex flex-col items-center text-center sm:mb-6">
              <div className="mb-5">
                <div className="z-10 flex items-center justify-center">
                  <div
                    onClick={() => {
                      window.open(
                        'https://github.com/refly-ai/refly/releases/tag/v0.6.0',
                        '_blank',
                      );
                    }}
                    className={cn(
                      'group inline-flex items-center justify-center rounded-lg border border-black/5 bg-white text-base hover:cursor-pointer hover:bg-neutral-50',
                      'px-6',
                      'py-2',
                      'w-fit min-w-[320px] sm:min-w-[480px]',
                    )}
                  >
                    <AnimatedShinyText className="flex-1 inline-flex items-center justify-center transition ease-out">
                      <span className="whitespace-nowrap text-[#00968F] text-sm sm:text-base">
                        🚀 {t('landingPage.messageText')}
                      </span>
                    </AnimatedShinyText>
                    <ArrowRightIcon className="ml-2 h-4 w-4 shrink-0 text-[#00968F] transition-transform duration-300 ease-in-out group-hover:translate-x-0.5" />
                  </div>
                </div>
              </div>

              <h1
                className={cn(
                  "mb-5 flex max-w-7xl flex-col font-['Alibaba_PuHuiTi_Bold',system-ui,-apple-system,sans-serif]",
                  'text-[3rem] !tracking-[-0.2rem] sm:mb-6 sm:text-[5rem]',
                  isZhCN ? 'leading-[1.2]' : 'leading-[0.9]',
                )}
              >
                {/* First line */}
                <span className={cn('span-wrap-styles', isZhCN ? 'mb-1' : 'mb-0')}>
                  {isZhCN ? (
                    // Chinese first line
                    <span
                      className="relative inline-block bg-gradient-to-r from-[#2D36FF] to-[#DC55DF] bg-clip-text text-transparent"
                      style={{
                        backgroundImage: 'linear-gradient(55deg, #2D36FF 8%, #DC55DF 114%)',
                        paddingRight: '4px',
                      }}
                    >
                      AI Native
                      {/* Decorative lines */}
                      <div
                        className="absolute -right-10 -top-5 flex gap-1"
                        style={{
                          transform: 'rotate(30deg)',
                          transformOrigin: 'bottom left',
                        }}
                      >
                        {[45, 90, 135].map((rotation, index) => (
                          <div
                            key={index}
                            className="animate-decorative-line h-[6px] w-[18px]"
                            style={
                              {
                                background: 'linear-gradient(55deg, #2D36FF 8%, #DC55DF 114%)',
                                transformOrigin: 'center',
                                animationDelay: `${index * 0.2}s`,
                                '--rotation': `${rotation}deg`,
                              } as React.CSSProperties
                            }
                          />
                        ))}
                      </div>
                    </span>
                  ) : (
                    // English first line
                    <>
                      The{' '}
                      <span
                        className="relative inline-block bg-gradient-to-r from-[#2D36FF] to-[#DC55DF] bg-clip-text text-transparent"
                        style={{
                          backgroundImage: 'linear-gradient(55deg, #2D36FF 8%, #DC55DF 114%)',
                          paddingRight: '4px',
                        }}
                      >
                        {i18n.language === 'zh-CN' ? 'AI 原生' : 'AI Native'}
                        {/* Decorative lines */}
                        <div
                          className="absolute -right-10 -top-5 flex gap-1"
                          style={{
                            transform: 'rotate(30deg)',
                            transformOrigin: 'bottom left',
                          }}
                        >
                          {[45, 90, 135].map((rotation, index) => (
                            <div
                              key={index}
                              className="animate-decorative-line h-[6px] w-[18px]"
                              style={
                                {
                                  background: 'linear-gradient(55deg, #2D36FF 8%, #DC55DF 114%)',
                                  transformOrigin: 'center',
                                  animationDelay: `${index * 0.2}s`,
                                  '--rotation': `${rotation}deg`,
                                } as React.CSSProperties
                              }
                            />
                          ))}
                        </div>
                      </span>
                    </>
                  )}
                </span>

                {/* Second line with wavy underline */}
                <span
                  className="span-wrap-styles relative"
                  style={{
                    marginTop: isZhCN ? 0 : 12,
                    fontSize: isZhCN ? '0.95em' : '1em',
                  }}
                >
                  <span>{isZhCN ? '创作引擎' : 'Creation Engine'}</span>
                  <svg
                    className="absolute bottom-[-8px] left-0 w-full"
                    height={isZhCN ? '20' : '16'}
                    viewBox="0 0 100 16"
                    preserveAspectRatio="none"
                  >
                    <path
                      d="M0,8 Q20,2, 40,8 T80,8 T100,8"
                      fill="none"
                      stroke="#FFA900"
                      strokeWidth="4"
                      className="wavy-line"
                    />
                  </svg>
                </span>
              </h1>
              <p className="flex max-w-[18rem] flex-col items-center gap-0.5 font-['Alibaba_PuHuiTi_Light',system-ui,-apple-system,sans-serif] text-base !leading-[1.3] !tracking-[-0.02rem] sm:max-w-xl sm:text-lg">
                <span className="span-wrap-styles text-[rgba(0, 0, 0, .5)]">
                  {t('landingPage.simplyDescription.first')}
                </span>
                <span className="span-wrap-styles text-[rgba(0, 0, 0, .5)]">
                  {t('landingPage.simplyDescription.second')}
                </span>
              </p>
            </div>

            {/* Add buttons after the description paragraph */}
            <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row sm:gap-6">
              <Button
                onClick={() => setLoginModalOpen(true)}
                size="large"
                type="primary"
                className="cursor-pointer"
                data-cy="try-for-free-button"
              >
                {t('landingPage.tryForFree')}
              </Button>

              <Button
                onClick={() => window.open('https://github.com/refly-ai/refly', '_blank')}
                size="large"
                icon={<FaGithub className="flex h-5 w-5 items-center justify-center" />}
                className="cursor-pointer"
              >
                {isZhCN ? 'GitHub' : 'GitHub'}
              </Button>
            </div>
          </div>

          {/* <div className="flex justify-center">
            <a
              href="https://www.producthunt.com/posts/refly-3?embed=true&utm_source=badge-featured&utm_medium=badge&utm_souce=badge-refly&#0045;3"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block transition-opacity hover:opacity-80"
            >
              <img
                src="https://api.producthunt.com/widgets/embed-image/v1/featured.svg?post_id=785558&theme=light&t=1736929638628"
                alt="Refly - The AI Native Content Creation Engine | Product Hunt"
                className="w-[170px]"
                loading="lazy"
              />
            </a>
          </div> */}

          {/* Hero image */}
          <div className="group relative mt-6 flex justify-center overflow-hidden sm:mt-10">
            <div
              onClick={() => setIsVideoModalOpen(true)}
              className={cn(
                'relative mx-auto w-[100%] cursor-pointer rounded-[12px] border border-solid border-black/5',
                'bg-[rgba(242,246,253,0.92)] p-1 sm:p-2',
                'will-change-transform',
                'scale-100 transition-[transform] duration-200 ease-out',
                'group-hover:scale-[0.95]',
              )}
            >
              <div className="absolute inset-0 z-10 rounded-md bg-black/30 opacity-0 transition-opacity duration-200 group-hover:opacity-50" />

              <div className="absolute left-1/2 top-1/2 z-20 -translate-x-1/2 -translate-y-1/2 transform">
                <MdOutlinePlayCircleFilled className="h-16 w-16 text-white opacity-0 transition-all duration-200 group-hover:scale-110 group-hover:opacity-100" />
              </div>
              <BlurImage
                className="shadow-heroImageInner mx-auto w-full rounded-md"
                src="https://static.refly.ai/landing/generateArticle.webp"
                alt="Hero"
                aspectRatio="4/3"
              />
            </div>

            <Modal
              open={isVideoModalOpen}
              onCancel={() => setIsVideoModalOpen(false)}
              footer={null}
              width="80%"
              centered
              className="video-modal"
              destroyOnClose
            >
              <div className="relative pb-[56.25%]">
                <iframe
                  className="absolute left-0 top-0 h-full w-full"
                  src="https://www.youtube.com/embed/MWgWy_LBtko?autoplay=1"
                  title="YouTube video player"
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            </Modal>
          </div>
        </div>
      </div>
    </section>
  );
}

export default HeroHome;
