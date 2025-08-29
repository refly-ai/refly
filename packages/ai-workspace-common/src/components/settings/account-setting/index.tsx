import { Button, Form, Input, Upload, message, Modal } from 'antd';
import { useState, useMemo, useEffect } from 'react';
import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';
import { AiOutlineUser } from 'react-icons/ai';

import { useUserStore, useUserStoreShallow } from '@refly/stores';
// components
import { useTranslation } from 'react-i18next';
import { useDebouncedCallback } from 'use-debounce';
import ImgCrop from 'antd-img-crop';
import { AiOutlineLoading3Quarters } from 'react-icons/ai';
import { BiSolidEdit } from 'react-icons/bi';
import { ContentHeader } from '../contentHeader';
import { useLogout } from '@refly-packages/ai-workspace-common/hooks/use-logout';

export const AccountSetting = () => {
  const [form] = Form.useForm();
  const userStore = useUserStore();
  const { t } = useTranslation();
  const [loadingAvatar, setLoadingAvatar] = useState(false);
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);

  const [avatarKey, setAvatarKey] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const userProfile = useUserStoreShallow((state) => state.userProfile);

  useEffect(() => {
    if (userProfile?.avatar) {
      setAvatarUrl(userProfile.avatar);
    }
  }, [userProfile?.avatar]);

  const [avatarError, setAvatarError] = useState(false);

  const [nameStatus, setNameStatus] = useState<'error' | 'success' | 'warning' | 'validating'>(
    'success',
  );
  const [nameMessage, setNameMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const { handleLogout, contextHolder } = useLogout();

  const uploadAvatar = async (file: File) => {
    if (loadingAvatar) return;
    setLoadingAvatar(true);
    const { data } = await getClient().upload({
      body: { file, visibility: 'public' },
    });
    setLoadingAvatar(false);
    if (data?.data?.storageKey) {
      setAvatarError(false);
      setAvatarKey(data.data.storageKey);
      setAvatarUrl(data.data.url);
    }
  };

  const beforeUpload = (file: File) => {
    const isValidType = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif'].includes(file.type);
    if (!isValidType) {
      message.error(t('settings.account.onlyImageAllowed', { type: 'PNG, JPG, JPEG, GIF' }));
      return Upload.LIST_IGNORE;
    }

    const isValidSize = file.size / 1024 / 1024 < 2;
    if (!isValidSize) {
      message.error(t('settings.account.imageSizeLimited', { size: 2 }));
      return Upload.LIST_IGNORE;
    }

    uploadAvatar(file);

    return false;
  };

  const checkUsername = async (name: string) => {
    try {
      const { data } = await getClient().checkSettingsField({
        query: { field: 'name', value: name },
      });
      return data?.data?.available;
    } catch (_error) {
      return false;
    }
  };

  const validateField = async (value: string) => {
    if (!value) {
      setNameStatus('error');
      setNameMessage(t('settings.account.namePlaceholder'));
      return;
    }
    if (!/^[a-zA-Z0-9_]{1,30}$/.test(value)) {
      setNameStatus('error');
      setNameMessage(t('settings.account.nameValidationError'));
      return;
    }
    setNameMessage('');

    const isAvailable = await checkUsername(value);
    if (!isAvailable) {
      setNameStatus('error');
      setNameMessage(t('settings.account.nameInvalid'));
    } else {
      setNameStatus('success');
      setNameMessage('');
    }
  };

  const debouncedValidateField = useDebouncedCallback(validateField, 300);

  const handleUpdate = async () => {
    if (nameStatus === 'error') {
      return;
    }
    let values: { name: string; nickname: string };
    try {
      values = await form.validateFields();
    } catch (error) {
      console.error('Error validating form fields', error);
      return;
    }

    const { name, nickname } = values;
    if (loading) return;
    setLoading(true);
    try {
      const { error } = await getClient().updateSettings({
        body: {
          name,
          nickname,
          avatarStorageKey: avatarKey,
        },
      });
      if (error) {
        console.error(error);
        return;
      }
      message.success(t('settings.account.updateSuccess'));
      userStore.setUserProfile({ ...userStore.userProfile!, name, nickname, avatar: avatarUrl });
      setIsEditModalVisible(false);
    } finally {
      setLoading(false);
    }
  };

  const handleEditClick = () => {
    setIsEditModalVisible(true);
    form.setFieldsValue({
      name: userProfile?.name,
      nickname: userProfile?.nickname,
    });
    setAvatarKey(userProfile?.avatar ?? '');
    setAvatarUrl(userProfile?.avatar ?? '');
    setAvatarError(false);
  };

  const handleCancelEdit = () => {
    setIsEditModalVisible(false);
    form.resetFields();
    setAvatarKey(userProfile?.avatar ?? '');
    setAvatarUrl(userProfile?.avatar ?? '');
    setAvatarError(false);
    setNameStatus('success');
    setNameMessage('');
  };

  // Avatar display component
  const AvatarDisplay = useMemo(() => {
    if (userProfile?.avatar && !avatarError) {
      return (
        <img
          src={userProfile.avatar}
          alt="avatar"
          className="w-full h-full object-cover rounded-full"
          onError={() => {
            setAvatarError(true);
          }}
        />
      );
    }
    return (
      <div className="flex items-center justify-center w-full h-full">
        <AiOutlineUser size={32} className="text-gray-400" />
      </div>
    );
  }, [userProfile?.avatar, avatarError]);

  return (
    <div className="h-full overflow-hidden flex flex-col">
      <ContentHeader title={t('settings.tabs.account')} />

      <div className="px-5 py-6 w-full h-full box-border overflow-y-auto">
        <div className="flex flex-col gap-6">
          {/* User Profile Section */}
          <div className="p-3 rounded-xl bg-refly-bg-control-z0 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-[52px] h-[52px] bg-gray-200 rounded-full overflow-hidden flex-shrink-0">
                {AvatarDisplay}
              </div>
              <div>
                <div className="mb-[2px] text-base leading-[26px] font-semibold text-refly-text-0">
                  {userProfile?.name || 'Unknown'}
                </div>
                <div className="text-sm leading-5 text-refly-text-1">
                  {userProfile?.email || 'No email provided'}
                </div>
              </div>
            </div>

            <Button
              type="text"
              color="default"
              variant="filled"
              onClick={handleEditClick}
              className="font-semibold hover:bg-refly-tertiary-hover"
            >
              {t('settings.account.editAccount')}
            </Button>
          </div>

          <div className="flex flex-col gap-2 text-sm  text-refly-text-0 leading-5">
            <div className="font-semibold">{t('settings.account.name')}</div>
            <div>{userProfile?.name || 'Not set'}</div>
          </div>

          <div className="flex flex-col gap-2 text-sm  text-refly-text-0 leading-5">
            <div className="font-semibold">{t('settings.account.nickname')}</div>
            <div>{userProfile?.nickname || 'Not set'}</div>
          </div>

          <div className="flex flex-col gap-2 text-sm  text-refly-text-0 leading-5">
            <div className="font-semibold">{t('settings.account.email')}</div>
            <div>{userProfile?.email || 'Not set'}</div>
          </div>

          {/* Logout Button */}
          <div>
            <Button variant="filled" onClick={handleLogout}>
              <span className="text-refly-func-danger-default font-semibold">
                {t('settings.account.logout')}
              </span>
            </Button>
          </div>
        </div>
      </div>

      {/* Edit Account Modal */}
      <Modal
        centered
        title={t('settings.account.editAccount')}
        open={isEditModalVisible}
        onCancel={handleCancelEdit}
        footer={[
          <Button key="cancel" onClick={handleCancelEdit}>
            {t('common.cancel')}
          </Button>,
          <Button
            key="save"
            type="primary"
            onClick={handleUpdate}
            loading={loading}
            disabled={nameStatus === 'error'}
          >
            {t('common.save')}
          </Button>,
        ]}
        width={500}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" className="mt-4">
          <Form.Item label={t('settings.account.avatar')} name="avatar">
            <ImgCrop
              rotationSlider
              modalTitle={t('settings.account.cropAvatar')}
              modalOk={t('common.confirm')}
              modalCancel={t('common.cancel')}
            >
              <Upload
                listType="picture-circle"
                name="avatar"
                showUploadList={false}
                beforeUpload={beforeUpload}
              >
                <div className="w-full h-full group relative bg-gray-200 rounded-full flex items-center justify-center overflow-hidden dark:bg-gray-800">
                  {loadingAvatar && (
                    <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                      <AiOutlineLoading3Quarters size={22} className="animate-spin text-white" />
                    </div>
                  )}
                  {!loadingAvatar && (
                    <div className="absolute invisible group-hover:visible inset-0 bg-black/20 flex items-center justify-center">
                      <BiSolidEdit size={22} className="text-white" />
                    </div>
                  )}

                  {avatarKey && !avatarError ? (
                    <img
                      src={avatarUrl}
                      alt="avatar"
                      className="w-full h-full object-cover"
                      onError={() => {
                        setAvatarError(true);
                      }}
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center">
                      <AiOutlineUser size={32} className="text-white" />
                      <div className="text-gray-400 text-xs mt-1">
                        {t('settings.account.uploadAvatar')}
                      </div>
                    </div>
                  )}
                </div>
              </Upload>
            </ImgCrop>
          </Form.Item>

          <Form.Item
            label={t('settings.account.name')}
            name="name"
            required
            validateStatus={nameStatus}
            help={nameMessage}
            rules={[{ required: true, message: t('settings.account.namePlaceholder') }]}
          >
            <Input
              maxLength={30}
              showCount
              prefix="@"
              placeholder={t('settings.account.namePlaceholder')}
              onChange={(e) => {
                debouncedValidateField(e.target.value);
              }}
            />
          </Form.Item>

          <Form.Item
            label={t('settings.account.nickname')}
            name="nickname"
            required
            rules={[{ required: true, message: t('settings.account.nicknamePlaceholder') }]}
          >
            <Input
              maxLength={30}
              showCount
              placeholder={t('settings.account.nicknamePlaceholder')}
            />
          </Form.Item>
        </Form>
      </Modal>

      {contextHolder}
    </div>
  );
};
