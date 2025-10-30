import React, { useMemo } from 'react';
import { Box, Text } from 'ink';
import SelectInput from 'ink-select-input';
import { DBType } from '../types/state.js';
import { useAppDispatch, useAppState } from '../state/context.js';
import { ActionType } from '../state/actions.js';

interface DBTypeItem {
  label: string;
  value: DBType;
}


export const DBTypeView: React.FC = () => {
  const dispatch = useAppDispatch();
  const state = useAppState();

  const items = useMemo<DBTypeItem[]>(() => {
    return Object.values(DBType).map(value => ({
      label: value.toUpperCase(),
      value
    }));
  }, []);

  if (state.loading) {
    return null;
  }

  const handleSelect = (item: { value: DBType }) => {
    dispatch({ type: ActionType.SelectDBType, dbType: item.value });
  };

  return (
    <Box flexDirection="column">
      <Text>Select a database engine:</Text>
      <Box marginY={1}>
        <SelectInput
          items={items}
          onSelect={handleSelect}
        />
      </Box>
    </Box>
  );
};
