import { Link } from "react-router-dom"
import Logo from "@/assets/logo.svg"
import { useTranslation } from "react-i18next"
import "./footer.scss"
import { Button } from "antd"
import { IconGithub, IconTwitter } from "@arco-design/web-react/icon"

function Footer() {
  const { t } = useTranslation()

  return (
    <footer className="px-6">
      <div className="py-12 md:py-16">
        <div className="mx-auto w-full md:w-[70%]">
          {/* CTA Block */}
          <div
            className="mb-[72px] flex h-[380px] w-full flex-col items-center justify-center rounded-[20px] border border-[#E3E3E3] p-12 text-center"
            style={{
              backgroundImage:
                "linear-gradient(180deg, #F8E2D3 0%, #FCFBFA 95%, #FCFAF9 100%, #FCFCFC 100%, #FFFFFF 100%)",
            }}>
            <h2 className="mb-6 text-3xl font-bold md:text-4xl">
              {t("landingPage.footer.cta.title")}
            </h2>
            <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Button
                size="large"
                className="rounded-md bg-[#00968F] px-8 py-3 text-white transition hover:bg-[#007A74]"
                target="_blank">
                {t("landingPage.footer.cta.getStarted")}
              </Button>
              <Button
                size="large"
                className="rounded-md bg-white px-8 py-3 text-[#00968F] shadow-sm transition hover:bg-gray-50"
                target="_blank">
                {t("landingPage.footer.cta.contactUs")}
              </Button>
            </div>
          </div>

          {/* Main Footer Content */}
          <div
            className="w-full rounded-[20px] border border-[#E3E3E3] p-8 md:p-12"
            style={{
              backgroundImage:
                "linear-gradient(180deg, #FAF8F4 0%, #FCFBFA 95%, #FCFAF9 100%, #FCFCFC 100%, #FFFFFF 100%)",
            }}>
            {/* Updated Footer Layout */}
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-[360px_1fr]">
              {/* Left Column - Logo, Description, Social */}
              <div className="max-w-[360px]">
                <Link
                  to="/"
                  className="mb-4 inline-block no-underline"
                  aria-label="Refly">
                  <div className="flex items-center gap-2">
                    <img src={Logo} alt="" className="h-8 w-8" />
                    <span className="text-xl font-bold text-black">Refly</span>
                  </div>
                </Link>
                <p className="mb-6 max-w-[320px] text-base leading-relaxed text-gray-600">
                  {t("landingPage.description")}
                </p>
                <div className="flex items-center gap-4">
                  <Link
                    to="https://twitter.com/tuturetom"
                    target="_blank"
                    className="rounded-md bg-gray-100 px-4 py-1 text-gray-600 no-underline transition hover:bg-gray-200"
                    aria-label="Twitter">
                    <IconTwitter />
                  </Link>
                  <Link
                    to="https://github.com/pftom/refly"
                    target="_blank"
                    className="rounded-md bg-gray-100 px-4 py-1 text-gray-600 no-underline transition hover:bg-gray-200"
                    aria-label="GitHub">
                    <IconGithub />
                  </Link>
                </div>
                <div className="mt-6">
                  <p className="text-sm text-gray-500">
                    © {new Date().getFullYear()} Powerformer, Inc.
                  </p>
                </div>
              </div>

              {/* Right Column - Navigation Links */}
              <div className="grid gap-8 sm:grid-cols-2">
                {/* First Row */}
                <div className="grid gap-8">
                  {/* Products */}
                  <div>
                    <h6 className="mb-1 text-[14px] font-medium">
                      {t("landingPage.footer.product.title")}
                    </h6>
                    <ul className="list-none text-sm">
                      <li className="mb-1">
                        <Link
                          target="_blank"
                          to="https://chromewebstore.google.com/detail/lecbjbapfkinmikhadakbclblnemmjpd"
                          className="text-gray-500 no-underline transition duration-150 ease-in-out hover:text-gray-700">
                          {t("landingPage.footer.product.one")}
                        </Link>
                      </li>
                    </ul>
                  </div>

                  {/* Resources */}
                  <div>
                    <h6 className="mb-1 text-[14px] font-medium">
                      {t("landingPage.footer.resource.title")}
                    </h6>
                    <ul className="list-none text-sm">
                      <li className="mb-1">
                        <Link
                          to="https://twitter.com/tuturetom"
                          target="_blank"
                          className="text-gray-500 no-underline transition duration-150 ease-in-out hover:text-gray-700">
                          {t("landingPage.footer.resource.one")}
                        </Link>
                      </li>
                    </ul>
                  </div>
                </div>

                {/* Second Row */}
                <div className="grid gap-8">
                  {/* About */}
                  <div>
                    <h6 className="mb-1 text-[14px] font-medium">
                      {t("landingPage.footer.about.title")}
                    </h6>
                    <ul className="list-none text-sm">
                      <li className="mb-1">
                        <Link
                          to="/privacy"
                          className="text-gray-500 no-underline transition duration-150 ease-in-out hover:text-gray-700">
                          {t("landingPage.footer.about.one")}
                        </Link>
                      </li>
                      <li className="mb-1">
                        <Link
                          to="/terms"
                          className="text-gray-500 no-underline transition duration-150 ease-in-out hover:text-gray-700">
                          {t("landingPage.footer.about.two")}
                        </Link>
                      </li>
                    </ul>
                  </div>

                  {/* Contact Us */}
                  <div>
                    <h6 className="mb-1 text-[14px] font-medium">
                      {t("landingPage.footer.contactUs.title")}
                    </h6>
                    <ul className="list-none text-sm">
                      <li className="mb-1">
                        <Link
                          to="mailto:pftom@qq.com"
                          className="text-gray-500 no-underline transition duration-150 ease-in-out hover:text-gray-700">
                          {t("landingPage.footer.contactUs.one")}
                        </Link>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}

export default Footer
