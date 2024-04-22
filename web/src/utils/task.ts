import {
  LANGUAGE,
  LOCALE,
  TASK_TYPE,
  type QUICK_ACTION_TASK_PAYLOAD,
  type SEARCH_ENHANCE,
  type Task,
  type GEN_TITLE,
  type CHAT,
} from "@/types"

import { genUniqueId } from "./index"

export type BuildTask = {
  taskType: TASK_TYPE
  language?: LANGUAGE
  locale?: LOCALE
  data: CHAT | QUICK_ACTION_TASK_PAYLOAD
}

export const buildTask = (payload: BuildTask): Task => {
  const {
    taskType,
    language = LANGUAGE.AUTO,
    locale = LOCALE.ZH_CN,
    data = {},
  } = payload

  console.log("now task locale", locale)

  const task: Task = {
    taskType,
    language,
    locale,
    data: data,
  }

  return task
}

export const buildChatTask = (data, locale: LOCALE = LOCALE.EN): Task => {
  console.log("now task locale", locale)
  const task: Task = {
    taskType: TASK_TYPE.CHAT,
    language: LANGUAGE.AUTO,
    locale,
    data,
  }

  return task
}

export const buildQuickActionTask = (
  data,
  locale: LOCALE = LOCALE.EN,
): Task => {
  console.log("now task locale", locale)

  const task: Task = {
    taskType: TASK_TYPE.QUICK_ACTION,
    language: LANGUAGE.AUTO,
    locale,
    data,
  }

  return task
}
