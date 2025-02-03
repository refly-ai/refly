import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type {} from '@redux-devtools/extension';
import { type Conversation, type Task } from '@/types';
import { ConversationOperation } from '@/types';

interface TaskState {
  // state
  conversationList: Conversation[];

  // 新 feature，快捷操作
  task: Task | null;

  // method
  setConversationList: (conversationList: Conversation[]) => void;
  updateConversation: (
    operationType: ConversationOperation,
    payload: Partial<Conversation>,
  ) => void;
  setTask: (task: Task) => void;
}

export const useTaskStore = create<TaskState>()(
  devtools((set) => ({
    conversationList: [],
    task: null,

    setConversationList: (val: Conversation[]) => set({ conversationList: val }),
    updateConversation: (operationType: ConversationOperation, payload: Partial<Conversation>) =>
      set((state) => {
        const conversationList = state.conversationList;
        let newConversationList = conversationList;

        switch (operationType) {
          case ConversationOperation.CREATE: {
            const { title = '新会话', origin, originPageTitle } = payload;
            const newConversation = {
              title: title ?? '新会话',
              origin,
              originPageTitle,
              createdAt: new Date().getTime() as number,
              updatedAt: new Date().getTime() as number,
              readEnhanceArticle: null,
              readEnhanceIndexStatus: null,
            } as Conversation;

            newConversationList = [newConversation].concat(conversationList);

            break;
          }

          case ConversationOperation.DELETE: {
            const { convId } = payload;
            const _newConversationList = conversationList.filter((item) => item.convId !== convId);

            break;
          }

          case ConversationOperation.UPDATE: {
            const { convId } = payload;
            const _newConversationList = conversationList.map((item) => {
              if (item.convId === convId) {
                return { ...item, ...payload };
              }

              return item;
            });

            break;
          }
        }

        return {
          ...state,
          conversationList: newConversationList,
        };
      }),
    setTask: (val: Task) => set((state) => ({ ...state, task: val })),
  })),
);
