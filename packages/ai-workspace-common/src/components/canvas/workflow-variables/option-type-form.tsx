import React, { useCallback } from 'react';
import { Form, Input, Button, Radio } from 'antd';
import { useTranslation } from 'react-i18next';
import { Add, Delete } from 'refly-icons';
import { MdOutlineDragIndicator } from 'react-icons/md';
import { DragDropContext, Droppable, Draggable, DropResult } from 'react-beautiful-dnd';
import cn from 'classnames';
import { MAX_OPTIONS } from './constants';

interface OptionTypeFormProps {
  options: string[];
  editingIndex: number | null;
  currentOption: string;
  onEditingIndexChange: (index: number | null) => void;
  onCurrentOptionChange: (option: string) => void;
  onAddOption: () => void;
  onRemoveOption: (index: number) => void;
  onOptionChange: (index: number, value: string) => void;
  onEditStart: (index: number) => void;
  onEditSave: (value: string, index: number) => void;
  onDragEnd: (result: DropResult) => void;
  onDragStart: () => void;
}

export const OptionTypeForm: React.FC<OptionTypeFormProps> = React.memo(
  ({
    options,
    editingIndex,
    currentOption,
    onEditingIndexChange,
    onCurrentOptionChange,
    onAddOption,
    onRemoveOption,
    onOptionChange,
    onEditStart,
    onEditSave,
    onDragEnd,
    onDragStart,
  }) => {
    const { t } = useTranslation();

    const handleAddOption = useCallback(() => {
      if (options.length < MAX_OPTIONS) {
        onAddOption();
      }
    }, [options.length, onAddOption]);

    const handleRemoveOption = useCallback(
      (index: number) => {
        onRemoveOption(index);
      },
      [onRemoveOption],
    );

    const handleOptionChange = useCallback(
      (index: number, value: string) => {
        onOptionChange(index, value);
      },
      [onOptionChange],
    );

    const handleEditStart = useCallback(
      (index: number) => {
        onEditStart(index);
      },
      [onEditStart],
    );

    const handleEditSave = useCallback(
      (value: string, index: number) => {
        onEditSave(value, index);
      },
      [onEditSave],
    );

    const handleDragEnd = useCallback(
      (result: DropResult) => {
        onDragEnd(result);
      },
      [onDragEnd],
    );

    const handleDragStart = useCallback(() => {
      onDragStart();
    }, [onDragStart]);

    const isDuplicate = useCallback(
      (value: string, index: number) => {
        return options.some((option, i) => i !== index && option === value);
      },
      [options],
    );

    return (
      <>
        <Form.Item
          label={t('canvas.workflow.variables.selectMode') || 'Selection Mode'}
          name="isSingle"
        >
          <Radio.Group>
            <Radio value={true}>
              {t('canvas.workflow.variables.singleSelect') || 'Single Select'}
            </Radio>
            <Radio value={false}>
              {t('canvas.workflow.variables.multipleSelect') || 'Multiple Select'}
            </Radio>
          </Radio.Group>
        </Form.Item>

        <Form.Item
          label={t('canvas.workflow.variables.options') || 'Options'}
          name="currentOption"
          rules={[
            {
              validator: async (_, _value) => {
                if (!options?.length || options.length < 1) {
                  throw new Error(
                    t('canvas.workflow.variables.optionsRequired') ||
                      'At least one option is required',
                  );
                }

                // Filter out empty options
                const validOptions = options.filter((option) => option && option.trim().length > 0);
                if (validOptions.length < 1) {
                  throw new Error(
                    t('canvas.workflow.variables.optionsRequired') ||
                      'At least one valid option is required',
                  );
                }

                // Check for duplicate values (case-insensitive)
                const uniqueOptions = new Set(validOptions.map((option) => option.toLowerCase()));
                if (uniqueOptions.size !== validOptions.length) {
                  throw new Error(
                    t('canvas.workflow.variables.duplicateOption') ||
                      'Duplicate option value is not allowed',
                  );
                }

                return Promise.resolve();
              },
            },
          ]}
        >
          <DragDropContext onDragEnd={handleDragEnd} onDragStart={handleDragStart}>
            <Droppable droppableId="options-list">
              {(provided) => (
                <div
                  {...provided.droppableProps}
                  ref={provided.innerRef}
                  className="space-y-2 max-h-[200px] overflow-y-auto"
                >
                  {options.map((option, index) => (
                    <Draggable
                      key={`option-${index}`}
                      draggableId={`option-${index}`}
                      index={index}
                    >
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          className="flex items-center"
                        >
                          {/* Hidden drag handle for editing state to satisfy react-beautiful-dnd */}
                          {editingIndex === index && (
                            <div
                              {...provided.dragHandleProps}
                              className="invisible w-0 h-0"
                              aria-hidden="true"
                            />
                          )}

                          {editingIndex === index ? (
                            <Input
                              value={currentOption}
                              onChange={(e) => {
                                const val = e.target.value;
                                onCurrentOptionChange(val);
                                handleOptionChange(index, val);
                              }}
                              onBlur={() => {
                                handleEditSave(currentOption ?? '', index);
                                onEditingIndexChange(null);
                              }}
                              autoFocus
                              className={cn('flex-1', {
                                '!border-refly-func-danger-default': isDuplicate(
                                  currentOption,
                                  index,
                                ),
                              })}
                              data-option-index={index}
                              maxLength={200}
                              showCount
                            />
                          ) : (
                            <div
                              className={cn(
                                'group w-full h-8 p-2 flex items-center gap-2 box-border border-[1px] border-solid border-refly-Card-Border rounded-lg hover:bg-refly-tertiary-hover cursor-pointer',
                                {
                                  'shadow-lg': snapshot.isDragging,
                                },
                              )}
                              onClick={() => handleEditStart(index)}
                            >
                              <div
                                {...provided.dragHandleProps}
                                className="flex items-center justify-center"
                              >
                                <MdOutlineDragIndicator
                                  className={cn('text-refly-text-3 cursor-move', {
                                    'invisible w-0 h-0': options.length < 2,
                                  })}
                                  aria-hidden={options.length < 2}
                                  size={16}
                                />
                              </div>

                              <div
                                className={cn('flex-1 text-sm leading-5 truncate', {
                                  'text-refly-text-3': !option,
                                })}
                              >
                                {option ||
                                  t('canvas.workflow.variables.clickToEdit') ||
                                  'Click to edit'}
                              </div>
                              <Button
                                className="hidden group-hover:block"
                                type="text"
                                size="small"
                                icon={<Delete size={16} color="var(--refly-text-1)" />}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  e.preventDefault();
                                  handleRemoveOption(index);
                                }}
                              />
                            </div>
                          )}
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>

          {options.length < MAX_OPTIONS && (
            <Button
              type="default"
              onClick={handleAddOption}
              className="w-full border-none bg-refly-bg-control-z0 mt-2"
              icon={<Add size={16} />}
              disabled={editingIndex !== null && !currentOption}
            >
              {t('canvas.workflow.variables.addOption') || 'Add Option'}
            </Button>
          )}
        </Form.Item>
      </>
    );
  },
);

OptionTypeForm.displayName = 'OptionTypeForm';
