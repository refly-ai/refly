import React, { memo } from 'react';
import validator from '@rjsf/validator-ajv8';
import {
  ReflyRjsfForm,
  rjsfSchema,
  rjsfUiSchema,
} from '@refly-packages/ai-workspace-common/components/rjsf';

const FormPage: React.FC = () => {
  const log = (type: string) => (data: any) => {
    console.log(type, data);
  };

  return (
    <div className="min-h-screen flex justify-center">
      <ReflyRjsfForm
        schema={rjsfSchema}
        uiSchema={rjsfUiSchema}
        validator={validator}
        onChange={log('changed')}
        onSubmit={log('submitted')}
        onError={log('errors')}
      />
    </div>
  );
};

export default memo(FormPage);
