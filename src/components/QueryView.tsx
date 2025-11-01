import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import { useAppDispatch, useAppState } from '../state/context.js';
import { ViewState } from '../types/state.js';
import { ActionType } from '../state/actions.js';
import { executeQuery } from '../state/effects.js';
import { ViewBuilder } from './ViewBuilder.js';

export const QueryView: React.FC = () => {
  const state = useAppState();
  const dispatch = useAppDispatch();
  const [queryText, setQueryText] = useState('');
  const [isExecuting, setIsExecuting] = useState(false);
  const [showCommands, setShowCommands] = useState(false);

  useInput((input, key) => {
    if (key.escape) {
      if (showCommands) {
        setShowCommands(false);
      } else {
        dispatch({ type: ActionType.SetView, view: ViewState.Tables });
      }
    }

    // Tab toggles command mode
    if (key.tab) {
      setShowCommands(!showCommands);
      return;
    }

    // Only process command shortcuts when in command mode
    if (showCommands) {
      if (input === 'c' && !isExecuting) {
        setQueryText('');
        setShowCommands(false);
        return;
      }
      if (input === 'h' && (state.queryHistory?.length ?? 0) > 0) {
        dispatch({ type: ActionType.SetView, view: ViewState.QueryHistory });
        return;
      }
    }
  });

  const handleSubmit = async () => {
    if (!queryText.trim() || !state?.activeConnection || !state?.dbType) {
      return;
    }

    setIsExecuting(true);
    try {
      await executeQuery(dispatch, state, {
        type: state.dbType,
        connectionString: state.activeConnection.connectionString
      }, queryText);
    } finally {
      setIsExecuting(false);
    }
  };

  const lastResult = state?.queryHistory?.find(item => !item.error);

  return (
    <ViewBuilder
      title="SQL Query"
      subtitle={`Connected to: ${state?.activeConnection?.name || 'Unknown'}`}
      footer="Tab: Commands | Enter: Execute | ?: Help | Esc: Back"
    >
      <Box flexDirection="column">
        <Box flexDirection="column" marginBottom={1}>
          <Text color="blue">Enter SQL Query:</Text>
          <Text color="gray" dimColor>
            {showCommands ? (
              <Text color="yellow">Command Mode: 'c' to clear, 'h' for history, Tab to exit</Text>
            ) : (
              "Press Tab to enter command mode, Enter to execute query"
            )}
          </Text>
        </Box>

        <Box flexDirection="column" marginBottom={1}>
          <TextInput
            value={queryText}
            onChange={setQueryText}
            onSubmit={handleSubmit}
            placeholder="SELECT * FROM table_name LIMIT 10..."
            disabled={showCommands}
          />
        </Box>

        {isExecuting && (
          <Box marginBottom={1}>
            <Text color="yellow">Executing query...</Text>
          </Box>
        )}

        {lastResult && (
          <Box flexDirection="column" marginBottom={1}>
            <Text color="green">
              ✓ Last query executed successfully ({lastResult.rowCount} rows, {lastResult.durationMs}ms)
            </Text>
          </Box>
        )}

        {(state.queryHistory?.length ?? 0) > 0 && (
          <Box flexDirection="column">
            <Text color="cyan">
              Query History: {state.queryHistory?.length ?? 0} quer{(state.queryHistory?.length ?? 0) === 1 ? 'y' : 'ies'}
            </Text>
            <Text color="gray" dimColor>
              Press Tab, then 'h' to view full history
            </Text>
          </Box>
        )}
      </Box>
    </ViewBuilder>
  );
};