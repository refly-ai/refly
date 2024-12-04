import { useTranslation } from "react-i18next"
import "./hero-home.scss"
import "../../styles/fonts.scss"
import { cn } from "@refly-packages/ai-workspace-common/utils/cn"
import AnimatedShinyText from "@/components/magicui/animated-shiny-text"
import { ArrowRightIcon } from "lucide-react"
import { Button } from "antd"

function HeroHome() {
  const { t } = useTranslation()
  return (
    <section className="bg-gradient-to-b from-[#D2EAE1] via-[#FCFCFC] to-[#FFFFFF]">
      <div className="relative mx-auto max-w-4xl px-4">
        {/* Illustration behind hero content */}
        <div
          className="pointer-events-none absolute bottom-0 left-0 -ml-20 hidden lg:block"
          aria-hidden="true"
          data-aos="fade-up"
          data-aos-delay="400">
          <svg
            className="max-w-full"
            width="564"
            height="552"
            viewBox="0 0 564 552"
            fill="none"
            xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient
                id="illustration-02"
                x1="-3.766"
                y1="300.204"
                x2="284.352"
                y2="577.921"
                gradientUnits="userSpaceOnUse">
                <stop stopColor="#00968F" stopOpacity=".01" />
                <stop offset="1" stopColor="#00968F" stopOpacity=".32" />
              </linearGradient>
            </defs>
            <path
              fillRule="evenodd"
              clipRule="evenodd"
              d="M151.631 22.954c19.025-13.987 40.754-20.902 67.157-20.902 18.865 0 40.12 3.534 64.461 10.542 15.855 4.566 30.274 8.448 43.282 11.908-3.117-.73-6.316-1.474-9.604-2.238-13.789-3.205-29.419-6.84-46.941-11.331C153.37-18.963 125.867 40.456 75.939 148.322l-.003.006a7576.221 7576.221 0 01-7.711 16.624c-29.474 63.279-43.616 99.759-44.264 135.927-.659 36.738 12.251 72.311 47.633 131.253 35.391 58.957 60.19 86.192 91.501 100.484.962.439 1.93.865 2.905 1.279-9.73-2.472-18.561-5.625-26.916-9.633-32.753-15.71-57.88-43.982-92.714-104.315-34.834-60.333-46.755-96.23-43.984-132.449 2.732-35.713 20.082-71.213 55.526-132.603a7349.326 7349.326 0 009.317-16.2l.004-.007c29.787-51.892 53.315-92.88 84.398-115.734zm34.507 514.934a241.712 241.712 0 01-5.151-.83c-5.964-1.702-11.607-3.772-17.062-6.262-30.898-14.104-55.459-41.124-90.616-99.693-35.167-58.584-48-93.868-47.349-130.187.642-35.809 14.725-72.101 44.078-135.12 2.513-5.395 4.96-10.683 7.356-15.857l.357-.771.002-.005c24.651-53.256 44.122-95.32 71.478-119.633 18.318-16.282 40.065-24.26 67.588-24.26 15.567 0 32.985 2.554 52.67 7.6 14.706 3.77 28.076 6.935 40.144 9.75-2.797-.558-5.665-1.125-8.609-1.707h-.003l-.003-.001-.053-.01h-.001c-12.823-2.535-27.354-5.407-43.664-9.044C148.495-12.404 126.33 48.27 86.092 158.42l-.004.011-.016.042a8434.991 8434.991 0 01-6.201 16.936c-23.765 64.604-34.847 101.709-33.55 137.844C47.638 349.957 61.359 384.852 96.945 442c35.541 57.077 59.736 83.093 89.193 95.888zm16.598 2.005a338.416 338.416 0 01-8.148-.869 103.656 103.656 0 01-7.5-2.904c-28.737-12.428-53.535-39.114-88.445-95.176-35.381-56.82-49.02-91.447-50.323-127.762-1.285-35.802 9.756-72.729 33.428-137.083 1.94-5.276 3.831-10.449 5.683-15.517l.007-.017.007-.021.522-1.427c19.862-54.372 35.55-97.317 59.408-122.911C172.358 9.403 206.126 2.494 256.864 13.81c13.649 3.043 26.048 5.55 37.243 7.773-2.531-.411-5.124-.828-7.785-1.255l-.071-.011h-.003c-11.906-1.914-25.397-4.082-40.56-6.926C144.349-5.618 127.156 56.06 95.945 168.03l-.003.009a8355.73 8355.73 0 01-4.821 17.248c-18.45 65.652-26.689 103.234-23.608 139.244 3.09 36.109 18.017 71.465 53.24 126.105 33.482 51.938 56.333 76.988 81.983 89.257zm15.827 1.2a485.788 485.788 0 01-9.653-.664l-.264-.107c-27.037-11.022-51.209-36.471-86.212-90.77-35.484-55.044-49.829-88.975-52.928-125.19-3.055-35.705 5.157-73.119 23.541-138.534a8620.925 8620.925 0 004.497-16.087l.325-1.165.002-.006c15.402-55.255 27.568-98.9 48.147-125.608 16.123-20.925 37.347-30.952 66.801-30.952 9.869 0 20.667 1.127 32.5 3.347 12.636 2.37 24.106 4.27 34.467 5.944-2.277-.28-4.608-.562-6.997-.85h-.001l-.001-.001h-.001c-11.054-1.338-23.584-2.855-37.688-4.97-94.204-14.122-106.775 48.314-129.594 161.65l-.003.014-.047.235-.002.008a8400.92 8400.92 0 01-3.479 17.22c-13.513 66.44-19.115 104.361-14.4 140.163 4.727 35.898 20.289 70.48 55.506 123.345 31.385 47.111 52.956 71.08 75.484 82.978zm15.539.719a709.825 709.825 0 01-10.437-.441c-23.548-10.908-46.233-35.298-78.922-84.366-35.486-53.268-50.443-86.468-55.187-122.497-3.728-28.301-2.526-56.394 14.377-139.503 1.21-5.95 2.383-11.773 3.529-17.466 11.26-55.927 20.154-100.102 37.666-127.768 18.294-28.901 45.951-38.863 89.673-32.313 11.708 1.755 22.326 3.099 31.917 4.27-2.072-.167-4.193-.334-6.366-.505h-.002l-.018-.002c-10.221-.803-21.804-1.714-34.864-3.146-87.388-9.576-95.67 53.388-110.705 167.692l-.002.014-.047.36c-.74 5.623-1.496 11.372-2.28 17.244-8.937 66.993-12.098 105.125-5.896 140.639 6.221 35.612 22.326 69.391 57.443 120.48 29.544 42.981 49.981 65.798 70.121 77.308zm54.655.656c-2.322.006-4.68.009-7.073.009-15.823 0-30.079-.135-43.037-.519-20.923-10.699-42.32-33.928-73.018-78.587-35.393-51.49-50.874-83.93-57.12-119.691-4.907-28.091-5.274-56.21 5.907-140.03.786-5.887 1.544-11.65 2.286-17.287v-.001l.042-.32c7.418-56.4 13.278-100.948 27.923-129.427 13.148-25.57 33.385-37.482 64.556-37.482 5.049 0 10.388.312 16.027.93 13.049 1.43 24.617 2.341 34.829 3.145h.001l.114.009h.001c59.526 4.682 79.579 6.26 136.926 89.687 36.003 52.377 54.831 83.312 64.453 117.449 9.765 34.64 10.139 71.93 1.38 137.589-8.64 64.766-18.645 98.41-35.683 119.994-16.965 21.491-41.268 32.104-86.06 46.46-1.661.532-3.296 1.052-4.905 1.56a1391.5 1391.5 0 01-10.245 2.482 1345.267 1345.267 0 01-11.347 1.958 1812.762 1812.762 0 01-12.481 1.367 2129.386 2129.386 0 01-13.476.705zm27.18 1.709c50.448-1.039 82.218-5.164 109.211-18.112 33.159-15.904 58.522-44.394 93.581-105.118 35.06-60.724 47.051-96.934 44.246-133.603-2.762-36.096-20.19-71.792-55.788-133.449-56.949-98.64-86.21-106.404-173.068-129.448l-.056-.014c-14.774-3.92-31.516-8.363-50.261-13.76C159.031-25.254 125.808 32.624 65.497 137.694l-.002.003a6915.634 6915.634 0 01-9.316 16.197C20.581 215.552 3.154 251.247.392 287.344c-2.806 36.669 9.186 72.879 44.245 133.603 35.06 60.724 60.423 89.214 93.582 105.118 12.593 6.04 26.224 10.16 42.307 12.943 6.906 1.966 14.23 3.443 22.172 4.508 6.442 1.628 13.241 2.748 20.583 3.429 5.999 1.314 12.297 2.105 19.071 2.433 5.603 1.028 11.455 1.517 17.722 1.517l.314-.001c3.67.505 7.416.742 11.25.742 13.466 0 28.027-2.926 44.299-7.459zm18.196-2.551c42.427-3.518 69.755-9.295 92.704-22.832 29.646-17.487 51.462-47.164 80.495-109.498 29.027-62.318 38.148-99.046 33.653-135.513-4.425-35.901-22.303-70.703-58.23-130.556-39.939-66.535-65.307-89.912-104.239-104.3 53.844 16.863 81.528 37.31 126.939 115.968 35.443 61.39 52.793 96.891 55.525 132.603 2.772 36.219-9.149 72.116-43.983 132.449-34.834 60.333-59.962 88.605-92.714 104.315-23.296 11.175-50.3 15.706-90.15 17.364zm93.883-30.185c-20.416 14.652-45.267 21.74-84.153 27.302 36.558-3.571 61.14-9.392 81.957-21.671 29.256-17.257 50.857-46.697 79.7-108.619 28.849-61.94 37.924-98.373 33.479-134.425-4.381-35.543-22.179-70.166-57.959-129.772-45.707-76.146-72.185-95.334-122.253-109.565 36.374 12.515 60.888 34.697 100.963 99.056 36.138 58.035 54.382 91.924 60.326 127.553 6.035 36.185-.421 73.291-23.824 136.909-23.412 63.646-41.906 94.334-68.236 113.232zm-75.097 23.912c35.377-7.423 57.817-15.704 75.801-31.314 23.206-20.143 38.593-51.68 56.77-116.363 18.167-64.644 22.158-101.999 14.722-137.83-7.323-35.285-25.856-68.245-62.092-124.454-40.109-62.219-63.784-83.239-97.755-94.01 46.513 11.797 71.824 29.769 117.688 103.423 35.995 57.806 54.162 91.528 60.05 126.824 5.972 35.804-.459 72.634-23.728 135.889-22.96 62.416-41.892 93.9-67.525 112.298-18.433 13.228-40.651 20.217-73.931 25.537zm76.065-38.742c-16.398 17.18-38.639 26.625-66.953 34.691 29.631-6.852 49.359-14.869 65.378-28.773 22.583-19.603 38.327-51.956 56.156-115.394 18.071-64.301 22.052-101.4 14.688-136.882-7.258-34.975-25.716-67.78-61.814-123.777-45.857-71.136-70.036-87.963-113.146-97.515 31.663 9.156 54.508 29.065 94.518 89.127 36.23 54.385 54.981 86.404 63.553 121.278 8.703 35.411 6.992 72.898-6.313 138.315-13.314 65.463-25.834 97.286-46.067 118.93zm-59.762 30.414c25.551-9.413 45.464-19.917 59.62-37.85 17.506-22.178 27.29-54.964 36.094-120.97 8.799-65.956 8.41-103.465-1.437-138.395-4.847-17.196-12.323-34.408-23.53-54.17-10.572-18.643-24.116-39.015-41.2-63.869-39.854-57.98-61.888-76.799-91.408-84.443 39.946 7.477 63.031 23.183 108.786 91.868 36.098 54.188 54.774 86.063 63.275 120.648 8.626 35.092 6.91 72.342-6.33 137.439-13.062 64.216-25.834 97.286-45.555 117.947-13.941 14.607-31.58 23.548-58.315 31.795z"
              fill="url(#illustration-02)"
            />
          </svg>
        </div>

        {/* Hero content */}
        <div className="relative pb-10 pt-32 md:pb-16 md:pt-24">
          {/* Section header */}
          <div className="mx-auto max-w-3xl pb-8 text-center">
            <div className="mb-7 flex flex-col items-center text-center sm:mb-6">
              <div className="mb-5">
                <div className="z-10 flex items-center justify-center">
                  <div
                    onClick={() => {
                      // userStore.setWaitingListModalVisible(true)
                    }}
                    className={cn(
                      "group rounded-md border border-black/5 bg-black text-base text-white transition-all ease-in hover:cursor-pointer hover:bg-neutral-900 dark:border-white/5",
                    )}>
                    <AnimatedShinyText className="inline-flex items-center justify-center px-4 py-1 transition ease-out hover:text-neutral-200">
                      <span className="text-white">
                        ✨ {t("landingPage.messageText")}
                      </span>
                      <ArrowRightIcon className="ml-1 size-3 text-white transition-transform duration-300 ease-in-out group-hover:translate-x-0.5" />
                    </AnimatedShinyText>
                  </div>
                </div>
              </div>

              <h1 className="mb-5 flex max-w-4xl flex-col font-['Alibaba_PuHuiTi_Bold',system-ui,-apple-system,sans-serif] text-[3rem] leading-[0.9] !tracking-[-0.2rem] sm:mb-6 sm:text-[5rem]">
                <span className="span-wrap-styles">
                  The{" "}
                  <span
                    className="relative inline-block bg-gradient-to-r from-[#2D36FF] to-[#DC55DF] bg-clip-text text-transparent"
                    style={{
                      backgroundImage:
                        "linear-gradient(55deg, #2D36FF 8%, #DC55DF 114%)",
                      paddingRight: "4px",
                    }}>
                    AI Native
                    <div
                      className="absolute -right-10 -top-5 flex gap-1"
                      style={{
                        transform: "rotate(30deg)",
                        transformOrigin: "bottom left",
                      }}>
                      {[45, 90, 135].map((rotation, index) => (
                        <div
                          key={index}
                          className="animate-decorative-line h-[6px] w-[18px]"
                          style={
                            {
                              background:
                                "linear-gradient(55deg, #2D36FF 8%, #DC55DF 114%)",
                              transformOrigin: "center",
                              animationDelay: `${index * 0.2}s`,
                              "--rotation": `${rotation}deg`,
                            } as React.CSSProperties
                          }
                        />
                      ))}
                    </div>
                  </span>
                </span>
                <span
                  className="span-wrap-styles relative"
                  style={{ marginTop: 12 }}>
                  <span>{t("landingPage.simplySlogan")}</span>
                  <svg
                    className="absolute bottom-[-8px] left-0 w-full"
                    height="16"
                    viewBox="0 0 100 16"
                    preserveAspectRatio="none">
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
                  {t("landingPage.simplyDescription.first")}
                </span>
                <span className="span-wrap-styles text-[rgba(0, 0, 0, .5)]">
                  {t("landingPage.simplyDescription.second")}
                </span>
              </p>
            </div>

            {/* Add buttons after the description paragraph */}
            <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row sm:gap-6">
              <Button
                onClick={() => {
                  // Add your free trial logic here
                }}
                size="large"
                type="primary"
                className="group inline-flex cursor-pointer items-center justify-center rounded-md px-6 py-3 text-base font-medium text-white transition-all duration-200 hover:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2 dark:bg-white dark:text-black dark:hover:bg-neutral-200">
                {t("landingPage.tryForFree")}
              </Button>

              <Button
                onClick={() => {
                  // Add your contact logic here
                }}
                size="large"
                className="group inline-flex cursor-pointer items-center justify-center rounded-md border border-black/10 bg-white px-6 py-3 text-base font-medium text-black transition-all duration-200 hover:bg-neutral-50 focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2 dark:border-white dark:bg-black dark:text-white dark:hover:bg-neutral-900">
                {t("landingPage.contactUs")}
              </Button>
            </div>
          </div>

          {/* Hero image */}
          <div className="relative mt-12 flex justify-center overflow-visible sm:mt-10">
            <div className="border-[rgba(0, 0, 0, .8)] mx-auto w-[100%] rounded-[12px] border border-solid bg-[rgba(242,246,253,0.92)] p-1 shadow-[0px_0.602187px_0.602187px_-0.833333px_rgba(23,35,100,0.06),0px_2.28853px_2.28853px_-1.66667px_rgba(23,35,100,0.06),0px_10px_10px_-2.5px_rgba(23,35,100,0.06)] sm:p-2">
              <img
                className="shadow-heroImageInner mx-auto w-full rounded-md"
                src="https://static.refly.ai/landing/generateArticle.png"
                alt="Hero"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

export default HeroHome
