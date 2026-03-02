import { memo } from 'react';
import { Button, Typography } from 'antd';

const { Title } = Typography;

const HelloWorldPage = memo(() => {
  return (
    <div className="flex min-h-[calc(100vh-64px)] flex-col items-center justify-center gap-4 p-6">
      <Title className="!mb-0" level={2}>
        Hello World
      </Title>
      <Button
        className="!border-[#155EEF] !bg-[#155EEF] hover:!border-[#155EEF] hover:!bg-[#155EEF]"
        type="primary"
      >
        Say Hello
      </Button>
    </div>
  );
});

HelloWorldPage.displayName = 'HelloWorldPage';

export default HelloWorldPage;
