import React, { useMemo } from 'react';
import { Box, Text } from 'ink';
import SelectInput from 'ink-select-input';
import { DBType } from '../types/state.js';
import { useAppDispatch, useAppState } from '../state/context.js';
import { ActionType } from '../state/actions.js';

interface DBTypeItem {
  label: string;
  value: DBType;
  description: string;
}

const DB_TYPE_DESCRIPTIONS: Record<DBType, string> = {
  [DBType.PostgreSQL]: 'Advanced open-source relational database with rich feature set.',
  [DBType.MySQL]: 'Popular open-source relational database known for performance.',
  [DBType.SQLite]: 'Lightweight embedded database stored on disk.'
};

export const DBTypeView: React.FC = () => {
  const dispatch = useAppDispatch();
  const state = useAppState();

  const items = useMemo<DBTypeItem[]>(() => {
    return Object.values(DBType).map(value => ({
      label: value.toUpperCase(),
      value,
      description: DB_TYPE_DESCRIPTIONS[value]
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
          items={items.map(({ label, value }) => ({ label, value }))}
          onSelect={handleSelect}
        />
      </Box>
      <Box flexDirection="column">
        {items.map(item => (
          <Box key={item.value} marginBottom={1}>
            <Text color={item.value === state.dbType ? 'cyan' : undefined}>
              {item.label}: {item.description}
            </Text>
          </Box>
        ))}
      </Box>
    </Box>
  );
};
