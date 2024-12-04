import React, { ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { AiOutlineAppstore, AiOutlineExperiment } from "react-icons/ai"
import { FaRegPaperPlane } from "react-icons/fa"
import { LuSearch } from "react-icons/lu"
import { MdOutlineNoteAlt } from "react-icons/md"

// Feature type definition for better type safety
interface Feature {
  tag: string
  tagIcon?: string | ReactNode
  title: string
  description: string
  bulletPoints: string[]
  imageSrc: string
  isReversed?: boolean
  background?: string
}

interface FeatureCardProps {
  isReversed?: boolean
  background?: string
}

const FeatureCard = ({
  feature,
  isReversed = false,
  background = "linear-gradient(180deg, #F3EEFC 0%, #FFFFFF 100%)",
}: FeatureCardProps & { feature: Feature }) => (
  <div className="relative mx-auto mt-[40px] w-full md:w-[65%]">
    <div
      className="min-h-[360px] w-full overflow-visible rounded-[20px] md:h-[600px]"
      style={{
        background,
        border: "1px solid rgba(0, 0, 0, 0.05)",
      }}>
      <div
        className={`flex h-full flex-col gap-6 p-6 md:flex-row ${
          isReversed ? "md:flex-row-reverse" : ""
        }`}>
        {/* Image Section */}
        <div className="relative h-[260px] md:h-auto md:w-1/2">
          <img
            src={feature?.imageSrc ?? "/fallback-image.png"}
            alt={`${feature?.title ?? "Feature"} visualization`}
            className="absolute h-full w-[130%] object-contain"
            style={{
              [isReversed ? "right" : "left"]: "-30%",
              borderRadius: "20px",
              opacity: 1,
              boxSizing: "border-box",
            }}
          />
        </div>

        {/* Content Section */}
        <div className="flex flex-col justify-center md:w-1/2">
          <span className="mb-3 inline-flex w-fit items-center rounded-lg border border-solid border-black/10 bg-white px-4 py-1 text-sm font-medium shadow-[0_3px_20px_0_rgba(0,0,0,0.10)]">
            {feature?.tagIcon && (
              <span className="mr-2 flex items-center">
                {typeof feature.tagIcon === "string"
                  ? feature.tagIcon
                  : feature.tagIcon}
              </span>
            )}
            <span>{feature?.tag}</span>
          </span>
          <h2 className="mb-4 text-2xl font-bold md:text-3xl">
            {feature?.title}
          </h2>
          <ul className="space-y-3">
            {feature?.bulletPoints?.map((point, index) => (
              <li key={index} className="flex items-start gap-3">
                <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-green-500 text-white">
                  ✓
                </span>
                <span className="text-gray-700">{point}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  </div>
)

function FeaturesBlocks() {
  const { t } = useTranslation()
  const header = {
    tag: t("landingPage.features.tag"),
    tagIcon: <AiOutlineAppstore />,
    title: t("landingPage.features.title"),
  }

  // Sample feature data
  const features: Feature[] = [
    {
      tag: "Plan",
      tagIcon: <FaRegPaperPlane className="inline-block" />,
      title: t("landingPage.features.featureOne.title"),
      description: t("landingPage.features.featureOne.description"),
      bulletPoints: t("landingPage.features.featureOne.bulletPoints", {
        returnObjects: true,
      }) as string[],
      imageSrc: "https://static.refly.ai/landing/generateOutline.png",
      isReversed: false,
      background: "linear-gradient(180deg, #F3EEFC 0%, #FFFFFF 100%)",
    },
    {
      tag: t("landingPage.features.featureTwo.tag"),
      tagIcon: <LuSearch className="inline-block" />,
      title: t("landingPage.features.featureTwo.title"),
      description: t("landingPage.features.featureTwo.description"),
      bulletPoints: t("landingPage.features.featureTwo.bulletPoints", {
        returnObjects: true,
      }) as string[],
      imageSrc: "https://static.refly.ai/landing/importResource.png",
      isReversed: true,
      background: "linear-gradient(180deg, #EAF6FF 0%, #FFFFFF 100%)",
    },
    {
      tag: "Research",
      tagIcon: <AiOutlineExperiment className="inline-block" />,
      title: t("landingPage.features.featureThree.title"),
      description: t("landingPage.features.featureThree.description"),
      bulletPoints: t("landingPage.features.featureThree.bulletPoints", {
        returnObjects: true,
      }) as string[],
      imageSrc: "https://static.refly.ai/landing/research.png",
      isReversed: false,
      background: "linear-gradient(180deg, #FFF3F3 0%, #FFFFFF 100%)",
    },
    {
      tag: "Thinking & Creation",
      tagIcon: <MdOutlineNoteAlt className="inline-block" />,
      title: t("landingPage.features.featureFour.title"),
      description: t("landingPage.features.featureFour.description"),
      bulletPoints: t("landingPage.features.featureFour.bulletPoints", {
        returnObjects: true,
      }) as string[],
      imageSrc: "https://static.refly.ai/landing/generateArticle.png",
      isReversed: true,
      background: "linear-gradient(180deg, #F3FFF3 0%, #FFFFFF 100%)",
    },
  ]

  return (
    <section className="mt-[98px] px-6 sm:px-6 md:px-6 lg:px-0">
      {/* Header Section */}
      <div className="mb-16 text-center">
        <span className="mb-8 inline-flex items-center justify-center rounded-lg border border-solid border-black/10 bg-white px-6 py-2 text-sm font-medium shadow-[0_3px_20px_0_rgba(0,0,0,0.10)]">
          {header?.tagIcon && (
            <span className="mr-2 flex items-center">
              {typeof header.tagIcon === "string"
                ? header.tagIcon
                : header.tagIcon}
            </span>
          )}
          <span>{header?.tag}</span>
        </span>
        <section className="text-center">
          <h1 className="text-3xl font-bold md:text-4xl">
            {header?.title?.split("Primary Features")[0] ??
              "An Overview of Refly's"}
            <div className="mt-2">
              <span className="relative text-[#F17B2C]">
                Primary Features
                <span className="absolute bottom-0 left-0 h-1 w-full bg-[#F17B2C]"></span>
              </span>
            </div>
          </h1>
        </section>
      </div>

      {/* Feature Cards */}
      {features?.map((feature, index) => (
        <FeatureCard
          key={feature.tag}
          feature={feature}
          isReversed={index % 2 !== 0}
          background={
            feature.background ??
            `linear-gradient(180deg, ${
              ["#F3EEFC", "#EAF6FF", "#FFF3F3", "#F3FFF3"][index % 4]
            } 0%, #FFFFFF 100%)`
          }
        />
      ))}
    </section>
  )
}

export default FeaturesBlocks
