import { memo, FC, useState, useEffect, useMemo, useCallback } from 'react';
import { Select, Spin } from 'antd';
import { useTranslation } from 'react-i18next';
import { useListProjects } from '@refly-packages/ai-workspace-common/queries';

interface ProjectSelectProps {
  projectId: string | null;
  onSelect: (projectId: string) => void;
}

export const ProjectSelect: FC<ProjectSelectProps> = memo(({ projectId, onSelect }) => {
  const { t } = useTranslation();
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const { data, isLoading, refetch } = useListProjects({ query: { page, pageSize } }, null, {
    enabled: true,
  });

  const projectOptions = useMemo(() => {
    return (
      data?.data?.map((project) => ({
        label: project?.name,
        value: project?.projectId,
      })) ?? []
    );
  }, [data?.data]);

  const handleScroll = useCallback(() => {
    if (data?.data?.length === pageSize) {
      setPage((prevPage) => prevPage + 1);
    }
  }, [data?.data?.length, pageSize]);

  const handleChange = useCallback(
    (value: string) => {
      onSelect?.(value);
    },
    [onSelect],
  );

  useEffect(() => {
    refetch?.();
  }, [page, refetch]);

  return (
    <div className="w-[300px]">
      <Select
        placeholder={t('resource.import.selectProject')}
        className="w-full"
        loading={isLoading}
        value={projectId}
        onChange={handleChange}
        options={projectOptions}
        showSearch
        filterOption={(input, option) =>
          (option?.label?.toString().toLowerCase() ?? '').includes(input.toLowerCase())
        }
        onPopupScroll={handleScroll}
        notFoundContent={isLoading ? <Spin size="small" /> : null}
      />
    </div>
  );
});
