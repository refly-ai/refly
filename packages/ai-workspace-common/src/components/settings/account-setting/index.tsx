import { Button, Form, Input, Upload, message } from 'antd';
import { useEffect, useState } from 'react';
import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';
import { AiOutlineUser } from 'react-icons/ai';

import { useUserStore } from '@refly-packages/ai-workspace-common/stores/user';
// components
import { useTranslation } from 'react-i18next';
import { useDebouncedCallback } from 'use-debounce';
import ImgCrop from 'antd-img-crop';
import { useSiderStoreShallow } from '@refly-packages/ai-workspace-common/stores/sider';
import { AiOutlineLoading3Quarters } from 'react-icons/ai';
import { BiSolidEdit } from 'react-icons/bi';

export const AccountSetting = () => {
  const [form] = Form.useForm();
  const userStore = useUserStore();
  const { t } = useTranslation();
  const [loadingAvatar, setLoadingAvatar] = useState(false);

  const { showSettingModal } = useSiderStoreShallow((state) => ({
    showSettingModal: state.showSettingModal,
  }));
  const [avatarKey, setAvatarKey] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [avatarError, setAvatarError] = useState(false);

  const [nameStatus, setNameStatus] = useState<'error' | 'success' | 'warning' | 'validating'>(
    'success',
  );
  const [nameMessage, setNameMessage] = useState('');
  const [emailStatus, setEmailStatus] = useState<'error' | 'success' | 'warning' | 'validating'>(
    'success',
  );
  const [_emailMessage, setEmailMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const statusMap = {
    name: { status: nameStatus, setStatus: setNameStatus, setMessage: setNameMessage },
    email: { status: emailStatus, setStatus: setEmailStatus, setMessage: setEmailMessage },
  };

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

  const validateField = async (value: string, field: 'name' | 'email') => {
    const { setStatus, setMessage } = statusMap[field];
    if (!value) {
      setStatus('error');
      setMessage(t(`settings.account.${field}Placeholder`));
      return;
    }
    if (!/^[a-zA-Z0-9_]{1,30}$/.test(value)) {
      setStatus('error');
      setMessage(t(`settings.account.${field}ValidationError`));
      return;
    }
    setMessage(t(''));

    const isAvailable = await checkUsername(value);
    if (!isAvailable) {
      setStatus('error');
      setMessage(t(`settings.account.${field}Invalid`));
    } else {
      setStatus('success');
      setMessage('');
    }
  };

  const debouncedValidateField = useDebouncedCallback(validateField, 300);

  const handleUpdate = () => {
    if (nameStatus === 'error') {
      return;
    }
    form.validateFields().then(async (values) => {
      const { name, nickname } = values;
      if (loading) return;
      setLoading(true);
      const { error } = await getClient().updateSettings({
        body: {
          name,
          nickname,
          avatarStorageKey: avatarKey,
        },
      });
      if (error) {
        console.log(error);
        return;
      }
      setLoading(false);
      message.success(t('settings.account.updateSuccess'));
      userStore.setUserProfile({ ...userStore.userProfile, name, nickname, avatar: avatarUrl });
    });
  };

  useEffect(() => {
    if (showSettingModal) {
      form.setFieldsValue({
        ...userStore.userProfile,
      });
      setAvatarKey(userStore.userProfile?.avatar ?? '');
      setAvatarError(false);
    }
  }, [showSettingModal]);

  return (
    <div className="w-full">
      <div className="max-w-[600px] mx-auto">
        <Form form={form} layout="vertical">
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
                <div className="w-full h-full group relative bg-gray-200 rounded-full flex items-center justify-center overflow-hidden">
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
                debouncedValidateField(e.target.value, 'name');
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

          <Form.Item
            label={t('settings.account.email')}
            name="email"
            required
            rules={[{ required: true, message: t('settings.account.nicknamePlaceholder') }]}
          >
            <Input disabled placeholder={t('settings.account.emailPlaceholder')} />
          </Form.Item>

          <div className="flex justify-end mt-6">
            <Button type="primary" onClick={handleUpdate} loading={loading}>
              {t('settings.account.update')}
            </Button>
          </div>
        </Form>
      </div>
    </div>
  );
};
