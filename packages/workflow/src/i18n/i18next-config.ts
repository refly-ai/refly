"use client"
import i18n from "i18next"
import { initReactI18next } from "react-i18next"

import common from "./en-US/common"
import layout from "./en-US/layout"
import login from "./en-US/login"
import register from "./en-US/register"
import app from "./en-US/app"
import appOverview from "./en-US/app-overview"
import apDebug from "./en-US/app-debug"
import appApi from "./en-US/app-api"
import appLog from "./en-US/app-log"
import appAnnotation from "./en-US/app-annotation"
import shareApp from "./en-US/share-app"
import dataset from "./en-US/dataset"
import datasetDocuments from "./en-US/dataset-documents"
import datasetHitTesting from "./en-US/dataset-hit-testing"
import datasetSettings from "./en-US/dataset-settings"
import datasetCreation from "./en-US/dataset-creation"
import explore from "./en-US/explore"
import billing from "./en-US/billing"
import custom from "./en-US/custom"
import tools from "./en-US/tools"
import workflow from "./en-US/workflow"
import runLog from "./en-US/run-log"

i18n.use(initReactI18next).init({
  lng: undefined,
  fallbackLng: "en-US",
  resources: {
    "en-US": {
      translation: {
        common,
        layout,
        login,
        register,
        app,
        appOverview,
        apDebug,
        appApi,
        appLog,
        appAnnotation,
        shareApp,
        dataset,
        datasetDocuments,
        datasetHitTesting,
        datasetSettings,
        datasetCreation,
        explore,
        billing,
        custom,
        tools,
        workflow,
        runLog,
      },
    },
    en: {
      translation: {
        common,
        layout,
        login,
        register,
        app,
        appOverview,
        apDebug,
        appApi,
        appLog,
        appAnnotation,
        shareApp,
        dataset,
        datasetDocuments,
        datasetHitTesting,
        datasetSettings,
        datasetCreation,
        explore,
        billing,
        custom,
        tools,
        workflow,
        runLog,
      },
    },
  },
})

export const changeLanguage = i18n.changeLanguage
export default i18n
