import React, { useEffect, useMemo, useState } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import { useAppDispatch, useAppState } from '../state/context.js';
import { connectToDatabase } from '../state/effects.js';
import { ActionType } from '../state/actions.js';
import { DBType, ViewState } from '../types/state.js';

const PLACEHOLDERS: Record<DBType, string> = {
  [DBType.PostgreSQL]: 'postgres://user:password@localhost:5432/database',
  [DBType.MySQL]: 'mysql://user:password@localhost:3306/database',
  [DBType.SQLite]: '/path/to/database.sqlite'
};

export const ConnectionView: React.FC = () => {
  const dispatch = useAppDispatch();
  const state = useAppState();
  const [connectionString, setConnectionString] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (!state.dbType) {
      dispatch({ type: ActionType.SetView, view: ViewState.DBType });
    }
  }, [dispatch, state.dbType]);

  useEffect(() => {
    setLocalError(null);
  }, [state.errorMessage]);

  const placeholder = useMemo(() => {
    return state.dbType ? PLACEHOLDERS[state.dbType] : '';
  }, [state.dbType]);

  useInput((input, key) => {
    if ((input === 's' || input === 'S') && state.savedConnections.length > 0) {
      dispatch({ type: ActionType.SetView, view: ViewState.SavedConnections });
    }
    if (key.escape) {
      dispatch({ type: ActionType.SetView, view: ViewState.DBType });
    }
  });

  const handleSubmit = async (value: string) => {
    if (!state.dbType) {
      setLocalError('Select a database type first.');
      return;
    }
    if (!value.trim()) {
      setLocalError('Connection string is required.');
      return;
    }

    setLocalError(null);

    await connectToDatabase(dispatch, state, {
      type: state.dbType,
      connectionString: value.trim()
    });
  };

  return (
    <Box flexDirection="column">
      <Text>
        Selected database:{' '}
        <Text color="cyan">
          {state.dbType ? state.dbType.toUpperCase() : 'None'}
        </Text>
      </Text>
      <Text>
        Enter the connection string and press Enter:
      </Text>
      <Box marginTop={1}>
        <TextInput
          value={connectionString}
          placeholder={placeholder}
          onChange={setConnectionString}
          onSubmit={handleSubmit}
        />
      </Box>
      <Box marginTop={1} flexDirection="column">
        <Text dimColor>Examples:</Text>
        <Text dimColor>- PostgreSQL: postgres://user:pass@host:5432/db</Text>
        <Text dimColor>- MySQL: mysql://user:pass@host:3306/db</Text>
        <Text dimColor>- SQLite: /absolute/path/to/file.sqlite</Text>
        <Text dimColor>
          Shortcuts: s saved connections{state.savedConnections.length === 0 ? ' (none yet)' : ''} • Esc change database
        </Text>
      </Box>
      {localError && (
        <Box marginTop={1}>
          <Text color="red">Error: {localError}</Text>
        </Box>
      )}
    </Box>
  );
};
