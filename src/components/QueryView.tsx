import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import { useAppDispatch, useAppState } from '../state/context.js';
import { ViewState } from '../types/state.js';
import { ActionType } from '../state/actions.js';
import { executeQuery } from '../state/effects.js';
import { ViewBuilder } from './ViewBuilder.js';

export const QueryView: React.FC = () => {
  const { state, dispatch } = useAppState();
  const [queryText, setQueryText] = useState('');
  const [isExecuting, setIsExecuting] = useState(false);

  useInput((input, key) => {
    if (key.escape) {
      dispatch({ type: ActionType.SetView, view: ViewState.Tables });
    }
    if (input === 'r' && !isExecuting) {
      setQueryText('');
    }
    if (input === 'h' && state.queryHistory.length > 0) {
      dispatch({ type: ActionType.SetView, view: ViewState.QueryHistory });
    }
  });

  const handleSubmit = async () => {
    if (!queryText.trim() || !state.activeConnection || !state.dbType) {
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

  const lastResult = state.queryHistory?.find(item => !item.error);

  return (
    <ViewBuilder
      title="SQL Query"
      subtitle={`Connected to: ${state.activeConnection?.name || 'Unknown'}`}
      content={
        <Box flexDirection="column">
          <Box flexDirection="column" marginBottom={1}>
            <Text color="blue">Enter SQL Query:</Text>
            <Text color="gray" dimColor>
              Press Enter to execute, Esc to go back, 'r' to clear, 'h' for history
            </Text>
          </Box>

          <Box flexDirection="column" marginBottom={1}>
            <TextInput
              value={queryText}
              onChange={setQueryText}
              onSubmit={handleSubmit}
              placeholder="SELECT * FROM table_name LIMIT 10..."
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

          {state.queryHistory.length > 0 && (
            <Box flexDirection="column">
              <Text color="cyan">
                Query History: {state.queryHistory.length} quer{state.queryHistory.length === 1 ? 'y' : 'ies'}
              </Text>
              <Text color="gray" dimColor>
                Press 'h' to view full history
              </Text>
            </Box>
          )}
        </Box>
      }
      helpText={`
SQL Query Editor Help:
• Type SQL query and press Enter to execute
• Press 'r' to clear the current query
• Press 'h' to view query history
• Press 'Esc' to go back to tables view
• Use standard SQL syntax for your database type
• Query results are shown in the data preview view
              `.trim()}
    />
  );
};